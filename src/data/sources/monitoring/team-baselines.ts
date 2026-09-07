import type { MonitoringSource } from '@/features/monitoring/types';

type TeamSourceProfile = {
  officialDomain: string;
  sbNation: { name: string; domain: string };
  fanSided: { name: string; domain: string };
};

export const TEAM_SOURCE_PROFILES: Record<string, TeamSourceProfile> = {
  ARI: {
    officialDomain: 'azcardinals.com',
    sbNation: { name: 'Revenge of the Birds', domain: 'revengeofthebirds.com' },
    fanSided: { name: 'Raising Zona', domain: 'raisingzona.com' },
  },
  ATL: {
    officialDomain: 'atlantafalcons.com',
    sbNation: { name: 'The Falcoholic', domain: 'thefalcoholic.com' },
    fanSided: { name: 'Blogging Dirty', domain: 'bloggingdirty.com' },
  },
  BAL: {
    officialDomain: 'baltimoreravens.com',
    sbNation: { name: 'Baltimore Beatdown', domain: 'baltimorebeatdown.com' },
    fanSided: { name: 'Ebony Bird', domain: 'ebonybird.com' },
  },
  BUF: {
    officialDomain: 'buffalobills.com',
    sbNation: { name: 'Buffalo Rumblings', domain: 'buffalorumblings.com' },
    fanSided: { name: 'BuffaLowDown', domain: 'buffalowdown.com' },
  },
  CAR: {
    officialDomain: 'panthers.com',
    sbNation: { name: 'Cat Scratch Reader', domain: 'catscratchreader.com' },
    fanSided: { name: 'Cat Crave', domain: 'catcrave.com' },
  },
  CHI: {
    officialDomain: 'chicagobears.com',
    sbNation: { name: 'Windy City Gridiron', domain: 'windycitygridiron.com' },
    fanSided: { name: 'Bear Goggles On', domain: 'beargoggleson.com' },
  },
  CIN: {
    officialDomain: 'bengals.com',
    sbNation: { name: 'Cincy Jungle', domain: 'cincyjungle.com' },
    fanSided: { name: 'Stripe Hype', domain: 'stripehype.com' },
  },
  CLE: {
    officialDomain: 'clevelandbrowns.com',
    sbNation: { name: 'Dawgs By Nature', domain: 'dawgsbynature.com' },
    fanSided: { name: 'Dawg Pound Daily', domain: 'dawgpounddaily.com' },
  },
  DAL: {
    officialDomain: 'dallascowboys.com',
    sbNation: { name: 'Blogging The Boys', domain: 'bloggingtheboys.com' },
    fanSided: { name: 'The Landry Hat', domain: 'thelandryhat.com' },
  },
  DEN: {
    officialDomain: 'denverbroncos.com',
    sbNation: { name: 'Mile High Report', domain: 'milehighreport.com' },
    fanSided: { name: 'Predominantly Orange', domain: 'predominantlyorange.com' },
  },
  DET: {
    officialDomain: 'detroitlions.com',
    sbNation: { name: 'Pride of Detroit', domain: 'prideofdetroit.com' },
    fanSided: { name: 'SideLion Report', domain: 'sidelionreport.com' },
  },
  GB: {
    officialDomain: 'packers.com',
    sbNation: { name: 'Acme Packing Company', domain: 'acmepackingcompany.com' },
    fanSided: { name: 'Lombardi Ave', domain: 'lombardiave.com' },
  },
  HOU: {
    officialDomain: 'houstontexans.com',
    sbNation: { name: 'Battle Red Blog', domain: 'battleredblog.com' },
    fanSided: { name: 'Toro Times', domain: 'torotimes.com' },
  },
  IND: {
    officialDomain: 'colts.com',
    sbNation: { name: 'Stampede Blue', domain: 'stampedeblue.com' },
    fanSided: { name: 'Horseshoe Heroes', domain: 'horseshoeheroes.com' },
  },
  JAX: {
    officialDomain: 'jaguars.com',
    sbNation: { name: 'Big Cat Country', domain: 'bigcatcountry.com' },
    fanSided: { name: 'Black and Teal', domain: 'blackandteal.com' },
  },
  KC: {
    officialDomain: 'chiefs.com',
    sbNation: { name: 'Arrowhead Pride', domain: 'arrowheadpride.com' },
    fanSided: { name: 'Arrowhead Addict', domain: 'arrowheadaddict.com' },
  },
  LV: {
    officialDomain: 'raiders.com',
    sbNation: { name: 'Silver and Black Pride', domain: 'silverandblackpride.com' },
    fanSided: { name: 'Just Blog Baby', domain: 'justblogbaby.com' },
  },
  LAC: {
    officialDomain: 'chargers.com',
    sbNation: { name: 'Bolts From The Blue', domain: 'boltsfromtheblue.com' },
    fanSided: { name: 'Bolt Beat', domain: 'boltbeat.com' },
  },
  LAR: {
    officialDomain: 'therams.com',
    sbNation: { name: 'Turf Show Times', domain: 'turfshowtimes.com' },
    fanSided: { name: "Ramblin' Fan", domain: 'ramblinfan.com' },
  },
  MIA: {
    officialDomain: 'miamidolphins.com',
    sbNation: { name: 'The Phinsider', domain: 'thephinsider.com' },
    fanSided: { name: 'Phin Phanatic', domain: 'phinphanatic.com' },
  },
  MIN: {
    officialDomain: 'vikings.com',
    sbNation: { name: 'Daily Norseman', domain: 'dailynorseman.com' },
    fanSided: { name: 'The Viking Age', domain: 'thevikingage.com' },
  },
  NE: {
    officialDomain: 'patriots.com',
    sbNation: { name: 'Pats Pulpit', domain: 'patspulpit.com' },
    fanSided: { name: 'Musket Fire', domain: 'musketfire.com' },
  },
  NO: {
    officialDomain: 'neworleanssaints.com',
    sbNation: { name: 'Canal Street Chronicles', domain: 'canalstreetchronicles.com' },
    fanSided: { name: 'Who Dat Dish', domain: 'whodatdish.com' },
  },
  NYG: {
    officialDomain: 'giants.com',
    sbNation: { name: 'Big Blue View', domain: 'bigblueview.com' },
    fanSided: { name: 'GMEN HQ', domain: 'gmenhq.com' },
  },
  NYJ: {
    officialDomain: 'newyorkjets.com',
    sbNation: { name: 'Gang Green Nation', domain: 'ganggreennation.com' },
    fanSided: { name: 'The Jet Press', domain: 'thejetpress.com' },
  },
  PHI: {
    officialDomain: 'philadelphiaeagles.com',
    sbNation: { name: 'Bleeding Green Nation', domain: 'bleedinggreennation.com' },
    fanSided: { name: 'Inside the Iggles', domain: 'insidetheiggles.com' },
  },
  PIT: {
    officialDomain: 'steelers.com',
    sbNation: { name: 'Behind the Steel Curtain', domain: 'behindthesteelcurtain.com' },
    fanSided: { name: 'Still Curtain', domain: 'stillcurtain.com' },
  },
  SEA: {
    officialDomain: 'seahawks.com',
    sbNation: { name: 'Field Gulls', domain: 'fieldgulls.com' },
    fanSided: { name: '12th Man Rising', domain: '12thmanrising.com' },
  },
  SF: {
    officialDomain: '49ers.com',
    sbNation: { name: 'Niners Nation', domain: 'ninersnation.com' },
    fanSided: { name: 'Niner Noise', domain: 'ninernoise.com' },
  },
  TB: {
    officialDomain: 'buccaneers.com',
    sbNation: { name: 'Bucs Nation', domain: 'bucsnation.com' },
    fanSided: { name: 'The Pewter Plank', domain: 'thepewterplank.com' },
  },
  TEN: {
    officialDomain: 'tennesseetitans.com',
    sbNation: { name: 'Music City Miracles', domain: 'musiccitymiracles.com' },
    fanSided: { name: 'Titan Sized', domain: 'titansized.com' },
  },
  WAS: {
    officialDomain: 'commanders.com',
    sbNation: { name: 'Hogs Haven', domain: 'hogshaven.com' },
    fanSided: { name: "Riggo's Rag", domain: 'riggosrag.com' },
  },
};

const nationalReporters = [
  ['IAN_RAPOPORT_X', 'Ian Rapoport', 'RapSheet', 98],
  ['MIKE_GARAFOLO_X', 'Mike Garafolo', 'MikeGarafolo', 96],
  ['ADAM_SCHEFTER_X', 'Adam Schefter', 'AdamSchefter', 98],
  ['TOM_PELISSERO_X', 'Tom Pelissero', 'TomPelissero', 98],
  ['JEREMY_FOWLER_X', 'Jeremy Fowler', 'JFowlerESPN', 94],
] as const;

const availability = (requiredEnvironment: string[]) =>
  requiredEnvironment.every((key) => Boolean(process.env[key]))
    ? 'LIVE'
    : 'CONFIGURED_BUT_UNAVAILABLE';

export function buildTeamBaselineSources(teamId: string): MonitoringSource[] {
  const profile = TEAM_SOURCE_PROFILES[teamId];
  if (!profile) return [];
  const rss = (
    id: string,
    name: string,
    domain: string,
    feedPath: string,
    tier: 1 | 2,
    authorityWeight: number,
    publishAll = false,
  ): MonitoringSource => ({
    id: `${teamId}_${id}`,
    name,
    teamId,
    tier,
    platform: 'RSS',
    canonicalUrl: `https://www.${domain}/`,
    ingestionMethod: 'RSS_ATOM',
    deliveryStrategy: 'POLL',
    cadenceSeconds: tier === 1 ? 300 : 600,
    authorityWeight,
    active: true,
    notificationEligible: tier === 1,
    requiredEnvironment: [],
    availability: 'LIVE',
    metadata: { feedUrl: `https://www.${domain}${feedPath}`, publishAll },
  });

  return [
    rss('OFFICIAL_NEWS', 'Official team news', profile.officialDomain, '/rss/news', 1, 100),
    rss('SB_NATION', profile.sbNation.name, profile.sbNation.domain, '/rss/index.xml', 2, 80, true),
    rss('FANSIDED', profile.fanSided.name, profile.fanSided.domain, '/feed/', 2, 72, true),
  ];
}

export const NATIONAL_TIER_ONE_SOURCES: MonitoringSource[] = nationalReporters.map(
  ([id, name, handle, authorityWeight]) => {
    const requiredEnvironment = ['X_BEARER_TOKEN', 'X_INGESTOR_ENABLED'];
    return {
      id,
      name,
      teamId: 'NFL',
      tier: 1,
      platform: 'X',
      canonicalUrl: `https://x.com/${handle}`,
      ingestionMethod: 'X_API',
      deliveryStrategy: 'STREAM',
      cadenceSeconds: null,
      authorityWeight,
      active: true,
      notificationEligible: true,
      requiredEnvironment,
      availability: availability(requiredEnvironment),
      metadata: { handle },
    } satisfies MonitoringSource;
  },
);
