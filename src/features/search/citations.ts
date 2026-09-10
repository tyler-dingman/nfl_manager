export type SearchAnswerSegment =
  | { type: 'text'; value: string }
  | { type: 'citation'; value: string; sourceIndex: number };

export function parseSearchAnswerCitations(answer: string, sourceCount: number) {
  const segments: SearchAnswerSegment[] = [];
  const pattern = /\[(\d+)\]/g;
  let cursor = 0;
  for (const match of answer.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ type: 'text', value: answer.slice(cursor, start) });
    const sourceIndex = Number(match[1]) - 1;
    if (sourceIndex >= 0 && sourceIndex < sourceCount) {
      segments.push({ type: 'citation', value: match[0], sourceIndex });
    } else {
      segments.push({ type: 'text', value: match[0] });
    }
    cursor = start + match[0].length;
  }
  if (cursor < answer.length) segments.push({ type: 'text', value: answer.slice(cursor) });
  return segments;
}
