#!/usr/bin/env python3
import platform,shutil,subprocess
from pathlib import Path
def value(command:list[str])->str:
    try:return subprocess.check_output(command,text=True,stderr=subprocess.DEVNULL).strip()
    except Exception:return 'unavailable'
free=shutil.disk_usage(Path(__file__).resolve()).free/(1024**3)
print(f"OS: {platform.platform()}")
print(f"Architecture: {platform.machine()}")
print(f"Python: {platform.python_version()}")
print(f"ffmpeg: {shutil.which('ffmpeg') or 'not installed'}")
print(f"NVIDIA CUDA: {'available' if shutil.which('nvidia-smi') else 'not available'}")
candidates=[Path.home()/'ComfyUI',Path.home()/'Documents/ComfyUI',Path('/Applications/ComfyUI.app')]
infinite=[Path.home()/'InfiniteTalk',Path.home()/'Documents/InfiniteTalk',Path(__file__).resolve().parents[1]/'vendor/InfiniteTalk']
print(f"ComfyUI: {'installed' if any(p.exists() for p in candidates) else 'not detected'}")
print(f"InfiniteTalk: {'installed' if any((p/'generate_infinitetalk.py').exists() for p in infinite) else 'not detected'}")
print(f"Free disk: {free:.1f} GiB")
if platform.system()=='Darwin': print("Apple hardware: "+value(['system_profiler','SPHardwareDataType','-detailLevel','mini']).split('\n')[0])
if free<10: print("BLOCKED: At least 10 GiB free is required even for the lightweight fallback; official InfiniteTalk needs substantially more.")
if not shutil.which('nvidia-smi'): print("BLOCKED: Official InfiniteTalk requires a CUDA/PyTorch stack and is not supported by this Apple-Silicon setup.")
