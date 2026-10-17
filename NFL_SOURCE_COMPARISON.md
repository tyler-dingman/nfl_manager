# NFL source comparison

Evidence captured 2026-10-17T03:36:07.278264+00:00. Isolated branch `poc/nfl-source-expansion`, base `5e1a6ec5`. Public publisher research and local tests only. No production/account/DB access, sends, deployment, paid services, or schedule changes. Production enablement, traffic, historical success, average volume and error rate are **UNKNOWN**.

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

Existing/New counts are URL-backed identities within each team, not additive totals across teams. Shared nationals are stored once. Configured active, configured inactive, one-shot failing, new provisional candidate and new discovery-only classifications are in `inventory.json`; none claims current production health. Existing functioning sources remain unchanged. Aliases group homepage/feed variants and exact social profiles; they do not merge two reporters merely because both use X or two newsletters because both use Substack. NBC editorial desks retain explicit path identities. Unresolved URLs/IDs stay unresolved.

## Existing alias groups

| Source | Existing IDs preserved | Action |
| --- | --- | --- |
| Baltimore Ravens official | BAL_RAVENS_OFFICIAL, BAL_OFFICIAL_NEWS | DUPLICATE research alias; preserve original IDs and history |
| How Bout Those Chiefs | HOW_BOUT_THOSE_CHIEFS, HOW_BOUT_CHIEFS_YT | DUPLICATE research alias; preserve original IDs and history |
| RGR Football | RGR_FOOTBALL, RGR_FOOTBALL_YT | DUPLICATE research alias; preserve original IDs and history |
| Yahoo Sports | YAHOO_SPORTS, YAHOO_SPORTS_WEB | DUPLICATE research alias; preserve original IDs and history |
| Arrowhead Pride | ARROWHEAD_PRIDE, ARROWHEAD_PRIDE_WEB | DUPLICATE research alias; preserve original IDs and history |
| Kansas City Chiefs official | KC_CHIEFS, CHIEFS_COM | DUPLICATE research alias; preserve original IDs and history |
| r/KansasCityChiefs | CHIEFS_REDDIT, CHIEFS_REDDIT_API | DUPLICATE research alias; preserve original IDs and history |
| Kansas City Star Chiefs | KC_STAR_CHIEFS, KC_STAR | DUPLICATE research alias; preserve original IDs and history |
| Kansas City Chiefs YouTube | CHIEFS_OFFICIAL_YOUTUBE, YT_KC_KANSAS_CITY_CHIEFS | DUPLICATE research alias; preserve original IDs and history |
| Locked On Chiefs YouTube | LOCKED_ON_CHIEFS_YT, YT_KC_LOCKED_ON_CHIEFS | DUPLICATE research alias; preserve original IDs and history |
| Adam Schefter | ADAM_SCHEFTER, ADAM_SCHEFTER_X | DUPLICATE research alias; preserve original IDs and history |
| Tom Pelissero | TOM_PELISSERO, TOM_PELISSERO_X | DUPLICATE research alias; preserve original IDs and history |
| Jeremy Fowler | JEREMY_FOWLER, JEREMY_FOWLER_X | DUPLICATE research alias; preserve original IDs and history |
| Kansas City Chiefs | KC_CHIEFS_SOCIAL, CHIEFS_OFFICIAL_X | DUPLICATE research alias; preserve original IDs and history |
| Ian Rapoport | IAN_RAPOPORT, IAN_RAPOPORT_X | DUPLICATE research alias; preserve original IDs and history |
| Mike Garafolo | MIKE_GARAFOLO, MIKE_GARAFOLO_X | DUPLICATE research alias; preserve original IDs and history |

## New locally registered disabled candidates

| Source ID | Source | Technical feed | Action |
| --- | --- | --- | --- |
| RESEARCH_0ADF01FDD5632157 | The Blue Star Bulletin | https://bluestarbulletin.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_0B8CE05EB2AD3A5C | Total Packers | https://totalpackers.com/feed/ | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_1B561372130BBC45 | Chicago Sports Stuff | https://chicagosportsstuff.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_1B983D85F297A7A3 | Inside The Star | https://insidethestar.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_1CC1F0E69BD45888 | Charlie's Chalkboard | https://charlieschalkboard.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_2CBAABA762DD26BB | SturmStack | https://bobsturm.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_3110687709C8F7D9 | The Browns Cap | https://thebrownscap.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_367BCEDEA52E42BF | Saints on Sports View 360 | https://saints360.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_37B17A65DC529FF7 | Smitten With Sports | https://zacharysmithpgh.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_3D97C1C07B6846AD | Houston Football | https://www.houfootball.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_40D91BFB0CAFAA3E | Detroit Football Network | https://www.detroitfootball.net/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_472D19CAF2951F1C | Air Raid / Buffalo | https://airraidbuffalo.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_48F2146AC5EB02A9 | Off the Bench with CP | https://campowellotb.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_52E7A96F503371E5 | Audibles & Analytics | https://jonledyard.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_5F4F8C9596A843CF | Bird Box | https://birdboxatl.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_5F8B79E0EF58C855 | No Name Dolphins | https://backsidedig.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_60E54F060C3E0191 | 1st & Tuna's Substack | https://1standtuna.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_6548BAE39476C54E | Baltimore Film Breakdown | https://www.baltimorefilmbreakdown.com/feed?sectionId=431414 | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_7175C746A3E9B526 | The Packer Dispatch | https://www.packerdispatch.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_76DC04F9C1C556D1 | FishSportsCowboys | https://fishsportscowboys.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_7BE148D0E2DF7743 | Titans of Rohan | https://titansofrohan.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_8659492D1F08701A | Herd Mentality | https://herdmentality1960.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_8BC6D0F7BCE1609B | Bullock's Film Room | https://markbullock.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_9172939C70ADFFDC | West Coast Football | https://westcoastfootball.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_9264A5EBB45AE4F5 | Touchdown, Miami! | https://touchdownmiami.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_9C12830395A5C946 | Seaside Joe | https://www.seasidejoe.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_9FED55C65507615B | 49ersHub | https://49ershub.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_A3CC42969701C86B | Broncos in Context | https://broncosincontext.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_AB0F19C7B5785611 | Raiders Beat | https://www.raidersbeat.com/comments/feed/ | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_B18F1519A13A8E43 | Purple Insider | https://www.purpleinsider.football/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_BA2C239166BE8B6C | Browns Film Breakdown | https://www.brownsfilmbreakdown.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_BF4C1A5BABF15955 | A to Z Sports | https://atozsports.com/feed/ | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_C1CF84BED0840D67 | Panthers Pulse | https://draftwithjay.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_C2457C7812F6B161 | The Jets Way | https://jetsway.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_C388C4D34131375A | The KCSN Chiefs Newsletter | https://www.kcsn.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_C59D65BDFBDFA351 | On The Rampage (Substack) | https://losangelesrams.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_CD51AC3A886DBC2A | The Hutch Report | https://hutchreport.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_D35CE983A258B037 | The Leap | https://www.theleap.football/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_D693691D5BDDDD08 | The Chief in the North Newsletter | https://mnchiefsfan.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_D99727F43FE5BFF6 | Ravens in 5 | https://gordonmcguinness.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_E186F8CFB99079E6 | Burds of a Feather | https://www.burdsofafeather.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_E25F3ED6E87F07D7 | Steelers Depot | https://steelersdepot.com/comments/feed/ | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_E4D550933996938F | Chris Rucker (Bengals) | https://burrowsmilkman.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_ECB35C8B48BB85C7 | Last Man Standig | https://lastmanstandig.substack.com/feed?sectionId=466125 | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_EEB2EEC13DEBA73A | Buffalo News Bills | https://buffalonews.com/search/?f=rss&t=article&c=sports/professional/nfl/bills&l=50&s=start_time&sd=desc | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
| RESEARCH_FADFE0A68F92082C | Judd Zulgad's Substack | https://juddzulgad.substack.com/feed | NEW_RECOMMENDED, disabled pending rights/quality/cost review |
