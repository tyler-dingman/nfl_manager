import { drainJobs, scheduleDueSources, workOne } from '../src/server/story-engine/service';

async function main() {
  const command = process.argv[2] ?? 'run';
  if (command === 'schedule') console.log(await scheduleDueSources());
  else if (command === 'work') console.log(await workOne());
  else if (command === 'run') {
    console.log(await scheduleDueSources());
    console.log(await drainJobs());
  } else throw new Error('Usage: npm run source:watch -- [schedule|work|run]');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
