import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ResponsivePlayerTable,
  PlayerActions,
} from '../../../src/components/players/responsive-player-table';
import { ResponsivePlayerSelect } from '../../../src/components/players/responsive-player-select';
function Fixture() {
  const [position, setPosition] = useState('all');
  const [selected, setSelected] = useState('');
  const rows = [
    { name: 'Chris Jones', position: 'DT' },
    { name: 'Patrick Mahomes', position: 'QB' },
  ].filter((p) => position === 'all' || p.position === position);
  return (
    <main style={{ padding: 16 }}>
      <ResponsivePlayerSelect
        aria-label="Position"
        value={position}
        onChange={(e) => setPosition(e.target.value)}
      >
        <option value="all">All positions</option>
        <option value="QB">QB</option>
      </ResponsivePlayerSelect>
      <p role="status">{selected}</p>
      <ResponsivePlayerTable className="legacy-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Position</th>
            <th>Contract years</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => (
            <tr key={player.name}>
              <td>
                <button onClick={() => setSelected(player.name)}>{player.name}</button>
              </td>
              <td>{player.position}</td>
              <td>3</td>
              <td>
                <PlayerActions
                  name={player.name}
                  actions={[
                    { label: 'View player', onClick: () => setSelected(player.name) },
                    { label: 'Trade player', disabled: true },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </ResponsivePlayerTable>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
