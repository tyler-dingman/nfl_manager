import type { TeamBriefing } from './types';

export type ContentKind = 'news' | 'transaction' | 'injury' | 'draft' | 'analysis' | 'video';

export const CONTENT_TYPE_CONFIG: Record<
  ContentKind,
  { label: string; schema: 'NewsArticle' | 'Article' | 'VideoObject' }
> = {
  news: { label: 'News', schema: 'NewsArticle' },
  transaction: { label: 'Transaction', schema: 'NewsArticle' },
  injury: { label: 'Injury update', schema: 'NewsArticle' },
  draft: { label: 'Draft', schema: 'Article' },
  analysis: { label: 'Analysis', schema: 'Article' },
  video: { label: 'Video', schema: 'VideoObject' },
};

export function contentKind(item: TeamBriefing): ContentKind {
  const category = item.category.toUpperCase();
  if (
    item.sources.some(
      (source) => source.kind === 'video' || /youtube\.com|youtu\.be/i.test(source.url),
    )
  )
    return 'video';
  if (/TRADE|SIGN|RELEASE|WAIVER|ROSTER|TRANSACTION|CONTRACT/.test(category)) return 'transaction';
  if (/INJUR/.test(category)) return 'injury';
  if (/DRAFT/.test(category)) return 'draft';
  if (/ANALYSIS|FILM/.test(category)) return 'analysis';
  return 'news';
}
