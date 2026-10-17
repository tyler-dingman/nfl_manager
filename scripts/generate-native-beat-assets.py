"""Keep the native Beat artwork sourced from the same SVG library as web."""
import json
from pathlib import Path

root = Path('public/assets/the-beat-asset-library')
manifest = json.loads((root / 'manifest.json').read_text())
assets = {asset['id']: (root / asset['path']).read_text() for asset in manifest['assets']}
Path('apps/mobile/assets/beat/library.json').write_text(json.dumps(assets, indent=2) + '\n')
