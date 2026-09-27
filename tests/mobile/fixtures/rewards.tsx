import React from 'react';
import { createRoot } from 'react-dom/client';
import { RewardsDashboard } from '../../../src/components/rewards/rewards-dashboard';
import { REWARD_DEFINITIONS } from '../../../src/features/rewards/config';
createRoot(document.getElementById('root')!).render(
  <div
    style={{
      maxWidth: 1152,
      margin: 'auto',
      display: 'grid',
      gridTemplateColumns: innerWidth > 1023 ? '250px minmax(0,1fr)' : '1fr',
      gap: 24,
    }}
  >
    {innerWidth > 1023 && <aside>Profile menu</aside>}
    <main style={{ containerType: 'inline-size', containerName: 'profile-content', minWidth: 0 }}>
      <RewardsDashboard
        teamAbbr="DET"
        claiming={null}
        claim={(id) => {
          document.body.dataset.claim = id;
        }}
        data={{
          progress: { currentDriveYards: 3, lifetimeYards: 103, touchdowns: 1 },
          stats: { correctAnswers: 41, dayStreak: 3, crewRank: 2, globalRank: 8, totalUsers: 120 },
          nextReward: null,
          yardsToNextReward: 147,
          rewards: REWARD_DEFINITIONS.map((r, i) => ({
            ...r,
            status: i < 2 ? 'AVAILABLE' : 'LOCKED',
          })),
        }}
      />
    </main>
  </div>,
);
