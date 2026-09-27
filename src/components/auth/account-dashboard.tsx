'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  UserRound,
  Pencil,
  Settings,
  Link2,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
  Shield,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserAvatar from './user-avatar';
import AuthProviderIcon, { providerDisplayName } from './auth-provider-icon';
import {
  type AuthUser,
  clearPreviewSession,
  notifyAuthChanged,
} from '@/features/auth/auth-session';
import { getEditorialHeroTheme } from '@/lib/team-theme-tokens';
import { TEAM_LIST } from '@/data/teams';
import {
  ACCOUNT_PREFERENCES,
  loadAccountData,
  accountMutation,
  type AccountData,
} from '../../../packages/account/model';
import styles from './account-dashboard.module.css';

function Card({
  title,
  icon: Icon,
  action,
  children,
  className = '',
}: {
  title: string;
  icon: typeof UserRound;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className}`}>
      <header>
        <h2>
          <Icon size={21} />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export default function AccountDashboard({
  user,
  teamAbbr,
}: {
  user: AuthUser;
  teamAbbr: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [name, setName] = useState(user.name),
    [email, setEmail] = useState(user.email),
    [avatar, setAvatar] = useState(user.avatarUrl ?? '');
  const nameRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const team = TEAM_LIST.find((t) => t.abbr === teamAbbr);
  const theme = getEditorialHeroTheme(teamAbbr ?? 'NFL');
  const load = useCallback(() => loadAccountData(fetch, user.id).then(setData), [user.id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (editing) nameRef.current?.focus();
    else if (photo) photoRef.current?.focus();
  }, [editing, photo]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setBusy(false);
    }
  };
  const resetDraft = () => {
    setName(user.name);
    setEmail(user.email);
    setAvatar(user.avatarUrl ?? '');
  };
  const editProfile = () => {
    resetDraft();
    setPhoto(false);
    setEditing(true);
  };
  const save = () =>
    run(async () => {
      await accountMutation(fetch, '/api/user/profile', 'PATCH', {
        displayName: name,
        avatarUrl: avatar.trim() || null,
      });
      if (email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
        await accountMutation(fetch, '/api/user/email-change/request', 'POST', { email });
        setMessage('Profile saved. Check your new email to confirm the email change.');
      } else setMessage('Profile saved.');
      notifyAuthChanged();
      setEditing(false);
      setPhoto(false);
    });
  const overview = [
    {
      label: 'Trivia Points',
      value: data?.points?.toLocaleString() ?? '—',
      href: '/rewards',
      cta: 'View Rewards',
      Icon: Trophy,
    },
    {
      label: 'Global Rank',
      value: data?.rank ? `#${data.rank}` : '—',
      href: '/trivia#trivia-leaderboard',
      cta: 'View Leaderboard',
      Icon: Users,
    },
    {
      label: 'Favorite Team',
      value: team?.name ?? 'Choose a team',
      href: '/account/my-team',
      cta: 'Change Team',
      Icon: Shield,
    },
    {
      label: 'Crew',
      value: data?.crew ?? 'No crew yet',
      href: '/crew',
      cta: 'View Crew',
      Icon: Users,
    },
  ];
  return (
    <div
      className={styles.dashboard}
      style={{ '--account-accent': theme.heroPrimaryAccent } as CSSProperties}
    >
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>MY ACCOUNT</p>
          <h1>{user.name}</h1>
          <p>Manage your account, preferences, and how you appear across Down &amp; Distance.</p>
        </div>
        <div className={styles.heroProfile}>
          <UserAvatar src={user.avatarUrl} name={user.name} className={styles.avatar} />
          <button onClick={editProfile}>
            <Pencil size={16} />
            Edit Profile
          </button>
        </div>
      </section>
      <div className={styles.content}>
        <div className={styles.overview}>
          {overview.map(({ label, value, href, cta, Icon }) => (
            <Link href={href} key={label}>
              <Icon aria-hidden="true" />
              <div>
                <strong className={label === 'Crew' ? styles.crewName : undefined}>{value}</strong>
                <p>{label}</p>
                <span>{cta} →</span>
              </div>
            </Link>
          ))}
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <div className={styles.columns}>
          <Card
            title="Profile Information"
            icon={UserRound}
            className={styles.profile}
            action={
              <button
                onClick={() => {
                  resetDraft();
                  setEditing(!editing);
                  setPhoto(false);
                }}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className={styles.field}>
                <label htmlFor="account-name">Display Name</label>
                {editing ? (
                  <input
                    id="account-name"
                    ref={nameRef}
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                ) : (
                  <p>{user.name}</p>
                )}
              </div>
              <div className={styles.field}>
                <label htmlFor="account-email">Email</label>
                {editing ? (
                  <input
                    id="account-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                ) : (
                  <p>{user.email || 'No email on file'}</p>
                )}
              </div>
              <div className={styles.field}>
                <span>Profile Picture</span>
                <div className={styles.photo}>
                  <UserAvatar
                    src={user.avatarUrl}
                    name={user.name}
                    className={styles.smallAvatar}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!editing) resetDraft();
                      setPhoto(!photo);
                    }}
                  >
                    Change Photo
                  </button>
                </div>
              </div>
              {(photo || editing) && (
                <label className={styles.photoInput}>
                  Profile photo URL
                  <input
                    ref={photoRef}
                    type="url"
                    value={avatar}
                    maxLength={2048}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://…"
                  />
                  <small>Use an image URL, or leave blank to remove your photo.</small>
                </label>
              )}
              <div className={styles.field}>
                <span>Favorite Team</span>
                <div className={styles.team}>
                  {team?.logoUrl && <Image src={team.logoUrl} alt="" width={36} height={36} />}
                  <p>{team?.name ?? 'No favorite team selected'}</p>
                  <Link href="/account/my-team">Change Team →</Link>
                </div>
              </div>
              {(editing || photo) && (
                <button type="submit" disabled={busy} className={styles.save}>
                  {busy ? 'Saving…' : 'Save profile'}
                </button>
              )}
            </form>
          </Card>
          <Card
            title="Preferences"
            icon={Settings}
            action={<Link href="/account/notifications">Edit</Link>}
          >
            {data?.preferences ? (
              ACCOUNT_PREFERENCES.map((pref) => (
                <label className={styles.preference} key={pref.key}>
                  <Bell size={18} />
                  <span>
                    <strong>{pref.label}</strong>
                    <small>{pref.description}</small>
                  </span>
                  <input
                    aria-label={pref.label}
                    role="switch"
                    type="checkbox"
                    checked={Boolean(data.preferences?.[pref.key])}
                    disabled={busy}
                    onChange={(e) => {
                      const value = e.target.checked;
                      void run(async () => {
                        const result = await accountMutation(
                          fetch,
                          '/api/user/preferences',
                          'PATCH',
                          { [pref.key]: value },
                        );
                        setData({ ...data, preferences: result.preferences });
                      });
                    }}
                  />
                </label>
              ))
            ) : (
              <p className={styles.muted}>
                {data ? 'Preferences are unavailable.' : 'Loading preferences…'}
              </p>
            )}
            <Link className={styles.textLink} href="/account/notifications">
              Manage notification delivery <ArrowRight size={14} />
            </Link>
          </Card>
          <Card
            title="Connected Accounts"
            icon={Link2}
            action={<Link href="/account/privacy-security">Manage</Link>}
          >
            {data?.identities ? (
              Array.from(
                new Set([
                  ...data.identities.map((i) => i.provider),
                  ...Object.keys(data.providers).filter((p) => data.providers[p]),
                ]),
              ).map((provider) => {
                const identity = data.identities?.find((i) => i.provider === provider);
                return (
                  <div className={styles.provider} key={provider}>
                    <AuthProviderIcon provider={provider} className="h-5 w-5" />
                    <strong>{providerDisplayName(provider)}</strong>
                    <span>{identity ? 'Connected' : 'Not Connected'}</span>
                    <button
                      disabled={busy || Boolean(identity && data.identities!.length <= 1)}
                      onClick={() =>
                        void run(async () => {
                          if (identity) {
                            await accountMutation(
                              fetch,
                              `/api/auth/identities/${identity.id}`,
                              'DELETE',
                            );
                            await load();
                          } else {
                            const body = await accountMutation(
                              fetch,
                              '/api/auth/identities/link',
                              'POST',
                              { provider },
                            );
                            if (body.url) window.location.assign(body.url);
                            else throw Error('Connection could not be started.');
                          }
                        })
                      }
                    >
                      {identity ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className={styles.muted}>
                {data ? 'Connected accounts are unavailable.' : 'Loading connected accounts…'}
              </p>
            )}
          </Card>
          <Card title="Your Data, Your Control" icon={ShieldCheck} className={styles.privacy}>
            <p className={styles.muted}>Manage your data, account security and privacy settings.</p>
            <Link className={styles.textLink} href="/account/privacy-security">
              Privacy &amp; Security →
            </Link>
          </Card>
          <Card title="Danger Zone" icon={Trash2} className={styles.danger}>
            <strong>Delete Account</strong>
            <p className={styles.muted}>Permanently delete your account and associated data.</p>
            <button
              disabled={busy}
              onClick={() => {
                if (window.prompt('Type DELETE to permanently remove your account.') !== 'DELETE')
                  return;
                void run(async () => {
                  await accountMutation(fetch, '/api/user/account/delete', 'POST', {
                    confirmation: 'DELETE',
                  });
                  await clearPreviewSession();
                  router.replace('/');
                });
              }}
            >
              Delete Account
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
