"""Whole-product planning envelopes; unknown application volumes remain unknown.
No claimed capacity from mocked providers, empty tables, or local CPU."""
import json,pathlib,math,re
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'reports/zero-cost-phase-4'
previous=json.loads((ROOT/'reports/zero-cost-phase-3/capacity-model.json').read_text())
phase2=json.loads((ROOT/'reports/zero-cost-phase-2/capacity-model.json').read_text())
scale=json.loads((OUT/'scale-recovery.json').read_text())
old={(r['dau'],r['days']):r for r in previous['scenarios']}
# Same workload assumptions as Phase 3; lifecycle only bounds derived AI keys.
# No credit for unported games, histories, or SQL indexes.
def d1_at(dau,days):
 p=old.get((dau,days))
 if p:d1=p['d1Bytes']
 else:
  thirty=old[dau,30]['d1Bytes'];annual=old[dau,365]['d1Bytes'];d1=thirty+(annual-thirty)*(days-30)/335
 return d1-max(0,days-30)*200*128
scenarios=[]
for dau in [100,500,1000,1500,2000,3000,5000]:
 for days in [30,90,180,365,730,1095]:
  before=old[dau,days]; d1=d1_at(dau,days)
  inherited=phase2['storage'][str(days)]
  components=before['r2Components']; old_dirs=inherited['inventoryBackupR2Bytes']+components['eightEncryptedPrivateDirectoryBackups']
  # ASSUMED conservative ordinary-data factors, not benchmark-equivalence claims.
  payload=before['r2Bytes']-old_dirs-components['frontOfficeVersionHistoryTwoCopies']-components['oddsHistoryTwoCopies']
  payload+=components['frontOfficeVersionHistoryTwoCopies']*.25+components['oddsHistoryTwoCopies']*.5
  # All daily checkpoints retained. Chunk reuse is measured only for unchanged
  # data, so credit zero reuse for changed snapshots in this conservative bound.
  directory_bytes=sum(d1_at(dau,day)*.25 for day in range(1,days+1))
  # Explicit counterfactual: eight directory generations requires a separately
  # approved and implemented history/retention contract. It is NOT active.
  bounded_dirs=d1*.25*8
  r2=payload+directory_bytes
  game_ops=math.ceil(.025*dau*max(0,scale['gameHistory']['r2Reads']/400-5)) # measured 45 object reads/commit in this fixture
  # Retain Phase 3 operations; tree references add work rather than pretending
  # compression reduces the number of object operations.
  row={'dau':dau,'days':days,'d1Bytes':math.ceil(d1),'r2BytesConservativeAllCheckpoints':math.ceil(r2),'r2BytesCounterfactualEightDirectories':math.ceil(payload+bounded_dirs),'r2PayloadBytes':math.ceil(payload),'backupDirectoryBytes':math.ceil(directory_bytes),
   'r2BytesWithWorstHighEntropyGameVersions':math.ceil(r2-components['frontOfficeVersionHistoryTwoCopies']*.25+.025*dau*days*2100000*.65*2),
   'workerRequestsPerDay':before['workerRequestsPerDay'],'workerCpuMs':None,'d1ReadsPerDayLowerBound':before['d1ReadsPerDay'],'d1WritesPerDayLowerBound':before['d1WritesPerDay']+600,
   'r2ClassAPer30DaysLowerBound':before['r2ClassAPer30Days'],'r2ClassBPer30DaysLowerBound':before['r2ClassBPer30Days']+30*game_ops,
   'aiReservedNeuronsPerDay':before['aiReservedNeuronsAt2500Input700Output'],'editorialEmailsPerDay':math.ceil(.1*dau),'implementedEditorialDailyCap':60,'sportsObjectsReservedPer31Days':before['sportsObjectReservationsPer31DaysTwoPagesPerSlot'],
   'unportedDomainBytes':None,'wholeProductQualified':False,'targetD1Met':d1<350000000,'targetR2Met':r2<7000000000}
  budgets=[('Worker requests',row['workerRequestsPerDay'],70000),('D1 reads',row['d1ReadsPerDayLowerBound'],3500000),('D1 writes',row['d1WritesPerDayLowerBound'],70000),('D1 storage',d1,350000000),('R2 storage',r2,7000000000),('R2 Class A',row['r2ClassAPer30DaysLowerBound'],700000),('R2 Class B',row['r2ClassBPer30DaysLowerBound'],7000000),('AI neurons',row['aiReservedNeuronsPerDay'],7000),('editorial email',row['editorialEmailsPerDay'],60)]
  row['overHeadroomBudgets']=[name for name,usage,limit in budgets if usage>limit]
  scenarios.append(row)
result={'status':'BLOCKED','scope':'PROJECTED workload envelopes, not a completed application qualification','measured':{'scaleUsers':3000,'scaleD1Bytes':scale['d1Pages']['sqliteBytes'],'scaleObjects':scale['checkpoint']['objects'],'gamePhysicalToLegacyLogicalRatio':scale['gameHistory']['ratio'],'unchangedCheckpointNewWrites':0},
 'assumptions':{'normalGameCompressionAndSharingFactor':.25,'oddsCompressionAndSharingFactor':.5,'backupDirectoryPhysicalToD1PageFactor':.25,'allDailyCheckpointsRetained':True,'changedCheckpointChunkReuseCredit':0,'worstGameCompressionFactor':.65,'headroom':.3,'workload':'Phase 3 assumptions retained; no user history deleted'},
 'unverified':['production CPU/startup/memory','unported domain volumes','provider entitlements/delivery/AI quality','account-wide existing workloads','daily backup execution within Worker CPU/operations','actual changed-checkpoint reuse'],
 'maximumVerifiedWholeProductDau':None,'maximumModeledDauWithAllHeadroom':None,'firstKnownLimitingResource':'Worker minified bundle exceeds 3 MiB Free cap before traffic; D1 writes and retained backup inventory also exceed margin at 100 DAU.',
 'monthlyProductionCost':'UNVERIFIED; zero-cost 1000 DAU not qualified','scenarios':scenarios}
(OUT/'capacity-model.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(next(r for r in scenarios if r['dau']==1000 and r['days']==365)))
