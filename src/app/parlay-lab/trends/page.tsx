import { Suspense } from 'react';
import { ParlayLabHome } from '@/components/parlay-lab/ParlayLabHome';
export default function Page() { return <Suspense><ParlayLabHome mode="trends" /></Suspense>; }
