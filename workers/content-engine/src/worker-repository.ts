import { validateBindings } from './bindings';
import { EditorialDatabase } from './database';
import { EditorialRepository } from './repository';
/** Runtime factory only: no Next/Node, auth, PostgreSQL, or external provider imports. */
export function createLocalRepository(bindings: unknown): EditorialRepository {
  const env = validateBindings(bindings);
  return new EditorialRepository(new EditorialDatabase(env.EDITORIAL_DB));
}
