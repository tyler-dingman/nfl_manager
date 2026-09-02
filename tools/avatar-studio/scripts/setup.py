#!/usr/bin/env python3
import platform,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1];free=shutil.disk_usage(root).free/(1024**3)
print(f"Free disk: {free:.1f} GiB")
if free<10:raise SystemExit("Setup stopped: free at least 10 GiB before installing ffmpeg or a lightweight avatar engine.")
if platform.system()=='Darwin':
    print("Apple Silicon detected. Official InfiniteTalk is not supported by its CUDA 12.1/xformers/flash-attn installation path.")
    print("Recommended fallback after freeing disk: isolated Python 3.10 environment + SadTalker CPU/MPS evaluation, then Robust Video Matting.")
else:print("Review README hardware requirements before setting INFINITETALK_RUNNER.")
print("Install ffmpeg separately, then run: npm run avatar:audit")
