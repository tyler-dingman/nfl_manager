'use client';

import { usePathname } from 'next/navigation';

export default function SiteFooter() {
  const pathname = usePathname();
  const hiddenPrefixes = ['/admin', '/login', '/onboarding', '/start', '/preview', '/dev'];
  if (hiddenPrefixes.some((prefix) => pathname?.startsWith(prefix))) return null;

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8 lg:pb-8">
        <p className="font-semibold">Down &amp; Distance</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-5 font-semibold">
          <span>About</span>
          <span>Sources</span>
          <span>Privacy</span>
          <span>Terms</span>
        </nav>
      </div>
    </footer>
  );
}
