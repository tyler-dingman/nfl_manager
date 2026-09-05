import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CONTENT_TYPE_CONFIG, contentKind } from './content-type-config';
import { getGeneratedTeamBriefings } from './generated-briefings';
import { getContentDetail } from '@/server/content/content-detail';

test('all supported content families have shared page configuration', () => {
  assert.deepEqual(Object.keys(CONTENT_TYPE_CONFIG).sort(), [
    'analysis',
    'draft',
    'injury',
    'news',
    'transaction',
    'video',
  ]);
  const base = {
    id: 'x',
    teamAbbr: 'KC',
    headline: 'x',
    summary: 'x',
    updatedAt: new Date().toISOString(),
    sourceCount: 1,
    sources: [
      {
        id: 's',
        publisher: 'p',
        title: 't',
        url: 'https://example.com',
        publishedAt: new Date().toISOString(),
        kind: 'reporting' as const,
      },
    ],
  };
  assert.equal(contentKind({ ...base, category: 'TRADE' }), 'transaction');
  assert.equal(contentKind({ ...base, category: 'INJURY' }), 'injury');
  assert.equal(contentKind({ ...base, category: 'DRAFT' }), 'draft');
  assert.equal(contentKind({ ...base, category: 'ANALYSIS' }), 'analysis');
  assert.equal(
    contentKind({
      ...base,
      category: 'NEWS',
      sources: [{ ...base.sources[0], kind: 'video', url: 'https://youtube.com/watch?v=abc' }],
    }),
    'video',
  );
});

test('a stable generated content ID resolves directly', async () => {
  const item = getGeneratedTeamBriefings('KC')[0];
  assert.ok(item);
  assert.equal((await getContentDetail(item.id))?.headline, item.headline);
});

test('content cards use canonical links and no modal controls', () => {
  const card = readFileSync('src/components/huddle/huddle-story-card.tsx', 'utf8');
  assert.match(card, /href=\{`\/content\/\$\{encodeURIComponent\(id\)\}`\}/);
  assert.doesNotMatch(card, /role="dialog"|aria-modal|body\.style\.overflow/);
});

test('page includes canonical SEO, structured data, attribution, ads, and mobile-safe media', () => {
  const page = readFileSync('src/app/content/[id]/page.tsx', 'utf8');
  assert.match(page, /alternates: \{ canonical: url \}/);
  assert.match(page, /openGraph:/);
  assert.match(page, /application\/ld\+json/);
  assert.match(page, /Sources and attribution/);
  assert.match(page, /AdSlot placement="RIGHT_RAIL"/);
  assert.match(page, /aspect-video overflow-hidden/);
  assert.doesNotMatch(page, /role="dialog"|aria-modal="true"|onKeyDown.*Escape/);
});

test('public canonical lookup excludes draft and holding content', () => {
  const source = readFileSync('src/server/story-engine/projections.ts', 'utf8');
  assert.match(source, /publication_state IN \('PUBLISHED','AUTO_PUBLISHED'\)/);
  assert.match(source, /status<>'HOLDING'/);
});

test('legacy story query redirects and content page emits one pageview component', () => {
  const legacy = readFileSync('src/app/the-beat/page.tsx', 'utf8');
  const page = readFileSync('src/app/content/[id]/page.tsx', 'utf8');
  assert.match(legacy, /redirect\(`\/content\//);
  assert.equal(page.match(/<ContentPageAnalytics/g)?.length, 1);
});
