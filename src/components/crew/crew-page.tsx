'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, Flame, Settings, Share2, UserPlus, Users } from 'lucide-react';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useAuthUser } from '@/features/auth/auth-session';
import { useTeamStore } from '@/features/team/team-store';

type Crew = {
  id: string;
  name: string;
  teamAbbr: string;
  ownerUserId: string;
  role: string;
  weeklyYards: number;
  rank: number;
  members: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    weeklyYards: number;
    lifetimeYards: number;
  }>;
  activity: Array<{
    id: string;
    type: string;
    contentId: string | null;
    contentType: string | null;
    href: string | null;
    message: string | null;
    metadata: { title?: string };
    createdAt: string;
    actorName: string | null;
    reactions: Array<{ reaction: string; userId: string }>;
  }>;
  pendingInvites: Array<{
    id: string;
    channel: string;
    deliveryState: string;
    recipientHint: string | null;
  }>;
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
export default function CrewPage() {
  const { user, hydrated } = useAuthUser();
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const [crew, setCrew] = useState<Crew | null | undefined>();
  const [tab, setTab] = useState<'feed' | 'leaderboard' | 'members'>('feed');
  const [invite, setInvite] = useState(false);
  const [settings, setSettings] = useState(false);
  const load = async () => {
    const r = await fetch('/api/crew', { cache: 'no-store' });
    if (r.ok) setCrew((await r.json()).crew);
  };
  useEffect(() => {
    if (user) void load();
  }, [user]);
  const team = useMemo(
    () =>
      teams.find((t) => t.abbr === crew?.teamAbbr) ?? teams.find((t) => t.id === selectedTeamId),
    [crew?.teamAbbr, selectedTeamId, teams],
  );
  if (!hydrated) return null;
  if (!user)
    return (
      <TeamThemeProvider>
        <div className="min-h-screen bg-[#f7f4ee]">
          <MainSiteHeader />
          <main className="mx-auto max-w-xl px-6 py-24 text-center">
            <Users className="mx-auto h-12 w-12" />
            <h1 className="mt-5 text-4xl font-black">Your football circle.</h1>
            <Link
              href="/login?next=/crew"
              className="team-primary-filled mt-7 inline-flex rounded-full px-7 py-3 font-black"
            >
              Sign in to continue
            </Link>
          </main>
        </div>
      </TeamThemeProvider>
    );
  if (crew === undefined) return null;
  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <MainSiteHeader teamAbbr={crew?.teamAbbr} />
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {!crew ? (
            <CreateCrew
              name={user.name}
              teamAbbr={team?.abbr ?? 'KC'}
              teamName={team?.name ?? 'Chiefs'}
              onCreated={load}
            />
          ) : (
            <>
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--team-primary-text)]">
                    My Crew
                  </p>
                  <h1 className="mt-2 text-4xl font-black">{crew.name}</h1>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    {crew.members.length} {crew.members.length === 1 ? 'member' : 'members'} ·{' '}
                    {team?.name ?? crew.teamAbbr} fans
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInvite(true)}
                    className="team-primary-filled flex items-center gap-2 rounded-xl px-5 py-3 font-black"
                  >
                    <UserPlus className="h-4 w-4" />
                    Invite Friends
                  </button>
                  <button
                    onClick={() => setSettings(true)}
                    className="flex items-center gap-2 rounded-xl border bg-white px-5 py-3 font-black"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>
              </div>
              <section className="mt-8 grid gap-5 rounded-2xl bg-[#00172B] p-6 text-white sm:grid-cols-3">
                <Stat
                  label="This week (yards)"
                  value={crew.weeklyYards.toLocaleString()}
                  detail="Crew total"
                />
                <Stat label="Crew rank" value={`#${crew.rank}`} detail="Among active Crews" />
                <Stat label="Members" value={String(crew.members.length)} detail="All together" />
              </section>
              <div className="mt-7 flex gap-7 border-b">
                {(['feed', 'leaderboard', 'members'] as const).map((x) => (
                  <button
                    key={x}
                    onClick={() => setTab(x)}
                    className={`border-b-2 px-2 py-4 text-xs font-black uppercase tracking-wider ${tab === x ? 'border-[var(--primary)] text-[var(--team-primary-text)]' : 'border-transparent text-slate-500'}`}
                  >
                    {x}
                  </button>
                ))}
              </div>
              {tab === 'feed' ? (
                <Feed crew={crew} reload={load} />
              ) : tab === 'leaderboard' ? (
                <Leaderboard crew={crew} />
              ) : (
                <Members crew={crew} />
              )}
            </>
          )}
        </main>
        {invite && crew ? (
          <InviteModal crew={crew} close={() => setInvite(false)} reload={load} />
        ) : null}
        {settings && crew ? (
          <SettingsModal crew={crew} close={() => setSettings(false)} reload={load} />
        ) : null}
      </div>
    </TeamThemeProvider>
  );
}
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-white/15 sm:border-r last:border-0">
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/60">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="text-xs text-white/60">{detail}</p>
    </div>
  );
}
function CreateCrew({
  name,
  teamAbbr,
  teamName,
  onCreated,
}: {
  name: string;
  teamAbbr: string;
  teamName: string;
  onCreated: () => void;
}) {
  const [crewName, setCrewName] = useState(`${name.split(' ')[0]}’s ${teamName} Crew`);
  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
      <Users className="mx-auto h-12 w-12 text-[var(--team-primary-text)]" />
      <p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-[var(--team-primary-text)]">
        Build your Crew
      </p>
      <h1 className="mt-3 text-4xl font-black">Football is better with your people.</h1>
      <input
        value={crewName}
        onChange={(e) => setCrewName(e.target.value)}
        className="mt-7 h-12 w-full rounded-xl border px-4 font-bold"
        aria-label="Crew name"
      />
      <button
        onClick={async () => {
          await fetch('/api/crew', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: crewName, teamAbbr }),
          });
          onCreated();
        }}
        className="team-primary-filled mt-4 w-full rounded-xl py-3 font-black"
      >
        Create my Crew
      </button>
    </section>
  );
}
function Feed({ crew, reload }: { crew: Crew; reload: () => void }) {
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {crew.activity.length ? (
          crew.activity.map((a) => (
            <article key={a.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="text-sm font-bold">
                <span className="font-black">{a.actorName ?? 'A former member'}</span>{' '}
                {a.type === 'MEMBER_JOINED'
                  ? 'joined the Crew'
                  : a.type === 'CREW_CREATED'
                    ? 'started the Crew'
                    : 'shared with the Crew'}
              </p>
              {a.metadata.title ? (
                <h2 className="mt-4 text-xl font-black">{a.metadata.title}</h2>
              ) : null}
              {a.message ? <p className="mt-2 text-sm text-slate-600">{a.message}</p> : null}
              <div className="mt-4 flex items-center justify-between">
                {a.href ? (
                  <Link
                    href={a.href}
                    className="text-xs font-black text-[var(--team-primary-text)]"
                  >
                    View in Down & Distance
                  </Link>
                ) : (
                  <span />
                )}
                <div className="flex gap-1">
                  {[
                    ['FIRE', '🔥'],
                    ['LAUGH', '😂'],
                    ['EYES', '👀'],
                    ['LIKE', '👍'],
                  ].map(([v, e]) => (
                    <button
                      key={v}
                      onClick={async () => {
                        await fetch(`/api/crew/activity/${a.id}/reactions`, {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ reaction: v }),
                        });
                        reload();
                      }}
                      className="rounded-full bg-slate-100 px-2 py-1 text-sm"
                      aria-label={`React ${v}`}
                    >
                      {e} {a.reactions.filter((r) => r.reaction === v).length || ''}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
            <Share2 className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-3 font-black">Your Crew starts here</h2>
            <p className="mt-1 text-sm text-slate-500">
              Share a story or invite the people you already text about football.
            </p>
          </div>
        )}
      </div>
      <aside className="h-fit rounded-2xl border bg-white p-5">
        <h2 className="text-xs font-black uppercase tracking-wider">Crew activity</h2>
        {crew.activity.slice(0, 5).map((a) => (
          <p key={a.id} className="mt-4 border-t pt-4 text-sm font-bold">
            {a.actorName ?? 'Member'} · {a.type.replaceAll('_', ' ').toLowerCase()}
          </p>
        ))}
      </aside>
    </div>
  );
}
function Leaderboard({ crew }: { crew: Crew }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white">
      {crew.members.map((m, i) => (
        <div
          key={m.id}
          className="grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b p-5 last:border-0"
        >
          <span className="font-black">{i + 1}</span>
          <Avatar member={m} />
          <span className="font-black text-[var(--team-primary-text)]">{m.weeklyYards} YDS</span>
        </div>
      ))}
    </section>
  );
}
function Members({ crew }: { crew: Crew }) {
  return (
    <div className="mt-6 space-y-7">
      <section className="grid gap-4 sm:grid-cols-2">
        {crew.members.map((m) => (
          <article key={m.id} className="rounded-2xl border bg-white p-5">
            <Avatar member={m} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatSmall label="This week" value={`${m.weeklyYards} YDS`} />
              <StatSmall label="Lifetime" value={`${m.lifetimeYards} YDS`} />
            </div>
          </article>
        ))}
      </section>
      {crew.role === 'OWNER' && crew.pendingInvites.length ? (
        <section>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Pending invites
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border bg-white">
            {crew.pendingInvites.map((pending) => (
              <div
                key={pending.id}
                className="flex items-center justify-between border-b p-4 last:border-0"
              >
                <div>
                  <p className="font-black">{pending.recipientHint ?? 'Secure share link'}</p>
                  <p className="text-xs text-slate-500">{pending.channel.replace('_', ' ')}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase">
                  {pending.deliveryState.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
function Avatar({ member }: { member: Crew['members'][number] }) {
  return (
    <div className="flex items-center gap-3">
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#00172B] text-xs font-black text-white">
          {initials(member.displayName)}
        </span>
      )}
      <div>
        <p className="font-black">{member.displayName}</p>
        <p className="text-xs text-slate-500">
          {member.role === 'OWNER' ? 'Crew Owner' : 'Member'}
        </p>
      </div>
    </div>
  );
}
function StatSmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
function InviteModal({
  crew,
  close,
  reload,
}: {
  crew: Crew;
  close: () => void;
  reload: () => void;
}) {
  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | 'SHARE_LINK'>('EMAIL');
  const [recipient, setRecipient] = useState('');
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/crew/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel,
        recipient: channel === 'SHARE_LINK' ? undefined : recipient,
      }),
    });
    const b = await r.json();
    if (r.ok) {
      setLink(b.invite.inviteUrl);
      setStatus(
        b.invite.delivery.state === 'NOT_CONFIGURED'
          ? 'Provider not configured — copy the secure invite link below.'
          : 'Invite created.',
      );
      reload();
    } else setStatus(b.error ?? 'Unable to invite.');
  };
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-7">
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[var(--team-primary-text)]">
              Invite friends to your Crew
            </p>
            <h2 className="mt-2 text-2xl font-black">Bring your crew together.</h2>
          </div>
          <button type="button" onClick={close}>
            ✕
          </button>
        </div>
        <div className="mt-6 flex gap-2">
          {(['EMAIL', 'SMS', 'SHARE_LINK'] as const).map((x) => (
            <button
              type="button"
              key={x}
              onClick={() => setChannel(x)}
              className={`rounded-full px-4 py-2 text-xs font-black ${channel === x ? 'team-primary-filled' : 'bg-slate-100'}`}
            >
              {x.replace('_', ' ')}
            </button>
          ))}
        </div>
        {channel !== 'SHARE_LINK' ? (
          <input
            required
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={channel === 'EMAIL' ? 'friend@example.com' : '(555) 555-5555'}
            className="mt-5 h-12 w-full rounded-xl border px-4"
          />
        ) : null}
        <button className="team-primary-filled mt-5 w-full rounded-xl py-3 font-black">
          Create invite
        </button>
        {status ? <p className="mt-4 text-sm font-bold">{status}</p> : null}
        {link ? (
          <div className="mt-4 flex rounded-xl bg-slate-100 p-2">
            <input readOnly value={link} className="min-w-0 flex-1 bg-transparent px-2 text-sm" />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(link)}
              className="p-2"
              aria-label="Copy invite link"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
function SettingsModal({
  crew,
  close,
  reload,
}: {
  crew: Crew;
  close: () => void;
  reload: () => void;
}) {
  const [name, setName] = useState(crew.name);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7">
        <div className="flex justify-between">
          <h2 className="text-2xl font-black">Crew Settings</h2>
          <button onClick={close}>✕</button>
        </div>
        {crew.role === 'OWNER' ? (
          <>
            <label className="mt-6 block text-xs font-black uppercase">
              Crew name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 h-12 w-full rounded-xl border px-4 normal-case"
              />
            </label>
            <button
              onClick={async () => {
                await fetch('/api/crew', {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ name }),
                });
                reload();
                close();
              }}
              className="team-primary-filled mt-4 w-full rounded-xl py-3 font-black"
            >
              Save settings
            </button>
          </>
        ) : (
          <button
            onClick={async () => {
              await fetch('/api/crew', { method: 'DELETE' });
              location.reload();
            }}
            className="mt-6 w-full rounded-xl border border-red-300 py-3 font-black text-red-600"
          >
            Leave Crew
          </button>
        )}
        <p className="mt-6 text-xs font-bold text-slate-500">
          Crew Activity, Trivia & Challenges, and Game Day preferences are managed under Account →
          Notifications.
        </p>
      </div>
    </div>
  );
}
