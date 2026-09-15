import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyTeamStory,
  rankTeamStories,
  scoreTeamStory,
} from './team-story-importance-service';

const NOW = new Date('2026-09-15T18:00:00.000Z');
const candidate = (id: string, headline: string, updatedAt: string, importanceScore = 50) => ({
  id,
  headline,
  updatedAt,
  importanceScore,
  sourceCount: 1,
});

test('classifies game results, performances, milestones, injuries, and transactions', () => {
  assert.equal(
    classifyTeamStory(
      candidate('game', 'Chiefs defeat Broncos 31-10 in final score', NOW.toISOString()),
    ),
    'GAME_RESULT',
  );
  assert.equal(
    classifyTeamStory(
      candidate('record', 'Walker makes history with franchise record', NOW.toISOString()),
    ),
    'RECORD_OR_MILESTONE',
  );
  assert.equal(
    classifyTeamStory(
      candidate('injury', 'Starter suffers season-ending torn ACL', NOW.toISOString()),
    ),
    'MAJOR_INJURY',
  );
  assert.equal(
    classifyTeamStory(
      candidate('trade', 'Chiefs acquire veteran in major trade', NOW.toISOString()),
    ),
    'MAJOR_TRANSACTION',
  );
});

test('fresh postgame coverage outranks routine newer practice content', () => {
  const game = candidate(
    'game',
    'Chiefs defeat Broncos 31-10 in final score',
    '2026-09-15T08:00:00.000Z',
  );
  const practice = candidate('practice', 'Tuesday practice notes', '2026-09-15T17:30:00.000Z', 95);
  assert.equal(rankTeamStories([practice, game], NOW)[0].id, 'game');
  assert.ok(scoreTeamStory(game, NOW).reasons.includes('freshness boost'));
});

test('ranking is deterministic when scores and timestamps tie', () => {
  const left = candidate('a', 'General team note', NOW.toISOString());
  const right = candidate('b', 'General team note', NOW.toISOString());
  assert.deepEqual(
    rankTeamStories([right, left], NOW).map((story) => story.id),
    ['a', 'b'],
  );
});
