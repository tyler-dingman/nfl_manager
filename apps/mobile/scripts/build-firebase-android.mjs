import { spawnSync } from 'node:child_process';
import { statfsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const disk = statfsSync(cwd);
if (disk.bavail * disk.bsize < 10 * 1024 ** 3) {
  throw new Error('Free at least 10 GB before building Android. No build was started.');
}
const env = {
  ...process.env,
  APP_VARIANT: 'firebase',
  NODE_ENV: 'production',
  EXPO_PUBLIC_API_BASE_URL: 'https://www.downdistance.com',
  EXPO_PUBLIC_USE_FIXTURES: 'false',
  ANDROID_VERSION_CODE: process.env.ANDROID_VERSION_CODE ?? String(Math.floor(Date.now() / 1000)),
};
const response = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/auth/config`, {
  signal: AbortSignal.timeout(15_000),
});
const auth = await response.json();
if (!response.ok || !auth.mobileBrowserLogin || !auth.email || !auth.providers?.google) {
  throw new Error(
    'Deploy the mobile login backend and configure Google before building the tester APK.',
  );
}
if (!auth.providers.apple) console.warn('Apple sign-in is not configured on the server yet.');
function run(command, args, directory = cwd) {
  const result = spawnSync(command, args, { cwd: directory, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Refresh launcher resources without deleting the existing Android signing key.
run(process.execPath, [
  'node_modules/expo/bin/cli',
  'prebuild',
  '--platform',
  'android',
  '--no-install',
]);
run('./gradlew', [':app:assembleRelease', '--no-daemon'], `${cwd}/android`);
console.log('APK: android/app/build/outputs/apk/release/app-release.apk');
