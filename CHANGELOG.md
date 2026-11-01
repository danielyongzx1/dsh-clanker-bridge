# Changelog

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
