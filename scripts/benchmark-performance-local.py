"""Disposable localhost PostgreSQL, durable game suite, then lossless auth/user dump restore.
No existing server, environment file, remote database, provider or user data is used.
"""
import hashlib
import json
import os
import pathlib
import shutil
import socket
import subprocess as sp
import tempfile
import time
import sys
from types import SimpleNamespace

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/performance'/os.environ.get('PERFORMANCE_PHASE','before')
OUT.mkdir(parents=True,exist_ok=True)
folder=pathlib.Path(tempfile.mkdtemp(prefix='dd-phase-three-pg-',dir='/private/tmp'))
env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','TMPDIR','SHELL','LANG','USER')}
env.update(AUTH_JWT_SECRET='synthetic-phase-two-secret-at-least-32-characters', NODE_ENV='test',
           PERFORMANCE_PHASE=os.environ.get('PERFORMANCE_PHASE','before'),NEXT_TELEMETRY_DISABLED='1', INFRASTRUCTURE_COST_POLICY='zero-cost', PRODUCTION_DATABASE_URL='',
           PHASE_TWO_SYNTHETIC_DATABASE='true', RUN_FANDUEL_DB_TESTS='true', TSX_TSCONFIG_PATH=str(ROOT/'tsconfig.test.json'))
with socket.socket() as available:
    available.bind(('127.0.0.1',0)); port=available.getsockname()[1]
url=f'postgres://phase_two_test@localhost:{port}/postgres'
env['DATABASE_URL']=url
started=False
legacy_import=ROOT/'reports/zero-cost-phase-4/postgres-d1-import.json'
legacy_import_bytes=legacy_import.read_bytes()
legacy_restore=ROOT/'reports/zero-cost-phase-2/front-office-restore.json'
legacy_restore_bytes=legacy_restore.read_bytes() if legacy_restore.exists() else None
def sql(query,database='postgres'):
    return sp.check_output(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(port),'-U','phase_two_test','-d',database,'-c',query],env=env,text=True)
try:
    sp.run(['initdb','-D',str(folder/'data'),'-U','phase_two_test','-A','trust','--no-locale'],env=env,check=True,stdout=sp.DEVNULL)
    sp.run(['pg_ctl','-D',str(folder/'data'),'-l',str(folder/'server.log'),'-o',f'-h 127.0.0.1 -k {folder} -p {port}','-w','start'],env=env,check=True,stdout=sp.DEVNULL)
    started=True
    sql('CREATE DATABASE phase_two_migrations')
    migration_results=[]
    for migration in sorted((ROOT/'db/migrations').glob('*.sql')):
        run=sp.run(['psql','-X','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(port),'-U','phase_two_test','-d','phase_two_migrations','-f',str(migration)],env=env,stdout=sp.DEVNULL,stderr=sp.PIPE,text=True)
        migration_results.append({'migration':migration.name,'exitCode':run.returncode,'error':run.stderr[-2000:] if run.returncode else None})
        if run.returncode: break
    (OUT/'full-postgres-migrations.json').write_text(json.dumps(migration_results,indent=2)+'\n')
    result=SimpleNamespace(returncode=0)
    if not any(a in sys.argv for a in ['--auth-only','--benchmark-only']):
        with (OUT/'front-office-integration.log').open('w') as log:
            result=sp.run(['node','--expose-gc','--import','tsx','--test','tests/front-office/durable-persistence.test.ts'],cwd=ROOT,env=env,stdout=log,stderr=sp.STDOUT)
    with (OUT/'sportsbook-db-integration.log').open('w') as log:
        transfer_result=sp.run(['node','--import','tsx','--test','src/server/providers/unabated/transfer-db.test.ts'],cwd=ROOT,env=env,stdout=log,stderr=sp.STDOUT)
    if transfer_result.returncode: raise RuntimeError('Critical sportsbook reservation suite failed')
    if not any(a in sys.argv for a in ['--auth-only','--benchmark-only']) and legacy_restore.exists():
        (OUT/'front-office-restore.json').write_bytes(legacy_restore.read_bytes())
    # Rehearse SQL migration replay and backup using only new synthetic auth/user data.
    for _ in range(2):
        for name in ['001_auth_identity.sql','002_user_profiles_and_preferences.sql','003_notifications_and_devices.sql','004_user_content_state.sql','005_security_audit.sql','006_remove_player_follows.sql','007_trivia.sql','008_trivia_gameplay_hardening.sql','009_trivia_buddies.sql','010_get_caught_up.sql','011_move_the_chains_rewards.sql','031_front_office_save_state.sql','032_front_office_events.sql','053_front_office_durable_commands.sql']:
            sp.run(['psql','-X','-q','-v','ON_ERROR_STOP=1',url,'-f',str(ROOT/'db/migrations'/name)],env=env,check=True,stdout=sp.DEVNULL,stderr=sp.DEVNULL)
    with (OUT/'auth-durability-integration.log').open('w') as log:
        auth_result=sp.run(['node','--import','tsx','--test','tests/infrastructure/phase-two.integration.ts'],cwd=ROOT,env=env,stdout=log,stderr=sp.STDOUT)
    if auth_result.returncode: raise RuntimeError('Critical auth durability suite failed')
    sql("INSERT INTO users(id,primary_email,display_name,status) VALUES('00000000-0000-0000-0000-000000000001','synthetic@example.invalid','Synthetic recovery account','ACTIVE')")
    sql("INSERT INTO user_profiles(user_id) VALUES('00000000-0000-0000-0000-000000000001')")
    sql("INSERT INTO user_preferences(user_id) VALUES('00000000-0000-0000-0000-000000000001')")
    # Include large immutable/mutable game JSON and ownership relationships, rather than empty tables only.
    sql("INSERT INTO user_front_office_saves(user_id,save_id,team_abbr,season,selected_path,simulation_state) VALUES('00000000-0000-0000-0000-000000000001','synthetic-save','KC',2026,'full',jsonb_build_object('fixture',repeat('x',1000000)))")
    names=sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
    def checksums(database):
        return {name:hashlib.sha256(sql(f'SELECT row_to_json(t)::text FROM "{name}" t ORDER BY row_to_json(t)::text',database).encode()).hexdigest() for name in names}
    before=checksums('postgres'); begin=time.monotonic(); dump=folder/'checkpoint.sql'
    with dump.open('wb') as f: sp.run(['pg_dump','--no-owner','--no-acl',url],env=env,check=True,stdout=f)
    backup_seconds=time.monotonic()-begin
    sql('CREATE DATABASE phase_two_restore')
    begin=time.monotonic()
    sp.run(['psql','-X','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(port),'-U','phase_two_test','-d','phase_two_restore','-f',str(dump)],env=env,check=True,stdout=sp.DEVNULL,stderr=sp.DEVNULL)
    after=checksums('phase_two_restore')
    if before != after: raise RuntimeError('Restored table checksums differ')
    # One repeatable-read, read-only export retains exact PostgreSQL JSON text.
    names_sql="SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    export_queries=['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']
    for name in names:
        export_queries.append(f"SELECT json_build_object('name','{name}','primaryKey',coalesce((SELECT json_agg(a.attname ORDER BY k.ordinality) FROM pg_index i CROSS JOIN unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE i.indrelid='\"{name}\"'::regclass AND i.indisprimary),'[]'::json),'rows',coalesce((SELECT json_agg(row_to_json(t)::text) FROM \"{name}\" t),'[]'::json))")
    # psql -c displays only the final SQL result: aggregate all tables in that result.
    exported=sql(export_queries[0]+';SELECT json_agg(entry) FROM ('+' UNION ALL '.join(q+' AS entry' for q in export_queries[1:])+') snapshot')
    source={'schema':1,'mode':'SYNTHETIC_REPEATABLE_READ','tables':json.loads(exported)}
    (OUT/'export-summary.json').write_text(json.dumps({'names':names,'tables':[{'name':t.get('name'),'rows':len(t.get('rows',[]))} for t in source['tables']]},indent=2))
    export_file=folder/'source.json'; export_file.write_text(json.dumps(source))
    with (OUT/'postgres-d1-import.log').open('w') as log:
        imported=sp.run(['node','--import','tsx','scripts/application-import-phase-four.ts',str(export_file)],cwd=ROOT/'workers/content-engine',env=env,stdout=log,stderr=sp.STDOUT)
    (OUT/'postgres-d1-import.json').write_bytes(legacy_import.read_bytes())
    if imported.returncode: raise RuntimeError('Critical D1 import rehearsal failed')
    if before != checksums('postgres'): raise RuntimeError('D1 import modified source PostgreSQL')
    metrics={'scope':'MEASURED synthetic PostgreSQL auth/user/game metadata tables only. Not full product or cross-store production backup.',
             'migrationReplayCount':2,'tablesVerified':len(names),'dumpBytes':dump.stat().st_size,
             'backupSeconds':backup_seconds,'restoreAndVerifySeconds':time.monotonic()-begin,
             'tableChecksums':before,'frontOfficeExitCode':result.returncode,
             'productionRpo':'UNVERIFIED','productionRto':'UNVERIFIED'}
    (OUT/'postgres-restore.json').write_text(json.dumps(metrics,indent=2)+'\n')
    print(json.dumps({k:v for k,v in metrics.items() if k!='tableChecksums'}))
    if '--benchmark-only' in sys.argv:
        sp.run(['node','scripts/benchmark-site-performance.mjs'],cwd=ROOT,env=env,check=True)
    if '--browser' in sys.argv:
        sp.run(['node','scripts/validate-completion-browser.mjs'],cwd=ROOT,env=env,check=True)
    if result.returncode: raise RuntimeError('Critical Front Office suite failed')
finally:
    legacy_import.write_bytes(legacy_import_bytes)
    if legacy_restore_bytes is not None: legacy_restore.write_bytes(legacy_restore_bytes)
    if started:sp.run(['pg_ctl','-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,check=True,stdout=sp.DEVNULL)
    shutil.rmtree(folder)
