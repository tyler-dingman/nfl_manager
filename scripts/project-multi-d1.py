"""Isolated feasibility model. Does not change runtime routing or resource bindings."""
import json,math,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/multi-d1'; OUT.mkdir(exist_ok=True)
# Reuse the approved model function without executing its artifact-writing loop.
source=(ROOT/'scripts/project-approved-retention.py').read_text()
ns={'__file__':str(ROOT/'scripts/project-approved-retention.py')}
exec(compile(source[:source.index('for dau in [0,10,25,50,100]:')],'<approved-model>','exec'),ns)
GROUPS=[['ARI','LAR','SF','SEA'],['ATL','CAR','NO','TB'],['BAL','CIN','CLE','PIT'],['BUF','MIA','NE','NYJ'],['CHI','DET','GB','MIN'],['DAL','NYG','PHI','WAS'],['DEN','KC','LAC','LV'],['HOU','IND','JAX','TEN']]
def route(team):
 for i,g in enumerate(GROUPS):
  if team in g:return f'TEAM_{i+1}'
 raise ValueError('Unknown team: '+str(team))
TEAM=set('app_daily_briefings app_public_stories app_public_story_versions app_public_wire app_search app_odds_board_history app_odds_history app_odds_processing app_odds_publication app_parlay_scores app_sportsbook_events app_sportsbook_market_ids app_story_game_links app_story_overrides app_content_automation_runs canonical_stories content_candidates content_candidate_revisions candidate_teams editorial_cards film_room_videos film_room_video_teams ingestion_jobs lean_heads lean_receipts lean_teams lean_versions odds_refresh_slots story_domain_events story_editorial_overrides story_entities story_evidence story_publication_decisions story_versions three_and_out_snapshots archive_chunks archive_records editorial_blob_fragments editorial_blob_packs editorial_blobs r2_archive_manifests r2_archive_records'.split())
SHARED=set('app_ai_cache app_application_settings app_editorial_sources app_reference_import_lock app_reference_packs app_reference_version app_history_packs app_observer_events app_observer_items app_observer_runs app_imports app_limits app_trivia_daily app_trivia_questions app_reward_definitions app_commerce_products app_commerce_product_variants app_commerce_inventory_adjustments app_commerce_promo_codes app_commerce_counters content_control content_outbox content_run_log content_sources nfl_teams observer_run_events observer_run_items public_schedule source_check_daily source_checkpoints source_checks source_teams video_source_registry'.split())
TEAM.update('app_editorial_candidates app_editorial_decisions app_editorial_events app_editorial_evidence app_editorial_jobs app_editorial_overrides app_editorial_stories app_editorial_versions'.split())
USER=set('app_briefing_mail_jobs app_briefing_push_deliveries app_commerce_order_items app_commerce_orders app_commerce_refunds app_commerce_stripe_webhook_events app_consents app_credentials app_crew_activity app_crew_comments app_crew_invites app_crew_media app_crew_members app_crew_reactions app_crew_share_recipients app_crew_shares app_crews app_devices app_email_change_requests app_fan_pulse_reactions app_franchise_commands app_franchise_heads app_franchise_routes app_game_day_activity app_game_day_events app_game_day_predictions app_game_day_reactions app_game_day_room_members app_game_day_rooms app_heads app_huddle_enforcement app_huddle_messages app_huddle_poll_votes app_huddle_polls app_huddle_reactions app_huddle_reports app_huddle_user_filters app_identities app_mail app_notification_deliveries app_notification_preferences app_notifications app_phone_numbers app_push_tokens app_receipts app_reward_accounts app_reward_events app_reward_notifications app_saved_content app_security_audit app_sessions app_settings app_social_notification_outbox app_sportsbook_transfer_jobs app_subscriptions app_team_follows app_tokens app_trivia_answers app_trivia_challenges app_trivia_event_registrations app_trivia_events app_trivia_friendships app_trivia_game_answers app_trivia_game_participants app_trivia_game_questions app_trivia_games app_trivia_groups app_trivia_invitations app_trivia_rank_snapshots app_trivia_stats app_trivia_views app_user_content_state app_user_poll_votes app_user_predictions app_user_rewards app_user_team_visit_state app_users app_web_push_test_limits'.split())
def owner(name):
 if name.startswith(('app_storage_','app_payload_')) or name in {'app_assertions','transaction_assertions'}:return 'LOCAL_INTERNAL'
 if name.startswith('app_search_') or name in TEAM:return 'TEAM_OWNER'
 if name in SHARED:return 'SHARED'
 if name in USER:return 'USER'
 raise ValueError('Unallocated table: '+name)
c=sqlite3.connect(':memory:')
for p in sorted((ROOT/'workers/content-engine/migrations').glob('*.sql')):c.executescript(p.read_text())
tables=[r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
inventory=[];cross=[]
for t in tables:
 fks=[{'target':r[2],'from':r[3],'to':r[4]} for r in c.execute(f'PRAGMA foreign_key_list("{t}")')]
 inventory.append({'table':t,'allocation':owner(t),'foreignKeys':fks})
 for fk in fks:
  if owner(t)!=owner(fk['target']) and 'LOCAL_INTERNAL' not in [owner(t),owner(fk['target'])]:cross.append({'table':t,**fk})
# Attribution is explicit and sums exactly. Uniform traffic is a scenario, not a bound.
U=set('userAccountsAndOwnership authenticationHistory frontOfficeHistory savedBettingEvidence'.split())
S=set('operationalHistory aiResponseCache temporaryPayloadBacklog gcAuditAndPlanAllowance retentionAuditAndPlans'.split())
base=ns['old']['rows']
def ops(dau):
 # Existing envelope is affine in DAU. Extrapolation at 250 is labelled, not measured.
 a=next(r for r in base if r['dau']==0 and r['days']==365)
 b=next(r for r in base if r['dau']==50 and r['days']==365)
 keys=['d1ReadsPerDayPlanning','d1WritesPerDayLowerBoundPlanning','d1WritesPerDayAmplificationSensitivity','workerRequestsPerDay']
 return {k:math.ceil(a[k]+(b[k]-a[k])*dau/50)+(14000 if 'Writes' in k else 0) for k in keys}
rows=[]
for dau in [25,50,100,250]:
 for days in [30,90,180,365,730]:
  components,total,_=ns['scenario'](dau,days,0)
  def allocate(comp):
   fixed=comp['fixedSchemaAndRegistry']
   # Conservative full baseline schema+registry allowance per database; no copy credit.
   user=sum(v for k,v in comp.items() if k in U)
   shared=sum(v for k,v in comp.items() if k in S)
   team=sum(v for k,v in comp.items() if k not in U|S|{'fixedSchemaAndRegistry'})
   return {**{f'TEAM_{i+1}':math.ceil((team/8+fixed)*1.2) for i in range(8)},'USER':math.ceil((user+fixed)*1.2),'SHARED':math.ceil((shared+fixed)*1.2)}
  db=allocate(components); worst=allocate(ns['scenario'](dau,days,1)[0])
  # Retain the approved full daily backup policy, including duplicated schema overhead.
  disk=2*sum(sum(allocate(ns['scenario'](dau,d,0)[0]).values()) for d in range(1,days+1))
  rows.append({'dau':dau,'days':days,'databasesBytes':db,'accountBytes':sum(db.values()),'allReferencesAccountBytes':sum(worst.values()),'allReferencesMaxDatabaseBytes':max(worst.values()),'twoTimesTrafficTeamDatabaseBytes':math.ceil((db['TEAM_1']-components['fixedSchemaAndRegistry']*1.2)*2+components['fixedSchemaAndRegistry']*1.2),'offlineTwoCopiesDailyFullArchivesBytes':disk,'operations':ops(dau),'workerCpuMs':None})
result={'status':'NO-GO','scope':'Planning only; approved synthetic size proxies and uniform team load. Not measured physical multi-D1 storage. No cross-database runtime enabled.','groups':GROUPS,'rows':rows,'tableInventory':inventory,'crossRoleForeignKeys':cross,'modelAssumptions':{'schemaCopies':10,'physicalReserve':1.2,'backups':'owner offline only; full daily copies x2; zero D1 backup storage','sharedOperationalAttribution':'all operational and GC/retention allowance charged shared conservatively; local internal physical location may redistribute this','250DauOperations':'affine extrapolation from 0 and 50 DAU; excludes new cross-shard saga/search/maintenance costs','notIncluded':'unmodeled domains from approved source model; extra cross-database directory/pin/saga bytes and writes; foreign key replacement implementation; account existing resources','payloadAdmissionBytesPerDatabase':64000000}}
(OUT/'capacity.json').write_text(json.dumps(result,indent=2)+'\n')
(OUT/'table-allocation.md').write_text('# Complete baseline table allocation\n\nTEAM_OWNER means exactly one owning team shard, not eight copies. LOCAL_INTERNAL is a separate local namespace in each populated DB. FTS shadow tables follow app_search. USER includes transactional social, commerce, trivia and notification state. This is a design allocation, not deployed DDL.\n\n| Table | Allocation | SQL FK targets |\n|---|---|---|\n'+''.join(f"| {r['table']} | {r['allocation']} | {', '.join(x['target'] for x in r['foreignKeys']) or '—'} |\n" for r in inventory))
if __name__=='__main__':print(json.dumps({'tables':len(tables),'crossRoleForeignKeys':len(cross),'annual50':next(r for r in rows if r['dau']==50 and r['days']==365)},indent=2))
