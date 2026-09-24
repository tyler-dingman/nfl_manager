import { NextRequest } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata, saveFranchiseSimulation } from './repository';
import type { DraftSessionDTO } from '@/types/draft';

/** Preserve the completed real draft in the same durable snapshot as the franchise clock. */
export async function persistCompletedFranchiseDraft(
  request: Request,
  saveId: string,
  session: DraftSessionDTO,
) {
  if (session.mode !== 'real' || session.status !== 'completed') return;
  const user = await currentUser(new NextRequest(request.url, { headers: request.headers }));
  if (!user) throw new Error('Sign in to save your franchise draft.');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const metadata = await getFrontOfficeSaveMetadata(user.id, saveId);
    if (!metadata?.simulation || metadata.simulation.phase !== 'draft')
      throw new Error('The franchise is not in the NFL Draft phase.');
    if (metadata.simulation.completedDraft?.id === session.id) return;
    const saved = await saveFranchiseSimulation({
      userId: user.id,
      saveId,
      expectedVersion: metadata.version ?? 1,
      simulation: { ...metadata.simulation, completedDraft: session },
    });
    if (saved) return;
  }
  throw new Error('The franchise changed. Retry to save the completed draft.');
}
