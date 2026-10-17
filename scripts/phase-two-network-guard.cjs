// Local validation only. Block outbound sockets before DNS/network access.
const net = require('node:net');
const tls = require('node:tls');
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options =
    typeof args[0] === 'object'
      ? args[0]
      : typeof args[0] === 'number'
        ? { port: args[0], host: typeof args[1] === 'string' ? args[1] : 'localhost' }
        : { path: args[0] };
  // net's internal normalized argument array is used by TLS/HTTP.
  const actual = Array.isArray(options) ? options[0] : options;
  if (actual?.path) {
    if (!String(actual.path).startsWith('/private/tmp/dd-'))
      throw Error('Local validation socket refused');
  } else if (!['localhost', '127.0.0.1', '::1', undefined].includes(actual?.host)) {
    throw Error('External sockets disabled during Phase 2 validation');
  }
  return original.apply(this, args);
};
// Also guard TLS explicitly: a remote IP passed through TLS must not bypass the socket check.
const connect = tls.connect;
tls.connect = function (...args) {
  const options =
    typeof args[0] === 'object' ? args[0] : typeof args[2] === 'object' ? args[2] : {};
  const host = options.host ?? (typeof args[1] === 'string' ? args[1] : 'localhost');
  if (!['localhost', '127.0.0.1', '::1'].includes(host))
    throw Error('External TLS disabled during Phase 2 validation');
  return connect.apply(this, args);
};
