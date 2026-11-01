# Changelog

## 0.4.1

- Fix 0.4.0 failing to start (`cannot get property "webServer" without inject`): the pairing page's data now comes from an exact route on Harness's authenticated `/api` bridge instead of an RPC channel, which cordis resolved against Harness's connection plugin rather than this one. A failure to register the page no longer stops the bridge.

## 0.4.0

- Show the pairing QR code, addresses and bridge token on the plugin's own page in Harness (Plugins → dsh-clanker-bridge), with copy buttons and a refresh for network changes. The token stays hidden until **Show**. The page reads them from the plugin's `/api/clanker-bridge/pairing` route on Harness's authenticated `/api` bridge, which serves only its signed-in owner. If Harness can't take the route, the bridge still starts.

## 0.3.0

- Show a QR code on the pairing page. Scanning it in Clanker (Settings → Backends → Scan QR code) fills in the addresses and token, and reconnects a backend already saved for this bridge without losing its chats.
- Name the connection after the PC by default.

## 0.2.0

- Let a chat switch to another model from the provider it started with. Each turn can name its model; a different provider is refused. Clanker offers switching once the bridge reports `modelSwitching`.
- Move repository, installation, issue and catalog submission links to `danielyongzx1/dsh-clanker-bridge`.

## 0.1.0

- Extract the remote agent bridge from Clanker's companion into a self-contained Harness plugin.
- Generate stable per-device pairing credentials and a private local pairing page.
- Obtain current Harness credentials through its own host services; no local source paths or extra Node installation.
- Preserve chat/session identity across Desktop host port changes.
- Include streaming, controls, files, effort and reported context/speed/cache statistics.
- Recover missed journal completion events without resubmitting a prompt.
