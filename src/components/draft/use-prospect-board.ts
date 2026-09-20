'use client';
import { useEffect, useState } from 'react';
import { useSaveStore } from '@/features/save/save-store';

/** Mirrors the existing Big Board storage and change event; no separate watchlist. */
export function useProspectBoard(year = 2027) {
  const saveId = useSaveStore((s) => s.saveId);
  const key = `dd-draft-big-board:${saveId ?? 'default'}:${year}`;
  const legacy = `dd-draft-big-board:${saveId}`;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => {
      try {
        setIds(JSON.parse(localStorage.getItem(key) ?? localStorage.getItem(legacy) ?? '[]'));
      } catch {
        setIds([]);
      }
    };
    sync();
    window.addEventListener('dd-big-board-updated', sync);
    return () => window.removeEventListener('dd-big-board-updated', sync);
  }, [key, legacy]);
  const toggle = (id: string) => {
    let current: string[] = [];
    try {
      current = JSON.parse(localStorage.getItem(key) ?? localStorage.getItem(legacy) ?? '[]');
    } catch {}
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    localStorage.setItem(key, JSON.stringify(next));
    localStorage.setItem(legacy, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('dd-big-board-updated', { detail: next }));
  };
  return { ids, toggle };
}
