'use client';
import { useState } from 'react';
import ContractOfferModal from '@/components/contract-offer-modal';
import CutPlayerModal from '@/components/cut-player-modal';
import type { PlayerRowDTO } from '@/types/player';
// Isolated visual fixture. No save-store writes or transaction API calls.
const player: PlayerRowDTO = {
  id: 'visual-fixture',
  firstName: 'Arch',
  lastName: 'Manning',
  position: 'QB',
  age: 23,
  height: '6′ 4″',
  weight: 225,
  rating: 84,
  contractYearsRemaining: 2,
  capHit: '$10.5M',
  deadCap: 3.5,
  releaseSavings: 7,
  status: 'Active',
  headshotUrl: '/assets/draft/headshots/2027/arch-manning.png',
};
export default function Preview() {
  const [mode, setMode] = useState('sign');
  const [team, setTeam] = useState('SEA');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  return (
    <main style={{ padding: 24, color: 'white' }}>
      <h1>Transaction visual fixture (no franchise changes)</h1>
      <label>
        Mode
        <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          {['sign', 'renegotiate', 'release'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Team
        <select aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)}>
          {['SEA', 'KC', 'PHI', 'MIN'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={error} onChange={(e) => setError(e.target.checked)} />
        Simulate error
      </label>
      <button onClick={() => setOpen(true)}>Open preview</button>
      {mode === 'release' ? (
        <CutPlayerModal
          player={player}
          isOpen={open}
          currentCapSpace={18}
          teamAbbr={team}
          season={2026}
          teamRoster={[player]}
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            if (error) throw new Error('Preview release failed. Please try again.');
          }}
        />
      ) : (
        <ContractOfferModal
          key={mode + team}
          player={player}
          title="Preview"
          teamAbbr={team}
          teamRoster={[player]}
          scoreVariant={mode === 'sign' ? 'freeAgency' : 'resign'}
          isOpen={open}
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            if (error) throw new Error('Preview offer failed. Please try again.');
            return {
              accepted: true,
              tone: 'positive',
              message: 'Preview offer accepted',
              notice: 'No franchise data changed.',
            };
          }}
        />
      )}
    </main>
  );
}
