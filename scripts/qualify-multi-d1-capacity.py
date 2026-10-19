"""Reproducible qualification, no daily savings credited without observed rates."""
import json,math,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/multi-d1-qualification';OUT.mkdir(exist_ok=True)
m=runpy.run_path(str(ROOT/'scripts/project-multi-d1.py'),run_name='capacity_import')
scenario=m['ns']['scenario'];U=m['U'];S=m['S'];ops=m['ops'];groups=m['GROUPS']
def allocation(comp,shares=None):
 fixed=comp['fixedSchemaAndRegistry'];shares=shares or [1/8]*8
 user=sum(v for k,v in comp.items() if k in U)
 shared=sum(v for k,v in comp.items() if k in S)
 team=sum(v for k,v in comp.items() if k not in U|S|{'fixedSchemaAndRegistry'})
 return {**{f'TEAM_{i+1}':math.ceil((team*shares[i]+fixed)*1.2) for i in range(8)},'USER':math.ceil((user+fixed)*1.2),'SHARED':math.ceil((shared+fixed)*1.2)}
# Deliberately synthetic seasonal skew: four teams have 3x ordinary volume.
# Does not identify any real team as high volume without measurement.
weights={t:(3 if t in groups[0] else 1) for g in groups for t in g}
flat=sum(groups,[])
uneven=[];offset=0
for size in [2,3,4,4,4,5,5,5]:
 uneven.append(flat[offset:offset+size]);offset+=size
bins=[[] for _ in range(8)]
for t in sorted(flat,key=lambda t:(-weights[t],t)):
 i=min(range(8),key=lambda i:(sum(weights[t] for t in bins[i]),len(bins[i]),i));bins[i].append(t)
dedicated=[[t] for t in groups[0]]+[flat[4+i::4] for i in range(4)]
strategies={}
for name,gs in [('A_equal_four',groups),('B_uneven_team_counts',uneven),('C_capacity_aware_static',bins),('D_dedicated_high_volume',dedicated)]:
 assert len(gs)==8 and sorted(sum(gs,[]))==sorted(flat)
 strategies[name]={'teams':gs,'syntheticWeights':weights,'shares':[sum(weights[t] for t in g)/sum(weights.values()) for g in gs]}
rows=[]
for dau in [0,25,50,100]:
 for days in [30,90,180,365,730]:
  base=scenario(dau,days,0)[0];worst=scenario(dau,days,1)[0]
  db=allocation(base);wdb=allocation(worst)
  # Counterfactual only: zero older odds/score payloads, even for saved bets.
  # This is more generous than safe extraction and still doesn't solve editorial retention.
  odds_keys=['historicalOdds','labScoresAndTrending']
  no_old_odds=dict(worst)
  for k in odds_keys:no_old_odds[k]=scenario(0,min(days,30),0)[0][k]
  extracted=allocation(no_old_odds)
  op=ops(dau)
  rows.append({'dau':dau,'days':days,'baseDatabaseBytes':db,'baseAccountBytes':sum(db.values()),'worstReferenceDatabaseBytes':wdb,'worstReferenceAccountBytes':sum(wdb.values()),'componentsBase':base,'componentsWorstReferences':worst,'worstMinusBaseComponentsBytes':{k:worst[k]-base[k] for k in base},'optimisticSavedOddsExtractionNotImplementedDatabaseBytes':extracted,'operationsBefore':op,'operationsAfterQualifiedCredit':op,'creditedDailyWriteSaving':0,'indexAmplificationIncluded':'inherited planning sensitivity, not a new physical measurement','maximumCompleteHttpQueriesBaseline':38,'multiD1QueriesMeasured':None,'workerCpuMs':None,'ownerOfflineBackupsBytes':2*sum(sum(allocation(scenario(dau,d,0)[0]).values()) for d in range(1,days+1)),'seasonalStrategies':{name:{'baseDatabaseBytes':allocation(base,x['shares']),'worstDatabaseBytes':allocation(worst,x['shares'])} for name,x in strategies.items()},'feasibility':'FAIL'})
http=[]
for line in (ROOT/'reports/approved-retention/browser/local-server.log').read_text().splitlines():
 pos=line.find('{"metric":"application_headers"')
 if pos>=0:
  try:http.append(json.loads(line[pos:]))
  except json.JSONDecodeError:pass
route_stats={}
for x in http:
 key=x.get('method','')+' '+x.get('routePattern','unknown')
 a=route_stats.setdefault(key,{'samples':0,'maxRowsWritten':0,'maxStatements':0,'sumRowsWritten':0})
 a['samples']+=1;a['maxRowsWritten']=max(a['maxRowsWritten'],x.get('rowsWritten',0));a['maxStatements']=max(a['maxStatements'],x.get('statements',0));a['sumRowsWritten']+=x.get('rowsWritten',0)
result={'feasibility':'FAIL','assumptions':'Approved retention synthetic sizes; 20% reserve; 10 schema copies. Zero credit for unknown duplicate frequency. No extraction/delete integration. New coordination overhead omitted, not free. Operations are inherited estimates; fixed 67711 write intercept is not attributed measured ingestion. No actual seasonal distribution measured.','strategies':strategies,'rows':rows,'baselineHttpInstrumentation':{'samples':len(http),'routes':route_stats,'warning':'Synthetic browser mix, cannot extrapolate sum to real daily workload; baseline only, not remeasured after adapter edits.'}}
if (OUT/'queries.json').exists():
 result['currentCompleteHttp']=json.loads((OUT/'queries.json').read_text())
if (OUT/'write-samples.json').exists():
 result['currentAdapterInstrumentation']=json.loads((OUT/'write-samples.json').read_text())
 result['maximumProfiledAdapterStatements']=max(x['statements'] for x in result['currentAdapterInstrumentation']['samples'])
(OUT/'capacity.json').write_text(json.dumps(result,indent=2)+'\n')
assert len(rows)==20
for r in rows:
 assert len(r['baseDatabaseBytes'])==10
 assert r['baseAccountBytes']==sum(r['baseDatabaseBytes'].values())
 assert all(r['worstReferenceDatabaseBytes'][k]>=v for k,v in r['baseDatabaseBytes'].items())
 assert r['operationsBefore']==r['operationsAfterQualifiedCredit']
 assert r['feasibility']=='FAIL'
print('20 scenarios and four mapping strategies validated; feasibility FAIL')
r=next(r for r in rows if r['dau']==50 and r['days']==365)
print(json.dumps({'worstDelta':r['worstMinusBaseComponentsBytes'],'optimisticExtraction':r['optimisticSavedOddsExtractionNotImplementedDatabaseBytes'],'strategies':{k:max(v['worstDatabaseBytes'].values()) for k,v in r['seasonalStrategies'].items()}},indent=2))
