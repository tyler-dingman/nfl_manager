export type Area = 'stadium' | 'facilities' | 'fans' | 'business';
export type Impact = 'fans' | 'revenue' | 'development' | 'recovery' | 'appeal' | 'community';
export type Project = {
  id: string;
  name: string;
  area: Area;
  cost: number;
  weeks: number;
  description: string;
  impacts: Partial<Record<Impact, number>>;
};
const project = (
  id: string,
  name: string,
  area: Area,
  cost: number,
  weeks: number,
  description: string,
  impacts: Project['impacts'],
): Project => ({ id, name, area, cost, weeks, description, impacts });
export const PROJECTS: Project[] = [
  project(
    'wifi',
    'Wi-Fi & connectivity',
    'stadium',
    8,
    4,
    'Upgrade coverage throughout the concourse and seating bowl.',
    { fans: 3 },
  ),
  project(
    'suites',
    'Premium suites',
    'stadium',
    30,
    16,
    'Refit premium hospitality spaces and expand suite inventory.',
    { fans: 2, revenue: 8 },
  ),
  project(
    'concessions',
    'Concessions',
    'stadium',
    12,
    6,
    'Add service lanes and modernize kitchens to reduce queues.',
    { fans: 4, revenue: 3 },
  ),
  project(
    'restrooms',
    'Restrooms',
    'stadium',
    10,
    6,
    'Improve capacity, cleanliness and family facilities.',
    { fans: 4 },
  ),
  project('boards', 'Video boards', 'stadium', 18, 8, 'Improve sightlines and replay coverage.', {
    fans: 3,
  }),
  project('club', 'Club seating', 'stadium', 24, 12, 'Upgrade seating and club lounges.', {
    fans: 2,
    revenue: 5,
  }),
  project(
    'gates',
    'Entry gates',
    'stadium',
    7,
    4,
    'Reduce queues with additional secure entry lanes.',
    { fans: 3 },
  ),
  project(
    'sound',
    'Sound system',
    'stadium',
    6,
    4,
    'Improve sound coverage without increasing peak volume.',
    { fans: 2 },
  ),
  project(
    'markets',
    'Grab & Go markets',
    'stadium',
    9,
    6,
    'Create fast-service food and beverage markets.',
    { fans: 3, revenue: 2 },
  ),
  project(
    'access',
    'Accessibility',
    'stadium',
    10,
    6,
    'Improve accessible routes, seating and guest services.',
    { fans: 4, community: 2 },
  ),
  project(
    'renovate',
    'Renovate current stadium',
    'stadium',
    140,
    52,
    'Modernize the existing stadium while preserving its identity.',
    { fans: 10, revenue: 12 },
  ),
  project(
    'expand',
    'Expand current stadium',
    'stadium',
    220,
    78,
    'Add seating capacity and improve the surrounding district.',
    { fans: 8, revenue: 22 },
  ),
  project(
    'new-stadium',
    'Build new stadium',
    'stadium',
    1200,
    156,
    'Develop a new home with modern fan and player amenities.',
    { fans: 20, revenue: 55, appeal: 10 },
  ),
  project(
    'training',
    'Training facility',
    'facilities',
    22,
    12,
    'Upgrade player preparation and coaching spaces.',
    { development: 6, appeal: 3 },
  ),
  project(
    'weights',
    'Weight room',
    'facilities',
    8,
    6,
    'Replace equipment and expand strength training space.',
    { development: 3, recovery: 2 },
  ),
  project(
    'medical',
    'Medical center',
    'facilities',
    18,
    10,
    'Expand treatment rooms and diagnostic resources.',
    { recovery: 6, appeal: 3 },
  ),
  project('recovery', 'Recovery', 'facilities', 12, 8, 'Add hydrotherapy and recovery spaces.', {
    recovery: 5,
  }),
  project(
    'nutrition',
    'Nutrition',
    'facilities',
    6,
    4,
    'Improve dining, nutritional support and personalized meal planning.',
    { recovery: 2, appeal: 3 },
  ),
  project(
    'amenities',
    'Player amenities',
    'facilities',
    10,
    6,
    'Upgrade locker rooms and family support spaces.',
    { appeal: 6 },
  ),
  project(
    'fields',
    'Practice fields',
    'facilities',
    16,
    10,
    'Improve surfaces and all-weather practice access.',
    { development: 4, recovery: 2 },
  ),
  project('scouting', 'Scouting', 'facilities', 8, 6, 'Upgrade film and scouting workspaces.', {
    development: 4,
  }),
  project(
    'technology',
    'Facility technology',
    'facilities',
    9,
    6,
    'Improve performance analysis and staff collaboration tools.',
    { development: 3, recovery: 2 },
  ),
  project(
    'offices',
    'Team offices',
    'facilities',
    5,
    4,
    'Modernize staff workspaces and administrative operations.',
    { revenue: 1, appeal: 2 },
  ),
  project(
    'transit',
    'Parking & transit initiative',
    'fans',
    25,
    12,
    'Improve arrival routes and support local game-day transit.',
    { fans: 4, community: 3 },
  ),
  project(
    'community',
    'Community investment fund',
    'fans',
    5,
    4,
    'Fund local youth football and community access programs.',
    { fans: 3, community: 8 },
  ),
  project(
    'digital',
    'Digital fan access',
    'fans',
    3,
    3,
    'Launch behind-the-scenes programming and player Q&As.',
    { fans: 3, community: 2 },
  ),
  project(
    'merch',
    'Merchandise refresh',
    'business',
    4,
    4,
    'Create a new team merchandise collection and improve online retail.',
    { revenue: 3, fans: 1 },
  ),
];
export const MAJOR_PROJECTS = ['renovate', 'expand', 'new-stadium'];
export const SPONSORS = [
  {
    id: 'naming',
    name: 'Horizon Field',
    company: 'Horizon Collective',
    annual: 18,
    years: 8,
    description: 'Stadium naming rights and district signage.',
  },
  {
    id: 'technology-partner',
    name: 'Pinnacle Digital',
    company: 'Pinnacle Digital',
    annual: 7,
    years: 3,
    description: 'Technology partnership and digital fan activations.',
  },
  {
    id: 'community-partner',
    name: 'Veridian Community',
    company: 'Veridian Community',
    annual: 4,
    years: 3,
    description: 'Community programs and local event partnership.',
  },
];
export type OwnershipSnapshot = {
  year: number;
  value: number;
  fans: number;
  grade: number;
  record?: { wins: number; losses: number; ties: number };
};
export type OwnershipState = {
  snapshots?: Record<number, OwnershipSnapshot>;
  lastSettledYear?: number;
  version: 1;
  startedYear: number;
  capital: number;
  ticketPrice: number;
  projects: { id: string; start: number; due: number; completed: boolean }[];
  partnerships: { id: string; year: number }[];
  history: { id: string; year: number; text: string; cost: number }[];
};
export const initialOwnership = (year: number): OwnershipState => ({
  version: 1,
  startedYear: year,
  capital: 186,
  ticketPrice: 100,
  projects: [],
  partnerships: [],
  history: [],
});
export function ownershipMetrics(state: OwnershipState, year: number) {
  const effects: Record<Impact, number> = {
    fans: 0,
    revenue: 0,
    development: 0,
    recovery: 0,
    appeal: 0,
    community: 0,
  };
  state.projects
    .filter((p) => p.completed)
    .forEach((p) => {
      const definition = PROJECTS.find((d) => d.id === p.id);
      Object.entries(definition?.impacts ?? {}).forEach(([k, v]) => {
        effects[k as Impact] += v;
      });
    });
  const activePartners = state.partnerships.filter(
    (p) => year < p.year + (SPONSORS.find((s) => s.id === p.id)?.years ?? 0),
  );
  const partnershipRevenue = activePartners.reduce(
    (n, p) => n + (SPONSORS.find((s) => s.id === p.id)?.annual ?? 0),
    0,
  );
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const fans = clamp(78 + effects.fans - (state.ticketPrice - 100) * 0.15);
  const revenue = 546 + effects.revenue + partnershipRevenue + (state.ticketPrice - 100) * 0.8;
  return {
    effects,
    fans,
    sentiment: clamp(fans + 4),
    attendance: clamp(86 + (fans - 78) * 0.4),
    renewal: clamp(84 + (fans - 78) * 0.6),
    community: clamp(72 + effects.community),
    affordability: clamp(85 - (state.ticketPrice - 100) * 0.4),
    facilities: clamp(68 + (effects.development + effects.recovery + effects.appeal) / 3),
    development: clamp(65 + effects.development),
    recovery: clamp(65 + effects.recovery),
    appeal: clamp(68 + effects.appeal),
    revenue,
    income: revenue - 430,
    value: 6400 + (revenue - 546) * 12,
    activePartners,
  };
}
export type OwnershipAction =
  | { type: 'approve'; id: string }
  | { type: 'partner'; id: string }
  | { type: 'ticket'; price: number }
  | { type: 'advance' }
  | { type: 'record'; record: { wins: number; losses: number; ties: number } };
export function ownershipReducer(
  state: OwnershipState,
  action: OwnershipAction,
  year: number,
  week: number,
): OwnershipState {
  const clock = year * 52 + week;
  if (action.type === 'record') {
    const m = ownershipMetrics(state, year);
    const grades = reportCard(state, year);
    const snapshot = {
      year,
      value: m.value,
      fans: m.sentiment,
      grade: Math.round(grades.reduce((n, g) => n + g.score, 0) / grades.length),
      record: action.record,
    };
    if (JSON.stringify(state.snapshots?.[year]) === JSON.stringify(snapshot)) return state;
    return { ...state, snapshots: { ...state.snapshots, [year]: snapshot } };
  }
  const history = (text: string, cost = 0) => [
    { id: `${action.type}-${clock}-${state.history.length}`, year, text, cost },
    ...state.history,
  ];
  if (action.type === 'approve') {
    const p = PROJECTS.find((p) => p.id === action.id);
    if (!p || state.projects.some((x) => x.id === p.id) || state.capital < p.cost) return state;
    return {
      ...state,
      capital: state.capital - p.cost,
      projects: [
        ...state.projects,
        { id: p.id, start: clock, due: clock + p.weeks, completed: false },
      ],
      history: history(`Approved ${p.name}`, p.cost),
    };
  }
  if (action.type === 'partner') {
    const p = SPONSORS.find((p) => p.id === action.id);
    if (!p || state.partnerships.some((x) => x.id === p.id && year < x.year + p.years))
      return state;
    return {
      ...state,
      capital: state.capital + p.annual,
      partnerships: [...state.partnerships.filter((x) => x.id !== p.id), { id: p.id, year }],
      history: history(`Signed ${p.company}: ${p.years} years, $${p.annual}M annually`, -p.annual),
    };
  }
  if (action.type === 'ticket') {
    if (
      !Number.isFinite(action.price) ||
      action.price < 50 ||
      action.price > 250 ||
      action.price === state.ticketPrice
    )
      return state;
    return {
      ...state,
      ticketPrice: action.price,
      history: history(`Set average ticket price to $${action.price}`),
    };
  }
  const settled = state.lastSettledYear ?? state.startedYear;
  if (year > settled) {
    const entries = [];
    let earnings = 0;
    for (let season = settled; season < year; season++) {
      const income = ownershipMetrics(state, season).income;
      earnings += income;
      entries.push({
        id: `financial-${season}`,
        year: season,
        text: `Closed ${season}: $${income.toFixed(1)}M operating income added to capital`,
        cost: 0,
      });
    }
    state = {
      ...state,
      capital: state.capital + earnings,
      lastSettledYear: year,
      history: [...entries.reverse(), ...state.history],
    };
  }
  const completed = state.projects.filter((p) => !p.completed && p.due <= clock);
  if (!completed.length) return state;
  return {
    ...state,
    projects: state.projects.map((p) => ({ ...p, completed: p.completed || p.due <= clock })),
    history: [
      ...completed.map((p) => ({
        id: `complete-${p.id}`,
        year,
        text: `Completed ${PROJECTS.find((d) => d.id === p.id)?.name}`,
        cost: 0,
      })),
      ...state.history,
    ],
  };
}
export const gradeFor = (score: number) =>
  score >= 93
    ? 'A'
    : score >= 87
      ? 'A−'
      : score >= 80
        ? 'B+'
        : score >= 74
          ? 'B'
          : score >= 68
            ? 'C+'
            : score >= 60
              ? 'C'
              : 'D';
export function reportCard(state: OwnershipState, year: number) {
  const m = ownershipMetrics(state, year);
  return [
    ['Treatment of Families', 68 + m.effects.appeal, 'amenities'],
    ['Food / Dining', 70 + m.effects.recovery / 2, 'nutrition'],
    ['Nutrition', 72 + m.effects.recovery / 2, 'nutrition'],
    ['Locker Room', 65 + m.effects.appeal, 'amenities'],
    ['Training Room', 66 + m.effects.recovery, 'medical'],
    ['Training Staff', 72 + m.effects.development / 2, 'training'],
    ['Weight Room', 68 + m.effects.development, 'weights'],
    ['Ownership', m.sentiment, 'community'],
    ['Facilities', m.facilities, 'training'],
  ].map(([name, score, projectId]) => ({
    name: String(name),
    score: Math.min(100, Number(score)),
    grade: gradeFor(Number(score)),
    projectId: String(projectId),
  }));
}
