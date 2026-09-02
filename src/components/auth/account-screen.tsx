'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Check,
  Download,
  LogOut,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';

import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import TriviaProfileCard from '@/components/trivia/trivia-profile-card';
import { TEAM_LIST } from '@/data/teams';
import { clearPreviewSession, notifyAuthChanged, useAuthUser } from '@/features/auth/auth-session';
import AuthProviderIcon, { providerDisplayName } from '@/components/auth/auth-provider-icon';
import {
  readCanonicalFanTeamPreference,
  saveFanTeamPreference,
} from '@/features/team/fan-team-preference';
import { getOffseasonManagerRoute } from '@/features/team/offseason-manager-route';
import { useTeamStore } from '@/features/team/team-store';

export type AccountSection =
  | 'profile'
  | 'my-team'
  | 'preferences'
  | 'notifications'
  | 'content'
  | 'account'
  | 'devices'
  | 'privacy-security'
  | 'saved'
  | 'front-office'
  | 'security';

const sections = [
  ['my-team', 'My Team', Settings2],
  ['notifications', 'Notifications', Bell],
  ['content', 'Content', Bookmark],
  ['account', 'Account', UserRound],
  ['devices', 'Devices', BriefcaseBusiness],
  ['privacy-security', 'Privacy & Security', ShieldCheck],
] as const;
const sectionHref = (section: AccountSection) =>
  section === 'profile' || section === 'account' ? '/account' : `/account/${section}`;
const inputClass =
  'mt-2 h-14 w-full rounded-2xl border border-[#00172B]/15 px-4 text-base font-semibold normal-case tracking-normal outline-none focus:border-[var(--primary)]';

function ProfileSection({ name, email }: { name: string; email: string }) {
  const [nextName, setNextName] = useState(name);
  const [nextEmail, setNextEmail] = useState(email);
  const [saved, setSaved] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: nextName }),
    });
    if (nextEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      await fetch('/api/user/email-change/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: nextEmail }),
      });
    }
    notifyAuthChanged();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <SectionTitle
        title="Profile"
        description="Manage how your account appears across Down & Distance."
      />
      <TriviaProfileCard />
      <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#00172B]/50">
        Display name
        <input
          required
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#00172B]/50">
        Email
        <input
          required
          type="email"
          value={nextEmail}
          onChange={(event) => setNextEmail(event.target.value)}
          className={inputClass}
        />
      </label>
      <button className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--dark)] px-6 font-black text-[var(--team-on-dark)] hover:bg-[var(--primary)] hover:text-[var(--team-on-primary)]">
        {saved ? <Check className="h-4 w-4" /> : null}
        {saved ? 'Saved' : 'Save profile'}
      </button>
    </form>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="mt-2 text-sm font-semibold text-[#00172B]/50">{description}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl border border-[#00172B]/10 p-4">
      <span>
        <span className="block font-black">{label}</span>
        <span className="mt-1 block text-sm font-semibold text-[#00172B]/45">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-[var(--primary)]"
      />
    </label>
  );
}

function PreferencesSection({ onTeamChange }: { onTeamChange: (teamAbbr: string) => void }) {
  const [team, setTeam] = useState('');
  const [aroundLeague, setAroundLeague] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  useEffect(() => {
    void fetch('/api/user/preferences')
      .then((response) => response.json())
      .then(async (body) => {
        const serverTeam = body.preferences?.preferredTeamId ?? '';
        const canonicalTeam = (await readCanonicalFanTeamPreference()) ?? '';
        const resolvedTeam = TEAM_LIST.some((item) => item.abbr === serverTeam)
          ? serverTeam
          : canonicalTeam;
        setTeam(resolvedTeam);
        if (resolvedTeam) {
          onTeamChange(resolvedTeam);
          await saveFanTeamPreference(resolvedTeam);
        }
        setAroundLeague(body.preferences?.showAroundLeague ?? true);
        setAutoplay(body.preferences?.autoplayVideo ?? false);
      });
  }, [onTeamChange]);
  return (
    <div>
      <SectionTitle
        title="Preferences"
        description="Personalize the team and content experience you see first."
      />
      <div className="mt-7 space-y-6">
        <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#00172B]/50">
          Favorite team
          <select
            value={team}
            onChange={async (event) => {
              const value = event.target.value;
              if (!value) return;
              setTeam(value);
              onTeamChange(value);
              await saveFanTeamPreference(value);
            }}
            className={`${inputClass} bg-white`}
          >
            <option value="" disabled>
              Choose a primary team
            </option>
            {TEAM_LIST.map((item) => (
              <option key={item.id} value={item.abbr}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <ToggleRow
          label="Around the league"
          description="Include important stories beyond your followed teams."
          checked={aroundLeague}
          onChange={(value) => {
            setAroundLeague(value);
            void fetch('/api/user/preferences', {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ showAroundLeague: value }),
            });
          }}
        />
        <ToggleRow
          label="Autoplay video"
          description="Automatically begin video when opening Watch."
          checked={autoplay}
          onChange={(value) => {
            setAutoplay(value);
            void fetch('/api/user/preferences', {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ autoplayVideo: value }),
            });
          }}
        />
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [settings, setSettings] = useState({
    breaking: true,
    threeAndOut: true,
    roster: false,
    merch: false,
  });
  useEffect(() => {
    void fetch('/api/user/preferences')
      .then((r) => r.json())
      .then((body) => {
        const advanced = body.preferences?.advancedNotifications ?? {};
        setSettings({
          breaking: advanced.breaking ?? true,
          threeAndOut: advanced.threeAndOut ?? true,
          roster: advanced.roster ?? false,
          merch: advanced.merch ?? false,
        });
      });
  }, []);
  const update = (key: keyof typeof settings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    void fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ advancedNotifications: next }),
    });
  };
  return (
    <div>
      <SectionTitle
        title="Notifications"
        description="Choose which updates deserve your attention."
      />
      <div className="mt-7 space-y-3">
        <ToggleRow
          label="Breaking team news"
          description="Major injuries, trades, and roster changes."
          checked={settings.breaking}
          onChange={(value) => update('breaking', value)}
        />
        <ToggleRow
          label="Three and Out updates"
          description="When the top-three ranking materially changes."
          checked={settings.threeAndOut}
          onChange={(value) => update('threeAndOut', value)}
        />
        <ToggleRow
          label="Front Office reminders"
          description="Deadlines and unfinished team-building decisions."
          checked={settings.roster}
          onChange={(value) => update('roster', value)}
        />
        <ToggleRow
          label="Merch drops"
          description="New collections, restocks, and sales."
          checked={settings.merch}
          onChange={(value) => update('merch', value)}
        />
      </div>
    </div>
  );
}

function CollectionSection({ section }: { section: 'saved' | 'front-office' }) {
  const isFrontOffice = section === 'front-office';
  const hasSave =
    typeof window !== 'undefined' && Boolean(window.localStorage.getItem('falco_active_save_id'));
  const [savedItems, setSavedItems] = useState<
    Array<{ id: string; title: string; href: string | null; contentType: string }>
  >([]);
  useEffect(() => {
    if (isFrontOffice) return;
    void fetch('/api/user/saved-content')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { items?: typeof savedItems } | null) => setSavedItems(body?.items ?? []));
  }, [isFrontOffice]);
  return (
    <div>
      <SectionTitle
        title={isFrontOffice ? 'Front Office saves' : 'Saved stories'}
        description={
          isFrontOffice
            ? 'Resume and manage your team-building runs.'
            : 'Keep important reporting and briefings close.'
        }
      />
      <div className="mt-7 rounded-3xl bg-[#f7f4ee] p-8 text-center">
        {!isFrontOffice && savedItems.length ? (
          <div className="grid gap-3 text-left">
            {savedItems.map((item) => (
              <Link
                key={item.id}
                href={item.href ?? '/huddle'}
                className="rounded-2xl border border-[#00172B]/10 bg-white p-4 hover:border-[var(--primary)]"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--team-primary-text)]">
                  {item.contentType.replaceAll('_', ' ')}
                </span>
                <span className="mt-1 block font-black">{item.title}</span>
              </Link>
            ))}
          </div>
        ) : (
          <>
            {isFrontOffice ? (
              <BriefcaseBusiness className="mx-auto h-8 w-8 text-[var(--team-primary-text)]" />
            ) : (
              <Bookmark className="mx-auto h-8 w-8 text-[var(--team-primary-text)]" />
            )}
            <h2 className="mt-4 text-xl font-black">
              {isFrontOffice && hasSave
                ? 'Your current run is ready.'
                : isFrontOffice
                  ? 'No saved runs yet.'
                  : 'No saved stories yet.'}
            </h2>
            <Link
              href={isFrontOffice ? getOffseasonManagerRoute('') : '/huddle'}
              className="mt-5 inline-flex rounded-full bg-[var(--dark)] px-5 py-3 text-sm font-black text-[var(--team-on-dark)]"
            >
              {isFrontOffice && hasSave
                ? 'Resume Front Office'
                : isFrontOffice
                  ? 'Start Front Office'
                  : 'Browse The Huddle'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function SecuritySection() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      createdAt: string;
      lastUsedAt: string;
      revokedAt: string | null;
      userAgent: string | null;
    }>
  >([]);
  const [identities, setIdentities] = useState<
    Array<{ id: string; provider: string; providerEmail: string | null }>
  >([]);
  const loadSecurity = useCallback(async () => {
    const [sessionsResponse, identitiesResponse] = await Promise.all([
      fetch('/api/auth/sessions', { cache: 'no-store' }),
      fetch('/api/auth/identities', { cache: 'no-store' }),
    ]);
    if (sessionsResponse.ok) {
      const body = (await sessionsResponse.json()) as { sessions: typeof sessions };
      setSessions(body.sessions);
    }
    if (identitiesResponse.ok) {
      const body = (await identitiesResponse.json()) as { identities: typeof identities };
      setIdentities(body.identities);
    }
  }, []);
  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);
  return (
    <div>
      <SectionTitle title="Security" description="Password, sessions, and account access." />
      <div className="mt-7">
        <h2 className="text-lg font-black">Sign-in methods</h2>
        <div className="mt-3 grid gap-2">
          {identities.map((identity) => (
            <div
              key={identity.id}
              className="flex items-center justify-between rounded-2xl border border-[#00172B]/10 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#00172B]/10 bg-white shadow-sm">
                  <AuthProviderIcon provider={identity.provider} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-black">{providerDisplayName(identity.provider)}</p>
                  <p className="truncate text-xs font-semibold text-[#00172B]/45">
                    {identity.providerEmail ?? 'No email shared'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={identities.length <= 1}
                onClick={async () => {
                  await fetch(`/api/auth/identities/${identity.id}`, { method: 'DELETE' });
                  await loadSecurity();
                }}
                className="text-xs font-black text-red-600 disabled:opacity-30"
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['apple', 'google', 'facebook'] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={async () => {
                const response = await fetch('/api/auth/identities/link', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ provider }),
                });
                const body = (await response.json()) as { url?: string };
                if (body.url) window.location.assign(body.url);
              }}
              className="rounded-full border border-[#00172B]/15 px-4 py-2 text-xs font-black capitalize"
            >
              <span className="flex items-center gap-2">
                <AuthProviderIcon provider={provider} className="h-4 w-4" />
                Link {providerDisplayName(provider)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Active sessions</h2>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/auth/sessions', { method: 'DELETE' });
              await clearPreviewSession();
              router.push('/login');
            }}
            className="text-xs font-black text-red-600"
          >
            Revoke all
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {sessions
            .filter((session) => !session.revokedAt)
            .map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#00172B]/10 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {session.userAgent ?? 'Unknown device'}
                  </p>
                  <p className="text-xs font-semibold text-[#00172B]/45">
                    Last used {new Date(session.lastUsedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/auth/sessions/${session.id}`, { method: 'DELETE' });
                    await loadSecurity();
                  }}
                  className="shrink-0 text-xs font-black text-red-600"
                >
                  Revoke
                </button>
              </div>
            ))}
        </div>
      </div>
      <div className="mt-8 border-t border-[#00172B]/10 pt-8">
        <h2 className="text-lg font-black">Your data</h2>
        <p className="mt-2 text-sm font-semibold text-[#00172B]/50">
          Download your account data or permanently remove this account and its active sessions.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              const response = await fetch('/api/user/export');
              if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = 'down-distance-account-export.json';
                anchor.click();
                URL.revokeObjectURL(url);
              }
              setExporting(false);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#00172B]/15 px-5 py-3 text-sm font-black disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> {exporting ? 'Preparing…' : 'Export my data'}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (window.prompt('Type DELETE to permanently remove your account.') !== 'DELETE')
                return;
              setDeleting(true);
              const response = await fetch('/api/user/account/delete', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ confirmation: 'DELETE' }),
              });
              if (response.ok) {
                await clearPreviewSession();
                router.replace('/');
              } else setDeleting(false);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-3 text-sm font-black text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          await clearPreviewSession();
          router.push('/');
        }}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-red-200 px-6 py-3 font-black text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" /> Log out of this device
      </button>
    </div>
  );
}

export default function AccountScreen({ section }: { section: AccountSection }) {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const teams = useTeamStore((state) => state.teams);
  const [teamAbbr, setTeamAbbr] = useState<string | null>(null);
  const handleTeamChange = useCallback((value: string) => setTeamAbbr(value || null), []);
  useEffect(() => {
    if (hydrated && !user) router.replace(`/login?next=${sectionHref(section)}`);
  }, [hydrated, router, section, user]);
  useEffect(() => {
    void readCanonicalFanTeamPreference().then(setTeamAbbr);
  }, []);
  const activeTeam = useMemo(() => teams.find((team) => team.abbr === teamAbbr), [teamAbbr, teams]);
  if (!hydrated || !user) return <div className="min-h-screen bg-[#f7f4ee]" />;
  return (
    <TeamThemeProvider team={activeTeam}>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <MainSiteHeader teamAbbr={teamAbbr} active={null} />
        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[250px_1fr]">
          <aside className="h-fit rounded-3xl bg-[var(--dark)] p-3 text-[var(--team-on-dark)] lg:sticky lg:top-28">
            <div className="px-3 py-4">
              <p className="font-black">{user.name}</p>
              <p className="mt-1 truncate text-xs font-semibold text-white/45">{user.email}</p>
            </div>
            <nav className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {sections.map(([id, label, Icon]) => (
                <Link
                  key={id}
                  href={sectionHref(id)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold ${section === id ? 'bg-[var(--primary)] text-[var(--team-on-primary)]' : 'text-[var(--team-light-on-dark)] hover:bg-white/10 hover:text-[var(--team-on-dark)]'}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              ))}
            </nav>
          </aside>
          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-9">
            {section === 'profile' || section === 'account' ? (
              <ProfileSection name={user.name} email={user.email} />
            ) : null}
            {section === 'preferences' || section === 'my-team' ? (
              <PreferencesSection onTeamChange={handleTeamChange} />
            ) : null}
            {section === 'content' ? <CollectionSection section="saved" /> : null}
            {section === 'notifications' ? <NotificationsSection /> : null}
            {section === 'saved' ? <CollectionSection section="saved" /> : null}
            {section === 'front-office' ? <CollectionSection section="front-office" /> : null}
            {section === 'security' || section === 'devices' || section === 'privacy-security' ? (
              <SecuritySection />
            ) : null}
          </section>
        </main>
      </div>
    </TeamThemeProvider>
  );
}
