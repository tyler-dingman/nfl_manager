import { notFound } from 'next/navigation';

import { TEAM_LIST } from '@/data/teams';
import { FrontOfficeStoryGraphic } from '@/components/front-office/story-graphics/FrontOfficeStoryGraphic';
import type {
  FrontOfficeStoryGraphicModel,
  StoryGraphicTemplate,
} from '@/components/front-office/story-graphics/story-graphic-model';

const templates: Array<{ template: StoryGraphicTemplate; headline: string }> = [
  { template: 'trade', headline: 'Teams agree to a deal involving veteran starter' },
  { template: 'contract', headline: 'Club finalizes a multi-year contract extension' },
  { template: 'injury', headline: 'Starter receives an updated injury designation' },
  { template: 'signing', headline: 'Free agent agrees to terms with new team' },
  { template: 'release', headline: 'Veteran released in roster move' },
  { template: 'roster', headline: 'Depth chart shifts ahead of the next matchup' },
  { template: 'transaction', headline: 'League transaction changes the active roster' },
  { template: 'rumor', headline: 'Trade interest is building around the league' },
  { template: 'draft', headline: 'Draft board takes shape after fresh evaluations' },
  { template: 'game', headline: 'Division matchup delivers a late finish' },
  { template: 'analysis', headline: 'Film review reveals a changing offensive trend' },
  { template: 'other', headline: 'Latest development from around the league' },
];

export default function FrontOfficeStoryGraphicsPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  const bears = TEAM_LIST.find((team) => team.abbr === 'CHI')!;
  const packers = TEAM_LIST.find((team) => team.abbr === 'GB')!;
  const identity = (team: typeof bears) => ({
    id: team.id,
    displayName: team.name.toLowerCase().startsWith(team.city.toLowerCase())
      ? team.name
      : `${team.city} ${team.name}`,
    primary: team.colors[0],
    secondary: team.colors[1],
    logoUrl: team.logoUrl,
  });
  const story = (
    item: (typeof templates)[number],
    index: number,
  ): FrontOfficeStoryGraphicModel => ({
    id: `preview-${item.template}`,
    template: item.template,
    eyebrow: item.template.replace('-', ' '),
    headline: item.headline,
    summary: 'Preview copy demonstrates the approved visual system without representing live news.',
    primaryIdentity: identity(bears),
    secondaryIdentity: ['trade', 'game'].includes(item.template) ? identity(packers) : undefined,
    status: index === 0 ? 'BREAKING' : undefined,
    dateLabel: 'Preview',
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-black">Front Office story graphics</h1>
        <p className="mt-2 text-slate-600">Development-only hero and card template review.</p>
        <section className="mt-8 grid gap-6">
          {templates.slice(0, 3).map((item, index) => (
            <FrontOfficeStoryGraphic key={item.template} story={story(item, index)} size="hero" />
          ))}
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((item, index) => (
            <FrontOfficeStoryGraphic key={item.template} story={story(item, index)} size="card" />
          ))}
        </section>
      </div>
    </main>
  );
}
