import { applicationBackend, applicationStorage } from '../persistence/bindings';
import {
  getEditorialOverrides,
  saveEditorialOverride,
} from '@/features/three-and-out/editorial-store';
import type { EditorialOverride } from '@/features/three-and-out/types';
export async function loadOverrides(team: string) {
  if (applicationBackend() === 'postgres') return getEditorialOverrides(team);
  const s = applicationStorage(),
    rows = await s.rows<any>(
      'SELECT object_hash FROM app_editorial_overrides WHERE team_id=? ORDER BY created_at,id',
      [team],
    );
  return Promise.all(
    rows.map(async (r) => {
      const data = await s.get<any>(r.object_hash);
      if (data.team !== team) throw Error('Editorial override identity mismatch');
      return data.override as EditorialOverride;
    }),
  );
}
export async function persistOverride(team: string, override: EditorialOverride) {
  if (applicationBackend() === 'postgres') return saveEditorialOverride(team, override);
  const s = applicationStorage(),
    id = crypto.randomUUID(),
    hash = await s.put({ schema: 1, team, override });
  await s
    .statement(
      'INSERT INTO app_editorial_overrides(id,team_id,story_id,user_id,object_hash,created_at) VALUES(?,?,?,?,?,?)',
      [id, team, override.storyId, override.editorId, hash, Date.parse(override.createdAt)],
    )
    .run();
  return override;
}
