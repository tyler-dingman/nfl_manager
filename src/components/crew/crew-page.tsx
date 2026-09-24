'use client';

/* Authenticated Crew media must be loaded with the viewer's cookies, not Next image optimization. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ChevronRight,
  Copy,
  Image as ImageIcon,
  Link as LinkIcon,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Smile,
  SquarePen,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { useProfileTeam } from '@/features/team/use-profile-team';
import ProfileLayout from '@/components/auth/profile-navigation';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import UserAvatar from '@/components/auth/user-avatar';
import { useAuthUser, type AuthUser } from '@/features/auth/auth-session';
import { useTeamStore } from '@/features/team/team-store';
import { canManageCrew } from '@/features/crew/policy';
import { crewPostSchema } from '@/features/crew/validation';
import type { Crew, CrewActivity, CrewMember } from '@/features/crew/types';
import { CrewPhoto, resizedPhoto, uploadPhoto } from './crew-photo';
import { CrewDialog, crewRequest, dateLabel, relativeTime } from './crew-ui';
import styles from './crew-page.module.css';

type Tab = 'feed' | 'members' | 'leaderboard' | 'settings';
type Confirmation = { title: string; message: string; action: () => Promise<void> };

export default function CrewPage() {
  const { user, hydrated } = useAuthUser();
  const teams = useTeamStore((s) => s.teams);
  const [fanTeamAbbr] = useProfileTeam();
  const [crew, setCrew] = useState<Crew | null | undefined>();
  const [tab, setTab] = useState<Tab>('feed'),
    [invite, setInvite] = useState(false),
    [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [composeRequest, setComposeRequest] = useState(0);
  const load = useCallback(async () => {
    try {
      const data = await crewRequest('/api/crew');
      setCrew(data.crew);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);
  const team = useMemo(() => teams.find((t) => t.abbr === fanTeamAbbr), [teams, fanTeamAbbr]);
  const crewTeam = teams.find((t) => t.abbr === crew?.teamAbbr);
  const manage = canManageCrew(crew?.role ?? '');
  const leave = () => {
    if (crew?.role === 'OWNER') {
      setConfirmation({
        title: 'Crew ownership',
        message:
          'Crew owners cannot leave until ownership is transferred. Your Crew and membership will stay intact.',
        action: async () => {},
      });
      return;
    }
    setConfirmation({
      title: 'Leave Crew?',
      message:
        'You will lose access to this Crew’s feed and photos. You can rejoin with a new invitation.',
      action: async () => {
        await crewRequest('/api/crew', 'DELETE');
        await load();
        setTab('feed');
      },
    });
  };
  const remove = (member: CrewMember) =>
    setConfirmation({
      title: `Remove ${member.displayName}?`,
      message: 'This member will lose access to the Crew. They can return with a new invitation.',
      action: async () => {
        await crewRequest(`/api/crew/members/${member.id}`, 'DELETE');
        await load();
      },
    });
  const makePost = () => {
    setTab('feed');
    setComposeRequest((n) => n + 1);
  };
  const owner =
    crew?.ownerName ?? crew?.members.find((m) => m.id === crew.ownerUserId)?.displayName;
  if (fanTeamAbbr === undefined) return <div className="min-h-screen bg-[#f7f4ee]" />;
  return (
    <TeamThemeProvider team={team}>
      <div className={styles.page}>
        <MainSiteHeader teamAbbr={team?.abbr} />
        <ProfileLayout>
          <div className={`${styles.main} rounded-3xl bg-white p-6 shadow-sm sm:p-9`}>
            {!hydrated ? (
              <p role="status">Loading your Crew…</p>
            ) : !user ? (
              <section className={`${styles.card} ${styles.emptyFeed}`}>
                <Users size={40} />
                <h1 className="text-3xl font-black">Your football circle.</h1>
                <Link className={`${styles.primary} mt-5`} href="/login?next=/crew">
                  Sign in to continue
                </Link>
              </section>
            ) : crew === undefined ? (
              <p role="status">
                {error || 'Loading your Crew…'}{' '}
                {error && (
                  <button className={styles.textButton} onClick={load}>
                    Try again
                  </button>
                )}
              </p>
            ) : !crew ? (
              <CreateCrew
                name={user.name}
                teamAbbr={team?.abbr ?? ''}
                teamName={team?.name ?? 'Football'}
                onCreated={load}
              />
            ) : (
              <>
                <header className={styles.hero}>
                  <div className={styles.identity}>
                    <CrewPhoto
                      url={crew.photoUrl}
                      canEdit={manage}
                      onSaved={(url) => setCrew({ ...crew, photoUrl: url })}
                    />
                    <div>
                      <p className={styles.eyebrow}>MY CREW</p>
                      <h1>{crew.name}</h1>
                      <p className={styles.metadata}>
                        {crew.members.length} {crew.members.length === 1 ? 'member' : 'members'} ·{' '}
                        {crewTeam?.name ?? crew.teamAbbr} fans
                        {owner ? ` · Created by ${owner}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className={styles.heroActions}>
                    <button className={styles.primary} onClick={() => setInvite(true)}>
                      <UserPlus size={19} />
                      Invite Friends
                    </button>
                    <button className={styles.secondary} onClick={() => setTab('settings')}>
                      <Settings size={19} />
                      Settings
                    </button>
                    <details className={styles.overflow}>
                      <summary className={styles.iconButton} aria-label="Crew options">
                        <MoreHorizontal size={21} />
                      </summary>
                      <div>
                        <button onClick={leave}>Leave Crew</button>
                      </div>
                    </details>
                  </div>
                </header>
                <section className={styles.stats} aria-label="Crew statistics">
                  <Stat
                    label="THIS WEEK (YARDS)"
                    value={crew.weeklyYards.toLocaleString()}
                    detail="Crew total"
                  />
                  <Stat label="CREW RANK" value={`#${crew.rank}`} detail="Among active Crews" />
                  <Stat label="MEMBERS" value={String(crew.members.length)} detail="All together" />
                  <Stat
                    label="JOINED"
                    value={dateLabel(
                      crew.createdAt ??
                        crew.activity.find((a) => a.type === 'CREW_CREATED')?.createdAt,
                    )}
                    detail="Crew created"
                  />
                </section>
                <div className={styles.tabs} role="tablist" aria-label="Crew navigation">
                  {(['feed', 'members', 'leaderboard', 'settings'] as const).map((value) => (
                    <button
                      key={value}
                      id={`crew-tab-${value}`}
                      role="tab"
                      aria-selected={tab === value}
                      aria-controls="crew-panel"
                      tabIndex={tab === value ? 0 : -1}
                      onKeyDown={(e) => {
                        const all: Tab[] = ['feed', 'members', 'leaderboard', 'settings'];
                        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                          e.preventDefault();
                          const next =
                            e.key === 'Home'
                              ? 'feed'
                              : e.key === 'End'
                                ? 'settings'
                                : all[(all.indexOf(value) + (e.key === 'ArrowRight' ? 1 : 3)) % 4];
                          setTab(next);
                          document.getElementById(`crew-tab-${next}`)?.focus();
                        }
                      }}
                      onClick={() => setTab(value)}
                    >
                      {value === 'members'
                        ? `MEMBERS (${crew.members.length})`
                        : value.toUpperCase()}
                    </button>
                  ))}
                </div>
                {error && (
                  <p role="alert" className={styles.error}>
                    {error}
                  </p>
                )}
                <section id="crew-panel" role="tabpanel" aria-labelledby={`crew-tab-${tab}`}>
                  {tab === 'feed' ? (
                    <div className={styles.feedGrid}>
                      <div className={styles.feed}>
                        <Composer user={user} reload={load} focusRequest={composeRequest} />
                        {crew.activity.length ? (
                          crew.activity.map((activity) => (
                            <FeedPost
                              key={activity.id}
                              activity={activity}
                              userId={user.id}
                              manage={manage}
                              reload={load}
                              confirm={setConfirmation}
                            />
                          ))
                        ) : (
                          <div className={`${styles.card} ${styles.emptyFeed}`}>
                            <MessageCircle size={32} />
                            <h2>Your Crew starts here</h2>
                            <p className={styles.muted}>Share the first message with your crew.</p>
                          </div>
                        )}
                        <GetStarted
                          invite={() => setInvite(true)}
                          post={makePost}
                          leaderboard={() => setTab('leaderboard')}
                        />
                      </div>
                      <aside className={styles.sidebar}>
                        <section className={styles.card}>
                          <div className={styles.cardHeading}>
                            <h2>CREW MEMBERS ({crew.members.length})</h2>
                            <button className={styles.textButton} onClick={() => setTab('members')}>
                              See all
                            </button>
                          </div>
                          {crew.members.slice(0, 4).map((member) => (
                            <div className={styles.memberPreview} key={member.id}>
                              <MemberPerson
                                member={member}
                                currentUserId={user.id}
                                canRemove={manage && member.role !== 'OWNER'}
                                remove={() => remove(member)}
                              />
                            </div>
                          ))}
                          <button className={styles.outline} onClick={() => setInvite(true)}>
                            <UserPlus size={18} />
                            Invite Friends
                          </button>
                        </section>
                        <section className={styles.card}>
                          <h2 className={styles.sectionTitle}>QUICK ACTIONS</h2>
                          <div className={styles.quickActions}>
                            {[
                              {
                                label: 'Invite Friends',
                                icon: Users,
                                action: () => setInvite(true),
                              },
                              {
                                label: 'Manage Settings',
                                icon: Settings,
                                action: () => setTab('settings'),
                              },
                              {
                                label: 'View Leaderboard',
                                icon: BarChart3,
                                action: () => setTab('leaderboard'),
                              },
                              { label: 'Leave Crew', icon: LogOut, action: leave },
                            ].map(({ label, icon: Icon, action }) => (
                              <button key={label} onClick={action}>
                                <Icon size={20} />
                                {label}
                                <ChevronRight size={18} />
                              </button>
                            ))}
                          </div>
                        </section>
                        <section className={styles.card}>
                          <h2 className={styles.sectionTitle}>CREW ACTIVITY</h2>
                          {crew.activity.slice(0, 4).map((activity) => (
                            <div key={activity.id} className={styles.activityItem}>
                              <span className={styles.activityIcon}>
                                <Users size={21} />
                              </span>
                              <div>
                                <p>
                                  <strong>{activity.actorName ?? 'A former member'}</strong>{' '}
                                  {activity.type === 'CREW_CREATED'
                                    ? 'created this crew'
                                    : activity.type === 'MEMBER_JOINED'
                                      ? 'joined the crew'
                                      : 'shared with the crew'}
                                </p>
                                <time className={styles.muted} dateTime={activity.createdAt}>
                                  {relativeTime(activity.createdAt)}
                                </time>
                              </div>
                            </div>
                          ))}
                          {!crew.activity.length && (
                            <p className={styles.notice}>
                              Activity will appear here as your Crew gets involved.
                            </p>
                          )}
                        </section>
                      </aside>
                    </div>
                  ) : tab === 'members' ? (
                    <Members crew={crew} currentUserId={user.id} remove={remove} />
                  ) : tab === 'leaderboard' ? (
                    <Leaderboard crew={crew} />
                  ) : (
                    <SettingsPanel crew={crew} reload={load} leave={leave} />
                  )}
                </section>
              </>
            )}
          </div>
        </ProfileLayout>
        {invite && crew && <InviteModal crew={crew} close={() => setInvite(false)} reload={load} />}{' '}
        {confirmation && (
          <ConfirmDialog confirmation={confirmation} close={() => setConfirmation(null)} />
        )}
      </div>
    </TeamThemeProvider>
  );
}
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className={styles.stat}>
      <p>{label}</p>
      <strong>{value}</strong>
      <p>{detail}</p>
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
  onCreated: () => Promise<void>;
}) {
  const [crewName, setCrewName] = useState(`${name.split(' ')[0]}’s ${teamName} Crew`),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className={`${styles.card} ${styles.settings}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await crewRequest('/api/crew', 'POST', { name: crewName, teamAbbr });
          await onCreated();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className={styles.eyebrow}>BUILD YOUR CREW</p>
      <h1 className="text-3xl font-black">Football is better with your people.</h1>
      <label className={styles.field}>
        Crew name
        <input
          value={crewName}
          onChange={(e) => setCrewName(e.target.value)}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button className={`${styles.primary} mt-5`} disabled={busy || !teamAbbr}>
        {busy ? 'Creating…' : 'Create my Crew'}
      </button>
    </form>
  );
}
function Composer({
  user,
  reload,
  focusRequest,
}: {
  user: AuthUser;
  reload: () => Promise<void>;
  focusRequest: number;
}) {
  const [kind, setKind] = useState<'TEXT' | 'PHOTO' | 'LINK'>('TEXT'),
    [message, setMessage] = useState(''),
    [href, setHref] = useState(''),
    [photo, setPhoto] = useState<{ id: string; url: string } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusRequest) {
      input.current?.focus();
      input.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [focusRequest]);
  const payload = {
    kind,
    message,
    ...(kind === 'LINK' ? { href } : {}),
    ...(kind === 'PHOTO' && photo ? { mediaId: photo.id } : {}),
  };
  const valid = crewPostSchema.safeParse(payload).success;
  const post = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await crewRequest('/api/crew/posts', 'POST', payload);
      setMessage('');
      setHref('');
      setPhoto(null);
      setKind('TEXT');
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={styles.card} onSubmit={post} aria-label="Create Crew post">
      <div className={styles.composerRow}>
        <UserAvatar name={user.name} src={user.avatarUrl} size="md" className="bg-slate-100" />
        <textarea
          ref={input}
          rows={1}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share a message with your crew..."
          aria-label="Share a message with your crew"
        />
      </div>
      {kind === 'LINK' && (
        <label className={styles.field}>
          Link URL
          <input
            type="url"
            placeholder="https://"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            maxLength={2048}
          />
        </label>
      )}
      {kind === 'PHOTO' && (
        <div className={styles.attachment}>
          {photo && <img src={photo.url} alt="Attached post photo" />}
          <button
            type="button"
            className={styles.textButton}
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            {photo ? 'Replace photo' : 'Choose photo'}
          </button>
          {photo && (
            <button type="button" className={styles.textButton} onClick={() => setPhoto(null)}>
              Remove
            </button>
          )}
        </div>
      )}
      <input
        ref={file}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Attach post photo"
        onChange={async (e) => {
          const selected = e.target.files?.[0];
          e.target.value = '';
          if (!selected) return;
          setBusy(true);
          setError('');
          try {
            setPhoto(await uploadPhoto(await resizedPhoto(selected)));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <div className={styles.composerControls}>
        {[
          { kind: 'TEXT', label: 'Text', icon: SquarePen },
          { kind: 'PHOTO', label: 'Photo', icon: ImageIcon },
          { kind: 'LINK', label: 'Link', icon: LinkIcon },
        ].map(({ kind: value, label, icon: Icon }) => (
          <button
            type="button"
            key={value}
            aria-pressed={kind === value}
            disabled={busy}
            onClick={() => {
              setKind(value as typeof kind);
              if (value === 'PHOTO' && !photo) file.current?.click();
            }}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
        <button type="submit" className={styles.primary} disabled={!valid || busy}>
          {busy ? 'Saving…' : 'Post'}
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
function FeedPost({
  activity: a,
  userId,
  manage,
  reload,
  confirm,
}: {
  activity: CrewActivity;
  userId: string;
  manage: boolean;
  reload: () => Promise<void>;
  confirm: (value: Confirmation) => void;
}) {
  const [comments, setComments] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const reaction = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await crewRequest(`/api/crew/activity/${a.id}/reactions`, 'POST', { reaction: value });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const canDelete = a.type.startsWith('POST_') && (manage || a.actorUserId === userId);
  return (
    <article className={styles.card}>
      <div className={styles.postTop}>
        <UserAvatar
          src={a.actorAvatar}
          name={a.actorName ?? 'Former member'}
          size="md"
          className="bg-slate-100"
        />
        <div>
          <strong>{a.actorName ?? 'A former member'}</strong>
          <br />
          <time dateTime={a.createdAt}>{relativeTime(a.createdAt)}</time>
        </div>
        {canDelete && (
          <details className={styles.overflow}>
            <summary aria-label="Post options">
              <MoreHorizontal size={20} />
            </summary>
            <div>
              <button
                onClick={() =>
                  confirm({
                    title: 'Delete post?',
                    message: 'This post and its comments will be permanently removed.',
                    action: async () => {
                      await crewRequest(`/api/crew/activity/${a.id}`, 'DELETE');
                      await reload();
                    },
                  })
                }
              >
                Delete post
              </button>
            </div>
          </details>
        )}
      </div>
      <div className={styles.postBody}>
        {a.type === 'CREW_CREATED' ? (
          <h3>{a.actorName ?? 'A former member'} started the Crew</h3>
        ) : a.type === 'MEMBER_JOINED' ? (
          <h3>{a.actorName ?? 'A former member'} joined the Crew</h3>
        ) : a.metadata.title ? (
          <h3>{a.metadata.title}</h3>
        ) : null}
        {a.message && <p>{a.message}</p>}
        {a.metadata.photoUrl && (
          <img
            className={styles.postImage}
            src={a.metadata.photoUrl}
            alt="Photo shared with the Crew"
          />
        )}
        {a.href &&
          (/^https?:\/\//i.test(a.href) ||
            (a.href.startsWith('/') && !a.href.startsWith('//'))) && (
            <a
              className={styles.postLink}
              href={a.href}
              target={a.href.startsWith('/') ? undefined : '_blank'}
              rel="noopener noreferrer"
            >
              {a.metadata.title ?? a.href}
            </a>
          )}
      </div>
      <div className={styles.reactions}>
        <button
          disabled={busy}
          aria-label="React FIRE"
          aria-pressed={a.reactions.some((r) => r.reaction === 'FIRE' && r.userId === userId)}
          onClick={() => reaction('FIRE')}
        >
          🔥 {a.reactions.filter((r) => r.reaction === 'FIRE').length}
        </button>
        <button
          onClick={() => setComments(!comments)}
          aria-expanded={comments}
          aria-label="Comments"
        >
          <MessageCircle size={18} />
          {a.comments?.length ?? 0}
        </button>
        <details className={styles.reactionPicker}>
          <summary aria-label="More reactions">
            <Smile size={18} />
          </summary>
          <div>
            {[
              ['LAUGH', '😂'],
              ['EYES', '👀'],
              ['LIKE', '👍'],
            ].map(([value, emoji]) => (
              <button
                key={value}
                disabled={busy}
                aria-label={`React ${value}`}
                aria-pressed={a.reactions.some((r) => r.reaction === value && r.userId === userId)}
                onClick={() => reaction(value)}
              >
                {emoji} {a.reactions.filter((r) => r.reaction === value).length}
              </button>
            ))}
          </div>
        </details>
      </div>
      {comments && (
        <div className="mt-4">
          {a.comments?.map((c) => (
            <div key={c.id} className={styles.comment}>
              <strong>{c.actorName ?? 'A former member'}</strong>{' '}
              <time className={styles.muted}>{relativeTime(c.createdAt)}</time>
              <p>{c.message}</p>
            </div>
          ))}
          <form
            className={styles.commentForm}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!message.trim() || busy) return;
              setBusy(true);
              try {
                await crewRequest(`/api/crew/activity/${a.id}/comments`, 'POST', { message });
                setMessage('');
                await reload();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              aria-label="Write a comment"
              placeholder="Write a comment…"
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className={styles.outline} disabled={!message.trim() || busy}>
              Reply
            </button>
          </form>
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </article>
  );
}
function GetStarted({
  invite,
  post,
  leaderboard,
}: {
  invite: () => void;
  post: () => void;
  leaderboard: () => void;
}) {
  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>GET STARTED</h2>
      <div className={styles.onboarding}>
        {[
          {
            title: 'Invite Friends',
            description: 'Grow your crew and climb the leaderboard.',
            cta: 'Invite Now',
            icon: Users,
            action: invite,
          },
          {
            title: 'Start the Conversation',
            description: 'Post a message, share a photo or drop a link.',
            cta: 'Make a Post',
            icon: MessageCircle,
            action: post,
          },
          {
            title: 'Compete Together',
            description: 'Earn yards and see how your crew stacks up.',
            cta: 'View Leaderboard',
            icon: Trophy,
            action: leaderboard,
          },
        ].map(({ title, description, cta, icon: Icon, action }) => (
          <div key={title}>
            <Icon
              size={32}
              style={title === 'Compete Together' ? { color: '#f4ad00' } : undefined}
            />
            <h3>{title}</h3>
            <p>{description}</p>
            <button className={styles.outline} onClick={action}>
              {cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
function MemberPerson({
  member,
  currentUserId,
  canRemove,
  remove,
}: {
  member: CrewMember;
  currentUserId?: string;
  canRemove?: boolean;
  remove?: () => void;
}) {
  return (
    <div className={styles.person}>
      <UserAvatar
        src={member.avatarUrl}
        name={member.displayName}
        size="md"
        className="bg-slate-100"
      />
      <div>
        <strong>{member.displayName}</strong>
        {member.role === 'OWNER' && <span className={styles.role}>CREATOR</span>}
        <p className={styles.status}>
          {member.id === currentUserId
            ? 'You'
            : member.role === 'OWNER'
              ? 'Crew owner'
              : member.role === 'ADMIN'
                ? 'Admin'
                : 'Member'}
        </p>
      </div>
      {canRemove && (
        <details className={`${styles.overflow} ml-auto`}>
          <summary aria-label={`Manage ${member.displayName}`}>
            <MoreHorizontal size={18} />
          </summary>
          <div>
            <button onClick={remove}>Remove member</button>
          </div>
        </details>
      )}
    </div>
  );
}
function Members({
  crew,
  currentUserId,
  remove,
}: {
  crew: Crew;
  currentUserId: string;
  remove: (member: CrewMember) => void;
}) {
  return (
    <div className={styles.feed}>
      <div className={styles.memberGrid}>
        {crew.members.map((member) => (
          <article key={member.id} className={styles.card}>
            <MemberPerson
              member={member}
              currentUserId={currentUserId}
              canRemove={canManageCrew(crew.role) && member.role !== 'OWNER'}
              remove={() => remove(member)}
            />
            <p className={`${styles.muted} mt-4`}>Joined {dateLabel(member.joinedAt)}</p>
            <div className={styles.memberStats}>
              <p>
                This week<strong>{member.weeklyYards.toLocaleString()} YDS</strong>
              </p>
              <p>
                Lifetime<strong>{member.lifetimeYards.toLocaleString()} YDS</strong>
              </p>
            </div>
          </article>
        ))}
      </div>
      {canManageCrew(crew.role) && crew.pendingInvites.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>PENDING INVITES</h2>
          {crew.pendingInvites.map((p) => (
            <div key={p.id} className={styles.activityItem}>
              <div>
                <strong>{p.recipientHint ?? 'Secure share link'}</strong>
                <p className={styles.muted}>
                  {p.channel.replaceAll('_', ' ')} · {p.deliveryState.replaceAll('_', ' ')}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
function Leaderboard({ crew }: { crew: Crew }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>THIS WEEK’S CREW LEADERBOARD</h2>
      {[...crew.members]
        .sort((a, b) => b.weeklyYards - a.weeklyYards)
        .map((member, i) => (
          <div key={member.id} className={styles.leaderRow}>
            <strong>#{i + 1}</strong>
            <MemberPerson member={member} />
            <strong>{member.weeklyYards.toLocaleString()} YDS</strong>
          </div>
        ))}
    </section>
  );
}
function SettingsPanel({
  crew,
  reload,
  leave,
}: {
  crew: Crew;
  reload: () => Promise<void>;
  leave: () => void;
}) {
  const [name, setName] = useState(crew.name),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className={`${styles.card} ${styles.settings}`}>
      <h2 className={styles.sectionTitle}>CREW SETTINGS</h2>
      {canManageCrew(crew.role) ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setStatus('');
            try {
              await crewRequest('/api/crew', 'PATCH', { name });
              await reload();
              setStatus('Crew settings saved.');
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className={styles.field}>
            Crew name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <button className={`${styles.primary} mt-5`} disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      ) : (
        <p className={styles.notice}>
          Only the Crew owner can edit the name and photo. You can manage your account preferences
          below.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {status && (
        <p role="status" className={styles.notice}>
          {status}
        </p>
      )}
      <p className={styles.notice}>
        Crew Activity, Trivia &amp; Challenges, and Game Day preferences are managed under{' '}
        <Link className={styles.textButton} href="/account/notifications">
          Account → Notifications
        </Link>
        .
      </p>
      <button className={styles.outline} onClick={leave}>
        Leave Crew
      </button>
      {crew.role === 'OWNER' && (
        <p className={styles.notice}>Ownership must be transferred before the creator can leave.</p>
      )}
    </section>
  );
}
function ConfirmDialog({ confirmation, close }: { confirmation: Confirmation; close: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <CrewDialog
      title={confirmation.title}
      close={() => {
        if (!busy) close();
      }}
    >
      <p className={styles.notice}>{confirmation.message}</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {confirmation.title === 'Crew ownership' ? (
        <button className={styles.primary} onClick={close}>
          Got it
        </button>
      ) : (
        <div className="mt-5 flex justify-end gap-3">
          <button className={styles.secondary} disabled={busy} onClick={close}>
            Cancel
          </button>
          <button
            className={styles.primary}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await confirmation.action();
                close();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      )}
    </CrewDialog>
  );
}
function InviteModal({
  crew,
  close,
  reload,
}: {
  crew: Crew;
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | 'SHARE_LINK'>('EMAIL'),
    [recipient, setRecipient] = useState(''),
    [link, setLink] = useState(''),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <CrewDialog
      title="Invite Friends"
      close={() => {
        if (!busy) close();
      }}
    >
      <p className={styles.notice}>Invite friends to {crew.name}.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const data = await crewRequest('/api/crew/invites', 'POST', {
              channel,
              recipient: channel === 'SHARE_LINK' ? undefined : recipient,
            });
            setLink(data.invite.inviteUrl);
            setStatus(
              data.invite.delivery.state === 'NOT_CONFIGURED'
                ? 'Provider not configured — copy the secure invite link below.'
                : 'Invite created.',
            );
            await reload();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex flex-wrap gap-2">
          {(['EMAIL', 'SMS', 'SHARE_LINK'] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={channel === value ? styles.primary : styles.secondary}
              aria-pressed={channel === value}
              onClick={() => setChannel(value)}
            >
              {value.replace('_', ' ')}
            </button>
          ))}
        </div>
        {channel !== 'SHARE_LINK' && (
          <label className={styles.field}>
            {channel === 'EMAIL' ? 'Email address' : 'Phone number'}
            <input
              required
              type={channel === 'EMAIL' ? 'email' : 'tel'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={channel === 'EMAIL' ? 'friend@example.com' : '(555) 555-5555'}
            />
          </label>
        )}
        <button className={`${styles.primary} mt-5 w-full`} disabled={busy}>
          {busy ? 'Creating…' : 'Create invite'}
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className={styles.notice}>
            {status}
          </p>
        )}
        {link && (
          <div className={styles.commentForm}>
            <input aria-label="Invite link" readOnly value={link} />
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Copy invite link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setStatus('Invite link copied.');
                } catch {
                  setError('Copy the link from the field above.');
                }
              }}
            >
              <Copy size={18} />
            </button>
          </div>
        )}
      </form>
    </CrewDialog>
  );
}
