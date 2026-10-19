/**
 * Client half of `dsh-token-cost`.
 *
 * Adds one ambient entry beside the shipped token-usage pill below the composer
 * (`conversation.composer.dock`, id `cost`, order 2). The entry renders the
 * estimated cost of the current Session, read from the Host projection
 * `tokenCost`; clicking it opens a compact billing breakdown with a link to the
 * official DeepSeek price page. The component never folds session events itself
 * and imports no Harness client package.
 */
window.__ModuleLoader__.load({
  id: 'dsh-token-cost',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const h = React.createElement;

    const NS = 'token-cost';
    const ROOT_CLASS = 'dshTokenCost';

    //#region locale dictionaries
    const zh = {
      'pill.unpriced': '未定价',
      'pill.aria': 'Token 费用 {amount}，点击查看明细',
      'pill.ariaUnpriced': '部分 token 未定价，点击查看明细',
      'dialog.title': 'Token 费用',
      'row.input': '未命中缓存输入',
      'row.cacheRead': '缓存命中输入',
      'row.cacheWrite': '缓存写入',
      'row.output': '输出',
      'row.total': 'Token 合计',
      'section.models': '按模型',
      'row.unpriced': '未定价',
      'band.peak': '高峰时段费用',
      'band.offPeak': '空闲时段费用',
      'link.official': 'DeepSeek 官方价格',
    };
    const en = {
      'pill.unpriced': 'Unpriced',
      'pill.aria': 'Token cost {amount}. Click for details.',
      'pill.ariaUnpriced': 'Some tokens are unpriced. Click for details.',
      'dialog.title': 'Token cost',
      'row.input': 'Uncached input',
      'row.cacheRead': 'Cache-hit input',
      'row.cacheWrite': 'Cache write',
      'row.output': 'Output',
      'row.total': 'Total tokens',
      'section.models': 'By model',
      'row.unpriced': 'Unpriced',
      'band.peak': 'Peak-band cost',
      'band.offPeak': 'Off-peak cost',
      'link.official': 'Official DeepSeek pricing',
    };
    //#endregion

    //#region styles (theme tokens only, with graceful fallbacks)
    const CSS = [
      '.' + ROOT_CLASS + '_anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);',
      'line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}',
      '.' + ROOT_CLASS + '_pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm,6px);max-width:100%;',
      'color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;',
      'white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex;cursor:pointer}',
      '.' + ROOT_CLASS + '_pill svg{flex:none;width:14px;height:14px}',
      '.' + ROOT_CLASS + '_pill:hover,.' + ROOT_CLASS + '_pill[aria-expanded=true]{',
      'background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary)}',
      '.' + ROOT_CLASS + '_pill:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)));outline-offset:1px}',
      '.' + ROOT_CLASS + '_pillUnpriced{color:var(--dsw-alias-state-warn-primary)}',
      '.' + ROOT_CLASS + '_label{text-overflow:ellipsis;min-width:0;overflow:hidden}',
      '.' + ROOT_CLASS + '_panel{z-index:1100;box-sizing:border-box;position:fixed;border:0;padding:16px;',
      'border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-overlay);',
      'box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.18));color:var(--dsw-alias-label-secondary);',
      'cursor:default;width:max-content;min-width:min(300px,calc(100vw - 24px));max-width:min(420px,calc(100vw - 24px));',
      'font-size:12px;line-height:18px}',
      '.' + ROOT_CLASS + '_title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;',
      'font-weight:600;display:flex}',
      '.' + ROOT_CLASS + '_titleLabel{align-items:center;gap:6px;min-width:0;display:inline-flex}',
      '.' + ROOT_CLASS + '_titleLabel svg{flex:none;width:14px;height:14px}',
      '.' + ROOT_CLASS + '_titleValue{font-variant-numeric:tabular-nums;font-weight:600}',
      '.' + ROOT_CLASS + '_divider{border-top:.5px solid var(--dsw-alias-border-l2);margin:10px 0}',
      '.' + ROOT_CLASS + '_section{color:var(--dsw-alias-label-primary);margin:0 0 6px;font-weight:600}',
      '.' + ROOT_CLASS + '_details{color:var(--dsw-alias-label-secondary);grid-template-columns:minmax(96px,auto) minmax(0,1fr);',
      'gap:6px 16px;margin:0;display:grid}',
      '.' + ROOT_CLASS + '_details dt,.' + ROOT_CLASS + '_details dd{min-width:0;margin:0}',
      '.' + ROOT_CLASS + '_details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}',
      '.' + ROOT_CLASS + '_details dd b{color:var(--dsw-alias-label-primary);font-weight:600}',
      '.' + ROOT_CLASS + '_modelRow{overflow-wrap:anywhere}',
      '.' + ROOT_CLASS + '_linkRow{display:flex;flex-direction:column;gap:4px}',
      '.' + ROOT_CLASS + '_linkLabel{color:var(--dsw-alias-label-primary);font-weight:600}',
      '.' + ROOT_CLASS + '_link{color:var(--dsw-alias-brand-primary);font-size:12px;line-height:16px;word-break:break-all;text-decoration:none}',
      '.' + ROOT_CLASS + '_link:hover{text-decoration:underline}',
      '@media (width<=480px){.' + ROOT_CLASS + '_label{display:none}.' + ROOT_CLASS + '_pill{padding:1px 6px}}',
    ].join('');
    //#endregion

    //#region formatting helpers
    function numberOf(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    function symbolOf(view) {
      const symbol = view?.currency?.symbol;
      return typeof symbol === 'string' && symbol !== '' ? symbol : '¥';
    }

    /** Money in the session currency, always two decimals. */
    function formatMoney(micro) {
      const value = numberOf(micro) / 1e6;
      try {
        return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
      } catch {
        return value.toFixed(2);
      }
    }

    /** One compact magnitude step: 1 decimal, no trailing `.0`. */
    function formatMagnitude(value) {
      const rounded = Math.round(value * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    /** Token counts in K / M as requested (under one thousand stays exact). */
    function formatTokens(value) {
      const count = Math.max(0, Math.round(numberOf(value)));
      if (count < 1000) return String(count);
      if (count < 1000000) return formatMagnitude(count / 1000) + 'K';
      return formatMagnitude(count / 1000000) + 'M';
    }
    //#endregion

    //#region presentation
    function CostIcon(props) {
      return h(
        'svg',
        Object.assign({ viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': true }, props ?? {}),
        h('circle', { cx: 8, cy: 8, r: 6.25, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', {
          d: 'M5.4 4.9 8 7.6l2.6-2.7M8 7.6v4.1M6.1 9.2h3.8M6.1 10.6h3.8',
          stroke: 'currentColor',
          strokeWidth: 1.1,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    function Divider() {
      return h('div', { className: ROOT_CLASS + '_divider', 'aria-hidden': true });
    }

    function DetailRow(props) {
      return h(
        React.Fragment,
        null,
        h('dt', { className: props.className }, props.label),
        h('dd', null, props.children),
      );
    }

    function CostDetails(props) {
      const { view, t, symbol } = props;
      const tokens = view.tokens ?? {};
      const micros = view.micros ?? {};
      const rows = [
        h(DetailRow, { key: 'input', label: t('row.input') }, h('b', null, formatTokens(tokens.input)), ' · ' + symbol + formatMoney(micros.input)),
        h(DetailRow, { key: 'cacheRead', label: t('row.cacheRead') }, h('b', null, formatTokens(tokens.cacheRead)), ' · ' + symbol + formatMoney(micros.cacheRead)),
      ];
      if (numberOf(tokens.cacheWrite) > 0) {
        rows.push(h(DetailRow, { key: 'cacheWrite', label: t('row.cacheWrite') }, h('b', null, formatTokens(tokens.cacheWrite)), ' · ' + symbol + formatMoney(micros.cacheWrite)));
      }
      rows.push(h(DetailRow, { key: 'output', label: t('row.output') }, h('b', null, formatTokens(tokens.output)), ' · ' + symbol + formatMoney(micros.output)));
      rows.push(h(DetailRow, { key: 'total', label: t('row.total') }, h('b', null, formatTokens(view.tokensTotal))));

      const models = Array.isArray(view.models) ? view.models : [];
      const unpricedTokens = numberOf(view.unpricedTokens);
      const showModels = models.length > 1 || unpricedTokens > 0;
      const modelRows = [];
      models.forEach((model, index) => {
        if (model === null || typeof model !== 'object') return;
        const catalog = view.price?.models?.[model.pricingKey];
        const name = typeof catalog?.name === 'string' && catalog.name !== '' ? catalog.name : String(model.model ?? '');
        modelRows.push(
          h(
            DetailRow,
            { key: 'model-' + index, label: name, className: ROOT_CLASS + '_modelRow' },
            model.priced ? symbol + formatMoney(model.micro) + ' · ' + formatTokens(model.tokensTotal) : t('row.unpriced'),
          ),
        );
      });

      const priceSource = typeof view.price?.source === 'string' && view.price.source !== '' ? view.price.source : '';
      const linkRow = priceSource === ''
        ? null
        : h(
            'div',
            { className: ROOT_CLASS + '_linkRow' },
            h('span', { className: ROOT_CLASS + '_linkLabel' }, t('link.official')),
            h(
              'a',
              {
                className: ROOT_CLASS + '_link',
                href: priceSource,
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              priceSource,
            ),
          );

      return h(
        React.Fragment,
        null,
        h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-tokens': true }, rows),
        showModels ? Divider() : null,
        showModels ? h('div', { className: ROOT_CLASS + '_section' }, t('section.models')) : null,
        showModels ? h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-models': true }, modelRows) : null,
        Divider(),
        h(
          'dl',
          { className: ROOT_CLASS + '_details', 'data-token-cost-bands': true },
          h(DetailRow, { key: 'peak', label: t('band.peak') }, symbol + formatMoney(view.peakMicro)),
          h(DetailRow, { key: 'offPeak', label: t('band.offPeak') }, symbol + formatMoney(view.offPeakMicro)),
        ),
        linkRow === null ? null : Divider(),
        linkRow,
      );
    }

    function CostPill(props) {
      // `useProjection` is a standard hook prop of every session-scoped slot
      // entry; the fallback keeps the hook call unconditional even in a shell
      // that fails to supply it (the pill then simply stays hidden).
      const useProjection = typeof props.useProjection === 'function' ? props.useProjection : () => undefined;
      const view = useProjection('tokenCost');
      if (view === undefined || view === null || typeof view !== 'object') return null;
      if (typeof view.micro !== 'number') return null;
      const unpricedOnly = numberOf(view.unpricedTokens) > 0 && numberOf(view.micro) === 0;
      if (numberOf(view.tokensTotal) === 0 && numberOf(view.micro) === 0) return null;
      return h(CostTrigger, { view, t: props.t, unpricedOnly });
    }

    function CostTrigger(props) {
      const { view, t, unpricedOnly } = props;
      const [open, setOpen] = React.useState(false);
      const [pos, setPos] = React.useState(null);
      const rootRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const symbol = symbolOf(view);
      const amount = symbol + formatMoney(view.micro);
      const label = unpricedOnly ? t('pill.unpriced') : amount;
      const ariaLabel = unpricedOnly ? t('pill.ariaUnpriced') : t('pill.aria', { amount });

      React.useLayoutEffect(() => {
        if (!open) {
          setPos(null);
          return undefined;
        }
        const update = () => {
          const anchor = rootRef.current;
          const panel = panelRef.current;
          if (anchor === null) return;
          const rect = anchor.getBoundingClientRect();
          const width = panel === null ? 300 : panel.offsetWidth;
          const maxLeft = Math.max(12, window.innerWidth - 12 - width);
          const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), maxLeft);
          setPos({ left, bottom: Math.max(12, window.innerHeight - rect.top + 8) });
        };
        update();
        const timer = window.setTimeout(update, 0);
        window.addEventListener('resize', update);
        return () => {
          window.clearTimeout(timer);
          window.removeEventListener('resize', update);
        };
      }, [open]);

      React.useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          const target = event.target;
          if (rootRef.current !== null && rootRef.current.contains(target)) return;
          if (panelRef.current !== null && panelRef.current.contains(target)) return;
          setOpen(false);
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [open]);

      const panel = !open
        ? null
        : ReactDOM.createPortal(
            h(
              'div',
              {
                ref: panelRef,
                className: ROOT_CLASS + '_panel',
                role: 'dialog',
                'aria-label': t('dialog.title'),
                'data-token-cost-dialog': true,
                style: pos === null ? { visibility: 'hidden', left: 0, bottom: 0 } : { left: pos.left, bottom: pos.bottom },
              },
              h(
                'div',
                { className: ROOT_CLASS + '_title' },
                h('span', { className: ROOT_CLASS + '_titleLabel' }, h(CostIcon), t('dialog.title')),
                h('span', { className: ROOT_CLASS + '_titleValue' }, amount),
              ),
              Divider(),
              h(CostDetails, { view, t, symbol }),
            ),
            document.body,
          );

      return h(
        React.Fragment,
        null,
        h(
          'span',
          { ref: rootRef, className: ROOT_CLASS + '_anchor', 'data-composer-cost': 'cost' },
          h(
            'button',
            {
              type: 'button',
              className: ROOT_CLASS + '_pill' + (unpricedOnly ? ' ' + ROOT_CLASS + '_pillUnpriced' : ''),
              'aria-haspopup': 'dialog',
              'aria-expanded': open,
              'aria-label': ariaLabel,
              onClick: () => setOpen(!open),
            },
            h(CostIcon),
            h('span', { className: ROOT_CLASS + '_label' }, label),
          ),
        ),
        panel,
      );
    }
    //#endregion

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-cost: dictionaries');
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-token-cost';
          tag.dataset.pluginCss = 'dsh-token-cost/composer-cost.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, 'token-cost: styles');
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'cost',
              order: 2,
              locale: NS,
            },
            CostPill,
          ),
        );
      },
    };
  },
});
