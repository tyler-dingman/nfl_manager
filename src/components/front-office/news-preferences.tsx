'use client';
import type { NewsPreferences } from '@/lib/front-office-news-presentation';
export function NewsPreferencesPanel({
  value,
  onChange,
}: {
  value: NewsPreferences;
  onChange: (p: NewsPreferences) => void;
}) {
  return (
    <section className="fo-news-settings" aria-label="Notification settings">
      <h3>Notification Settings</h3>
      <p>Controls popups only. All news stays in your feed.</p>
      {(
        [
          ['myTeam', 'My Team roster moves'],
          ['league', 'League news'],
          ['injuries', 'Injuries'],
          ['game', 'Game news'],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <span>{label}</span>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
        </label>
      ))}
      <label>
        Notification frequency
        <select
          value={value.frequency}
          onChange={(e) =>
            onChange({ ...value, frequency: e.target.value as NewsPreferences['frequency'] })
          }
        >
          <option value="normal">Normal (recommended)</option>
          <option value="important">Important only</option>
          <option value="minimal">Minimal</option>
        </select>
      </label>
    </section>
  );
}
