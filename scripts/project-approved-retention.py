"""Matched independent domain model with approved windows and explicit reference
sensitivities. No category is made free merely because it is called historical.
"""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((root/p).read_text())
old=load('reports/historical-lifecycle/capacity.json')
base50=next(r for r in old['rows'] if r['dau']==50 and r['days']==365)['componentsEncodedOrStructuredBytes']
sizes=load('reports/historical-lifecycle/domain-sizes.json')
ed=load('reports/historical-lifecycle/editorial-benchmark.json')
rows=[]
def scenario(dau,days,reference_fraction):
 articles=min(days,90)*96
 saved_articles=min(96*max(0,days-90),.05*dau*max(0,days-90))
 # Unknown notification/observer/cross-content links may keep all aged content.
 extra=(96*max(0,days-90)-saved_articles)*reference_fraction
 kept_articles=articles+saved_articles+extra
 event_saved_fraction=min(1,.2*dau/(16/7))
 # Existing conservative reference logic preserves the whole saved event, not
 # just a small extracted price record. Charge that cost, don't assume it away.
 odds_days=min(days,30)+max(0,days-30)*max(reference_fraction,event_saved_fraction)
 components={k:(v if k in ['fixedSchemaAndRegistry','aiResponseCache','temporaryPayloadBacklog'] else v*days/365) for k,v in base50.items()}
 components.update(
  editorialPublished=kept_articles*ed['after']['encoded']/40,
  canonicalEditorialRecords=kept_articles*ed['before']['encoded']/40*1.25,
  sourceIngestionEvidence=kept_articles*2*sizes['sourceCandidate']['encodedBytes'],
  threeAndOutHistory=(min(days,30)*32+.005*dau*max(0,days-30)+reference_fraction*32*max(0,days-30))*sizes['threeAndOut']['encodedBytes'],
  historicalOdds=math.ceil(odds_days*16*3/7)*(sizes['oddsSnapshot2000Markets']['encodedBytes']+256),
  labScoresAndTrending=math.ceil(odds_days*16/7)*(sizes['labScores2000']['encodedBytes']+512),
  # Market identity directories deliberately remain stable after board expiry.
  marketIdentityDirectories=math.ceil(days*16/7)*(sizes['marketIdentityDirectory2000']['encodedBytes']+256),
  userAccountsAndOwnership=dau*(2+.1*days)*4096,
  authenticationHistory=days*dau*2*256,
  frontOfficeHistory=days*.025*dau*sizes['frontOfficeRevision']['encodedBytes'],
  savedBettingEvidence=days*.2*dau*sizes['savedEvidence']['encodedBytes'],
  searchIndexes=kept_articles*3072,
  structuredHistoryDirectoriesAndIndexes=kept_articles*(4*256+2*512)+min(days,30)*32*256+math.ceil(days*16/7)*256,
  candidateIdentityReceipts=days*192*384,
  retentionAuditAndPlans=days*(96+192+32+16*3/7)*256,
 )
 after=math.ceil(sum(components.values())*1.2)
 # Matched unbounded before scenario uses the same underlying entropy/volumes.
 before=dict(components)
 before.update(editorialPublished=days*96*ed['after']['encoded']/40,
  canonicalEditorialRecords=days*96*ed['before']['encoded']/40*1.25,
  sourceIngestionEvidence=days*192*sizes['sourceCandidate']['encodedBytes'],
  threeAndOutHistory=days*32*sizes['threeAndOut']['encodedBytes'],
  historicalOdds=math.ceil(days*16*3/7)*(sizes['oddsSnapshot2000Markets']['encodedBytes']+256),
  labScoresAndTrending=math.ceil(days*16/7)*(sizes['labScores2000']['encodedBytes']+512),
  searchIndexes=days*96*3072,candidateIdentityReceipts=0,retentionAuditAndPlans=0,
  structuredHistoryDirectoriesAndIndexes=days*(96*4*256+192*512+32*256)+math.ceil(days*16*3/7)*256+math.ceil(days*16/7)*256)
 return {k:math.ceil(v) for k,v in components.items()},after,math.ceil(sum(before.values())*1.2)
for dau in [0,10,25,50,100]:
 for days in [30,90,180,365,730]:
  components,after,before=scenario(dau,days,0)
  _,referenced_all,_=scenario(dau,days,1)
  archive_envelope=2*sum(scenario(dau,d,0)[1] for d in range(1,days+1))
  # Operations retain inherited 365-day estimate; new graph/archive preparation
  # can cost more and is explicitly unqualified. New retention deletion/audit
  # writes are additive to the existing GC allowance, not counted as a saving.
  inherited=next(r for r in old['rows'] if r['dau']==dau and r['days']==365)
  rows.append(dict(dau=dau,days=days,components=components,matchedBeforeBytes=before,afterBytes=after,
   allAgedRecordsExternallyReferencedSensitivityBytes=referenced_all,
   headroom30PercentMet=after<350000000,belowPerDatabaseLimit=after<500000000,
   offlineAllDailyFullArchivesTwoCopiesBytes=archive_envelope,
   d1ReadsPerDayPlanning=inherited['d1ReadsPerDayPlanning'],
   d1WritesPerDayPlanning=inherited['d1WritesPerDayLowerBoundPlanning']+14000,
   d1WritesPerDayAmplificationSensitivity=inherited['d1WritesPerDayAmplificationSensitivity']+14000,
   workerCpuMs=None,workerRequestsPerDay=inherited['workerRequestsPerDay'],
   wholeProductQualified=False))
result=dict(status='NO-GO',scope='Matched independent synthetic domain model; 20% physical reserve. Saved/reference exceptions are permanent. No claim of achieved physical size or measured production workload.',
 assumptions={**old['assumptions'], 'publishedDays':90,'draftDays':7,'unreferencedProcessedCandidateDays':7,
 'briefingDays':30,'generalOddsDays':30,'aiHours':24,'savedArticlesPerDauDay':.05,'savedBriefingsPerDauDay':.005,
 'candidateEvidencePerArticle':2,'candidateReceiptBytes':384,'wholeSavedEventRetention':True,
 'canonicalEditorialProxy':'four full versions plus one current head at measured legacy public body size; not measured canonical compression',
 'archivePolicy':'two copies of every daily verified full archive retained; no unimplemented incremental dedup/rotation saving',
 'operations':'inherited envelope plus 14000 assumed retention writes/day; full owner scan/archive restore reads not fully quantified; hosted CPU unknown'},
 rows=rows,limits={'perDatabaseBytes':500000000,'targetBytes':350000000,'accountRowsReadPerDay':5000000,'accountRowsWrittenPerDay':100000},
 remainingDrivers=['canonical versions/corrections within the retained 90-day article window','evidence for those retained articles lasts longer than seven days','permanent saved-market references conservatively retain whole odds events','operational history, identity receipts and audit growth','unknown notification/observer references can keep all aged articles','64MB payload admission guard unchanged','owner maintenance is not a bounded online marking service'])
(root/'reports/approved-retention/capacity.json').write_text(json.dumps(result,indent=2)+'\n')
for r in rows:
 if r['dau']==50 and r['days']==365:print(json.dumps(r,indent=2))
