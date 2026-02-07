import AppShell from '@/components/app-shell';
import { CapSpaceTable, type CapSpaceRow } from '@/components/cap-space-table';
import { TEAM_LIST } from '@/data/teams';

const DATA: CapSpaceRow[] = [
  {
    teamName: 'Titans',
    teamAbbr: 'TEN',
    capSpace: 104_769_062,
    effectiveCapSpace: 93_334_968,
    activeCount: 51,
    activeCapSpending: 220_791_308,
    deadMoney: 535_658,
  },
  {
    teamName: 'Raiders',
    teamAbbr: 'LV',
    capSpace: 91_522_807,
    effectiveCapSpace: 76_991_010,
    activeCount: 49,
    activeCapSpending: 189_413_472,
    deadMoney: 34_812_266,
  },
  {
    teamName: 'Chargers',
    teamAbbr: 'LAC',
    capSpace: 83_542_941,
    effectiveCapSpace: 79_237_966,
    activeCount: 52,
    activeCapSpending: 223_098_367,
    deadMoney: 478_177,
  },
  {
    teamName: 'Jets',
    teamAbbr: 'NYJ',
    capSpace: 83_263_050,
    effectiveCapSpace: 67_378_542,
    activeCount: 58,
    activeCapSpending: 167_404_312,
    deadMoney: 75_621_438,
  },
  {
    teamName: 'Commanders',
    teamAbbr: 'WAS',
    capSpace: 76_041_469,
    effectiveCapSpace: 69_297_314,
    activeCount: 52,
    activeCapSpending: 255_706_956,
    deadMoney: 248_312,
  },
  {
    teamName: 'Seahawks',
    teamAbbr: 'SEA',
    capSpace: 73_284_461,
    effectiveCapSpace: 63_013_830,
    activeCount: 43,
    activeCapSpending: 243_166_022,
    deadMoney: 483_723,
  },
  {
    teamName: 'Bengals',
    teamAbbr: 'CIN',
    capSpace: 54_504_672,
    effectiveCapSpace: 47_378_106,
    activeCount: 62,
    activeCapSpending: 253_492_416,
    deadMoney: 4_748_222,
  },
  {
    teamName: 'Rams',
    teamAbbr: 'LAR',
    capSpace: 48_214_355,
    effectiveCapSpace: 40_769_897,
    activeCount: 53,
    activeCapSpending: 266_058_212,
    deadMoney: 700_524,
  },
  {
    teamName: 'Steelers',
    teamAbbr: 'PIT',
    capSpace: 44_943_582,
    effectiveCapSpace: 39_307_535,
    activeCount: 62,
    activeCapSpending: 267_058_786,
    deadMoney: 7_934_338,
  },
  {
    teamName: '49ers',
    teamAbbr: 'SF',
    capSpace: 42_950_176,
    effectiveCapSpace: 38_552_959,
    activeCount: 61,
    activeCapSpending: 269_621_623,
    deadMoney: 21_863_741,
  },
  {
    teamName: 'Patriots',
    teamAbbr: 'NE',
    capSpace: 42_735_263,
    effectiveCapSpace: 37_744_226,
    activeCount: 50,
    activeCapSpending: 290_735_831,
    deadMoney: 20_790_382,
  },
  {
    teamName: 'Cardinals',
    teamAbbr: 'ARI',
    capSpace: 42_187_426,
    effectiveCapSpace: 30_663_033,
    activeCount: 61,
    activeCapSpending: 274_012_155,
    deadMoney: 3_934_104,
  },
  {
    teamName: 'Colts',
    teamAbbr: 'IND',
    capSpace: 35_598_489,
    effectiveCapSpace: 33_584_759,
    activeCount: 60,
    activeCapSpending: 268_433_497,
    deadMoney: 2_093_644,
  },
  {
    teamName: 'Broncos',
    teamAbbr: 'DEN',
    capSpace: 28_885_734,
    effectiveCapSpace: 24_848_957,
    activeCount: 54,
    activeCapSpending: 276_377_391,
    deadMoney: 1_218_922,
  },
  {
    teamName: 'Falcons',
    teamAbbr: 'ATL',
    capSpace: 26_462_519,
    effectiveCapSpace: 24_638_551,
    activeCount: 51,
    activeCapSpending: 278_755_644,
    deadMoney: 2_235_354,
  },
  {
    teamName: 'Buccaneers',
    teamAbbr: 'TB',
    capSpace: 23_828_710,
    effectiveCapSpace: 18_268_258,
    activeCount: 52,
    activeCapSpending: 293_252_073,
    deadMoney: 255_591,
  },
  {
    teamName: 'Ravens',
    teamAbbr: 'BAL',
    capSpace: 22_043_387,
    effectiveCapSpace: 13_370_416,
    activeCount: 48,
    activeCapSpending: 279_554_158,
    deadMoney: 12_262_715,
  },
  {
    teamName: 'Eagles',
    teamAbbr: 'PHI',
    capSpace: 20_557_388,
    effectiveCapSpace: 15_463_440,
    activeCount: 65,
    activeCapSpending: 250_816_635,
    deadMoney: 44_804_213,
  },
  {
    teamName: 'Panthers',
    teamAbbr: 'CAR',
    capSpace: 14_437_004,
    effectiveCapSpace: 9_552_110,
    activeCount: 55,
    activeCapSpending: 290_819_573,
    deadMoney: 9_341_094,
  },
  {
    teamName: 'Giants',
    teamAbbr: 'NYG',
    capSpace: 6_947_721,
    effectiveCapSpace: -3_151_579,
    activeCount: 57,
    activeCapSpending: 296_689_591,
    deadMoney: 216_804,
  },
  {
    teamName: 'Browns',
    teamAbbr: 'CLE',
    capSpace: 3_210_721,
    effectiveCapSpace: -9_062_737,
    activeCount: 56,
    activeCapSpending: 294_358_677,
    deadMoney: 31_763_848,
  },
  {
    teamName: 'Texans',
    teamAbbr: 'HOU',
    capSpace: -1_403_295,
    effectiveCapSpace: -7_242_447,
    activeCount: 59,
    activeCapSpending: 292_766_079,
    deadMoney: 20_922_780,
  },
  {
    teamName: 'Packers',
    teamAbbr: 'GB',
    capSpace: -1_436_657,
    effectiveCapSpace: -3_227_425,
    activeCount: 66,
    activeCapSpending: 297_096_029,
    deadMoney: 17_165_048,
  },
  {
    teamName: 'Bears',
    teamAbbr: 'CHI',
    capSpace: -5_300_354,
    effectiveCapSpace: -9_492_768,
    activeCount: 57,
    activeCapSpending: 316_976_069,
    deadMoney: 542_993,
  },
  {
    teamName: 'Saints',
    teamAbbr: 'NO',
    capSpace: -6_037_060,
    effectiveCapSpace: -13_638_724,
    activeCount: 66,
    activeCapSpending: 261_530_600,
    deadMoney: 65_798_682,
  },
  {
    teamName: 'Bills',
    teamAbbr: 'BUF',
    capSpace: -7_449_001,
    effectiveCapSpace: -11_553_061,
    activeCount: 61,
    activeCapSpending: 310_227_823,
    deadMoney: 432_166,
  },
  {
    teamName: 'Lions',
    teamAbbr: 'DET',
    capSpace: -8_531_146,
    effectiveCapSpace: -13_241_217,
    activeCount: 54,
    activeCapSpending: 327_944_798,
    deadMoney: 4_358_290,
  },
  {
    teamName: 'Jaguars',
    teamAbbr: 'JAX',
    capSpace: -11_433_472,
    effectiveCapSpace: -13_918_041,
    activeCount: 60,
    activeCapSpending: 279_610_798,
    deadMoney: 43_863_713,
  },
  {
    teamName: 'Dolphins',
    teamAbbr: 'MIA',
    capSpace: -16_223_613,
    effectiveCapSpace: -23_556_987,
    activeCount: 53,
    activeCapSpending: 291_541_923,
    deadMoney: 35_500_637,
  },
  {
    teamName: 'Cowboys',
    teamAbbr: 'DAL',
    capSpace: -29_168_257,
    effectiveCapSpace: -36_673_481,
    activeCount: 56,
    activeCapSpending: 333_651_367,
    deadMoney: 24_344_177,
  },
  {
    teamName: 'Vikings',
    teamAbbr: 'MIN',
    capSpace: -40_156_353,
    effectiveCapSpace: -45_185_362,
    activeCount: 54,
    activeCapSpending: 351_724_552,
    deadMoney: 5_608_074,
  },
  {
    teamName: 'Chiefs',
    teamAbbr: 'KC',
    capSpace: -54_910_166,
    effectiveCapSpace: -62_115_065,
    activeCount: 53,
    activeCapSpending: 358_386_941,
    deadMoney: 215_641,
  },
];

const teamsByAbbr = TEAM_LIST.reduce<Record<string, (typeof TEAM_LIST)[number]>>((acc, team) => {
  acc[team.abbr] = team;
  return acc;
}, {});

const sortByEffective = (rows: CapSpaceRow[]) =>
  [...rows].sort((a, b) => b.effectiveCapSpace - a.effectiveCapSpace);

const normalizeCapSpace = (rows: CapSpaceRow[]): CapSpaceRow[] =>
  rows.map((row) => ({
    ...row,
    effectiveCapSpace: row.capSpace,
  }));

export default function CapSpacePage() {
  const normalized = normalizeCapSpace(DATA);
  const available = sortByEffective(normalized.filter((row) => row.effectiveCapSpace >= 0));
  const overCap = sortByEffective(normalized.filter((row) => row.effectiveCapSpace < 0));

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">NFL Cap Space Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective cap space includes top-51 rule adjustments.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Cap Space Available</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {available.length} teams
            </span>
          </div>
          <CapSpaceTable rows={available} teamsByAbbr={teamsByAbbr} />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Over the Cap</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {overCap.length} teams
            </span>
          </div>
          <CapSpaceTable rows={overCap} teamsByAbbr={teamsByAbbr} />
        </section>
      </div>
    </AppShell>
  );
}
