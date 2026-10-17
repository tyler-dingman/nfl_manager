import { createLocalArchive } from './r2-bindings';
import { validateBindings } from './bindings';
import { EditorialDatabase } from './database';
import { EditorialRepository } from './repository';
/** Runtime factory only: no Next/Node, auth, PostgreSQL, or external provider imports. */
export function createLocalRepository(bindings: unknown): EditorialRepository {
  const env = validateBindings(bindings);
  const db = env.EDITORIAL_ARCHIVE
    ? createLocalArchive(env).db
    : new EditorialDatabase(env.EDITORIAL_DB);
  return new EditorialRepository(db);
}
