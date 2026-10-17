# NFL source research

Evidence captured 2026-10-17T03:36:07.278264+00:00. Isolated branch `poc/nfl-source-expansion`, base `5e1a6ec5`. Public publisher research and local tests only. No production/account/DB access, sends, deployment, paid services, or schedule changes. Production enablement, traffic, historical success, average volume and error rate are **UNKNOWN**.

**The 20-qualified-per-team / 640-qualified-assignment objective is NOT met.** There are 332 URL-backed source identities, 804 raw team assignments, 110 provisionally qualified unique candidates and 140 qualified team assignments. Raw assignment totals include shared national references; they are not qualified coverage. All 32 teams have documented gaps.

Discovery started with [Sharp Sources](https://sharpsources.com/sources), its [newsletter directory](https://sharpsources.com/newsletters/), [PFWA contacts](https://www.profootballwriters.org/about-the-pfwa/pfwa-contacts/), and [Unabated](https://www.unabated.com/post/best-nfl-twitter-follows). All 32 public team discovery pages were read, then primary publisher pages and their advertised feed links were checked directly. Additional independent sources were checked in `manual-candidates.json`. Directory inclusion alone never qualifies a source. PFWA corroborates chapter roles, not ingestion rights or current X activity. Older media guides/search results were not used to assert current affiliation.

Scoring is provisional and conservative: original reporting 0–25, reliability 0–25, team relevance 0–20, freshness 0–15, uniqueness 0–10, technical access 0–5. A current official feed earns 20/20/20/15/5/5 = 85; this is first-party announcement authority, not independent scrutiny. For other publications, a byline earns only 5 originality points; a named primary byline 10 accountability points within reliability (accuracy still unreviewed); associated team 20; recent primary metadata/feed 15; distinct non-aggregator identity 5; working feed 5 (page only 3). Thus a signed recent non-aggregator with a feed can reach 60 (Tier 3), not Tier 1. Aggregators receive no originality/uniqueness credit. Unknown evidence earns zero. A byline is weak evidence of authored content, not proof of original reporting or audited accuracy. Quality tier is separate from production trust/confidence and legal eligibility. These provisional qualifications require editorial review before production.

Feed verification means a public nonempty RSS/Atom response with recent dated items. It does not grant permission to republish a description, encoded article body, transcript or image. All rights statuses remain REVIEW_REQUIRED and all automated eligibility is false; Technically fetchable identities are reported separately below. Public-page extraction, newsletter subscription, YouTube API access, or X access is not enabled automatically.

| Team | Inventory | Qualified provisional | Technical RSS | Existing | New | Discovery only | Local X references | Qualified gap to 20 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARI | 25 | 3 | 7 | 15 | 10 | 18 | 3 | 17 |
| ATL | 26 | 4 | 9 | 15 | 11 | 17 | 3 | 16 |
| BAL | 27 | 5 | 10 | 15 | 12 | 17 | 3 | 15 |
| BUF | 26 | 6 | 11 | 15 | 11 | 15 | 3 | 14 |
| CAR | 22 | 4 | 8 | 15 | 7 | 14 | 2 | 16 |
| CHI | 27 | 4 | 9 | 15 | 12 | 18 | 3 | 16 |
| CIN | 23 | 5 | 9 | 15 | 8 | 14 | 2 | 15 |
| CLE | 24 | 5 | 10 | 15 | 9 | 14 | 2 | 15 |
| DAL | 29 | 7 | 11 | 15 | 14 | 18 | 4 | 13 |
| DEN | 26 | 4 | 8 | 15 | 11 | 18 | 4 | 16 |
| DET | 23 | 4 | 8 | 15 | 8 | 15 | 2 | 16 |
| GB | 28 | 6 | 11 | 15 | 13 | 17 | 3 | 14 |
| HOU | 22 | 3 | 8 | 15 | 7 | 14 | 1 | 17 |
| IND | 22 | 4 | 9 | 15 | 7 | 13 | 2 | 16 |
| JAX | 25 | 3 | 8 | 15 | 10 | 17 | 3 | 17 |
| KC | 54 | 5 | 14 | 45 | 9 | 40 | 3 | 15 |
| LAC | 22 | 3 | 7 | 15 | 7 | 15 | 2 | 17 |
| LAR | 24 | 5 | 9 | 15 | 9 | 15 | 2 | 15 |
| LV | 21 | 4 | 8 | 15 | 6 | 13 | 2 | 16 |
| MIA | 25 | 5 | 11 | 15 | 10 | 14 | 2 | 15 |
| MIN | 22 | 5 | 10 | 15 | 7 | 12 | 2 | 15 |
| NE | 21 | 3 | 7 | 15 | 6 | 14 | 2 | 17 |
| NO | 24 | 4 | 8 | 15 | 9 | 16 | 3 | 16 |
| NYG | 23 | 3 | 7 | 15 | 8 | 16 | 3 | 17 |
| NYJ | 25 | 4 | 8 | 15 | 10 | 17 | 2 | 16 |
| PHI | 26 | 4 | 8 | 15 | 11 | 18 | 4 | 16 |
| PIT | 24 | 6 | 11 | 15 | 9 | 13 | 2 | 14 |
| SEA | 23 | 4 | 8 | 15 | 8 | 15 | 2 | 16 |
| SF | 26 | 6 | 10 | 15 | 11 | 16 | 4 | 14 |
| TB | 24 | 3 | 9 | 15 | 9 | 15 | 3 | 17 |
| TEN | 22 | 4 | 9 | 15 | 7 | 13 | 3 | 16 |
| WAS | 23 | 5 | 10 | 15 | 8 | 13 | 3 | 15 |

## ARI

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Revenge of the Birds | [revengeofthebirds.com](https://www.revengeofthebirds.com/arizona-cardinals-news/95713/jeremiyah-love-ruled-out-for-los-angeles-rams-game-due-to-ankle-injury) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Raising Zona | [raisingzona.com](https://raisingzona.com/cardinals-right-call-sit-jeremiyah-love-rams?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| 12News (KPNX) Cardinals | [12news.com](https://www.12news.com/article/sports/local-sports/sell-the-team-billboards-aimed-at-cardinals-owner-go-up-after-fans-raise-thousands-of-dollars/75-9b55eeef-6b04-468d-a2b8-aea64926f238) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Johnny Venerable | [x.com](https://x.com/johnnyvenerable) | X | 20 / review | DIRECTORY_ONLY | False |
| Bo Brack | [x.com](https://x.com/bobrack) | X | 20 / review | DIRECTORY_ONLY | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Craig Grialou | [x.com](https://x.com/craigazsports) | X | 20 / review | DIRECTORY_ONLY | False |
| Arizona Cardinals official | [azcardinals.com](https://www.azcardinals.com/news/blitzing-budda-baker-loveless-in-l-a-and-friday-before-the-rams) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Arizona Sports Cardinals | [arizonasports.com](https://arizonasports.com/nfl/arizona-cardinals/roy-lopez-cardinals-defense-needs-to-play-the-full-60-minutes-to-have-success) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## ATL

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Zach Klein | [x.com](https://x.com/zachkleinwsb) | X | 20 / review | DIRECTORY_ONLY | False |
| Unresolved identity (@dorlandoajc) | [x.com](https://x.com/dorlandoajc) | X | 20 / review | DIRECTORY_ONLY | False |
| Atlanta Falcons official | [atlantafalcons.com](https://www.atlantafalcons.com/news/falcons-news-now-top-headlines-for-week-6-game-vs-bears) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Blogging Dirty | [bloggingdirty.com](https://bloggingdirty.com/samson-ebukam-has-the-falcons-to-thank-for-helping-ignite-his-redemption-arc-01m4trw8x6nh?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| 11Alive (WXIA) Falcons | [11alive.com](https://www.11alive.com/article/sports/nfl/atlanta-falcons/michael-penix-injury-update-atlanta-falcons/85-d76c08b6-5948-4857-8e7e-c5cd57349b4c) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Bird Box | [birdboxatl.substack.com](https://birdboxatl.substack.com/p/the-duality-of-man) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| SB Nation | [sbnation.com](https://www.sbnation.com/nfl/1132258/green-bay-packers-biggest-problem-fix-jordan-love-film-breakdown) | PUBLICATION | 50 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| The Falcoholic | [thefalcoholic.com](https://www.thefalcoholic.com/atlanta-falcons-analysis/97313/falcons-ravens-film-review-nfl-week-6-2026-atlantas-flaws-exposed-against-ravens-takes-with-treshon) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Marc Raimondi | [x.com](https://x.com/marcraimondi) | X | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## BAL

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Baltimore Ravens official | [baltimoreravens.com](https://www.baltimoreravens.com/news/cam-jurgens-concussion-debut-vega-ioane-tyler-huntley-josh-cuevas-2026) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Baltimore Beatdown | [baltimorebeatdown.com](https://www.baltimorebeatdown.com/baltimore-ravens-injuries/86536/ravens-rule-out-qb-lamar-jackson-c-cam-jurgens-for-week-6-vs-browns) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Ebony Bird | [ebonybird.com](https://ebonybird.com/lamar-jackson-headlines-list-of-baltimore-ravens-officially-ruled-out-for-week-6?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jamison Hensley | [x.com](https://x.com/jamisonhensley) | X | 20 / review | DIRECTORY_ONLY | False |
| Baltimore Film Breakdown | [baltimorefilmbreakdown.com](https://www.baltimorefilmbreakdown.com/p/film-room-preparing-for-denzel-boston) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeff Zrebiec | [x.com](https://x.com/jeffzrebiec) | X | 20 / review | DIRECTORY_ONLY | False |
| Jonas Shaffer | [x.com](https://x.com/jonas_shaffer) | X | 20 / review | DIRECTORY_ONLY | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| SB Nation | [sbnation.com](https://www.sbnation.com/nfl/1132258/green-bay-packers-biggest-problem-fix-jordan-love-film-breakdown) | PUBLICATION | 50 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Ravens in 5 | [gordonmcguinness.substack.com](https://gordonmcguinness.substack.com/p/ravens-at-browns-preview) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Russell Street Report | [russellstreetreport.com](https://russellstreetreport.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## BUF

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Buffalo Bills official | [buffalobills.com](https://www.buffalobills.com/news/buffalo-bills-injury-report-vs-raiders-week-6) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Matt Parrino | [x.com](https://x.com/mattparrino) | X | 20 / review | DIRECTORY_ONLY | False |
| Air Raid / Buffalo | [airraidbuffalo.substack.com](https://airraidbuffalo.substack.com/p/buffalo-bills-2026-prospect-big-board) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Joe Buscaglia | [x.com](https://x.com/joebuscaglia) | X | 20 / review | DIRECTORY_ONLY | False |
| BuffaLowDown | [buffalowdown.com](https://buffalowdown.com/bills-vs-raiders-final-week-6-injury-report-ed-oliver-dj-moore-questionable-01m51071x70a?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Syracuse.com Bills | [syracuse.com](https://www.syracuse.com/buffalo-bills/2026/10/buffalo-bills-have-massive-mismatch-against-raiders-ahead-of-week-6-showdown.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Herd Mentality | [herdmentality1960.substack.com](https://herdmentality1960.substack.com/p/buffalo-bills-vs-las-vegas-raiders) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Jay Skurski | [x.com](https://x.com/jayskurski) | X | 20 / review | DIRECTORY_ONLY | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Buffalo Rumblings | [buffalorumblings.com](https://www.buffalorumblings.com/buffalo-bills-injuries/143063/bills-vs-raiders-injury-designations-five-questionable-for-buffalo) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Buffalo News Bills | [buffalonews.com](https://buffalonews.com/sports/professional/nfl/bills/article_c967033e-d905-403e-a906-8fe93509c205.html) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Cover 1 | [cover1.net](https://www.cover1.net/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## CAR

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| WCNC Panthers | [wcnc.com](https://www.wcnc.com/article/sports/nfl/panthers/philadelphia-eagles-rule-out-quarterback-jalen-hurts-for-sundays-game-against-carolina-because-of-a-blood-clot/616-707a50c2-c944-471e-869a-556387b8cf89) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Carolina Panthers official | [panthers.com](https://www.panthers.com/news/how-to-watch-listen-and-follow-panthers-at-eagles-in-week-6) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Cat Scratch Reader | [catscratchreader.com](https://www.catscratchreader.com/carolina-panthers-depth-chart/61576/panthers-injury-report-transactions-week-6) | RSS | 60 / 3 | FEED_VERIFIED | True |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Panthers Pulse | [draftwithjay.substack.com](https://draftwithjay.substack.com/p/2027-nfl-draft-top-200-big-board) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Sheena Quick | [x.com](https://x.com/sheena_marie3) | X | 20 / review | DIRECTORY_ONLY | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Cat Crave | [catcrave.com](https://catcrave.com/jalen-hurts-ruled-out-against-carolina-panthers-blood-clot-diagnosis?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Joe Person | [x.com](https://x.com/josephperson) | X | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## CHI

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Chicago Sports Stuff | [chicagosportsstuff.substack.com](https://chicagosportsstuff.substack.com/p/chicago-bears-bold-predictions-nfl-e74) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Chicago Tribune Bears | [chicagotribune.com](https://www.chicagotribune.com/sports/chicago-bears/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Chicago Sun-Times Bears | [chicago.suntimes.com](https://chicago.suntimes.com/bears/2026/10/16/bears-list-qb-caleb-williams-as-questionable-vs-falcons-but-full-week-of-practice-points-toward-return) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Adam Jahns | [x.com](https://x.com/adamjahns) | X | 20 / review | DIRECTORY_ONLY | False |
| SB Nation | [sbnation.com](https://www.sbnation.com/nfl/1132258/green-bay-packers-biggest-problem-fix-jordan-love-film-breakdown) | PUBLICATION | 50 / review | FEED_VERIFIED | False |
| Dan Weiderer | [x.com](https://x.com/danwiederer) | X | 20 / review | DIRECTORY_ONLY | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Kevin Fishbain | [x.com](https://x.com/kfishbain) | X | 20 / review | DIRECTORY_ONLY | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Windy City Gridiron | [windycitygridiron.com](https://www.windycitygridiron.com/chicago-bears-news/125370/chicago-bears-news-caleb-williams-practices-speaks-about-injury) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Bear Goggles On | [beargoggleson.com](https://beargoggleson.com/ben-johnson-offers-vague-update-as-kyler-gordon-s-activation-window-nears-end?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Chicago Bears official | [chicagobears.com](https://www.chicagobears.com/news/bears-qb-caleb-williams-practices-in-full-but-game-status-still-uncertain) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## CIN

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| WCPO 9 Bengals | [wcpo.com](https://www.wcpo.com/sports/football/bengals/bengals-te-tanner-hudson-suffer-season-ending-pectoral-injury) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Charlie's Chalkboard | [charlieschalkboard.substack.com](https://charlieschalkboard.substack.com/p/film-deep-dive-whats-going-on-with) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Cincy Jungle | [cincyjungle.com](https://www.cincyjungle.com/cincinnati-bengals-discussion/202439/bye-week-awards-unsung-hero) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Paul Dehner Jr. | [x.com](https://x.com/pauldehnerjr) | X | 20 / review | DIRECTORY_ONLY | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Cincinnati Bengals official | [bengals.com](https://www.bengals.com/news/ja-marr-chase-bengals-best-catches-isaac-curtis-chad-johnson) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Ben Baby | [x.com](https://x.com/ben_baby) | X | 20 / review | DIRECTORY_ONLY | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Chris Rucker (Bengals) | [burrowsmilkman.substack.com](https://burrowsmilkman.substack.com/p/bengals-have-bounced-back-after-the) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Stripe Hype | [stripehype.com](https://stripehype.com/biggest-surprises-so-far-this-season-for-the-cincinnati-bengals?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## CLE

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| The Browns Cap | [thebrownscap.substack.com](https://thebrownscap.substack.com/p/week-6-preview-cleveland-browns-vs) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mary Kay Cabot | [x.com](https://x.com/marykaycabot) | X | 20 / review | DIRECTORY_ONLY | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Dawg Pound Daily | [dawgpounddaily.com](https://dawgpounddaily.com/mason-graham-s-practice-return-headlines-huge-browns-injury-turnaround-before-week-6-01m52njchk7q?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Cleveland.com Browns | [cleveland.com](https://www.cleveland.com/browns/2026/10/browns-wont-have-to-face-lamar-jackson-on-sunday-against-the-ravens-berea-report-video.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| SB Nation | [sbnation.com](https://www.sbnation.com/nfl/1132258/green-bay-packers-biggest-problem-fix-jordan-love-film-breakdown) | PUBLICATION | 50 / review | FEED_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Browns Film Breakdown | [brownsfilmbreakdown.com](https://www.brownsfilmbreakdown.com/p/the-opening-drive-1016-week-5-special) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Dawgs By Nature | [dawgsbynature.com](https://www.dawgsbynature.com/cleveland-browns-news/135243/jets-minkah-fitzpatrick-fined-for-hit-on-browns-kc-concepcion-but-he-wants-it-reduced) | RSS | 60 / 3 | FEED_VERIFIED | True |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Zac Jackson | [x.com](https://x.com/akronjackson) | X | 20 / review | DIRECTORY_ONLY | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Cleveland Browns official | [clevelandbrowns.com](https://www.clevelandbrowns.com/news/quinshon-judkins-questionable-for-week-6-vs-ravens-injury-report) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## DAL

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| The Blue Star Bulletin | [bluestarbulletin.substack.com](https://bluestarbulletin.substack.com/p/2027-nfl-draft-consensus-board-midseason) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Dallas Morning News Cowboys | [dallasnews.com](https://www.dallasnews.com/sports/cowboys/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| Inside The Star | [insidethestar.com](https://insidethestar.com/the-3-biggest-threats-to-the-cowboys-defense-in-week-6) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| SturmStack | [bobsturm.substack.com](https://bobsturm.substack.com/p/pregame-thoughts-wk6-the-green-bay) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Todd Archer | [x.com](https://x.com/toddarcher) | X | 20 / review | DIRECTORY_ONLY | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tim Cowlishaw | [x.com](https://x.com/calvinwatkins) | X | 20 / review | DIRECTORY_ONLY | False |
| Tim Cowlishaw | [x.com](https://x.com/davidmooredmn) | X | 20 / review | DIRECTORY_ONLY | False |
| WFAA Cowboys | [wfaa.com](https://www.wfaa.com/article/sports/nfl/cowboys/jerry-jones-home-tour-mansion-dallas-cowboys-owner-look-inside-fox-news/287-4d700aff-8474-4a0a-a5d0-8c9f5542230c) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| FishSportsCowboys | [fishsportscowboys.substack.com](https://fishsportscowboys.substack.com/p/cowboys-icon-troy-aikman-moving-jerry) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Tim Cowlishaw | [x.com](https://x.com/timcowlishaw) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Blogging The Boys | [bloggingtheboys.com](https://www.bloggingtheboys.com/dallas-cowboys-news/222754/joe-milton-eagles-roster) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| The Landry Hat | [thelandryhat.com](https://thelandryhat.com/jerry-jones-invites-more-cowboys-scrutiny-with-premature-christian-parker-reveal?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Dallas Cowboys official | [dallascowboys.com](https://www.dallascowboys.com/news/joe-milton-poached-from-cowboys-by-eagles-sets-stage-for-mnf) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## DEN

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Troy Renck | [x.com](https://x.com/troyrenck) | X | 20 / review | DIRECTORY_ONLY | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| FOX31 (KDVR) Broncos | [kdvr.com](https://kdvr.com/sports/denver-broncos/broncos-knock-off-defending-super-bowl-champion-seahawks-17-14-in-overtime/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Predominantly Orange | [predominantlyorange.com](https://predominantlyorange.com/the-broncos-week-6-win-just-cemented-the-team-into-super-bowl-contention?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Denver Post Broncos | [denverpost.com](https://www.denverpost.com/sports/denver-broncos/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Klis | [x.com](https://x.com/mikeklis) | X | 20 / review | DIRECTORY_ONLY | False |
| Denver Broncos official | [denverbroncos.com](https://www.denverbroncos.com/news/cover-4-broncos-knock-off-defending-champs-with-17-14-prime-time-win-over-seahawks) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mile High Report | [milehighreport.com](https://www.milehighreport.com/denver-broncos-news/189046/instant-reaction-broncos-upend-seahawks-in-overtime-thriller-on-thursday-night-football) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Chris Tomasson | [x.com](https://x.com/christomasson) | X | 20 / review | DIRECTORY_ONLY | False |
| Broncos in Context | [broncosincontext.substack.com](https://broncosincontext.substack.com/p/seahawks-broncos-post-game-reaction) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Andrew Mason | [x.com](https://x.com/masedenver) | X | 20 / review | DIRECTORY_ONLY | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## DET

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| MLive Lions | [mlive.com](https://www.mlive.com/lions/2026/10/detroit-lions-place-3-veteran-players-on-injured-reserve.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Detroit Football Network | [detroitfootball.net](https://www.detroitfootball.net/p/lions-shift-3-players-to-ir-reportedly) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Justin Rogers | [x.com](https://x.com/justin_rogers) | X | 20 / review | DIRECTORY_ONLY | False |
| Pride of Detroit | [prideofdetroit.com](https://www.prideofdetroit.com/detroit-lions-news/177179/report-detroit-lions-sign-veteran-returner-to-the-practice-squad) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Dave Birkett | [x.com](https://x.com/davebirkett) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Detroit Free Press Lions | [freep.com](https://www.freep.com/sports/lions/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| SideLion Report | [sidelionreport.com](https://sidelionreport.com/josh-jacobs-return-gives-lions-another-reason-worry-about-packers-week-7?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Detroit Football Journal | [detroitfootballjournal.com](https://www.detroitfootballjournal.com/p/detroit-lions-new-pass-rush-dominates) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Detroit Lions official | [detroitlions.com](https://www.detroitlions.com/news/breaking-down-the-detroit-lions-remaining-games-campbell-gibbs-branch) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## GB

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Total Packers | [totalpackers.com](https://totalpackers.com/2026/10/packers-nfcs-strongest-contenders-2026/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Acme Packing Company | [acmepackingcompany.com](https://www.acmepackingcompany.com/green-bay-packers-analysis/88192/packers-offensive-line-should-move-forward-without-aaron-banks) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Green Bay Packers official | [packers.com](https://www.packers.com/news/packers-list-five-questionable-rule-out-four-vs-cowboys-week-6-injury-report-2026) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Packers Talk | [packerstalk.com](https://packerstalk.com/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Rob Demovsky | [x.com](https://x.com/robdemovsky) | X | 20 / review | DIRECTORY_ONLY | False |
| The Packer Dispatch | [packerdispatch.com](https://www.packerdispatch.com/p/josh-jacobs-eligible-week-7-10-16) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Cheesehead TV | [cheeseheadtv.com](https://cheeseheadtv.com/blog/josh-jacobs-removed-from-commissioners-exempt-list-eligible-to-return-for-packers-in-week-7-555) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| SB Nation | [sbnation.com](https://www.sbnation.com/nfl/1132258/green-bay-packers-biggest-problem-fix-jordan-love-film-breakdown) | PUBLICATION | 50 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Tom Silverstein | [x.com](https://x.com/tomsilverstein) | X | 20 / review | DIRECTORY_ONLY | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Lombardi Ave | [lombardiave.com](https://lombardiave.com/josh-jacobs-removed-commissioner-exempt-list-what-means-packers?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| The Leap | [theleap.football](https://www.theleap.football/p/packers-using-13-personnel-with-purpose) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Matt Schneidman | [x.com](https://x.com/mattschneidman) | X | 20 / review | DIRECTORY_ONLY | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## HOU

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jonathan M. Alexander | [x.com](https://x.com/jonmalexander) | X | 20 / review | DIRECTORY_ONLY | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Houston Football | [houfootball.com](https://www.houfootball.com/p/texans-uninspiring-when-justifying) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Toro Times | [torotimes.com](https://torotimes.com/c-j-stroud-could-give-the-texans-the-nfl-s-1-passer-with-a-surge-versus-the-jaguars?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| KHOU 11 Texans | [khou.com](https://www.khou.com/article/sports/nfl/texans/texans-london-jaguars/285-b29de136-4e59-4c8b-a15f-67698753a59f) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Texans Wire | [texanswire.usatoday.com](https://texanswire.usatoday.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Houston Texans official | [houstontexans.com](https://www.houstontexans.com/news/know-your-foe-texans-vs-jaguars-week-6-preview-at-wembley-stadium) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Battle Red Blog | [battleredblog.com](https://www.battleredblog.com/houston-texans-odds/78261/texans-vs-jaguars-predictions-week-6-picks) | RSS | 60 / 3 | FEED_VERIFIED | True |

## IND

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Mike Chappell | [x.com](https://x.com/mchappell51) | X | 20 / review | DIRECTORY_ONLY | False |
| Horseshoe Heroes | [horseshoeheroes.com](https://horseshoeheroes.com/colts-releasing-darius-slayton-adds-growing-list-costly-mistakes?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Indianapolis Colts official | [colts.com](https://www.colts.com/news/colts-release-wide-receiver-darius-slayton) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Stampede Blue | [stampedeblue.com](https://www.stampedeblue.com/indianapolis-colts-news/128784/indianapolis-colts-cut-wide-receiver-darius-slayton) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Off the Bench with CP | [campowellotb.substack.com](https://campowellotb.substack.com/p/colts-survive-london-capitalize-on) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Colts Wire | [coltswire.usatoday.com](https://coltswire.usatoday.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| FOX59 Colts | [fox59.com](https://fox59.com/sports/colts/colts-release-wr-darius-slayton-weeks-after-initial-signing/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Stephen Holder | [x.com](https://x.com/holderstephen) | X | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## JAX

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Big Cat Country | [bigcatcountry.com](https://www.bigcatcountry.com/jacksonville-jaguars-analysis/90025/jags-texans-nfl-week-6-game-picks) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jacksonville Jaguars official | [jaguars.com](https://www.jaguars.com/news/friday-quick-hits-murray-ready-matiscik-brown-out-for-texans-vs-jaguars) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Demetrius Harvey | [x.com](https://x.com/demetrius82) | X | 20 / review | DIRECTORY_ONLY | False |
| First Coast News Jaguars | [firstcoastnews.com](https://www.firstcoastnews.com/article/sports/nfl/jacksonville-jaguars/thursday-night-football-jacksonville-jaguars-baltimore-ravens-watch-party/77-d4737094-789f-4a53-ab23-ebc9379872e5) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Hays Carlyon | [x.com](https://x.com/hayscarlyon) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| John Shipley | [x.com](https://x.com/_john_shipley) | X | 20 / review | DIRECTORY_ONLY | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Black and Teal | [blackandteal.com](https://blackandteal.com/jaguars-drop-enticing-eric-murray-update-in-final-injury-report-vs-texans-london-montaric-brown?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jaguars Wire | [jaguarswire.usatoday.com](https://jaguarswire.usatoday.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## KC

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Locked On Chiefs X | [x.com](https://x.com/LockedOnChiefs) | X | 20 / review | UNVERIFIED | False |
| RGR Football | [youtube.com](https://www.youtube.com/@RGR) | YOUTUBE | 20 / review | UNVERIFIED | False |
| How Bout Those Chiefs | [youtube.com](https://www.youtube.com/@howboutthosechiefs) | CREATOR | 20 / review | UNVERIFIED | False |
| RGR Football | [youtube.com](https://www.youtube.com/@RGRFootball) | CREATOR | 20 / review | UNVERIFIED | False |
| RGR Football X | [x.com](https://x.com/RGRFootball) | X | 20 / review | UNVERIFIED | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| How Bout Those Chiefs | [youtube.com](https://www.youtube.com/@hbtCHIEFS) | YOUTUBE | 20 / review | UNVERIFIED | False |
| Matt Derrick | [x.com](https://x.com/mattderrick) | LOCAL_BEAT | 20 / review | DIRECTORY_ONLY | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| All Chief'd Up YouTube | [youtube.com](https://www.youtube.com/@AllChiefsUp) | YOUTUBE | 20 / review | UNVERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Sports Radio 810 | [810whb.com](https://www.810whb.com/) | LOCAL_MEDIA | 28 / review | HTTP_REACHABLE | False |
| Arrowhead Addict X | [x.com](https://x.com/ArrowheadAddict) | X | 20 / review | UNVERIFIED | False |
| Arrowhead Pride | [arrowheadpride.com](https://www.arrowheadpride.com/kansas-city-chiefs-injuries/213181/chiefs-chargers-week-6-final-injury-report-rashee-rice-out) | LOCAL_MEDIA | 60 / 3 | FEED_VERIFIED | True |
| KC Sports Network | [youtube.com](https://www.youtube.com/@KCSportsNetwork) | CREATOR | 20 / review | UNVERIFIED | False |
| ChiefsTV | [youtube.com](https://www.youtube.com/@ChiefsTV) | YOUTUBE | 20 / review | UNVERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Chiefs Digest | [chiefsdigest.com](https://chiefsdigest.com/) | LOCAL_MEDIA | 45 / review | FEED_VERIFIED | False |
| Kansas City Chiefs official | [chiefs.com](https://www.chiefs.com/news/week-6-injury-report-chargers-vs-chiefs-2026) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| r/KansasCityChiefs | [reddit.com](https://www.reddit.com/r/KansasCityChiefs/) | COMMUNITY | 20 / review | UNVERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Kansas City Star Chiefs | [kansascity.com](https://www.kansascity.com/sports/nfl/kansas-city-chiefs/) | LOCAL_MEDIA | 28 / review | HTTP_REACHABLE | False |
| Heavy.com Chiefs | [heavy.com](https://heavy.com/sports/nfl/kansas-city-chiefs/) | WEB | 45 / review | FEED_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Chiefs Wire | [chiefswire.usatoday.com](https://chiefswire.usatoday.com/) | WEB | 20 / review | UNVERIFIED | False |
| Arrowhead Addict | [arrowheadaddict.com](https://arrowheadaddict.com/chiefs-rule-out-rashee-rice-josh-simmons-week-6-agaianst-chargers?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Kansas City Chiefs YouTube | [youtube.com](https://www.youtube.com/@KansasCityChiefs) | OFFICIAL | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Locked On Chiefs YouTube | [youtube.com](https://www.youtube.com/@LockedOnChiefs) | YOUTUBE | 20 / review | UNVERIFIED | False |
| Ed Easton Jr. | [x.com](https://x.com/edeastonjr) | X | 20 / review | DIRECTORY_ONLY | False |
| All Chief'd Up | [youtube.com](https://www.youtube.com/@AllChiefdUp) | YOUTUBE | 20 / review | UNVERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| FOX4 (WDAF) Chiefs | [fox4kc.com](https://fox4kc.com/sports/chiefs/chiefs-rashee-rice-josh-simmons-out-sunday-vs-chargers/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Kansas City Chiefs | [x.com](https://x.com/Chiefs) | OFFICIAL | 20 / review | UNVERIFIED | False |
| Arrowhead Pride X | [x.com](https://x.com/ArrowheadPride) | X | 20 / review | UNVERIFIED | False |
| 96.5 The Fan | [audacy.com](https://www.audacy.com/965thefan) | LOCAL_MEDIA | 45 / review | FEED_VERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| The KCSN Chiefs Newsletter | [kcsn.com](https://www.kcsn.com/p/kcsn-weekly-chiefs-gear-up-for-the) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| How Bout Those Chiefs X | [x.com](https://x.com/HBTCHIEFS) | X | 20 / review | UNVERIFIED | False |
| Matt McMullen | [x.com](https://x.com/KCChiefsMatt) | OFFICIAL | 20 / review | UNVERIFIED | False |
| Yahoo Sports X | [x.com](https://x.com/YahooSports) | X | 20 / review | UNVERIFIED | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| The Chief in the North Newsletter | [mnchiefsfan.substack.com](https://mnchiefsfan.substack.com/p/nine-tweaks-the-chiefs-should-consider) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| KSHB 41 | [kshb.com](https://www.kshb.com/sports/football/chiefs) | LOCAL_MEDIA | 45 / review | FEED_VERIFIED | False |
| All Chief'd Up X | [x.com](https://x.com/AllChiefsUp) | X | 20 / review | UNVERIFIED | False |
| Arrowhead Addict Podcast | [youtube.com](https://www.youtube.com/@ArrowheadAddictPodcast) | YOUTUBE | 20 / review | UNVERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Nate Taylor | [x.com](https://x.com/bynatetaylor) | X | 20 / review | DIRECTORY_ONLY | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Chiefs PR | [x.com](https://x.com/ChiefsPR) | OFFICIAL | 20 / review | UNVERIFIED | False |

## LAC

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Kris Rhim | [x.com](https://x.com/krisrhim1) | X | 20 / review | DIRECTORY_ONLY | False |
| Bolts From The Blue | [boltsfromtheblue.com](https://www.boltsfromtheblue.com/los-angeles-chargers-injuries/66341/chargers-injury-report-derwin-james-ladd-mcconkey-quentin-johnston) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| StormCloud | [stormcloud.blog](https://stormcloud.blog/the-impossible-road-test-chargers-vs-chiefs-week-6-preview/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Bolt Beat | [boltbeat.com](https://boltbeat.com/chargers-need-to-take-a-long-look-in-the-mirror-before-moving-on-from-donte-jackson?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Daniel Popper | [x.com](https://x.com/danielrpopper) | X | 20 / review | DIRECTORY_ONLY | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Los Angeles Chargers official | [chargers.com](https://www.chargers.com/news/chiefs-game-preview-week-6-jim-harbaugh) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Chargers Wire | [chargerswire.usatoday.com](https://chargerswire.usatoday.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## LAR

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Ramblin' Fan | [ramblinfan.com](https://ramblinfan.com/rams-spent-too-long-wrong-side-broncos-seahawks-week-6-finish?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Turf Show Times | [turfshowtimes.com](https://www.turfshowtimes.com/los-angeles-rams-odds/152165/rams-reacts-mcvay-fanduel-special-teams) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Gary Klein | [x.com](https://x.com/latimesklein) | X | 20 / review | DIRECTORY_ONLY | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Rams Wire | [theramswire.usatoday.com](https://theramswire.usatoday.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| 1st & Tuna's Substack | [1standtuna.substack.com](https://1standtuna.substack.com/p/mcvays-trending-comments-about-australia) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Los Angeles Rams official | [therams.com](https://www.therams.com/news/injury-to-interception-jaylen-watson-pushes-through-dislocated-shoulder-to-record-first-interception-as-a-ram) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| On The Rampage (Substack) | [losangelesrams.substack.com](https://losangelesrams.substack.com/p/the-rams-put-the-special-in-special) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Jourdan Rodrigue | [x.com](https://x.com/jourdanrodrigue) | X | 20 / review | DIRECTORY_ONLY | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## LV

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Sam Gordon | [x.com](https://x.com/bysamgordon) | X | 20 / review | DIRECTORY_ONLY | False |
| Silver and Black Pride | [silverandblackpride.com](https://www.silverandblackpride.com/las-vegas-raiders-analysis/142994/raiders-bills-week-6-preview) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Sam Warren | [x.com](https://x.com/samwarren83) | X | 20 / review | DIRECTORY_ONLY | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Las Vegas Review-Journal Raiders | [reviewjournal.com](https://www.reviewjournal.com/sports/raiders/jalen-nailor-focused-on-winning-returning-to-raiders-receiving-corps-3901244/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Raiders Beat | [raidersbeat.com](https://www.raidersbeat.com/jeanty-draws-dreaded-trent-richardson-comp/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Just Blog Baby | [justblogbaby.com](https://justblogbaby.com/las-vegas-raiders-week-6-nfl-scouting-list-to-improve-their-roster-darnell-mooney-01m4s5cvnaq3?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Las Vegas Raiders official | [raiders.com](https://www.raiders.com/news/las-vegas-raiders-buffalo-bills-week-6-injury-report-2026) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Raiders Wire | [raiderswire.usatoday.com](https://raiderswire.usatoday.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |

## MIA

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| WSVN 7 Dolphins | [wsvn.com](https://wsvn.com/sports/miami-dolphins/miami-dolphins-rookie-successes/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Phin Phanatic | [phinphanatic.com](https://phinphanatic.com/troy-aikman-s-miami-dolphins-consulting-contract-quietly-comes-to-an-end-01m534c69w0z?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| DolphinsTalk | [dolphinstalk.com](https://dolphinstalk.com/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| No Name Dolphins | [backsidedig.substack.com](https://backsidedig.substack.com/p/how-can-the-miami-dolphins-learn) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Miami Dolphins official | [miamidolphins.com](https://www.miamidolphins.com/news/fins-weekly-bye-week-check-in) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Miami Herald Dolphins | [miamiherald.com](https://www.miamiherald.com/sports/nfl/miami-dolphins/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| The Phinsider | [thephinsider.com](https://www.thephinsider.com/miami-dolphins-news/123824/miami-dolphins-news-updates-jeremiah-smith-2027-nfl-draft-prospect-kenneth-grant-reasons-for-optimism) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Touchdown, Miami! | [touchdownmiami.substack.com](https://touchdownmiami.substack.com/p/grading-the-tape-miami-dolphins-2026-310) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Joe Schad | [x.com](https://x.com/schadjoe) | X | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| David Furones | [x.com](https://x.com/davidfurones_) | X | 20 / review | DIRECTORY_ONLY | False |

## MIN

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Daily Norseman | [dailynorseman.com](https://www.dailynorseman.com/minnesota-vikings-discussion-chat-message-board/100445/vikes-views-who-ya-got-bye-week-edition) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Vikings Territory | [vikingsterritory.com](https://vikingsterritory.com/2026/news/top_news/grab-popcorn-vikings-qb1) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Minnesota Vikings official | [vikings.com](https://www.vikings.com/news/longform/adrian-peterson-epic-football-journey-minnesota-legacy) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Lindsey Young | [x.com](https://x.com/lindseymnsports) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| The Viking Age | [thevikingage.com](https://thevikingage.com/new-york-giants-suggest-jj-mccarthy-role-could-bigger-minnesota-vikings?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Purple Insider | [purpleinsider.football](https://www.purpleinsider.football/p/friday-mailbag-time-to-pick-up-the) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Arif Hasan | [x.com](https://x.com/arifhasannfl) | X | 20 / review | DIRECTORY_ONLY | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Judd Zulgad's Substack | [juddzulgad.substack.com](https://juddzulgad.substack.com/p/these-wolves-might-do-less-pouting) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |

## NE

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| MassLive Patriots | [masslive.com](https://www.masslive.com/patriots/2026/10/how-much-will-aj-browns-return-help-against-the-nfls-top-defenses-karen-guregian.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| New England Patriots official | [patriots.com](https://www.patriots.com/news/injury-report-analysis-christian-gonzalez-expected-to-play-a-j-brown-officially-questionable-for-sunday-s-game-vs-jets) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Phil Perry | [x.com](https://x.com/philaperry) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Pats Pulpit | [patspulpit.com](https://www.patspulpit.com/new-england-patriots-news/140813/aj-brown-fresh-juice-patriots-offense-josh-mcdaniels) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Musket Fire | [musketfire.com](https://musketfire.com/a-j-brown-keeps-the-patriots-and-jets-guessing-about-possible-week-6-return-01m50f75x3tw?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Mike Reiss | [x.com](https://x.com/mikereiss) | X | 20 / review | DIRECTORY_ONLY | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## NO

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Saints on Sports View 360 | [saints360.substack.com](https://saints360.substack.com/p/gayle-benson-put-the-saints-on-notice) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Katherine Terrell | [x.com](https://x.com/kat_terrell) | X | 20 / review | DIRECTORY_ONLY | False |
| WWL-TV Saints | [wwltv.com](https://www.wwltv.com/article/sports/nfl/saints/what-saints-fans-heading-to-paris-need-to-know-about-frances-travel-advisory/289-f89d6a46-fcce-4dd4-9a75-0f17eb0e1f68) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| NewOrleans.Football | [neworleans.football](https://www.neworleans.football/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| Who Dat Dish | [whodatdish.com](https://whodatdish.com/jameis-winston-experience-gives-saints-defense-the-perfect-chance-bounce-back-01m50ghc6qpd?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Mike Triplett | [x.com](https://x.com/miketriplett) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| New Orleans Saints official | [neworleanssaints.com](https://www.neworleanssaints.com/news/former-new-orleans-saints-quarterback-jameis-winston-helping-to-energize-the-giants) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Luke Johnson | [x.com](https://x.com/bylukejohnson) | X | 20 / review | DIRECTORY_ONLY | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Canal Street Chronicles | [canalstreetchronicles.com](https://www.canalstreetchronicles.com/new-orleans-saints-discussion/116578/csc-reacts-results-can-the-saints-turn-things-around-and-save-the-season) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## NYG

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| NJ.com Giants | [nj.com](https://www.nj.com/eagles/2026/10/eagles-sign-ex-cowboys-qb-as-jalen-hurts-could-face-extended-absence.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Big Blue View | [bigblueview.com](https://www.bigblueview.com/new-york-giants-news/175978/giants-dc-dennard-wilson-we-like-playing-with-a-chip-on-our-shoulder) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| New York Post Giants | [nypost.com](https://nypost.com/2026/10/16/sports/jets-getting-much-needed-offensive-boost-with-omar-cooper-jr-kenyon-sadiq-returning/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Giants Wire | [giantswire.usatoday.com](https://giantswire.usatoday.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Ryan Dunleavey | [x.com](https://x.com/rydunleavy) | X | 20 / review | DIRECTORY_ONLY | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| New York Giants official | [giants.com](https://www.giants.com/news/week-6-tracker-latest-news-notes-roster-moves-new-orleans-saints-nfl) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Paul Schwartz | [x.com](https://x.com/nypost_schwartz) | X | 20 / review | DIRECTORY_ONLY | False |
| GMEN HQ | [gmenhq.com](https://gmenhq.com/new-york-giants-fans-kayvon-thibodeaux-defense-ignores-far-greater-concern?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Dan Duggan | [x.com](https://x.com/dduggan21) | X | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## NYJ

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| NJ.com Giants | [nj.com](https://www.nj.com/eagles/2026/10/eagles-sign-ex-cowboys-qb-as-jalen-hurts-could-face-extended-absence.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| New York Jets official | [newyorkjets.com](https://www.newyorkjets.com/news/what-is-the-recipe-for-a-jets-win-against-new-england-patriots-10-16-2026) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| New York Post Giants | [nypost.com](https://nypost.com/2026/10/16/sports/jets-getting-much-needed-offensive-boost-with-omar-cooper-jr-kenyon-sadiq-returning/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Rich Cimini | [x.com](https://x.com/richcimini) | X | 20 / review | DIRECTORY_ONLY | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Brian Costello | [x.com](https://x.com/briancoz) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| JetNation | [jetnation.com](https://www.jetnation.com/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Gang Green Nation | [ganggreennation.com](https://www.ganggreennation.com/new-york-jets-injuries/97644/jets-pass-catchers-are-getting-healthy) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jets X-Factor | [jetsxfactor.com](https://jetsxfactor.com/) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| The Jets Way | [jetsway.substack.com](https://jetsway.substack.com/p/new-england-patriots-the-preview) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| The Jet Press | [thejetpress.com](https://thejetpress.com/d-angelo-ponds-wasnt-familiar-with-aaron-glenn-game-before-getting-picked-by-jets-01m52wb0955g?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## PHI

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| NJ.com Giants | [nj.com](https://www.nj.com/eagles/2026/10/eagles-sign-ex-cowboys-qb-as-jalen-hurts-could-face-extended-absence.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Inside the Iggles | [insidetheiggles.com](https://insidetheiggles.com/eagles-signing-joe-milton-kills-two-birds-with-one-stone-in-the-best-way?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Jeff McLane | [x.com](https://x.com/jeff_mclane) | X | 20 / review | DIRECTORY_ONLY | False |
| Zach Berman | [x.com](https://x.com/zberm) | X | 20 / review | DIRECTORY_ONLY | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Philadelphia Eagles official | [philadelphiaeagles.com](https://www.philadelphiaeagles.com/news/statement-from-the-philadelphia-eagles-on-qb-jalen-hurts) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Bleeding Green Nation | [bleedinggreennation.com](https://www.bleedinggreennation.com/philadelphia-eagles-analysis/187021/eagles-film-preview-scouting-the-panthers-offense) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jimmy Kempski | [x.com](https://x.com/jimmykempski) | X | 20 / review | DIRECTORY_ONLY | False |
| PhillyVoice Eagles | [phillyvoice.com](https://www.phillyvoice.com/staff-contributors/jimmy-kempski/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Brooks Kubena | [x.com](https://x.com/bkubena) | X | 20 / review | DIRECTORY_ONLY | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Burds of a Feather | [burdsofafeather.com](https://www.burdsofafeather.com/p/there-is-no-problem-the-philadelphia) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## PIT

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Pittsburgh Steelers official | [steelers.com](https://www.steelers.com/news/week-6-blog-time-to-start-stacking) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Dale Lolley | [x.com](https://x.com/dlolley_pgh) | X | 20 / review | DIRECTORY_ONLY | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Smitten With Sports | [zacharysmithpgh.substack.com](https://zacharysmithpgh.substack.com/p/all-aboard-the-jay-train) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| PennLive Steelers | [pennlive.com](https://www.pennlive.com/steelers/2026/10/pittsburgh-steelers-star-wide-receiver-added-to-injury-report-as-room-thins-out.html) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Audibles & Analytics | [jonledyard.substack.com](https://jonledyard.substack.com/p/tapes-and-takes-week-5-david-baileys) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Mark Kaboly | [x.com](https://x.com/markkaboly) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Steelers Now | [steelersnow.com](https://steelersnow.com/about/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Behind the Steel Curtain | [behindthesteelcurtain.com](https://www.behindthesteelcurtain.com/pittsburgh-steelers-discussion/176448/friday-night-open-thread-spooky-season) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Still Curtain | [stillcurtain.com](https://stillcurtain.com/keeanu-benton-s-injury-puts-pittsburgh-steelers-defense-at-risk-vs-buccaneers-01m52fp2j0cv?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Steelers Depot | [steelersdepot.com](https://steelersdepot.com/2026/10/depot-after-dark-texas-basketball-hc-likes-steelers-nfl-brothers-ranked-freiermuth-gives-kids-backpacks/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## SEA

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Bob Condotta | [x.com](https://x.com/bcondotta) | X | 20 / review | DIRECTORY_ONLY | False |
| Field Gulls | [fieldgulls.com](https://www.fieldgulls.com/seattle-seahawks-news/177651/seahawks-mike-macdonald-sticking-with-sam-darnold-quarterback-chiefs) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Seattle Seahawks official | [seahawks.com](https://www.seahawks.com/news/seahawks-have-a-lot-of-faith-in-sam-darnold-other-things-from-mike-macdonald-s-friday-press-conference) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Seaside Joe | [seasidejoe.com](https://www.seasidejoe.com/p/seahawks-offseason-review-5-moves) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| 12th Man Rising | [12thmanrising.com](https://12thmanrising.com/richard-sherman-wont-be-hugging-sam-darnold-after-seahawks-week-6-disaster?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Hawk Blogger | [hawkblogger.com](https://www.hawkblogger.com/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Gregg Bell | [x.com](https://x.com/gbellseattle) | X | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## SF

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Vic Tafur | [x.com](https://x.com/victafur) | X | 20 / review | DIRECTORY_ONLY | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| San Francisco 49ers official | [49ers.com](https://www.49ers.com/news/5-things-to-know-49ers-week-6-matchup-vs-commanders-keena-turner-49ers-hof-induction) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| NBC Sports Bay Area 49ers | [nbcsportsbayarea.com](https://www.nbcsportsbayarea.com/nfl/san-francisco-49ers/christian-kirk-injury-recovery-update/1971469/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| David Lombardi | [x.com](https://x.com/lombardihimself) | X | 20 / review | DIRECTORY_ONLY | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Grant Cohn | [x.com](https://x.com/grantcohn) | X | 20 / review | DIRECTORY_ONLY | False |
| Eric Branch | [x.com](https://x.com/eric_branch) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| 49ers Webzone | [49erswebzone.com](https://www.49erswebzone.com/) | PUBLICATION | 28 / review | HTTP_REACHABLE | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| West Coast Football | [westcoastfootball.substack.com](https://westcoastfootball.substack.com/p/49ers-week-5-2026-win-over-seattle) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| 49ersHub | [49ershub.substack.com](https://49ershub.substack.com/p/49ers-sack-free-streak-ends) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Niners Nation | [ninersnation.com](https://www.ninersnation.com/san-francisco-49ers-injuries/164335/the-49ers-have-opened-christian-kirks-practice-window) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Niner Noise | [ninernoise.com](https://ninernoise.com/christian-kirks-practice-window-creates-49ers-position-battle?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| The Hutch Report | [hutchreport.substack.com](https://hutchreport.substack.com/p/49ers-week-5-trench-grades-the-duality) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## TB

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| CBS Sports | [cbssports.com](https://www.cbssports.com/nfl/news/seahawks-starting-qb-sam-darnold-mike-macdonald-2026/) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| PewterReport | [x.com](https://x.com/pewterreport) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Greg Auman | [x.com](https://x.com/gregauman) | X | 20 / review | DIRECTORY_ONLY | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| ProFootballTalk | [nbcsports.com](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/bucs-add-lb-josiah-trotter-to-injury-report-list-him-as-questionable) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tampa Bay Buccaneers official | [buccaneers.com](https://www.buccaneers.com/news/how-to-watch-buccaneers-vs-steelers-week-6-2026) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| The Pewter Plank | [thepewterplank.com](https://thepewterplank.com/tez-johnson-is-a-weapon-the-buccaneers-can-t-afford-to-ignore-vs-steelers?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| WFLA Buccaneers | [wfla.com](https://www.wfla.com/sports/buccaneers/bucs-bonus-can-tampa-bay-stack-wins-after-tnf-win-in-dallas/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Bucs Nation | [bucsnation.com](https://www.bucsnation.com/tampa-bay-buccaneers-injuries/69152/buccaneers-steelers-final-injury-report-for-week-6) | RSS | 60 / 3 | FEED_VERIFIED | True |
| WTSP 10 Buccaneers | [wtsp.com](https://www.wtsp.com/article/sports/nfl/buccaneers/how-to-watch-tampa-bay-buccaneers-pittsburgh-steelers-game-sunday-channel/67-5b37c09a-ca6f-49c4-a85f-fc0d57d69415) | PUBLICATION | 20 / review | DIRECTORY_ONLY | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Pewter Report | [pewterreport.com](https://www.pewterreport.com/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Rick Stroud | [x.com](https://x.com/nflstroud) | X | 20 / review | DIRECTORY_ONLY | False |

## TEN

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| Tennessee Titans official | [tennesseetitans.com](https://www.tennesseetitans.com/news/quick-hits-on-the-titans-from-friday-of-colts-week-x9332) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| WKRN News 2 Titans | [wkrn.com](https://www.wkrn.com/sports/tennessee-titans/titans-ceo-burke-nihill-talks-with-news-2/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| ESPN | [espn.com](https://www.espn.com/nfl/story/_/id/50198584/titans-ceo-apologizes-fans-supports-robert-saleh-gm) | PUBLICATION | 43 / review | PRIMARY_PAGE_VERIFIED | False |
| Titans of Rohan | [titansofrohan.substack.com](https://titansofrohan.substack.com/p/the-daboll-dilemma) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Turron Davenport | [x.com](https://x.com/tdavenport_nfl) | X | 20 / review | DIRECTORY_ONLY | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jim Wyatt | [x.com](https://x.com/jwyattsports) | X | 20 / review | DIRECTORY_ONLY | False |
| Music City Miracles | [musiccitymiracles.com](https://www.musiccitymiracles.com/tennessee-titans-odds/67271/titans-vs-colts-predictions-week-6-picks) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Titan Sized | [titansized.com](https://titansized.com/titans-hc-robert-saleh-challenges-cbs-to-do-something-they-haven-t-done-yet?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Terry McCormack | [x.com](https://x.com/terrymc13) | X | 20 / review | DIRECTORY_ONLY | False |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## WAS

| Source | Primary URL | Type | Score / tier | Verification | Qualified |
| --- | --- | --- | --- | --- | --- |
| John Keim | [x.com](https://x.com/john_keim) | X | 20 / review | DIRECTORY_ONLY | False |
| Ben Standig | [x.com](https://x.com/benstandig) | X | 20 / review | DIRECTORY_ONLY | False |
| Riggo's Rag | [riggosrag.com](https://riggosrag.com/stefon-diggs-edges-closer-giving-washington-commanders-stronger-hand-prime-time?utm_source=RSS) | RSS | 45 / review | FEED_VERIFIED | False |
| Jordan Schultz | [x.com](https://x.com/Schultz_Report) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yahoo Sports | [sports.yahoo.com](https://sports.yahoo.com/articles/49ers-injury-updates-kyle-juszczyk-232003289.html) | AGGREGATOR | 40 / review | FEED_VERIFIED | False |
| Jonathan Jones | [x.com](https://x.com/jjones9) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Washington Commanders official | [commanders.com](https://www.commanders.com/news/all-you-want-to-do-is-be-there-for-them-commanders-players-open-up-about-personal-connections-to-cancer-in-lead-up-to-crucial-catch-game) | OFFICIAL | 85 / 2 | FEED_VERIFIED | True |
| ‍Tashan Reed | [x.com](https://x.com/tashanreed) | X | 20 / review | DIRECTORY_ONLY | False |
| Dianna Russini | [x.com](https://x.com/DMRussini) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Hogs Haven | [hogshaven.com](https://www.hogshaven.com/washington-commanders-injuries/449541/commanders-49ers-friday-injury-report-stefon-diggs-bill-croskey-merritt-javon-kinlaw) | RSS | 60 / 3 | FEED_VERIFIED | True |
| Bullock's Film Room | [markbullock.substack.com](https://markbullock.substack.com/p/friday-q-and-a-91f) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Pro Football Rumors | [profootballrumors.com](https://www.profootballrumors.com/2026/10/seahawks-not-considering-qb-change) | RSS | 40 / review | FEED_VERIFIED | False |
| Sportsnet | [sportsnet.ca](https://www.sportsnet.ca/nfl/article/nfl-week-5-takeaways-commanders-settle-for-tie-after-costly-mistake/) | PUBLICATION | 58 / review | PRIMARY_PAGE_VERIFIED | False |
| Adam Schefter | [x.com](https://x.com/AdamSchefter) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Tom Pelissero | [x.com](https://x.com/TomPelissero) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Jeremy Fowler | [x.com](https://x.com/JFowlerESPN) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| NBC4 Washington Commanders | [nbcwashington.com](https://www.nbcwashington.com/news/local/daniels-commanders-try-to-put-tie-behind-them-as-unbeaten-49ers-loom/4168019/) | PUBLICATION | 45 / review | FEED_VERIFIED | False |
| A to Z Sports | [atozsports.com](https://atozsports.com/nfl/washington-commanders-news/washington-commanders-mock-trade-deadline-makes-splash-breece-hall-run-game-jayden-daniels/) | PUBLICATION | 60 / 3 | FEED_VERIFIED | True |
| Ian Rapoport | [x.com](https://x.com/RapSheet) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Yardbarker Chiefs | [yardbarker.com](https://www.yardbarker.com/nfl/articles/nfc_notes_jayden_daniels_kayvon_thibodeaux_commanders_cowboys_giants/s1_17039_44437475) | WEB | 40 / review | FEED_VERIFIED | False |
| Last Man Standig | [lastmanstandig.substack.com](https://lastmanstandig.substack.com/p/roster-reset-wizards-preview-30c) | NEWSLETTER | 60 / 3 | FEED_VERIFIED | True |
| Albert Breer | [x.com](https://x.com/AlbertBreer) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |
| Mike Garafolo | [x.com](https://x.com/MikeGarafolo) | NATIONAL_INSIDER | 20 / review | UNVERIFIED | False |

## Reporter research limitations

84 exact account URLs were recovered from the supplied directory. None is ingested. Each record in `reporters.json` includes name, handle, team, directory affiliation, specialty, activity (UNKNOWN), reliability (unestablished), ingestion feasibility and equivalent authorized URL (not yet resolved). Five qualified local X accounts per team are NOT demonstrated; the team table gives actual reference counts. A directory label points to a different handle in the Atlanta entry; it is flagged DIRECTORY_CONFLICT. Directory affiliations may have changed. Do not convert these references into trusted automated reporting or duplicate the same reporter via multiple profile paths. Primary biography verification and five-current-account coverage remain explicit research blockers.

Coverage still needs more original local reporting, independently reviewed film/cap specialists and resolved podcasts per team. Category quotas were not filled with anonymous channels, outdated accounts or repeated national feeds. The initial named starter publications were compared against monitoring profiles, direct discovery and manual checks. Missing direct verification remains a gap; it is not evidence that an outlet has closed.
