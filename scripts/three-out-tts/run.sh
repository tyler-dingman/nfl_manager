#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

if [ -n "${THREE_OUT_TTS_PYTHON:-}" ]; then
  PYTHON=$THREE_OUT_TTS_PYTHON
elif [ -x "$ROOT/services/chatterbox/.venv/bin/python" ]; then
  PYTHON="$ROOT/services/chatterbox/.venv/bin/python"
elif [ -x "/Users/tylerdingman/ai/chatterbox-test/chatterbox/.venv/bin/python" ]; then
  PYTHON="/Users/tylerdingman/ai/chatterbox-test/chatterbox/.venv/bin/python"
else
  echo "No compatible Chatterbox Python 3.11 environment was found." >&2
  echo "Set THREE_OUT_TTS_PYTHON to its Python executable and retry." >&2
  exit 1
fi

exec "$PYTHON" "$ROOT/scripts/three-out-tts/generate.py" "$@"
