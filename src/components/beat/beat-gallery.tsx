'use client';
import { useState } from 'react';
import { BeatStoryCard } from './beat-story-card';
import { beatFixtures } from './beat-fixtures';
import accents from '../../../public/assets/the-beat-asset-library/config/team-accents.json';

export default function BeatGallery() {
  const [team, setTeam] = useState('KC');
  const [width, setWidth] = useState(320);
  const [saved, setSaved] = useState<string[]>([]);
  return (
    <main style={{ padding: 20, background: '#edf3f7', minHeight: '100vh', color: '#071c49' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>The Beat — reference card gallery</h1>
      <p>
        Development only. All stories, statistics, quotations and game results below are labeled
        composition fixtures, not reporting.
      </p>
      <div style={{ display: 'flex', gap: 20, margin: '20px 0', flexWrap: 'wrap' }}>
        <label>
          Team{' '}
          <select aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)}>
            {Object.entries(accents.teams).map(([key, entry]) => (
              <option key={key} value={key}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Card width{' '}
          <select
            aria-label="Card width"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            {[280, 320, 400].map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${width}px),${width}px))`,
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        {beatFixtures.map((fixture) => (
          <div key={fixture.id} data-fixture={fixture.id} style={{ minWidth: 0, maxWidth: '100%' }}>
            <BeatStoryCard
              {...fixture}
              teamId={team}
              headline={`Fixture: ${fixture.category} editorial headline with enough context to read naturally`}
              summary="Composition sample for visual review. Real cards preserve the published story, attribution, and source links."
              sourceCount={2}
              updatedAt="2026-09-24T12:00:00Z"
              materialUpdateCount={fixture.id === 'developing' ? 3 : undefined}
              firstReportedBy="Fixture Publisher"
              sources={[
                {
                  id: 'fixture-source',
                  publisher: 'Fixture Publisher',
                  title: 'Fixture source',
                  url: 'https://example.com/fixture',
                },
              ]}
              saved={saved.includes(fixture.id)}
              onSave={() =>
                setSaved((ids) =>
                  ids.includes(fixture.id)
                    ? ids.filter((id) => id !== fixture.id)
                    : [...ids, fixture.id],
                )
              }
              lead={fixture.id === 'feature'}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
