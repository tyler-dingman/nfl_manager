import Link from 'next/link';
import { ArrowLeft, CalendarDays, Globe2, Layers3, MapPin, PackageOpen, Radio } from 'lucide-react';

import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import LoginButton from '@/components/auth/login-button';
import TeamThemeProvider from '@/components/team-theme-provider';
import { PROMO_CONCEPTS } from '@/features/promos/concepts';
import PromoConceptCard from './promo-concept-card';

const disclaimer =
  'Conceptual partnership mockups for demonstration purposes only. Down & Distance is not affiliated with, endorsed by, or sponsored by the brands shown unless otherwise stated. Brand names and logos are the property of their respective owners.';

export default function PromosPage() {
  const scaleItems = [
    { icon: Globe2, label: 'National', copy: 'One partner across all 32 team experiences.' },
    { icon: MapPin, label: 'Regional', copy: 'Individual partners matched to team markets.' },
    {
      icon: CalendarDays,
      label: 'Season-long',
      copy: 'A recurring property fans learn to expect.',
    },
    { icon: Radio, label: 'Game day', copy: 'Weekly activations around the moments that matter.' },
    {
      icon: PackageOpen,
      label: 'Full package',
      copy: 'Content, social, audio, video, and merchandise.',
    },
  ];
  return (
    <TeamThemeProvider>
      <div className="min-h-screen bg-[#F3EBDD] text-[#00172B]">
        <header className="border-b border-white/10 bg-[#00172B] text-white">
          <div className="mx-auto flex h-24 max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <FiveWideLogo
              generic
              size={62}
              containerClassName="h-auto w-32 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:w-40"
              priority
            />
            <div className="ml-auto flex items-center gap-2">
              <LoginButton />
              <span className="hidden rounded-full border border-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/55 sm:inline-flex">
                Internal concept deck
              </span>
            </div>
          </div>
        </header>
        <main>
          <section className="relative overflow-hidden bg-[#00172B] text-white">
            <div className="absolute -right-32 top-0 h-[500px] w-[500px] rounded-full border-[100px] border-[#FF3D38]/10" />
            <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[#FF3D38]">
                Down &amp; Distance
              </p>
              <h1 className="mt-5 max-w-5xl text-5xl font-black uppercase leading-[0.88] tracking-[-0.055em] sm:text-7xl lg:text-8xl">
                Partnership concepts
              </h1>
              <p className="mt-8 max-w-3xl text-2xl font-bold leading-tight text-[#F4D9B7] sm:text-3xl">
                Brands shouldn’t interrupt football. They should become part of it.
              </p>
              <p className="mt-8 max-w-4xl border-l border-white/20 pl-4 text-xs leading-5 text-white/40">
                {disclaimer}
              </p>
            </div>
          </section>
          <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF3D38]">
                The philosophy
              </p>
              <div>
                <h2 className="text-3xl font-black leading-tight sm:text-5xl">
                  Own a ritual. Add value. Earn attention.
                </h2>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                  These are repeatable football properties—not banner placements. Each one gives a
                  partner a natural role inside something fans already want to know, watch, debate,
                  or share.
                </p>
              </div>
            </div>
            <div className="mt-16 space-y-10">
              {PROMO_CONCEPTS.map((concept, index) => (
                <PromoConceptCard key={concept.id} concept={concept} number={index + 1} />
              ))}
            </div>
          </section>
          <section className="bg-[#FF3D38] px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1200px]">
              <p className="text-xs font-black uppercase tracking-[0.22em]">The model</p>
              <blockquote className="mt-5 max-w-5xl text-4xl font-black leading-[0.95] tracking-[-0.04em] sm:text-6xl">
                “Don’t sell an ad. Sell a piece of the football experience.”
              </blockquote>
            </div>
          </section>
          <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Layers3 className="h-6 w-6 text-[#FF3D38]" />
              <h2 className="text-3xl font-black uppercase">How it scales</h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {scaleItems.map((item) => (
                <article
                  key={item.label}
                  className="rounded-2xl border border-[#00172B]/10 bg-white p-5"
                >
                  <item.icon className="h-6 w-6 text-[#FF3D38]" />
                  <h3 className="mt-6 font-black">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.copy}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
        <footer className="bg-[#00172B] px-4 py-12 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1200px]">
            <p className="max-w-4xl text-xs leading-5 text-white/45">{disclaimer}</p>
            <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm font-bold text-white/60 sm:flex-row sm:items-center sm:justify-between">
              <span>Down &amp; Distance · Partnership Concepts</span>
              <span>Confidential demonstration · 2026</span>
            </div>
          </div>
        </footer>
      </div>
    </TeamThemeProvider>
  );
}
