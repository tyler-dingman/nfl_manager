#!/usr/bin/env python3
import argparse,shutil,subprocess,time
from pathlib import Path
from common import ROOT,ensure_file,load_presenter
p=argparse.ArgumentParser();p.add_argument('--presenter',default='main-presenter');p.add_argument('--audio');p.add_argument('--studio');a=p.parse_args();cfg=load_presenter(a.presenter);free=shutil.disk_usage(ROOT).free/(1024**3)
if free<10:raise SystemExit(f"Hardware gate: only {free:.1f} GiB free. Free at least 10 GiB before installing a lightweight engine; official InfiniteTalk needs much more.")
if not shutil.which('ffmpeg'):raise SystemExit("Hardware gate: ffmpeg is not installed. Run the documented setup only after freeing disk space.")
audio=ensure_file(a.audio or cfg['defaultNarration'],'Narration');tmp=ROOT/'tmp';raw=ROOT/'output/raw-avatar/avatar.mp4';alpha=ROOT/'output/transparent-avatar/presenter-alpha.mov';final=ROOT/'output/composite/avatar-studio-test.mp4';started=time.monotonic()
steps=[['python3',str(ROOT/'scripts/normalize_audio.py'),'--input',str(audio),'--output',str(tmp/'narration.wav'),'--seconds',str(cfg['avatar']['maxTestSeconds'])],['python3',str(ROOT/'scripts/generate_avatar.py'),'--presenter',a.presenter,'--audio',str(tmp/'narration.wav'),'--output',str(raw)],['python3',str(ROOT/'scripts/remove_background.py'),'--input',str(raw),'--output',str(alpha)],['python3',str(ROOT/'scripts/composite_studio.py'),'--presenter',a.presenter,'--avatar',str(alpha),'--output',str(final)]]
if a.studio:steps[-1]+=['--studio',a.studio]
for step in steps:subprocess.run(step,check=True)
print(f"Rendered {final} in {time.monotonic()-started:.1f}s")
