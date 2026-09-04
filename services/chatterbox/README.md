# Local Chatterbox service

This private loopback service loads Chatterbox once at startup and generates the three cached Three & Out WAV segments. It is never called by the browser.

1. Place the approved reference recording at `apps/web/private/tts/final_chiefs_three_and_out.wav`.
2. Use a Chatterbox-compatible Python environment (Python 3.11 is recommended; the repository machine's default Python 3.13 may not have compatible PyTorch wheels).
3. Install and start:

```sh
cd services/chatterbox
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8100
```

The service reads its token, voice version, and reference path from the repository `.env.local`. The reference WAV and generated cache are ignored by Git and must not be placed in `public/`.

On the current development machine, the existing tested Chatterbox environment can be reused instead of creating another large environment:

```sh
cd services/chatterbox
/Users/tylerdingman/ai/chatterbox-test/chatterbox/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8100
```
