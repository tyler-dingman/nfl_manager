#!/usr/bin/env python3
import argparse
from pathlib import Path
from common import ensure_file,load_presenter,require_command,run
p=argparse.ArgumentParser();p.add_argument('--presenter',default='main-presenter');p.add_argument('--avatar',required=True);p.add_argument('--studio');p.add_argument('--desk');p.add_argument('--output',required=True);a=p.parse_args();cfg=load_presenter(a.presenter);ffmpeg=require_command('ffmpeg');avatar=ensure_file(a.avatar,'Transparent avatar');studio=ensure_file(a.studio or cfg['studioBackground'],'Studio background');desk=Path(a.desk or cfg.get('deskForeground') or '') if (a.desk or cfg.get('deskForeground')) else None;placement=cfg['studio'];scale=placement['scale'];x=placement['x'];y=placement['y'];Path(a.output).parent.mkdir(parents=True,exist_ok=True)
inputs=['-loop','1','-i',str(studio),'-i',str(avatar)];filters=[f'[0:v]scale=1920:1080,setsar=1[bg]',f'[1:v]scale=iw*{scale}:ih*{scale},format=rgba,colorchannelmixer=aa=1[p]',f'[bg][p]overlay=x={x}-overlay_w/2:y={y}-overlay_h:format=auto[mid]'];final='[mid]'
if desk and desk.is_file():inputs+=['-loop','1','-i',str(desk)];filters+=['[2:v]scale=1920:1080,format=rgba[desk]','[mid][desk]overlay=0:0:format=auto[final]'];final='[final]'
run([ffmpeg,'-y',*inputs,'-filter_complex',';'.join(filters),'-map',final,'-map','1:a?','-r','30','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-shortest',a.output])
