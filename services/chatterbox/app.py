import io
import os
from pathlib import Path

os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp/down-distance-chatterbox-numba")

import torch
import soundfile as sf
from chatterbox.tts import ChatterboxTTS
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
for line in (ROOT / ".env.local").read_text().splitlines():
    if line and not line.lstrip().startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
configured_voice = Path(os.getenv("CHATTERBOX_REFERENCE_VOICE", "apps/web/private/tts/final_chiefs_three_and_out.wav"))
REFERENCE_VOICE = configured_voice if configured_voice.is_absolute() else ROOT / configured_voice
SERVICE_TOKEN = os.getenv("CHATTERBOX_SERVICE_TOKEN", "")
VOICE_VERSION = os.getenv("CHATTERBOX_VOICE_VERSION", "chiefs-three-out-v2")
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

app = FastAPI(title="Down & Distance Chatterbox", docs_url=None, redoc_url=None)
model: ChatterboxTTS | None = None


class GenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    voice: str


@app.on_event("startup")
def load_model() -> None:
    global model
    if not REFERENCE_VOICE.is_file():
        raise RuntimeError(f"Reference voice not found: {REFERENCE_VOICE}")
    if DEVICE == "mps":
        model = ChatterboxTTS.from_pretrained(device="cpu")
        for name in ("t3", "s3gen", "ve"):
            component = getattr(model, name, None)
            if component is not None:
                setattr(model, name, component.to(DEVICE))
        model.device = DEVICE
    else:
        model = ChatterboxTTS.from_pretrained(device=DEVICE)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ready" if model else "loading", "device": DEVICE}


@app.post("/generate")
def generate(payload: GenerateRequest, x_chatterbox_token: str | None = Header(default=None)) -> Response:
    if not SERVICE_TOKEN or x_chatterbox_token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if payload.voice != VOICE_VERSION:
        raise HTTPException(status_code=400, detail="Unknown voice")
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not ready")
    waveform = model.generate(
        payload.text,
        audio_prompt_path=str(REFERENCE_VOICE),
        exaggeration=0.5,
        temperature=0.5,
        cfg_weight=0.5,
    )
    output = io.BytesIO()
    samples = waveform.detach().cpu().float().squeeze(0).numpy()
    sf.write(output, samples, model.sr, format="WAV")
    return Response(output.getvalue(), media_type="audio/wav")
