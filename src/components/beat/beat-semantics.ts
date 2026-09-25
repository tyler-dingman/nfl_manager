/** Primary editorial intent, shared by classification and canonical game enrichment. */
export const gameInfoPattern =
  /(?:how|where) to (?:watch|listen|stream)|watch and stream|important fan information|game (?:preview|information|info)|know before you go|what to know before|(?:Sunday|Monday|Thursday)(?: night)?['’]s game|broadcast information|kickoff information|stadium arrival|(?:parking|game.day) (?:information|logistics)|viewing information/i;
export const playerStatusPattern =
  /questionable|doubtful|ruled? out|week-to-week|day-to-day|return(?:s|ing)? to practice|expected to (?:play|start)|limited (?:participant|participation)|injury|injured reserve|season-ending|sidelined|x-rays|did not participate|not practicing|won['’]t play|will not play|(?:in)?active for|named starting|cleared to (?:play|practice)|\bDNP\b/i;
export const playerFeaturePattern =
  /emergence|career|\brole\b|performance|develop(?:ment|ing)|opportunity|workload|comeback|breakout|progression|profile|background|\brise\b|earned.*trust|became.*hit|takes advantage|succeed|reliable|bounce-back|proving|offense is close/i;
export const analysisPattern =
  /\bwhy\b|what .*(?:tells? us|means? for)|whether|sustainab|biggest questions|\banalysis\b|breaking down|takeaways|observations|lessons|evaluat|assess|\bformula\b|what .*weeks? tell|what we learned|the breakdown|how .* can |\b(?:offense|defense|secondary|run game)\b.*(?:struggling|improv|identity|growth)|\b(?:offense|defense)\b.*(?:close|potential)|\bsustainable\b/i;
