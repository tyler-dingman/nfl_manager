// SecureStore values have platform-dependent size limits. Store large UI snapshots in
// bounded chunks, publishing their manifest only once every chunk has been written.
export function createChunkedStorage(deviceStorage: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}) {
  return {
    async get(key: string): Promise<string | null> {
      const raw = await deviceStorage.get(`${key}.manifest`);
      if (!raw) return deviceStorage.get(key);
      const manifest = JSON.parse(raw) as { generation: string; count: number };
      if (
        !Number.isInteger(manifest.count) ||
        manifest.count < 0 ||
        manifest.count > 20000 ||
        !/^[a-z0-9-]+$/.test(manifest.generation)
      )
        throw new Error('Invalid saved snapshot.');
      const chunks: string[] = [];
      for (let i = 0; i < manifest.count; i++) {
        const chunk = await deviceStorage.get(`${key}.${manifest.generation}.${i}`);
        if (chunk === null) throw new Error('Incomplete saved snapshot.');
        chunks.push(chunk);
      }
      return chunks.join('');
    },
    async set(key: string, value: string) {
      const previous = await deviceStorage.get(`${key}.manifest`);
      const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const characters = Array.from(value);
      const chunks: string[] = [];
      for (let offset = 0; offset < characters.length; offset += 384)
        chunks.push(characters.slice(offset, offset + 384).join(''));
      if (chunks.length > 20000) throw new Error('Snapshot is too large.');
      let written = 0;
      try {
        for (let i = 0; i < chunks.length; i++) {
          await deviceStorage.set(`${key}.${generation}.${i}`, chunks[i]);
          written++;
        }
        await deviceStorage.set(
          `${key}.manifest`,
          JSON.stringify({ generation, count: chunks.length }),
        );
      } catch (error) {
        for (let i = 0; i < written; i++)
          await deviceStorage.remove(`${key}.${generation}.${i}`).catch(() => undefined);
        throw error;
      }
      if (previous) {
        try {
          const old = JSON.parse(previous);
          if (
            !Number.isInteger(old.count) ||
            old.count < 0 ||
            old.count > 20000 ||
            !/^[a-z0-9-]+$/.test(old.generation)
          )
            return;
          for (let i = 0; i < old.count; i++)
            await deviceStorage.remove(`${key}.${old.generation}.${i}`);
        } catch {
          /* A committed snapshot remains readable if cleanup fails. */
        }
      }
    },
  };
}
