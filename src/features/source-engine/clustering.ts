import type { SourceItem } from './types';

const words = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );

const overlap = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((value) => right.has(value)).length;
  return shared / Math.min(left.size, right.size);
};

const sameEvent = (candidate: SourceItem, cluster: SourceItem[]) => {
  const anchor = cluster[0];
  if (!anchor || anchor.type !== candidate.type) return false;
  if (!anchor.teamIds.some((team) => candidate.teamIds.includes(team))) return false;
  const entityOverlap = overlap(new Set(anchor.entities), new Set(candidate.entities));
  const textOverlap = overlap(
    words(`${anchor.title} ${anchor.excerpt}`),
    words(`${candidate.title} ${candidate.excerpt}`),
  );
  const timeDifference = Math.abs(
    new Date(anchor.publishedAt).getTime() - new Date(candidate.publishedAt).getTime(),
  );
  return timeDifference <= 48 * 3_600_000 && (entityOverlap >= 0.5 || textOverlap >= 0.45);
};

export const clusterSourceItems = (items: SourceItem[]) => {
  const clusters: SourceItem[][] = [];
  [...items]
    .sort((left, right) => left.publishedAt.localeCompare(right.publishedAt))
    .forEach((item) => {
      const cluster = clusters.find((candidate) => sameEvent(item, candidate));
      if (cluster) cluster.push(item);
      else clusters.push([item]);
    });
  return clusters;
};
