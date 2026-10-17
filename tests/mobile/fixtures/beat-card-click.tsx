import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BeatStoryCard } from '../../../src/components/beat/beat-story-card';
function Fixture() {
  const [saved, setSaved] = useState(false);
  return (
    <div style={{ width: 320, maxWidth: '100%', margin: '16px auto' }}>
      <BeatStoryCard
        id="click-story"
        teamId={new URLSearchParams(location.search).get('team') ?? 'KC'}
        headline="A new chapter for the offensive line"
        summary="The latest roster move and what it means for the season ahead."
        category="Editorial"
        sourceCount={1}
        updatedAt="2026-10-02T10:00:00Z"
        sources={[
          {
            id: 'source',
            publisher: 'Original reporting',
            title: 'Original story',
            url: 'https://source-preview.test/story',
          },
        ]}
        saved={saved}
        onSave={() => setSaved(!saved)}
        onOpen={() => {
          document.body.dataset.opened = String(Number(document.body.dataset.opened ?? 0) + 1);
        }}
      />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
