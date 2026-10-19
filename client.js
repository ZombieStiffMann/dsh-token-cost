/**
 * Client half of `dsh-token-cost`.
 *
 * Adds one ambient entry beside the shipped token-usage pill below the composer
 * (`conversation.composer.dock`, id `cost`, order 2). The entry renders the
 * estimated cost of the current Session, read from the Host projection
 * `tokenCost`; clicking it opens a compact billing breakdown with one tab per
 * model used by the Session and a link to that model's official price page. A
 * small in-dialog settings panel switches the UI language (follow-app / 中文 /
 * English) and the display currency (native / CNY / USD, converted with a
 * user-editable USD->CNY rate); preferences persist in localStorage. The
 * component never folds session events itself and imports no Harness client
 * package.
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
      'row.input': '未命中缓存输入',
      'row.cacheRead': '缓存命中输入',
      'row.cacheWrite': '缓存写入',
      'row.output': '输出',
      'row.total': 'Token 合计',
      'row.unpriced': '未定价',
      'band.peak': '高峰时段费用',
      'band.offPeak': '空闲时段费用',
      'note.flat': '该模型按厂商统一单价计费（无高峰/空闲时段）',
      'link.official': '官方价格',
      'link.asOf': '数据日期 {date}',
      'settings.open': '设置',
      'settings.title': '设置',
      'settings.language': '界面语言',
      'settings.currency': '显示货币',
      'settings.back': '返回明细',
      'language.auto': '跟随应用',
      'language.zh': '中文',
      'language.en': 'English',
      'currency.native': '原币种',
      'currency.CNY': 'CNY ¥',
      'currency.USD': 'USD $',
      'fx.label': '1 USD = ¥',
      'fx.hint': '自定义估算汇率，仅影响本插件的费用显示',
      'fx.line': '汇率 1 USD = ¥{rate}（估算）',
    };
    const en = {
      'pill.unpriced': 'Unpriced',
      'pill.aria': 'Token cost {amount}. Click for details.',
      'pill.ariaUnpriced': 'Some tokens are unpriced. Click for details.',
      'dialog.title': 'Token cost',
      'tabs.aria': 'Cost breakdown views',
      'row.input': 'Uncached input',
      'row.cacheRead': 'Cache-hit input',
      'row.cacheWrite': 'Cache write',
      'row.output': 'Output',
      'row.total': 'Total tokens',
      'row.unpriced': 'Unpriced',
      'band.peak': 'Peak-band cost',
      'band.offPeak': 'Off-peak cost',
      'note.flat': 'No peak/off-peak bands for this model; billed at the vendor flat rate',
      'link.official': 'Official pricing',
      'link.asOf': 'Data as of {date}',
      'settings.open': 'Settings',
      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.currency': 'Display currency',
      'settings.back': 'Back to breakdown',
      'language.auto': 'Follow app',
      'language.zh': '中文',
      'language.en': 'English',
      'currency.native': 'Native',
      'currency.CNY': 'CNY ¥',
      'currency.USD': 'USD $',
      'fx.label': '1 USD = ¥',
      'fx.hint': 'User-set estimate; only changes the display in this plugin',
      'fx.line': 'FX 1 USD = ¥{rate} (estimate)',
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
      '.' + ROOT_CLASS + '_unpriced{color:var(--dsw-alias-state-warn-primary);margin:8px 0 0;font-weight:500}',
      '.' + ROOT_CLASS + '_flatNote{color:var(--dsw-alias-label-tertiary);margin:8px 0 0;font-size:11px;line-height:16px}',
      '.' + ROOT_CLASS + '_asOf{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      '.' + ROOT_CLASS + '_linkRow{display:flex;flex-direction:column;gap:4px}',
      '.' + ROOT_CLASS + '_linkLabel{color:var(--dsw-alias-label-primary);font-weight:600}',
      '.' + ROOT_CLASS + '_link{color:var(--dsw-alias-brand-primary);font-size:12px;line-height:16px;word-break:break-all;text-decoration:none}',
      '.' + ROOT_CLASS + '_link:hover{text-decoration:underline}',
      '.' + ROOT_CLASS + '_titleActions{display:inline-flex;align-items:center;gap:8px;min-width:0}',
      '.' + ROOT_CLASS + '_gear{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;justify-content:center;',
      'width:22px;height:22px;padding:0;border:0;border-radius:var(--dsw-radius-sm,6px);background:0 0;',
      'color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.' + ROOT_CLASS + '_gear:hover,.' + ROOT_CLASS + '_gear[aria-expanded=true]{',
      'background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
      '.' + ROOT_CLASS + '_gear:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)));outline-offset:1px}',
      '.' + ROOT_CLASS + '_gear svg{flex:none;width:14px;height:14px}',
      '.' + ROOT_CLASS + '_fxLine{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin:6px 0 0}',
      '.' + ROOT_CLASS + '_settings{min-width:0}',
      '.' + ROOT_CLASS + '_settingsHeading{color:var(--dsw-alias-label-primary);font-weight:600;margin:0 0 8px}',
      '.' + ROOT_CLASS + '_settingGroup{margin:0 0 10px}',
      '.' + ROOT_CLASS + '_settingLabel{color:var(--dsw-alias-label-primary);font-weight:600;display:block;margin:0 0 4px}',
      '.' + ROOT_CLASS + '_choices{display:flex;flex-wrap:wrap;gap:4px}',
      '.' + ROOT_CLASS + '_choice{box-sizing:border-box;padding:2px 8px;border:0;border-radius:var(--dsw-radius-sm,6px);background:0 0;',
      'color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}',
      '.' + ROOT_CLASS + '_choice:hover,.' + ROOT_CLASS + '_choice[aria-pressed=true]{',
      'background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}',
      '.' + ROOT_CLASS + '_choice[aria-pressed=true]{font-weight:600}',
      '.' + ROOT_CLASS + '_choice:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)));outline-offset:1px}',
      '.' + ROOT_CLASS + '_fxRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.' + ROOT_CLASS + '_fxInput{box-sizing:border-box;width:88px;padding:2px 6px;border-radius:var(--dsw-radius-sm,6px);',
      'border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}',
      '.' + ROOT_CLASS + '_fxHint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin:4px 0 0}',
      '.' + ROOT_CLASS + '_back{display:inline-flex;align-items:center;gap:6px;padding:2px 0;border:0;background:0 0;',
      'color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;line-height:16px;cursor:pointer}',
      '.' + ROOT_CLASS + '_back:hover{text-decoration:underline}',
      '.' + ROOT_CLASS + '_back:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)));outline-offset:1px}',
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

    //#region preferences (localStorage, language override, display currency)
    const SETTINGS_KEY = 'dsh-token-cost.settings.v1';
    const DEFAULT_SETTINGS = { language: 'auto', currency: 'native', fxRate: 7.2 };
    const LANGUAGES = ['auto', 'zh', 'en'];
    const CURRENCIES = ['native', 'CNY', 'USD'];
    /** Sanity bounds of the user-editable USD->CNY rate. */
    const FX_MIN = 0.0001;
    const FX_MAX = 10000;

    /** Symbol of a display currency; CNY and USD are the supported pair. */
    function symbolForCurrency(currency) {
      return currency === 'USD' ? '$' : '¥';
    }

    function interpolate(template, params) {
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
    }

    /** FX numbers: localized, up to 4 decimals trimmed but at least 2 decimals. */
    function formatFxRate(rate) {
      const value = Math.min(FX_MAX, Math.max(FX_MIN, numberOf(rate)));
      try {
        return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
      } catch {
        const fixed = value.toFixed(4);
        let trimmed = fixed;
        if (fixed.indexOf('.') >= 0) {
          trimmed = fixed.replace(/0+$/, '');
          if (trimmed.endsWith('.')) trimmed += '00';
          const decimals = trimmed.length - trimmed.indexOf('.') - 1;
          if (decimals < 2) trimmed += '0'.repeat(2 - decimals);
        }
        return trimmed;
      }
    }

    /** Validate a stored settings object; unknown/malformed values fall back to defaults. */
    function normalizeSettings(raw) {
      if (!isRecord(raw)) return Object.assign({}, DEFAULT_SETTINGS);
      let fxRate = DEFAULT_SETTINGS.fxRate;
      if (typeof raw.fxRate === 'number' && Number.isFinite(raw.fxRate) && raw.fxRate > 0) {
        fxRate = Math.min(FX_MAX, Math.max(FX_MIN, raw.fxRate));
      }
      return {
        language: LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_SETTINGS.language,
        currency: CURRENCIES.includes(raw.currency) ? raw.currency : DEFAULT_SETTINGS.currency,
        fxRate,
      };
    }

    /** Read persisted preferences; a missing, blocked or malformed storage yields defaults. */
    function readSettings() {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return Object.assign({}, DEFAULT_SETTINGS);
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (typeof raw !== 'string' || raw === '') return Object.assign({}, DEFAULT_SETTINGS);
        return normalizeSettings(JSON.parse(raw));
      } catch {
        return Object.assign({}, DEFAULT_SETTINGS);
      }
    }

    /** Persist preferences; a blocked storage only costs persistence, never rendering. */
    function writeSettings(settings) {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // Best effort: the in-memory preference still applies for this session.
      }
    }

    /** Resolve the UI translator: 'auto' delegates to the app-provided `t`. */
    function makeTranslator(language, appT) {
      const dict = language === 'auto' ? null : language === 'zh' ? zh : en;
      if (dict === null) {
        if (typeof appT === 'function') return appT;
        return (key, params) => {
          const template = zh[key];
          return template === undefined ? key : interpolate(template, params);
        };
      }
      return (key, params) => {
        const template = dict[key];
        if (template === undefined) return typeof appT === 'function' ? appT(key, params) : key;
        return interpolate(template, params);
      };
    }

    /**
     * Convert an integer micro-amount from its source currency into the target
     * display currency. Only the CNY <-> USD pair is defined; an amount of an
     * unknown currency is left unchanged because no exchange rate exists for it.
     */
    function convertMicro(micro, sourceCurrency, targetCurrency, fxRate) {
      const amount = numberOf(micro);
      if (targetCurrency === 'native' || sourceCurrency === targetCurrency) return amount;
      if (sourceCurrency === 'USD' && targetCurrency === 'CNY') return Math.round(amount * fxRate);
      if (sourceCurrency === 'CNY' && targetCurrency === 'USD') return Math.round(amount / fxRate);
      return amount;
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
      if (!isRecord(value)) return null;
      if (!Array.isArray(value.currencies)) {
        // Legacy single-currency view pushed by the previous Host build (a tab
        // that stayed open across the upgrade). Upgrade it in place so the pill
        // keeps rendering until the browser is reloaded.
        if (typeof value.micro !== 'number') return null;
        const legacyCurrency = normalizeCurrency({
          code: isRecord(value.currency) && typeof value.currency.code === 'string' ? value.currency.code : 'CNY',
          symbol: isRecord(value.currency) && typeof value.currency.symbol === 'string' ? value.currency.symbol : undefined,
          micro: value.micro,
          tokens: value.tokens,
          micros: value.micros,
          saving: value.saving,
          peakMicro: value.peakMicro,
          offPeakMicro: value.offPeakMicro,
        });
        if (legacyCurrency === null) return null;
        const legacyModels = [];
        if (Array.isArray(value.models)) {
          for (const entry of value.models) {
            const model = normalizeModel(entry, { code: legacyCurrency.code, symbol: legacyCurrency.symbol });
            if (model !== null) legacyModels.push(model);
          }
        }
        const legacyTokens = readTokens(value.tokens);
        let legacyUnpriced = 0;
        for (const model of legacyModels) if (!model.priced) legacyUnpriced += model.tokensTotal;
        return {
          currencies: [legacyCurrency],
          models: legacyModels,
          tokens: legacyTokens,
          tokensTotal: sumTokens(legacyTokens),
          unpricedTokens: legacyUnpriced,
          unpricedModels: [],
          lastUpdated: null,
        };
      }
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

    /** Pill / dialog-title amount: per-currency native totals, or one converted total. */
    function amountLabel(view, t, settings) {
      const used = usedCurrencies(view);
      if (used.length === 0) return t('pill.unpriced');
      if (settings.currency === 'native') {
        return used.map((currency) => symbolOf(currency) + formatMoney(currency.micro)).join(' · ');
      }
      let total = 0;
      for (const currency of used) total += convertMicro(currency.micro, currency.code, settings.currency, settings.fxRate);
      return symbolForCurrency(settings.currency) + formatMoney(total);
    }

    /** Tab label amount for one model, in the configured display currency. */
    function modelAmountText(model, settings) {
      if (!model.priced) return null;
      if (settings.currency === 'native') return symbolOf(model.currency) + formatMoney(model.micro);
      const sourceCurrency = model.currency === null ? settings.currency : model.currency.code;
      return symbolForCurrency(settings.currency) + formatMoney(convertMicro(model.micro, sourceCurrency, settings.currency, settings.fxRate));
    }

    /** Convert one bucket/band micro-amount of a model into the display currency. */
    function displayMicro(model, micro, settings) {
      if (settings.currency === 'native') return numberOf(micro);
      const sourceCurrency = model.currency === null ? settings.currency : model.currency.code;
      return convertMicro(micro, sourceCurrency, settings.currency, settings.fxRate);
    }

    /** Symbol used for a model's money in the configured display currency. */
    function modelSymbol(model, settings) {
      return settings.currency === 'native' ? symbolOf(model.currency) : symbolForCurrency(settings.currency);
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

    /** One model tab: only the billing dimensions that model actually has. */
    function ModelDetails(props) {
      const { model, t, settings } = props;
      const tokens = model.tokens;
      const micros = model.micros ?? { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
      const symbol = modelSymbol(model, settings);
      const costOf = (bucket) => (model.priced ? ' · ' + symbol + formatMoney(displayMicro(model, micros[bucket], settings)) : '');
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
        bandRows.push(h(DetailRow, { key: 'peak', label: t('band.peak') }, symbol + formatMoney(displayMicro(model, model.peakMicro, settings))));
      }
      if (model.offPeakMicro !== null) {
        bandRows.push(h(DetailRow, { key: 'offPeak', label: t('band.offPeak') }, symbol + formatMoney(displayMicro(model, model.offPeakMicro, settings))));
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
              model.asOf === null
                ? null
                : h(
                    'span',
                    { className: ROOT_CLASS + '_asOf', 'data-token-cost-asof': true },
                    t('link.asOf', { date: model.asOf }),
                  ),
            )
          : null;

      return h(
        React.Fragment,
        null,
        meta === '' ? null : h('div', { className: ROOT_CLASS + '_meta', 'data-token-cost-model-meta': true }, meta),
        h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-tokens': true }, rows),
        model.priced ? null : h('div', { className: ROOT_CLASS + '_unpriced', 'data-token-cost-unpriced': true }, t('row.unpriced')),
        model.priced && bandRows.length === 0 ? h('div', { className: ROOT_CLASS + '_flatNote', 'data-token-cost-flat': true }, t('note.flat')) : null,
        bandRows.length === 0 ? null : Divider(),
        bandRows.length === 0 ? null : h('dl', { className: ROOT_CLASS + '_details', 'data-token-cost-bands': true }, bandRows),
        link === null ? null : Divider(),
        link,
      );
    }

    function SettingsIcon(props) {
      return h(
        'svg',
        Object.assign({ viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', 'aria-hidden': true }, props ?? {}),
        h('circle', { cx: 8, cy: 8, r: 2.15, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', {
          d: 'M8 1.5v2.1M8 12.4v2.1M1.5 8h2.1M12.4 8h2.1M3.4 3.4l1.5 1.5M11.1 11.1l1.5 1.5M12.6 3.4l-1.5 1.5M4.9 11.1l-1.5 1.5',
          stroke: 'currentColor',
          strokeWidth: 1.1,
          strokeLinecap: 'round',
        }),
      );
    }

    /** One labelled row of exclusive choice buttons (aria-pressed = selected). */
    function ChoiceGroup(props) {
      const { label, marker, options, value, onSelect } = props;
      return h(
        'div',
        { className: ROOT_CLASS + '_settingGroup' },
        h('span', { className: ROOT_CLASS + '_settingLabel' }, label),
        h(
          'div',
          { className: ROOT_CLASS + '_choices', role: 'group', 'aria-label': label },
          options.map((option) =>
            h(
              'button',
              {
                key: option.value,
                type: 'button',
                className: ROOT_CLASS + '_choice',
                'aria-pressed': option.value === value,
                ['data-token-cost-' + marker]: option.value,
                onClick: () => onSelect(option.value),
              },
              option.label,
            ),
          ),
        ),
      );
    }

    /** In-dialog settings: UI language, display currency and the USD->CNY rate. */
    function SettingsPanel(props) {
      const { t, settings, updateSettings, onBack } = props;
      const [fxDraft, setFxDraft] = React.useState(() => String(settings.fxRate));
      const onFxChange = (event) => {
        const raw = event !== null && typeof event === 'object' && event.target !== undefined ? event.target.value : '';
        const text = typeof raw === 'string' ? raw : String(raw ?? '');
        setFxDraft(text);
        if (text.trim() === '') return;
        const parsed = Number(text);
        // Invalid or non-positive input stays in the field but is never persisted.
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        updateSettings({ fxRate: Math.min(FX_MAX, Math.max(FX_MIN, parsed)) });
      };
      const languageOptions = LANGUAGES.map((value) => ({
        value,
        label: t(value === 'auto' ? 'language.auto' : value === 'zh' ? 'language.zh' : 'language.en'),
      }));
      const currencyOptions = CURRENCIES.map((value) => ({
        value,
        label: t(value === 'native' ? 'currency.native' : value === 'CNY' ? 'currency.CNY' : 'currency.USD'),
      }));
      return h(
        'div',
        { className: ROOT_CLASS + '_settings', 'data-token-cost-settings': true },
        h('div', { className: ROOT_CLASS + '_settingsHeading' }, t('settings.title')),
        h(ChoiceGroup, {
          label: t('settings.language'),
          marker: 'language',
          options: languageOptions,
          value: settings.language,
          onSelect: (language) => updateSettings({ language }),
        }),
        h(ChoiceGroup, {
          label: t('settings.currency'),
          marker: 'currency',
          options: currencyOptions,
          value: settings.currency,
          onSelect: (currency) => updateSettings({ currency }),
        }),
        h(
          'div',
          { className: ROOT_CLASS + '_settingGroup' },
          h('span', { className: ROOT_CLASS + '_settingLabel' }, t('fx.label')),
          h(
            'div',
            { className: ROOT_CLASS + '_fxRow' },
            h('input', {
              type: 'number',
              className: ROOT_CLASS + '_fxInput',
              step: 0.01,
              min: FX_MIN,
              max: FX_MAX,
              inputMode: 'decimal',
              value: fxDraft,
              'aria-label': t('fx.label'),
              'data-token-cost-fx-input': true,
              onChange: onFxChange,
            }),
          ),
          h('div', { className: ROOT_CLASS + '_fxHint' }, t('fx.hint')),
        ),
        Divider(),
        h(
          'button',
          { type: 'button', className: ROOT_CLASS + '_back', 'data-token-cost-settings-back': true, onClick: onBack },
          t('settings.back'),
        ),
      );
    }

    /** Dialog body: title row (total + settings), tabs, active model panel. */
    function CostBody(props) {
      const { view, t, settings, updateSettings } = props;
      const models = view.models;
      const tabCount = models.length;
      const [active, setActive] = React.useState(0);
      const [screen, setScreen] = React.useState('details');
      // The models list may shrink while the dialog is open (a provider fold
      // changing the projection); clamp instead of indexing out of range.
      const index = tabCount === 0 ? 0 : Math.min(Math.max(0, Math.floor(numberOf(active))), tabCount - 1);
      const showSettings = screen === 'settings';

      const select = (next) => setActive(next);
      const onKeyDown = (event) => {
        if (tabCount === 0 || event === null || typeof event !== 'object') return;
        let next = -1;
        if (event.key === 'ArrowRight') next = (index + 1) % tabCount;
        else if (event.key === 'ArrowLeft') next = (index + tabCount - 1) % tabCount;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabCount - 1;
        if (next < 0) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        select(next);
      };

      const tabs = [];
      models.forEach((model, position) => {
        tabs.push(
          h(
            'button',
            {
              key: 'model-' + position + '-' + model.key,
              type: 'button',
              role: 'tab',
              className: ROOT_CLASS + '_tab',
              'aria-selected': index === position,
              tabIndex: index === position ? 0 : -1,
              title: model.name,
              'data-token-cost-tab': model.key,
              onClick: () => select(position),
            },
            h('span', { className: ROOT_CLASS + '_tabName' }, model.name),
            model.priced ? h('span', { className: ROOT_CLASS + '_tabAmount' }, modelAmountText(model, settings)) : null,
          ),
        );
      });

      const content = tabCount === 0 ? null : h(ModelDetails, { model: models[index], t, settings });

      const details = h(
        React.Fragment,
        null,
        h('div', { role: 'tablist', 'aria-label': t('tabs.aria'), className: ROOT_CLASS + '_tabs', onKeyDown }, tabs),
        Divider(),
        h('div', { role: 'tabpanel', className: ROOT_CLASS + '_tabPanel', 'data-token-cost-tabpanel': true }, content),
      );

      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: ROOT_CLASS + '_title' },
          h('span', { className: ROOT_CLASS + '_titleLabel' }, h(CostIcon), t('dialog.title')),
          h(
            'span',
            { className: ROOT_CLASS + '_titleActions' },
            h('span', { className: ROOT_CLASS + '_titleValue', 'data-token-cost-title-value': true }, amountLabel(view, t, settings)),
            h(
              'button',
              {
                type: 'button',
                className: ROOT_CLASS + '_gear',
                'aria-label': t('settings.open'),
                'aria-expanded': showSettings,
                'data-token-cost-settings-toggle': true,
                onClick: () => setScreen(showSettings ? 'details' : 'settings'),
              },
              h(SettingsIcon),
            ),
          ),
        ),
        settings.currency === 'native'
          ? null
          : h('div', { className: ROOT_CLASS + '_fxLine', 'data-token-cost-fx': true }, t('fx.line', { rate: formatFxRate(settings.fxRate) })),
        Divider(),
        showSettings
          ? h(SettingsPanel, { t, settings, updateSettings, onBack: () => setScreen('details') })
          : details,
      );
    }

    function CostTrigger(props) {
      const { view, t, settings, updateSettings } = props;
      const [open, setOpen] = React.useState(false);
      const [pos, setPos] = React.useState(null);
      const rootRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const unpricedOnly = usedCurrencies(view).length === 0;
      const amount = amountLabel(view, t, settings);
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
              h(CostBody, { view, t, settings, updateSettings }),
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
      const [settings, setSettings] = React.useState(readSettings);
      const updateSettings = (patch) => {
        setSettings((previous) => {
          const next = normalizeSettings(Object.assign({}, previous, patch));
          writeSettings(next);
          return next;
        });
      };
      if (view === null || !hasUsage(view)) return null;
      const t = makeTranslator(settings.language, props.t);
      return h(CostTrigger, { view, t, settings, updateSettings });
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
