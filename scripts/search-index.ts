import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const { indexSearchDocuments } = await import('../src/server/search/indexer');
const full = process.argv.includes('--full');
const stats = await indexSearchDocuments({ full });
console.log(JSON.stringify({ mode: full ? 'full' : 'incremental', ...stats }, null, 2));
