import { Suspense } from 'react';
import GameDayPage from '@/components/game-day/game-day-page';

export default function GameDayRoute() {
  return (
    <Suspense fallback={null}>
      <GameDayPage />
    </Suspense>
  );
}
