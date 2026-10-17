import { AsyncLocalStorage } from 'node:async_hooks';
import type postgres from 'postgres';
export const databaseContext = new AsyncLocalStorage<ReturnType<typeof postgres>>();
