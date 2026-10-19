"""Read-only physical table/index accounting for explicitly local synthetic D1 only."""
import sys,sqlite3,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=Path(sys.argv[1]).resolve()
assert p.is_relative_to((root/'.staging').resolve()),'Only this worktree local .staging files are accepted'
assert p.suffix=='.sqlite'
c=sqlite3.connect('file:'+str(p)+'?mode=ro',uri=True)
rows=json.loads(subprocess.check_output(['/usr/bin/sqlite3','-readonly','-json',str(p),'SELECT name, SUM(pgsize) bytes, COUNT(*) pages FROM dbstat GROUP BY name ORDER BY bytes DESC'],text=True))
catalog={name:kind for name,kind in c.execute('SELECT name,type FROM sqlite_master')}
result={'scope':'MEASURED read-only local synthetic SQLite pages; not populated production growth','totalBytes':c.execute('PRAGMA page_count').fetchone()[0]*c.execute('PRAGMA page_size').fetchone()[0],'integrity':c.execute('PRAGMA integrity_check').fetchone()[0],'objects':[{'name':name,'type':catalog.get(name,'internal'),'bytes':size,'pages':pages} for name,size,pages in [(r['name'],r['bytes'],r['pages']) for r in rows]]}
(root/'reports/final-staging/local-storage-accounting.json').write_text(json.dumps(result,indent=2)+'\n')
print('SQLite bytes',result['totalBytes'],'objects',len(rows))
