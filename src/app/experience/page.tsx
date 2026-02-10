'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { AdSlot } from '@/components/ads/AdSlot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSaveStore } from '@/features/save/save-store';

type ExperienceMode = 'full' | 'freeAgency' | 'draft';

const EXPERIENCE_OPTIONS: Array<{
  key: ExperienceMode;
  title: string;
  description: string;
  isDefault?: boolean;
}> = [
  {
    key: 'full',
    title: 'Full Experience',
    description: 'Make tough decisions around your team to set it up for success.',
    isDefault: true,
  },
  {
    key: 'freeAgency',
    title: 'Free Agency',
    description: 'Sign free agents to improve your team.',
  },
  {
    key: 'draft',
    title: 'Draft',
    description: 'Draft the future of your team.',
  },
];

export default function ExperiencePage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const phase = useSaveStore((state) => state.phase);
  const setPhase = useSaveStore((state) => state.setPhase);

  const defaultMode = useMemo(() => 'full' as const, []);
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>(defaultMode);

  useEffect(() => {
    if (!saveId) {
      router.replace('/');
    }
  }, [router, saveId]);

  if (!saveId) {
    return null;
  }

  const handleContinue = async () => {
    if (selectedMode === 'full') {
      if (phase !== 'resign_cut') {
        await setPhase('resign_cut');
      }
      router.push('/roster');
      return;
    }

    if (selectedMode === 'freeAgency') {
      if (phase !== 'free_agency') {
        await setPhase('free_agency');
      }
      router.push('/free-agents');
      return;
    }

    if (phase !== 'draft') {
      await setPhase('draft');
    }
    router.push('/draft/room?mode=mock');
  };

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex w-full flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              Experience
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">Choose your experience</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {EXPERIENCE_OPTIONS.map((option) => {
              const isSelected = selectedMode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`group flex h-full flex-col gap-3 rounded-2xl border bg-white p-4 text-left transition ${
                    isSelected
                      ? 'border-slate-900/30 ring-2 ring-slate-900/10'
                      : 'border-border hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedMode(option.key)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{option.title}</p>
                    {option.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>

        <div className="hidden w-full lg:block">
          <AdSlot placement="RIGHT_RAIL" sticky={false} />
        </div>
      </div>

      <AdSlot placement="ANCHOR" responsive={{ hideOnDesktop: true }} />
    </AppShell>
  );
}
