#!/usr/bin/env python3
"""Generate one short, isolated Three & Out Chatterbox proof-of-concept."""

from __future__ import annotations

import argparse
import fcntl
import gc
import json
import os
import random
import resource
import sys
import time
import wave
from pathlib import Path

# Match the cache workaround used by the previously successful local service.
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp/down-distance-chatterbox-numba")

import numpy as np
import psutil
import soundfile as sf
import torch

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REFERENCE = ROOT / "apps/web/private/tts/final_chiefs_three_and_out.wav"
OUTPUT_DIR = ROOT / "tmp/three-out"
LOCK_PATH = OUTPUT_DIR / ".generation.lock"

SCRIPTS = {
    "script": (
        "The Chiefs have three things worth watching today. The offensive line is "
        "starting to take shape, the defense got some good news at practice, and "
        "there's one roster move that could matter Sunday."
    ),
    "names": (
        "Patrick Mahomes, Travis Kelce, Xavier Worthy, and Chris Jones were all part "
        "of the conversation at practice today."
    ),
}

PHASE_TWO_SCRIPTS = (
    (
        "1st Down",
        "First down. Kansas City's offensive line is beginning to take shape, giving "
        "the Chiefs a clearer picture of the protection plan they can carry into Sunday. "
        "That continuity will be worth tracking through the final practice."
    ),
    (
        "2nd Down",
        "Second down. The defense received encouraging news at practice today, with key "
        "contributors moving in the right direction as game day gets closer. The next "
        "injury report should clarify who is ready for a full workload."
    ),
    (
        "3rd Down",
        "Third down. One roster move deserves attention because it could affect depth, "
        "special teams, and the options Kansas City has available this weekend. Watch how "
        "the coaching staff uses that flexibility when the active roster is announced."
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", choices=(*SCRIPTS, "phase2"), default="script")
    parser.add_argument("--reference", default=os.getenv("VOICE_REFERENCE_PATH"))
    parser.add_argument("--model", choices=("original", "turbo"), default=os.getenv("THREE_OUT_TTS_MODEL", "original"))
    parser.add_argument("--device", choices=("auto", "mps", "cpu"), default=os.getenv("THREE_OUT_TTS_DEVICE", "auto"))
    parser.add_argument("--exaggeration", type=float, default=float(os.getenv("THREE_OUT_TTS_EXAGGERATION", "0.5")))
    parser.add_argument("--cfg-weight", type=float, default=float(os.getenv("THREE_OUT_TTS_CFG_WEIGHT", "0.5")))
    parser.add_argument("--seed", type=int, default=int(os.getenv("THREE_OUT_TTS_SEED", "42")))
    parser.add_argument("--min-free-gb", type=float, default=float(os.getenv("THREE_OUT_TTS_MIN_FREE_GB", "4")))
    return parser.parse_args()


def resolve_reference(value: str | None) -> Path:
    reference = Path(value).expanduser() if value else DEFAULT_REFERENCE
    if not reference.is_absolute():
        reference = ROOT / reference
    reference = reference.resolve()
    if not reference.is_file() or not os.access(reference, os.R_OK):
        raise RuntimeError(f"Voice reference is missing or unreadable: {reference}")
    if reference.suffix.lower() != ".wav":
        raise RuntimeError("VOICE_REFERENCE_PATH must point to a WAV file for this proof-of-concept.")
    try:
        with wave.open(str(reference), "rb") as audio:
            if audio.getnframes() <= 0 or audio.getframerate() <= 0:
                raise RuntimeError("Voice reference WAV contains no readable audio frames.")
    except (wave.Error, EOFError) as error:
        raise RuntimeError(f"Voice reference is not a supported PCM WAV: {reference}") from error
    return reference


def choose_device(requested: str) -> str:
    mps_available = bool(torch.backends.mps.is_built() and torch.backends.mps.is_available())
    if requested == "mps" and not mps_available:
        raise RuntimeError("MPS was requested but is unavailable. No automatic retry will be attempted.")
    if requested == "auto":
        return "mps" if mps_available else "cpu"
    return requested


def next_output(test: str) -> Path:
    if test == "names":
        base = "three-out-test-names"
    elif test == "phase2":
        base = "three-out-phase-2"
    else:
        base = "three-out-test-001"
    candidate = OUTPUT_DIR / f"{base}.wav"
    index = 2
    while candidate.exists():
        candidate = OUTPUT_DIR / f"{base}-{index:03d}.wav"
        index += 1
    return candidate


def phase_two_paths(joined_output: Path) -> list[Path]:
    stem = joined_output.stem
    return [joined_output.with_name(f"{stem}-down-{index}.wav") for index in range(1, 4)]


def memory_snapshot() -> dict[str, float]:
    memory = psutil.virtual_memory()
    process = psutil.Process()
    return {
        "system_available_gb": round(memory.available / (1024**3), 2),
        "process_rss_gb": round(process.memory_info().rss / (1024**3), 2),
    }


def peak_rss_gb() -> float:
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS reports bytes; Linux reports KiB.
    return round(value / (1024**3) if sys.platform == "darwin" else value / (1024**2), 2)


def clear_accelerator_caches() -> None:
    gc.collect()
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def main() -> int:
    args = parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model = None
    waveform = None

    with LOCK_PATH.open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("ERROR: another Three & Out generation is already running.", file=sys.stderr)
            return 2

        try:
            reference = resolve_reference(args.reference)
            device = choose_device(args.device)
            before = memory_snapshot()
            if before["system_available_gb"] < args.min_free_gb:
                raise RuntimeError(
                    f"Memory safety stop: {before['system_available_gb']} GB available; "
                    f"at least {args.min_free_gb} GB is required. Close other applications and retry once."
                )

            random.seed(args.seed)
            np.random.seed(args.seed)
            torch.manual_seed(args.seed)
            output = next_output(args.test)
            print(json.dumps({
                "stage": "preflight",
                "model": f"chatterbox-{args.model}",
                "device": device,
                "reference": str(reference),
                "output": str(output),
                "memory": before,
            }))

            load_started = time.perf_counter()
            if args.model == "turbo":
                from chatterbox.tts_turbo import ChatterboxTurboTTS
                model = ChatterboxTurboTTS.from_pretrained(device=device)
            else:
                from chatterbox.tts import ChatterboxTTS
                model = ChatterboxTTS.from_pretrained(device=device)
            load_seconds = time.perf_counter() - load_started

            generation_started = time.perf_counter()
            chunk_results = []
            if args.test == "phase2":
                model.prepare_conditionals(str(reference), exaggeration=args.exaggeration)
                chunks = []
                chunk_paths = phase_two_paths(output)
                for index, ((label, text), chunk_path) in enumerate(
                    zip(PHASE_TWO_SCRIPTS, chunk_paths, strict=True), start=1
                ):
                    chunk_started = time.perf_counter()
                    with torch.inference_mode():
                        waveform = model.generate(
                            text,
                            exaggeration=args.exaggeration,
                            cfg_weight=args.cfg_weight,
                        )
                    samples = waveform.detach().cpu().float().squeeze().numpy()
                    sf.write(chunk_path, samples, model.sr, format="WAV")
                    chunks.append(samples)
                    chunk_results.append({
                        "label": label,
                        "duration_seconds": round(len(samples) / model.sr, 2),
                        "generation_seconds": round(time.perf_counter() - chunk_started, 2),
                        "output": str(chunk_path),
                    })
                    waveform = None
                    gc.collect()
                    available_gb = memory_snapshot()["system_available_gb"]
                    if index < len(PHASE_TWO_SCRIPTS) and available_gb < 1.5:
                        raise RuntimeError(
                            f"Memory safety stop after {label}: only {available_gb} GB available."
                        )
                silence = np.zeros(round(model.sr * 0.35), dtype=np.float32)
                samples = np.concatenate(
                    [part for chunk in chunks[:-1] for part in (chunk, silence)] + [chunks[-1]]
                )
            else:
                with torch.inference_mode():
                    waveform = model.generate(
                        SCRIPTS[args.test],
                        audio_prompt_path=str(reference),
                        exaggeration=args.exaggeration,
                        cfg_weight=args.cfg_weight,
                    )
                samples = waveform.detach().cpu().float().squeeze().numpy()
            generation_seconds = time.perf_counter() - generation_started
            sf.write(output, samples, model.sr, format="WAV")
            duration_seconds = len(samples) / model.sr
            print(json.dumps({
                "stage": "complete",
                "model": f"chatterbox-{args.model}",
                "device": device,
                "seed": args.seed,
                "exaggeration": args.exaggeration,
                "cfg_weight": args.cfg_weight,
                "model_load_seconds": round(load_seconds, 2),
                "generation_seconds": round(generation_seconds, 2),
                "audio_duration_seconds": round(duration_seconds, 2),
                "peak_process_rss_gb": peak_rss_gb(),
                "memory_after_generation": memory_snapshot(),
                "output": str(output),
                "chunks": chunk_results,
            }))
            return 0
        except Exception as error:
            print(json.dumps({"stage": "stopped", "error": str(error)}), file=sys.stderr)
            return 1
        finally:
            waveform = None
            model = None
            clear_accelerator_caches()


if __name__ == "__main__":
    raise SystemExit(main())
