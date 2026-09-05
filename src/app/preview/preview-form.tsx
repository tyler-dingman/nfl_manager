'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

export function PreviewForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const response = await fetch('/api/preview/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password, next: search?.get('next') ?? '/' }),
    });
    const body = await response.json().catch(() => null);
    if (response.ok) window.location.assign(body.redirectTo);
    else setError(body?.error ?? 'Incorrect password.');
    setLoading(false);
  }
  return (
    <form onSubmit={submit} className="mt-8 w-full min-w-0">
      <label
        htmlFor="preview-password"
        className="block text-left text-xs font-black uppercase tracking-[.18em] text-[#00172B]/70"
      >
        Password
      </label>
      <input
        id="preview-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 h-14 w-full min-w-0 rounded-xl border border-[#00172B]/20 bg-white px-4 text-base text-[#00172B] outline-none transition focus:border-[#FF3D38] focus:ring-2 focus:ring-[#FF3D38]/40"
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      <button
        disabled={loading}
        className="mt-5 h-14 w-full rounded-xl bg-[#FF3D38] font-black text-white transition hover:bg-[#e9322e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00172B] disabled:opacity-60"
      >
        {loading ? 'CHECKING…' : 'ENTER'}
      </button>
    </form>
  );
}
