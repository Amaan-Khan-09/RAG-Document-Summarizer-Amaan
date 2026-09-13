# app.py

import json
import os

import ollama
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from rag_engine import RAGEngine

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
CORS(app)

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
    """Health check: reports API status, Ollama reachability, and doc count."""
    ollama_ok = True
    try:
        ollama.list()
    except Exception:
        ollama_ok = False

    try:
        stats = rag.get_stats()
    except Exception:
        stats = {"total_chunks": 0, "total_documents": 0}

    return jsonify({
        "status": "ok",
        "ollama_connected": ollama_ok,
        **stats,
    }), 200


@app.route('/api/upload', methods=['POST'])
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
            chunks = rag.add_document(filepath, filename)
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

    return jsonify({"results": results}), 200


@app.route('/api/documents', methods=['GET'])
def list_documents():
    """List every uploaded document with its chunk count."""
    try:
        return jsonify({"documents": rag.list_documents()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/documents/<path:filename>', methods=['DELETE'])
def delete_document(filename):
    """Delete a single document (and all its chunks)."""
    try:
        found = rag.delete_document(filename)
        if not found:
            return jsonify({"error": f"'{filename}' not found"}), 404
        return jsonify({"message": f"Deleted '{filename}'"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/query', methods=['POST'])
def query():
    """Ask a question, streamed as newline-delimited JSON."""
    data = request.get_json(silent=True) or {}
    question = data.get('question')

    if not question:
        return jsonify({"error": "No question provided"}), 400

    n_results = data.get('n_results', 5)
    return ndjson_stream(rag.query_stream(question, n_results))


@app.route('/api/summarize', methods=['POST'])
def summarize():
    """Summarize one document (or all documents), streamed as NDJSON."""
    data = request.get_json(silent=True) or {}
    filename = data.get('filename')
    return ndjson_stream(rag.summarize_stream(filename))


@app.route('/api/clear', methods=['DELETE'])
def clear():
    """Clear all documents from the database."""
    try:
        rag.clear_all()
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
