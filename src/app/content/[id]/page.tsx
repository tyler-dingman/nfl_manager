import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Bookmark, ExternalLink, Share2 } from 'lucide-react';
import { notFound } from 'next/navigation';

import ContentPageAnalytics from '@/components/content/content-page-analytics';
import ShareToCrewButton from '@/components/crew/share-to-crew-button';
import EditorialVisual from '@/components/editorial/editorial-visual';
import { FanPulse } from '@/components/fan-pulse/fan-pulse';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { TEAM_LIST } from '@/data/teams';
import { CONTENT_TYPE_CONFIG, contentKind } from '@/features/content/content-type-config';
import { normalizeDisplayHeadline } from '@/lib/display-headline';
import type { Team } from '@/features/team/team-store';
import { getContentDetail, getRelatedContent } from '@/server/content/content-detail';
import { canonicalThreeAndOut } from '@/server/content/canonical-surfaces';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.downdistance.com';
const canonicalUrl = (id: string) => `${siteUrl}/content/${encodeURIComponent(id)}`;
const asTeam = (abbr: string): Team | undefined => {
  const item = TEAM_LIST.find((team) => team.abbr === abbr);
  return item
    ? {
        id: item.id,
        name: item.name,
        city: item.city,
        abbr: item.abbr,
        logo_url: item.logoUrl,
        color_primary: item.colors[0],
        color_secondary: item.colors[1],
        teamOverview: 75,
        offenseOverview: 75,
        defenseOverview: 75,
        specialTeamsOverview: 75,
        teamOverviewGrade: 'B-',
        teamNeeds: [],
      }
    : undefined;
};
const youtubeEmbed = (url: string) => {
  try {
    const parsed = new URL(url);
    const id = parsed.hostname.includes('youtu.be')
      ? parsed.pathname.slice(1)
      : parsed.searchParams.get('v');
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const item = await getContentDetail(decodeURIComponent(params.id));
  if (!item)
    return {
      title: 'Content not found | Down & Distance',
      robots: { index: false, follow: false },
    };
  const url = canonicalUrl(item.id);
  return {
    title: `${item.headline} | Down & Distance`,
    description: item.summary,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: item.headline,
      description: item.summary,
      url,
      images: item.imageUrl ? [{ url: item.imageUrl }] : undefined,
      publishedTime: item.sources[0]?.publishedAt,
      modifiedTime: item.updatedAt,
      section: item.category,
      tags: [item.teamAbbr, item.category],
    },
    twitter: {
      card: item.imageUrl ? 'summary_large_image' : 'summary',
      title: item.headline,
      description: item.summary,
      images: item.imageUrl ? [item.imageUrl] : undefined,
    },
  };
}

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const item = await getContentDetail(decodeURIComponent(params.id));
  if (!item) notFound();
  const team = asTeam(item.teamAbbr);
  const kind = contentKind(item);
  const config = CONTENT_TYPE_CONFIG[kind];
  const related = await getRelatedContent(item);
  const threeAndOut = await canonicalThreeAndOut(item.teamAbbr).catch(() => null);
  const displayHeadline = normalizeDisplayHeadline(item.headline);
  const videoUrl = item.sources.map((source) => youtubeEmbed(source.url)).find(Boolean);
  const url = canonicalUrl(item.id);
  const publishedAt = item.sources.map((source) => source.publishedAt).sort()[0] ?? item.updatedAt;
  const structured =
    config.schema === 'VideoObject'
      ? {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: item.headline,
          description: item.summary,
          uploadDate: publishedAt,
          embedUrl: videoUrl,
          publisher: { '@type': 'Organization', name: 'Down & Distance' },
        }
      : {
          '@context': 'https://schema.org',
          '@type': config.schema,
          headline: item.headline,
          description: item.summary,
          datePublished: publishedAt,
          dateModified: item.updatedAt,
          articleSection: item.category,
          publisher: { '@type': 'Organization', name: 'Down & Distance' },
          mainEntityOfPage: url,
        };

  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
        <ContentPageAnalytics
          contentId={item.id}
          team={item.teamAbbr}
          contentType={kind}
          publishedAt={publishedAt}
          sourceCategory={item.sources[0]?.kind ?? 'unknown'}
        />
        <MainSiteHeader teamAbbr={item.teamAbbr} active="huddle" />
        <main>
          <article>
            <header className="relative isolate min-h-[360px] overflow-hidden bg-[var(--dark)] text-white sm:min-h-[400px]">
              <div className="absolute inset-0" aria-hidden="true">
                <EditorialVisual
                  story={{
                    teamId: item.teamAbbr,
                    category: item.category,
                    headline: item.headline,
                    summary: item.summary,
                  }}
                  variant="hero"
                  decorative
                  backgroundOnly
                  className="h-full min-h-full opacity-80"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/15" />
              <div className="relative z-10 mx-auto flex min-h-[360px] max-w-[1240px] items-center px-4 py-10 sm:min-h-[400px] sm:px-6 lg:px-8">
                <div className="max-w-3xl">
                  <p className="border-l-4 border-[var(--primary)] pl-3 text-xs font-black uppercase tracking-[.2em] text-white">
                    The Huddle
                  </p>
                  <p className="mt-5 text-xs font-black uppercase tracking-[.22em] text-[var(--team-secondary-on-dark)]">
                    {config.label} · {item.teamAbbr}
                  </p>
                  <h1 className="mt-3 text-4xl font-black leading-[.98] tracking-[-.015em] text-white sm:text-6xl lg:max-w-[900px]">
                    {displayHeadline}
                  </h1>
                  <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-white/75">
                    {item.category}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-white/80">
                    <time dateTime={publishedAt}>
                      Published {new Date(publishedAt).toLocaleString()}
                    </time>
                    <span aria-hidden="true">·</span>
                    <time dateTime={item.updatedAt}>
                      Updated {new Date(item.updatedAt).toLocaleString()}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>
                      {item.sourceCount} {item.sourceCount === 1 ? 'source' : 'sources'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/the-beat?team=${item.teamAbbr}`}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--team-primary-text)]"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to The Beat
                </Link>
                <nav aria-label="Share this story" className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </a>
                  <ShareToCrewButton
                    contentId={item.id}
                    contentType="BEAT_STORY"
                    href={`/content/${encodeURIComponent(item.id)}`}
                    title={displayHeadline}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm"
                  />
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm"
                  >
                    <Bookmark className="h-4 w-4" /> Save
                  </button>
                </nav>
              </div>
              <div className="grid gap-7 lg:grid-cols-[minmax(0,2.2fr)_minmax(280px,1fr)]">
                <div className="min-w-0 rounded-3xl bg-white px-5 py-7 shadow-sm sm:px-9 sm:py-10">
                  <section>
                    <h2 className="text-xs font-black uppercase tracking-[.22em] text-[var(--team-primary-text)]">
                      The short version
                    </h2>
                    <p className="mt-3 text-xl leading-8 text-slate-700">{item.summary}</p>
                  </section>
                  {videoUrl ? (
                    <section className="mt-8">
                      <h2 className="sr-only">Video</h2>
                      <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                        <iframe
                          src={videoUrl}
                          title={displayHeadline}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                    </section>
                  ) : null}
                  {item.whyItMatters ? (
                    <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h2 className="text-lg font-black">Why it matters</h2>
                      <p className="mt-2 leading-7 text-slate-600">{item.whyItMatters}</p>
                    </section>
                  ) : null}
                  <section className="mt-10">
                    <h2 className="text-xs font-black uppercase tracking-[.22em] text-slate-500">
                      Sources and attribution
                    </h2>
                    <div className="mt-3 divide-y border-y">
                      {item.sources.map((source) => (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-16 items-center justify-between gap-4 py-4 font-bold hover:underline"
                        >
                          <span>
                            <span className="block text-xs uppercase tracking-wider text-[var(--team-primary-text)]">
                              {source.publisher} · {source.kind}
                            </span>
                            <span className="mt-1 block">{source.title}</span>
                          </span>
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </section>
                  <FanPulse
                    contentId={item.id}
                    teamId={item.teamAbbr}
                    teamName={team?.name ?? item.teamAbbr}
                  />
                  {related.length ? (
                    <section className="mt-10">
                      <h2 className="text-2xl font-black">
                        More from {team?.name ?? item.teamAbbr}
                      </h2>
                      <nav className="mt-4 divide-y border-y" aria-label="Related content">
                        {related.map((story) => (
                          <Link
                            key={story.id}
                            href={`/content/${encodeURIComponent(story.id)}`}
                            className="flex min-h-20 items-center justify-between gap-4 py-4 font-bold hover:text-[var(--team-primary-text)]"
                          >
                            <span>{story.headline}</span>
                            <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                          </Link>
                        ))}
                      </nav>
                    </section>
                  ) : null}
                </div>
                <aside className="space-y-5" aria-label="Related content and advertisement">
                  <section
                    className="overflow-hidden rounded-2xl bg-white shadow-sm"
                    aria-label="Advertisement"
                  >
                    <Image
                      src="/images/ads/fanduel_ad.png.jpg"
                      alt="FanDuel advertisement"
                      width={335}
                      height={188}
                      className="h-auto w-full"
                    />
                  </section>
                  {related.length ? (
                    <section className="rounded-2xl bg-white p-5 shadow-sm">
                      <h2 className="text-xs font-black uppercase tracking-[.2em]">
                        Related Stories
                      </h2>
                      <div className="mt-3 divide-y">
                        {related.slice(0, 3).map((story) => (
                          <Link
                            key={story.id}
                            href={`/content/${encodeURIComponent(story.id)}`}
                            className="grid min-h-24 grid-cols-[72px_1fr] gap-3 py-3"
                          >
                            <div className="overflow-hidden rounded-lg bg-slate-100">
                              {story.imageUrl ? (
                                <Image
                                  src={story.imageUrl}
                                  alt=""
                                  width={96}
                                  height={72}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <span>
                              <span className="block text-[10px] font-black uppercase tracking-[.16em] text-[var(--team-primary-text)]">
                                {story.category}
                              </span>
                              <span className="mt-1 block text-sm font-black leading-tight">
                                {normalizeDisplayHeadline(story.headline)}
                              </span>
                              <time
                                className="mt-1 block text-xs text-slate-500"
                                dateTime={story.updatedAt}
                              >
                                {new Date(story.updatedAt).toLocaleDateString()}
                              </time>
                            </span>
                          </Link>
                        ))}
                      </div>
                      <Link
                        href={`/the-beat?team=${item.teamAbbr}`}
                        className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--team-primary-text)]"
                      >
                        View more in The Beat <ArrowRight className="h-4 w-4" />
                      </Link>
                    </section>
                  ) : null}
                  {threeAndOut?.current.stories.length === 3 ? (
                    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
                      <div className="bg-[#001b31] px-5 py-4 text-white">
                        <h2 className="dd-three-out-display text-3xl">
                          THREE <span className="dd-three-out-ampersand">&amp;</span> OUT
                        </h2>
                        <p className="mt-2 text-[9px] font-black uppercase tracking-[.2em]">
                          The 3 things you need to know
                        </p>
                      </div>
                      <ol className="space-y-3 p-5">
                        {threeAndOut.current.stories.map((story, index) => (
                          <li
                            key={story.id}
                            className="grid grid-cols-[28px_1fr] gap-3 text-sm font-bold"
                          >
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--primary)] text-xs text-[var(--team-primary-foreground)]">
                              {index + 1}
                            </span>
                            {normalizeDisplayHeadline(story.title)}
                          </li>
                        ))}
                      </ol>
                      <Link
                        href={`/three-and-out?team=${item.teamAbbr}`}
                        className="mx-5 mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--team-primary-text)]"
                      >
                        View Today&apos;s Three &amp; Out <ArrowRight className="h-4 w-4" />
                      </Link>
                    </section>
                  ) : null}
                </aside>
              </div>
            </div>
          </article>
        </main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }}
        />
      </div>
    </TeamThemeProvider>
  );
}
