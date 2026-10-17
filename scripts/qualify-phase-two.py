"""Run repository tests against synthetic configuration. Never load a user's .env."""
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/zero-cost-phase-2'
OUT.mkdir(parents=True, exist_ok=True)
env = {k: v for k, v in os.environ.items() if k in ('PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER')}
env.update(DATABASE_URL='', PRODUCTION_DATABASE_URL='', NODE_ENV='test',
           AUTH_JWT_SECRET='synthetic-phase-two-secret-at-least-32-characters',
           NEXT_TELEMETRY_DISABLED='1')
files = sorted(str(p.relative_to(ROOT)) for directory in ('src', 'packages', 'scripts', 'tests')
               for p in (ROOT / directory).rglob('*')
               if p.name.endswith(('.test.ts', '.test.tsx', '.test.mjs'))
               and 'tests/front-office/' not in str(p))
(OUT / 'full-unit-files.json').write_text(json.dumps(files, indent=2) + '\n')
with (OUT / 'full-unit-tests.log').open('w') as log:
    result = subprocess.run(['node', '--import', 'tsx', '--test', '--test-concurrency=3', *files],
                            cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
print(json.dumps({'files': len(files), 'exitCode': result.returncode}))
sys.exit(result.returncode)
