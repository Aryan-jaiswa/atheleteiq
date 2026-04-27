#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

require_command() {
  local name="$1"
  local message="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "$message" >&2
    exit 1
  fi
}

check_node_version() {
  require_command node "Error: node is required (>= 18)."
  local version
  version="$(node -v | sed 's/^v//')"
  local major="${version%%.*}"
  if [ "$major" -lt 18 ]; then
    echo "Error: node >= 18 is required. Found $version" >&2
    exit 1
  fi
}

check_python_version() {
  require_command python3 "Error: python3 is required (>= 3.10)."
  python3 - <<'PY'
import sys
if sys.version_info < (3, 10):
    raise SystemExit(f"Error: python3 >= 3.10 is required. Found {sys.version.split()[0]}")
PY
}

check_docker() {
  require_command docker "Error: docker is required."
  if ! docker compose version >/dev/null 2>&1; then
    echo "Error: docker compose is required." >&2
    exit 1
  fi
}

check_ffmpeg() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Warning: ffmpeg is missing. Video processing features may be limited."
  fi
}

copy_env_if_missing() {
  local source_file="$1"
  local target_file="$2"
  if [ ! -f "$target_file" ] && [ -f "$source_file" ]; then
    cp "$source_file" "$target_file"
    return 0
  fi
  return 1
}

postgres_reachable() {
  python3 - <<'PY'
import socket
sock = socket.socket()
sock.settimeout(1)
try:
    sock.connect(("127.0.0.1", 5432))
except OSError:
    raise SystemExit(1)
finally:
    sock.close()
PY
}

echo "Checking local tooling..."
check_node_version
check_python_version
check_docker
check_ffmpeg

echo "Installing Node dependencies..."
(cd "$ROOT_DIR" && npm install)
(cd "$ROOT_DIR/backend" && npm install)
(cd "$ROOT_DIR/frontend" && npm install)

echo "Setting up Python environment..."
(cd "$ROOT_DIR/motion-service" && python3 -m venv .venv)
(cd "$ROOT_DIR/motion-service" && source .venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt)

created_env_files=0
copy_env_if_missing "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env" && created_env_files=1 || true
copy_env_if_missing "$ROOT_DIR/motion-service/.env.example" "$ROOT_DIR/motion-service/.env" && created_env_files=1 || true
copy_env_if_missing "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env.local" && created_env_files=1 || true

if [ "$created_env_files" -eq 1 ]; then
  echo "Created .env files — remember to fill in real values for Firebase, GCS, and Gemini"
fi

echo "Training injury predictor model..."
(cd "$ROOT_DIR/motion-service" && source .venv/bin/activate && python -m injury_predictor.train)

if postgres_reachable; then
  echo "PostgreSQL detected on localhost:5432. Running DB setup..."
  (cd "$ROOT_DIR/backend" && npm run db:push && npm run db:seed)
else
  echo "Skipping DB setup — start PostgreSQL first or use docker compose up postgres"
fi

echo "✅ Setup complete!"
echo "Start with Docker:  docker compose up"
echo "Start manually:     open 3 terminals:"
echo "  Terminal 1 (DB):          docker compose up postgres redis"
echo "  Terminal 2 (Backend):     cd backend && npm run dev"
echo "  Terminal 3 (Motion):      cd motion-service && source .venv/bin/activate && uvicorn main:app --reload --port 8000"
echo "  Terminal 4 (Frontend):    cd frontend && npm run dev"
