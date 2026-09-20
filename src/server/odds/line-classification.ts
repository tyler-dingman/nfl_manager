import { SPORTSBOOKS } from './sportsbooks';
export type LineType = 'main' | 'alternate' | 'unknown';
const numeric = (value: unknown) =>
  value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
/** The parent bookmaker selection is primary; altLines are explicit alternates.
 * A threshold can be primary at one book and alternate at another. Never infer from juice. */
export function classifyStoredLine(input: {
  sportsbook: string;
  line: unknown;
  isAltLine?: boolean;
  rawProviderMetadata?: unknown;
}): { lineType: LineType; mainLine: number | null } {
  const metadata = input.rawProviderMetadata as
    | {
        odd?: {
          betTypeID?: string;
          byBookmaker?: Record<
            string,
            {
              overUnder?: unknown;
              spread?: unknown;
              altLines?: Array<{ overUnder?: unknown; spread?: unknown }>;
            }
          >;
        };
      }
    | undefined;
  const provider = SPORTSBOOKS.find((b) => b.id === input.sportsbook)?.providerId;
  const book = provider ? metadata?.odd?.byBookmaker?.[provider] : undefined;
  const lineOf = (row: { overUnder?: unknown; spread?: unknown }) =>
    numeric(metadata?.odd?.betTypeID === 'sp' ? row.spread : (row.overUnder ?? row.spread));
  const line = numeric(input.line);
  if (book) {
    const mainLine = lineOf(book);
    if (line === mainLine) return { lineType: 'main', mainLine };
    if (book.altLines?.some((row) => lineOf(row) === line))
      return { lineType: 'alternate', mainLine };
  }
  // True means every normalized representation was alternate. False may mean another book was primary.
  return { lineType: input.isAltLine === true ? 'alternate' : 'unknown', mainLine: null };
}
