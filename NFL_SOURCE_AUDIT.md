# NFL source audit

Evidence captured 2026-10-17T03:36:07.278264+00:00. Isolated branch `poc/nfl-source-expansion`, base `5e1a6ec5`. Public publisher research and local tests only. No production/account/DB access, sends, deployment, paid services, or schedule changes. Production enablement, traffic, historical success, average volume and error rate are **UNKNOWN**.

The repository contains **37 general**, **120 monitoring**, and **179 Film Room candidate records** (336 raw records). URL-backed identities normalize to 143 existing sources; 171 video candidates and six general records lack URLs. These unresolved records remain in the CSV and original catalogs, but are excluded from URL-backed unique counts. Aliases are not deleted or rewritten.

The general registry is `src/data/sources/index.ts` plus `src/server/source-registry.ts`. It previously comprised national/data sources and KC only. Monitoring (`src/data/sources/monitoring`) covers all 32 teams: 31 generated three-feed baselines, a richer KC catalog, and five shared national X reporters. Film Room (`src/data/sources/video/catalog.ts`) has 179 unresolved/review candidates, only eight with candidate URLs. Its immutable channel-ID resolution is a separate requirement. The legacy migration 012 also seeds three source records; these are migration seeds, not evidence of deployed rows.

`observer.ts` syncs monitoring into PostgreSQL `content_sources`; only active, LIVE RSS records become enabled. X, public pages and Reddit are not dispatched by that path. LIVE is derived from configuration/environment presence, not a health test. The 97 configured RSS sources have nominal intervals totaling 18,504 checks/day. The current eight-run global scheduler calls `scheduleDueSources` with batch size 10, allowing at most 80 newly scheduled fetch jobs/day before video competition, retries and existing backlog. A 50-job drain/run and generation caps also constrain throughput. Do not confuse the nominal intervals with measured polling or freshness.

RSS/Atom uses `RssSourceFetcher`; ETag/Last-Modified and exponential failure backoff already exist. YouTube uses resolved uploads playlists via `playlistItems.list`, not keyword search. No free X ingestion is demonstrated. There is no production D1/R2 binding in this branch: the configured Cloudflare Worker is an authenticated scheduler calling the Next.js/PostgreSQL API. No KV or Cloudflare Queues is configured here; PostgreSQL ingestion jobs are the queue. External data providers include ESPN, OverTheCap, Spotrac and Pro Football Reference, but their presence does not establish an authorized news API contract.

Candidates normalize titles, links, hashes and team associations. Uniqueness is `(source_id, external_id)` / `(source_id, canonical_url)`, preserving separate attribution; fingerprints are indexed but not globally unique. Same-event clustering attaches evidence to saved story IDs and material changes produce revisions. Canonical projections feed The Beat, team homepages, Three & Out and Catch Up. Video candidates remain isolated for Film Room. Daily delivery currently implements push; email/SMS preferences do not prove delivery adapters exist. Existing synthesis must not be treated as an independent fact checker.

Public check observations: **703 requests**, **662 HTTP 200**, **245 parsed feed responses** (multiple advertised section/feed URLs can belong to one source), **164 unique source identities with a recent nonempty feed**. Feed freshness requires at least one non-future item within 45 days. Future-dated entries are excluded from the freshness signal. A single snapshot cannot establish a daily average or historical error rate. 403/402 results were retained without bypass attempts. No full article bodies are retained in research artifacts.

The following inventory shows configured state, not enabled production state. Last ingestion success, average daily items, and historical error rates are UNKNOWN for every row. The linked CSV and `existing.json` contain all source URLs, original IDs and associations.

| Catalog | Source ID | Name | Team/scope | Method/platform | Configured status | Local observation |
| --- | --- | --- | --- | --- | --- | --- |
| general | YAHOO_SPORTS | Yahoo Sports | NFL/shared | WEB | active flag | HTTP 200 |
| general | BAL_RAVENS_OFFICIAL | Baltimore Ravens | BAL | WEB | active flag | HTTP 200 |
| general | ADAM_SCHEFTER | Adam Schefter | NFL/shared | X | active flag | not probed / URL unresolved |
| general | IAN_RAPOPORT | Ian Rapoport | NFL/shared | X | active flag | not probed / URL unresolved |
| general | TOM_PELISSERO | Tom Pelissero | NFL/shared | X | active flag | not probed / URL unresolved |
| general | MIKE_GARAFOLO | Mike Garafolo | NFL/shared | X | active flag | not probed / URL unresolved |
| general | JEREMY_FOWLER | Jeremy Fowler | NFL/shared | X | active flag | not probed / URL unresolved |
| general | DIANNA_RUSSINI | Dianna Russini | NFL/shared | X | active flag | not probed / URL unresolved |
| general | JORDAN_SCHULTZ | Jordan Schultz | NFL/shared | X | active flag | not probed / URL unresolved |
| general | ALBERT_BREER | Albert Breer | NFL/shared | X | active flag | not probed / URL unresolved |
| general | JONATHAN_JONES | Jonathan Jones | NFL/shared | X | active flag | not probed / URL unresolved |
| general | KC_CHIEFS | Kansas City Chiefs | KC | WEB | active flag | HTTP 200 |
| general | KC_CHIEFS_PR | Chiefs PR | KC | X | active flag | not probed / URL unresolved |
| general | KC_CHIEFS_SOCIAL | Kansas City Chiefs | KC | X | active flag | not probed / URL unresolved |
| general | KC_MATT_MCMULLEN | Matt McMullen | KC | X | active flag | not probed / URL unresolved |
| general | MATT_DERRICK | Matt Derrick | KC | X | active flag | not probed / URL unresolved |
| general | PETE_SWEENEY | Pete Sweeney | KC | WEB | active flag | not probed / URL unresolved |
| general | JESSE_NEWELL | Jesse Newell | KC | WEB | active flag | not probed / URL unresolved |
| general | NICK_JACOBS | Nick Jacobs | KC | WEB | active flag | not probed / URL unresolved |
| general | ADAM_TEICHER | Adam Teicher | KC | WEB | active flag | not probed / URL unresolved |
| general | NATE_TAYLOR | Nate Taylor | KC | WEB | active flag | not probed / URL unresolved |
| general | JOHN_DIXON | John Dixon | KC | WEB | active flag | not probed / URL unresolved |
| general | KSHB_41 | KSHB 41 | KC | WEB | active flag | HTTP 200 |
| general | KC_STAR_CHIEFS | Kansas City Star Chiefs | KC | WEB | active flag | HTTP 200 |
| general | CHIEFS_DIGEST | Chiefs Digest | KC | WEB | active flag | HTTP 200 |
| general | ARROWHEAD_PRIDE | Arrowhead Pride | KC | WEB | active flag | HTTP 200 |
| general | SPORTS_RADIO_810 | Sports Radio 810 | KC | WEB | active flag | HTTP 200 |
| general | 96_5_THE_FAN | 96.5 The Fan | KC | WEB | active flag | HTTP 200 |
| general | KC_SPORTS_NETWORK | KC Sports Network | KC | YOUTUBE | active flag | not probed / URL unresolved |
| general | HOW_BOUT_THOSE_CHIEFS | How Bout Those Chiefs | KC | YOUTUBE | active flag | not probed / URL unresolved |
| general | RGR_FOOTBALL | RGR Football | KC | YOUTUBE | active flag | not probed / URL unresolved |
| general | CHIEFS_OFFICIAL_YOUTUBE | Kansas City Chiefs YouTube | KC | YOUTUBE | active flag | not probed / URL unresolved |
| general | CHIEFS_REDDIT | r/KansasCityChiefs | KC | REDDIT | active flag | not probed / URL unresolved |
| general | SPOTRAC | Spotrac | NFL/shared | WEB | active flag | HTTP Error 403: Forbidden |
| general | OVER_THE_CAP | Over the Cap | NFL/shared | WEB | active flag | HTTP 200 |
| general | PRO_FOOTBALL_REFERENCE | Pro Football Reference | NFL/shared | WEB | active flag | HTTP Error 403: Forbidden |
| general | NFL_DATA | NFL | NFL/shared | WEB | active flag | Research response exceeds 1 MiB |
| monitoring | ARI_OFFICIAL_NEWS | Official team news | ARI | RSS_ATOM | active flag | RSS parsed |
| monitoring | ARI_SB_NATION | Revenge of the Birds | ARI | RSS_ATOM | active flag | RSS parsed |
| monitoring | ARI_FANSIDED | Raising Zona | ARI | RSS_ATOM | active flag | RSS parsed |
| monitoring | ATL_OFFICIAL_NEWS | Official team news | ATL | RSS_ATOM | active flag | RSS parsed |
| monitoring | ATL_SB_NATION | The Falcoholic | ATL | RSS_ATOM | active flag | RSS parsed |
| monitoring | ATL_FANSIDED | Blogging Dirty | ATL | RSS_ATOM | active flag | RSS parsed |
| monitoring | BAL_OFFICIAL_NEWS | Official team news | BAL | RSS_ATOM | active flag | RSS parsed |
| monitoring | BAL_SB_NATION | Baltimore Beatdown | BAL | RSS_ATOM | active flag | RSS parsed |
| monitoring | BAL_FANSIDED | Ebony Bird | BAL | RSS_ATOM | active flag | RSS parsed |
| monitoring | BUF_OFFICIAL_NEWS | Official team news | BUF | RSS_ATOM | active flag | RSS parsed |
| monitoring | BUF_SB_NATION | Buffalo Rumblings | BUF | RSS_ATOM | active flag | RSS parsed |
| monitoring | BUF_FANSIDED | BuffaLowDown | BUF | RSS_ATOM | active flag | RSS parsed |
| monitoring | CAR_OFFICIAL_NEWS | Official team news | CAR | RSS_ATOM | active flag | RSS parsed |
| monitoring | CAR_SB_NATION | Cat Scratch Reader | CAR | RSS_ATOM | active flag | RSS parsed |
| monitoring | CAR_FANSIDED | Cat Crave | CAR | RSS_ATOM | active flag | RSS parsed |
| monitoring | CHI_OFFICIAL_NEWS | Official team news | CHI | RSS_ATOM | active flag | RSS parsed |
| monitoring | CHI_SB_NATION | Windy City Gridiron | CHI | RSS_ATOM | active flag | RSS parsed |
| monitoring | CHI_FANSIDED | Bear Goggles On | CHI | RSS_ATOM | active flag | RSS parsed |
| monitoring | CIN_OFFICIAL_NEWS | Official team news | CIN | RSS_ATOM | active flag | RSS parsed |
| monitoring | CIN_SB_NATION | Cincy Jungle | CIN | RSS_ATOM | active flag | RSS parsed |
| monitoring | CIN_FANSIDED | Stripe Hype | CIN | RSS_ATOM | active flag | RSS parsed |
| monitoring | CLE_OFFICIAL_NEWS | Official team news | CLE | RSS_ATOM | active flag | RSS parsed |
| monitoring | CLE_SB_NATION | Dawgs By Nature | CLE | RSS_ATOM | active flag | RSS parsed |
| monitoring | CLE_FANSIDED | Dawg Pound Daily | CLE | RSS_ATOM | active flag | RSS parsed |
| monitoring | DAL_OFFICIAL_NEWS | Official team news | DAL | RSS_ATOM | active flag | RSS parsed |
| monitoring | DAL_SB_NATION | Blogging The Boys | DAL | RSS_ATOM | active flag | RSS parsed |
| monitoring | DAL_FANSIDED | The Landry Hat | DAL | RSS_ATOM | active flag | RSS parsed |
| monitoring | DEN_OFFICIAL_NEWS | Official team news | DEN | RSS_ATOM | active flag | RSS parsed |
| monitoring | DEN_SB_NATION | Mile High Report | DEN | RSS_ATOM | active flag | RSS parsed |
| monitoring | DEN_FANSIDED | Predominantly Orange | DEN | RSS_ATOM | active flag | RSS parsed |
| monitoring | DET_OFFICIAL_NEWS | Official team news | DET | RSS_ATOM | active flag | RSS parsed |
| monitoring | DET_SB_NATION | Pride of Detroit | DET | RSS_ATOM | active flag | RSS parsed |
| monitoring | DET_FANSIDED | SideLion Report | DET | RSS_ATOM | active flag | RSS parsed |
| monitoring | GB_OFFICIAL_NEWS | Official team news | GB | RSS_ATOM | active flag | RSS parsed |
| monitoring | GB_SB_NATION | Acme Packing Company | GB | RSS_ATOM | active flag | RSS parsed |
| monitoring | GB_FANSIDED | Lombardi Ave | GB | RSS_ATOM | active flag | RSS parsed |
| monitoring | HOU_OFFICIAL_NEWS | Official team news | HOU | RSS_ATOM | active flag | RSS parsed |
| monitoring | HOU_SB_NATION | Battle Red Blog | HOU | RSS_ATOM | active flag | RSS parsed |
| monitoring | HOU_FANSIDED | Toro Times | HOU | RSS_ATOM | active flag | RSS parsed |
| monitoring | IND_OFFICIAL_NEWS | Official team news | IND | RSS_ATOM | active flag | RSS parsed |
| monitoring | IND_SB_NATION | Stampede Blue | IND | RSS_ATOM | active flag | RSS parsed |
| monitoring | IND_FANSIDED | Horseshoe Heroes | IND | RSS_ATOM | active flag | RSS parsed |
| monitoring | JAX_OFFICIAL_NEWS | Official team news | JAX | RSS_ATOM | active flag | RSS parsed |
| monitoring | JAX_SB_NATION | Big Cat Country | JAX | RSS_ATOM | active flag | RSS parsed |
| monitoring | JAX_FANSIDED | Black and Teal | JAX | RSS_ATOM | active flag | RSS parsed |
| monitoring | CHIEFS_COM | Chiefs.com | KC | RSS_ATOM | active flag | RSS parsed |
| monitoring | CHIEFS_OFFICIAL_X | Kansas City Chiefs official X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | YAHOO_SPORTS_WEB | Yahoo Sports | KC | PUBLIC_PAGE | active flag | HTTP 200 |
| monitoring | YAHOO_SPORTS_X | Yahoo Sports X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | KC_STAR | Kansas City Star | KC | PUBLIC_PAGE | active flag | HTTP 200 |
| monitoring | CHIEFS_WIRE | Chiefs Wire | KC | PUBLIC_PAGE | active flag | HTTP Error 402: Payment Required |
| monitoring | LOCKED_ON_CHIEFS_X | Locked On Chiefs X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | LOCKED_ON_CHIEFS_YT | Locked On Chiefs YouTube | KC | YOUTUBE_WEBSUB | active flag | not probed / URL unresolved |
| monitoring | RGR_FOOTBALL_X | RGR Football X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | RGR_FOOTBALL_YT | RGR Football YouTube | KC | YOUTUBE_WEBSUB | active flag | not probed / URL unresolved |
| monitoring | HOW_BOUT_CHIEFS_X | How Bout Those Chiefs X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | HOW_BOUT_CHIEFS_YT | How Bout Those Chiefs YouTube | KC | YOUTUBE_WEBSUB | active flag | not probed / URL unresolved |
| monitoring | ALL_CHIEFS_UP_X | All Chief'd Up X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | ALL_CHIEFS_UP_YT | All Chief'd Up YouTube | KC | YOUTUBE_WEBSUB | active flag | not probed / URL unresolved |
| monitoring | ARROWHEAD_PRIDE_X | Arrowhead Pride X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | ARROWHEAD_PRIDE_WEB | Arrowhead Pride | KC | RSS_ATOM | active flag | RSS parsed |
| monitoring | ARROWHEAD_ADDICT_X | Arrowhead Addict X | KC | X_API | active flag | not probed / URL unresolved |
| monitoring | ARROWHEAD_ADDICT_WEB | Arrowhead Addict | KC | RSS_ATOM | active flag | RSS parsed |
| monitoring | HEAVY_CHIEFS | Heavy.com Chiefs | KC | PUBLIC_PAGE | active flag | HTTP 200 |
| monitoring | PRO_FOOTBALL_RUMORS | Pro Football Rumors | KC | RSS_ATOM | active flag | RSS parsed |
| monitoring | CHIEFS_REDDIT_API | r/KansasCityChiefs | KC | REDDIT_API | active flag | not probed / URL unresolved |
| monitoring | YARDBARKER_CHIEFS | Yardbarker Chiefs | KC | PUBLIC_PAGE | active flag | HTTP 200 |
| monitoring | LV_OFFICIAL_NEWS | Official team news | LV | RSS_ATOM | active flag | RSS parsed |
| monitoring | LV_SB_NATION | Silver and Black Pride | LV | RSS_ATOM | active flag | RSS parsed |
| monitoring | LV_FANSIDED | Just Blog Baby | LV | RSS_ATOM | active flag | RSS parsed |
| monitoring | LAC_OFFICIAL_NEWS | Official team news | LAC | RSS_ATOM | active flag | RSS parsed |
| monitoring | LAC_SB_NATION | Bolts From The Blue | LAC | RSS_ATOM | active flag | RSS parsed |
| monitoring | LAC_FANSIDED | Bolt Beat | LAC | RSS_ATOM | active flag | RSS parsed |
| monitoring | LAR_OFFICIAL_NEWS | Official team news | LAR | RSS_ATOM | active flag | RSS parsed |
| monitoring | LAR_SB_NATION | Turf Show Times | LAR | RSS_ATOM | active flag | RSS parsed |
| monitoring | LAR_FANSIDED | Ramblin' Fan | LAR | RSS_ATOM | active flag | RSS parsed |
| monitoring | MIA_OFFICIAL_NEWS | Official team news | MIA | RSS_ATOM | active flag | RSS parsed |
| monitoring | MIA_SB_NATION | The Phinsider | MIA | RSS_ATOM | active flag | RSS parsed |
| monitoring | MIA_FANSIDED | Phin Phanatic | MIA | RSS_ATOM | active flag | RSS parsed |
| monitoring | MIN_OFFICIAL_NEWS | Official team news | MIN | RSS_ATOM | active flag | RSS parsed |
| monitoring | MIN_SB_NATION | Daily Norseman | MIN | RSS_ATOM | active flag | RSS parsed |
| monitoring | MIN_FANSIDED | The Viking Age | MIN | RSS_ATOM | active flag | RSS parsed |
| monitoring | NE_OFFICIAL_NEWS | Official team news | NE | RSS_ATOM | active flag | RSS parsed |
| monitoring | NE_SB_NATION | Pats Pulpit | NE | RSS_ATOM | active flag | RSS parsed |
| monitoring | NE_FANSIDED | Musket Fire | NE | RSS_ATOM | active flag | RSS parsed |
| monitoring | NO_OFFICIAL_NEWS | Official team news | NO | RSS_ATOM | active flag | RSS parsed |
| monitoring | NO_SB_NATION | Canal Street Chronicles | NO | RSS_ATOM | active flag | RSS parsed |
| monitoring | NO_FANSIDED | Who Dat Dish | NO | RSS_ATOM | active flag | RSS parsed |
| monitoring | NYG_OFFICIAL_NEWS | Official team news | NYG | RSS_ATOM | active flag | RSS parsed |
| monitoring | NYG_SB_NATION | Big Blue View | NYG | RSS_ATOM | active flag | RSS parsed |
| monitoring | NYG_FANSIDED | GMEN HQ | NYG | RSS_ATOM | active flag | RSS parsed |
| monitoring | NYJ_OFFICIAL_NEWS | Official team news | NYJ | RSS_ATOM | active flag | RSS parsed |
| monitoring | NYJ_SB_NATION | Gang Green Nation | NYJ | RSS_ATOM | active flag | RSS parsed |
| monitoring | NYJ_FANSIDED | The Jet Press | NYJ | RSS_ATOM | active flag | RSS parsed |
| monitoring | PHI_OFFICIAL_NEWS | Official team news | PHI | RSS_ATOM | active flag | RSS parsed |
| monitoring | PHI_SB_NATION | Bleeding Green Nation | PHI | RSS_ATOM | active flag | RSS parsed |
| monitoring | PHI_FANSIDED | Inside the Iggles | PHI | RSS_ATOM | active flag | RSS parsed |
| monitoring | PIT_OFFICIAL_NEWS | Official team news | PIT | RSS_ATOM | active flag | RSS parsed |
| monitoring | PIT_SB_NATION | Behind the Steel Curtain | PIT | RSS_ATOM | active flag | RSS parsed |
| monitoring | PIT_FANSIDED | Still Curtain | PIT | RSS_ATOM | active flag | RSS parsed |
| monitoring | SF_OFFICIAL_NEWS | Official team news | SF | RSS_ATOM | active flag | RSS parsed |
| monitoring | SF_SB_NATION | Niners Nation | SF | RSS_ATOM | active flag | RSS parsed |
| monitoring | SF_FANSIDED | Niner Noise | SF | RSS_ATOM | active flag | RSS parsed |
| monitoring | SEA_OFFICIAL_NEWS | Official team news | SEA | RSS_ATOM | active flag | RSS parsed |
| monitoring | SEA_SB_NATION | Field Gulls | SEA | RSS_ATOM | active flag | RSS parsed |
| monitoring | SEA_FANSIDED | 12th Man Rising | SEA | RSS_ATOM | active flag | RSS parsed |
| monitoring | TB_OFFICIAL_NEWS | Official team news | TB | RSS_ATOM | active flag | RSS parsed |
| monitoring | TB_SB_NATION | Bucs Nation | TB | RSS_ATOM | active flag | RSS parsed |
| monitoring | TB_FANSIDED | The Pewter Plank | TB | RSS_ATOM | active flag | RSS parsed |
| monitoring | TEN_OFFICIAL_NEWS | Official team news | TEN | RSS_ATOM | active flag | RSS parsed |
| monitoring | TEN_SB_NATION | Music City Miracles | TEN | RSS_ATOM | active flag | RSS parsed |
| monitoring | TEN_FANSIDED | Titan Sized | TEN | RSS_ATOM | active flag | RSS parsed |
| monitoring | WAS_OFFICIAL_NEWS | Official team news | WAS | RSS_ATOM | active flag | RSS parsed |
| monitoring | WAS_SB_NATION | Hogs Haven | WAS | RSS_ATOM | active flag | RSS parsed |
| monitoring | WAS_FANSIDED | Riggo's Rag | WAS | RSS_ATOM | active flag | RSS parsed |
| monitoring | IAN_RAPOPORT_X | Ian Rapoport | NFL | X_API | active flag | not probed / URL unresolved |
| monitoring | MIKE_GARAFOLO_X | Mike Garafolo | NFL | X_API | active flag | not probed / URL unresolved |
| monitoring | ADAM_SCHEFTER_X | Adam Schefter | NFL | X_API | active flag | not probed / URL unresolved |
| monitoring | TOM_PELISSERO_X | Tom Pelissero | NFL | X_API | active flag | not probed / URL unresolved |
| monitoring | JEREMY_FOWLER_X | Jeremy Fowler | NFL | X_API | active flag | not probed / URL unresolved |
| video | YT_ARI_ARIZONA_CARDINALS | Arizona Cardinals | ARI | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ARI_LOCKED_ON_CARDINALS | Locked On Cardinals | ARI | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ARI_PHNX_CARDINALS | PHNX Cardinals | ARI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ARI_ARIZONA_SPORTS_CARDINALS | Arizona Sports Cardinals | ARI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ATL_ATLANTA_FALCONS | Atlanta Falcons | ATL | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ATL_LOCKED_ON_FALCONS | Locked On Falcons | ATL | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ATL_DIRTY_BIRDS_BREWS | Dirty Birds & Brews | ATL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ATL_POUND_4_POUND_ATL | Pound 4 Pound ATL | ATL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_ATL_MAD_MIKE_SPORTS | Mad Mike Sports | ATL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BAL_BALTIMORE_RAVENS | Baltimore Ravens | BAL | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BAL_LOCKED_ON_RAVENS | Locked On Ravens | BAL | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BAL_INGRAVENVIDS | IngravenVids | BAL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BAL_410_SPORTS_TALK | 410 Sports Talk | BAL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BAL_THE_RAVENS_VAULT | The Ravens Vault | BAL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BUF_BUFFALO_BILLS | Buffalo Bills | BUF | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BUF_LOCKED_ON_BILLS | Locked On Bills | BUF | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BUF_COVER_1 | Cover 1 | BUF | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BUF_BUFFALO_PLUS | Buffalo Plus | BUF | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_BUF_SHOUT_BUFFALO_FOOTBALL_PODCAST | SHOUT! Buffalo Football Podcast | BUF | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CAR_CAROLINA_PANTHERS | Carolina Panthers | CAR | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CAR_LOCKED_ON_PANTHERS | Locked On Panthers | CAR | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CAR_C3_PANTHERS_PODCAST | C3 Panthers Podcast | CAR | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CAR_PANTHER_NATION_PODCAST | Panther Nation Podcast | CAR | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CAR_PANTHERS_ON_TAP | Panthers On Tap | CAR | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CHI_CHICAGO_BEARS | Chicago Bears | CHI | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CHI_LOCKED_ON_BEARS | Locked On Bears | CHI | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CHI_CHGO_BEARS | CHGO Bears | CHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CHI_THE_CHICAGO_AUDIBLE | The Chicago Audible | CHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CHI_2ND_CITY_GRIDIRON | 2nd City Gridiron | CHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CHI_CHICAGO_BEARS_NOW | Chicago Bears Now | CHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CIN_CINCINNATI_BENGALS | Cincinnati Bengals | CIN | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CIN_LOCKED_ON_BENGALS | Locked On Bengals | CIN | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CIN_BENGALS_ON_THE_BRAIN | Bengals on the Brain | CIN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CIN_THE_GROWLER | The Growler | CIN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CIN_WINCINNATI | Wincinnati | CIN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CIN_THE_JUNGLE_ROAR | The Jungle Roar | CIN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CLE_CLEVELAND_BROWNS | Cleveland Browns | CLE | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CLE_LOCKED_ON_BROWNS | Locked On Browns | CLE | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CLE_QUINCY_CARRIER | Quincy Carrier | CLE | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CLE_THE_OBR | The OBR | CLE | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CLE_ORANGE_AND_BROWN_TALK | Orange and Brown Talk | CLE | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_CLE_BROWNS_FILM_BREAKDOWN | Browns Film Breakdown | CLE | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DAL_DALLAS_COWBOYS | Dallas Cowboys | DAL | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DAL_LOCKED_ON_COWBOYS | Locked On Cowboys | DAL | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DAL_VOCH_LOMBARDI | Voch Lombardi | DAL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DAL_LAW_NATION_SPORTS | Law Nation Sports | DAL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DAL_BLOGGING_THE_BOYS | Blogging the Boys | DAL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DAL_COWBOYS_REPORT | Cowboys Report | DAL | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DEN_DENVER_BRONCOS | Denver Broncos | DEN | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DEN_LOCKED_ON_BRONCOS | Locked On Broncos | DEN | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DEN_DNVR_BRONCOS | DNVR Broncos | DEN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DEN_THAT_S_GOOD_SPORTS | That's Good Sports | DEN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DEN_MILE_HIGH_HUDDLE | Mile High Huddle | DEN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DEN_CODY_ROARK_NFL | Cody Roark NFL | DEN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DET_DETROIT_LIONS | Detroit Lions | DET | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DET_LOCKED_ON_LIONS | Locked On Lions | DET | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DET_DETROIT_LIONS_PODCAST | Detroit Lions Podcast | DET | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DET_DETROIT_LIONS_TALK_WITH_MICROMIKE | Detroit Lions Talk with MicroMike | DET | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DET_LET_S_TALK_LIONS | Let's Talk Lions | DET | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_DET_LIONS_TALK_LIVE | Lions Talk Live | DET | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_GB_GREEN_BAY_PACKERS | Green Bay Packers | GB | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_GB_LOCKED_ON_PACKERS | Locked On Packers | GB | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_GB_PACK_A_DAY_PODCAST | Pack-A-Day Podcast | GB | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_GB_MATT_RAMAGE | Matt Ramage | GB | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_GB_PACKERS_TOTAL_ACCESS | Packers Total Access | GB | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_GB_TOM_GROSSI | Tom Grossi | GB | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_HOU_HOUSTON_TEXANS | Houston Texans | HOU | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_HOU_LOCKED_ON_TEXANS | Locked On Texans | HOU | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_HOU_BATTLE_RED_BLOG_VIDEO_PROGRAMMING | Battle Red Blog video programming | HOU | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_HOU_HOUSTON_TEXANS_LOCAL_MEDIA_VIDEO_SOURCE | Houston Texans local-media video source | HOU | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_IND_INDIANAPOLIS_COLTS | Indianapolis Colts | IND | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_IND_LOCKED_ON_COLTS | Locked On Colts | IND | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_IND_KEVIN_BOWEN_107_5_THE_FAN | Kevin Bowen / 107.5 The Fan | IND | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_IND_COLTS_COVER_2_INDYSTAR | Colts Cover 2 / IndyStar | IND | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_IND_COLTS_ONLY_CREATOR | Colts-only creator | IND | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_JAX_JACKSONVILLE_JAGUARS | Jacksonville Jaguars | JAX | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_JAX_LOCKED_ON_JAGUARS | Locked On Jaguars | JAX | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_JAX_GENJAG | GenJag | JAX | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_JAX_1010XL_JAGUARS | 1010XL Jaguars | JAX | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_KC_KANSAS_CITY_CHIEFS | Kansas City Chiefs | KC | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_KC_LOCKED_ON_CHIEFS | Locked On Chiefs | KC | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_KC_HOW_BOUT_THOSE_CHIEFS | How Bout Those Chiefs | KC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_KC_ALL_CHIEF_D_UP | All Chief'd Up | KC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_KC_CHIEFSTV | ChiefsTV | KC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_KC_ARROWHEAD_ADDICT_PODCAST | Arrowhead Addict Podcast | KC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_KC_RGR_FOOTBALL | RGR Football | KC | film | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LV_LAS_VEGAS_RAIDERS | Las Vegas Raiders | LV | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LV_LOCKED_ON_RAIDERS | Locked On Raiders | LV | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LV_RAIDERS_REPORT | Raiders Report | LV | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LV_TAPE_DON_T_LIE | Tape Don't Lie | LV | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LV_SANJIT_T | Sanjit T. | LV | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LV_THE_AUTUMN_WINDBAGS | The Autumn Windbags | LV | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAC_LOS_ANGELES_CHARGERS | Los Angeles Chargers | LAC | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAC_LOCKED_ON_CHARGERS | Locked On Chargers | LAC | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAC_GUILTY_AS_CHARGED | Guilty As Charged | LAC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAC_CHARGERS_UNLEASHED | Chargers Unleashed | LAC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAC_CHARGER_CHAT_PODCAST | Charger Chat Podcast | LAC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAC_THE_DIRECTOR | The Director | LAC | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAR_LOS_ANGELES_RAMS | Los Angeles Rams | LAR | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAR_LOCKED_ON_RAMS | Locked On Rams | LAR | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAR_RAMS_BROTHERS | Rams Brothers | LAR | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAR_DOWNTOWN_RAMS | Downtown Rams | LAR | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_LAR_LA_FOOTBALL_NETWORK_RAMS | LA Football Network Rams | LAR | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIA_MIAMI_DOLPHINS | Miami Dolphins | MIA | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIA_LOCKED_ON_DOLPHINS | Locked On Dolphins | MIA | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIA_DOUGLIEDOWRONG | DouglieDoWrong | MIA | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIA_PHINSIDE_THE_NFL | Phinside The NFL | MIA | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIA_TD_PHINS_TALK | TD Phins Talk | MIA | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIN_MINNESOTA_VIKINGS | Minnesota Vikings | MIN | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIN_LOCKED_ON_VIKINGS | Locked On Vikings | MIN | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIN_PURPLE_DAILY | Purple Daily | MIN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIN_PURPLE_FTW | Purple FTW! | MIN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_MIN_VIKINGS_TERRITORY | Vikings Territory | MIN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NE_NEW_ENGLAND_PATRIOTS | New England Patriots | NE | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NE_LOCKED_ON_PATRIOTS | Locked On Patriots | NE | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NE_CLNS_PATRIOTS | CLNS Patriots | NE | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NE_NBC_SPORTS_BOSTON_PATRIOTS | NBC Sports Boston Patriots | NE | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NE_PATS_PULPIT | Pats Pulpit | NE | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NO_NEW_ORLEANS_SAINTS | New Orleans Saints | NO | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NO_LOCKED_ON_SAINTS | Locked On Saints | NO | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NO_NEWORLEANS_FOOTBALL_NOF_NETWORK | NewOrleans.Football / NOF Network | NO | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NO_STATE_OF_THE_SAINTS_PODCAST | State of the Saints Podcast | NO | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NO_SAINTS_HAPPY_HOUR | Saints Happy Hour | NO | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYG_NEW_YORK_GIANTS | New York Giants | NYG | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYG_LOCKED_ON_GIANTS | Locked On Giants | NYG | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYG_TALKIN_GIANTS | Talkin' Giants | NYG | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYG_BIG_BLUE_BANTER | Big Blue Banter | NYG | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYG_FIRESIDE_GIANTS | Fireside Giants | NYG | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYG_THE_ENTERTAINAH_TALKIN_SPORTS | The Entertainah Talkin Sports | NYG | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYJ_NEW_YORK_JETS | New York Jets | NYJ | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYJ_LOCKED_ON_JETS | Locked On Jets | NYJ | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYJ_JETS_X_FACTOR | Jets X-Factor | NYJ | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYJ_BOY_GREEN_DAILY | Boy Green Daily | NYJ | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYJ_PLAY_LIKE_A_JET | Play Like A Jet | NYJ | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NYJ_JETS_TALK_24_7 | Jets Talk 24/7 | NYJ | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PHI_PHILADELPHIA_EAGLES | Philadelphia Eagles | PHI | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PHI_LOCKED_ON_EAGLES | Locked On Eagles | PHI | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PHI_PHLY_SPORTS | PHLY Sports | PHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PHI_INSIDE_THE_BIRDS | Inside the Birds | PHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PHI_JAKIB_SPORTS | JAKIB Sports | PHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PHI_BLEEDING_GREEN_NATION | Bleeding Green Nation | PHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PHI_A_TO_Z_SPORTS_PHILADELPHIA | A to Z Sports Philadelphia | PHI | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PIT_PITTSBURGH_STEELERS | Pittsburgh Steelers | PIT | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PIT_LOCKED_ON_STEELERS | Locked On Steelers | PIT | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PIT_STEELERS_DEPOT | Steelers Depot | PIT | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PIT_ARTHUR_MOATS_EXPERIENCE | Arthur Moats Experience | PIT | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PIT_DK_PITTSBURGH_SPORTS | DK Pittsburgh Sports | PIT | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_PIT_STEELERS_NOW | Steelers Now | PIT | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SEA_SEATTLE_SEAHAWKS | Seattle Seahawks | SEA | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SEA_LOCKED_ON_SEAHAWKS | Locked On Seahawks | SEA | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SEA_SEATTLE_OVERLOAD | Seattle Overload | SEA | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SEA_SEAHAWKS_MAN_2_MAN | Seahawks Man 2 Man | SEA | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SEA_HAWK_BLOGGER | Hawk Blogger | SEA | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SEA_SEAHAWKS_TODAY | Seahawks Today | SEA | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SF_SAN_FRANCISCO_49ERS | San Francisco 49ers | SF | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SF_LOCKED_ON_49ERS | Locked On 49ers | SF | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SF_49ERS_RUSH_PODCAST | 49ers Rush Podcast | SF | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SF_GRANT_COHN | Grant Cohn | SF | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SF_THE_KRUEG_SHOW | The Krueg Show | SF | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_SF_NBC_SPORTS_BAY_AREA | NBC Sports Bay Area | SF | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TB_TAMPA_BAY_BUCCANEERS | Tampa Bay Buccaneers | TB | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TB_LOCKED_ON_BUCS | Locked On Bucs | TB | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TB_PEWTER_REPORT | Pewter Report | TB | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TB_REAL_BUCS_TALK | Real Bucs Talk | TB | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TB_MRBUCSNATION | MrBucsNation | TB | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TEN_TENNESSEE_TITANS | Tennessee Titans | TEN | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TEN_LOCKED_ON_TITANS | Locked On Titans | TEN | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TEN_A_TO_Z_SPORTS_NASHVILLE | A to Z Sports Nashville | TEN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TEN_440_SPORTS_TITANS | 440 Sports Titans | TEN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_TEN_MUSIC_CITY_AUDIBLE | Music City Audible | TEN | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_WAS_WASHINGTON_COMMANDERS | Washington Commanders | WAS | official | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_WAS_LOCKED_ON_COMMANDERS | Locked On Commanders | WAS | podcast | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_WAS_STREET_SCORES | Street Scores | WAS | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_WAS_LOUIE_TEE_NETWORK | Louie Tee Network | WAS | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_WAS_TRAP_OR_DIVE | Trap or Dive | WAS | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_WAS_COMMANDERS_REPORT | Commanders Report | WAS | independent_media | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NFL_MATTYDUBS | Mattydubs | NFL/shared | film | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NFL_FOOTBALL_ANALYSIS | Football Analysis | NFL/shared | film | REVIEW_REQUIRED | not probed / URL unresolved |
| video | YT_NFL_NFL_NFL_FILMS | NFL / NFL Films | NFL/shared | league_media | REVIEW_REQUIRED | not probed / URL unresolved |

Original reporting is not established by catalog trust scores. Official feeds provide first-party announcements; aggregator aliases require original-publisher tracing. See per-source assessments and provisional evidence components in `inventory.json`. No existing source was removed.
