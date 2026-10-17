"""Offline report from the frozen local snapshot and bounded API pilot; no network or DB writes."""
import json
import math
import statistics
from pathlib import Path
from datetime import datetime

root = Path('reports/unabated-fanduel-audit')
baseline = json.loads((root / 'baseline.json').read_text())
sample = json.loads((root / 'sample.json').read_text())
pilot = json.loads((root / 'pilot-results.json').read_text())
assert pilot.get('finishedAt'), 'Wait for the bounded pilot to finish'
s = baseline['summary']
tests = pilot['tests']
assert len(tests) == 10
assert [t['pick']['id'] for t in tests] == [p['id'] for p in sample['pilot']]
labels = {'RECEIVING_YARDS': 'Receiving Yards', 'RECEIVING_LONGEST_RECEPTION': 'Longest Reception', 'RUSHING_YARDS': 'Rushing Yards', 'RECEPTIONS': 'Receptions', 'PASSING_YARDS': 'Passing Yards', 'PASSING_RUSHING_YARDS': 'Passing and Rushing Yards', 'RUSHING_ATTEMPTS': 'Rushing Attempts'}
aliases = {'LAR': 'LA', 'JAX': 'JAC'}
validations = []
for t in tests:
    p = t['pick']
    slip = next((b for b in t.get('result', {}).get('betSlips', []) if b['book'] == 'FanDuel'), None)
    bets = slip.get('betslipBets', []) if slip else []
    b = bets[0] if len(bets) == 1 else {}
    parts = b.get('event', '').split(' @ ')
    checks = {
        'singleLegCounts': bool(slip and slip.get('legsRequested') == 1 and slip.get('legsMatched') == 1 and len(bets) == 1),
        'playerName': b.get('player', '').casefold() == p['playerName'].casefold(),
        'eventTeamLabels': len(parts) == 2 and all(part.split()[-1] in {code, aliases.get(code)} for part, code in zip(parts, [p['awayTeamId'], p['homeTeamId']])),
        'kickoff': b.get('metadata', {}).get('timestamp') is not None and datetime.fromisoformat(b['metadata']['timestamp']) == datetime.fromisoformat(p['kickoffAt'].replace('Z', '+00:00')),
        'marketLabel': b.get('betType', '').strip() == labels.get(p['marketType']),
        'threshold': b.get('odds', {}).get('points') is not None and float(b['odds']['points']) == p['line'],
        'period': b.get('periodType') == 'Full Game' and b.get('isLive') is False,
        'sportsbook': b.get('deepLink', {}).get('sportsbook') == 'FanDuel',
        'linkShape': b.get('deepLink', {}).get('url', '').startswith('https://gambly.com/deeplink/deeplink-cache-v2-') and b.get('deepLink', {}).get('url') == (slip or {}).get('deepLink'),
    }
    # These observed responses lack independent direction, identity mapping, freshness and region evidence.
    # Do not promote matching text/points or a provider match count to verified coverage.
    missing = ['independently resolved player/event identity', 'Over/Under direction', 'current sportsbook availability', 'supported region', 'actual sportsbook slip contents']
    assert not any(k in b for k in ['direction', 'side', 'outcome']), 'Review new direction evidence before reporting'
    assert not b.get('metadata', {}).get('additionalInfo'), 'Review new metadata before reporting'
    outcome = 'Unverified candidate' if all(checks.values()) else 'Mismatch / unavailable'
    validations.append({'selectionId': p['id'], 'player': p['playerName'], 'reportedMatchCount': (slip or {}).get('legsMatched', 0), 'offerId': b.get('id'), 'checks': checks, 'missingEvidence': missing, 'outcome': outcome, 'verified': False, 'returnedOdds': b.get('odds', {}).get('value'), 'returnedThreshold': b.get('odds', {}).get('points')})
(root / 'validation.json').write_text(json.dumps(validations, indent=2) + '\n')
for t,v in zip(tests,validations): t['validation'] = v
calls = [r for t in tests for r in t['requests']]
posts = sum(r['method'] == 'POST' for r in calls)
polls = len(calls) - posts
elapsed = sorted(t['elapsedMs'] / 1000 for t in tests if t['outcome'] == 'Complete')
candidates = sum(v['outcome'] == 'Unverified candidate' for v in validations)
reported = sum(v['reportedMatchCount'] for v in validations)
errors = sum(t['outcome'] not in ('Complete', 'Timeout') for t in tests)
timeouts = sum(t['outcome'] == 'Timeout' for t in tests)
metrics = {'submissions': posts, 'statusPolls': polls, 'requests': len(calls), 'averageSeconds': statistics.mean(elapsed), 'medianSeconds': statistics.median(elapsed), 'p95SecondsNearestRank': elapsed[math.ceil(.95 * len(elapsed))-1], 'providerReportedMatches': reported, 'unverifiedCandidates': candidates, 'verifiedMatches': 0, 'errors': errors, 'timeouts': timeouts}
(root / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')

def table(headers, rows):
    return '| ' + ' | '.join(headers) + ' |\n| ' + ' | '.join(['---'] * len(headers)) + ' |\n' + '\n'.join('| ' + ' | '.join(str(v).replace('|', '/') for v in row) + ' |' for row in rows) + '\n'
def tested_rate(n): return '0/' + str(n) + ' (0%)' if n else 'Not tested'
def fmt(n): return f'{n:,}'
fd = [r for r in baseline['offers'] if r['sportsbook'] == 'FANDUEL']
lines = [
'# Unabated → FanDuel coverage audit',
'',
f"Snapshot: {s['generatedAt']}. Pilot: {pilot['startedAt']}–{pilot['finishedAt']}. Local PostgreSQL only. Free content partner; account quota remains unconfirmed by the user.",
'',
f"**Recommendation: continue evaluating the hybrid approach, but do not enable transfers.** All {reported} pilot selections received provider-reported FanDuel matches; {candidates} preserved the visible requested attributes. **Zero are independently verified**, because the responses omit direction and do not establish current regional availability or actual sportsbook slip contents. This is a validation gap, not evidence that FanDuel has zero market coverage.",
'',
'## Scope and baseline',
'',
f"Inventoried **{fmt(s['uniqueSelections'])} unique active upcoming selections** across {s['games']} games and {fmt(s['pricedOffers'])} bookmaker-priced offers. **{fmt(s['fanDuelSelections'])}** have FanDuel pricing; **{fmt(s['withoutFanDuel'])}** do not. Uniqueness uses the existing normalized market ID (event, player/entity, stat, period, side and threshold), not one count per sportsbook. Available means the stored price is marked available and the event is upcoming/unlocked; it is not a fresh confirmation from FanDuel.",
'',
'Every offer in `unabated-fanduel-audit/baseline.json` includes player/team (null where unresolved), event/kickoff, market/stat, period, side, threshold, book, odds, main/alternate/unknown classification, current computed Lab Score (null when unavailable), and odds update time. Lab Scores were read through the existing service without changing calculations. Main/alternate is book-specific using the stored main and alternate line metadata, with the existing alternate flag as fallback. Unknown is retained rather than guessed.',
'',
'Anytime touchdowns means full-game `touchdowns` with YES/no numeric line (or 0.5); first/last/period touchdowns and 2+/3+ totals remain Other. Categories include every period in the inventory; the pilot pool is full-game only.',
'',
'## Market coverage',
'',
'Exact-match percentages below describe only tested selections. Population coverage is unknown in every category; untested selections are neither successes nor failures.',
'',
]
rows=[]
for c in s['categories']:
    ts=[t for t in tests if t['pick']['category']==c['category']]
    rows.append([c['category'],fmt(c['total']),fmt(c['fanDuel']),fmt(c['withoutFanDuel']),len(ts),sum(t['validation']['reportedMatchCount'] for t in ts),tested_rate(len(ts))])
rows.append(['TOTAL',fmt(s['uniqueSelections']),fmt(s['fanDuelSelections']),fmt(s['withoutFanDuel']),len(tests),reported,tested_rate(len(tests))])
lines.append(table(['Category','DB unique','FanDuel priced','No FanDuel price','Pilot tested','Provider matches','Verified / tested'],rows))
lines += [f"Established verified mappings across the inventory: 0/{fmt(s['uniqueSelections'])}; across FanDuel-priced selections: 0/{fmt(s['fanDuelSelections'])}. These are **audit evidence counts**, not population estimates of provider capability. Only {len(tests)/s['fanDuelSelections']*100:.3f}% of FanDuel-priced selections were submitted.",'','## Standard, alternate and odds bands','']
lines.append(table(['FanDuel line classification','Inventory','Tested','Unverified candidates','Verified / tested'], [[x['type'],fmt(x['count']),len(ts := [t for t in tests if t['pick']['lineType']==x['type']]),sum(t['validation']['outcome']=='Unverified candidate' for t in ts),tested_rate(len(ts))] for x in s['lineTypes']]))
lines.append(table(['Alternate odds band','FanDuel inventory','Tested','Unverified candidates','Verified / tested'], [[x['band'],fmt(x['count']),len(ts := [t for t in tests if t['pick']['lineType']=='alternate' and t['pick']['oddsBand']==x['band']]),sum(t['validation']['outcome']=='Unverified candidate' for t in ts),tested_rate(len(ts))] for x in s['altBands']]))
lines += ['The -750 to -1000 band was not submitted. Matching alternates down to -1000 reliably is therefore **not established**. Below -1000 is counted for completeness and excluded from the test pool. Positive odds are reported separately.', '', '## Reproducible sampling and quota gate', '',f"Seed: `{sample['seed']}`. The saved sample contains {len(sample['sample'])} selections, including {sum(r['lineType']=='alternate' for r in sample['sample'])} explicit alternates, drawn from {fmt(s['eligiblePool'])} FanDuel full-game selections with named players and odds no shorter than -1000. {s['method']}",'', 'The remaining inventory is not in that eligible sample pool; this is not a census of all periods or all prices. The ten-selection pilot spans five standard and five alternate lines, both directions, varied games/players and high/low/unknown scores. Its diversity selection is not proportional, so its rate must not be extrapolated to the full database. The 200-selection sample remains unsubmitted beyond these ten.', '', 'Unabated documents Free access to generation/status, but the reviewed [access-tier documentation](https://docs.unabated.com/start/access-tiers) provides no generation quota, daily cap or traffic capacity guarantee. The user confirmed no account-specific quota is known. Following the requested gate, no additional generation requests or complete-parlay submissions were made.', '', '## Per-selection results', '']
lines.append(table(['Player / game','Requested market / selection','Class / DB odds / score','Returned line / odds','Result','Seconds / calls'],[[f"{t['pick']['playerName']} / {t['pick']['awayTeamId']} @ {t['pick']['homeTeamId']}",f"{labels.get(t['pick']['marketType'],t['pick']['marketType'])}: {t['pick']['side']} {t['pick']['line']}",f"{t['pick']['lineType']} / {t['pick']['odds']} / {t['pick']['labScore'] if t['pick']['labScore'] is not None else 'Unavailable'}",f"{t['validation']['returnedThreshold']} / {t['validation']['returnedOdds']}",t['validation']['outcome'],f"{t['elapsedMs']/1000:.3f} / {len(t['requests'])}"] for t in tests]))
lines += ['', 'The returned player names, team labels, kickoff times, market descriptions, periods and thresholds match the requests in this pilot. Jacksonville JAX/JAC and Los Angeles Rams LAR/LA were reviewed as team-label aliases. Matching labels do not establish independently resolved provider identity. Deshaun Watson returned -235 versus stored -245 at the same 174.5 threshold; Pat Freiermuth returned +114 versus stored +116 at 3.5. These are price differences, not threshold substitutions. Stored odds predate generation by several hours; this audit did not refresh prices.', '', '## Direction and failure analysis', '', 'All ten FanDuel results omit direction. Inspection covered every selection field, bet-type text, metadata (no `additionalInfo` was present), and individual link. Generated links use opaque cache identifiers; they do not expose an outcome. The [current OpenAPI contract](https://data.unabated.com/swagger/v1/swagger.json) has no required side field on `BetslipBet`; its optional metadata does not guarantee one. No documented direct generated-offer-ID-to-outcome resolver was found. Generic `/deeplink` expects current odds market-line IDs, which are not assumed interchangeable with generated offer IDs or SportsGameOdds identifiers.', '', 'Consequently, each visible match remains unverified. The returned match count and echoed request text cannot establish Over versus Under. Availability, region support, link lifetime and sportsbook population also lack independent evidence. A generated URL passing host/path checks is not proof that it opens the requested live offer.', '',f"In this pilot: {candidates} unverified candidates; {len(tests)-candidates} visible mismatches/unavailable results; {errors} lifecycle errors; {timeouts} timeouts. No FanDuel threshold substitutions were observed. Other sportsbooks sometimes returned different thresholds despite reporting a match; they were excluded from FanDuel coverage. Earlier diagnostics likewise found substitutions at other books. Do not use another book as a fallback without a fresh exact selection check.", '', 'Prior odds diagnostics are retained separately in `unabated-diagnostics.json`: NFL straight odds succeeded, while NFL/MLB props returned HTTP 200 with `success:false` and `Unexpected error while retrieving odds for the provided filter.` Those failures were not retried during this pilot. Text generation functioning independently supports continued hybrid evaluation, not a claim that the props odds endpoint has recovered.', '', '## Complete parlays and sportsbook acceptance', '', table(['Scenario','Planned legs','Submitted','Matched / independently verified','Complete populated slip / FanDuel acceptance'],[['Different-game props',3,'No—quota gate','Not measured','Not verified'],['Same-game props',3,'No—quota gate','Not measured','Not verified'],['Different-game alternates',3,'No—quota gate','Not measured','Not verified'],['Mixed standard/alternate',3,'No—quota gate','Not measured','Not verified']]), 'Prepared exact selections are retained in `parlay-plans.json`; refresh availability before any later submission. No parlay combination support is inferred from single-selection results. Earlier generic two-game moneyline deep-link diagnostics returned `full_support`, but were not a populated prop-parlay test. The previous account-example browser test reached FanDuel region/login screens; no complete slip was verified and no wager was placed. This pilot does not claim new browser or Android/iOS verification.', '', 'The documented SGP quote endpoints are Enterprise-only; they were not called with the Free key. Text generation being available to Free accounts does not itself prove acceptance of an SGP. All four scenarios still need an allowed live generation and actual sportsbook inspection once quota and direction verification are resolved.', '', '## API performance and scale', '', 'Measured client latency includes submission, network and two-second polling waits. One lifecycle ran at a time, with no POST retries, at most 25 polls and a 60-second polling deadline. Request intent and IDs were checkpointed; re-running the pilot skips existing selections. HTTP responses and sanitized bodies remain local in `pilot-results.json`.', '',table(['Metric','Observed'],[['API requests',len(calls)],['Generation submissions',posts],['Status polls',polls],['HTTP non-200 / transport failures',sum(r.get('httpStatus')!=200 for r in calls)],['Average completion seconds',f"{statistics.mean(elapsed):.3f}"],['Median completion seconds',f"{statistics.median(elapsed):.3f}"],['p95 completion seconds (nearest rank)',f"{elapsed[math.ceil(.95*len(elapsed))-1]:.3f}"],['Lifecycle error rate',f'{errors}/10 ({errors*10}%)'],['Timeout rate',f'{timeouts}/10 ({timeouts*10}%)'],['Independently verified match rate','0/10 (0%)'],['Unverified candidate rate',f'{candidates}/10 ({candidates*10}%)'],['Requests per returned candidate link',len(calls)/candidates if candidates else 'N/A'],['Requests per verified usable link','Undefined—zero verified usable links']]), 'These counts exclude previous diagnostics, public-document reads and local database work. The [generation guide](https://docs.unabated.com/guides/bet-slips) documents asynchronous completion and a bounded polling approach; the [five-second shared odds interval](https://docs.unabated.com/guides/errors-and-limits) is not a generation quota.', '', table(['Daily generations','POSTs','Estimated status polls','Estimated API calls'],[[fmt(n),fmt(n),fmt(round(n*polls/posts)),fmt(round(n*len(calls)/posts))] for n in [100,1000,10000]]), 'This is a linear illustration of the observed single-selection polling pattern, not a capacity forecast or measured parlay performance. Multi-leg latency, concurrency, retries and polling policy can change usage. Free-tier capacity and costs at all three volumes are **unknown**. Confirm submission/poll quotas, daily caps, concurrency policy and commercial terms before scaling.', '', '## Proposed cache and integration boundary', '', 'Keep SportsGameOdds ingestion, PostgreSQL normalization, Lab Score and My Parlay unchanged. Generate a complete slip on demand from the user’s current selections, rather than generate thousands of links during odds ingestion. Deduplicate concurrent requests for the same canonical slip and region, retain the request ID and poll that job instead of resubmitting.', '', 'Only after independent validation, a separate mapping cache could store provider/book/region, event ID plus kickoff, player ID, market/stat/subtype, period, direction, exact threshold, generated offer ID and independently resolved sportsbook market/selection IDs, verification evidence/time, source odds timestamp and provider expiry. Include every identity field and region in the key; do not reuse IDs across events or regions.', '', 'Cache mappings separately from prices and complete-slip URLs. Invalidate when event, availability, line, direction, region or provider identity changes; recheck current odds at transfer time. Invalidate any cached slip when any leg changes. Link expiration is undocumented here, so no durable lifetime is assumed; initially generate fresh complete slips and reuse only the current in-flight job. A mapping cache cannot replace whole-slip compatibility validation. Unverified evidence stays in local audit files, never production mapping tables.', '', '## Decision and next steps', '', 'The hybrid architecture is technically promising: the generation service finds the exact visible FanDuel lines without Unabated props odds. It is not ready for user transfers. Request an explicit outcome/direction field or documented authorized resolver, then validate current regional offers and actual complete sportsbook slips. Obtain quota confirmation before the remaining sample and four parlay scenarios.', '', 'The project targets remain provisional: ≥95% verified coverage is a strong candidate; 85–94% requires documented limitations; 70–84% supports only limited rollout; below 70% calls for alternatives. This pilot cannot estimate population coverage against those targets. Missing direction or complete-slip verification independently prevents enabling transfers.', '', 'Local configuration uses the repository’s actual identifier `ODDS_PROVIDER=sportsgameodds`, with `ENABLE_UNABATED_INGESTION=false` and `ENABLE_FANDUEL_BETSLIP=false`. No production data/configuration, existing prop records, scoring, UI or transfer buttons were changed in this audit. No API credentials are included in the artifacts.', '', 'Reproduce offline report: `python3 scripts/report-unabated-fanduel-audit.py`. Preparation: `node --import tsx scripts/prepare-unabated-fanduel-audit.ts` (local read-only DB). The pilot runner is capped at ten and skips recorded submissions; do not clear its evidence or expand it until quotas are confirmed.', '']
# Prepare slips without making generation requests. Use distinct players and games where requested.
def choose(pool, distinct_events=False):
    result=[]
    for p in pool:
        if any(x['playerId']==p['playerId'] or (distinct_events and x['eventId']==p['eventId']) for x in result): continue
        result.append(p)
        if len(result)==3: break
    assert len(result)==3
    return result
picks=sample['sample']
main=[p for p in picks if p['lineType']=='main']
alt=[p for p in picks if p['lineType']=='alternate']
groups = [[p for p in picks if p['eventId'] == eid] for eid in dict.fromkeys(p['eventId'] for p in picks)]
sgp = next(choose(group) for group in groups if len({p['playerId'] for p in group}) >= 3)
plans={'differentGame':choose(main,True),'sameGame':sgp,'alternate':choose(alt,True),'mixed':choose([main[0],*alt],True)}
(root/'parlay-plans.json').write_text(json.dumps({'status':'Not submitted: quota unconfirmed; direction unresolved','plans':plans},indent=2)+'\n')
Path('reports/unabated-fanduel-coverage.md').write_text('\n'.join(lines))
print(json.dumps(metrics))
