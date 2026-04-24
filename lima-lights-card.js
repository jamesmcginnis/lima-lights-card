/**
 * Lima Lights Card
 * Compact pill card showing how many lights are on across multiple entities.
 * Click pill → light overview popup with full controls
 * Click light pill → individual light control popup (on/off, brightness, colour temp)
 * GitHub: https://github.com/jamesmcginnis/lima-lights-card
 */

// ─── Default colour presets for the HomeKit-style colour picker ──────────────
const LIMA_DEFAULT_PRESETS = [
  { label: 'Candle',   rgb: [255, 147,  41] },
  { label: 'Warm',     rgb: [255, 180, 107] },
  { label: 'Neutral',  rgb: [255, 235, 200] },
  { label: 'White',    rgb: [255, 255, 255] },
  { label: 'Daylight', rgb: [220, 235, 255] },
  { label: 'Cool',     rgb: [180, 215, 255] },
  { label: 'Red',      rgb: [255,  50,  50] },
  { label: 'Orange',   rgb: [255, 130,   0] },
  { label: 'Yellow',   rgb: [255, 215,   0] },
  { label: 'Lime',     rgb: [100, 220,   0] },
  { label: 'Green',    rgb: [  0, 190,  80] },
  { label: 'Teal',     rgb: [  0, 200, 180] },
  { label: 'Cyan',     rgb: [  0, 190, 255] },
  { label: 'Blue',     rgb: [ 50, 100, 255] },
  { label: 'Violet',   rgb: [180,  50, 255] },
  { label: 'Pink',     rgb: [255,  80, 160] },
  { label: 'Rose',     rgb: [255, 100, 130] },
  { label: 'Mint',     rgb: [ 60, 220, 170] },
  { label: 'Sky',      rgb: [100, 180, 255] },
  { label: 'Lavender', rgb: [170, 130, 255] },
];

// ─── Editor: Colour field definitions ────────────────────────────────────────
const LIMA_COLOUR_FIELDS = [
  { key: 'pill_bg',      label: 'Pill Background',  desc: 'Background colour of the main pill card.',                default: '#1c1c1e' },
  { key: 'text_color',   label: 'Text',              desc: 'Primary text colour for labels and values.',              default: '#ffffff' },
  { key: 'accent_color', label: 'Accent',            desc: 'Highlight colour used for active states and controls.',   default: '#FFD60A' },
  { key: 'fill_color',   label: 'Pill Fill',         desc: 'Colour of the fill bar shown when lights are on.',        default: '#FFD60A' },
  { key: 'on_color',     label: 'Light On',          desc: 'Colour used to indicate a light is on.',                 default: '#FFD60A' },
  { key: 'off_color',    label: 'Light Off',         desc: 'Colour used to indicate a light is off.',                default: '#48484A' },
  { key: 'popup_bg',     label: 'Popup Background',  desc: 'Background colour of all popup dialogs.',                default: '#1c1c1e' },
  { key: 'icon_color',   label: 'Bulb Icon',         desc: 'Colour of the bulb icon on the pill card.',              default: '#FFD60A' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Main Card
// ─────────────────────────────────────────────────────────────────────────────
class LimaLightsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._popupOverlay = null;
    this._lightPopup   = null;
  }

  static getConfigElement() {
    return document.createElement('lima-lights-card-editor');
  }

  static getStubConfig() {
    return {
      type:           'custom:lima-lights-card',
      entities:       [],
      title:          '',
      group_by_area:  false,
      accent_color:   '#FFD60A',
      fill_color:     '#FFD60A',
      on_color:       '#FFD60A',
      off_color:      '#48484A',
      pill_bg:        '#1c1c1e',
      text_color:     '#ffffff',
      popup_bg:       '#1c1c1e',
      icon_color:     '#FFD60A',
    };
  }

  setConfig(config) {
    this._config = {
      title:          '',
      group_by_area:  false,
      accent_color:   '#FFD60A',
      fill_color:     '#FFD60A',
      on_color:       '#FFD60A',
      off_color:      '#48484A',
      pill_bg:        '#1c1c1e',
      text_color:     '#ffffff',
      popup_bg:       '#1c1c1e',
      icon_color:     '#FFD60A',
      ...config
    };
    if (this.shadowRoot.innerHTML) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) this._render();
    else {
      this._update();
      if (this._refreshOverview)   this._refreshOverview();
      if (this._refreshLightPopup) this._refreshLightPopup();
    }
  }

  connectedCallback() {}
  disconnectedCallback() {}

  getCardSize() { return 1; }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _entities() {
    return (this._config.entities || []).filter(e => e && this._hass?.states[e]);
  }

  _isOn(entityId) {
    return this._hass?.states[entityId]?.state === 'on';
  }

  _brightness(entityId) {
    const b = this._hass?.states[entityId]?.attributes?.brightness;
    return b !== undefined ? Math.round(b / 2.55) : null;
  }

  _colorTemp(entityId) {
    return this._hass?.states[entityId]?.attributes?.color_temp_kelvin ?? null;
  }

  _minColorTemp(entityId) {
    return this._hass?.states[entityId]?.attributes?.min_color_temp_kelvin ?? 2700;
  }

  _maxColorTemp(entityId) {
    return this._hass?.states[entityId]?.attributes?.max_color_temp_kelvin ?? 6500;
  }

  _supportsColorTemp(entityId) {
    const feats = this._hass?.states[entityId]?.attributes?.supported_color_modes || [];
    return feats.includes('color_temp');
  }

  _supportsBrightness(entityId) {
    const feats = this._hass?.states[entityId]?.attributes?.supported_color_modes || [];
    const feat  = this._hass?.states[entityId]?.attributes?.supported_features || 0;
    return feats.length > 0 || (feat & 1) !== 0;
  }

  _supportsRgb(entityId) {
    const modes = this._hass?.states[entityId]?.attributes?.supported_color_modes || [];
    return modes.some(m => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m));
  }

  _getRgbColor(entityId) {
    return this._hass?.states[entityId]?.attributes?.rgb_color ?? null;
  }

  _name(entityId) {
    const fn = this._config.friendly_names?.[entityId];
    if (fn) return fn;
    const s = this._hass?.states[entityId];
    if (!s) return entityId;
    return s.attributes?.friendly_name || entityId.split('.').pop().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  _getAreaForEntity(entityId) {
    if (!this._hass) return null;
    const entityReg = this._hass.entities?.[entityId];
    if (!entityReg) return null;
    let areaId = entityReg.area_id;
    if (!areaId && entityReg.device_id) {
      areaId = this._hass.devices?.[entityReg.device_id]?.area_id;
    }
    if (!areaId) return null;
    return this._hass.areas?.[areaId]?.name || areaId;
  }

  _hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '255,214,10';
  }

  _haFont() {
    return getComputedStyle(this).fontFamily || 'inherit';
  }

  _callService(domain, service, data) {
    return this._hass.callService(domain, service, data);
  }

  // ── Render main pill card ─────────────────────────────────────────────────

  _render() {
    const cfg = this._config;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: inherit; }
        ha-card {
          height: 56px;
          border-radius: 28px;
          background: ${cfg.pill_bg || '#1c1c1e'};
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0 18px;
          gap: 12px;
          overflow: hidden;
          position: relative;
          box-sizing: border-box;
          transition: transform 0.15s ease;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 2px 12px rgba(0,0,0,0.35);
        }
        ha-card:active { transform: scale(0.97); }
        #pill-fill {
          position: absolute; left: 0; top: 0; bottom: 0;
          border-radius: 28px 0 0 28px; pointer-events: none; width: 0%;
          background: rgba(${this._hexToRgb(cfg.fill_color || cfg.accent_color || '#FFD60A')}, 0.22);
          transition: width 0.5s cubic-bezier(0.4,0,0.2,1), border-radius 0.3s ease;
        }
        .icon-wrap {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: rgba(${this._hexToRgb(cfg.icon_color || '#FFD60A')}, 0.15);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .icon-wrap svg { display: block; }
        .content { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .label { font-size: 13px; color: ${cfg.text_color || '#fff'}; opacity: 0.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
        .count { font-size: 14px; color: ${cfg.text_color || '#fff'}; white-space: nowrap; letter-spacing: -0.3px; }
        .no-entities { font-size: 12px; color: rgba(255,255,255,0.35); }
      </style>
      <ha-card id="mainCard">
        <div id="pill-fill"></div>
        <div class="icon-wrap" id="iconWrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${cfg.icon_color || '#FFD60A'}">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.73-1.56 5.1-3.84 6.34L14 17H10l-.16-1.66A7 7 0 0 1 5 9a7 7 0 0 1 7-7zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-1-2h6v1H9v-1z"/>
          </svg>
        </div>
        <div class="content" id="content">
          <span class="no-entities">Select entities in editor</span>
        </div>
      </ha-card>`;

    this.shadowRoot.getElementById('mainCard').addEventListener('click', () => this._openOverviewPopup());
    this.shadowRoot.getElementById('iconWrap').addEventListener('click', e => {
      e.stopPropagation();
      this._openToggleAllConfirm();
    });
    this._update();
  }

  _update() {
    const content  = this.shadowRoot.getElementById('content');
    if (!content) return;
    const entities = this._entities();
    const cfg      = this._config;

    if (!entities.length) {
      content.innerHTML = `<span class="no-entities">Select entities in editor</span>`;
      return;
    }

    const onCount  = entities.filter(e => this._isOn(e)).length;
    const total    = entities.length;
    const label    = (cfg.title || '').trim();
    const countTxt = onCount === 0
      ? 'All Off'
      : onCount === total
        ? `All On`
        : `${onCount} of ${total} On`;

    content.innerHTML = label
      ? `<span class="label">${label}</span><span class="count">${countTxt}</span>`
      : `<span class="count">${countTxt}</span>`;

    const fillEl = this.shadowRoot.getElementById('pill-fill');
    if (fillEl) {
      fillEl.style.width        = `${Math.round((onCount / total) * 100)}%`;
      fillEl.style.borderRadius = onCount === total ? '28px' : '28px 0 0 28px';
    }
  }

  // ── Toggle-all confirmation dialog ───────────────────────────────────────

  _openToggleAllConfirm() {
    const entities = this._entities();
    if (!entities.length) return;
    const onCount  = entities.filter(e => this._isOn(e)).length;
    const cfg      = this._config;
    const accent   = cfg.accent_color || '#FFD60A';
    const popupBg  = cfg.popup_bg     || '#1c1c1e';
    const textCol  = cfg.text_color   || '#ffffff';

    const willTurnOff = onCount > 0;
    const actionCount = willTurnOff ? onCount : entities.length;
    const actionColor = willTurnOff ? '#FF6432' : accent;
    const actionText  = willTurnOff ? 'Turn Off' : 'Turn On';

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,0.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);`;

    const style = document.createElement('style');
    style.textContent = `@keyframes limaConfirmPop { from{transform:scale(0.92);opacity:0} to{transform:none;opacity:1} } .lima-confirm-popup { animation: limaConfirmPop 0.22s cubic-bezier(0.34,1.28,0.64,1); }`;

    const popup = document.createElement('div');
    popup.className = 'lima-confirm-popup';
    popup.style.cssText = `background:${popupBg};border:1px solid rgba(255,255,255,0.13);border-radius:26px;padding:28px 24px 24px;width:100%;max-width:300px;font-family:${this._haFont()};color:${textCol};text-align:center;box-shadow:0 28px 72px rgba(0,0,0,0.7);`;

    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `width:56px;height:56px;border-radius:50%;background:${actionColor}22;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;`;
    iconWrap.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="${actionColor}"><path d="M12 2a7 7 0 0 1 7 7c0 2.73-1.56 5.1-3.84 6.34L14 17H10l-.16-1.66A7 7 0 0 1 5 9a7 7 0 0 1 7-7zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-1-2h6v1H9v-1z"/></svg>`;

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px;font-weight:700;color:${textCol};margin-bottom:10px;`;
    title.textContent = willTurnOff
      ? `Turn off ${actionCount} light${actionCount !== 1 ? 's' : ''}?`
      : `Turn on all ${actionCount} light${actionCount !== 1 ? 's' : ''}?`;

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:26px;line-height:1.6;`;
    subtitle.textContent = willTurnOff
      ? `${actionCount === entities.length ? 'All' : actionCount} light${actionCount !== 1 ? 's are' : ' is'} currently on. Ready to switch ${actionCount !== 1 ? 'them' : 'it'} off?`
      : `All ${actionCount} light${actionCount !== 1 ? 's are' : ' is'} off. Ready to switch ${actionCount !== 1 ? 'them' : 'it'} all on?`;

    const btnsRow = document.createElement('div');
    btnsRow.style.cssText = 'display:flex;gap:10px;';

    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = `flex:1;padding:14px 8px;border-radius:14px;border:none;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:background 0.15s;`;
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = 'rgba(255,255,255,0.16)'; });
    cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'rgba(255,255,255,0.1)'; });

    const confirmBtn = document.createElement('button');
    confirmBtn.style.cssText = `flex:1;padding:14px 8px;border-radius:14px;border:none;background:${actionColor};color:${willTurnOff ? '#fff' : '#000'};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity 0.15s;`;
    confirmBtn.textContent = actionText;
    confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.opacity = '0.85'; });
    confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.opacity = '1'; });
    confirmBtn.addEventListener('click', () => {
      close();
      if (willTurnOff) {
        entities.filter(e => this._isOn(e)).forEach(id => this._callService('light', 'turn_off', { entity_id: id }));
      } else {
        entities.forEach(id => this._callService('light', 'turn_on', { entity_id: id }));
      }
    });

    btnsRow.appendChild(cancelBtn);
    btnsRow.appendChild(confirmBtn);
    popup.appendChild(iconWrap);
    popup.appendChild(title);
    popup.appendChild(subtitle);
    popup.appendChild(btnsRow);
    overlay.appendChild(style);
    overlay.appendChild(popup);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  // ── Overview Popup ────────────────────────────────────────────────────────

  _openOverviewPopup() {
    if (this._popupOverlay) return;
    const entities = this._entities();
    const cfg      = this._config;
    if (!entities.length) return;

    const popupBg = cfg.popup_bg     || '#1c1c1e';
    const accent  = cfg.accent_color || '#FFD60A';
    const textCol = cfg.text_color   || '#ffffff';
    const onCol   = cfg.on_color     || '#FFD60A';

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,0.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);`;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes limaFadeIn  { from{opacity:0} to{opacity:1} }
      @keyframes limaSlideUp { from{transform:translateY(24px) scale(0.97);opacity:0} to{transform:none;opacity:1} }
      .lima-popup   { animation: limaSlideUp 0.28s cubic-bezier(0.34,1.28,0.64,1); }
      #lima-overlay { animation: limaFadeIn 0.2s ease; }
      .lima-light-pill {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 14px 10px; border-radius: 20px; cursor: pointer;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        transition: transform 0.15s ease, background 0.15s ease, border-color 0.2s, opacity 0.2s;
        min-width: 0; flex: 1; gap: 6px; position: relative;
        user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
        touch-action: none;
        font-family: var(--primary-font-family, inherit);
      }
      .lima-light-pill.is-on  { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
      .lima-light-pill.pressing { transform: scale(0.93); }
      .lima-pill-name { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-align: center; letter-spacing: 0.02em; line-height: 1.3; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lima-close-btn:hover { background:rgba(255,255,255,0.22)!important; }
      .lima-all-btn { flex:1; padding:11px 8px; border-radius:12px; border:none; cursor:pointer; font-size:13px; font-weight:600; transition:background 0.15s,opacity 0.15s; font-family:inherit; }
      .lima-all-btn:active { opacity:0.75; }
    `;

    const popup = document.createElement('div');
    popup.className = 'lima-popup';
    popup.style.cssText = `background:${popupBg};backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);border:1px solid rgba(255,255,255,0.13);border-radius:28px;box-shadow:0 28px 72px rgba(0,0,0,0.65);padding:20px;width:100%;max-width:420px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;color:${textCol};font-family:${this._haFont()};`;

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;';
    headerRow.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:28px;height:28px;border-radius:50%;background:${accent}22;display:flex;align-items:center;justify-content:center;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${accent}"><path d="M12 2a7 7 0 0 1 7 7c0 2.73-1.56 5.1-3.84 6.34L14 17H10l-.16-1.66A7 7 0 0 1 5 9a7 7 0 0 1 7-7zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-1-2h6v1H9v-1z"/></svg>
        </div>
        <span style="font-size:15px;font-weight:700;color:${textCol};">${cfg.title || 'Lights'}</span>
      </div>
      <button class="lima-close-btn" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.65);font-size:16px;line-height:1;padding:0;transition:background 0.15s;flex-shrink:0;">✕</button>`;
    headerRow.querySelector('.lima-close-btn').addEventListener('click', () => this._closeOverviewPopup());

    // Pill map — keyed by entityId, holds references to DOM nodes for live updates
    const pillMap = new Map(); // entityId → { pill, svg, briEl }

    // Stats row references for live update
    const onStatValueEl  = document.createElement('div');
    const offStatValueEl = document.createElement('div');
    onStatValueEl.style.cssText  = `font-size:17px;font-weight:700;letter-spacing:-0.3px;color:${textCol};`;
    offStatValueEl.style.cssText = `font-size:17px;font-weight:700;letter-spacing:-0.3px;color:${textCol};`;

    // Live refresh — called by hass setter when state changes
    const refreshOverview = () => {
      const onCount  = entities.filter(e => this._isOn(e)).length;
      const offCount = entities.length - onCount;
      onStatValueEl.textContent  = `${onCount} / ${entities.length}`;
      offStatValueEl.textContent = `${offCount} / ${entities.length}`;

      pillMap.forEach(({ pill, svg, briEl }, entityId) => {
        const isOn       = this._isOn(entityId);
        pill.dataset.optimisticOn = String(isOn);
        const bri        = this._brightness(entityId);
        const rgb        = this._hass?.states[entityId]?.attributes?.rgb_color;
        const pillColour = (isOn && rgb) ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : onCol;
        pill.classList.toggle('is-on', isOn);
        if (isOn) {
          pill.style.background  = `rgba(${rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '255,255,255'},0.12)`;
          pill.style.borderColor = `rgba(${rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '255,255,255'},0.35)`;
        } else {
          pill.style.background  = '';
          pill.style.borderColor = '';
        }
        svg.setAttribute('fill', isOn ? pillColour : 'rgba(255,255,255,0.2)');
        briEl.style.color = isOn ? pillColour : 'rgba(255,255,255,0.25)';
        briEl.textContent = isOn ? (bri !== null ? `${bri}%` : 'On') : 'Off';
      });
    };
    this._refreshOverview = refreshOverview;

    // Build pills
    const pillsLabel = document.createElement('div');
    pillsLabel.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:10px;';
    pillsLabel.textContent = `${entities.length} Light${entities.length !== 1 ? 's' : ''}`;

    // ── Local helper: build a single pill element ─────────────────────────
    const buildPill = (entityId) => {
      const isOn = this._isOn(entityId);
      const name = this._name(entityId);
      const bri  = this._brightness(entityId);
      const rgb  = this._hass?.states[entityId]?.attributes?.rgb_color;

      const pillColour = (isOn && rgb) ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : onCol;
      const iconColor  = isOn ? pillColour : 'rgba(255,255,255,0.2)';
      const pillBg     = isOn ? `rgba(${rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '255,255,255'},0.12)` : 'rgba(255,255,255,0.06)';
      const pillBorder = isOn ? `rgba(${rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '255,255,255'},0.35)` : 'rgba(255,255,255,0.1)';

      const pill = document.createElement('div');
      pill.className = `lima-light-pill${isOn ? ' is-on' : ''}`;
      if (isOn) { pill.style.background = pillBg; pill.style.borderColor = pillBorder; }

      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.setAttribute('width', '22'); svgEl.setAttribute('height', '22');
      svgEl.setAttribute('viewBox', '0 0 24 24'); svgEl.setAttribute('fill', iconColor);
      svgEl.style.cssText = 'display:block;flex-shrink:0;';
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', 'M12 2a7 7 0 0 1 7 7c0 2.73-1.56 5.1-3.84 6.34L14 17H10l-.16-1.66A7 7 0 0 1 5 9a7 7 0 0 1 7-7zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-1-2h6v1H9v-1z');
      svgEl.appendChild(pathEl);

      const briEl = document.createElement('div');
      briEl.style.cssText = `font-size:12px;font-weight:700;color:${isOn ? pillColour : 'rgba(255,255,255,0.25)'};line-height:1;`;
      briEl.textContent = isOn ? (bri !== null ? `${bri}%` : 'On') : 'Off';

      const nameEl = document.createElement('div');
      nameEl.className = 'lima-pill-name';
      nameEl.textContent = name;

      pill.appendChild(svgEl); pill.appendChild(briEl); pill.appendChild(nameEl);
      pill.dataset.entityId     = entityId;
      pill.dataset.optimisticOn = String(isOn);
      pillMap.set(entityId, { pill, svg: svgEl, briEl });

      // Mouse events (desktop)
      let longPressTimer = null;
      let didLongPress   = false;
      pill.addEventListener('mousedown', () => {
        didLongPress = false; pill.classList.add('pressing');
        longPressTimer = setTimeout(() => {
          didLongPress = true; pill.classList.remove('pressing');
          this._openLightPopup(pill.dataset.entityId);
        }, 500);
      });
      pill.addEventListener('mouseleave', () => { clearTimeout(longPressTimer); pill.classList.remove('pressing'); });
      pill.addEventListener('mouseup', () => {
        clearTimeout(longPressTimer); pill.classList.remove('pressing');
        if (!didLongPress) {
          const eid   = pill.dataset.entityId;
          const wasOn = pill.dataset.optimisticOn === 'true';
          const willOn = !wasOn;
          pill.dataset.optimisticOn = String(willOn);
          this._callService('light', willOn ? 'turn_on' : 'turn_off', { entity_id: eid });
          const ref = pillMap.get(eid);
          if (ref) {
            const rgb2 = this._hass?.states[eid]?.attributes?.rgb_color;
            const col  = (willOn && rgb2) ? `rgb(${rgb2[0]},${rgb2[1]},${rgb2[2]})` : onCol;
            ref.pill.classList.toggle('is-on', willOn);
            ref.pill.style.background  = willOn ? `rgba(${rgb2 ? `${rgb2[0]},${rgb2[1]},${rgb2[2]}` : '255,255,255'},0.12)` : '';
            ref.pill.style.borderColor = willOn ? `rgba(${rgb2 ? `${rgb2[0]},${rgb2[1]},${rgb2[2]}` : '255,255,255'},0.35)` : '';
            ref.svg.setAttribute('fill', willOn ? col : 'rgba(255,255,255,0.2)');
            ref.briEl.style.color = willOn ? col : 'rgba(255,255,255,0.25)';
            ref.briEl.textContent = willOn ? 'On' : 'Off';
          }
        }
      });
      return pill;
    };

    // ── Build pills container (flat or grouped by area) ───────────────────
    const pillsContainer = document.createElement('div');
    pillsContainer.style.cssText = 'margin-bottom:18px;';

    if (cfg.group_by_area) {
      // Group entities by their HA area
      const areaMap   = new Map(); // areaName → [entityId, ...]
      const ungrouped = [];
      entities.forEach(entityId => {
        const areaName = this._getAreaForEntity(entityId);
        if (areaName) {
          if (!areaMap.has(areaName)) areaMap.set(areaName, []);
          areaMap.get(areaName).push(entityId);
        } else {
          ungrouped.push(entityId);
        }
      });
      const sortedAreas = [...areaMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      if (ungrouped.length) sortedAreas.push(['No Area', ungrouped]);

      sortedAreas.forEach(([areaName, areaEntities], groupIdx) => {
        const areaHeader = document.createElement('div');
        areaHeader.style.cssText = `font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:8px;${groupIdx > 0 ? 'margin-top:16px;' : ''}`;
        areaHeader.textContent = areaName;
        pillsContainer.appendChild(areaHeader);

        const areaGrid = document.createElement('div');
        areaGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;';
        areaEntities.forEach(entityId => areaGrid.appendChild(buildPill(entityId)));
        pillsContainer.appendChild(areaGrid);
      });
    } else {
      // Original flat 3-column grid
      const pillsGrid = document.createElement('div');
      pillsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;';
      entities.forEach(entityId => pillsGrid.appendChild(buildPill(entityId)));
      pillsContainer.appendChild(pillsGrid);
    }

    // ── Single delegated touch handler on the container ───────────────────
    // Uses elementFromPoint at touchstart to identify the exact pill under
    // the finger — immune to browser touch re-targeting.
    let activePill      = null;
    let activeLongTimer = null;
    let activeDidLong   = false;
    let activeTouchStartY = 0;
    let activeLastTouchY  = 0;
    let activeTouchMoved  = false;

    const doToggle = (eid) => {
      const ref = pillMap.get(eid);
      if (!ref) return;
      const pill   = ref.pill;
      const wasOn  = pill.dataset.optimisticOn === 'true';
      const willOn = !wasOn;
      pill.dataset.optimisticOn = String(willOn);
      this._callService('light', willOn ? 'turn_on' : 'turn_off', { entity_id: eid });
      const rgb = this._hass?.states[eid]?.attributes?.rgb_color;
      const col = (willOn && rgb) ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : onCol;
      ref.pill.classList.toggle('is-on', willOn);
      ref.pill.style.background  = willOn ? `rgba(${rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '255,255,255'},0.12)` : '';
      ref.pill.style.borderColor = willOn ? `rgba(${rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '255,255,255'},0.35)` : '';
      ref.svg.setAttribute('fill', willOn ? col : 'rgba(255,255,255,0.2)');
      ref.briEl.style.color = willOn ? col : 'rgba(255,255,255,0.25)';
      ref.briEl.textContent = willOn ? 'On' : 'Off';
    };

    pillsContainer.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      // Use elementFromPoint to get the real element under the finger
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      activePill = el?.closest('[data-entity-id]');
      if (!activePill) return;

      activeDidLong      = false;
      activeTouchMoved   = false;
      activeTouchStartY  = touch.clientY;
      activeLastTouchY   = touch.clientY;

      activePill.classList.add('pressing');
      activeLongTimer = setTimeout(() => {
        activeDidLong = true;
        activePill.classList.remove('pressing');
        this._openLightPopup(activePill.dataset.entityId);
        activePill = null;
      }, 500);
    }, { passive: true });

    pillsContainer.addEventListener('touchmove', (e) => {
      if (!activePill) return;
      const currentY = e.touches[0].clientY;
      const dy = currentY - activeLastTouchY;
      activeLastTouchY = currentY;
      if (Math.abs(currentY - activeTouchStartY) > 8) {
        activeTouchMoved = true;
        clearTimeout(activeLongTimer);
        activePill.classList.remove('pressing');
        popup.scrollTop -= dy;
      }
    }, { passive: true });

    pillsContainer.addEventListener('touchend', (e) => {
      e.preventDefault();
      clearTimeout(activeLongTimer);
      if (activePill) {
        activePill.classList.remove('pressing');
        if (!activeTouchMoved && !activeDidLong) {
          doToggle(activePill.dataset.entityId);
        }
        activePill = null;
      }
    }, { passive: false });

    pillsContainer.addEventListener('touchcancel', () => {
      clearTimeout(activeLongTimer);
      if (activePill) { activePill.classList.remove('pressing'); activePill = null; }
      activeTouchMoved = false;
    }, { passive: true });

    // Stats row
    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:flex;gap:8px;margin-bottom:18px;';

    let activeFilter = null;

    const highlightPills = (mode) => {
      pillMap.forEach(({ pill }, entityId) => {
        const isOn = this._isOn(entityId);
        const match = mode === null || (mode === 'on' && isOn) || (mode === 'off' && !isOn);
        pill.style.outline       = (mode !== null && match) ? `2px solid ${accent}` : '';
        pill.style.outlineOffset = (mode !== null && match) ? '-2px' : '';
        pill.style.opacity       = (mode !== null && !match) ? '0.3' : '';
      });
    };

    const makeStatPill = (label, valueEl, mode) => {
      const el = document.createElement('div');
      el.style.cssText = `flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:10px 8px;text-align:center;cursor:pointer;transition:background 0.15s,border-color 0.15s;`;
      const labelDiv = document.createElement('div');
      labelDiv.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;';
      labelDiv.textContent = label;
      el.appendChild(labelDiv);
      el.appendChild(valueEl);
      el.classList.add('lima-stat-pill');
      el.dataset.mode = mode;
      el.addEventListener('mouseenter', () => { if (activeFilter !== mode) el.style.background = 'rgba(255,255,255,0.1)'; });
      el.addEventListener('mouseleave', () => { if (activeFilter !== mode) el.style.background = 'rgba(255,255,255,0.06)'; });
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        const newMode = activeFilter === mode ? null : mode;
        activeFilter = newMode;
        statsRow.querySelectorAll('.lima-stat-pill').forEach(p => {
          const active = p.dataset.mode === activeFilter;
          p.style.background  = active ? `${accent}33` : 'rgba(255,255,255,0.06)';
          p.style.borderColor = active ? accent         : 'rgba(255,255,255,0.08)';
        });
        highlightPills(activeFilter);
      });
      return el;
    };

    const onCount  = entities.filter(e => this._isOn(e)).length;
    const offCount = entities.length - onCount;
    onStatValueEl.textContent  = `${onCount} / ${entities.length}`;
    offStatValueEl.textContent = `${offCount} / ${entities.length}`;

    statsRow.appendChild(makeStatPill('On',  onStatValueEl,  'on'));
    statsRow.appendChild(makeStatPill('Off', offStatValueEl, 'off'));

    // All On / All Off buttons
    const allBtnsRow = document.createElement('div');
    allBtnsRow.style.cssText = 'display:flex;gap:8px;margin-top:2px;';

    // Flash the given entity pills 3 times, then call the service
    const flashAndAct = (entityIds, service) => {
      const pillRefs = entityIds.map(id => pillMap.get(id)).filter(Boolean);
      let count = 0;
      const timer = setInterval(() => {
        const bright = count % 2 === 0;
        pillRefs.forEach(({ pill }) => {
          pill.style.outline       = bright ? `2px solid ${accent}` : '';
          pill.style.outlineOffset = bright ? '-2px' : '';
          pill.style.opacity       = bright ? '1' : '0.25';
        });
        count++;
        if (count >= 6) {
          clearInterval(timer);
          pillRefs.forEach(({ pill }) => {
            pill.style.outline       = '';
            pill.style.outlineOffset = '';
            pill.style.opacity       = '';
          });
          entityIds.forEach(id => this._callService('light', service, { entity_id: id }));
        }
      }, 160);
    };

    const allOnBtn = document.createElement('button');
    allOnBtn.className = 'lima-all-btn';
    allOnBtn.style.cssText = `background:${accent};color:#000;`;
    allOnBtn.textContent = 'All On';
    allOnBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      const offEntities = entities.filter(id => !this._isOn(id));
      flashAndAct(offEntities.length ? offEntities : entities, 'turn_on');
    });

    const allOffBtn = document.createElement('button');
    allOffBtn.className = 'lima-all-btn';
    allOffBtn.style.cssText = `background:${accent};color:#000;`;
    allOffBtn.textContent = 'All Off';
    allOffBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      const onEntities = entities.filter(id => this._isOn(id));
      flashAndAct(onEntities.length ? onEntities : entities, 'turn_off');
    });

    allBtnsRow.appendChild(allOnBtn);
    allBtnsRow.appendChild(allOffBtn);

    popup.appendChild(style);
    popup.appendChild(headerRow);
    popup.appendChild(statsRow);
    popup.appendChild(pillsLabel);
    popup.appendChild(pillsContainer);
    popup.appendChild(allBtnsRow);

    overlay.id = 'lima-overlay';
    overlay.appendChild(popup);
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeOverviewPopup(); });

    // Block HA page scroll while open; allow touches inside the popup through so it can scroll.
    this._blockBodyScroll = (e) => {
      if (!popup.contains(e.target)) e.preventDefault();
    };
    document.addEventListener('touchmove', this._blockBodyScroll, { passive: false });

    document.body.appendChild(overlay);
    this._popupOverlay = overlay;
  }

  _closeOverviewPopup() {
    if (!this._popupOverlay) return;
    this._refreshOverview = null;
    document.removeEventListener('touchmove', this._blockBodyScroll);
    this._blockBodyScroll = null;
    this._popupOverlay.style.transition = 'opacity 0.18s ease';
    this._popupOverlay.style.opacity = '0';
    setTimeout(() => {
      if (this._popupOverlay?.parentNode) this._popupOverlay.parentNode.removeChild(this._popupOverlay);
      this._popupOverlay = null;
    }, 180);
  }

  // ── Individual Light Control Popup ────────────────────────────────────────

  _openLightPopup(entityId) {
    if (this._lightPopup) {
      if (this._lightPopup.parentNode) this._lightPopup.parentNode.removeChild(this._lightPopup);
      this._lightPopup = null;
    }

    const cfg     = this._config;
    const popupBg = cfg.popup_bg     || '#1c1c1e';
    const accent  = cfg.accent_color || '#FFD60A';
    const textCol = cfg.text_color   || '#ffffff';
    const onCol   = cfg.on_color     || '#FFD60A';
    const name    = this._name(entityId);

    const lightOverlay = document.createElement('div');
    lightOverlay.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);user-select:none;-webkit-user-select:none;`;

    const closeLightPopup = () => {
      this._refreshLightPopup = null;
      lightOverlay.style.transition = 'opacity 0.15s ease';
      lightOverlay.style.opacity = '0';
      setTimeout(() => {
        if (lightOverlay.parentNode) lightOverlay.parentNode.removeChild(lightOverlay);
        this._lightPopup = null;
      }, 150);
    };

    const style = document.createElement('style');
    style.textContent = `
      @keyframes limaLightUp { from{transform:translateY(30px) scale(0.96);opacity:0} to{transform:none;opacity:1} }
      .lima-light-popup { animation: limaLightUp 0.32s cubic-bezier(0.34,1.2,0.64,1); user-select:none; -webkit-user-select:none; }
      .lima-vslider-wrap {
        position:relative; width:80px; height:220px; border-radius:26px;
        overflow:hidden; cursor:pointer; touch-action:none; user-select:none;
        background:rgba(255,255,255,0.07); flex-shrink:0;
        box-shadow:inset 0 2px 8px rgba(0,0,0,0.3);
      }
      .lima-vslider-fill { position:absolute; left:0; right:0; bottom:0; border-radius:26px; transition:height 0.06s ease; }
      .lima-vslider-pct {
        position:absolute; bottom:16px; left:0; right:0; text-align:center;
        font-size:13px; font-weight:700; color:rgba(0,0,0,0.55); pointer-events:none; letter-spacing:-0.3px;
      }
      .lima-vslider-pct.dim { color:rgba(255,255,255,0.4); }
      .lima-hk-row { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; cursor:default; }
      .lima-hk-row.tappable { cursor:pointer; }
      .lima-hk-row.tappable:active { background:rgba(255,255,255,0.05); }
      .lima-hk-row-label { font-size:15px; font-weight:500; color:rgba(255,255,255,0.85); }
      .lima-hk-row-value { font-size:15px; font-weight:500; color:rgba(255,255,255,0.4); display:flex; align-items:center; gap:6px; }
      .lima-hk-chevron { font-size:13px; color:rgba(255,255,255,0.25); }
    `;

    const popup = document.createElement('div');
    popup.className = 'lima-light-popup';
    popup.style.cssText = `background:${popupBg};backdrop-filter:blur(60px) saturate(200%);-webkit-backdrop-filter:blur(60px) saturate(200%);border:1px solid rgba(255,255,255,0.1);border-radius:32px;box-shadow:0 40px 80px rgba(0,0,0,0.7);padding:24px;width:100%;max-width:340px;color:${textCol};font-family:${this._haFont()};user-select:none;-webkit-user-select:none;`;

    const getState       = () => this._hass?.states[entityId];
    const getIsOn        = () => getState()?.state === 'on';
    const getBri         = () => { const b = getState()?.attributes?.brightness; return b !== undefined ? Math.round(b / 2.55) : 100; };
    const getSliderColor = () => { const rgb = this._getRgbColor(entityId); return (rgb && getIsOn()) ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : accent; };
    const supportsBri    = this._supportsBrightness(entityId);
    const supportsRgb    = this._supportsRgb(entityId);
    const getRgb         = () => this._getRgbColor(entityId);

    // ── Optimistic toggle state ───────────────────────────────────────────
    let optimisticOn = getIsOn();

    // ── Header: name + close ──────────────────────────────────────────────
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
    const nameLine = document.createElement('span');
    nameLine.style.cssText = `font-size:17px;font-weight:700;color:${textCol};letter-spacing:-0.3px;`;
    nameLine.textContent = name;
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.6);padding:0;transition:background 0.15s;flex-shrink:0;`;
    closeBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;
    closeBtn.addEventListener('click', closeLightPopup);
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,255,255,0.18)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; });
    headerRow.appendChild(nameLine);
    headerRow.appendChild(closeBtn);

    // ── Toggle button (HomeKit round power icon) ───────────────────────────
    const toggleBtn = document.createElement('button');
    const applyToggleStyle = (on) => {
      const col = on ? getSliderColor() : 'rgba(255,255,255,0.12)';
      const iconCol = on ? '#000' : 'rgba(255,255,255,0.5)';
      toggleBtn.style.cssText = `width:64px;height:64px;border-radius:50%;background:${col};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.25s,transform 0.1s;flex-shrink:0;box-shadow:${on ? `0 4px 20px ${col}66` : 'none'};`;
      toggleBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${iconCol}" stroke-width="2" stroke-linecap="round"><path d="M12 3v4M6.3 6.3A8 8 0 1 0 17.7 6.3"/></svg>`;
    };
    const refreshToggle = () => { optimisticOn = getIsOn(); applyToggleStyle(optimisticOn); };
    applyToggleStyle(optimisticOn);
    toggleBtn.addEventListener('mouseenter', () => { toggleBtn.style.transform = 'scale(1.08)'; });
    toggleBtn.addEventListener('mouseleave', () => { toggleBtn.style.transform = ''; });
    toggleBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      optimisticOn = !optimisticOn;
      applyToggleStyle(optimisticOn);
      this._callService('light', optimisticOn ? 'turn_on' : 'turn_off', { entity_id: entityId });
    });

    // Wrap it centred with a little top margin
    const toggleWrap = document.createElement('div');
    toggleWrap.style.cssText = 'display:flex;justify-content:center;margin-top:20px;';

    // ── Brightness slider (centred) ───────────────────────────────────────
    let hkFill, vPctSpan;
    const centreArea = document.createElement('div');
    centreArea.style.cssText = 'display:flex;justify-content:center;margin-bottom:20px;';

    if (supportsBri) {
      const vSliderWrap = document.createElement('div');
      vSliderWrap.className = 'lima-vslider-wrap';

      hkFill = document.createElement('div');
      hkFill.className = 'lima-vslider-fill';
      hkFill.style.cssText = `background:${getSliderColor()};height:${getBri()}%;`;

      vPctSpan = document.createElement('div');
      vPctSpan.className = `lima-vslider-pct${getBri() < 25 ? ' dim' : ''}`;
      vPctSpan.textContent = `${getBri()}%`;

      vSliderWrap.appendChild(hkFill);
      vSliderWrap.appendChild(vPctSpan);

      let vDragging = false, briTimer = null;
      const setFromY = (clientY) => {
        const rect = vSliderWrap.getBoundingClientRect();
        const pct  = Math.min(100, Math.max(1, Math.round((1 - (clientY - rect.top) / rect.height) * 100)));
        hkFill.style.height = `${pct}%`;
        vPctSpan.textContent = `${pct}%`;
        vPctSpan.className = `lima-vslider-pct${pct < 25 ? ' dim' : ''}`;
        clearTimeout(briTimer);
        briTimer = setTimeout(() => {
          this._callService('light', 'turn_on', { entity_id: entityId, brightness_pct: pct });
        }, 150);
      };
      vSliderWrap.addEventListener('mousedown', e => { vDragging = true; setFromY(e.clientY); e.preventDefault(); });
      window.addEventListener('mousemove', e => { if (vDragging) setFromY(e.clientY); });
      window.addEventListener('mouseup',   () => { vDragging = false; });
      vSliderWrap.addEventListener('touchstart', e => { vDragging = true; setFromY(e.touches[0].clientY); }, { passive: true });
      vSliderWrap.addEventListener('touchmove',  e => { if (vDragging) { e.stopPropagation(); setFromY(e.touches[0].clientY); } }, { passive: false });
      vSliderWrap.addEventListener('touchend',   () => { vDragging = false; });

      centreArea.appendChild(vSliderWrap);
    }

    // ── Info card ─────────────────────────────────────────────────────────
    const listCard = document.createElement('div');
    listCard.style.cssText = `background:rgba(255,255,255,0.06);border-radius:18px;overflow:hidden;`;

    const addSep = () => {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.07);margin:0 16px;';
      listCard.appendChild(sep);
    };

    let rowCount = 0;

    // Colour row (RGB lights only)
    let colourCircleEl = null;
    const updateColourCircle = () => {
      if (!colourCircleEl) return;
      const rgb = getRgb(); const isOn = getIsOn();
      colourCircleEl.style.background = (rgb && isOn) ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : isOn ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)';
    };

    if (supportsRgb) {
      const colRow = document.createElement('div');
      colRow.className = 'lima-hk-row tappable';
      const colLbl = document.createElement('span');
      colLbl.className = 'lima-hk-row-label';
      colLbl.textContent = 'Colour';
      const colRight = document.createElement('div');
      colRight.style.cssText = 'display:flex;align-items:center;gap:8px;';
      colourCircleEl = document.createElement('div');
      colourCircleEl.style.cssText = 'width:22px;height:22px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.15);flex-shrink:0;';
      updateColourCircle();
      const chev = document.createElement('span');
      chev.className = 'lima-hk-chevron'; chev.textContent = '›';
      colRight.appendChild(colourCircleEl); colRight.appendChild(chev);
      colRow.appendChild(colLbl); colRow.appendChild(colRight);
      colRow.addEventListener('click', ev => { ev.stopPropagation(); this._openColourPicker(entityId, accent, popupBg, textCol, colourCircleEl, updateColourCircle); });
      listCard.appendChild(colRow);
      rowCount++;
    }

    // ── Live refresh ──────────────────────────────────────────────────────
    this._refreshLightPopup = () => {
      refreshToggle();
      updateColourCircle();
      if (supportsBri && hkFill && vPctSpan) {
        const bri = getBri();
        hkFill.style.height = `${bri}%`;
        hkFill.style.background = getSliderColor();
        vPctSpan.textContent = `${bri}%`;
        vPctSpan.className = `lima-vslider-pct${bri < 25 ? ' dim' : ''}`;
      }
    };

    // ── Layout: header → slider → info → power button ─────────────────────
    popup.appendChild(style);
    popup.appendChild(headerRow);
    if (supportsBri) popup.appendChild(centreArea);
    popup.appendChild(listCard);
    toggleWrap.appendChild(toggleBtn);
    popup.appendChild(toggleWrap);

    lightOverlay.appendChild(popup);
    lightOverlay.addEventListener('click', e => { if (e.target === lightOverlay) closeLightPopup(); });
    document.body.appendChild(lightOverlay);
    this._lightPopup = lightOverlay;
  }

  // ── Colour Picker Sheet ───────────────────────────────────────────────────

  _openColourPicker(entityId, accent, popupBg, textCol, circleEl, onUpdate) {
    const existing = document.getElementById('lima-colour-sheet');
    if (existing) existing.remove();

    // Merge config presets over defaults, preserving any extras
    const configPresets = this._config.colour_presets;
    const PRESETS = (Array.isArray(configPresets) && configPresets.length)
      ? configPresets
      : LIMA_DEFAULT_PRESETS;

    const currRgb = this._getRgbColor(entityId);

    const sheet = document.createElement('div');
    sheet.id = 'lima-colour-sheet';
    sheet.style.cssText = `position:fixed;inset:0;z-index:11000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,0.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);`;

    // Slide-up animation
    const animStyle = document.createElement('style');
    animStyle.textContent = `@keyframes limaColourSheetUp { from{transform:translateY(20px);opacity:0} to{transform:none;opacity:1} } #lima-colour-inner { animation: limaColourSheetUp 0.28s cubic-bezier(0.34,1.1,0.64,1); }`;
    sheet.appendChild(animStyle);

    const inner = document.createElement('div');
    inner.id = 'lima-colour-inner';
    inner.style.cssText = `background:${popupBg};border:1px solid rgba(255,255,255,0.13);border-radius:28px;padding:20px 20px 12px;width:100%;max-width:400px;font-family:${this._haFont()};color:${textCol};`;

    // ── Title row ──────────────────────────────────────────────────────────
    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;';
    const titleText = document.createElement('div');
    titleText.style.cssText = 'font-size:17px;font-weight:700;letter-spacing:-0.3px;';
    titleText.textContent = 'Choose Colour';
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:rgba(255,255,255,0.6);transition:background 0.15s;flex-shrink:0;`;
    closeBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;
    closeBtn.addEventListener('click', () => sheet.remove());
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,255,255,0.18)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; });
    titleRow.appendChild(titleText);
    titleRow.appendChild(closeBtn);
    inner.appendChild(titleRow);

    // ── HomeKit-style colour circles grid ─────────────────────────────────
    // 5 circles per row, large (54px), selected state has white outer ring + scale
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:4px 2px;margin-bottom:16px;';

    PRESETS.forEach(({ label, rgb }) => {
      const isActive = currRgb
        && Math.abs(currRgb[0] - rgb[0]) < 15
        && Math.abs(currRgb[1] - rgb[1]) < 15
        && Math.abs(currRgb[2] - rgb[2]) < 15;

      const item = document.createElement('div');
      item.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;padding:6px 4px;border-radius:14px;transition:background 0.12s;';

      // Outer ring container (provides the selection ring without affecting circle size)
      const ringWrap = document.createElement('div');
      ringWrap.style.cssText = `width:54px;height:54px;border-radius:50%;padding:3px;box-sizing:border-box;transition:padding 0.15s,box-shadow 0.15s;${isActive ? 'box-shadow:0 0 0 2.5px rgba(255,255,255,0.9);' : ''}`;

      const circle = document.createElement('div');
      circle.style.cssText = `width:100%;height:100%;border-radius:50%;background:rgb(${rgb[0]},${rgb[1]},${rgb[2]});box-shadow:0 3px 10px rgba(0,0,0,0.4),inset 0 1px 2px rgba(255,255,255,0.2);transition:transform 0.13s cubic-bezier(0.34,1.3,0.64,1);`;
      if (isActive) circle.style.transform = 'scale(1.08)';

      // Checkmark for active state
      if (isActive) {
        // Determine text colour based on luminance
        const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
        const checkCol = lum > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
        circle.innerHTML = `<svg style="width:100%;height:100%;display:block;" viewBox="0 0 48 48"><path d="M14 24l8 8 12-14" stroke="${checkCol}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
      }

      const lbl = document.createElement('div');
      lbl.style.cssText = `font-size:10px;font-weight:${isActive ? '700' : '500'};color:${isActive ? '#fff' : 'rgba(255,255,255,0.4)'};text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:58px;transition:color 0.12s;`;
      lbl.textContent = label;

      ringWrap.appendChild(circle);
      item.appendChild(ringWrap);
      item.appendChild(lbl);

      item.addEventListener('mouseenter', () => {
        if (!isActive) circle.style.transform = 'scale(1.1)';
        item.style.background = 'rgba(255,255,255,0.07)';
      });
      item.addEventListener('mouseleave', () => {
        if (!isActive) circle.style.transform = '';
        item.style.background = '';
      });
      item.addEventListener('click', ev => {
        ev.stopPropagation();
        this._callService('light', 'turn_on', { entity_id: entityId, rgb_color: rgb });
        if (circleEl) circleEl.style.background = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        if (onUpdate) onUpdate();
        sheet.remove();
      });
      // Touch feedback
      item.addEventListener('touchstart', () => { circle.style.transform = 'scale(0.94)'; }, { passive: true });
      item.addEventListener('touchend',   () => { circle.style.transform = isActive ? 'scale(1.08)' : ''; }, { passive: true });

      grid.appendChild(item);
    });
    inner.appendChild(grid);

    // ── Custom colour row ─────────────────────────────────────────────────
    const customRow = document.createElement('div');
    customRow.style.cssText = `display:flex;align-items:center;gap:12px;padding:12px 8px;border-top:1px solid rgba(255,255,255,0.08);`;

    // Custom circle (shows current colour or white)
    const customCircle = document.createElement('div');
    const initHex = currRgb
      ? '#' + currRgb.map(v => v.toString(16).padStart(2, '0')).join('')
      : '#ffffff';
    customCircle.style.cssText = `width:40px;height:40px;border-radius:50%;flex-shrink:0;background:${initHex};box-shadow:0 2px 8px rgba(0,0,0,0.35),inset 0 1px 2px rgba(255,255,255,0.15);cursor:pointer;transition:transform 0.12s;overflow:hidden;position:relative;`;

    // Rainbow / spectrum icon inside the custom circle
    customCircle.innerHTML = `<div style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);opacity:0.85;"></div><div style="position:absolute;inset:4px;border-radius:50%;background:inherit;"></div>`;

    const customInput = document.createElement('input');
    customInput.type  = 'color';
    customInput.value = initHex;
    customInput.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none;';

    customCircle.appendChild(customInput);
    customCircle.addEventListener('click', ev => { ev.stopPropagation(); customInput.click(); });
    customCircle.addEventListener('mouseenter', () => { customCircle.style.transform = 'scale(1.1)'; });
    customCircle.addEventListener('mouseleave', () => { customCircle.style.transform = ''; });

    customInput.addEventListener('change', () => {
      const hex = customInput.value;
      const r   = parseInt(hex.slice(1, 3), 16);
      const g   = parseInt(hex.slice(3, 5), 16);
      const b   = parseInt(hex.slice(5, 7), 16);
      this._callService('light', 'turn_on', { entity_id: entityId, rgb_color: [r, g, b] });
      if (circleEl) circleEl.style.background = `rgb(${r},${g},${b})`;
      if (onUpdate) onUpdate();
      sheet.remove();
    });

    const customInfo = document.createElement('div');
    customInfo.style.cssText = 'flex:1;min-width:0;';
    customInfo.innerHTML = `
      <div style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.85);">Custom</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px;">Open colour wheel</div>`;

    const chevron = document.createElement('span');
    chevron.style.cssText = 'font-size:18px;color:rgba(255,255,255,0.2);flex-shrink:0;';
    chevron.textContent = '›';

    customRow.appendChild(customCircle);
    customRow.appendChild(customInfo);
    customRow.appendChild(chevron);
    customRow.style.cursor = 'pointer';
    customRow.addEventListener('click', ev => { ev.stopPropagation(); customInput.click(); });
    inner.appendChild(customRow);

    sheet.appendChild(inner);
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);
  }

  // ── History Popup ─────────────────────────────────────────────────────────

  async _openHistoryPopup(entityId, name, accent, popupBg, textCol) {
    const existing = document.getElementById('lima-history-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.id = 'lima-history-sheet';
    sheet.style.cssText = `position:fixed;inset:0;z-index:11000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);`;

    const inner = document.createElement('div');
    inner.style.cssText = `background:${popupBg};border:1px solid rgba(255,255,255,0.13);border-radius:22px;padding:18px;width:100%;max-width:380px;max-height:70vh;overflow-y:auto;font-family:${this._haFont()};color:${textCol};`;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
    titleRow.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;">Recent History</div>
      <button style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;color:rgba(255,255,255,0.65);font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit;">✕</button>`;
    titleRow.querySelector('button').addEventListener('click', () => sheet.remove());
    inner.appendChild(titleRow);

    const loadingEl = document.createElement('div');
    loadingEl.style.cssText = 'text-align:center;padding:20px;color:rgba(255,255,255,0.25);font-size:13px;';
    loadingEl.textContent = 'Loading…';
    inner.appendChild(loadingEl);

    sheet.appendChild(inner);
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);

    // Fetch last 24h of history
    try {
      const end   = new Date();
      const start = new Date(end - 24 * 3600000);
      const resp  = await this._hass.callApi('GET',
        `history/period/${start.toISOString()}?filter_entity_id=${entityId}&end_time=${end.toISOString()}&minimal_response=true&no_attributes=true`
      );
      const raw = (resp?.[0] || []).filter(s => s.state === 'on' || s.state === 'off');

      loadingEl.remove();

      if (!raw.length) {
        const emptyEl = document.createElement('div');
        emptyEl.style.cssText = 'text-align:center;padding:20px;color:rgba(255,255,255,0.25);font-size:13px;';
        emptyEl.textContent = 'No history in the last 24 hours';
        inner.appendChild(emptyEl);
        return;
      }

      // Show most recent first
      const items = [...raw].reverse();
      items.forEach((entry, idx) => {
        const isOn   = entry.state === 'on';
        const ts     = new Date(entry.last_changed || entry.last_updated);
        const d      = ts;
        const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

        // Duration: time between this entry and the next (previous in timeline)
        let durationStr = '';
        if (idx < items.length - 1) {
          const nextTs  = new Date(items[idx + 1].last_changed || items[idx + 1].last_updated);
          const diffMin = Math.round((ts - nextTs) / 60000);
          durationStr = diffMin < 60
            ? `${diffMin}m`
            : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
        }

        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);${idx === 0 ? 'border-top:1px solid rgba(255,255,255,0.06);' : ''}`;

        const dot = document.createElement('div');
        dot.style.cssText = `width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${isOn ? accent : 'rgba(255,255,255,0.2)'};`;

        const info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        info.innerHTML = `
          <div style="font-size:13px;font-weight:600;color:${isOn ? accent : 'rgba(255,255,255,0.45)'};">${isOn ? 'Turned On' : 'Turned Off'}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">${dateStr} · ${timeStr}</div>`;

        row.appendChild(dot);
        row.appendChild(info);

        if (durationStr) {
          const dur = document.createElement('div');
          dur.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.3);flex-shrink:0;';
          dur.textContent = durationStr;
          row.appendChild(dur);
        }

        inner.appendChild(row);
      });
    } catch(e) {
      loadingEl.textContent = 'Could not load history';
    }
  }

  // ── Effect Picker Sheet ───────────────────────────────────────────────────

  _openEffectPicker(entityId, effectList, currentEffect, accent, popupBg, textCol, onSelect) {
    const existing = document.getElementById('lima-effect-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.id = 'lima-effect-sheet';
    sheet.style.cssText = `position:fixed;inset:0;z-index:11000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);`;

    const inner = document.createElement('div');
    inner.style.cssText = `background:${popupBg};border:1px solid rgba(255,255,255,0.13);border-radius:22px;padding:18px;width:100%;max-width:380px;max-height:70vh;overflow-y:auto;font-family:${this._haFont()};`;

    const title = document.createElement('div');
    title.style.cssText = 'font-size:13px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px;';
    title.textContent = 'Choose Effect';
    inner.appendChild(title);

    // None option
    const noneBtn = document.createElement('button');
    noneBtn.className = `lima-effect-btn${!currentEffect ? ' active' : ''}`;
    noneBtn.textContent = 'None';
    noneBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      this._callService('light', 'turn_on', { entity_id: entityId, effect: 'none' });
      if (onSelect) onSelect(null);
      sheet.remove();
    });
    inner.appendChild(noneBtn);

    effectList.forEach(effect => {
      const btn = document.createElement('button');
      btn.className = `lima-effect-btn${effect === currentEffect ? ' active' : ''}`;
      btn.textContent = effect.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        this._callService('light', 'turn_on', { entity_id: entityId, effect });
        if (onSelect) onSelect(effect);
        sheet.remove();
      });
      inner.appendChild(btn);
    });

    sheet.appendChild(inner);
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Visual Editor
// ─────────────────────────────────────────────────────────────────────────────
class LimaLightsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config       = {};
    this._hass         = null;
    this._searchTerm   = '';
    this._allEntities  = [];
    this._rendered     = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config && Object.keys(this._config).length) {
      if (!this._rendered) this._renderEditor();
    }
  }

  setConfig(config) {
    const prev = this._config;
    this._config = { ...config };
    if (!this._rendered) {
      if (this._hass) this._renderEditor();
      return;
    }
    this._syncFieldValues(prev);
  }

  _syncFieldValues(prev) {
    const cfg     = this._config;
    const root    = this.shadowRoot;
    const focused = root.activeElement || document.activeElement;

    const maybeSet = (el, val) => {
      if (!el || el === focused || el.contains(focused)) return;
      el.value = val;
    };

    maybeSet(root.getElementById('title'), cfg.title || '');

    const groupByArea = root.getElementById('group-by-area');
    if (groupByArea && groupByArea !== focused) groupByArea.checked = !!cfg.group_by_area;

    LIMA_COLOUR_FIELDS.forEach(field => {
      const card = root.querySelector(`.colour-card[data-key="${field.key}"]`);
      if (!card) return;
      const val = cfg[field.key] || field.default;
      if (prev[field.key] === val) return;
      const preview = card.querySelector('.colour-swatch-preview');
      const dot     = card.querySelector('.colour-dot');
      const picker  = card.querySelector('input[type=color]');
      const hexIn   = card.querySelector('.colour-hex');
      if (preview) preview.style.background = val;
      if (dot)     dot.style.background     = val;
      if (picker && picker !== focused) picker.value = val;
      if (hexIn  && hexIn  !== focused) hexIn.value  = val;
    });

    if (JSON.stringify(prev.entities) !== JSON.stringify(cfg.entities)) {
      this._syncEntityChecks();
    }
  }

  _syncEntityChecks() {
    const root     = this.shadowRoot;
    const selected = this._config.entities || [];
    const fn       = this._config.friendly_names || {};
    root.querySelectorAll('.check-item').forEach(item => {
      const id  = item.dataset.id;
      const cb  = item.querySelector('input[type=checkbox]');
      if (cb) cb.checked = selected.includes(id);
      item.draggable = selected.includes(id);
      const fnInput = item.querySelector('.fn-input');
      if (fnInput && fnInput !== root.activeElement) fnInput.value = fn[id] || '';
    });
  }

  _allLightEntities() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter(id => id.split('.')[0] === 'light')
      .sort((a, b) => {
        const na = this._hass.states[a]?.attributes?.friendly_name || a;
        const nb = this._hass.states[b]?.attributes?.friendly_name || b;
        return na.localeCompare(nb);
      });
  }

  _renderEditor() {
    this._rendered    = true;
    this._allEntities = this._allLightEntities();
    const cfg         = this._config;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: var(--primary-font-family, inherit); }
        .section { margin-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 8px; padding: 0 2px; display:flex;align-items:center;gap:6px; }
        .card-block { background: var(--card-background-color); border-radius: 12px; overflow: hidden; border: 1px solid var(--divider-color, rgba(0,0,0,0.1)); }
        .field-row { padding: 10px 14px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.07)); }
        .field-row:last-child { border-bottom: none; }
        .field-label { flex: 1; font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
        .field-desc  { font-size: 11px; color: var(--secondary-text-color); margin-top: 1px; }
        .text-input { padding: 8px 10px; border: 1px solid var(--divider-color, rgba(0,0,0,0.15)); border-radius: 8px; background: var(--secondary-background-color); color: var(--primary-text-color); font-size: 14px; font-family: inherit; flex: 1; min-width: 0; outline: none; -webkit-appearance: none; }
        .text-input:focus { border-color: #FFD60A; }
        .search-wrap { padding: 8px 10px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.07)); }
        .search-box { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--divider-color, rgba(0,0,0,0.15)); border-radius: 8px; background: var(--secondary-background-color); color: var(--primary-text-color); font-size: 14px; font-family: inherit; outline: none; -webkit-appearance: none; }
        .search-box::placeholder { color: var(--secondary-text-color); }
        .search-box:focus { border-color: #FFD60A; }
        .checklist { max-height: 340px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .check-item { display: flex; flex-direction: column; padding: 10px 12px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.06)); background: var(--card-background-color); gap: 6px; user-select: none; }
        .check-item:last-child { border-bottom: none; }
        .check-item.dragging { opacity: 0.45; background: var(--secondary-background-color) !important; }
        .check-item-row { display: flex; align-items: center; gap: 8px; min-height: 36px; }
        .drag-handle { cursor: grab; padding: 4px 6px; color: var(--secondary-text-color); flex-shrink: 0; touch-action: none; line-height: 1; }
        .drag-handle:active { cursor: grabbing; }
        .entity-name { font-size: 13px; font-weight: 500; color: var(--primary-text-color); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .entity-id   { font-size: 10px; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .entity-state { font-size: 12px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
        .fn-row { display: none; padding: 0 2px 2px 32px; }
        .fn-row.visible { display: flex; align-items: center; gap: 6px; }
        .fn-label { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; flex-shrink: 0; }
        .fn-input { flex: 1; padding: 5px 8px; border: 1px solid var(--divider-color, rgba(0,0,0,0.15)); border-radius: 7px; background: var(--secondary-background-color); color: var(--primary-text-color); font-size: 12px; font-family: inherit; outline: none; -webkit-appearance: none; min-width: 0; }
        .fn-input:focus { border-color: #FFD60A; }
        .fn-input::placeholder { color: var(--secondary-text-color); opacity: 0.7; }
        .toggle-switch { position: relative; width: 44px; height: 26px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-track { position: absolute; inset: 0; border-radius: 26px; background: rgba(120,120,128,0.32); cursor: pointer; transition: background 0.25s ease; }
        .toggle-track::after { content: ''; position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #fff; top: 2px; left: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.25s ease; }
        .toggle-switch input:checked + .toggle-track { background: #34C759; }
        .toggle-switch input:checked + .toggle-track::after { transform: translateX(18px); }
        .colour-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px; }
        .colour-card  { background: var(--secondary-background-color); border-radius: 10px; padding: 10px; display: flex; gap: 10px; align-items: flex-start; }
        .colour-swatch { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; }
        .colour-swatch-preview { width: 36px; height: 36px; border-radius: 50%; border: 2px solid rgba(0,0,0,0.15); flex-shrink: 0; }
        .colour-swatch input[type=color] { opacity: 0; width: 0; height: 0; position: absolute; }
        .colour-info  { flex: 1; min-width: 0; }
        .colour-label { font-size: 12px; font-weight: 600; color: var(--primary-text-color); }
        .colour-desc  { font-size: 10px; color: var(--secondary-text-color); margin: 2px 0 4px; line-height: 1.3; }
        .colour-hex-row { display: flex; align-items: center; gap: 4px; }
        .colour-dot   { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .colour-hex   { font-size: 11px; border: 1px solid var(--divider-color); border-radius: 5px; padding: 3px 5px; background: var(--card-background-color); color: var(--primary-text-color); font-family: monospace; width: 70px; outline: none; -webkit-appearance: none; }
        .colour-hex:focus { border-color: #FFD60A; }
        .colour-edit-icon { font-size: 12px; color: var(--secondary-text-color); }
        .auto-badge { font-size: 9px; background: #34C75922; color: #34C759; border: 1px solid #34C75944; border-radius: 6px; padding: 1px 6px; font-weight: 700; }
        .preset-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
        .preset-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px 8px; cursor: default; border-right: 1px solid var(--divider-color,rgba(0,0,0,0.07)); border-bottom: 1px solid var(--divider-color,rgba(0,0,0,0.07)); }
        .preset-item:nth-child(4n) { border-right: none; }
        .preset-item:nth-last-child(-n+4) { border-bottom: none; }
        .preset-circle-wrap { position: relative; width: 44px; height: 44px; }
        .preset-circle { width: 44px; height: 44px; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.18); transition: transform 0.13s; border: 2px solid rgba(0,0,0,0.08); position: relative; overflow: hidden; }
        .preset-circle:hover { transform: scale(1.12); }
        .preset-circle input[type=color] { opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; border: none; padding: 0; }
        .preset-label-input { width: 100%; max-width: 68px; font-size: 10px; text-align: center; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--primary-text-color); font-family: inherit; padding: 2px 3px; outline: none; -webkit-appearance: none; transition: border-color 0.15s, background 0.15s; }
        .preset-label-input:focus { border-color: #FFD60A; background: var(--secondary-background-color); }
        .preset-item.dragging { opacity: 0.4; }
      </style>

      <!-- Card Settings -->
      <div class="section">
        <div class="section-title">Card Settings</div>
        <div class="card-block">
          <div class="field-row">
            <div>
              <div class="field-label">Title <span style="font-size:10px;color:var(--secondary-text-color);font-weight:400;">(optional)</span></div>
              <div class="field-desc">Label shown on the pill card. Leave blank to hide.</div>
            </div>
            <input class="text-input" id="title" type="text" value="${cfg.title || ''}" placeholder="e.g. Lights" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          </div>
          <div class="field-row">
            <div>
              <div class="field-label">Group by Area</div>
              <div class="field-desc">Group lights by their Home Assistant area in the popup.</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="group-by-area" ${cfg.group_by_area ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Light entities -->
      <div class="section">
        <div class="section-title">
          Lights
          <span class="auto-badge">AUTO-DETECTED</span>
        </div>
        <div class="card-block">
          <div class="search-wrap">
            <input class="search-box" id="entity-search" type="search" placeholder="Search lights…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          </div>
          <div class="checklist" id="entity-list"></div>
        </div>
        <div style="font-size:10px;color:var(--secondary-text-color);padding:4px 2px;">
          Shows all light entities. Toggle to select, drag grip to reorder.
        </div>
      </div>

      <!-- Colours -->
      <div class="section">
        <div class="section-title">Colours</div>
        <div class="card-block">
          <div class="colour-grid" id="colour-grid"></div>
        </div>
      </div>

      <!-- Colour Presets -->
      <div class="section">
        <div class="section-title">Colour Presets
          <span style="margin-left:auto;">
            <button id="reset-presets-btn" style="font-size:10px;font-weight:600;color:var(--secondary-text-color);background:none;border:1px solid var(--divider-color,rgba(0,0,0,0.15));border-radius:8px;padding:3px 10px;cursor:pointer;font-family:inherit;">Reset to defaults</button>
          </span>
        </div>
        <div style="font-size:10px;color:var(--secondary-text-color);padding:0 2px 6px;">
          These are the colour circles shown in the colour picker. Click a circle to change its colour, edit the label, or drag to reorder.
        </div>
        <div class="card-block">
          <div id="preset-grid" class="preset-grid"></div>
        </div>
      </div>
    `;

    // Wire title
    const titleEl = this.shadowRoot.getElementById('title');
    titleEl.addEventListener('blur', () => this._commitConfig('title', titleEl.value.trim()));
    titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') titleEl.blur(); });

    // Wire group-by-area toggle
    const groupByAreaEl = this.shadowRoot.getElementById('group-by-area');
    groupByAreaEl.addEventListener('change', () => this._commitConfig('group_by_area', groupByAreaEl.checked));

    // Wire search
    const searchEl = this.shadowRoot.getElementById('entity-search');
    searchEl.addEventListener('input', () => {
      this._searchTerm = searchEl.value;
      this._filterEntityList();
    });

    this._renderEntityList();
    this._buildColourGrid();
    this._buildPresetGrid();
    this._setupReordering();

    // Wire reset-presets button
    const resetBtn = this.shadowRoot.getElementById('reset-presets-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._commitConfig('colour_presets', JSON.parse(JSON.stringify(LIMA_DEFAULT_PRESETS)));
        this._buildPresetGrid();
      });
    }
  }

  _renderEntityList() {
    const list     = this.shadowRoot.getElementById('entity-list');
    if (!list) return;
    const selected = this._config.entities     || [];
    const fn       = this._config.friendly_names || {};
    const all      = this._allEntities;

    list.innerHTML = '';

    if (!all.length) {
      list.innerHTML = `<div style="padding:14px;font-size:12px;color:var(--secondary-text-color);">No light entities found in Home Assistant.</div>`;
      return;
    }

    const selectedInOrder = selected.filter(id => all.includes(id));
    const unselected      = all.filter(id => !selected.includes(id));
    const ordered         = [...selectedInOrder, ...unselected];

    ordered.forEach(entityId => {
      const isChecked = selected.includes(entityId);
      const stateObj  = this._hass?.states[entityId];
      const haName    = stateObj?.attributes?.friendly_name || entityId.split('.').pop().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const isOn      = stateObj?.state === 'on';
      const savedFn   = fn[entityId] || '';
      const searchKey = (haName + ' ' + entityId).toLowerCase();

      const item = document.createElement('div');
      item.className      = 'check-item';
      item.dataset.id     = entityId;
      item.dataset.search = searchKey;
      item.draggable      = isChecked;

      item.innerHTML = `
        <div class="check-item-row">
          <div class="drag-handle" title="Drag to reorder">
            <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;display:block;"><path d="M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z"/></svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="entity-name">${haName}</div>
            <div class="entity-id">${entityId}</div>
          </div>
          <span class="entity-state" style="color:${isOn ? '#FFD60A' : 'rgba(255,255,255,0.3)'};">${isOn ? 'On' : 'Off'}</span>
          <label class="toggle-switch">
            <input type="checkbox" ${isChecked ? 'checked' : ''} data-id="${entityId}">
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="fn-row ${isChecked ? 'visible' : ''}">
          <span class="fn-label">Display name</span>
          <input class="fn-input" type="text" value="${savedFn}" placeholder="${haName}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </div>`;

      item.querySelector('input[type=checkbox]').addEventListener('change', e => {
        const current = [...(this._config.entities || [])];
        const id      = e.target.dataset.id;
        const fnRow   = item.querySelector('.fn-row');
        if (e.target.checked) {
          if (!current.includes(id)) current.push(id);
          item.draggable = true;
          if (fnRow) fnRow.classList.add('visible');
        } else {
          const idx = current.indexOf(id);
          if (idx !== -1) current.splice(idx, 1);
          item.draggable = false;
          if (fnRow) fnRow.classList.remove('visible');
        }
        this._commitConfig('entities', current);
      });

      const fnInput = item.querySelector('.fn-input');
      fnInput.addEventListener('blur', () => {
        const names = { ...(this._config.friendly_names || {}) };
        const val   = fnInput.value.trim();
        if (val) names[entityId] = val;
        else     delete names[entityId];
        this._commitConfig('friendly_names', names);
      });
      fnInput.addEventListener('keydown', e => { if (e.key === 'Enter') fnInput.blur(); });

      list.appendChild(item);
    });

    this._filterEntityList();
  }

  _filterEntityList() {
    const list = this.shadowRoot.getElementById('entity-list');
    if (!list) return;
    const term = this._searchTerm.toLowerCase().trim();
    list.querySelectorAll('.check-item').forEach(item => {
      item.style.display = (!term || item.dataset.search.includes(term)) ? 'flex' : 'none';
    });
  }

  _setupReordering() {
    const list = this.shadowRoot.getElementById('entity-list');
    if (!list) return;
    let draggedItem = null;

    list.addEventListener('dragstart', e => {
      draggedItem = e.target.closest('.check-item');
      if (!draggedItem?.draggable || !draggedItem.querySelector('input[type=checkbox]')?.checked) {
        e.preventDefault(); draggedItem = null; return;
      }
      setTimeout(() => draggedItem?.classList.add('dragging'), 0);
    });
    list.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedItem) return;
      const after = this._dragAfterElement(list, e.clientY);
      if (after == null) list.appendChild(draggedItem);
      else list.insertBefore(draggedItem, after);
    });
    list.addEventListener('dragend', () => {
      draggedItem?.classList.remove('dragging');
      draggedItem = null;
      this._saveOrder();
    });

    list.addEventListener('touchstart', e => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const item = handle.closest('.check-item');
      if (!item?.querySelector('input[type=checkbox]')?.checked) return;
      draggedItem = item;
      draggedItem.classList.add('dragging');
    }, { passive: true });
    list.addEventListener('touchmove', e => {
      if (!draggedItem) return;
      e.preventDefault();
      const after = this._dragAfterElement(list, e.touches[0].clientY);
      if (after == null) list.appendChild(draggedItem);
      else list.insertBefore(draggedItem, after);
    }, { passive: false });
    list.addEventListener('touchend', () => {
      if (!draggedItem) return;
      draggedItem.classList.remove('dragging');
      draggedItem = null;
      this._saveOrder();
    });
  }

  _dragAfterElement(container, y) {
    const items = [...container.querySelectorAll('.check-item:not(.dragging)')].filter(i => i.style.display !== 'none');
    return items.reduce((closest, child) => {
      const box    = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  _saveOrder() {
    const list = this.shadowRoot.getElementById('entity-list');
    if (!list) return;
    const newOrder = [...list.querySelectorAll('.check-item')]
      .filter(i => i.querySelector('input[type=checkbox]')?.checked)
      .map(i => i.dataset.id);
    this._commitConfig('entities', newOrder);
  }

  _buildPresetGrid() {
    const grid = this.shadowRoot.getElementById('preset-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const presets = this._getPresets();

    const savePresets = () => {
      this._commitConfig('colour_presets', JSON.parse(JSON.stringify(presets)));
    };

    presets.forEach((preset, idx) => {
      const item = document.createElement('div');
      item.className = 'preset-item';
      item.draggable = true;
      item.dataset.idx = idx;

      // Circle with hidden colour input
      const circleWrap = document.createElement('div');
      circleWrap.className = 'preset-circle-wrap';

      const circle = document.createElement('div');
      circle.className = 'preset-circle';
      circle.style.background = `rgb(${preset.rgb[0]},${preset.rgb[1]},${preset.rgb[2]})`;
      circle.title = 'Click to change colour';

      const colInput = document.createElement('input');
      colInput.type  = 'color';
      colInput.value = '#' + preset.rgb.map(v => v.toString(16).padStart(2,'0')).join('');
      colInput.addEventListener('input', () => {
        const hex = colInput.value;
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        preset.rgb = [r, g, b];
        circle.style.background = `rgb(${r},${g},${b})`;
      });
      colInput.addEventListener('change', savePresets);

      circle.appendChild(colInput);
      circleWrap.appendChild(circle);

      // Label input
      const labelInput = document.createElement('input');
      labelInput.className  = 'preset-label-input';
      labelInput.type       = 'text';
      labelInput.value      = preset.label;
      labelInput.maxLength  = 12;
      labelInput.autocomplete = 'off';
      labelInput.spellcheck   = false;
      labelInput.addEventListener('input', () => { preset.label = labelInput.value; });
      labelInput.addEventListener('blur',  savePresets);
      labelInput.addEventListener('keydown', e => { if (e.key === 'Enter') labelInput.blur(); });

      item.appendChild(circleWrap);
      item.appendChild(labelInput);

      // Drag-to-reorder
      let dragSrc = null;
      item.addEventListener('dragstart', e => {
        dragSrc = item;
        setTimeout(() => item.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrc || dragSrc === item) return;
        const fromIdx = parseInt(dragSrc.dataset.idx);
        const toIdx   = parseInt(item.dataset.idx);
        const [moved] = presets.splice(fromIdx, 1);
        presets.splice(toIdx, 0, moved);
        savePresets();
        this._buildPresetGrid();
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragSrc = null;
      });

      grid.appendChild(item);
    });
  }

  _getPresets() {
    const cfg = this._config.colour_presets;
    return (Array.isArray(cfg) && cfg.length)
      ? cfg.map(p => ({ label: p.label, rgb: [...p.rgb] }))
      : LIMA_DEFAULT_PRESETS.map(p => ({ label: p.label, rgb: [...p.rgb] }));
  }

  _buildColourGrid() {
    const grid = this.shadowRoot.getElementById('colour-grid');
    if (!grid) return;
    grid.innerHTML = '';

    LIMA_COLOUR_FIELDS.forEach(field => {
      const savedVal = this._config[field.key] || field.default;

      const card = document.createElement('div');
      card.className   = 'colour-card';
      card.dataset.key = field.key;
      card.innerHTML = `
        <label class="colour-swatch">
          <div class="colour-swatch-preview" style="background:${savedVal}"></div>
          <input type="color" value="${savedVal}">
        </label>
        <div class="colour-info">
          <div class="colour-label">${field.label}</div>
          <div class="colour-desc">${field.desc}</div>
          <div class="colour-hex-row">
            <div class="colour-dot" style="background:${savedVal}"></div>
            <input class="colour-hex" type="text" value="${savedVal}" maxlength="7" placeholder="${field.default}" spellcheck="false" autocomplete="off">
            <span class="colour-edit-icon">✎</span>
          </div>
        </div>`;

      const picker  = card.querySelector('input[type=color]');
      const hexIn   = card.querySelector('.colour-hex');
      const preview = card.querySelector('.colour-swatch-preview');
      const dot     = card.querySelector('.colour-dot');

      const applyVisual = hex => {
        preview.style.background = hex;
        dot.style.background     = hex;
        picker.value             = hex;
        hexIn.value              = hex;
      };

      picker.addEventListener('input',  () => applyVisual(picker.value));
      picker.addEventListener('change', () => { applyVisual(picker.value); this._commitConfig(field.key, picker.value); });

      hexIn.addEventListener('input', () => {
        const v = hexIn.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) applyVisual(v);
      });
      hexIn.addEventListener('blur', () => {
        const v = hexIn.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) this._commitConfig(field.key, v);
        else hexIn.value = this._config[field.key] || field.default;
      });
      hexIn.addEventListener('keydown', e => { if (e.key === 'Enter') hexIn.blur(); });

      grid.appendChild(card);
    });
  }

  _commitConfig(key, value) {
    this._config = { ...this._config, [key]: value, type: 'custom:lima-lights-card' };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail:   { config: this._config },
      bubbles:  true,
      composed: true,
    }));
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────
if (!customElements.get('lima-lights-card')) {
  customElements.define('lima-lights-card', LimaLightsCard);
}
if (!customElements.get('lima-lights-card-editor')) {
  customElements.define('lima-lights-card-editor', LimaLightsCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'lima-lights-card')) {
  window.customCards.push({
    type:        'lima-lights-card',
    name:        'Lima Lights Card',
    preview:     true,
    description: 'Compact pill card showing how many lights are on, with a full control popup for brightness, colour temperature and individual light control.',
  });
}
