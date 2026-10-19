#!/usr/bin/env python3
"""Reviewed role schema fingerprints. Fails closed when any migration changes."""
import sqlite3,json,hashlib,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
result={}
for role in ['team','users','shared']:
 db=sqlite3.connect(':memory:')
 for path in sorted((root/'workers/multi-d1/migrations'/role).glob('*.sql')):db.executescript(path.read_text())
 # Match pragma_table_list's exclusion of FTS shadows.
 tables=[{'name':n,'sql':s} for n,s in db.execute("SELECT s.name,s.sql FROM sqlite_schema s JOIN pragma_table_list p ON p.name=s.name WHERE s.type='table' AND p.type IN('table','virtual') AND s.name NOT LIKE 'sqlite_%' AND s.name NOT LIKE '_cf_%' AND s.name NOT LIKE 'd1_%' ORDER BY s.name") if not n.startswith(('app_storage_','app_payload_'))]
 result[role]=hashlib.sha256(json.dumps(tables,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
(root/'packages/storage/multi-d1-schema-hashes.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
