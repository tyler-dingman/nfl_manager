import { D1EditorialIngestion } from '../../../packages/storage/editorial-ingestion';
import {
  EditorialDirectory,
  type EditorialEntity,
} from '../../../packages/storage/editorial-directory';
import { applicationDatabaseRouter, applicationStorage, currentEditorialOwner } from './bindings';
import { teamDatabase } from '../../../packages/storage/multi-d1';
export function editorialTeamOwner(team?: string | null) {
  return team && team !== 'NFL' ? teamDatabase(team) : ('D1_SHARED' as const);
}
export async function editorialRepository(
  kind?: EditorialEntity,
  id?: string,
  team?: string | null,
) {
  const router = applicationDatabaseRouter();
  if (!router) return new D1EditorialIngestion(applicationStorage());
  const scoped = currentEditorialOwner();
  if (scoped) return new D1EditorialIngestion(router.storage(scoped));
  if (team !== undefined) return new D1EditorialIngestion(router.storage(editorialTeamOwner(team)));
  if (kind && id) {
    const store = await new EditorialDirectory(router).storage(kind, id);
    if (store) return new D1EditorialIngestion(store);
  }
  throw Error('Editorial operation requires an explicit owner or existing global ID');
}

export async function editorialIdentityStorage(kind: EditorialEntity, id: string) {
  const router = applicationDatabaseRouter();
  if (!router) return applicationStorage();
  const scoped = currentEditorialOwner();
  if (scoped) return router.storage(scoped);
  const storage = await new EditorialDirectory(router).storage(kind, id);
  if (!storage) throw Error('Editorial identity not found');
  return storage;
}
