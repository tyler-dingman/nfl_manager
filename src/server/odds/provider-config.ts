/** Migration remains shadow-only until coverage, mappings, and real transfers pass review. */
export function oddsProviderConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider = (env.ODDS_PROVIDER ?? 'sportsgameodds').toLowerCase();
  if (!['sportsgameodds', 'unabated'].includes(provider))
    throw new Error('Unsupported ODDS_PROVIDER.');
  return {
    provider,
    unabatedIngestion: env.ENABLE_UNABATED_INGESTION === 'true',
    fanDuelBetslip: env.ENABLE_FANDUEL_BETSLIP === 'true',
  };
}
export function requireLegacyOddsIngestion() {
  if (oddsProviderConfig().provider !== 'sportsgameodds')
    throw new Error(
      'Unabated is selected but live ingestion is not validated. Run scripts/audit-unabated-coverage.ts; no paid legacy fallback was requested.',
    );
}
