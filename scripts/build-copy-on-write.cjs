// Disposable build only. macOS's cp -c provides real independent APFS clones;
// Node's COPYFILE_FICLONE can fall back to full copies on this host.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = process.env.DD_BUILD_COPY_ROOT;
const inside = (p) => root && path.resolve(String(p)).startsWith(path.resolve(root) + path.sep);
const clone = (src, dest, mode = 0) =>
  process.platform === 'darwin' &&
  inside(src) &&
  inside(dest) &&
  !(mode & fs.constants.COPYFILE_EXCL);
const sync = fs.copyFileSync.bind(fs),
  asyncCopy = fs.promises.copyFile.bind(fs.promises),
  callback = fs.copyFile.bind(fs);
function copy(src, dest, mode = 0) {
  if (clone(src, dest, mode)) {
    execFileSync('/bin/cp', ['-c', String(src), String(dest)], { stdio: 'pipe' });
    return;
  }
  return sync(src, dest, mode);
}
fs.copyFileSync = copy;
// Build tooling already performs large synchronous tracing passes. Serializing
// clone subprocesses avoids unbounded subprocess fanout during Next tracing.
fs.promises.copyFile = async (src, dest, mode = 0) =>
  clone(src, dest, mode) ? copy(src, dest, mode) : asyncCopy(src, dest, mode);
fs.copyFile = (src, dest, mode, done) => {
  if (typeof mode === 'function') {
    done = mode;
    mode = 0;
  }
  if (!clone(src, dest, mode ?? 0)) return callback(src, dest, mode ?? 0, done);
  try {
    copy(src, dest, mode ?? 0);
    queueMicrotask(() => done(null));
  } catch (e) {
    queueMicrotask(() => done(e));
  }
};
require('node:module').syncBuiltinESMExports();
