import { validateBindings } from './bindings';
import { EditorialDatabase } from './database';
import { EditorialR2Archive, LocalR2Objects } from './r2-archive';
/** Explicit local factory. The Worker has no archive HTTP routes or scheduler. */
export function createLocalArchive(input: unknown) {
  const env = validateBindings(input) as ReturnType<typeof validateBindings> & {
    EDITORIAL_ARCHIVE?: R2Bucket;
  };
  if (
    !env.EDITORIAL_ARCHIVE ||
    typeof env.EDITORIAL_ARCHIVE.get !== 'function' ||
    typeof env.EDITORIAL_ARCHIVE.put !== 'function'
  )
    throw Error('Private local archive binding required');
  const db = new EditorialDatabase(env.EDITORIAL_DB);
  return new EditorialR2Archive(db, new LocalR2Objects(env.EDITORIAL_ARCHIVE));
}
