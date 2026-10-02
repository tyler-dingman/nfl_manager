'use client';
import { useState } from 'react';
import { WeeklyHeroStory } from '@/components/front-office/weekly-hero-story';
import { frontOfficeHeroAssets } from '../../../packages/front-office/hero-assets';
import type { HeroStory } from '../../../packages/front-office/hero-story';
import { gameDayHeroAsset } from '@/config/game-day-hero';
const types: HeroStory['visualType'][] = [
  'stadium',
  'coach',
  'player',
  'trade-player',
  'prospect',
  'locker-room',
  'training-room',
  'trade-deadline',
  'draft',
  'combine',
  'weight-room',
  'cafeteria',
];
export default function Preview() {
  const [type, setType] = useState<HeroStory['visualType']>('stadium'),
    [team, setTeam] = useState('KC');
  const person = ['coach', 'player', 'trade-player', 'prospect'].includes(type);
  const story: HeroStory = {
    season: 2026,
    week: 1,
    templateId: 'visual-fixture',
    category: 'preview',
    visualType: type,
    image:
      type === 'stadium'
        ? gameDayHeroAsset(team)
        : person
          ? '/assets/draft/headshots/2027/arch-manning.png'
          : frontOfficeHeroAssets[type as keyof typeof frontOfficeHeroAssets].src,
    headline:
      type === 'stadium'
        ? 'THE WAIT IS OVER'
        : person
          ? 'CLIMBING DRAFT BOARDS'
          : 'THE PLAYERS HAVE SPOKEN',
    body:
      type === 'coach'
        ? "“We've worked hard all offseason. We're ready to hit somebody other than ourselves.”"
        : 'A new chapter begins. Your team is preparing for the next challenge as the front office looks ahead.',
    cta: 'VIEW WEEK 1',
    href: '/front-office/league/schedule',
    simulatedDialogue: type === 'coach',
  };
  return (
    <main
      className="front-office-app"
      style={{ padding: 20, color: 'white', background: '#06141d', minHeight: '100vh' }}
    >
      <p>
        Isolated visual fixture — person variants use a prospect cutout as a presentation stand-in.
      </p>
      <label>
        Visual type{' '}
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        {' '}
        Team{' '}
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option>KC</option>
          <option>PHI</option>
        </select>
      </label>
      <div
        style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(6,minmax(0,1fr))',
          gridAutoRows: 'minmax(300px,auto)',
          maxWidth: 1100,
        }}
      >
        <WeeklyHeroStory key={type + team} story={story} team={team} />
      </div>
    </main>
  );
}
