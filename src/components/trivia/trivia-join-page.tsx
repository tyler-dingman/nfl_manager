'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound } from 'lucide-react';

import MainSiteHeader from '@/components/main-site-header';
import { useAuthUser } from '@/features/auth/auth-session';

export default function TriviaJoinPage({ token }: { token: string }) {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/trivia/join/${token}`)}`);
      return;
    }
    void fetch(`/api/trivia/join/${encodeURIComponent(token)}`, { method: 'POST' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to join Trivia room.');
        const roomResponse = await fetch(`/api/trivia/join/${encodeURIComponent(token)}`);
        const roomBody = await roomResponse.json();
        if (!roomResponse.ok) throw new Error(roomBody.error ?? 'Unable to load Trivia room.');
        router.replace(`/trivia?team=${roomBody.room.teamId}&room=${roomBody.room.joinCode}`);
      })
      .catch((cause) => setError((cause as Error).message));
  }, [hydrated, router, token, user]);

  return (
    <div className="min-h-screen bg-[#E9EDF0] text-[#00172B]">
      <MainSiteHeader active="trivia" />
      <main className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center">
        <UsersRound className="h-14 w-14 text-[#FF3D38]" />
        <h1 className="mt-6 text-4xl font-black uppercase">Joining the crew</h1>
        <p className="mt-3 font-semibold text-slate-500">
          {error || 'Checking the invitation and adding you to the waiting room…'}
        </p>
      </main>
    </div>
  );
}
