'use client';
import { ResponsivePlayerSelect } from '@/components/players/responsive-player-select';
import { MAX_ALT_ODDS } from '../../../packages/parlay/discovery-preferences';
import { useDiscoveryPreferences } from './use-discovery-preferences';
export function DiscoveryControls() {
  const preferences = useDiscoveryPreferences();
  return (
    <>
      <label className="lab-alt-toggle">
        <input
          type="checkbox"
          checked={preferences.altLines}
          disabled={!preferences.ready}
          onChange={(e) => preferences.update({ altLines: e.target.checked })}
        />{' '}
        Alt Lines
      </label>
      {preferences.altLines && (
        <label>
          <span>Max Odds</span>
          <ResponsivePlayerSelect
            aria-label="Max Odds"
            value={String(preferences.maxOdds)}
            onChange={(e) => preferences.update({ maxOdds: Number(e.target.value) })}
          >
            {MAX_ALT_ODDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </ResponsivePlayerSelect>
        </label>
      )}
    </>
  );
}
