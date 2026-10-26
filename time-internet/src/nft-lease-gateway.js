import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/;

/**
 * Linux nftables timed-lease adapter.
 * The host must already have a working, authorized uplink, WireGuard routing,
 * forwarding, and NAT. Do not use this to re-share a consumer plan whose terms
 * prohibit tethering or redistribution.
 */
export function createNftLeaseGateway({
  table = 'timed_access',
  set = 'active_clients',
  run = execFileAsync,
} = {}) {
  if (!IDENT.test(table) || !IDENT.test(set)) {
    throw new TypeError('Invalid nftables identifier or interface name');
  }

  async function grant(clientIp, expiresAt, now = Date.now()) {
    if (typeof clientIp !== 'string' || !IPV4.test(clientIp)) {
      throw new TypeError('clientIp must be a valid IPv4 address');
    }
    if (!Number.isSafeInteger(expiresAt) || !Number.isSafeInteger(now) || expiresAt <= now) {
      throw new TypeError('A future server-authoritative expiresAt is required');
    }
    const ttlSeconds = Math.ceil((expiresAt - now) / 1000);
    await run('nft', [
      'add', 'element', 'inet', table, set,
      '{', clientIp, 'timeout', String(ttlSeconds) + 's', '}',
    ]);
    return Object.freeze({ clientIp, expiresAt, ttlSeconds, enforcement: 'nftables-timeout' });
  }

  async function revoke(clientIp) {
    if (typeof clientIp !== 'string' || !IPV4.test(clientIp)) {
      throw new TypeError('clientIp must be a valid IPv4 address');
    }
    await run('nft', [
      'delete', 'element', 'inet', table, set, '{', clientIp, '}',
    ]);
    return Object.freeze({ clientIp, revoked: true });
  }

  return Object.freeze({ grant, revoke });
}
