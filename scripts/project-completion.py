"""Explicit planning envelopes plus measured local evidence; never a DAU certification."""
import json,pathlib,math
root=pathlib.Path(__file__).resolve().parents[1];out=root/'reports/production-completion'
previous=json.loads((root/'reports/zero-cost-phase-4/capacity-model.json').read_text())
scale=json.loads((out/'scale-recovery.json').read_text())
old={(r['dau'],r['days']):r for r in previous['scenarios']}
def components(dau,days):
 # ASSUMED same saved-record arrival rate as the inherited model; 3,072 -> 512
 # is an envelope, not the 98.3% synthetic column reduction applied to all data.
 saved=.2*dau*days*(3072-512)
 public=days*(96*(1536+256+128)+32*384)*1.2
 directories=days*(16*3/7*(256+256+128)+.025*dau*96)*1.2
 return saved,public,directories
def d1(dau,day):
 base=old[dau,30]['d1Bytes']+(old[dau,365]['d1Bytes']-old[dau,30]['d1Bytes'])*(day-30)/335
 saved,public,directories=components(dau,day)
 return max(0,base-saved+public+directories)
rows=[]
for dau in [100,500,1000,1500,2000,3000,5000]:
 for days in [30,90,180,365,730,1095]:
  baseline=old[dau,days]
  # Use inherited multi-year baseline directly, rather than extrapolate it twice.
  saved,public,directories=components(dau,days)
  primary=baseline['d1Bytes']-saved+public+directories
  # ASSUMED 2,000 unique market identities/event at 128 logical bytes each;
  # R2 preserves all IDs and scores, 0.5 ordinary compression, two object copies.
  market_ids=days*(16*3/7)*2000*128*.5*2
  scores=days*(16*3/7)*2000*512*.5*2
  extra_payload=saved*.5*2+market_ids+scores+days*96*2048*.5*2
  backup_delta=sum((-components(dau,day)[0]+components(dau,day)[1]+components(dau,day)[2])*.25 for day in range(1,days+1))
  r2=baseline['r2BytesConservativeAllCheckpoints']+extra_payload+backup_delta
  writes=baseline['d1WritesPerDayLowerBound']+96*8+32*3+math.ceil(16*3/7*10)+math.ceil(.025*dau*2)
  read=baseline['d1ReadsPerDayLowerBound']+96*8+math.ceil(.2*dau*2)
  class_a=baseline['r2ClassAPer30DaysLowerBound']+math.ceil(30*(.2*dau*2+16*3/7*8+32*2))
  class_b=baseline['r2ClassBPer30DaysLowerBound']+math.ceil(30*(.2*dau*4+16*3/7*16+32*4))
  limits={'Worker requests':(baseline['workerRequestsPerDay'],70000),'D1 reads':(read,3500000),'D1 writes':(writes,70000),'single D1 storage':(primary,350000000),'R2 storage':(r2,7000000000),'R2 Class A':(class_a,700000),'R2 Class B':(class_b,7000000),'editorial subscribers':(math.ceil(.1*dau),57)}
  rows.append({'dau':dau,'days':days,'d1Bytes':math.ceil(primary),'r2Bytes':math.ceil(r2),'d1SavingsFromSavedPayloads':math.ceil(saved),'newD1PublicAndDirectoryBytes':math.ceil(public+directories),'avoidedIndexedMarketIdBytes':math.ceil(days*(16*3/7)*2000*128*1.2),'r2AdditionalPayloadBytes':math.ceil(extra_payload),'workerRequestsPerDayLowerBound':baseline['workerRequestsPerDay'],'workerCpuMs':None,'d1ReadsPerDayLowerBound':read,'d1WritesPerDayLowerBound':writes,'r2ClassAPer30DaysLowerBound':class_a,'r2ClassBPer30DaysLowerBound':class_b,'aiReservedNeuronsPerDay':baseline['aiReservedNeuronsPerDay'],'editorialSubscribersAt10PercentDau':math.ceil(.1*dau),'sportsObjectsReservedPer31Days':baseline['sportsObjectsReservedPer31Days'],'worstGameR2Bytes':math.ceil(r2+baseline['r2BytesWithWorstHighEntropyGameVersions']-baseline['r2BytesConservativeAllCheckpoints']),'unmodeledBytes':None,'overHeadroomBudgets':[k for k,(used,limit) in limits.items() if used>limit],'wholeProductQualified':False})
result={'status':'BLOCKED','scope':'PROJECTED envelopes. All rows retain required history. Account-wide quotas; existing unrelated account workloads unknown. Missing domains are unknown, never zero.','limitsVerifiedOn':'2026-10-18','limits':{'D1PerDatabaseBytes':500000000,'D1AccountBytes':5000000000,'D1AccountReadsPerDay':5000000,'D1AccountWritesPerDay':100000,'D1QueriesPerInvocation':50,'R2StorageBytes':10000000000,'R2ClassAPerMonth':1000000,'R2ClassBPerMonth':10000000,'WorkerRequestsPerDay':100000,'WorkerCpuMsPerRequest':10,'WorkerGzipBytes':3145728,'headroom':.3},'measured':{'users':scale['users'],'sqliteBytes':scale['d1Pages']['sqliteBytes'],'recoveryObjects':scale['checkpoint']['objects']},'assumptions':{'inherited':'reports/zero-cost-phase-4/capacity-model.json','publishedStoriesPerDay':96,'briefingsPerDay':32,'marketIdentitiesPerEvent':2000,'identityLogicalBytes':128,'scoreLogicalBytesPerMarket':512,'ordinaryR2CompressionFactor':.5,'privateObjectCopies':2,'newD1PageReserve':1.2,'backupDirectoryPhysicalToD1Factor':.25,'allCheckpointsRetained':True,'changedCheckpointReuseCredit':0,'savedRecordBytesBefore':3072,'savedRecordBytesAfterEnvelope':512},'unmodeled':['Huddle/crew/commerce/push/video operational histories and provider usage','complete source and canonical-reference import volumes','production CPU/startup/memory and cache hit rates','actual changed-checkpoint sharing','real account entitlements and existing account-wide traffic'],'maximumVerifiedWholeProductDau':None,'monthlyCost':'UNVERIFIED; no paid infrastructure activated','scenarios':rows}
(out/'capacity-model.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(next(r for r in rows if r['dau']==1000 and r['days']==365)))
