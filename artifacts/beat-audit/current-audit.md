# Live Beat card audit
Captured 2026-09-24T17:44:04.805Z. Current top eight per team; these can differ from the review screenshots.
5 of 48 remain Standard because their text does not establish a supported specific format.
Each extracted value below is checked against the canonical headline/summary supplied by the feed; source links and publication context are preserved in the JSON. This is not independent verification of the underlying reporting.

## HOU — The Texans Are Getting There. Now Come the Last 20 Yards.
- Family: standard-d
- Reason: General analysis or insufficient evidence for a specific editorial format
- Fallback: General analysis or insufficient evidence for a specific editorial format
- Graphic: {"family":"standard-d"}
- Source: https://www.houstontexans.com/news/texans-red-zone-short-yardage-third-down-focus

## HOU — Living On The Edge | VanderBlog
- Family: standard-c
- Reason: General analysis or insufficient evidence for a specific editorial format
- Fallback: General analysis or insufficient evidence for a specific editorial format
- Graphic: {"family":"standard-c"}
- Source: https://www.houstontexans.com/news/living-on-the-edge-vanderblog

## HOU — Houston Texans at Indianapolis Colts: How to Watch, Listen, & Live Stream
- Family: game-matchup
- Reason: Identified teams in an explicit matchup/preview format
- Fallback: None
- Graphic: {"family":"game-matchup","leftTeam":"HOU","rightTeam":"IND","week":"W3"}
- leftTeam = "HOU" ← headline: Houston Texans at Indianapolis Colts: How to Watch, Listen, & Live Stream
- rightTeam = "IND" ← headline: Houston Texans at Indianapolis Colts: How to Watch, Listen, & Live Stream
- week = "W3" ← summary: Week 3
- Source: https://www.houstontexans.com/news/houston-texans-at-indianapolis-colts-how-to-watch-listen-live-stream

## HOU — Ready For Cincinnati
- Family: standard-d
- Reason: General analysis or insufficient evidence for a specific editorial format
- Fallback: General analysis or insufficient evidence for a specific editorial format
- Graphic: {"family":"standard-d"}
- Source: https://www.houstontexans.com/news/ready-for-cincinnati

## HOU — Houston Texans Transactions (9-19-2026)
- Family: roster-roundup
- Reason: Multiple or unspecified roster moves; no single signing asserted
- Fallback: None
- Graphic: {"family":"roster-roundup","team":"HOU"}
- team = "HOU" ← canonical: HOU
- Source: https://www.houstontexans.com/news/houston-texans-transactions-9-19-2026

## HOU — Houston Texans vs. Cincinnati Bengals | Texans Roundup
- Family: game-matchup
- Reason: Identified teams in an explicit matchup/preview format
- Fallback: None
- Graphic: {"family":"game-matchup","leftTeam":"HOU","rightTeam":"CIN"}
- leftTeam = "HOU" ← headline: Houston Texans vs. Cincinnati Bengals | Texans Roundup
- rightTeam = "CIN" ← headline: Houston Texans vs. Cincinnati Bengals | Texans Roundup
- Source: https://www.houstontexans.com/news/houston-texans-vs-cincinnati-bengals-texans-roundup

## HOU — Know Your Foe: The Texans' Look To Slow Joe Burrow and the Bengals in Week 2
- Family: scouting
- Reason: Explicit opponent/scouting focus
- Fallback: None
- Graphic: {"family":"scouting","opponent":"CIN"}
- opponent = "CIN" ← headline: Know Your Foe: The Texans' Look To Slow Joe Burrow and the Bengals in Week 2
- Source: https://www.houstontexans.com/news/know-your-foe-the-texans-look-to-slow-joe-burrow-and-the-bengals-in-week-2

## HOU — Nick Caserio's Bengals Scouting Report: "A Really Good Football Team That's Well Constructed"
- Family: scouting
- Reason: Explicit opponent/scouting focus
- Fallback: None
- Graphic: {"family":"scouting","opponent":"CIN"}
- opponent = "CIN" ← headline: Nick Caserio's Bengals Scouting Report: "A Really Good Football Team That's Well Constructed"
- Source: https://www.houstontexans.com/news/nick-caserio-s-bengals-scouting-report-a-really-good-football-team-that-s-well-constructed

## MIA — Three Takeaways: Dolphins battle through tough test in San Francisco
- Family: numbered
- Reason: Explicit numbered editorial format takes precedence
- Fallback: None
- Graphic: {"family":"numbered","count":"3","descriptor":"TAKEAWAYS"}
- count = "3" ← headline: Three Takeaways
- descriptor = "TAKEAWAYS" ← headline: Three Takeaways: Dolphins battle through tough test in San Francisco
- Source: https://www.miamidolphins.com/news/three-takeaways-dolphins-battle-through-tough-test-in-san-francisco

## MIA — Miami Dolphins Academy Fall Donation Presented by Baptist Health Delivers Equipment to Royal Palm Beach High School Tackle Football Program
- Family: business-community
- Reason: Explicit community, school or youth context
- Fallback: None
- Graphic: {"family":"business-community","label":"COMMUNITY"}
- Source: https://www.miamidolphins.com/news/miami-dolphins-academy-fall-donation-presented-by-baptist-health-delivers-equipment-to-royal-palm-beach-high-school-tackle-football-program

## MIA — Game Recap: Dolphins Fall to 49ers in Week 2
- Family: recap
- Reason: Recap without a verified score pair
- Fallback: None
- Graphic: {"family":"recap","teams":["MIA","SF"],"overtime":false}
- teams.0 = "MIA" ← headline: Game Recap: Dolphins Fall to 49ers in Week 2
- teams.1 = "SF" ← headline: Game Recap: Dolphins Fall to 49ers in Week 2
- Source: https://www.miamidolphins.com/news/game-recap-dolphins-lose-week-2-matchup-to-49ers

## MIA — Dolphins make roster moves
- Family: roster-roundup
- Reason: Multiple or unspecified roster moves; no single signing asserted
- Fallback: None
- Graphic: {"family":"roster-roundup","team":"MIA"}
- team = "MIA" ← canonical: MIA
- Source: https://www.miamidolphins.com/news/dolphins-make-roster-moves-x5502

## MIA — Game Preview: Miami Dolphins at San Francisco 49ers
- Family: game-matchup
- Reason: Identified teams in an explicit matchup/preview format
- Fallback: None
- Graphic: {"family":"game-matchup","leftTeam":"MIA","rightTeam":"SF"}
- leftTeam = "MIA" ← headline: Game Preview: Miami Dolphins at San Francisco 49ers
- rightTeam = "SF" ← headline: Game Preview: Miami Dolphins at San Francisco 49ers
- Source: https://www.miamidolphins.com/news/game-preview-miami-dolphins-at-san-francisco-49ers

## MIA — Transcript: HC Jeff Hafley Press Conference - September 18
- Family: interview
- Reason: Text interview/transcript; no invented quote or playback
- Fallback: None
- Graphic: {"family":"interview","name":"Jeff Hafley","transcript":true}
- name = "Jeff Hafley" ← headline: HC Jeff Hafley Press Conference
- Source: https://www.miamidolphins.com/news/transcript-hc-jeff-hafley-press-conference-september-18

## MIA — Transcript: STC Chris Tabor Press Conference - September 17
- Family: interview
- Reason: Text interview/transcript; no invented quote or playback
- Fallback: None
- Graphic: {"family":"interview","name":"Chris Tabor","transcript":true}
- name = "Chris Tabor" ← headline: STC Chris Tabor Press Conference
- Source: https://www.miamidolphins.com/news/transcript-stc-chris-tabor-press-conference-september-17

## MIA — Transcript: DC Sean Duggan Press Conference - September 17
- Family: interview
- Reason: Text interview/transcript; no invented quote or playback
- Fallback: None
- Graphic: {"family":"interview","name":"Sean Duggan","transcript":true}
- name = "Sean Duggan" ← headline: DC Sean Duggan Press Conference
- Source: https://www.miamidolphins.com/news/transcript-dc-sean-duggan-press-conference-september-17

## BUF — Top Storylines for Bills vs. Chargers | Week 3
- Family: game-matchup
- Reason: Identified teams in an explicit matchup/preview format
- Fallback: None
- Graphic: {"family":"game-matchup","leftTeam":"BUF","rightTeam":"LAC","week":"W3"}
- leftTeam = "BUF" ← headline: Top Storylines for Bills vs. Chargers | Week 3
- rightTeam = "LAC" ← headline: Top Storylines for Bills vs. Chargers | Week 3
- week = "W3" ← headline: Week 3
- Source: https://www.buffalobills.com/news/top-storylines-for-bills-vs-chargers-week-3

## BUF — Injury updates following TNF, Deone Walker's steady play and Bills using upcoming rest to their advantage
- Family: injury
- Reason: Report topic; unknown aggregate status totals omitted
- Fallback: None
- Graphic: {"family":"injury","rows":[],"detail":"INJURY\nREPORT"}
- Source: https://www.buffalobills.com/news/injury-updates-following-tnf-deone-walker-s-steady-play-and-bills-using-upcoming-rest-to-their-advantage

## BUF — 'An out-of-body experience' | Bills players recap an unforgettable night in the Highmark Stadium home opener
- Family: recap
- Reason: Recap without a verified score pair
- Fallback: None
- Graphic: {"family":"recap","teams":["BUF"],"overtime":false}
- teams.0 = "BUF" ← headline: 'An out-of-body experience' | Bills players recap an unforgettable night in the Highmark Stadium home opener
- Source: https://www.buffalobills.com/news/an-out-of-body-experience-bills-players-recap-an-unforgettable-night-in-the-highmark-stadium-home-opener

## BUF — Top 3 things we learned from Bills vs. Lions | Week 2
- Family: numbered
- Reason: Explicit numbered editorial format takes precedence
- Fallback: None
- Graphic: {"family":"numbered","count":"3","descriptor":"THINGS\nLEARNED"}
- count = "3" ← headline: 3 things
- descriptor = "THINGS\nLEARNED" ← headline: Top 3 things we learned from Bills vs. Lions | Week 2
- Source: https://www.buffalobills.com/news/top-3-things-we-learned-from-bills-vs-lions-week-2

## BUF — Bills 41, Lions 31 | Final Score, recap + highlights
- Family: game-result
- Reason: Explicit named team-score pairs; no home/away inference
- Fallback: None
- Graphic: {"family":"game-result","leftTeam":"BUF","rightTeam":"DET","leftScore":41,"rightScore":31,"final":"FINAL"}
- family = "game-result" ← headline: Bills 41, Lions 31
- leftTeam = "BUF" ← headline: Bills 41, Lions 31
- rightTeam = "DET" ← headline: Bills 41, Lions 31
- leftScore = 41 ← headline: Bills 41, Lions 31
- rightScore = 31 ← headline: Bills 41, Lions 31
- final = "FINAL" ← headline: Bills 41, Lions 31 | Final Score, recap + highlights
- Source: https://www.buffalobills.com/news/bills-41-lions-31-final-score-recap-highlights
- Source: https://www.detroitlions.com/news/recap-lions-at-bills-goff-gibbs-stbrown

## BUF — Bills issue injury update on WR DJ Moore
- Family: player
- Reason: Named player injury status with original time/game context
- Fallback: None
- Graphic: {"family":"player","name":"DJ Moore","position":"WR","status":"QUESTIONABLE TO RETURN","context":"IN-GAME UPDATE"}
- name = "DJ Moore" ← headline: WR DJ Moore
- position = "WR" ← headline: WR DJ Moore
- status = "QUESTIONABLE TO RETURN" ← summary: questionable to return
- context = "IN-GAME UPDATE" ← summary: questionable to return
- Source: https://www.buffalobills.com/news/bills-issue-injury-update-on-wr-dj-moore

## BUF — Bills DL Ed Oliver suffers pregame hip injury, ruled OUT vs. Lions
- Family: player
- Reason: Named player injury status with original time/game context
- Fallback: None
- Graphic: {"family":"player","name":"Ed Oliver","position":"DL","status":"OUT"}
- name = "Ed Oliver" ← headline: DL Ed Oliver
- position = "DL" ← headline: DL Ed Oliver
- status = "OUT" ← headline: ruled OUT
- Source: https://www.buffalobills.com/news/bills-dl-ed-oliver-suffers-pregame-hip-injury-ruled-out-vs-lions

## BUF — Buffalo Bills inactives vs. Lions | Week 2
- Family: injury
- Reason: Report topic; unknown aggregate status totals omitted
- Fallback: None
- Graphic: {"family":"injury","period":"W2","rows":[],"detail":"INACTIVE\nREPORT"}
- week = "W2" ← headline: Week 2
- Source: https://www.buffalobills.com/news/buffalo-bills-inactives-vs-lions-week-2

## CHI — Catching up with former players at Bears Alumni Weekend
- Family: business-community
- Reason: Explicit community, school or youth context
- Fallback: None
- Graphic: {"family":"business-community","label":"COMMUNITY"}
- Source: https://www.chicagobears.com/news/catching-up-with-former-players-at-bears-alumni-weekend

## CHI — Bears defense displays growth, energy in home opener
- Family: standard-b
- Reason: General analysis or insufficient evidence for a specific editorial format
- Fallback: General analysis or insufficient evidence for a specific editorial format
- Graphic: {"family":"standard-b"}
- Source: https://www.chicagobears.com/news/bears-defense-displays-growth-energy-in-home-opener

## CHI — Caleb Williams week-to-week with hamstring injury
- Family: player
- Reason: Named player injury status with original time/game context
- Fallback: None
- Graphic: {"family":"player","name":"Caleb Williams","position":"QB","status":"WEEK-TO-WEEK"}
- name = "Caleb Williams" ← summary: quarterback Caleb Williams
- position = "QB" ← summary: quarterback Caleb Williams
- status = "WEEK-TO-WEEK" ← headline: week-to-week
- Source: https://www.chicagobears.com/news/caleb-williams-week-to-week-with-hamstring-injury

## CHI — Kalif Raymond proving to be reliable veteran target for Bears offense
- Family: player
- Reason: Named player feature supported by article text
- Fallback: None
- Graphic: {"family":"player","name":"Kalif Raymond"}
- name = "Kalif Raymond" ← headline: Kalif Raymond proving
- Source: https://www.chicagobears.com/news/kalif-raymond-proving-to-be-reliable-veteran-target-for-bears-offense

## CHI — Girls Flag Football Player of the Week: Claire Happ | Week 3
- Family: business-community
- Reason: Explicit community, school or youth context
- Fallback: None
- Graphic: {"family":"business-community","label":"COMMUNITY"}
- Source: https://www.chicagobears.com/news/girls-flag-football-player-of-the-week-claire-happ-week-3

## CHI — Bears heading to UK for 5-city tour in October
- Family: business-community
- Reason: Explicit community, school or youth context
- Fallback: None
- Graphic: {"family":"business-community","label":"COMMUNITY"}
- Source: https://www.chicagobears.com/news/bears-heading-to-uk-for-5-city-tour-in-october

## CHI — 9 interesting things said by Bears coordinators in advance of home opener
- Family: numbered
- Reason: Explicit numbered editorial format takes precedence
- Fallback: None
- Graphic: {"family":"numbered","count":"9","descriptor":"THINGS\nSAID"}
- count = "9" ← headline: 9 interesting things
- descriptor = "THINGS\nSAID" ← headline: 9 interesting things said by Bears coordinators in advance of home opener
- Source: https://www.chicagobears.com/news/9-interesting-things-said-by-bears-coordinators-in-advance-of-home-opener

## CHI — Colston Loveland's bounce-back game is all but assured vs. Vikings in Week 2
- Family: player
- Reason: Named player feature supported by article text
- Fallback: None
- Graphic: {"family":"player","name":"Colston Loveland","position":"TE"}
- name = "Colston Loveland" ← summary: tight end Colston Loveland
- position = "TE" ← summary: tight end Colston Loveland
- Source: https://beargoggleson.com/colston-loveland-s-bounce-back-game-is-all-but-assured-vs-vikings-in-week-2

## TB — Top Plays Breakdown: Scoring Drive Week 2
- Family: film
- Reason: Explicit film breakdown
- Fallback: None
- Graphic: {"family":"film"}
- Source: https://www.buccaneers.com/news/top-plays-breakdown-scoring-drive-week-2-2026

## TB — 2026 Bucs NFL Power Rankings Week 3
- Family: standard-b
- Reason: General analysis or insufficient evidence for a specific editorial format
- Fallback: General analysis or insufficient evidence for a specific editorial format
- Graphic: {"family":"standard-b"}
- Source: https://www.buccaneers.com/news/2026-bucs-nfl-power-rankings-week-3-2026

## TB — David Walker Takes Advantage of Opportunity Against Browns
- Family: player
- Reason: Named player feature supported by article text
- Fallback: None
- Graphic: {"family":"player","name":"David Walker","position":"OLB"}
- name = "David Walker" ← summary: outside linebacker David Walker
- position = "OLB" ← summary: outside linebacker David Walker
- Source: https://www.buccaneers.com/news/david-walker-takes-advantage-of-opportunity-against-browns

## TB — Bucs Control Ground Game in Loss to Browns | Data Crunch
- Family: stats
- Reason: Explicit statistics format; only sourced values displayed
- Fallback: None
- Graphic: {"family":"stats","descriptor":"BY THE\nNUMBERS","rows":[{"value":"5.5","label":"YARDS PER CARRY"}]}
- rows.0.value = "5.5" ← summary: 5.5 yards per carry
- rows.0.label = "YARDS PER CARRY" ← summary: 5.5 yards per carry
- Source: https://www.buccaneers.com/news/bucs-control-ground-game-in-loss-to-browns-data-crunch

## TB — 5 Notes Against the Browns | Week 2
- Family: numbered
- Reason: Explicit numbered editorial format takes precedence
- Fallback: None
- Graphic: {"family":"numbered","count":"5","descriptor":"NOTES"}
- count = "5" ← headline: 5 Notes
- descriptor = "NOTES" ← headline: 5 Notes Against the Browns | Week 2
- Source: https://www.buccaneers.com/news/5-notes-against-the-browns-week-2-2026
- Source: https://www.buccaneers.com/news/takeaways-from-buccaneers-browns-week-2

## TB — After Lightning Delay, Bucs Can't Land Final Strike in Loss to Browns
- Family: recap
- Reason: Recap without a verified score pair
- Fallback: None
- Graphic: {"family":"recap","teams":["TB","CLE"],"overtime":false}
- teams.0 = "TB" ← headline: After Lightning Delay, Bucs Can't Land Final Strike in Loss to Browns
- teams.1 = "CLE" ← headline: After Lightning Delay, Bucs Can't Land Final Strike in Loss to Browns
- Source: https://www.buccaneers.com/news/browns-bucs-week-2-recap-postgame-report-2026

## TB — Baker Mayfield: Bucs' Offense Is Close, Mistakes Are Frustrating
- Family: player
- Reason: Named player feature supported by article text
- Fallback: None
- Graphic: {"family":"player","name":"Baker Mayfield","position":"QB"}
- name = "Baker Mayfield" ← summary: QB Baker Mayfield
- position = "QB" ← summary: QB Baker Mayfield
- Source: https://www.buccaneers.com/news/baker-mayfield-bucs-offense-close-mistakes-frustrating

## TB — Rapid Reaction: Browns 23, Buccaneers 19
- Family: game-result
- Reason: Explicit named team-score pairs; no home/away inference
- Fallback: None
- Graphic: {"family":"game-result","leftTeam":"CLE","rightTeam":"TB","leftScore":23,"rightScore":19,"final":"FINAL"}
- family = "game-result" ← headline: Browns 23, Buccaneers 19
- leftTeam = "CLE" ← headline: Browns 23, Buccaneers 19
- rightTeam = "TB" ← headline: Browns 23, Buccaneers 19
- leftScore = 23 ← headline: Browns 23, Buccaneers 19
- rightScore = 19 ← headline: Browns 23, Buccaneers 19
- final = "FINAL" ← headline: Rapid Reaction: Browns 23, Buccaneers 19
- Source: https://www.buccaneers.com/news/bucs-lose-cleveland-browns-week-2-2026-score-23-19

## IND — Indiana Football Digest Insider 2026 - Week five recap
- Family: business-community
- Reason: Explicit community, school or youth context
- Fallback: None
- Graphic: {"family":"business-community","label":"COMMUNITY"}
- Source: https://www.colts.com/news/indiana-football-digest-insider-2026-week-five-recap

## IND — Colts place DE Micheal Clemons on injured reserve, release RB Anderson Castle from practice squad
- Family: roster-roundup
- Reason: Multiple or unspecified roster moves; no single signing asserted
- Fallback: None
- Graphic: {"family":"roster-roundup","team":"IND"}
- team = "IND" ← canonical: IND
- Source: https://www.colts.com/news/colts-place-de-micheal-clemons-on-injured-reserve-release-rb-anderson-castle-from-practice-squad
- Source: https://www.colts.com/news/colts-sign-wr-eli-pancol-to-practice-squad

## IND — McCutcheon's Michael Fenters named 2026 'Coach of the Week' for Week 5
- Family: business-community
- Reason: Explicit community, school or youth context
- Fallback: None
- Graphic: {"family":"business-community","label":"COMMUNITY"}
- Source: https://www.colts.com/news/indianapolis-colts-high-school-football-development-mccutcheon-michael-fenters-named-2026-coach-of-the-week-for-week-5

## IND — Colts sign wide receiver Darius Slayton
- Family: transaction
- Reason: Explicit player transaction
- Fallback: None
- Graphic: {"family":"transaction","team":"IND","action":"SIGNED","name":"Darius Slayton","position":"WR"}
- name = "Darius Slayton" ← headline: sign wide receiver Darius Slayton
- action = "SIGNED" ← headline: sign wide receiver Darius Slayton
- position = "WR" ← headline: wide receiver Darius Slayton
- team = "IND" ← canonical: IND
- Source: https://www.colts.com/news/colts-sign-wide-receiver-darius-slayton

## IND — Colts to debut 'Anvil Strike' Rivalries uniform for Sunday's game vs. Houston Texans
- Family: business-community
- Reason: Uniform/merchandise feature, not a game preview
- Fallback: None
- Graphic: {"family":"business-community","label":"TEAM\nSTYLE"}
- Source: https://www.colts.com/news/indianapolis-colts-vs-houston-texans-game-tickets-anvil-strike-uniform-nike-rivalries-jersey-nfl-2026-schedule-lucas-oil-stadium

## IND — Colts drop heartbreaker in Week 2 overtime loss to Kansas City Chiefs
- Family: recap
- Reason: Recap without a verified score pair
- Fallback: None
- Graphic: {"family":"recap","teams":["IND","KC"],"overtime":true}
- teams.0 = "IND" ← headline: Colts drop heartbreaker in Week 2 overtime loss to Kansas City Chiefs
- teams.1 = "KC" ← headline: Colts drop heartbreaker in Week 2 overtime loss to Kansas City Chiefs
- overtime = true ← headline: Colts drop heartbreaker in Week 2 overtime loss to Kansas City Chiefs
- Source: https://www.colts.com/news/colts-drop-heartbreaker-in-week-2-overtime-loss-to-kansas-city-chiefs
- Source: https://www.colts.com/news/5-colts-things-daniel-jones-offense-handle-steve-spagnuolo-s-blitzes-laquon-treadwell-steps-up-kapena-gushiken-flashes-in-week-2-loss-to-chiefs

## IND — Colts head coach Shane Steichen explains overtime strategy in loss to Chiefs: 'I was trying to finish the game with JT'
- Family: coaching
- Reason: Explicit coaching strategy
- Fallback: None
- Graphic: {"family":"coaching","label":"GAME\nPLAN"}
- Source: https://www.colts.com/news/colts-head-coach-shane-steichen-explains-overtime-strategy-in-loss-to-chiefs-i-was-trying-to-finish-the-game-with-jt

## IND — X-rays on left heel negative for WR Alec Pierce
- Family: player
- Reason: Named player injury status with original time/game context
- Fallback: None
- Graphic: {"family":"player","name":"Alec Pierce","position":"WR","status":"X-RAYS NEGATIVE"}
- name = "Alec Pierce" ← headline: WR Alec Pierce
- position = "WR" ← headline: WR Alec Pierce
- status = "X-RAYS NEGATIVE" ← headline: X-rays on left heel negative
- Source: https://www.colts.com/news/x-rays-on-left-heel-negative-for-wr-alec-pierce
