import inventory from './inventory.json';
import type { SourceDefinition } from '../types';

export const SOURCE_RESEARCH = inventory;
const byId = new Map(inventory.sources.map((source) => [source.id, source]));
export function getResearchedSourcesForTeam(teamId: string) {
  return inventory.teamSources
    .filter((link) => link.teamId === teamId.toUpperCase())
    .map((link) => byId.get(link.sourceId)!);
}

/** Existing source IDs/configuration are not replaced by research aliases.
 * New candidates enter the existing general registry disabled and without feed credentials.
 * Monitoring sync cannot poll them. Approval requires a separate reviewed configuration change.
 */
export const RESEARCH_SOURCE_ADDITIONS: SourceDefinition[] = inventory.sources
  .filter((source) => !source.existingIds.length && source.qualified && source.type !== 'X')
  .map((source) => {
    const teamIds = inventory.teamSources
      .filter((link) => link.sourceId === source.id)
      .map((link) => link.teamId);
    return {
      id: source.id,
      name: source.name,
      displayName: source.name,
      team: teamIds.length === 1 ? teamIds[0] : null,
      teamIds,
      category: source.type === 'OFFICIAL' ? 'OFFICIAL' : 'LOCAL_MEDIA',
      platform: 'WEB',
      url: source.url,
      trustScore: 0, // Research quality must never become an unreviewed publishing confidence.
      breakingNewsScore: 0,
      analysisScore: 0,
      teamRelevanceScore: 0,
      enabled: false,
      priority: 0,
      researchQualityScore: source.qualityScore,
      notes: `Research only: ${source.verificationStatus}; rights, accuracy and cost review required.`,
    };
  });
