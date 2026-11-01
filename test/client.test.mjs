import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { apply as applyHost, PAIRING_ROUTE, pairingResponse } from '../src/index.mjs';

const token = 'f'.repeat(64);
const lan = { 'Wi-Fi': [{ family: 'IPv4', internal: false, address: '192.168.1.9' }] };

const host = (connection, warnings = []) => ({
  get: () => ({ await: () => new Promise(() => {}) }), on: () => {}, logger: () => ({ warn: (line) => warnings.push(line), error: () => {} }), connection,
});

test('the pairing route is an exact GET under Harness’s /api bridge, reporting starting until the bridge is up', async () => {
  let route;
  applyHost(host({ fetch: { register: (r) => { route = r; return () => {}; } } }));
  assert.equal(route.path, PAIRING_ROUTE); assert.deepEqual(route.methods, ['GET']);
  const response = await route.fetch(new Request('http://127.0.0.1/api/clanker-bridge/pairing'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { state: 'starting' });
});

test('a Harness that refuses the route still runs the bridge, without the page', () => {
  const warnings = [];
  applyHost(host({ fetch: { register: () => { throw new Error('cannot get property "webServer" without inject'); } } }, warnings));
  assert.match(warnings[0], /pairing\.html/);
});

test('a running bridge answers with a fresh QR code, its addresses and token', () => {
  const bridge = { pairing: { kind: 'harness', bridgeId: 'b1', token, host: '0.0.0.0', port: 8788, file: 'C:\\pairing.html' } };
  const original = bridge.pairing.port;
  const ready = pairingResponse(bridge);
  assert.equal(ready.state, 'ready'); assert.equal(ready.token, token); assert.equal(ready.file, 'C:\\pairing.html');
  assert.equal(bridge.pairing.port, original);
  assert.deepEqual(pairingResponse(undefined, 'Port in use.'), { state: 'failed', error: 'Port in use.' });
  // Interfaces are read per request in production; a fixed set is enough to check the shape here.
  assert.match(pairingResponse({ pairing: { ...bridge.pairing, interfaces: lan } }).qr, /<svg/);
});

/** Loads the browser half the way Harness's module loader does, with a stand-in React. */
async function loadClient(states = []) {
  let loaded;
  const queue = [...states];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }),
    useState: (initial) => [queue.length ? queue.shift() : initial, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
  };
  vm.runInNewContext(await readFile(new URL('../src/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (entry) => { loaded = entry; } } },
    fetch: () => new Promise(() => {}),
  });
  return { id: loaded.id, module: loaded.factory((name) => { assert.equal(name, 'react'); return react; }) };
}

const text = (node) => (node == null || node === false ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join(' ') : typeof node.type === 'function' ? text(node.type(node.props ?? {}))
  : [node.props?.dangerouslySetInnerHTML?.__html ?? '', ...node.children.map(text)].join(' '));

test('the browser half registers on this bundle’s Plugins page and shows the code, keeping the token hidden', async () => {
  const { id, module } = await loadClient();
  assert.equal(id, 'dsh-clanker-bridge');
  // The module lives in its own realm, so its objects are compared by value.
  assert.equal(JSON.stringify(module.inject), JSON.stringify(['slots', 'locale']));
  const registered = [], locales = [];
  const ctx = {
    effect: (fn) => fn(),
    locale: { register: (ns, lang) => { locales.push(`${ns}:${lang}`); return () => {}; } },
    slots: { inject: (_name, fn) => fn(), register: (options, component) => { registered.push({ options, component }); return () => {}; } },
  };
  module.apply(ctx);
  assert.deepEqual({ ...registered[0].options }, { name: 'plugins.bundle.config', key: 'dsh-clanker-bridge', locale: 'clankerBridge' });
  assert.ok(locales.includes('clankerBridge:en'));

  const t = (key) => `[${key}]`;
  assert.match(text(registered[0].component({ t })), /\[loading\]/);

  const data = pairingResponse({ pairing: { kind: 'harness', bridgeId: 'b1', token, host: '0.0.0.0', port: 8788, interfaces: lan } });
  const ready = await loadClient([{ data }, false]);
  const readyCtx = { ...ctx, slots: { inject: (_n, fn) => fn(), register: (_o, component) => { registered.push({ component }); return () => {}; } } };
  ready.module.apply(readyCtx);
  const shown = text(registered.at(-1).component({ t }));
  assert.match(shown, /<svg/); assert.match(shown, /http:\/\/192\.168\.1\.9:8788/); assert.match(shown, /\[intro\]/);
  assert.ok(!shown.includes(token), 'the token stays hidden until Show');
});
