"""Build the report offline; never submits API requests."""
import json
from pathlib import Path
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

root=Path('reports/unabated-three-leg-audit')
a=json.loads((root/'pilot-results.json').read_text())
assert a.get('finishedAt'), 'Generation still running'
t=a['tests'][0]
legs=t['pick']['legs']
result=t.get('result',{})
fd=next((s for s in result.get('betSlips',[]) if s['book']=='FanDuel'),{})
bets=fd.get('betslipBets',[])
labels={'RECEIVING_YARDS':'Receiving Yards','RECEPTIONS':'Receptions','RUSHING_YARDS':'Rushing Yards','PASSING_YARDS':'Passing Yards'}
aliases={'LAR':'LA','JAX':'JAC'}
checks=[]
for p in legs:
 matches=[b for b in bets if b.get('player','').casefold()==p['playerName'].casefold()]
 b=matches[0] if len(matches)==1 else {}
 event=b.get('event','').split(' @ ')
 check={
 'player':len(matches)==1,
 'game':len(event)==2 and all(part.split()[-1] in {code,aliases.get(code)} for part,code in zip(event,[p['awayTeamId'],p['homeTeamId']])),
 'kickoff':b.get('metadata',{}).get('timestamp') is not None and datetime.fromisoformat(b['metadata']['timestamp'])==datetime.fromisoformat(p['kickoffAt'].replace('Z','+00:00')),
 'market':b.get('betType','').strip()==labels[p['marketType']],
 'threshold':b.get('odds',{}).get('points') is not None and float(b['odds']['points'])==p['line'],
 'period':b.get('periodType')=='Full Game' and b.get('isLive') is False,
 'sportsbook':b.get('deepLink',{}).get('sportsbook')=='FanDuel',
 }
 explicit=b.get('direction') or b.get('side') or b.get('metadata',{}).get('additionalInfo',{}).get('overUnder')
 if explicit is not None: check['direction']=str(explicit).upper()==p['side']
 checks.append({'player':p['playerName'],'requestedSide':p['side'],'checks':check,'direction':explicit or 'Missing—pending manual verification','returnedOfferId':b.get('id'),'returnedOdds':b.get('odds',{}).get('value'),'returnedThreshold':b.get('odds',{}).get('points')})
url=fd.get('deepLink')
counts=fd.get('legsRequested')==3 and fd.get('legsMatched')==3 and len(bets)==3
visible=counts and all(all(c['checks'].values()) for c in checks)
classification='Failed' if not fd or t['outcome']!='Complete' or not url else ('Complete candidate' if visible else 'Mismatch')
tracked=None
if classification=='Complete candidate':
 parts=urlsplit(url)
 assert parts.scheme=='https' and parts.hostname=='gambly.com' and parts.path.startswith('/deeplink/')
 q=parse_qsl(parts.query,keep_blank_values=True)
 existing=[v for k,v in q if k=='utm_campaign']
 assert not existing or existing==['downanddistance'], 'Unexpected existing attribution; do not overwrite'
 if not existing: q.append(('utm_campaign','downanddistance'))
 tracked=urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode(q),parts.fragment))
summary={'classification':classification,'checks':checks,'originalUrl':url,'attributedUrl':tracked,'manualVerification':'Pending manual verification','requestId':t.get('requestId'),'elapsedMs':t.get('elapsedMs'),'apiCalls':len(t['requests']),'polls':sum(r['method']=='GET' for r in t['requests'])}
(root/'validation.json').write_text(json.dumps(summary,indent=2)+'\n')
def table(headers,rows):return '| '+' | '.join(headers)+' |\n| '+' | '.join(['---']*len(headers))+' |\n'+'\n'.join('| '+' | '.join(str(x) for x in row)+' |' for row in rows)+'\n'
lines=['# Three-leg FanDuel parlay test','',f"**{classification}. Awaiting manual FanDuel verification.**",'', 'The user reports that the earlier Tyson Bagent Over 216.5 single populated correctly in FanDuel Iowa. This is user-reported evidence for that specific single; no new screenshot of it was supplied with this test. This report does not extend that confirmation to the three-leg slip.', '', '## Original database selections','',table(['Leg','Player','Game / kickoff UTC','Selection','Class','Stored FanDuel odds'],[[i+1,p['playerName'],f"{p['awayTeamId']} @ {p['homeTeamId']} / {p['kickoffAt']}",f"{p['side']} {p['line']} {labels[p['marketType']]}",p['lineType'],p['odds']] for i,p in enumerate(legs)]),'All three markets are full game, from different upcoming unlocked events, with different resolved player IDs and stored available FanDuel prices. The alternate leg is between -200 and -1000. Selection favors most recently updated eligible records. Classification uses stored FanDuel main/alternate thresholds; no lines or prices were fabricated. Market team_id is null in these records; named-player identity is resolved by the existing provider mapping and player_id, and event teams are preserved.','',table(['Player','Market ID','Player ID','Event ID','Stored odds updated UTC'],[[p['playerName'],p['id'],p['playerId'],p['eventId'],p['oddsUpdatedAt']] for p in legs]),'Stored availability is not independently refreshed FanDuel availability. These odds were updated several hours before generation. Full original records are preserved in `unabated-three-leg-audit/selections.json`. No ingestion or database writes were performed.','','## Generation','',f"One POST to `/api/v1/bet/generate`, with all three selections together. Iowa and full-game requirements were included in `content.text`; only documented request fields (`type`, `generateMobileLinks`, `content.text`) were used. Same-key bounded status polling followed the [official workflow](https://docs.unabated.com/guides/bet-slips). No automatic POST retry, no individual-link stitching, no additional generations.",'',table(['Field','Observed'],[['Request ID',t.get('requestId')],['Lifecycle',t['outcome']],['HTTP statuses',', '.join(str(r.get('httpStatus',r.get('error'))) for r in t['requests'])],['Sportsbook',fd.get('book')],['Legs requested',fd.get('legsRequested')],['Legs matched',fd.get('legsMatched')],['Returned individual selections',len(bets)],['Provider combined odds (unverified)',fd.get('overallOdds')],['Generation time seconds',round(t.get('elapsedMs',0)/1000,3)],['API requests',len(t['requests'])],['Status polls',summary['polls']],['HTTP / transport errors',sum(r.get('httpStatus')!=200 for r in t['requests'])],['Lifecycle errors',0 if t['outcome']=='Complete' else 1]]),'Sanitized raw responses, exact prompt, per-call timings and request checkpoint are retained in `unabated-three-leg-audit/pilot-results.json`. Polling was bounded to 25 polls and a 60-second polling deadline. A local syntax error was corrected before the process made any network request; the captured ledger contains exactly one generation POST.','','## Matching results','',table(['Player','Player / game / kickoff / market / threshold / period / book','Requested direction','Returned direction','Returned odds'],[[c['player'],'All match' if all(c['checks'].values()) else json.dumps(c['checks']),c['requestedSide'],c['direction'],c['returnedOdds']] for c in checks]),'Matching compares all returned selections against original values, including exact numeric thresholds and scheduled kickoff. LAR/LA is treated as the reviewed Rams team-label alias. Three matched legs alone do not establish success. Missing structured direction is explicitly unresolved; the actual regional sportsbook slip and combined-parlay acceptance require manual verification.','','## Generated link','']
if tracked:
 lines += [f'Original returned Gambly URL: {url}','',f'[Open Complete Parlay in FanDuel]({tracked})','',tracked,'','The requested `utm_campaign=downanddistance` was added through URL query parsing, preserving the original generated path and any existing parameters. No substitute FanDuel URL was constructed. This verifies parameter presence only, not credited click attribution. The original URL is retained alongside the attributed URL.']
else:
 lines += ['No candidate link offered because the result failed complete matching.',json.dumps(result or t['requests'][-1].get('response',{}))]
seconds=t.get('elapsedMs',0)/1000
lines += ['','## Performance','',f"This request completed in {seconds:.3f} seconds versus the previous single-leg pilot average of 9.608 seconds: {seconds-9.608:+.3f} seconds ({(seconds/9.608-1)*100:+.1f}%). This describes one observation; it cannot establish a material systematic multi-leg slowdown or support capacity/scalability extrapolation.",'','## FanDuel verification','', '**Pending manual verification.** The user will open the link in their existing Iowa account. No browser opening, login, location workarounds or wagers were performed by this test. Confirm all three players, games, markets, directions and thresholds, then that FanDuel combines them into one three-leg parlay with combined odds. Update this report only after the user provides confirmation or a screenshot. One confirmed combination would establish feasibility only for that combination.','','## Preserved configuration','', '`ODDS_PROVIDER=sportsgameodds` · `ENABLE_UNABATED_INGESTION=false` · `ENABLE_FANDUEL_BETSLIP=false`. Local configuration was checked, not changed. Production records/configuration, ingestion, Lab Score and Parlay Lab UI were untouched. No transfer button was enabled.','','Diagnostics: `scripts/prepare-unabated-three-leg-test.ts`, `scripts/generate-unabated-three-leg-test.mjs`, and the offline `scripts/report-unabated-three-leg-test.py`. Saved checkpoints prevent the generation script from resubmitting this test.','']
Path('reports/unabated-three-leg-fanduel-test.md').write_text('\n'.join(lines))
print(json.dumps(summary))
