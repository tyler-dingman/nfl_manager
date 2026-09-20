import type { AnswerSource } from '@/features/search/answer-types';
export type SearchTransaction = {
  name: string;
  date: string;
  from: string | null;
  to: string | null;
  description: string;
  source: AnswerSource;
};
const aliases: Record<string, string> = { LA: 'LAR', WSH: 'WAS', JAC: 'JAX', OAK: 'LV', SD: 'LAC' };
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function parseTransactions(
  html: string,
  year: number,
  url: string,
  checkedAt: string,
): SearchTransaction[] {
  const body = html.match(/<tbody[^>]*>(.*?)<\/tbody>/s)?.[1];
  if (body === undefined) throw new Error('Transaction ledger format unavailable');
  const team = (cell: string) => {
    const abbr = cell.match(/clubs\/logos\/([A-Z]+)/)?.[1];
    return abbr ? (aliases[abbr] ?? abbr) : null;
  };
  return [...body.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].flatMap((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => c[1]);
    if (cells.length < 6) return [];
    const [month, day] = text(cells[2]).split('/').map(Number);
    if (!month || !day) return [];
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return [
      {
        name: text(cells[3]),
        date,
        from: team(cells[0]),
        to: team(cells[1]),
        description: text(cells[5]),
        source: {
          id: `transactions:${url}`,
          title: 'Official NFL transaction ledger',
          url,
          provider: 'NFL.com',
          updatedAt: checkedAt,
        },
      },
    ];
  });
}
export async function loadTransactions(team: string, now: Date): Promise<SearchTransaction[]> {
  const months = [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))];
  if (now.getUTCDate() <= 7)
    months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const rows = await Promise.allSettled(
    months.flatMap((month) =>
      ['signings', 'waivers', 'terminations', 'reserve-list', 'trades', 'other'].map(
        async (category) => {
          const url = `https://www.nfl.com/transactions/league/${category}/${month.getUTCFullYear()}/${month.getUTCMonth() + 1}`;
          const response = await fetch(url, {
            next: { revalidate: 900 },
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) throw new Error('Transaction ledger unavailable');
          // Recent ledger page only; never claim this is a complete historical transaction archive.
          return parseTransactions(
            await response.text(),
            month.getUTCFullYear(),
            url,
            now.toISOString(),
          );
        },
      ),
    ),
  );
  if (rows.every((r) => r.status === 'rejected')) throw new Error('Transaction ledger unavailable');
  return rows
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter(
      (r) =>
        (r.from === team || r.to === team) &&
        r.date <= now.toISOString().slice(0, 10) &&
        Date.parse(r.date) >= now.getTime() - 7 * 86400000,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
