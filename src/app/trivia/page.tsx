import { Suspense } from 'react';

import TriviaPage from '@/components/trivia/trivia-page';

export default function TriviaRoute() {
  return <Suspense><TriviaPage /></Suspense>;
}