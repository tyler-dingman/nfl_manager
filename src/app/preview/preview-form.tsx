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
    <form onSubmit={submit} className="mt-8">
      <label
        htmlFor="preview-password"
        className="block text-left text-xs font-black uppercase tracking-[.18em] text-white/70"
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
        className="mt-2 h-13 w-full rounded-xl border border-white/20 bg-white px-4 text-[#00172B] outline-none focus:ring-2 focus:ring-[#FF3D38]"
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm font-bold text-[#FF827E]">
          {error}
        </p>
      ) : null}
      <button
        disabled={loading}
        className="mt-5 h-13 w-full rounded-xl bg-[#FF3D38] font-black text-white transition hover:bg-[#e9322e] disabled:opacity-60"
      >
        {loading ? 'CHECKING…' : 'ENTER'}
      </button>
    </form>
  );
}
