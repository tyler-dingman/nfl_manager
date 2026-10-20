import json,collections,statistics,pathlib
out=pathlib.Path('reports/firebase-cpu-root-cause');cold=collections.Counter();warm=collections.Counter();coldrows=[];warmrows=[]
for prefix in ['', 'repeat-2/', 'repeat-3/']:
 p=json.loads((out/(prefix+'mapped-profile-summary.json')).read_text());wall=json.loads((out/(prefix+'workerd-profile-summary.json')).read_text())
 for i,r in enumerate(p['rows']):
  if i==0:
   cold.update({k:v for k,v in r['categories'].items() if k!='idle'});coldrows.append({'run':prefix or 'initial','nonIdleSamples':r['nonIdleSamples'],'elapsedMs':wall['rows'][i]['wallMs'],'categories':{k:v for k,v in r['categories'].items() if k!='idle'}})
  elif 'native' not in r['operation']:
   warm.update({k:v for k,v in r['categories'].items() if k!='idle'});warmrows.append(r['nonIdleSamples'])
r={'source':'Actual local workerd statistical samples of byte-identical production API; sample counts, never hosted CPU milliseconds. Main API isolate only; native helper threads and D1 SQL engine excluded. Repeated cold-isolate first-use work compared to warm path, not an exclusive hosted attribution.','coldRuns':coldrows,'coldNonIdleSamples':sum(cold.values()),'coldCategorySamples':dict(cold),'coldCategoryPercent':{k:round(100*v/sum(cold.values()),2) for k,v in cold.items()},'warmWebRequests':len(warmrows),'warmNonIdleSamples':sum(warm.values()),'warmCategorySamples':dict(warm),'warmCategoryPercent':{k:round(100*v/sum(warm.values()),2) for k,v in warm.items()},'coldNonIdleMedianSamples':statistics.median(x['nonIdleSamples'] for x in coldrows),'warmNonIdleMedianSamples':statistics.median(warmrows)}
(out/'aggregate-profile.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
