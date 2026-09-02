#!/usr/bin/env python3
import argparse,json,os,subprocess
from pathlib import Path
from common import ROOT,ensure_file,load_presenter
p=argparse.ArgumentParser();p.add_argument('--presenter',default='main-presenter');p.add_argument('--audio',required=True);p.add_argument('--output',required=True);a=p.parse_args();presenter=load_presenter(a.presenter);image=ensure_file(presenter['referenceImage'],'Reference image');audio=ensure_file(a.audio,'Normalized narration');runner=os.environ.get('INFINITETALK_RUNNER')
if not runner: raise SystemExit("InfiniteTalk is not installed. Set INFINITETALK_RUNNER to an official InfiniteTalk wrapper after moving this project to a supported CUDA machine.")
payload=ROOT/'tmp'/'infinitetalk-input.json';payload.parent.mkdir(parents=True,exist_ok=True);payload.write_text(json.dumps({'prompt':'restrained sports broadcaster, static camera, natural blinking and subtle head movement','cond_video':str(image),'cond_audio':str(audio)},indent=2));Path(a.output).parent.mkdir(parents=True,exist_ok=True);subprocess.run([runner,'--input-json',str(payload),'--output',a.output],check=True)
