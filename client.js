/**
 * Client half of `dsh-token-cost`.
 *
 * Adds one ambient entry beside the shipped token-usage pill below the composer
 * (`conversation.composer.dock`, id `cost`, order 2). The entry renders the
 * estimated cost of the current Session, read from the Host projection
 * `tokenCost`; clicking it opens a compact billing breakdown with an aggregate
 * "全部" tab, one tab per model used by the Session, and a link to that model's
 * official price page. The component never folds session events itself and
 * imports no Harness client package.
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
      'tabs.aria': '费用明细视图',
      'tab.all': '全部',
      'row.input': '未命中缓存输入',
      'row.cacheRead': '缓存命中输入',
      'row.cacheWrite': '缓存写入',
      'row.output': '输出',
      'row.total': 'Token 合计',
      'row.unpriced': '未定价',
      'band.peak': '高峰时段费用',
      'band.offPeak': '空闲时段费用',
      'link.official': '官方价格',
    };
    const en = {
      'pill.unpriced': 'Unpriced',
      'pill.aria': 'Token cost {amount}. Click for details.',
      'pill.ariaUnpriced': 'Some tokens are unpriced. Click for details.',
      'dialog.title': 'Token cost',
      'tabs.aria': 'Cost breakdown views',
      'tab.all': 'All',
      'row.input': 'Uncached input',
      'row.cacheRead': 'Cache-hit input',
      'row.cacheWrite': 'Cache write',
      'row.output': 'Output',
      'row.total': 'Total tokens',
      'row.unpriced': 'Unpriced',
      'band.peak': 'Peak-band cost',
      'band.offPeak': 'Off-peak cost',
      'link.official': 'Official pricing',
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
      '.' + ROOT_CLASS + '_titleValue{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}',
      '.' + ROOT_CLASS + '_divider{border-top:.5px solid var(--dsw-alias-border-l2);margin:10px 0}',
      '.' + ROOT_CLASS + '_tabs{display:flex;align-items:center;gap:2px;max-width:100%;margin:0 -2px;padding:2px;',
      'overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:thin}',
      '.' + ROOT_CLASS + '_tab{box-sizing:border-box;flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;',
      'max-width:168px;padding:3px 8px;border:0;border-radius:var(--dsw-radius-sm,6px);background:0 0;',
      'color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}',
      '.' + ROOT_CLASS + '_tab:hover,.' + ROOT_CLASS + '_tab[aria-selected=true]{',
      'background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
      '.' + ROOT_CLASS + '_tab[aria-selected=true]{font-weight:600}',
      '.' + ROOT_CLASS + '_tab:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)));outline-offset:1px}',
      '.' + ROOT_CLASS + '_tabName{min-width:0;overflow:hidden;text-overflow:ellipsis}',
      '.' + ROOT_CLASS + '_tabAmount{flex:none;font-size:11px;font-variant-numeric:tabular-nums}',
      '.' + ROOT_CLASS + '_tabPanel{min-width:0}',
      '.' + ROOT_CLASS + '_details{color:var(--dsw-alias-label-secondary);grid-template-columns:minmax(96px,auto) minmax(0,1fr);',
      'gap:6px 16px;margin:0;display:grid}',
      '.' + ROOT_CLASS + '_details dt,.' + ROOT_CLASS + '_details dd{min-width:0;margin:0}',
      '.' + ROOT_CLASS + '_details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}',
      '.' + ROOT_CLASS + '_details dd b{color:var(--dsw-alias-label-primary);font-weight:600}',
      '.' + ROOT_CLASS + '_meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin:0 0 6px;overflow-wrap:anywhere}',
      '.' + ROOT_CLASS + '_unpriced{color:var(--dsw-alias-state-warn-primary);font-weight:600;margin:8px 0 0}',
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

    function numberOrNull(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }

    function isRecord(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    /** Money in a currency, always two decimals. */
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

    function symbolOf(currency) {
      const symbol = currency?.symbol;
      return typeof symbol === 'string' && symbol !== '' ? symbol : '¥';
    }
    //#endregion

    //#region view normalization (defensive: any malformed shape degrades to null)
    function readTokens(value) {
      const source = isRecord(value) ? value : {};
      return {
        input: numberOf(source.input),
        cacheRead: numberOf(source.cacheRead),
        cacheWrite: numberOf(source.cacheWrite),
        output: numberOf(source.output),
        reasoning: numberOf(source.reasoning),
      };
    }

    function sumTokens(tokens) {
      return tokens.input + tokens.cacheRead + tokens.cacheWrite + tokens.output;
    }

    function readMicros(value) {
      const source = isRecord(value) ? value : {};
      return {
        input: numberOf(source.input),
        cacheRead: numberOf(source.cacheRead),
        cacheWrite: numberOf(source.cacheWrite),
        output: numberOf(source.output),
      };
    }

    function readCurrencyRef(value) {
      if (!isRecord(value)) return null;
      const code = typeof value.code === 'string' ? value.code : '';
      const symbol = typeof value.symbol === 'string' && value.symbol !== '' ? value.symbol : '';
      if (code === '' && symbol === '') return null;
      return { code, symbol: symbol === '' ? code : symbol };
    }

    function normalizeCurrency(value) {
      if (!isRecord(value)) return null;
      const code = typeof value.code === 'string' ? value.code : '';
      if (code === '') return null;
      const tokens = readTokens(value.tokens);
      return {
        code,
        symbol: typeof value.symbol === 'string' && value.symbol !== '' ? value.symbol : code,
        micro: numberOf(value.micro),
        tokens,
        tokensTotal: sumTokens(tokens),
        micros: readMicros(value.micros),
        saving: numberOf(value.saving),
        peakMicro: numberOrNull(value.peakMicro),
        offPeakMicro: numberOrNull(value.offPeakMicro),
      };
    }

    function normalizeModel(value, fallbackCurrency) {
      if (!isRecord(value)) return null;
      const tokens = readTokens(value.tokens);
      const provider = typeof value.provider === 'string' ? value.provider : '';
      const model = typeof value.model === 'string' ? value.model : '';
      return {
        key: typeof value.key === 'string' && value.key !== '' ? value.key : provider + '/' + model,
        provider,
        model,
        name: typeof value.name === 'string' && value.name !== '' ? value.name : model !== '' ? model : provider,
        vendor: typeof value.vendor === 'string' && value.vendor !== '' ? value.vendor : null,
        vendorName: typeof value.vendorName === 'string' && value.vendorName !== '' ? value.vendorName : null,
        priced: value.priced === true,
        currency: readCurrencyRef(value.currency) ?? fallbackCurrency ?? null,
        micro: numberOf(value.micro),
        tokens,
        tokensTotal: numberOrNull(value.tokensTotal) ?? sumTokens(tokens),
        micros: isRecord(value.micros) ? readMicros(value.micros) : null,
        peakMicro: numberOrNull(value.peakMicro),
        offPeakMicro: numberOrNull(value.offPeakMicro),
        source: typeof value.source === 'string' && value.source !== '' ? value.source : null,
        asOf: typeof value.asOf === 'string' && value.asOf !== '' ? value.asOf : null,
      };
    }

    /**
     * Normalize the frozen `tokenCost` projection view. A view without a
     * currencies array is malformed and renders null; individual malformed
     * entries are skipped so one bad model can never hide the whole breakdown.
     */
    function normalizeView(value) {
      if (!isRecord(value) || !Array.isArray(value.currencies)) return null;
      const currencies = [];
      for (const entry of value.currencies) {
        const currency = normalizeCurrency(entry);
        if (currency !== null) currencies.push(currency);
      }
      const fallbackCurrency = currencies.length === 0 ? null : { code: currencies[0].code, symbol: currencies[0].symbol };
      const models = [];
      if (Array.isArray(value.models)) {
        for (const entry of value.models) {
          const model = normalizeModel(entry, fallbackCurrency);
          if (model !== null) models.push(model);
        }
      }
      const tokens = readTokens(value.tokens);
      let unpricedTokens = numberOrNull(value.unpricedTokens);
      if (unpricedTokens === null) {
        unpricedTokens = 0;
        for (const model of models) if (!model.priced) unpricedTokens += model.tokensTotal;
      }
      return {
        currencies,
        models,
        tokens,
        tokensTotal: numberOrNull(value.tokensTotal) ?? sumTokens(tokens),
        unpricedTokens,
        unpricedModels: Array.isArray(value.unpricedModels) ? value.unpricedModels.filter((entry) => typeof entry === 'string') : [],
        lastUpdated: numberOrNull(value.lastUpdated),
      };
    }

    /** Currencies whose usage produced tokens or money. */
    function usedCurrencies(view) {
      return view.currencies.filter((currency) => currency.micro > 0 || currency.tokensTotal > 0);
    }

    function hasUsage(view) {
      return (
        usedCurrencies(view).length > 0 ||
        view.unpricedTokens > 0 ||
        view.models.some((model) => !model.priced && model.tokensTotal > 0)
      );
    }

    /** Pill / title amount: per-currency totals, or the unpriced marker. */
    function amountLabel(view, t) {
      const used = usedCurrencies(view);
      if (used.length === 0) return t('pill.unpriced');
      return used.map((currency) => symbolOf(currency) + formatMoney(currency.micro)).join(' · ');
    }

    /** ` · ¥1.23 · $0.01` cost tail for one aggregate bucket, per used currency. */
    function costSuffix(currencies, readMicro) {
      let text = '';
      for (const currency of currencies) {
        const code = currencies.length > 1 ? currency.code + ' ' : '';
        text += ' · ' + code + symbolOf(currency) + formatMoney(readMicro(currency));
      }
      return text;
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

    /** First tab: the whole session, with per-currency cost and band rows. */
    function AggregateDetails(props) {
      const { view, t } = props;
      const currencies = usedCurrencies(view);
      const tokens = view.tokens;
      const rows = [
        h(
          DetailRow,
          { key: 'input', label: t('row.input') },
          h('b', null, formatTokens(tokens.input)),
          costSuffix(currencies, (currency) => currency.micros.input),
        ),
        h(
          DetailRow,
          { key: 'cacheRead', label: t('row.cacheRead') },
          h('b', null, formatTokens(tokens.cacheRead)),
          costSuffix(currencies, (currency) => currency.micros.cacheRead),
        ),
      ];
      if (tokens.cacheWrite > 0) {
        rows.push(
          h(
            DetailRow,
            { key: 'cacheWrite', label: t('row.cacheWrite') },
            h('b', null, formatTokens(tokens.cacheWrite)),
            costSuffix(currencies, (currency) => currency.micros.cacheWrite),
          ),
        );
      }
      rows.push(
        h(
          DetailRow,
          { key: 'output', label: t('row.output') },
          h('b', null, formatTokens(tokens.output)),
          costSuffix(currencies, (currency) => currency.micros.output),
        ),
        h(DetailRow, { key: 'total', label: t('row.total') }, h('b', null, formatTokens(view.tokensTotal))),
      );

      const bandRows = [];
      currencies.forEach((currency, position) => {
        const suffix = currencies.length > 1 ? ' (' + currency.code + ')' : '';
        const symbol = symbolOf(currency);
        if (currency.peakMicro !== null) {
          bandRows.push(h(DetailRow, { key: 'peak-' + position, label: t('band.peak') + suffix }, symbol + formatMoney(currency.peakMicro)));
        }
        if (currency.offPeakMicro !== null) {
          bandRows.push(
            h(DetailRow, { key: 'offPeak-' + position, label: t('band.offPeak') + suffix }, symbol + formatMoney(currency.offPeakMicro)),
          );
        }
      });

      return h(
        React.Fragment,
        null,
        h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-tokens': true }, rows),
        bandRows.length === 0 ? null : Divider(),
        bandRows.length === 0 ? null : h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-bands': true }, bandRows),
      );
    }

    /** One model tab: its own token rows, bands (only when reported) and source link. */
    function ModelDetails(props) {
      const { model, t } = props;
      const tokens = model.tokens;
      const micros = model.micros ?? { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
      const symbol = symbolOf(model.currency);
      const costOf = (bucket) => (model.priced ? ' · ' + symbol + formatMoney(micros[bucket]) : '');
      const rows = [
        h(DetailRow, { key: 'input', label: t('row.input') }, h('b', null, formatTokens(tokens.input)), costOf('input')),
        h(DetailRow, { key: 'cacheRead', label: t('row.cacheRead') }, h('b', null, formatTokens(tokens.cacheRead)), costOf('cacheRead')),
      ];
      if (tokens.cacheWrite > 0) {
        rows.push(
          h(DetailRow, { key: 'cacheWrite', label: t('row.cacheWrite') }, h('b', null, formatTokens(tokens.cacheWrite)), costOf('cacheWrite')),
        );
      }
      rows.push(
        h(DetailRow, { key: 'output', label: t('row.output') }, h('b', null, formatTokens(tokens.output)), costOf('output')),
        h(DetailRow, { key: 'total', label: t('row.total') }, h('b', null, formatTokens(model.tokensTotal))),
      );

      const bandRows = [];
      if (model.peakMicro !== null) {
        bandRows.push(h(DetailRow, { key: 'peak', label: t('band.peak') }, symbol + formatMoney(model.peakMicro)));
      }
      if (model.offPeakMicro !== null) {
        bandRows.push(h(DetailRow, { key: 'offPeak', label: t('band.offPeak') }, symbol + formatMoney(model.offPeakMicro)));
      }

      const metaParts = [];
      if (model.provider !== '') metaParts.push(model.provider);
      if (model.vendorName !== null) metaParts.push(model.vendorName);
      else if (model.vendor !== null) metaParts.push(model.vendor);
      const meta = metaParts.join(' · ');

      const link =
        model.priced && model.source !== null
          ? h(
              'div',
              { className: ROOT_CLASS + '_linkRow', 'data-token-cost-source': true },
              h('span', { className: ROOT_CLASS + '_linkLabel' }, t('link.official')),
              h(
                'a',
                {
                  className: ROOT_CLASS + '_link',
                  href: model.source,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                },
                model.source,
              ),
            )
          : null;

      return h(
        React.Fragment,
        null,
        meta === '' ? null : h('div', { className: ROOT_CLASS + '_meta', 'data-token-cost-model-meta': true }, meta),
        h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-tokens': true }, rows),
        model.priced ? null : h('div', { className: ROOT_CLASS + '_unpriced', 'data-token-cost-unpriced': true }, t('row.unpriced')),
        bandRows.length === 0 ? null : Divider(),
        bandRows.length === 0 ? null : h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-bands': true }, bandRows),
        link === null ? null : Divider(),
        link,
      );
    }

    /** Dialog body: headline total, divider, scrollable tab strip, active panel. */
    function CostBody(props) {
      const { view, t } = props;
      const models = view.models;
      const tabCount = models.length + 1;
      const [active, setActive] = React.useState(0);
      // The models list may shrink while the dialog is open (a provider fold
      // changing the projection); clamp instead of indexing out of range.
      const index = Math.min(Math.max(0, Math.floor(numberOf(active))), tabCount - 1);

      const select = (next) => setActive(next);
      const onKeyDown = (event) => {
        if (event === null || typeof event !== 'object') return;
        let next = -1;
        if (event.key === 'ArrowRight') next = (index + 1) % tabCount;
        else if (event.key === 'ArrowLeft') next = (index + tabCount - 1) % tabCount;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabCount - 1;
        if (next < 0) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        select(next);
      };

      const tabs = [
        h(
          'button',
          {
            key: 'all',
            type: 'button',
            role: 'tab',
            className: ROOT_CLASS + '_tab',
            'aria-selected': index === 0,
            tabIndex: index === 0 ? 0 : -1,
            'data-token-cost-tab': 'all',
            onClick: () => select(0),
          },
          h('span', { className: ROOT_CLASS + '_tabName' }, t('tab.all')),
        ),
      ];
      models.forEach((model, position) => {
        const target = position + 1;
        tabs.push(
          h(
            'button',
            {
              key: 'model-' + position + '-' + model.key,
              type: 'button',
              role: 'tab',
              className: ROOT_CLASS + '_tab',
              'aria-selected': index === target,
              tabIndex: index === target ? 0 : -1,
              title: model.name,
              'data-token-cost-tab': model.key,
              onClick: () => select(target),
            },
            h('span', { className: ROOT_CLASS + '_tabName' }, model.name),
            model.priced ? h('span', { className: ROOT_CLASS + '_tabAmount' }, symbolOf(model.currency) + formatMoney(model.micro)) : null,
          ),
        );
      });

      const content = index === 0 ? h(AggregateDetails, { view, t }) : h(ModelDetails, { model: models[index - 1], t });

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: ROOT_CLASS + '_title' },
          h('span', { className: ROOT_CLASS + '_titleLabel' }, h(CostIcon), t('dialog.title')),
          h('span', { className: ROOT_CLASS + '_titleValue' }, amountLabel(view, t)),
        ),
        Divider(),
        h('div', { role: 'tablist', 'aria-label': t('tabs.aria'), className: ROOT_CLASS + '_tabs', onKeyDown }, tabs),
        Divider(),
        h('div', { role: 'tabpanel', className: ROOT_CLASS + '_tabPanel', 'data-token-cost-tabpanel': true }, content),
      );
    }

    function CostTrigger(props) {
      const { view, t } = props;
      const [open, setOpen] = React.useState(false);
      const [pos, setPos] = React.useState(null);
      const rootRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const unpricedOnly = usedCurrencies(view).length === 0;
      const amount = amountLabel(view, t);
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
              h(CostBody, { view, t }),
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
            h('span', { className: ROOT_CLASS + '_label' }, amount),
          ),
        ),
        panel,
      );
    }

    function CostPill(props) {
      // `useProjection` is a standard hook prop of every session-scoped slot
      // entry; the fallback keeps the hook call unconditional even in a shell
      // that fails to supply it (the pill then simply stays hidden).
      const useProjection = typeof props.useProjection === 'function' ? props.useProjection : () => undefined;
      const view = normalizeView(useProjection('tokenCost'));
      if (view === null || !hasUsage(view)) return null;
      return h(CostTrigger, { view, t: props.t });
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
