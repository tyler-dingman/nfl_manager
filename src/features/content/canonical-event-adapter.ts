import { getSourcesForTeam } from '@/data/sources';
import { buildTeamEvents } from '@/features/source-engine/team-event-service';

import type { ContentSource, ContentSourceAdapter, ContentSourceKind } from './types';

const categoryToKind = (category?: string): ContentSourceKind => {
  if (category === 'OFFICIAL') return 'official';
  if (category === 'CREATOR') return 'video';
  if (category === 'COMMUNITY') return 'social';
  return 'reporting';
};

export class CanonicalEventAdapter implements ContentSourceAdapter {
  async collect(teamAbbr: string): Promise<ContentSource[]> {
    const definitions = new Map(getSourcesForTeam(teamAbbr).map((source) => [source.id, source]));
    const { events } = buildTeamEvents(teamAbbr);
    return events.flatMap((event) =>
      event.sourceItems.map((item) => ({
        id: item.id,
        teamAbbr,
        kind: categoryToKind(definitions.get(item.sourceId)?.category),
        publisher: definitions.get(item.sourceId)?.displayName ?? item.author ?? item.sourceId,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        excerpt: item.excerpt,
        topicKey:
          event.type === 'TRADE' && event.entities.includes('Diego Pounds')
            ? 'diego-pounds-trade'
            : event.id,
        importance: event.huddleScore,
      })),
    );
  }
}
