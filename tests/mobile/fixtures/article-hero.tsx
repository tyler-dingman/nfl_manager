import { createRoot } from 'react-dom/client';
import { ArticleHero } from '../../../src/components/content/article-hero';
import { beatFixtures } from '../../../src/components/beat/beat-fixtures';
import type { ArticleHeroStory } from '../../../packages/beat/article-hero';

const params = new URLSearchParams(location.search);
const teamAbbr = params.get('team') ?? 'KC';
const headline = 'Kahlil Benson als Offensive Rookie of the Month ausgezeichnet';
const samples: ArticleHeroStory[] = beatFixtures.map((f) => ({
  id: f.id,
  teamAbbr,
  category: f.category,
  headline,
  summary:
    'Benson stand in dieser Saison in allen drei Spielen als Left Tackle in der Starting Lineup.',
  updatedAt: '2026-10-02T10:02:56Z',
  publishedAt: '2026-10-01T10:02:56Z',
  sourceCount: 1,
  graphicDecision: {
    graphic: f.graphic,
    displayCategory: f.category,
    reason: 'Isolated visual fixture',
    evidence: [],
    sourceUrls: [],
  },
}));
samples.push({
  ...samples[0],
  id: 'long-headline',
  headline:
    'What the latest roster decisions mean for the offensive line, the next generation of young players and every position battle heading into the biggest matchup of the season',
});
samples.push({
  ...samples[0],
  id: 'long-word',
  headline:
    'A very long SupercalifragilisticexpialidociousFootballDevelopment headline still needs to be readable',
});
createRoot(document.getElementById('root')!).render(
  <>
    {samples.map((story) => (
      <section key={story.id}>
        <ArticleHero story={story} />
        <div data-content-start style={{ padding: '16px', background: '#f4f6f8' }}>
          Back to The Beat · Share · Share with the Crew · Save
          <div style={{ marginTop: 16, padding: 24, background: 'white' }}>
            <b>THE SHORT VERSION</b>
            <p>{story.summary}</p>
          </div>
        </div>
      </section>
    ))}
  </>,
);
