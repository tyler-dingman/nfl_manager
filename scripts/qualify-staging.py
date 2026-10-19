"""Complete standalone application suite, with deterministic Next module adapters."""
import json, os, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'reports/staging-readiness';out.mkdir(parents=True,exist_ok=True)
env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','TMPDIR','SHELL','LANG','USER')}
env.update(NODE_ENV='test',
 AUTH_JWT_SECRET='synthetic-phase-three-secret-at-least-32-characters',NEXT_TELEMETRY_DISABLED='1',
 TSX_TSCONFIG_PATH=str(root/'tsconfig.test.json'))
files=sorted(str(p.relative_to(root)) for base in ('src','packages','scripts','tests') for p in (root/base).rglob('*')
 if p.name.endswith(('.test.ts','.test.tsx','.test.mjs')) and 'tests/front-office/' not in str(p))
(out/'unit-files.json').write_text(json.dumps(files,indent=2)+'\n')
with (out/'unit-tests.log').open('w') as log:
 result=subprocess.run(['node','--require','./tests/node-environment.cjs','--import','tsx','--test','--test-concurrency=3',*files],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
print(json.dumps({'files':len(files),'exitCode':result.returncode}));sys.exit(result.returncode)
