const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function classifyVideoTeamRelevance(input: {
  title: string;
  description?: string;
  teamId: string;
  teamName: string;
  sourceTeamId?: string | null;
  multiTeam?: boolean;
}) {
  const evidence = normalize(`${input.title} ${input.description ?? ''}`);
  const tokens = normalize(input.teamName)
    .split(' ')
    .filter((token) => token.length > 2);
  const explicit =
    tokens.some((token) => evidence.split(' ').includes(token)) ||
    evidence.includes(normalize(input.teamName));
  if (input.multiTeam || !input.sourceTeamId)
    return {
      accepted: explicit,
      reason: explicit
        ? 'Explicit team evidence'
        : 'Multi-team source lacks explicit team evidence',
    };
  if (input.sourceTeamId !== input.teamId)
    return { accepted: false, reason: 'Source team does not match candidate team' };
  return {
    accepted: explicit,
    reason: explicit
      ? 'Team source prior plus explicit team evidence'
      : 'Team source prior is insufficient without video-level evidence',
  };
}
