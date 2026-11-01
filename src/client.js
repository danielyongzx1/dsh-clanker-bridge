// The browser half: the pairing code on this plugin's own page in Harness (Plugins →
// dsh-clanker-bridge). Plain JavaScript in Harness's module-loader format, so the package keeps
// needing no build step. Data comes over the plugin's RPC channel, which Harness serves only to its
// signed-in owner.
window.__ModuleLoader__.load({
  id: 'dsh-clanker-bridge',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const { createElement: h, useCallback, useEffect, useState } = require('react');

    const BUNDLE_NAME = 'dsh-clanker-bridge';
    const CHANNEL = '/clanker-bridge';
    const LOCALE_NS = 'clankerBridge';

    const en = {
      title: 'Pair Clanker',
      intro: 'In Clanker, open Settings → Backends and add a backend, or open this one to reconnect. Tap Scan QR code, scan this code, then Save.',
      addresses: 'Addresses',
      token: 'Bridge token',
      show: 'Show',
      hide: 'Hide',
      copy: 'Copy',
      copied: 'Copied',
      refresh: 'Refresh',
      loading: 'Loading the pairing code…',
      starting: 'The bridge is starting. Refresh in a moment.',
      failed: 'The bridge isn’t running:',
      error: 'Couldn’t load the pairing code:',
      noAddress: 'No LAN address was found. Connect this PC to your network, then refresh.',
      loopback: 'The bridge only accepts connections from this PC. Set its listen address to 0.0.0.0 to reach it from your phone.',
      private: 'Keep this code private: like the token, it gives access to this PC’s agent.',
      file: 'Also saved as',
    };
    const zh = {
      title: '配对 Clanker',
      intro: '在 Clanker 中打开 Settings → Backends，添加后端，或打开此后端以重新连接。点按 Scan QR code 扫描此二维码，然后点按 Save。',
      addresses: '地址',
      token: '桥接令牌',
      show: '显示',
      hide: '隐藏',
      copy: '复制',
      copied: '已复制',
      refresh: '刷新',
      loading: '正在加载配对二维码…',
      starting: '桥接正在启动，请稍后刷新。',
      failed: '桥接未运行：',
      error: '无法加载配对二维码：',
      noAddress: '未找到局域网地址。请将此电脑连接到网络后刷新。',
      loopback: '桥接只接受来自此电脑的连接。将其监听地址设为 0.0.0.0 后，手机才能连接。',
      private: '请妥善保管此二维码：它和令牌一样，可用于访问此电脑上的智能体。',
      file: '也已保存为',
    };
    const zhTW = {
      title: '配對 Clanker',
      intro: '在 Clanker 中開啟 Settings → Backends，新增後端，或開啟此後端以重新連線。點按 Scan QR code 掃描此 QR 碼，然後點按 Save。',
      addresses: '位址',
      token: '橋接權杖',
      show: '顯示',
      hide: '隱藏',
      copy: '複製',
      copied: '已複製',
      refresh: '重新整理',
      loading: '正在載入配對 QR 碼…',
      starting: '橋接正在啟動，請稍後重新整理。',
      failed: '橋接未執行：',
      error: '無法載入配對 QR 碼：',
      noAddress: '找不到區域網路位址。請將此電腦連上網路後重新整理。',
      loopback: '橋接只接受來自此電腦的連線。將其監聽位址設為 0.0.0.0 後，手機才能連線。',
      private: '請妥善保管此 QR 碼：它和權杖一樣，可用於存取此電腦上的代理。',
      file: '也已儲存為',
    };

    const border = '1px solid rgba(128, 128, 128, 0.35)';
    const styles = {
      root: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 },
      title: { margin: 0, fontSize: 16, fontWeight: 600 },
      muted: { margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.72 },
      qr: { width: 220, height: 220, padding: 8, borderRadius: 12, background: '#fff', boxSizing: 'border-box' },
      label: { fontSize: 13, fontWeight: 500, opacity: 0.72, marginBottom: 6 },
      row: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
      value: {
        flex: 1,
        minWidth: 0,
        padding: '7px 10px',
        border,
        borderRadius: 8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      button: {
        padding: '6px 12px',
        border,
        borderRadius: 8,
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: 13,
        cursor: 'pointer',
        flexShrink: 0,
      },
    };

    function CopyButton({ text, t }) {
      const [copied, setCopied] = useState(false);
      useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(timer);
      }, [copied]);
      return h(
        'button',
        {
          type: 'button',
          style: styles.button,
          onClick: () => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {}),
        },
        copied ? t('copied') : t('copy')
      );
    }

    function Field({ label, value, children }) {
      return h(
        'div',
        null,
        h('div', { style: styles.label }, label),
        h('div', { style: styles.row }, h('div', { style: styles.value, title: value }, value), children)
      );
    }

    /** Reads the pairing details through Harness's authenticated connection. */
    function createSection(ctx) {
      return function PairingSection({ t }) {
        const [result, setResult] = useState({ loading: true });
        const [showToken, setShowToken] = useState(false);
        const load = useCallback(() => {
          setResult((current) => ({ ...current, loading: true }));
          ctx.connection.rpc
            .call(CHANNEL, 'pairing', {})
            .then((data) => setResult({ data }), (error) => setResult({ error: error instanceof Error ? error.message : String(error) }));
        }, []);
        useEffect(load, [load]);

        const { data, error, loading } = result;
        const refresh = h('button', { type: 'button', style: styles.button, onClick: load, disabled: loading }, t('refresh'));
        const header = h('div', { style: { ...styles.row, justifyContent: 'space-between' } }, h('h3', { style: styles.title }, t('title')), refresh);

        if (error) return h('div', { style: styles.root }, header, h('p', { style: styles.muted }, `${t('error')} ${error}`));
        if (!data) return h('div', { style: styles.root }, header, h('p', { style: styles.muted }, t('loading')));
        if (data.state === 'starting') return h('div', { style: styles.root }, header, h('p', { style: styles.muted }, t('starting')));
        if (data.state === 'failed') return h('div', { style: styles.root }, header, h('p', { style: styles.muted }, `${t('failed')} ${data.error}`));

        return h(
          'div',
          { style: styles.root },
          header,
          data.qr
            ? [
                h('p', { key: 'intro', style: styles.muted }, t('intro')),
                // The SVG is generated by the plugin's own host half from its QR encoder, never from input.
                h('div', { key: 'qr', style: styles.qr, role: 'img', 'aria-label': 'Clanker pairing QR code', dangerouslySetInnerHTML: { __html: data.qr } }),
              ]
            : h('p', { style: styles.muted }, data.loopbackOnly ? t('loopback') : t('noAddress')),
          data.addresses.length > 0 &&
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              h('div', { style: { ...styles.label, marginBottom: 0 } }, t('addresses')),
              data.addresses.map((address) =>
                h('div', { key: address.url, style: styles.row }, h('div', { style: styles.value, title: `${address.name} · ${address.url}` }, `${address.url}  ·  ${address.name}`), h(CopyButton, { text: address.url, t }))
              )
            ),
          h(
            Field,
            { label: t('token'), value: showToken ? data.token : '•'.repeat(24) },
            h('button', { type: 'button', style: styles.button, onClick: () => setShowToken(!showToken) }, showToken ? t('hide') : t('show')),
            h(CopyButton, { text: data.token, t })
          ),
          h('p', { style: styles.muted }, t('private')),
          data.file && h('p', { style: { ...styles.muted, wordBreak: 'break-all' } }, `${t('file')} ${data.file}`)
        );
      };
    }

    const inject = ['slots', 'locale', 'connection'];

    function apply(ctx) {
      ctx.effect(() => {
        const off = [ctx.locale.register(LOCALE_NS, 'en', en), ctx.locale.register(LOCALE_NS, 'zh', zh), ctx.locale.register(LOCALE_NS, 'zh-TW', zhTW)];
        return () => off.forEach((dispose) => dispose());
      }, 'dsh-clanker-bridge: dictionaries');

      // On this bundle's page in Plugins, between its description and its components.
      const PairingSection = createSection(ctx);
      ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register({ name: 'plugins.bundle.config', key: BUNDLE_NAME, locale: LOCALE_NS }, PairingSection)
      );
    }

    exports.BUNDLE_NAME = BUNDLE_NAME;
    exports.CHANNEL = CHANNEL;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
