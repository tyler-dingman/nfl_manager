import json,xml.etree.ElementTree as ET,re
from pathlib import Path
root=Path('public/assets/the-beat-asset-library');m=json.loads((root/'manifest.json').read_text())
def jsx(e):
 tag=e.tag.split('}')[-1]
 assert tag not in ['text','image','script','foreignObject']
 attrs=[]
 for k,v in e.attrib.items():
  if k=='xmlns':continue
  assert k!='id' and not k.startswith('on')
  k=k if k.startswith('aria-') else re.sub(r'-([a-z])',lambda x:x[1].upper(),k)
  attrs.append(f'{k}={json.dumps(v)}')
 return '<'+tag+(' '+' '.join(attrs) if attrs else '')+'>'+''.join(jsx(c) for c in e)+'</'+tag+'>'
s='// Generated from trusted, ID-free library SVGs by scripts/generate-beat-assets.py.\nimport type { ReactNode } from "react";\nexport const beatAssets = {\n'
for a in m['assets']:s+=json.dumps(a['id'])+': ('+jsx(ET.parse(root/a['path']).getroot())+'),\n'
s+='} satisfies Record<string, ReactNode>;\n'
Path('src/components/beat/beat-assets.tsx').write_text(s)
