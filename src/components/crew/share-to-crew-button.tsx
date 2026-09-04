'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Search, Share2, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  allRecipientsSelected,
  crewShareCta,
  toggleAllRecipients,
  toggleRecipient,
  type CrewShareRecipient,
} from '@/features/crew/share-selection';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  count,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  count: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={`Everyone, all ${count} Crew members`}
      className="h-5 w-5 accent-[var(--team-primary-fill)]"
    />
  );
}

export default function ShareToCrewButton({
  contentId,
  contentType,
  href,
  title,
  className = '',
}: {
  contentId: string;
  contentType: 'BEAT_STORY' | 'FILM_ROOM' | 'GAME_DAY' | 'TRIVIA' | 'FRONT_OFFICE';
  href: string;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<CrewShareRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(''),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('');
  const recipientIds = useMemo(() => recipients.map(({ id }) => id), [recipients]);
  const everyone = allRecipientsSelected(recipientIds, selectedIds);
  const visible = query
    ? recipients.filter(({ displayName }) =>
        displayName.toLowerCase().includes(query.toLowerCase()),
      )
    : recipients;

  const showModal = async () => {
    setOpen(true);
    setStatus('');
    setQuery('');
    setLoading(true);
    console.info('crew_share_opened', { contentType });
    try {
      const response = await fetch('/api/crew/share', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load your Crew.');
      const next = (body.recipients ?? []) as CrewShareRecipient[];
      setRecipients(next);
      setSelectedIds(new Set(next.map(({ id }) => id)));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load your Crew.');
    } finally {
      setLoading(false);
    }
  };
  const submit = async () => {
    if (!selectedIds.size || sending) return;
    setSending(true);
    setStatus('');
    const response = await fetch('/api/crew/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contentId,
        contentType,
        href,
        title,
        message,
        recipientIds: [...selectedIds],
      }),
    });
    const body = await response.json().catch(() => null);
    if (response.ok) {
      setStatus(everyone ? 'Shared with the Crew.' : 'Shared with selected Crew members.');
      setTimeout(() => setOpen(false), 700);
    } else setStatus(body?.error ?? 'Unable to share.');
    setSending(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => void showModal()}
        className={
          className ||
          'inline-flex items-center gap-1.5 text-xs font-black text-[var(--team-primary-text)]'
        }
        aria-label="Share with the Crew"
      >
        <Share2 className="h-4 w-4" />
        Share with the Crew
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="crew-share-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 text-[#00172B] shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="crew-share-title" className="text-xl font-black uppercase">
                Share with the Crew
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100"
              >
                <X />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-100 p-4">
              <p className="text-xs font-black uppercase text-[var(--team-primary-text)]">
                {contentType.replace('_', ' ')}
              </p>
              <p className="mt-2 font-black">{title}</p>
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm font-bold text-slate-500">
                Loading your Crew…
              </p>
            ) : recipients.length ? (
              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">
                  Send to
                </p>
                {recipients.length > 8 ? (
                  <label className="mt-3 flex items-center gap-2 rounded-xl border px-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <span className="sr-only">Search Crew</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search Crew…"
                      className="h-10 min-w-0 flex-1 outline-none"
                    />
                  </label>
                ) : null}
                <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border">
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 border-b px-4 py-2">
                    <SelectAllCheckbox
                      checked={everyone}
                      indeterminate={selectedIds.size > 0 && !everyone}
                      count={recipients.length}
                      onChange={(checked) =>
                        setSelectedIds(toggleAllRecipients(recipientIds, checked))
                      }
                    />
                    <span>
                      <span className="block text-sm font-black">EVERYONE</span>
                      <span className="block text-xs text-slate-500">
                        All {recipients.length} Crew{' '}
                        {recipients.length === 1 ? 'member' : 'members'}
                      </span>
                    </span>
                  </label>
                  {visible.map((recipient) => (
                    <label
                      key={recipient.id}
                      className="flex min-h-14 cursor-pointer items-center gap-3 border-b px-4 py-2 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(recipient.id)}
                        onChange={() => setSelectedIds(toggleRecipient(selectedIds, recipient.id))}
                        className="h-5 w-5 accent-[var(--team-primary-fill)]"
                      />
                      {recipient.avatarUrl ? (
                        <Image
                          src={recipient.avatarUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-black"
                        >
                          {initials(recipient.displayName)}
                        </span>
                      )}
                      <span className="text-sm font-bold">{recipient.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : !status ? (
              <div className="py-8 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-3 font-black">YOUR CREW IS EMPTY</p>
                <p className="mt-1 text-sm text-slate-500">Invite some people before sharing.</p>
                <Link
                  href="/crew"
                  className="team-primary-filled mt-4 inline-flex rounded-xl px-5 py-3 text-sm font-black"
                >
                  Invite Friends
                </Link>
              </div>
            ) : null}
            {recipients.length ? (
              <>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 120))}
                  placeholder="Add a message (optional)…"
                  className="mt-4 h-24 w-full rounded-xl border p-3"
                />
                <p className="text-right text-xs text-slate-400">{message.length}/120</p>
                <button
                  onClick={() => void submit()}
                  disabled={!selectedIds.size || sending}
                  aria-label={`Send ${contentType.toLowerCase().replace('_', ' ')} to ${selectedIds.size} Crew ${selectedIds.size === 1 ? 'member' : 'members'}`}
                  className="team-primary-filled mt-4 w-full rounded-xl py-3 font-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? 'SENDING…' : crewShareCta(recipients, selectedIds)}
                </button>
                {!selectedIds.size ? (
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Select at least one person.
                  </p>
                ) : null}
              </>
            ) : null}
            {status ? (
              <p role="status" className="mt-3 text-center text-sm font-bold">
                {status}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
