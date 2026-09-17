'use client';

import Image from 'next/image';
import { ChevronDown, ChevronUp, GripVertical, Star, Trash2, X } from 'lucide-react';
import { DdSearchIcon as Search } from '@/components/ui/football-icons';
import { useEffect, useMemo, useState } from 'react';

import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { DraftProspectRecord } from '@/server/data/draft-prospects';
import { DRAFT_PROSPECTS_2027_META } from '@/server/data/draft-prospects';
import styles from './prospect-board.module.css';

type View = 'all' | 'board' | 'added' | 'favorites';
type Sort = 'rank' | 'grade' | 'position' | 'school' | 'my-rank';
const positionGroup = (position: string | null) => position?.toUpperCase() || 'OTHER';
const gradeScore = (grade: string | null) =>
  ({ 'A+': 12, A: 11, 'A-': 10, 'B+': 9, B: 8, 'B-': 7, 'C+': 6, C: 5 })[
    grade?.toUpperCase() as 'A+'
  ] ?? 0;

function ProspectImage({ prospect, size = 36 }: { prospect: DraftProspectRecord; size?: number }) {
  return prospect.headshotUrl ? (
    <Image src={prospect.headshotUrl} alt="" width={size} height={size} unoptimized />
  ) : (
    <span>
      {prospect.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')}
    </span>
  );
}

export function ProspectBoard({
  prospects,
  title = 'Big Board',
  showHeader = true,
}: {
  prospects: DraftProspectRecord[];
  title?: string;
  showHeader?: boolean;
}) {
  const saveId = useSaveStore((state) => state.saveId);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [school, setSchool] = useState('ALL');
  const [sort, setSort] = useState<Sort>('rank');
  const [view, setView] = useState<View>('all');
  const [board, setBoard] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showDrafted, setShowDrafted] = useState(false);
  const [active, setActive] = useState<DraftProspectRecord | null>(null);
  const [rankedProspects, setRankedProspects] = useState(prospects);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const draftYear = prospects.find((prospect) => prospect.draftYear)?.draftYear ?? 2027;
  const storageKey = `dd-draft-big-board:${saveId ?? 'default'}:${draftYear}`;
  const legacyStorageKey = `dd-draft-big-board:${saveId}`;
  const favoritesKey = `${storageKey}:favorites`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
      setBoard(stored ? JSON.parse(stored) : []);
      setFavorites(JSON.parse(localStorage.getItem(favoritesKey) || '[]'));
    } catch {
      setBoard([]);
      setFavorites([]);
    }
  }, [favoritesKey, legacyStorageKey, storageKey]);

  useEffect(() => {
    if (!saveId) {
      setRankedProspects(prospects);
      return;
    }
    let mounted = true;
    const load = async () => {
      try {
        const response = await apiFetch(
          `/api/front-office/draft-central?saveId=${encodeURIComponent(saveId)}`,
        );
        const payload = await response.json();
        if (response.ok && mounted && Array.isArray(payload.prospects))
          setRankedProspects(
            payload.prospects.map((item: DraftProspectRecord & { currentRank?: number }) => ({
              ...item,
              ranking: item.currentRank ?? item.ranking,
            })),
          );
      } catch {
        /* Keep source rankings. */
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    return () => {
      mounted = false;
      window.removeEventListener('front-office-simulation-advanced', load);
    };
  }, [prospects, saveId]);

  const persistBoard = (next: string[]) => {
    setBoard(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    localStorage.setItem(legacyStorageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('dd-big-board-updated', { detail: next }));
  };
  const persistFavorites = (next: string[]) => {
    setFavorites(next);
    localStorage.setItem(favoritesKey, JSON.stringify(next));
  };
  const toggleBoard = (id: string) =>
    persistBoard(board.includes(id) ? board.filter((entry) => entry !== id) : [...board, id]);
  const toggleFavorite = (id: string) =>
    persistFavorites(
      favorites.includes(id) ? favorites.filter((entry) => entry !== id) : [...favorites, id],
    );
  const move = (id: string, direction: -1 | 1) => {
    const index = board.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= board.length) return;
    const next = [...board];
    [next[index], next[target]] = [next[target], next[index]];
    persistBoard(next);
  };
  const reorder = (source: string, target: string) => {
    if (source === target) return;
    const next = board.filter((id) => id !== source);
    const index = next.indexOf(target);
    next.splice(index < 0 ? next.length : index, 0, source);
    persistBoard(next);
  };

  const positions = useMemo(
    () => [...new Set(rankedProspects.map((item) => positionGroup(item.position)))].sort(),
    [rankedProspects],
  );
  const schools = useMemo(
    () =>
      [
        ...new Set(
          rankedProspects
            .map((item) => item.school)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [rankedProspects],
  );
  const boardProspects = useMemo(
    () =>
      board
        .map((id) => rankedProspects.find((item) => item.id === id))
        .filter((item): item is DraftProspectRecord => Boolean(item)),
    [board, rankedProspects],
  );
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    const source =
      view === 'board' || view === 'added'
        ? boardProspects
        : view === 'favorites'
          ? rankedProspects.filter((item) => favorites.includes(item.id))
          : rankedProspects;
    return source
      .filter((item) => {
        const drafted = Boolean((item as DraftProspectRecord & { isDrafted?: boolean }).isDrafted);
        const haystack = `${item.name} ${item.school ?? ''} ${item.position ?? ''}`.toLowerCase();
        return (
          (showDrafted || !drafted) &&
          (!text || haystack.includes(text)) &&
          (position === 'ALL' || positionGroup(item.position) === position) &&
          (school === 'ALL' || item.school === school)
        );
      })
      .slice()
      .sort((a, b) =>
        sort === 'my-rank'
          ? board.indexOf(a.id) - board.indexOf(b.id)
          : sort === 'grade'
            ? gradeScore(b.grade) - gradeScore(a.grade)
            : sort === 'position'
              ? (a.position ?? '').localeCompare(b.position ?? '')
              : sort === 'school'
                ? (a.school ?? '').localeCompare(b.school ?? '')
                : (a.ranking ?? 999) - (b.ranking ?? 999),
      );
  }, [
    board,
    boardProspects,
    favorites,
    position,
    query,
    rankedProspects,
    school,
    showDrafted,
    sort,
    view,
  ]);

  return (
    <div className={styles.page}>
      {showHeader ? (
        <header>
          <p>{draftYear} NFL Draft</p>
          <h1>{title}</h1>
          <span>
            {rankedProspects.length} prospects · Updated{' '}
            {new Date(DRAFT_PROSPECTS_2027_META.sourceUpdatedAt).toLocaleDateString()}
          </span>
        </header>
      ) : null}
      <div className={styles.layout}>
        <section className={styles.databasePanel}>
          <div className={styles.viewTabs}>
            {(
              [
                ['all', 'All Prospects'],
                ['board', 'My Big Board'],
                ['added', `Added (${board.length})`],
                ['favorites', `Favorites (${favorites.length})`],
              ] as Array<[View, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
            <label className={styles.draftedToggle}>
              Show Drafted
              <input
                type="checkbox"
                checked={showDrafted}
                onChange={(event) => setShowDrafted(event.target.checked)}
              />
              <i />
            </label>
          </div>
          <div className={styles.filters}>
            <label>
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search players, school, or position"
              />
            </label>
            <select value={position} onChange={(event) => setPosition(event.target.value)}>
              <option value="ALL">All positions</option>
              {positions.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select value={school} onChange={(event) => setSchool(event.target.value)}>
              <option value="ALL">All schools</option>
              {schools.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <span>Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="rank">Consensus Rank</option>
              <option value="grade">D&amp;D Grade</option>
              <option value="position">Position</option>
              <option value="school">School</option>
              <option value="my-rank">My Ranking</option>
            </select>
          </div>
          <div className={styles.tableHeader}>
            <span>Rank</span>
            <span>Player</span>
            <span>Pos</span>
            <span>School</span>
            <span>Height / Weight</span>
            <span>D&amp;D Grade</span>
            <span>Actions</span>
          </div>
          <div className={styles.prospectList}>
            {visible.map((item) => {
              const added = board.includes(item.id);
              const drafted = Boolean(
                (item as DraftProspectRecord & { isDrafted?: boolean }).isDrafted,
              );
              return (
                <div key={item.id} className={drafted ? styles.draftedRow : styles.prospectRow}>
                  <strong>{item.ranking ?? '—'}</strong>
                  <button
                    type="button"
                    className={styles.playerCell}
                    onClick={() => setActive(item)}
                  >
                    <span>
                      <ProspectImage prospect={item} />
                    </span>
                    <b>{item.name}</b>
                  </button>
                  <span>{item.position ?? '—'}</span>
                  <span className={styles.schoolCell}>
                    {item.schoolLogo ? (
                      <Image src={item.schoolLogo} alt="" width={24} height={24} unoptimized />
                    ) : null}
                    {item.school ?? '—'}
                  </span>
                  <span>
                    {item.height ?? ''}
                    {item.weight ? <small>{item.weight} lbs</small> : null}
                  </span>
                  <b className={styles.grade} data-grade={item.grade?.charAt(0) ?? ''}>
                    {item.grade ?? '—'}
                  </b>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={favorites.includes(item.id) ? styles.favorite : undefined}
                      onClick={() => toggleFavorite(item.id)}
                      aria-label={`${favorites.includes(item.id) ? 'Remove' : 'Add'} ${item.name} favorite`}
                    >
                      <Star />
                    </button>
                    <button
                      type="button"
                      disabled={drafted}
                      className={added ? styles.addedButton : styles.addButton}
                      onClick={() => toggleBoard(item.id)}
                    >
                      {added ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                </div>
              );
            })}
            {!visible.length ? (
              <div className={styles.empty}>
                <strong>No prospects match these filters.</strong>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setPosition('ALL');
                    setSchool('ALL');
                    setView('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </section>
        <aside className={styles.boardPanel}>
          <header>
            <h2>My Big Board ({board.length})</h2>
            <button
              type="button"
              disabled={!board.length}
              onClick={() =>
                board.length &&
                window.confirm(
                  `Clear your Big Board? This will remove all ${board.length} players from your board.`,
                ) &&
                persistBoard([])
              }
            >
              <Trash2 /> Clear all
            </button>
          </header>
          {boardProspects.length ? (
            <div className={styles.boardList}>
              {boardProspects.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggedId && reorder(draggedId, item.id)}
                  className={draggedId === item.id ? styles.dragging : undefined}
                >
                  <GripVertical />
                  <strong>{index + 1}</strong>
                  <span className={styles.boardPlayer}>
                    <i>
                      <ProspectImage prospect={item} size={32} />
                    </i>
                    <b>{item.name}</b>
                  </span>
                  <small>{item.position}</small>
                  <span className={styles.moveButtons}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(item.id, -1)}
                      aria-label={`Move ${item.name} up`}
                    >
                      <ChevronUp />
                    </button>
                    <button
                      type="button"
                      disabled={index === boardProspects.length - 1}
                      onClick={() => move(item.id, 1)}
                      aria-label={`Move ${item.name} down`}
                    >
                      <ChevronDown />
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleBoard(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.boardEmpty}>
              <strong>Build your board</strong>
              <p>Add prospects from the list to create your personal draft rankings.</p>
            </div>
          )}
          <div className={styles.reorderHelp}>
            <GripVertical /> Drag and drop to change your rankings.
          </div>
        </aside>
      </div>
      {active ? (
        <div
          className={styles.modalLayer}
          onMouseDown={(event) => event.target === event.currentTarget && setActive(null)}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="prospect-name">
            <button type="button" onClick={() => setActive(null)} aria-label="Close">
              <X />
            </button>
            <p>Rank #{active.ranking}</p>
            <h2 id="prospect-name">{active.name}</h2>
            <span>
              {active.position} · {active.school}
            </span>
            <dl>
              <div>
                <dt>Grade</dt>
                <dd>{active.grade ?? '—'}</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>{active.projectedRange ?? '—'}</dd>
              </div>
              <div>
                <dt>Height</dt>
                <dd>{active.height ?? '—'}</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{active.weight ? `${active.weight} lbs` : '—'}</dd>
              </div>
            </dl>
            {active.summary ? <p>{active.summary}</p> : null}
            <button type="button" onClick={() => toggleBoard(active.id)}>
              {board.includes(active.id) ? 'Remove from My Big Board' : 'Add to My Big Board'}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
