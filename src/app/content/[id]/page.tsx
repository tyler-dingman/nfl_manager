import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ExternalLink, Share2 } from 'lucide-react';
import { notFound } from 'next/navigation';

import { AdSlot } from '@/components/ads/AdSlot';
import ContentPageAnalytics from '@/components/content/content-page-analytics';
import ShareToCrewButton from '@/components/crew/share-to-crew-button';
import EditorialVisual from '@/components/editorial/editorial-visual';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { TEAM_LIST } from '@/data/teams';
import { CONTENT_TYPE_CONFIG, contentKind } from '@/features/content/content-type-config';
import type { Team } from '@/features/team/team-store';
import { getContentDetail, getRelatedContent } from '@/server/content/content-detail';

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
            <header className="relative overflow-hidden bg-[var(--dark)] text-[var(--team-on-dark)]">
              <EditorialVisual
                story={{
                  teamId: item.teamAbbr,
                  category: item.category,
                  headline: item.headline,
                  summary: item.summary,
                }}
                variant="hero"
                decorative
              />
              <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
                <Link
                  href={`/the-beat?team=${item.teamAbbr}`}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to The Beat
                </Link>
              </div>
            </header>

            <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 lg:px-8">
              <AdSlot placement="HEADER" />
            </div>

            <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,820px)_280px] lg:px-8">
              <div className="min-w-0 rounded-3xl bg-white px-5 py-7 shadow-sm sm:px-9 sm:py-10">
                <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--team-primary-text)]">
                  {config.label} · {item.teamAbbr}
                </p>
                <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-.035em] sm:text-5xl">
                  {item.headline}
                </h1>
                <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
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
                <nav
                  aria-label="Share this story"
                  className="mt-6 flex flex-wrap items-center gap-3 border-y border-slate-200 py-4"
                >
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </a>
                  <ShareToCrewButton
                    contentId={item.id}
                    contentType="BEAT_STORY"
                    href={`/content/${encodeURIComponent(item.id)}`}
                    title={item.headline}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold"
                  />
                </nav>
                <section className="mt-8">
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
                        title={item.headline}
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
                {related.length ? (
                  <section className="mt-10">
                    <h2 className="text-2xl font-black">More from {team?.name ?? item.teamAbbr}</h2>
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
              <aside className="hidden lg:block" aria-label="Advertisement">
                <AdSlot placement="RIGHT_RAIL" />
              </aside>
            </div>
          </article>
        </main>
        <footer className="border-t bg-white px-4 py-8 text-center text-sm text-slate-500">
          Down &amp; Distance curates reporting with clear attribution to original sources.
        </footer>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }}
        />
      </div>
    </TeamThemeProvider>
  );
}
