import type { ContentCandidate, MaterialChangeResult, StoryRecord } from './types';

const normalized = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const containsAny = (text: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(text));

export function evaluateMaterialChange(
  existing: StoryRecord,
  evidence: ContentCandidate,
  sourceOfficial = false,
): MaterialChangeResult {
  const before = normalized(`${existing.headline} ${existing.summary} ${existing.whatHappened}`);
  const after = normalized(`${evidence.title} ${evidence.excerpt} ${evidence.text}`);
  const evidenceSegments = [
    ...new Set([evidence.title, evidence.excerpt, evidence.text].map(normalized).filter(Boolean)),
  ];
  if (
    before.includes(after) ||
    after === before ||
    evidenceSegments.every((segment) => before.includes(segment))
  )
    return {
      material: false,
      severity: 0.05,
      changeType: 'TRIVIAL',
      reason: 'Wording adds no new factual information.',
    };
  if (containsAny(after, [/resolved|final|completed|ruled out for season|trade is complete/]))
    return {
      material: true,
      severity: 0.9,
      changeType: 'RESOLUTION',
      reason: 'Evidence reports a final or resolved outcome.',
    };
  if (sourceOfficial && existing.confidenceScore < 100)
    return {
      material: true,
      severity: 0.82,
      changeType: 'OFFICIAL_CONFIRMATION',
      reason: 'An official source confirmed the development.',
    };
  if (
    existing.storyType === 'INJURY' &&
    containsAny(after, [
      /expected to play|ruled out|injured reserve|full participant|did not practice/,
    ])
  )
    return {
      material: true,
      severity: 0.84,
      changeType: 'INJURY_UPDATE',
      reason: 'Player availability materially changed.',
    };
  if (
    ['TRADE', 'SIGNING', 'RELEASE', 'TRANSACTION'].includes(existing.storyType) &&
    containsAny(after, [/official|compensation|conditional|agreed|announced|waived|released/])
  )
    return {
      material: true,
      severity: 0.76,
      changeType: 'TRANSACTION_UPDATE',
      reason: 'The transaction gained a new concrete fact.',
    };
  const priorEntities = new Set(existing.entities.map(normalized));
  const newEntities = evidence.entities.filter((entity) => !priorEntities.has(normalized(entity)));
  if (newEntities.length || after.split(' ').filter((word) => !before.includes(word)).length >= 5)
    return {
      material: true,
      severity: 0.65,
      changeType: 'NEW_FACT',
      reason: 'Evidence adds entities or concrete details not present in the current version.',
    };
  return {
    material: false,
    severity: 0.2,
    changeType: 'TRIVIAL',
    reason: 'Change is corroboration or wording-only.',
  };
}
