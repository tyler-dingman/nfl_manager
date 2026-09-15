import type { NewsGraphicVariant } from './NewsGraphic';

export function resolveNewsGraphicVariant(category: string, headline = ''): NewsGraphicVariant {
  const value = `${category} ${headline}`.toLowerCase();
  if (/injur|out for|questionable|doubtful/.test(value)) return 'injury';
  if (/trade rumor|trade interest|trade talk|explor.*trade/.test(value)) return 'trade-rumor';
  if (/\btrade\b|acquire|dealt to/.test(value)) return 'trade';
  if (/contract|extension|re-sign|negotiat/.test(value)) return 'contract';
  if (/signing|signed|release|waive|transaction/.test(value)) return 'signing';
  if (/game recap|final|defeat|victory|win over|loss to/.test(value)) return 'game-recap';
  if (/performance|yards|touchdown|sacks|interceptions/.test(value)) return 'player-performance';
  if (/draft|rookie|prospect|pick/.test(value)) return 'draft';
  if (/standing|playoff race|seed/.test(value)) return 'standings';
  if (/coach|coordinator|front office|general manager/.test(value)) return 'coach';
  if (/rumor|developing|expected|could|may /.test(value)) return 'rumor';
  return 'breaking';
}
