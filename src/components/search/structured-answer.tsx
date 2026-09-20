'use client';
import type { ReactNode } from 'react';
import Image from 'next/image';
import type { AnswerBlock, SearchGame } from '@/features/search/answer-types';
import type { SearchResponse } from '@/features/search/types';
import { parseSearchAnswerCitations } from '@/features/search/citations';
import { TEAM_LIST } from '@/data/teams';
const safeHref = (url: string) =>
  /^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//')) ? url : '#';
const team = (id: string) => TEAM_LIST.find((t) => t.abbr === id);
function date(value: string, timeZone?: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone,
      }).format(d)
    : value;
}
export function AnswerText({ text, response }: { text: string; response: SearchResponse }) {
  return (
    <>
      {parseSearchAnswerCitations(text, response.sources.length).map((part, i) =>
        part.type === 'text' ? (
          part.value
        ) : (
          <a
            key={i}
            href={safeHref(response.sources[part.sourceIndex].url)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Source ${part.sourceIndex + 1}: ${response.sources[part.sourceIndex].title}`}
            className="mx-0.5 font-bold text-[var(--team-primary-text)] underline"
          >
            {part.value}
          </a>
        ),
      )}
    </>
  );
}
function Game({ game, timeZone }: { game: SearchGame; timeZone: string }) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide">
        {game.status === 'final'
          ? 'Final'
          : game.status === 'live'
            ? 'Live'
            : game.week
              ? `Week ${game.week}`
              : 'Upcoming game'}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {[game.away, game.home].map((abbr, i) => (
          <div className="flex min-w-0 items-center gap-2" key={abbr}>
            {i === 1 ? <span className="text-xs">at</span> : null}
            <Image
              unoptimized
              src={team(abbr)?.logoUrl ?? '/assets/nfl-logo.svg'}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <strong>{team(abbr)?.name ?? abbr}</strong>
          </div>
        ))}
      </div>
      <p className="mt-2">
        {game.timeTbd
          ? `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(new Date(game.startsAt))} · time TBD`
          : date(game.startsAt, timeZone)}
      </p>
      {game.venue ? <p>{game.venue}</p> : null}
      {game.network ? <p>TV: {game.network}</p> : null}
      <a
        href={safeHref(game.source.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs underline"
      >
        {game.source.provider} game details
      </a>
    </article>
  );
}
export function AnswerBlocks({ response }: { response: SearchResponse }) {
  return (
    <div className="mt-4 grid min-w-0 gap-4">
      {response.blocks?.map((block, i) => (
        <Block key={i} block={block} response={response} />
      ))}
    </div>
  );
}
function Block({ block, response }: { block: AnswerBlock; response: SearchResponse }): ReactNode {
  if (block.type === 'paragraph')
    return (
      <p>
        <AnswerText text={block.text} response={response} />
      </p>
    );
  if (block.type === 'bulletList')
    return (
      <section>
        <h3 className="font-bold">{block.title}</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          {block.items.map((s, i) => (
            <li key={i}>
              <AnswerText text={s} response={response} />
            </li>
          ))}
        </ul>
      </section>
    );
  if (block.type === 'gameCard') return <Game game={block.game} timeZone={block.timeZone} />;
  if (block.type === 'schedule')
    return (
      <section>
        <h3 className="mb-2 font-bold">Upcoming</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {block.games.map((g) => (
            <Game key={g.id} game={g} timeZone={block.timeZone} />
          ))}
        </div>
      </section>
    );
  if (block.type === 'oddsCard')
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-bold">
          {block.game.away} at {block.game.home}
        </h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {block.lines.map((l, i) => (
            <div key={i}>
              <dt className="text-xs font-bold uppercase">
                {l.market} · {l.selection}
              </dt>
              <dd>
                {l.line !== null ? (
                  <strong>
                    {l.market === 'SPREAD' && l.line > 0 ? '+' : ''}
                    {l.line}{' '}
                  </strong>
                ) : null}
                <span>
                  ({l.price > 0 ? '+' : ''}
                  {l.price})
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm">
          Source: {block.provider}
          <br />
          Last updated {date(block.updatedAt, block.timeZone)}
        </p>
      </section>
    );
  return (
    <section className="min-w-0">
      <h3 className="mb-2 font-bold">{block.title}</h3>
      <div
        className="max-h-96 overflow-auto rounded-xl border border-slate-200"
        tabIndex={0}
        aria-label={block.title}
      >
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              {block.columns.map((c) => (
                <th className="px-3 py-2" key={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr className="border-t border-slate-200" key={i}>
                {r.map((v, j) => (
                  <td className="px-3 py-2 align-top" key={j}>
                    <AnswerText text={v} response={response} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function AnswerSources({ response }: { response: SearchResponse }) {
  if (!response.sources.length) return null;
  return (
    <section className="mt-5" aria-label="Answer sources">
      <h3 className="font-bold">Sources</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {response.sources.map((s, i) => (
          <article key={s.id} className="min-w-0 rounded-lg border border-slate-200 p-3 text-sm">
            <a
              href={safeHref(s.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              [{i + 1}] {s.title}
            </a>
            <p className="text-xs text-slate-600">
              {s.provider}
              {s.publishedAt
                ? ` · ${date(s.publishedAt)}`
                : s.updatedAt
                  ? ` · Updated ${date(s.updatedAt)}`
                  : ''}
            </p>
            {s.related?.length ? (
              <details className="mt-2">
                <summary className="cursor-pointer">+{s.related.length} sources</summary>
                {s.related.map((r) => (
                  <a
                    key={r.url}
                    href={safeHref(r.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-2 underline"
                  >
                    {r.title}
                  </a>
                ))}
              </details>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
