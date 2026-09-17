# app.py

import json
import os
from functools import wraps

from dotenv import load_dotenv

# Must run before importing llm_provider -- it reads its provider/API-key
# env vars at import time, so .env has to already be loaded by then.
load_dotenv()

from flask import Flask, g, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename

import llm_provider
from rag_engine import RAGEngine

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
# When the frontend is deployed separately (e.g. on Vercel) rather than
# served by this same Flask app, set ALLOWED_ORIGIN to that exact origin.
CORS(app, origins=os.environ.get("ALLOWED_ORIGIN", "*"))

# Render (like most PaaS platforms) sits its own proxy in front of the app,
# so request.remote_addr would otherwise be Render's proxy IP for every
# request rather than the real client's -- which would make the per-IP rate
# limits below apply globally across all visitors instead of per-visitor.
# ProxyFix reads the real client IP from the X-Forwarded-For header the
# proxy sets. Safe to apply unconditionally: it's a no-op with no proxy.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# CORS only stops *browser* cross-origin requests -- it does nothing against
# curl/Postman/a script hitting this URL directly. When LLM_PROVIDER=gemini,
# every upload/query/summarize call spends real (paid) API quota, so those
# routes are gated behind a shared secret the frontend also holds, plus a
# request-rate ceiling as a second layer in case the secret ever leaks.
APP_SECRET = os.environ.get("APP_SECRET")

limiter = Limiter(get_remote_address, app=app, default_limits=[])


def require_app_secret(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if APP_SECRET and request.headers.get("X-App-Secret") != APP_SECRET:
            return jsonify({"error": "Unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapped


# Every visitor's browser generates its own random id (see frontend
# src/lib/session.ts) and sends it on every request. The vector store is a
# single shared process-wide collection -- without this, one visitor's
# uploaded documents (and their contents, via query/summarize) would be
# readable by every other visitor hitting the same deployment, since nothing
# else partitions the data between browsers/devices.
SESSION_HEADER = "X-Session-Id"


def require_session_id(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        session_id = request.headers.get(SESSION_HEADER)
        if not session_id:
            return jsonify({"error": f"Missing {SESSION_HEADER} header"}), 400
        g.session_id = session_id
        return fn(*args, **kwargs)
    return wrapped


UPLOAD_FOLDER = './uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

rag = RAGEngine()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def ndjson_stream(events):
    """Turn an iterable of (type, payload) tuples into a newline-delimited
    JSON stream the frontend can read incrementally."""
    def generate():
        for event_type, payload in events:
            yield json.dumps({"type": event_type, "data": payload}) + "\n"
        yield json.dumps({"type": "done", "data": None}) + "\n"
    return Response(generate(), mimetype="application/x-ndjson")


# ---------------------------------------------------------------- API ----

@app.route('/api/health', methods=['GET'])
def health():
    """Health check: reports API status, LLM provider reachability, and doc
    count for the requesting session (or 0 if the client is old enough not
    to send a session id yet)."""
    provider_ok = llm_provider.health_check()

    session_id = request.headers.get(SESSION_HEADER)
    try:
        stats = rag.get_stats(session_id) if session_id else {"total_chunks": 0, "total_documents": 0}
    except Exception:
        stats = {"total_chunks": 0, "total_documents": 0}

    return jsonify({
        "status": "ok",
        "provider": llm_provider.PROVIDER_LABEL,
        "ollama_connected": provider_ok,  # kept for frontend backwards-compat
        **stats,
    }), 200


@app.route('/api/upload', methods=['POST'])
@require_app_secret
@require_session_id
@limiter.limit("10 per hour")
def upload_files():
    """Upload and process documents."""
    files = request.files.getlist('files') or request.files.getlist('files[]')

    if not files:
        available_keys = list(request.files.keys())
        if available_keys:
            files = request.files.getlist(available_keys[0])

    if not files or files[0].filename == '':
        return jsonify({"error": "No files selected"}), 400

    results = []
    for file in files:
        if not file or not allowed_file(file.filename):
            results.append({
                "filename": file.filename if file else "unknown",
                "status": "failed",
                "error": "Invalid file type. Allowed: pdf, docx, txt",
            })
            continue

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            chunks = rag.add_document(filepath, filename, g.session_id)
            results.append({
                "filename": filename,
                "status": "success",
                "chunks_created": chunks,
            })
        except Exception as e:
            results.append({
                "filename": filename,
                "status": "failed",
                "error": str(e),
            })
        finally:
            # The raw file's text is already extracted, chunked, and
            # embedded into the vector store at this point -- nothing reads
            # it again after this. Leaving it in place would otherwise grow
            # ./uploads/ without bound on Render's ephemeral disk over
            # repeated uploads across the app's lifetime.
            try:
                os.remove(filepath)
            except OSError:
                pass

    return jsonify({"results": results}), 200


@app.route('/api/documents', methods=['GET'])
@require_session_id
def list_documents():
    """List every document uploaded by this session, with its chunk count."""
    try:
        return jsonify({"documents": rag.list_documents(g.session_id)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/documents/<path:filename>', methods=['DELETE'])
@require_app_secret
@require_session_id
def delete_document(filename):
    """Delete a single document (and all its chunks) from this session."""
    try:
        found = rag.delete_document(filename, g.session_id)
        if not found:
            return jsonify({"error": f"'{filename}' not found"}), 404
        return jsonify({"message": f"Deleted '{filename}'"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/query', methods=['POST'])
@require_app_secret
@require_session_id
@limiter.limit("20 per hour")
def query():
    """Ask a question, streamed as newline-delimited JSON."""
    data = request.get_json(silent=True) or {}
    question = data.get('question')

    if not question:
        return jsonify({"error": "No question provided"}), 400

    n_results = data.get('n_results', 5)
    # Distinct from `None`: an explicit `[]` means every document was
    # excluded via the source-filter checkboxes, and must search nothing --
    # `... or None` would silently discard it and search everything instead.
    included_filenames = data.get('included_filenames')
    return ndjson_stream(rag.query_stream(question, g.session_id, n_results, included_filenames))


@app.route('/api/summarize', methods=['POST'])
@require_app_secret
@require_session_id
@limiter.limit("20 per hour")
def summarize():
    """Summarize one document (or all documents) from this session, streamed as NDJSON."""
    data = request.get_json(silent=True) or {}
    filename = data.get('filename')
    return ndjson_stream(rag.summarize_stream(g.session_id, filename))


@app.route('/api/clear', methods=['DELETE'])
@require_app_secret
@require_session_id
def clear():
    """Clear all of this session's documents from the database."""
    try:
        rag.clear_all(g.session_id)
        return jsonify({"message": "All documents cleared"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------- serve the React app ----

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve the built React app if it exists; otherwise point to dev mode."""
    if path and os.path.exists(os.path.join(FRONTEND_DIST, path)):
        return send_from_directory(FRONTEND_DIST, path)

    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(FRONTEND_DIST, 'index.html')

    return jsonify({
        "message": "Frontend not built. Run `npm run build` inside frontend/, "
                   "or use `npm run dev` in frontend/ during development.",
        "api_base": "/api",
    }), 200


if __name__ == '__main__':
    print("RAG Document Summarizer API starting...")
    print("Endpoints:")
    print("  GET    /api/health")
    print("  POST   /api/upload")
    print("  GET    /api/documents")
    print("  DELETE /api/documents/<filename>")
    print("  POST   /api/query        (streamed NDJSON)")
    print("  POST   /api/summarize    (streamed NDJSON)")
    print("  DELETE /api/clear")
    print("Server running on http://localhost:5000")

    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
