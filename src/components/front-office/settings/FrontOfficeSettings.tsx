'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Cloud,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import {
  DdNotificationsIcon as Bell,
  DdCopyIcon as Copy,
  DdFiltersIcon as SlidersHorizontal,
} from '@/components/ui/football-icons';
import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { FranchiseSimulationState } from '@/types/front-office';
import styles from './front-office-settings.module.css';

type Preferences = {
  reducedMotion: boolean;
  showAroundLeague: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  autoplayVideo: boolean;
};
type LocalSettings = {
  confirmationPrompts: boolean;
  compactTables: boolean;
  soundEffects: boolean;
};
const defaults: Preferences = {
  reducedMotion: false,
  showAroundLeague: true,
  pushEnabled: true,
  emailEnabled: true,
  autoplayVideo: false,
};
const localDefaults: LocalSettings = {
  confirmationPrompts: true,
  compactTables: false,
  soundEffects: true,
};

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className={styles.toggleRow}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true">
        <b />
      </i>
    </label>
  );
}

export function FrontOfficeSettings() {
  const saveId = useSaveStore((store) => store.saveId);
  const teamAbbr = useSaveStore((store) => store.teamAbbr);
  const [preferences, setPreferences] = useState(defaults);
  const [local, setLocal] = useState(localDefaults);
  const [simulation, setSimulation] = useState<FranchiseSimulationState | null>(null);
  const [status, setStatus] = useState('');
  const localKey = useMemo(() => `front-office-settings:${saveId || 'default'}`, [saveId]);
  useEffect(() => {
    let active = true;
    void apiFetch('/api/user/preferences')
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload.preferences) setPreferences({ ...defaults, ...payload.preferences });
      })
      .catch(() => undefined);
    if (saveId)
      void apiFetch(`/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`)
        .then((response) => response.json())
        .then((payload) => {
          if (active) setSimulation(payload.state ?? null);
        })
        .catch(() => undefined);
    try {
      setLocal({ ...localDefaults, ...JSON.parse(localStorage.getItem(localKey) ?? '{}') });
    } catch {
      setLocal(localDefaults);
    }
    return () => {
      active = false;
    };
  }, [localKey, saveId]);
  const updatePreference = async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const previous = preferences;
    setPreferences((current) => ({ ...current, [key]: value }));
    setStatus('Saving…');
    try {
      const response = await apiFetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error();
      setStatus('Saved');
      setTimeout(() => setStatus(''), 1800);
    } catch {
      setPreferences(previous);
      setStatus('Could not save this setting.');
    }
  };
  const updateLocal = <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    localStorage.setItem(localKey, JSON.stringify(next));
    setStatus('Saved');
    setTimeout(() => setStatus(''), 1800);
  };
  const team = TEAM_LIST.find((entry) => entry.abbr === teamAbbr);
  const record = simulation?.teams[teamAbbr]?.record;
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div />
        <div className={styles.saveState}>
          <Cloud />
          <span>
            <strong>Autosave on</strong>
            <small>{status || 'Progress saves automatically'}</small>
          </span>
          {status === 'Saved' ? <Check /> : null}
        </div>
      </header>
      <div className={styles.layout}>
        <nav className={styles.settingsNav}>
          <a href="#gameplay">
            <Gauge />
            Gameplay
          </a>
          <a href="#display">
            <LayoutDashboard />
            Display
          </a>
          <a href="#notifications">
            <Bell />
            Notifications
          </a>
          <a href="#save">
            <Cloud />
            Saved game
          </a>
          <a href="#privacy">
            <ShieldCheck />
            Privacy & account
          </a>
        </nav>
        <main className={styles.content}>
          <section id="gameplay" className={styles.card}>
            <header>
              <span>
                <SlidersHorizontal />
              </span>
              <div>
                <h2>Gameplay</h2>
                <p>Choose how Front Office confirms and presents management decisions.</p>
              </div>
            </header>
            <Toggle
              checked={local.confirmationPrompts}
              onChange={(value) => updateLocal('confirmationPrompts', value)}
              label="Confirm major decisions"
              description="Ask before long simulations, trades, releases, and other irreversible moves."
            />
            <Toggle
              checked={local.soundEffects}
              onChange={(value) => updateLocal('soundEffects', value)}
              label="Interface sound effects"
              description="Use subtle feedback for completed simulations and roster moves."
            />
            <div className={styles.infoRow}>
              <span>
                <strong>Simulation control</strong>
                <small>Weeks advance only when you use the Continue control.</small>
              </span>
              <b>Manual</b>
            </div>
          </section>
          <section id="display" className={styles.card}>
            <header>
              <span>
                <LayoutDashboard />
              </span>
              <div>
                <h2>Display & accessibility</h2>
                <p>Adjust motion and the amount of league information shown.</p>
              </div>
            </header>
            <Toggle
              checked={preferences.reducedMotion}
              onChange={(value) => void updatePreference('reducedMotion', value)}
              label="Reduce motion"
              description="Minimize transitions, animated score reveals, and panel movement."
            />
            <Toggle
              checked={preferences.showAroundLeague}
              onChange={(value) => void updatePreference('showAroundLeague', value)}
              label="Show around-the-league content"
              description="Include league news, rumors, scores, and transactions in Front Office."
            />
            <Toggle
              checked={local.compactTables}
              onChange={(value) => updateLocal('compactTables', value)}
              label="Compact data tables"
              description="Fit more roster, standings, and trade rows on screen."
            />
            <Toggle
              checked={preferences.autoplayVideo}
              onChange={(value) => void updatePreference('autoplayVideo', value)}
              label="Autoplay video previews"
              description="Allow supported editorial videos to begin automatically."
            />
          </section>
          <section id="notifications" className={styles.card}>
            <header>
              <span>
                <Bell />
              </span>
              <div>
                <h2>Notifications</h2>
                <p>Decide how important Front Office developments reach you.</p>
              </div>
            </header>
            <Toggle
              checked={preferences.pushEnabled}
              onChange={(value) => void updatePreference('pushEnabled', value)}
              label="Push notifications"
              description="Trade offers, injuries, contract decisions, and weekly briefings."
            />
            <Toggle
              checked={preferences.emailEnabled}
              onChange={(value) => void updatePreference('emailEnabled', value)}
              label="Email notifications"
              description="Receive important account and league updates by email."
            />
            <Link className={styles.manageLink} href="/account/notifications">
              Manage notification categories <ChevronRight />
            </Link>
          </section>
          <section id="save" className={styles.card}>
            <header>
              <span>
                <Cloud />
              </span>
              <div>
                <h2>Saved game</h2>
                <p>Your franchise state is saved after every completed action.</p>
              </div>
            </header>
            <div className={styles.franchise}>
              <div className={styles.teamBadge} style={{ background: team?.colors[0] }}>
                {teamAbbr}
              </div>
              <div>
                <strong>
                  {team?.city} {team?.name}
                </strong>
                <span>
                  {simulation?.season ?? '—'} season · Week{' '}
                  {Math.max(1, simulation?.currentWeek ?? 1)}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Record</dt>
                  <dd>
                    {record
                      ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`
                      : '0-0'}
                  </dd>
                </div>
                <div>
                  <dt>Save status</dt>
                  <dd>Up to date</dd>
                </div>
              </dl>
            </div>
            <button
              className={styles.copyButton}
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(saveId);
                setStatus('Save ID copied');
              }}
            >
              <Copy /> Copy save ID
            </button>
            <p className={styles.saveNote}>
              <LockKeyhole /> Front Office progress is tied to your account and restores when you
              return on another signed-in device.
            </p>
          </section>
          <section id="privacy" className={styles.card}>
            <header>
              <span>
                <ShieldCheck />
              </span>
              <div>
                <h2>Privacy & account</h2>
                <p>Manage account security, data, and connected devices.</p>
              </div>
            </header>
            <div className={styles.linkRows}>
              <Link href="/account/security">
                <span>
                  <strong>Security and sessions</strong>
                  <small>Passwords, sign-ins, and active devices</small>
                </span>
                <ChevronRight />
              </Link>
              <Link href="/account/preferences">
                <span>
                  <strong>All site preferences</strong>
                  <small>Team, content, playback, and account settings</small>
                </span>
                <ChevronRight />
              </Link>
            </div>
          </section>
          <section className={styles.resetCard}>
            <RotateCcw />
            <div>
              <strong>Start another franchise</strong>
              <p>Your current save will not be changed unless you explicitly create a new game.</p>
            </div>
            <Link href="/experience">View franchise options</Link>
          </section>
        </main>
        <aside className={styles.help}>
          <section>
            <Volume2 />
            <h2>Settings follow you</h2>
            <p>
              Account preferences sync across the website and supported mobile apps. Save-specific
              display choices remain attached to this franchise.
            </p>
          </section>
          <section>
            <ShieldCheck />
            <h2>Automatic protection</h2>
            <p>
              Trades, simulations, contracts, roster moves, and draft decisions are persisted when
              completed.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
