'use client';

import Link from 'next/link';
import { LogIn, LogOut, Menu, Settings2, Shield, UserRound, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import UserAvatar from '@/components/auth/user-avatar';
import {
  getPrimaryNavActive,
  getPrimaryNavHref,
  PRIMARY_NAV_ITEMS,
  type PrimaryNavItemId,
} from '@/config/primary-navigation';
import { clearPreviewSession, useAuthUser } from '@/features/auth/auth-session';
import { useTeamStore } from '@/features/team/team-store';

export default function MobileSiteMenu({
  teamAbbr,
  active,
}: {
  teamAbbr?: string | null;
  active?: PrimaryNavItemId | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthUser();
  const team = useTeamStore((state) =>
    state.teams.find((candidate) => candidate.abbr === teamAbbr),
  );
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const activeItem = active === undefined ? getPrimaryNavActive(pathname) : active;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      );
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  const teamSuffix = teamAbbr ? `&team=${encodeURIComponent(teamAbbr)}` : '';
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-[var(--team-on-dark)] hover:bg-white/10 xl:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-site-menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[140] xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={close}
            aria-label="Close menu"
          />
          <div
            ref={drawerRef}
            id="mobile-site-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute bottom-0 right-0 top-0 flex w-[min(88vw,380px)] max-w-full flex-col overflow-y-auto overflow-x-hidden bg-[var(--dark)] px-5 py-5 text-[var(--team-on-dark)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-xs font-black uppercase tracking-[.22em] text-[var(--team-secondary-on-dark)]">
                Menu
              </span>
              <button
                type="button"
                onClick={close}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <section className="py-5">
              <h2 className="text-[10px] font-black uppercase tracking-[.24em] text-white/45">
                Main
              </h2>
              <nav aria-label="Mobile primary navigation" className="mt-2 grid">
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.id}
                    href={getPrimaryNavHref(item.href, teamAbbr)}
                    onClick={close}
                    aria-current={activeItem === item.id ? 'page' : undefined}
                    className={`border-b border-white/10 py-3.5 text-lg font-black ${activeItem === item.id ? 'text-[var(--team-secondary-on-dark)]' : 'text-[var(--team-on-dark)]'}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </section>
            <div className="mt-auto">
              <section className="border-t border-white/10 py-5">
                <h2 className="text-[10px] font-black uppercase tracking-[.24em] text-white/45">
                  Your team
                </h2>
                <div className="mt-3 flex items-center gap-3">
                  {team?.logo_url ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                      <img src={team.logo_url} alt="" className="h-9 w-9 object-contain" />
                    </span>
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                      <Shield className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-black">{team?.name ?? 'Select your team'}</p>
                    <Link
                      href={`/?team-select=1${teamSuffix}`}
                      onClick={close}
                      className="text-sm font-bold text-[var(--team-secondary-on-dark)]"
                    >
                      Change team
                    </Link>
                  </div>
                </div>
              </section>
              <section className="border-t border-white/10 py-5">
                <h2 className="text-[10px] font-black uppercase tracking-[.24em] text-white/45">
                  Account
                </h2>
                {user ? (
                  <>
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <UserAvatar
                        src={user.avatarUrl}
                        name={user.name}
                        size="md"
                        className="bg-white/10"
                      />
                      <p className="truncate font-black">{user.name}</p>
                    </div>
                    <div className="mt-3 grid gap-1">
                      <Link
                        href="/account"
                        onClick={close}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 font-bold hover:bg-white/10"
                      >
                        <UserRound className="h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        href="/account/preferences"
                        onClick={close}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 font-bold hover:bg-white/10"
                      >
                        <Settings2 className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          await clearPreviewSession();
                          close();
                          router.push('/');
                        }}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-left font-bold hover:bg-white/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={close}
                    className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3 font-bold hover:bg-white/10"
                  >
                    <LogIn className="h-4 w-4" />
                    Log in
                  </Link>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
