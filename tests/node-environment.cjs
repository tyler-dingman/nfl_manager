// Next's compiler handles CSS and fonts in production. Standalone Node component
// tests use deterministic module adapters; browser tests validate real rendering.
const Module = require('node:module');
const load = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'next/font/google' || name === 'next/font/local')
    return new Proxy(
      {},
      {
        get: (_, family) => () => ({
          className: `test-font-${String(family)}`,
          variable: '--test-font',
          style: { fontFamily: String(family) },
        }),
      },
    );
  return load.call(this, name, parent, isMain);
};
require.extensions['.css'] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) };
};
