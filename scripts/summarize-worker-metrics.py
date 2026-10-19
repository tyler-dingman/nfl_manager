"""Summarize local structured metrics; never infer Cloudflare CPU or billing."""
import sys,json,math,statistics
from pathlib import Path
rows=[]
for line in Path(sys.argv[1]).read_text().splitlines():
 marker=line.find('{"metric":"application_headers"')
 if marker<0:continue
 try:entry=json.JSONDecoder().raw_decode(line[marker:])[0]
 except ValueError:continue
 rows.append(entry)
result={'scope':'MEASURED local workerd request counters and wall time, not hosted CPU or complete account billing','hostedCpuMs':None,'routes':[]}
for route in sorted(set(str(r.get('route','other')) for r in rows)):
 group=[r for r in rows if r.get('route','other')==route]
 durations=sorted(r['wallMs'] for r in group if isinstance(r.get('wallMs'),(int,float)))
 result['routes'].append({'routeFamily':route,'requests':len(group),'errors':sum(int(r.get('status',0))>=500 for r in group),'statusCounts':{str(code):sum(r.get('status')==code for r in group) for code in sorted(set(r.get('status',0) for r in group))},'wallP50Ms':statistics.median(durations) if durations else None,'wallP95Ms':durations[math.ceil(len(durations)*.95)-1] if durations else None,**{key:sum(r.get(key,0) for r in group) for key in ['d1Calls','statements','rowsRead','rowsWritten','r2Reads','r2Writes']}})
Path(sys.argv[2]).write_text(json.dumps(result,indent=2)+'\n')
print('Metrics summarized:',len(rows),'requests')
