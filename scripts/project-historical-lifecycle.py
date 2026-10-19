"""Independent category planning scenarios. Synthetic payload sizes != production
traffic. Retain every required historical record; do not hide unknown domains.
"""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((root/p).read_text())
sizes=load('reports/historical-lifecycle/domain-sizes.json')
ed=load('reports/historical-lifecycle/editorial-benchmark.json')
old=load('reports/d1-free-optimization/capacity.json')
encoded=lambda key:sizes[key]['encodedBytes']
rows=[]
assumptions=dict(publishedStoriesPerDay=96,versionsPerStory=4,candidatesPerDay=192,
 briefingsPerDay=32,eventRefreshesPerWeek=3,eventsPerWeek=16,distinctEventsPerWeek=16,
 marketsPerEvent=2000,savedEvidencePerDauDay=.2,frontOfficeRevisionsPerDauDay=.025,
 operationsPerDay=192,sourceRegistryBytes=262144,rowsAndIndexesReserveFactor=1.2,
 aiLiveResponses=200,aiEncodedBytesEach=2048,temporaryUnreferencedBacklogDays=1,
 userAccountBytesPerCumulativeUser=4096,initialUsersPerDau=2,newUsersPerDauDay=.1,
 sessionsPerDauDay=2,sessionAndAuthRowBytes=256,
 offlineBackupRetentionDays=7,backupCopies=2,
 note='These are explicit planning assumptions, not verified production volumes. 16 distinct events/week is a conservative continuous-year envelope, not a claim NFL games run every week. Score caches are charged per distinct event unless source invalidation can be measured. Candidate/evidence bodies and operational history are not deleted.')
for dau in [0,10,25,50,100]:
 for days in [30,90,180,365]:
  captures=math.ceil(days*16*3/7)
  events=math.ceil(days*16/7)
  # Only payload-free baseline pages are fixed; indexes are explicit byte
  # allowances. All payloads carry a 20% physical reserve later.
  components={
   'editorialPublished':days*96*ed['after']['encoded']/40,
   # Canonical StoryRecord heads and version+synth records are separate from
   # public projections. Charge four full versions plus one current head per
   # article, using the measured legacy public body size as an explicit proxy.
   # This is an assumption, not a measured canonical compression ratio.
   'canonicalEditorialRecords':days*96*ed['before']['encoded']/40*1.25,
   'sourceIngestionEvidence':days*192*encoded('sourceCandidate'),
   'threeAndOutHistory':days*32*encoded('threeAndOut'),
   'historicalOdds':captures*(encoded('oddsSnapshot2000Markets')+256),
   'marketIdentityDirectories':events*(encoded('marketIdentityDirectory2000')+256),
   'labScoresAndTrending':events*(encoded('labScores2000')+512),
   'userAccountsAndOwnership':dau*(2+.1*days)*4096,
   'authenticationHistory':days*dau*2*256,
   'frontOfficeHistory':days*.025*dau*encoded('frontOfficeRevision'),
   'savedBettingEvidence':days*.2*dau*encoded('savedEvidence'),
   'operationalHistory':days*192*(encoded('operationDetails')+512),
   'searchIndexes':days*96*3072,
   'structuredHistoryDirectoriesAndIndexes':days*(96*4*256+192*512+32*256)+captures*256+events*256,
   'aiResponseCache':200*2048,
   'temporaryPayloadBacklog':192*encoded('operationDetails'),
   'gcAuditAndPlanAllowance':days*(200+192)*256,
   'fixedSchemaAndRegistry':2400000+262144,
  }
  after=math.ceil(sum(components.values())*1.2)
  before=math.ceil((sum(components.values())-components['editorialPublished']+days*96*ed['before']['encoded']/40)*1.2)
  # Annual operations retain prior whole-product envelope (includes otherwise
  # unmodeled domains). Add explicit bounded directory/sweep overhead; index
  # amplification sensitivity remains, not a quota certificate.
  inherited=next(r for r in old['rows'] if r['dau']==dau and r['days']==days)
  reads=inherited['d1ReadsPerDayProjected']+2*200 # directory and audit sensitivity
  writes=inherited['d1WritesPerDayKnownLowerBound']+200*4+4
  row=dict(dau=dau,days=days,componentsEncodedOrStructuredBytes={k:math.ceil(v) for k,v in components.items()},
   matchedBeforeDemandBytes=before,afterDemandBytes=after,headroom30PercentMet=after<350000000,
   belowDatabaseLimit=after<500000000,baselineInheritedDemandBytes=inherited['afterD1HighWaterDemandBytes'],
   payloadAdmissionBytes=64000000,payloadAdmissionDaysApprox=round(64000000/((sum(components[k] for k in ['editorialPublished','canonicalEditorialRecords','sourceIngestionEvidence','threeAndOutHistory','historicalOdds','marketIdentityDirectories','labScoresAndTrending','frontOfficeHistory','savedBettingEvidence','operationalHistory']))/days),2),
   d1ReadsPerDayPlanning=reads,d1WritesPerDayLowerBoundPlanning=writes,
   d1WritesPerDayAmplificationSensitivity=inherited['d1WritesSensitivityIfOneFencedTransactionPerFourInheritedRowWrites']+804,
   workerRequestsPerDay=inherited['workerRequestsPerDay'],workerCpuMs=None,
   offlineBackupBytesUpperEnvelope=after*7*2,cloudBackupBytes=0,
   unmodeledAdditionalDemand=['complete canonical reference imports','Huddle/crew/trivia/commerce/push/video growth beyond inherited operations','media content and attachment entropy','owner recovery pins and user churn distribution','canonical synth/claims size beyond the explicit body proxy'],
   wholeProductQualified=False)
  rows.append(row)
result=dict(status='NO-GO',scope='Independent synthetic domain scenarios. Matched before/after differs only by measured editorial representation. Not numerically comparable to the old residual-based 4.35GB forecast, and not an upper bound on unmodeled application demand.',assumptions=assumptions,
 measuredSizes=sizes,rows=rows,limits=dict(databaseBytes=500000000,targetBytes=350000000,accountReadsPerDay=5000000,accountWritesPerDay=100000),
 recommendation='Preserve history; do not raise admission. Agree source-evidence and editorial retention/ingestion-volume requirements before launch capacity claims.')
(root/'reports/historical-lifecycle/capacity.json').write_text(json.dumps(result,indent=2)+'\n')
for r in rows:
 if r['dau']==50 and r['days']==365: print(json.dumps(r,indent=2))
