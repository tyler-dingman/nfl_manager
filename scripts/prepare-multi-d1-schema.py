#!/usr/bin/env python3
"""Generate isolated local role schemas. Does not execute remote commands or alter single-D1 migrations."""
import sqlite3, pathlib, json
root=pathlib.Path(__file__).resolve().parents[1]
output=root/'workers/multi-d1/migrations'
# Close transaction boundaries deliberately: rewards/trivia/catalog stay with their users;
# complete cross-team event boards stay shared, sources stay with their candidates.
ownership=json.loads((root/'workers/multi-d1/table-ownership.json').read_text())
def role(name):
 if name not in ownership: raise ValueError(f'Unreviewed table ownership: {name}')
 return ownership[name]
db=sqlite3.connect(':memory:')
for path in sorted((root/'workers/content-engine/migrations').glob('*.sql')): db.executescript(path.read_text())
rows=db.execute("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").fetchall()
tables={name:role(name) for kind,name,table,sql in rows if kind=='table' and name.startswith('app_') and name not in {'app_search_config','app_search_content','app_search_data','app_search_docsize','app_search_idx'}}
# These are NOT removed silently. A migration must not be activated until its explicit
# cross-owner reference contract is integrated and tested. Emit a review artifact.
foreign=[]
for name,owner in tables.items():
 for fk in db.execute(f'PRAGMA foreign_key_list("{name}")'):
  target=fk[2]
  if tables.get(target) not in {owner,'local'}:
   foreign.append({'table':name,'column':fk[3],'target':target,'targetColumn':fk[4],'owner':owner,'targetOwner':tables.get(target)})
if set(tables) != set(ownership): raise SystemExit('Reviewed table ownership no longer matches schema')
if foreign: raise SystemExit('Cross-owner foreign keys require review before emitting schemas')
# User-owned editorial override records stay with their actor FK; canonical overrides stay team-owned.
output.mkdir(parents=True,exist_ok=True)
for owner in ['team','users','shared']:
 selected={n for n,r in tables.items() if r in {owner,'local'}}
 # Polling protocol is local to each team shard, with league-wide sources on shared.
 if owner=='users': selected-={'app_storage_poll_batch','app_storage_poll_retry','app_storage_candidate_receipts'}
 if owner=='shared': selected |= {n for n,r in tables.items() if r=='team'} # NFL-wide editorial has its own owner
 statements=[]
 for kind,name,table,sql in rows:
  if table not in selected or name.startswith('sqlite_'): continue
  if kind=='table' and name not in tables: continue
  statements.append(sql+';')
 # Dependencies are deliberately visible in generated SQL until a reviewed contract replaces them.
 (output/owner).mkdir(exist_ok=True)
 (output/owner/'0001_role_bootstrap.sql').write_text('-- LOCAL CANDIDATE SCHEMA. See ownership.json blockers before activation.\n'+'\n'.join(statements)+'\n')
(output/'ownership.json').write_text(json.dumps({'schemaVersion':1,'tables':tables,'crossOwnerForeignKeys':foreign,'schemaForeignKeysClosed':not foreign,'applicationActivationAllowed':False,'legacyTables':'Preserved exclusively in existing single-D1 rollback migrations; not copied into new databases.'},indent=2)+'\n')
print(json.dumps({'tables':len(tables),'crossOwnerForeignKeys':foreign}))
