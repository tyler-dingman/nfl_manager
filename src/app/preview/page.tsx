import { Suspense } from 'react';
import { PreviewForm } from './preview-form';

export default function PreviewPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#00172B] px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#071f34] p-8 text-center shadow-2xl sm:p-10">
        {/* The canonical logo is intentionally public so the gate can render before access. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/down_distance_logo.svg"
          alt="Down & Distance"
          className="mx-auto h-auto w-56"
        />
        <p className="mt-8 text-xs font-black uppercase tracking-[.28em] text-[#FF3D38]">
          Private Preview
        </p>
        <h1 className="mt-3 text-3xl font-black">DOWN &amp; DISTANCE</h1>
        <p className="mt-4 text-sm leading-6 text-white/65">
          This site is currently in private development.
        </p>
        <Suspense>
          <PreviewForm />
        </Suspense>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-white/40">
          All ball. All the time.
        </p>
      </section>
    </main>
  );
}
