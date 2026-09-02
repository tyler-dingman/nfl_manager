#!/usr/bin/env python3
import argparse
from pathlib import Path
from common import require_command,run
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--seconds',type=float,default=12);a=p.parse_args();ffmpeg=require_command('ffmpeg');Path(a.output).parent.mkdir(parents=True,exist_ok=True)
run([ffmpeg,'-y','-i',a.input,'-t',str(a.seconds),'-ac','1','-ar','16000','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','pcm_s16le',a.output])
