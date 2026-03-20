import { getRandomTeamPhrase, getTeamFlavor, getTeamReactionLine } from '@/lib/team-flavor';

export const teamChants = Object.fromEntries(
  Object.entries({
    ARI: getTeamFlavor('ARI'),
    ATL: getTeamFlavor('ATL'),
    BAL: getTeamFlavor('BAL'),
    BUF: getTeamFlavor('BUF'),
    CAR: getTeamFlavor('CAR'),
    CHI: getTeamFlavor('CHI'),
    CIN: getTeamFlavor('CIN'),
    CLE: getTeamFlavor('CLE'),
    DAL: getTeamFlavor('DAL'),
    DEN: getTeamFlavor('DEN'),
    DET: getTeamFlavor('DET'),
    GB: getTeamFlavor('GB'),
    HOU: getTeamFlavor('HOU'),
    IND: getTeamFlavor('IND'),
    JAX: getTeamFlavor('JAX'),
    KC: getTeamFlavor('KC'),
    LAC: getTeamFlavor('LAC'),
    LAR: getTeamFlavor('LAR'),
    LV: getTeamFlavor('LV'),
    MIA: getTeamFlavor('MIA'),
    MIN: getTeamFlavor('MIN'),
    NE: getTeamFlavor('NE'),
    NO: getTeamFlavor('NO'),
    NYG: getTeamFlavor('NYG'),
    NYJ: getTeamFlavor('NYJ'),
    PHI: getTeamFlavor('PHI'),
    PIT: getTeamFlavor('PIT'),
    SEA: getTeamFlavor('SEA'),
    SF: getTeamFlavor('SF'),
    TB: getTeamFlavor('TB'),
    TEN: getTeamFlavor('TEN'),
    WAS: getTeamFlavor('WAS'),
  }).map(([teamAbbr, flavor]) => [
    teamAbbr,
    {
      chant: flavor.fanbaseName ?? flavor.identityLabel,
      hype: flavor.positiveReactions,
    },
  ]),
);

export const getTeamCatchphrase = (teamAbbr?: string | null): string => {
  const flavor = getTeamFlavor(teamAbbr);
  return getRandomTeamPhrase(teamAbbr, 'fanPhrases') || flavor.fanbaseName || flavor.identityLabel;
};

export const getTeamHypeLine = (
  teamAbbr?: string | null,
  tone: 'positive' | 'celebratory' | 'confident' = 'positive',
): string => getTeamReactionLine(teamAbbr, tone);
