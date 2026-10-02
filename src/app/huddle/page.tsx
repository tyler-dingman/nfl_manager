import { Suspense } from 'react';
import Huddle from '@/components/huddle-live/huddle';
export default function HuddlePage() {
  return (
    <Suspense fallback={<p>Opening The Huddle…</p>}>
      <Huddle />
    </Suspense>
  );
}
