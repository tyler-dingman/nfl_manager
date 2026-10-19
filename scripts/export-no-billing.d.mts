export function logicalExport(query: (sql: string) => Promise<Record<string, unknown>[]> | Record<string, unknown>[]): Promise<Buffer>;
