import { Suspense } from 'react';
import { AltStackGeneratorShell } from '@/components/parlay-lab/alt-stack-generator-shell';

export const metadata = { title: 'Alt Stack | Parlay Lab | Down & Distance' };

export default function Page() {
  return (
    <Suspense>
      <AltStackGeneratorShell />
    </Suspense>
  );
}
