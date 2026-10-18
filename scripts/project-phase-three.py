"""Explicit full-product planning scenario subtotal; never a readiness certificate."""
import json,pathlib,math
root=pathlib.Path(__file__).resolve().parents[1];out=root/'reports/zero-cost-phase-3'
old=json.loads((root/'reports/zero-cost-phase-2/capacity-model.json').read_text())
measured=json.loads((out/'application-storage-benchmark.json').read_text())
per_account=max(10240,measured['incrementalD1Bytes']/measured['accounts'])
def calculate(dau,days):
 base=old['storage'][str(days)]
 # No erasure of old sessions, receipts, submissions, slips, or private versions.
 private={
  'accountsPreferencesAndInitialSavedIds':10*dau*per_account,
  'retainedSessionsAndSecurityAudit':.2*dau*days*1024,
  'triviaAndPointsHistory':dau*days*512,
  'additionalSavedSlipsAndContent':.2*dau*days*3072,
  'frontOfficeReceipts':.005*5*dau*days*256,
  'emailQueueAndSubscriptions':.1*dau*days*384,
  'configuration':65536,
  'oddsDirectoryAndAiKeys':days*(16*3/7*192+200*128),
 }
 app=sum(private.values());d1=base['d1Bytes']+app
 r2parts={
  'inheritedEditorialAndEightDirectoryCopies':base['r2Bytes'],
  'frontOfficeVersionHistoryTwoCopies':.005*5*dau*days*100000*2,
  'oddsHistoryTwoCopies':16*3/7*days*100000*2,
  'sharedAiResultsTwoCopies':200*days*2048*2,
  'privateConfigAndAttachmentsTwoCopies':dau*32768*2,
  'eightEncryptedPrivateDirectoryBackups':app*8*4/3,
 }
 r2=sum(r2parts.values());worst_fo=.005*5*dau*days*2100000*2
 # Includes every operational family, but byte rates for unported tables are
 # PROJECTED envelopes; only the account fixture and 2.1 MB document are measured.
 traffic=old['traffic'][str(dau)] if str(dau) in old['traffic'] else None
 requests=7986+48*dau+8*dau*1.2+48+math.ceil(.1*dau/3)
 reads=1950162+328.32*dau+340*dau
 writes=67711+26*dau
 class_a=256248+30*(.025*dau*2+.2*dau*2+16*3/7*2+200*2+app/900000)
 cold_inventory_reads=4*days*(200+.025*dau+16*3/7+.1*dau)
 class_b=(traffic or {}).get('r2ClassBPer30Days',825648+3611.502*dau)+30*(.2*dau*2+.1*dau*2+200*5+cold_inventory_reads)
 return {'dau':dau,'days':days,'d1Bytes':math.ceil(d1),'privateD1Components':private,'r2Bytes':math.ceil(r2),'r2Components':r2parts,'r2BytesWithMeasuredWorstGameShape':math.ceil(r2-r2parts['frontOfficeVersionHistoryTwoCopies']+worst_fo),
  'coldBackupPrivateObjectReadsPerDay':math.ceil(cold_inventory_reads),'additionalUnportedDomainBytes':None,'workerRequestsPerDay':math.ceil(requests),'workerCpu':'UNVERIFIED','d1ReadsPerDay':math.ceil(reads),'d1WritesPerDay':writes,'r2ClassAPer30Days':math.ceil(class_a),'r2ClassBPer30Days':math.ceil(class_b),
  'aiSharedGenerationsPerDay':200,'aiReservedNeuronsAt2500Input700Output':200*math.ceil((2500+256)*4625/1e6+700*30475/1e6),'dailySubscribersAt10PercentDau':math.ceil(.1*dau),'dailySubscribersAt100PercentDau':dau,'transactionalEmailDemandPerDay':max(10,math.ceil(.02*dau)),
  'sportsObjectReservationsPer31DaysOnePagePerSlot':15*26,'sportsObjectReservationsPer31DaysTwoPagesPerSlot':15*52,
  'meetsD1Storage30PercentMargin':d1<=350000000,'meetsR2Storage30PercentMargin':r2<=7000000000,'meetsD1Writes30PercentMargin':writes<=70000,'productionQualified':False}
scenarios=[calculate(d,days) for d in [100,500,1000,1500,2000,3000,5000] for days in [30,90,180,365,730,1095]]
result={'scope':'PROJECTED whole-product category scenario subtotal, retaining all history. Not a completed table-level workload qualification; unported domains, merchandise/payment/voice/push providers, actual Worker CPU, source rights, account-wide usage and cold backup retention remain UNVERIFIED.',
 'assumptions':{'registeredAccountsPerDau':10,'accountBytes':per_account,'sessionsPerDauPerDay':.2,'savedRecordsPerDauPerDay':.2,'foActiveFraction':.005,'foCommandsPerActivePlayerPerDay':5,'normalFoDocumentBytes':100000,'measuredWorstFoBytes':2100000,'oddsEventsPerRefresh':16,'oddsBytesPerEvent':100000,'inferenceSharedPerDay':200,'backupDirectoryCopies':8,'backupCodecExpansion':4/3,'headroom':.3,'newPrivateD1WritesPerDauPerDay':26,'noHistoryGc':True},
 'missingQualifications':['Actual per-table volumes for all 115 historical PostgreSQL declarations','D1 gameplay/trivia/rewards/odds-board transactions','Cloudflare billed CPU and startup','Provider account entitlements, rights and delivery','Off-account encrypted backup, streaming export and retention execution'],
 'implementedEmailService':{'rawProviderDaily':100,'monthly':3000,'reservedDaily':70,'editorialDaily':60,'transactionalReservedDaily':10},
 'alternativeBroadcasts':{'publicAdvertisedFreeContacts':1000,'recommendedContactsAt30PercentHeadroom':700,'automatedConsentSyncAndProviderDelivery':'NOT_IMPLEMENTED_OR_VERIFIED'},
 'maximumVerifiedWholeProductDau':None,'projectedWholeProductMonthlyCost':'UNVERIFIED; $0 for this local work only','scenarios':scenarios}
(out/'capacity-model.json').write_text(json.dumps(result,indent=2)+'\n')
lines=['# Phase 3 planning scenario subtotal','','All numbers PROJECTED unless expressly identified as measured. One account fixture does not qualify the unported table population. These scenarios retain history and reveal limits instead of dropping user data.','','| DAU | Worker req/day | D1 reads/day | D1 writes/day | D1 MB day 365 | R2 MB day 365 | R2 A/month | R2 B/month | Daily email at 10% |','|---|---|---|---|---|---|---|---|---|']
for row in scenarios:
 if row['days']==365:lines.append(f"| {row['dau']} | {row['workerRequestsPerDay']:,} | {row['d1ReadsPerDay']:,} | {row['d1WritesPerDay']:,} | {row['d1Bytes']/1e6:.2f} | {row['r2Bytes']/1e6:.2f} | {row['r2ClassAPer30Days']:,} | {row['r2ClassBPer30Days']:,} | {row['dailySubscribersAt10PercentDau']} |")
lines+=['','| Days | D1 MB at 1,000 DAU | R2 MB at 1,000 DAU | R2 MB with measured worst-size game shape |','|---|---|---|---|']
for row in scenarios:
 if row['dau']==1000:lines.append(f"| {row['days']} | {row['d1Bytes']/1e6:.2f} | {row['r2Bytes']/1e6:.2f} | {row['r2BytesWithMeasuredWorstGameShape']/1e6:.2f} |")
lines+=['','The JSON records every scenario at every horizon and every component assumption. CPU remains null/unverified. The implemented queue supports 60 daily editorial recipients with the reserved margin; Broadcasts is a separate promising tier, capped conservatively at 700 contacts pending implementation and account verification. No whole-product $0 launch capacity is certified.']
(out/'capacity-model.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'scenarios':len(scenarios),'wholeProductCertified':False,'1000Dau365':next(r for r in scenarios if r['dau']==1000 and r['days']==365)}))
