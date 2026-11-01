import { mkdir, readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { createConnection } from 'node:net';
import z from '@deepseek-ai/schemastery';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { createBridge } from './bridge/server.mjs';
import { pairingDetails, writePairingPage } from './bridge/pairing.mjs';

export const name = 'clanker-bridge';
export const inject = ['webServer', 'connection'];
export const Config = z({
  port: z.number().min(1024).max(65535).default(8788).description('Port Clanker connects to on this device.'),
  listenAddress: z.string().default('0.0.0.0').description('Address to listen on; 0.0.0.0 accepts your LAN/VPN connections.'),
  dataDirectory: z.string().default('').description('Optional storage directory. Leave empty to use your Harness home.'),
});

export async function deviceSettings(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('Clanker storage must not be a symlink.');
  const filename = path.join(directory, 'connection.json');
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error('Invalid Clanker pairing settings.');
    const saved = JSON.parse(await readFile(filename, 'utf8'));
    if (saved.version !== 1 || !/^[a-f0-9]{64}$/.test(saved.bridgeToken ?? '') || !/^[a-zA-Z0-9_-]{16,100}$/.test(saved.profileId ?? '')) throw new Error('Invalid Clanker pairing settings.');
    return saved;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const settings = { version: 1, profileId: randomUUID(), bridgeToken: randomBytes(32).toString('hex') };
  await writeFile(filename + '.tmp', JSON.stringify(settings), { mode: 0o600, flag: 'wx' });
  await rename(filename + '.tmp', filename);
  return settings;
}

/** One host generation. Credentials remain in memory; only the stable phone
 * token and profile identity are stored. No subprocess or app checkout needed. */
export async function startBridge(ctx, options = {}, dependencies = {}) {
  const port = options.port ?? 8788;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a bridge port between 1024 and 65535.');
  if (!dependencies.createBridge) await new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); reject(Object.assign(new Error('Bridge port is already in use.'), { code: 'EADDRINUSE' })); });
    socket.once('error', (error) => { socket.destroy(); if (error.code === 'ECONNREFUSED') resolve(); else reject(error); });
    socket.setTimeout(1500, () => { socket.destroy(); reject(new Error('Could not check the bridge port.')); });
  });
  const directory = path.resolve(options.dataDirectory || path.join(resolveDshHome(), 'integrations', 'clanker-bridge', 'desktop'));
  const settings = await deviceSettings(directory);
  const origin = ctx.webServer.getOrigin();
  const url = new URL(ctx.connection.authenticatedUrl(origin));
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.origin !== origin || !url.searchParams.get('token')) throw new Error('Harness did not provide its own authenticated loopback origin.');
  const config = {
    kind: 'harness', host: options.listenAddress ?? '0.0.0.0', port,
    token: settings.bridgeToken, launchToken: url.searchParams.get('token'), upstreamUrl: url.origin,
    upstreamIdentity: `harness-desktop:${settings.profileId}`,
    workspaceRoot: path.join(directory, 'workspaces'), stateDir: path.join(directory, 'state'),
  };
  const bridge = await (dependencies.createBridge ?? createBridge)(config);
  try {
    await new Promise((resolve, reject) => { bridge.server.once('error', reject); bridge.server.listen(config.port, config.host, resolve); });
    const pairing = { kind: 'harness', bridgeId: bridge.state.bridgeId, token: settings.bridgeToken, host: config.host, port: config.port };
    const page = await writePairingPage(path.join(directory, 'pairing.html'), pairing);
    (dependencies.log ?? console.log)(`[Clanker] Bridge ready on port ${config.port}. Pairing instructions: ${page}`);
    bridge.pairing = { ...pairing, file: page };
    return bridge;
  } catch (error) { await bridge.close(); throw error; }
}

/** The plugin page's route, under Harness's authenticated /api bridge; it answers 403 to anyone but its signed-in owner. */
export const PAIRING_ROUTE = '/api/clanker-bridge/pairing';

/** What the plugin page shows. Addresses are read per request, so a network change shows on refresh. */
export function pairingResponse(bridge, failure) {
  if (!bridge?.pairing) return failure ? { state: 'failed', error: failure } : { state: 'starting' };
  const { file, ...options } = bridge.pairing;
  const { name, addresses, qr, loopbackOnly } = pairingDetails(options);
  return { state: 'ready', name, addresses, qr, loopbackOnly, token: options.token, file };
}

export function apply(ctx, options = {}) {
  let stopped = false, bridge, retry, cancelReady, starting, failure;
  const cancelled = new Promise((resolve) => { cancelReady = resolve; });
  const log = ctx.logger?.('clanker-bridge') ?? console;
  const ready = ctx.get('loader')?.await() ?? Promise.resolve();
  // The page is a convenience: if Harness can't take the route, the bridge still starts.
  try {
    ctx.connection?.fetch?.register({
      path: PAIRING_ROUTE,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async () => Response.json(pairingResponse(bridge, failure), { headers: { 'Cache-Control': 'no-store' } }),
    });
  } catch (error) {
    log.warn?.(`Clanker pairing page unavailable in Harness: ${error.message}. Use pairing.html instead.`);
  }
  const begin = async () => {
    starting = (async () => {
      if (stopped) return;
      try { bridge = await startBridge(ctx, options); failure = undefined; }
      catch (error) {
        failure = error.code === 'EADDRINUSE' ? 'Clanker bridge port is already in use. Change its port or stop the other bridge.' : 'Clanker bridge could not start. Check its storage and plugin configuration.';
        log.error(failure);
        if (!stopped) retry = setTimeout(() => { void begin(); }, 10000);
      }
    })();
    return starting;
  };
  const startup = Promise.race([ready, cancelled]).then(() => { if (!stopped) return begin(); });
  ctx.on('dispose', async () => { stopped = true; clearTimeout(retry); cancelReady(); await startup; await starting; await bridge?.close(); });
}
