from __future__ import annotations
import json, shutil, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def require_command(name:str)->str:
    found=shutil.which(name)
    if not found: raise RuntimeError(f"Required command '{name}' is not installed.")
    return found
def run(command:list[str])->None:
    subprocess.run(command,check=True)
def load_presenter(presenter_id:str)->dict:
    config=json.loads((ROOT/'config/presenter.json').read_text())
    try: presenter=config['presenters'][presenter_id]
    except KeyError as exc: raise RuntimeError(f"Unknown presenter: {presenter_id}") from exc
    presenter['_id']=presenter_id
    for key in ('referenceImage','defaultNarration','studioBackground','deskForeground'):
        if presenter.get(key): presenter[key]=str((ROOT/'config'/presenter[key]).resolve())
    return presenter
def ensure_file(value:str|None,label:str)->Path:
    if not value: raise RuntimeError(f"{label} is not configured.")
    path=Path(value).expanduser().resolve()
    if not path.is_file(): raise RuntimeError(f"{label} does not exist: {path}")
    return path
