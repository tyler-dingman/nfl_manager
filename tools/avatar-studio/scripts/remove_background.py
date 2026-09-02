#!/usr/bin/env python3
import argparse,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args();runner=os.environ.get('AVATAR_MATTING_RUNNER')
if not runner: raise SystemExit("Video matting is not installed. Set AVATAR_MATTING_RUNNER to a Robust Video Matting wrapper that emits ProRes 4444 or alpha WebM.")
Path(a.output).parent.mkdir(parents=True,exist_ok=True);subprocess.run([runner,'--input',a.input,'--output',a.output],check=True)
