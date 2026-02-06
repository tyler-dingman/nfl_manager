export type AgentPersonaKey =
  | 'TEAM_FIRST'
  | 'MARKET_HAWK'
  | 'LONG_TERM_SECURITY'
  | 'BET_ON_SELF'
  | 'VETERAN_COMFORT';

export type AgentPersona = {
  key: AgentPersonaKey;
  label: string;
  expectedApyMultiplier: number;
  expectedGuaranteedPctTarget: number;
  yearsPreference: { min: number; max: number };
  discountTolerance: number;
};

export const AGENT_PERSONAS: AgentPersona[] = [
  {
    key: 'TEAM_FIRST',
    label: 'Team First',
    expectedApyMultiplier: 0.98,
    expectedGuaranteedPctTarget: 0.45,
    yearsPreference: { min: 1, max: 3 },
    discountTolerance: 0.92,
  },
  {
    key: 'MARKET_HAWK',
    label: 'Market Hawk',
    expectedApyMultiplier: 1.05,
    expectedGuaranteedPctTarget: 0.5,
    yearsPreference: { min: 2, max: 4 },
    discountTolerance: 0.98,
  },
  {
    key: 'LONG_TERM_SECURITY',
    label: 'Long Term Security',
    expectedApyMultiplier: 1.02,
    expectedGuaranteedPctTarget: 0.6,
    yearsPreference: { min: 3, max: 4 },
    discountTolerance: 0.95,
  },
  {
    key: 'BET_ON_SELF',
    label: 'Bet On Self',
    expectedApyMultiplier: 1.0,
    expectedGuaranteedPctTarget: 0.35,
    yearsPreference: { min: 1, max: 2 },
    discountTolerance: 0.94,
  },
  {
    key: 'VETERAN_COMFORT',
    label: 'Veteran Comfort',
    expectedApyMultiplier: 0.96,
    expectedGuaranteedPctTarget: 0.4,
    yearsPreference: { min: 1, max: 2 },
    discountTolerance: 0.9,
  },
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getAgentPersonaForPlayer = (playerId: string): AgentPersona => {
  const index = hashString(playerId) % AGENT_PERSONAS.length;
  return AGENT_PERSONAS[index] ?? AGENT_PERSONAS[0];
};
