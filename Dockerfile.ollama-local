# --- Stage 1: build the React/TypeScript frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python API + Ollama runtime ---
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py rag_engine.py ./
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 5000

# Ollama's pulled models live in /root/.ollama by default. Mount a volume
# there in production -- without one, every container restart re-downloads
# ~2GB of models from scratch.
VOLUME ["/root/.ollama"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start Ollama, pull the two models this app depends on, then start the API
CMD ollama serve & sleep 10 && ollama pull nomic-embed-text && ollama pull llama3.2 && python app.py
