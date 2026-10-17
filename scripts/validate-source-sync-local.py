"""Create a disposable PostgreSQL instance. No TCP, app DB config, or production access."""
import os
import pathlib
import shutil
import subprocess as sp
import tempfile

root=pathlib.Path(__file__).resolve().parents[1]
folder=pathlib.Path(tempfile.mkdtemp(prefix='dd-source-pg-',dir='/private/tmp'))
env={k:v for k,v in os.environ.items() if not k.startswith('PG') and k!='DATABASE_URL'}
env['SOURCE_TEST_PG_SOCKET']=str(folder)
started=False
try:
    sp.run(['initdb','-D',str(folder/'data'),'-U','source_test','-A','trust','--no-locale'],env=env,check=True,stdout=sp.DEVNULL)
    sp.run(['pg_ctl','-D',str(folder/'data'),'-l',str(folder/'postgres.log'),'-o',f"-h '' -k {folder} -p 6546",'-w','start'],env=env,check=True,stdout=sp.DEVNULL)
    started=True
    sp.run(['node','--import','tsx','scripts/validate-source-sync.ts'],cwd=root,env=env,check=True)
finally:
    if started:sp.run(['pg_ctl','-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,check=True,stdout=sp.DEVNULL)
    shutil.rmtree(folder)
