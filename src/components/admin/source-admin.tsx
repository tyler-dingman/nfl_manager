'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Search } from 'lucide-react';

import type { SourceCategory, SourceDefinition } from '@/data/sources';

const categories: SourceCategory[] = [
  'OFFICIAL',
  'NATIONAL_INSIDER',
  'LOCAL_BEAT',
  'LOCAL_MEDIA',
  'CREATOR',
  'AGGREGATOR',
  'COMMUNITY',
  'DATA',
];

const blankSource = (): SourceDefinition => ({
  id: '',
  name: '',
  displayName: '',
  team: 'KC',
  category: 'LOCAL_MEDIA',
  trustScore: 75,
  breakingNewsScore: 70,
  analysisScore: 70,
  teamRelevanceScore: 100,
  platform: 'WEB',
  enabled: true,
  priority: 70,
});

export default function SourceAdmin() {
  const [sources, setSources] = useState<SourceDefinition[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<SourceDefinition>(blankSource);
  const [message, setMessage] = useState('');

  const load = async () => {
    const response = await fetch('/api/admin/sources');
    const payload = (await response.json()) as { sources: SourceDefinition[] };
    setSources(payload.sources);
  };
  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? sources.filter((source) =>
          `${source.displayName} ${source.id} ${source.team ?? 'NFL'} ${source.category}`
            .toLowerCase()
            .includes(needle),
        )
      : sources;
  }, [query, sources]);

  const patch = async (id: string, changes: Partial<SourceDefinition>) => {
    const response = await fetch('/api/admin/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, changes }),
    });
    if (response.ok) {
      const payload = (await response.json()) as { source: SourceDefinition };
      setSources((current) =>
        current.map((source) => (source.id === id ? payload.source : source)),
      );
      setMessage(`Saved ${payload.source.displayName}`);
    }
  };

  const addSource = async () => {
    const source = {
      ...draft,
      id: draft.id
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_'),
      name: draft.displayName,
    };
    const response = await fetch('/api/admin/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source),
    });
    if (response.ok) {
      setDraft(blankSource());
      setMessage(`Added ${source.displayName}`);
      await load();
    } else {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error ?? 'Unable to add source');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-slate-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F4D9B7]">
            Down & Distance · Internal
          </p>
          <h1 className="mt-2 text-4xl font-black">Source Engine</h1>
          <p className="mt-2 text-white/55">
            Manage trust, roles, priority, and team assignment. Runtime edits reset when the server
            restarts.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Plus className="h-5 w-5" /> Add source
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-6">
            <input
              value={draft.id}
              onChange={(event) => setDraft({ ...draft, id: event.target.value })}
              placeholder="SOURCE_ID"
              className="rounded-xl border p-3"
            />
            <input
              value={draft.displayName}
              onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
              placeholder="Display name"
              className="rounded-xl border p-3 md:col-span-2"
            />
            <input
              value={draft.team ?? ''}
              onChange={(event) => setDraft({ ...draft, team: event.target.value || null })}
              placeholder="Team (KC)"
              className="rounded-xl border p-3"
            />
            <select
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value as SourceCategory })
              }
              className="rounded-xl border p-3"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void addSource()}
              className="rounded-xl bg-slate-950 px-4 font-black text-white"
            >
              Add source
            </button>
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b p-5">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sources"
                className="h-11 flex-1 bg-transparent outline-none"
              />
            </div>
            <span className="text-sm font-bold text-slate-500">{visible.length} sources</span>
            {message ? <span className="text-sm font-bold text-emerald-700">{message}</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Source</th>
                  <th>Team</th>
                  <th>Category</th>
                  <th>Trust</th>
                  <th>Breaking</th>
                  <th>Analysis</th>
                  <th>Priority</th>
                  <th>Enabled</th>
                  <th className="pr-4">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((source) => (
                  <SourceRow key={source.id} source={source} onSave={patch} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function SourceRow({
  source,
  onSave,
}: {
  source: SourceDefinition;
  onSave: (id: string, changes: Partial<SourceDefinition>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(source);
  useEffect(() => setDraft(source), [source]);
  const number = (key: 'trustScore' | 'breakingNewsScore' | 'analysisScore' | 'priority') => (
    <input
      type="number"
      min="0"
      max="100"
      value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
      className="w-20 rounded-lg border p-2"
    />
  );
  return (
    <tr>
      <td className="p-4">
        <p className="font-black">{draft.displayName}</p>
        <p className="text-xs text-slate-400">{draft.id}</p>
      </td>
      <td>
        <input
          value={draft.team ?? ''}
          onChange={(event) => setDraft({ ...draft, team: event.target.value || null })}
          className="w-16 rounded-lg border p-2"
        />
      </td>
      <td>
        <select
          value={draft.category}
          onChange={(event) =>
            setDraft({ ...draft, category: event.target.value as SourceCategory })
          }
          className="rounded-lg border p-2"
        >
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </td>
      <td>{number('trustScore')}</td>
      <td>{number('breakingNewsScore')}</td>
      <td>{number('analysisScore')}</td>
      <td>{number('priority')}</td>
      <td>
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
        />
      </td>
      <td className="pr-4">
        <button
          type="button"
          onClick={() => void onSave(source.id, draft)}
          className="rounded-lg bg-slate-950 p-2 text-white"
          aria-label={`Save ${source.displayName}`}
        >
          <Save className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
