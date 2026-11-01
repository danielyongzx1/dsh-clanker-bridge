import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { deviceSettings, startBridge, apply } from '../src/index.mjs';
import { pairingHtml } from '../src/bridge/pairing.mjs';

test('a fresh device generates its own stable pairing credentials without a local config file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'clanker-device-'));
  try {
    const first = await deviceSettings(directory);
    assert.match(first.bridgeToken, /^[a-f0-9]{64}$/);
    const second = await deviceSettings(directory);
    assert.deepEqual(second, first);
    const another = await deviceSettings(path.join(directory, 'another-device'));
    assert.notEqual(another.bridgeToken, first.bridgeToken);
    assert.notEqual(another.profileId, first.profileId);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('host generations keep bridge identity settings while using only the current in-memory Harness token', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'clanker-plugin-'));
  const calls = [], logs = [];
  const createBridge = async (config) => {
    calls.push(config);
    const server = http.createServer();
    // Ephemeral port only inside the test's fake bridge, avoiding global listeners.
    const listen = server.listen.bind(server); server.listen = (_port, _host, callback) => listen(0, '127.0.0.1', callback);
    return { server, state: { bridgeId: 'fixture-bridge' }, close: async () => { await new Promise((resolve) => server.close(resolve)); } };
  };
  let bridge;
  try {
    const ctx = (origin, token) => ({ webServer: { getOrigin: () => origin }, connection: { authenticatedUrl: () => `${origin}/?token=${token}` } });
    bridge = await startBridge(ctx('http://127.0.0.1:3001', 'first-host-token'), { dataDirectory: directory }, { createBridge, log: (s) => logs.push(s) });
    await bridge.close(); bridge = undefined;
    bridge = await startBridge(ctx('http://127.0.0.1:4002', 'second-host-token'), { dataDirectory: directory }, { createBridge, log: (s) => logs.push(s) });
    assert.equal(calls[0].token, calls[1].token);
    assert.equal(calls[0].upstreamIdentity, calls[1].upstreamIdentity);
    assert.notEqual(calls[0].launchToken, calls[1].launchToken);
    assert.notEqual(calls[0].upstreamUrl, calls[1].upstreamUrl);
    const stored = await readFile(path.join(directory, 'connection.json'), 'utf8');
    assert.ok(!stored.includes('first-host-token') && !stored.includes('second-host-token'));
    assert.ok(logs.every((line) => !line.includes(calls[0].token) && !line.includes(calls[1].launchToken)));
    assert.ok((await readFile(path.join(directory, 'pairing.html'), 'utf8')).includes(calls[0].token));
  } finally { await bridge?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('pairing stays in a local file and escapes interface names and values', () => {
  const html = pairingHtml({ kind: 'harness', bridgeId: 'fixture-bridge', token: 'fixture-token', port: 8788, interfaces: { '<script>bad</script>': [{ family: 'IPv4', internal: false, address: '192.168.1.10' }] } });
  assert.ok(html.includes('http://192.168.1.10:8788'));
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));
  assert.ok(!html.includes('<script>bad</script>'));
  assert.ok(!html.includes('https://'));
});

test('disposing before Loader readiness does not start or hang the plugin', async () => {
  let dispose;
  const ctx = { get: () => ({ await: () => new Promise(() => {}) }), on: (event, callback) => { if (event === 'dispose') dispose = callback; }, logger: () => console };
  apply(ctx);
  await dispose();
});
