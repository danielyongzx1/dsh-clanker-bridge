# Clanker Bridge for DeepSeek Harness

Use Harness Desktop as a remote backend in [Clanker](https://github.com/danielyongzx1/Clanker) on your phone. The plugin starts an authenticated bridge with Harness, handles its changing local port/token automatically, and keeps saved chats attached to the same device.

Includes streamed text and reasoning, model-specific effort selection, tool progress, approvals/questions, cancellation, context/speed/cache statistics, and real attachment uploads/downloads. The phone never executes the remote agent's tool events.

## Install on another Windows PC

Requires the **official Harness Desktop 0.2.1-rc.5** and a Clanker build with **Settings → Backends**. Older Clanker builds that only configure model endpoints cannot use this agent bridge. Configure your model and file/terminal tools in Harness first.

1. In Harness, open **Plugins → Add plugin**.
2. Install this repository:

   ```text
   github:danielyongzx1/dsh-clanker-bridge
   ```

   You can also install the prebuilt archive from the [latest GitHub release](https://github.com/danielyongzx1/dsh-clanker-bridge/releases/latest).
3. If Harness requests a restart, fully quit it using the Windows tray menu and reopen it with your normal shortcut.
4. On the PC, open this private local file in your browser:

   ```text
   %USERPROFILE%\.dsh\integrations\clanker-bridge\desktop\pairing.html
   ```

   If you use `DSH_HOME`, it is under that directory instead. A custom storage directory is used when configured. The plugin logs the file's path, never the token.
5. In Clanker, select **Settings → Backends → Add remote backend**. Copy the PC's Wi-Fi/Ethernet address and bridge token from that page. Tap **Test connection**, choose a model, then **Save**.
6. Start a new chat and choose the saved backend.

The bridge defaults to port **8788**. Allow that port on your private Windows network. Your phone needs a route to the PC through the same LAN or a private VPN; use HTTPS through a reverse proxy for internet access. Saving an alternative address in Clanker does not establish the network route itself.

No Clanker source checkout, separate Node installation, console launch or manual Harness token copying is needed on the other PC. The plugin runs inside Harness's Node runtime. **Windows is the verified platform.** Other desktop distributions and operating systems are not live-verified.

## Settings and daily use

The plugin's configuration accepts:

| Setting | Default | Meaning |
| --- | --- | --- |
| `port` | `8788` | Port your phone connects to. |
| `listenAddress` | `0.0.0.0` | Listen on LAN/VPN interfaces. Use `127.0.0.1` to limit it to this PC. |
| `dataDirectory` | Harness home, `integrations/clanker-bridge/desktop` | Persistent pairing settings, bridge state, versioned file objects and workspaces. |

Open Harness normally next time. It supplies its current API credentials in memory; your phone's bridge token, bridge identity and saved session mappings stay stable. Closing the desktop window keeps Harness running. Fully quitting stops the bridge too; reopen Harness to reconnect.

If another bridge already occupies the port, this plugin leaves that process alone. Change the port or disable the other bridge, then restart. Keep the data directory across upgrades. Removing it creates a new identity and prevents old chats from resuming against a replacement device.

`connection.json` and `pairing.html` contain the stable bridge token. Keep them private. Pairing is a local file rather than an unauthenticated HTTP route. The changing upstream Harness launch token is never written to disk or sent to your phone.

Enable **Context meter**, **Decode speed**, and **Cache hits** in Clanker to display reported usage. Unknown measurements stay hidden. Context uses Harness's current pressure/capacity, not lifetime token totals. Follow-up messages queue until the active turn settles; regeneration is disabled to avoid repeating agent actions.

## Files and agent access

- Attachments transfer as original bytes with a **20 MB** limit per file.
- Each chat gets a workspace on this PC. Harness's tools must see that filesystem.
- New/changed workspace files attach to replies. Downloads retain immutable versions.
- File-transfer paths and symlinks are checked against the chat workspace boundary.
- Workspaces organize files; **they do not sandbox the agent**. Harness owns tool permissions, history, compression and memory.
- Deleting a chat on the phone clears its local data. Host sessions and files remain until explicitly cleaned up on this PC.

The authenticated version-1 API covers capabilities/models, sessions, idempotent submissions, run snapshots/events, controls, Stop, and file transfer. It is the same remote-agent interface used by Clanker's companion bridge. Upstream calls use Harness's published clients and generated contracts pinned together at `0.2.1-rc.5`.

## Existing local bridge installations

If you already use the development `clanker-harness-desktop-bridge` plugin from a Clanker checkout, keep using it until you migrate its existing bridge token, state and workspace paths. Installing this plugin with fresh defaults creates a separate backend identity; it does not import the old connection automatically. Disable the old plugin before using the same port. Back up the old bridge state and workspace together. No current installation is removed by publishing this repository.

## Development and checks

```sh
npm ci --ignore-scripts
npm run check
npm test
npm pack --ignore-scripts
```

Sources are plain JavaScript modules, so GitHub installation needs no build scripts. Tests exercise the published Harness client protocol against local HTTP/WebSocket fixtures, attachment integrity/boundaries, immutable artifacts, effort/usage, cancellation, replay, and plugin startup across changing host generations. They do not call a model provider.

`ci/check.yml` is a ready-to-enable GitHub Actions template. A repository administrator can copy it to `.github/workflows/check.yml`; the publishing credential used for this initial release cannot create workflow files.

Host-version compatibility is intentionally explicit. Update and verify the contracts before widening `engines.dsh`; do not use a version exemption as a compatibility fix. Disable/remove the plugin in Harness's Plugins page to stop serving the bridge. Stored host data remains for explicit cleanup.

License: [MIT](LICENSE).
