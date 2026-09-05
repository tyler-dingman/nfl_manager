import { Suspense } from 'react';

import { FiveWideLogo } from '@/components/branding/fivewide-logo';

import { PreviewForm } from './preview-form';

export default function PreviewPage() {
  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden bg-[#00172B] px-4 py-10 text-[#00172B] sm:px-6 sm:py-12">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#f7f4ee] p-6 text-center shadow-2xl sm:p-10">
        <FiveWideLogo
          size={62}
          generic
          imageClassName="max-h-24"
          containerClassName="mx-auto h-24 w-48 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:h-28 sm:w-56"
          priority
        />
        <h1 className="mt-7 text-3xl font-black tracking-tight">DOWN &amp; DISTANCE</h1>
        <p className="mt-2 text-xs font-black uppercase tracking-[.28em] text-[#d71935]">
          Private Preview
        </p>
        <p className="mt-4 text-sm leading-6 text-[#00172B]/70">
          This site is currently in private development.
        </p>
        <Suspense>
          <PreviewForm />
        </Suspense>
      </section>
    </main>
  );
}
