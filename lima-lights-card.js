/**
 * Lima Lights Card
 * Compact pill card showing how many lights are on across multiple entities.
 * Click pill → light overview popup with full controls
 * Click light pill → individual light control popup (on/off, brightness, colour temp)
 * GitHub: https://github.com/jamesmcginnis/lima-lights-card
 */

// ─── Editor: Colour field definitions ────────────────────────────────────────
const LIMA_COLOUR_FIELDS = [
  { key: 'pill_bg',      label: 'Pill Background',  desc: 'Background colour of the main pill card.',                default: '#1c1c1e' },
  { key: 'text_color',   label: 'Text',              desc: 'Primary text colour for labels and values.',              default: '#ffffff' },
  { key: 'accent_color', label: 'Accent',            desc: 'Highlight colour used for active states and controls.',   default: '#FFD60A' },
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
      type:         'custom:lima-lights-card',
      entities:     [],
      title:        '',
      accent_color: '#FFD60A',
      on_color:     '#FFD60A',
      off_color:    '#48484A',
      pill_bg:      '#1c1c1e',
      text_color:   '#ffffff',
      popup_bg:     '#1c1c1e',
      icon_color:   '#FFD60A',
    };
  }

  setConfig(config) {
    this._config = {
      title:        '',
      accent_color: '#FFD60A',
      on_color:     '#FFD60A',
      off_color:    '#48484A',
      pill_bg:      '#1c1c1e',
      text_color:   '#ffffff',
      popup_bg:     '#1c1c1e',
      icon_color:   '#FFD60A',
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
          border-radius: 28px; pointer-events: none; width: 0%;
          background: rgba(${this._hexToRgb(cfg.accent_color || '#FFD60A')}, 0.18);
          transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
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
    if (fillEl) fillEl.style.width = `${Math.round((onCount / total) * 100)}%`;
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
        font-family: var(--primary-font-family, inherit);
      }
      .lima-light-pill.is-on  { background: rgba(255,214,10,0.1); border-color: rgba(255,214,10,0.3); }
      .lima-light-pill.pressing { transform: scale(0.93); }
      .lima-pill-name { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-align: center; letter-spacing: 0.02em; line-height: 1.3; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lima-close-btn:hover { background:rgba(255,255,255,0.22)!important; }
      .lima-all-btn { flex:1; padding:11px 8px; border-radius:12px; border:none; cursor:pointer; font-size:13px; font-weight:600; transition:background 0.15s,opacity 0.15s; font-family:inherit; }
      .lima-all-btn:active { opacity:0.75; }
    `;

    const popup = document.createElement('div');
    popup.className = 'lima-popup';
    popup.style.cssText = `background:${popupBg};backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);border:1px solid rgba(255,255,255,0.13);border-radius:28px;box-shadow:0 28px 72px rgba(0,0,0,0.65);padding:20px;width:100%;max-width:420px;max-height:85vh;overflow-y:auto;color:${textCol};font-family:${this._haFont()};`;
    popup.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

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
        const isOn = this._isOn(entityId);
        const bri  = this._brightness(entityId);
        const iconColor = isOn ? onCol : 'rgba(255,255,255,0.2)';
        pill.classList.toggle('is-on', isOn);
        svg.setAttribute('fill', iconColor);
        briEl.style.color = isOn ? onCol : 'rgba(255,255,255,0.25)';
        briEl.textContent = isOn ? (bri !== null ? `${bri}%` : 'On') : 'Off';
      });
    };
    this._refreshOverview = refreshOverview;

    // Build pills
    const pillsLabel = document.createElement('div');
    pillsLabel.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:10px;';
    pillsLabel.textContent = `${entities.length} Light${entities.length !== 1 ? 's' : ''}`;

    const pillsGrid = document.createElement('div');
    pillsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;';

    entities.forEach(entityId => {
      const isOn = this._isOn(entityId);
      const name = this._name(entityId);
      const bri  = this._brightness(entityId);

      const pill = document.createElement('div');
      pill.className = `lima-light-pill${isOn ? ' is-on' : ''}`;

      const iconColor = isOn ? onCol : 'rgba(255,255,255,0.2)';
      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.setAttribute('width', '22');
      svgEl.setAttribute('height', '22');
      svgEl.setAttribute('viewBox', '0 0 24 24');
      svgEl.setAttribute('fill', iconColor);
      svgEl.style.cssText = 'display:block;flex-shrink:0;';
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', 'M12 2a7 7 0 0 1 7 7c0 2.73-1.56 5.1-3.84 6.34L14 17H10l-.16-1.66A7 7 0 0 1 5 9a7 7 0 0 1 7-7zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-1-2h6v1H9v-1z');
      svgEl.appendChild(pathEl);

      const briEl = document.createElement('div');
      briEl.style.cssText = `font-size:12px;font-weight:700;color:${isOn ? onCol : 'rgba(255,255,255,0.25)'};line-height:1;`;
      briEl.textContent = isOn ? (bri !== null ? `${bri}%` : 'On') : 'Off';

      const nameEl = document.createElement('div');
      nameEl.className = 'lima-pill-name';
      nameEl.textContent = name;

      pill.appendChild(svgEl);
      pill.appendChild(briEl);
      pill.appendChild(nameEl);

      pillMap.set(entityId, { pill, svg: svgEl, briEl });

      // Tap = toggle on/off, long press (500ms) = open detail popup
      // Text selection disabled to prevent highlighting on long press
      pill.style.webkitUserSelect = 'none';
      pill.style.userSelect       = 'none';
      pill.style.webkitTouchCallout = 'none';

      let longPressTimer = null;
      let didLongPress   = false;

      const startPress = () => {
        didLongPress  = false;
        pill.classList.add('pressing');
        longPressTimer = setTimeout(() => {
          didLongPress = true;
          pill.classList.remove('pressing');
          this._openLightPopup(entityId);
        }, 500);
      };

      const cancelPress = () => {
        clearTimeout(longPressTimer);
        pill.classList.remove('pressing');
      };

      // Shared toggle — used by both click (desktop) and touchend (mobile).
      // touchstart calls e.preventDefault() which suppresses the synthetic click
      // on mobile, so touchend must handle the toggle directly.
      const doToggle = () => {
        if (didLongPress) return;
        const isNowOn = this._isOn(entityId);
        this._callService('light', isNowOn ? 'turn_off' : 'turn_on', { entity_id: entityId });
        // Optimistic visual update — reflects change immediately before HA state arrives
        const willBeOn = !isNowOn;
        const pillRef = pillMap.get(entityId);
        if (pillRef) {
          pillRef.pill.classList.toggle('is-on', willBeOn);
          pillRef.svg.setAttribute('fill', willBeOn ? onCol : 'rgba(255,255,255,0.2)');
          pillRef.briEl.style.color = willBeOn ? onCol : 'rgba(255,255,255,0.25)';
          pillRef.briEl.textContent = willBeOn ? 'On' : 'Off';
        }
      };

      pill.addEventListener('mousedown',  () => startPress());
      pill.addEventListener('mouseleave', () => cancelPress());
      pill.addEventListener('mouseup',    () => cancelPress());
      pill.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); }, { passive: false });
      pill.addEventListener('touchend',   () => { cancelPress(); doToggle(); }, { passive: true });
      pill.addEventListener('touchcancel',() => cancelPress(), { passive: true });

      // click fires on desktop mouse; on mobile the synthetic click is suppressed
      // by preventDefault() in touchstart so doToggle() is a no-op guard here.
      pill.addEventListener('click', ev => {
        ev.stopPropagation();
        doToggle();
      });

      pillsGrid.appendChild(pill);
    });

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

    const allOnBtn = document.createElement('button');
    allOnBtn.className = 'lima-all-btn';
    allOnBtn.style.cssText = `background:${accent};color:#000;`;
    allOnBtn.textContent = 'All On';
    allOnBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      entities.forEach(id => this._callService('light', 'turn_on', { entity_id: id }));
    });

    const allOffBtn = document.createElement('button');
    allOffBtn.className = 'lima-all-btn';
    allOffBtn.style.cssText = 'background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);';
    allOffBtn.textContent = 'All Off';
    allOffBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      entities.forEach(id => this._callService('light', 'turn_off', { entity_id: id }));
    });

    allBtnsRow.appendChild(allOnBtn);
    allBtnsRow.appendChild(allOffBtn);

    popup.appendChild(style);
    popup.appendChild(headerRow);
    popup.appendChild(statsRow);
    popup.appendChild(pillsLabel);
    popup.appendChild(pillsGrid);
    popup.appendChild(allBtnsRow);

    overlay.id = 'lima-overlay';
    overlay.appendChild(popup);
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeOverviewPopup(); });
    document.body.appendChild(overlay);
    this._popupOverlay = overlay;
  }

  _closeOverviewPopup() {
    if (!this._popupOverlay) return;
    this._refreshOverview = null;
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
    lightOverlay.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);`;

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
      @keyframes limaLightUp { from{transform:translateY(20px) scale(0.97);opacity:0} to{transform:none;opacity:1} }
      .lima-light-popup { animation: limaLightUp 0.26s cubic-bezier(0.34,1.28,0.64,1); }
      .lima-close-btn:hover { background:rgba(255,255,255,0.22)!important; }
      .lima-info-row { display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07); }
      .lima-info-row:last-child { border-bottom:none; }
      .lima-info-label { font-size:12px;color:rgba(255,255,255,0.45);font-weight:500; }
      .lima-info-value { font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);text-align:right; }
      .lima-info-row.clickable { cursor:pointer; }
      .lima-info-row.clickable:hover .lima-info-value { color:#fff; }
      /* HomeKit-style brightness slider */
      .lima-hk-slider-wrap {
        position: relative; width: 100%; height: 56px; border-radius: 14px;
        overflow: hidden; cursor: pointer; touch-action: none; user-select: none;
        background: rgba(255,255,255,0.08);
      }
      .lima-hk-slider-fill {
        position: absolute; left: 0; top: 0; bottom: 0;
        border-radius: 14px; transition: width 0.08s ease;
      }
      .lima-hk-slider-label {
        position: absolute; inset: 0; display: flex; align-items: center;
        justify-content: space-between; padding: 0 16px; pointer-events: none;
      }
      .lima-hk-slider-name { font-size: 13px; font-weight: 600; color: rgba(0,0,0,0.6); }
      .lima-hk-slider-value { font-size: 13px; font-weight: 700; color: rgba(0,0,0,0.7); }
      /* CT slider */
      .lima-ct-slider { -webkit-appearance:none;appearance:none;width:100%;height:32px;border-radius:10px;outline:none;cursor:pointer;background:linear-gradient(to right,#FF9A3C,#FFE566,#fff,#d4eeff); }
      .lima-ct-slider::-webkit-slider-thumb { -webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.9); }
      .lima-ct-slider::-moz-range-thumb { width:26px;height:26px;border-radius:50%;background:#fff;cursor:pointer;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.4); }
      /* Effects sheet */
      .lima-effect-btn { width:100%;text-align:left;padding:11px 14px;background:rgba(255,255,255,0.06);border:none;border-radius:10px;color:rgba(255,255,255,0.85);font-size:14px;cursor:pointer;transition:background 0.15s;font-family:inherit;margin-bottom:6px; }
      .lima-effect-btn:hover { background:rgba(255,255,255,0.12); }
      .lima-effect-btn.active { background:${accent}33;color:${accent}; }
    `;

    const popup = document.createElement('div');
    popup.className = 'lima-light-popup';
    popup.style.cssText = `background:${popupBg};backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);border:1px solid rgba(255,255,255,0.13);border-radius:26px;box-shadow:0 28px 72px rgba(0,0,0,0.65);padding:20px;width:100%;max-width:380px;max-height:85vh;overflow-y:auto;color:${textCol};font-family:${this._haFont()};`;
    popup.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

    const getState    = () => this._hass?.states[entityId];
    const getIsOn     = () => getState()?.state === 'on';
    const getBri      = () => { const b = getState()?.attributes?.brightness; return b !== undefined ? Math.round(b / 2.55) : 100; };
    const getCT       = () => getState()?.attributes?.color_temp_kelvin ?? this._minColorTemp(entityId);
    const getEffect   = () => getState()?.attributes?.effect ?? null;
    const getEffects  = () => getState()?.attributes?.effect_list ?? [];
    const supportsBri = this._supportsBrightness(entityId);
    const supportsCT  = this._supportsColorTemp(entityId);
    const supportsRgb = this._supportsRgb(entityId);
    const getRgb      = () => this._getRgbColor(entityId);
    const minCT       = this._minColorTemp(entityId);
    const maxCT       = this._maxColorTemp(entityId);

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
    headerRow.innerHTML = `
      <span style="font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.4);">${name}</span>
      <button class="lima-close-btn" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.65);font-size:16px;line-height:1;padding:0;transition:background 0.15s;flex-shrink:0;">✕</button>`;
    headerRow.querySelector('.lima-close-btn').addEventListener('click', closeLightPopup);

    // On/Off toggle row
    const toggleWrap = document.createElement('div');
    toggleWrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';

    const stateLabelEl = document.createElement('div');
    const toggleBtn    = document.createElement('button');

    // Persistent circle — reflects RGB colour, clickable to open colour picker
    const circleEl   = document.createElement('div');
    circleEl.style.cssText = 'font-size:38px;font-weight:700;letter-spacing:-1.5px;line-height:1;cursor:pointer;transition:color 0.2s ease;';
    const stateTextEl = document.createElement('div');
    stateTextEl.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;';
    stateLabelEl.appendChild(circleEl);
    stateLabelEl.appendChild(stateTextEl);

    const getCircleColour = () => {
      const rgb = getRgb();
      if (!getIsOn()) return 'rgba(255,255,255,0.2)';
      return rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : onCol;
    };

    const refreshToggle = () => {
      const isOn = getIsOn();
      const bri  = getBri();
      circleEl.textContent    = isOn ? '●' : '○';
      circleEl.style.color    = getCircleColour();
      stateTextEl.textContent = isOn ? (supportsBri ? `${bri}% brightness` : 'On') : 'Off';
      toggleBtn.style.cssText = `background:${isOn ? accent : 'rgba(255,255,255,0.12)'};color:${isOn ? '#000' : 'rgba(255,255,255,0.8)'};border:none;border-radius:14px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer;transition:background 0.2s,color 0.2s;font-family:inherit;`;
      toggleBtn.textContent = isOn ? 'Turn Off' : 'Turn On';
    };
    refreshToggle();

    // Clicking the circle opens the colour picker; a proxy forwards background → color
    // so _openColourPicker's circleEl.style.background call updates our text colour
    const circleColourProxy = { style: {} };
    Object.defineProperty(circleColourProxy.style, 'background', {
      set: val => { circleEl.style.color = val; },
      get: () => circleEl.style.color,
    });
    circleEl.addEventListener('click', ev => {
      ev.stopPropagation();
      this._openColourPicker(entityId, accent, popupBg, textCol, circleColourProxy, () => {
        circleEl.style.color = getCircleColour();
      });
    });

    toggleBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      const wasOn = getIsOn();
      this._callService('light', wasOn ? 'turn_off' : 'turn_on', { entity_id: entityId });
      // Optimistic: show anticipated state immediately before HA state arrives
      const willBeOn = !wasOn;
      const bri = getBri();
      const rgb = getRgb();
      circleEl.textContent    = willBeOn ? '●' : '○';
      circleEl.style.color    = willBeOn ? (rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : onCol) : 'rgba(255,255,255,0.2)';
      stateTextEl.textContent = willBeOn ? (supportsBri ? bri + '% brightness' : 'On') : 'Off';
      toggleBtn.style.cssText = `background:${willBeOn ? accent : 'rgba(255,255,255,0.12)'};color:${willBeOn ? '#000' : 'rgba(255,255,255,0.8)'};border:none;border-radius:14px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer;transition:background 0.2s,color 0.2s;font-family:inherit;`;
      toggleBtn.textContent = willBeOn ? 'Turn Off' : 'Turn On';
    });

    toggleWrap.appendChild(stateLabelEl);
    toggleWrap.appendChild(toggleBtn);

    // Controls
    const controlsWrap = document.createElement('div');
    controlsWrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;margin-bottom:18px;';

    // ── Colour circle (RGB lights only) ───────────────────────────────────
    let colourCircleEl = null;
    const updateColourCircle = () => {
      if (!colourCircleEl) return;
      const rgb = getRgb();
      const isOn = getIsOn();
      colourCircleEl.style.background = (rgb && isOn)
        ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
        : isOn ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.12)';
    };
    if (supportsRgb) {
      const colourRow = document.createElement('div');
      colourRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:2px 0;';
      const colourLabelEl = document.createElement('div');
      colourLabelEl.style.cssText = 'font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.06em;';
      colourLabelEl.textContent = 'Colour';
      colourCircleEl = document.createElement('div');
      colourCircleEl.style.cssText = 'width:36px;height:36px;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,0.2);transition:transform 0.15s ease,box-shadow 0.15s ease;flex-shrink:0;';
      updateColourCircle();
      colourCircleEl.addEventListener('mouseenter', () => { colourCircleEl.style.transform = 'scale(1.08)'; colourCircleEl.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.15)'; });
      colourCircleEl.addEventListener('mouseleave', () => { colourCircleEl.style.transform = ''; colourCircleEl.style.boxShadow = ''; });
      colourCircleEl.addEventListener('click', ev => {
        ev.stopPropagation();
        this._openColourPicker(entityId, accent, popupBg, textCol, colourCircleEl, updateColourCircle);
      });
      colourRow.appendChild(colourLabelEl);
      colourRow.appendChild(colourCircleEl);
      controlsWrap.appendChild(colourRow);
    }

    // ── HomeKit brightness slider ─────────────────────────────────────────
    let briValueEl, hkFill;
    if (supportsBri) {
      const briSection = document.createElement('div');

      const briHeader = document.createElement('div');
      briHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
      const briLabelEl = document.createElement('div');
      briLabelEl.style.cssText = 'font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.06em;';
      briLabelEl.textContent = 'Brightness';
      briValueEl = document.createElement('div');
      briValueEl.style.cssText = `font-size:13px;font-weight:700;color:${accent};`;
      briValueEl.textContent = `${getBri()}%`;
      briHeader.appendChild(briLabelEl);
      briHeader.appendChild(briValueEl);

      // HomeKit-style pill slider
      const hkWrap = document.createElement('div');
      hkWrap.className = 'lima-hk-slider-wrap';

      hkFill = document.createElement('div');
      hkFill.className = 'lima-hk-slider-fill';
      hkFill.style.cssText = `background:${accent};width:${getBri()}%;`;

      const hkLabelDiv = document.createElement('div');
      hkLabelDiv.className = 'lima-hk-slider-label';
      hkLabelDiv.innerHTML = `<span class="lima-hk-slider-name">${name}</span><span class="lima-hk-slider-value">${getBri()}%</span>`;
      const hkValSpan = hkLabelDiv.querySelector('.lima-hk-slider-value');

      hkWrap.appendChild(hkFill);
      hkWrap.appendChild(hkLabelDiv);

      let hkDragging = false;
      let briTimer   = null;

      const setFromX = (clientX) => {
        const rect = hkWrap.getBoundingClientRect();
        const pct  = Math.min(100, Math.max(1, Math.round(((clientX - rect.left) / rect.width) * 100)));
        hkFill.style.width  = `${pct}%`;
        hkValSpan.textContent = `${pct}%`;
        briValueEl.textContent = `${pct}%`;
        clearTimeout(briTimer);
        briTimer = setTimeout(() => {
          this._callService('light', 'turn_on', { entity_id: entityId, brightness_pct: pct });
        }, 150);
      };

      hkWrap.addEventListener('mousedown', e => { hkDragging = true; setFromX(e.clientX); });
      window.addEventListener('mousemove', e => { if (hkDragging) setFromX(e.clientX); });
      window.addEventListener('mouseup',   () => { hkDragging = false; });

      hkWrap.addEventListener('touchstart', e => { hkDragging = true; setFromX(e.touches[0].clientX); }, { passive: true });
      hkWrap.addEventListener('touchmove',  e => { if (hkDragging) { e.stopPropagation(); setFromX(e.touches[0].clientX); } }, { passive: true });
      hkWrap.addEventListener('touchend',   () => { hkDragging = false; });

      briSection.appendChild(briHeader);
      briSection.appendChild(hkWrap);
      controlsWrap.appendChild(briSection);
    }

    // ── Colour temperature slider ─────────────────────────────────────────
    let ctValueEl, ctSlider;
    if (supportsCT) {
      const ctSection = document.createElement('div');

      const ctHeader = document.createElement('div');
      ctHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
      const ctLabelEl = document.createElement('div');
      ctLabelEl.style.cssText = 'font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.06em;';
      ctLabelEl.textContent = 'Colour Temperature';
      ctValueEl = document.createElement('div');
      ctValueEl.style.cssText = `font-size:13px;font-weight:700;color:${accent};`;
      const kelvinToLabel = k => k < 3000 ? `${k}K · Warm` : k > 5000 ? `${k}K · Cool` : `${k}K`;
      ctValueEl.textContent = kelvinToLabel(getCT());
      ctHeader.appendChild(ctLabelEl);
      ctHeader.appendChild(ctValueEl);

      ctSlider = document.createElement('input');
      ctSlider.type  = 'range';
      ctSlider.min   = String(minCT);
      ctSlider.max   = String(maxCT);
      ctSlider.value = String(getCT());
      ctSlider.className = 'lima-ct-slider';

      let ctTimer = null;
      ctSlider.addEventListener('input', () => {
        ctValueEl.textContent = kelvinToLabel(parseInt(ctSlider.value));
        clearTimeout(ctTimer);
        ctTimer = setTimeout(() => {
          this._callService('light', 'turn_on', { entity_id: entityId, color_temp_kelvin: parseInt(ctSlider.value) });
        }, 150);
      });

      ctSection.appendChild(ctHeader);
      ctSection.appendChild(ctSlider);
      controlsWrap.appendChild(ctSection);
    }

    // ── Info rows ─────────────────────────────────────────────────────────
    const infoWrap = document.createElement('div');

    // Last changed row — clickable to show history
    const lastRow = document.createElement('div');
    lastRow.className = 'lima-info-row clickable';
    const lastLabelEl = document.createElement('span');
    lastLabelEl.className = 'lima-info-label';
    lastLabelEl.textContent = 'Last changed';
    const lastValueEl = document.createElement('span');
    lastValueEl.className = 'lima-info-value';
    lastValueEl.style.color = accent;

    const refreshLastChanged = () => {
      const so = this._hass?.states[entityId];
      const lc = so?.last_changed || so?.last_updated;
      if (lc) {
        const mins = Math.floor((Date.now() - new Date(lc).getTime()) / 60000);
        lastValueEl.textContent = (mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins/60)}h ago`) + ' ›';
      } else {
        lastValueEl.textContent = '— ›';
      }
    };
    refreshLastChanged();

    lastRow.appendChild(lastLabelEl);
    lastRow.appendChild(lastValueEl);
    lastRow.addEventListener('click', ev => {
      ev.stopPropagation();
      this._openHistoryPopup(entityId, name, accent, popupBg, textCol);
    });
    infoWrap.appendChild(lastRow);

    // Effects row — clickable if effects exist
    const effectList = getEffects();
    let effectRowValueEl = null;
    if (effectList.length) {
      const effectRow = document.createElement('div');
      effectRow.className = 'lima-info-row clickable';

      const effectLabelEl = document.createElement('span');
      effectLabelEl.className = 'lima-info-label';
      effectLabelEl.textContent = 'Effect';

      effectRowValueEl = document.createElement('span');
      effectRowValueEl.className = 'lima-info-value';
      effectRowValueEl.style.color = accent;
      effectRowValueEl.textContent = getEffect() ?? 'None ›';

      effectRow.appendChild(effectLabelEl);
      effectRow.appendChild(effectRowValueEl);

      // Open effect picker sheet
      effectRow.addEventListener('click', ev => {
        ev.stopPropagation();
        this._openEffectPicker(entityId, effectList, getEffect(), accent, popupBg, textCol);
      });

      infoWrap.appendChild(effectRow);
    }

    // Live refresh callback — called by hass setter
    this._refreshLightPopup = () => {
      refreshToggle();
      updateColourCircle();
      refreshLastChanged();
      if (supportsBri && hkFill && briValueEl) {
        const bri = getBri();
        hkFill.style.width = `${bri}%`;
        briValueEl.textContent = `${bri}%`;
        // Also update the label inside the slider
        const hkVal = hkFill.parentElement?.querySelector('.lima-hk-slider-value');
        if (hkVal) hkVal.textContent = `${bri}%`;
      }
      if (supportsCT && ctSlider && ctValueEl) {
        ctSlider.value = String(getCT());
        ctValueEl.textContent = (getCT() < 3000 ? `${getCT()}K · Warm` : getCT() > 5000 ? `${getCT()}K · Cool` : `${getCT()}K`);
      }
      if (effectRowValueEl) {
        effectRowValueEl.textContent = getEffect() ?? 'None ›';
      }
    };

    popup.appendChild(style);
    popup.appendChild(headerRow);
    popup.appendChild(toggleWrap);
    if (supportsBri || supportsCT) popup.appendChild(controlsWrap);
    popup.appendChild(infoWrap);

    lightOverlay.appendChild(popup);
    lightOverlay.addEventListener('click', e => { if (e.target === lightOverlay) closeLightPopup(); });
    document.body.appendChild(lightOverlay);
    this._lightPopup = lightOverlay;
  }

  // ── Colour Picker Sheet ───────────────────────────────────────────────────

  _openColourPicker(entityId, accent, popupBg, textCol, circleEl, onUpdate) {
    const existing = document.getElementById('lima-colour-sheet');
    if (existing) existing.remove();

    const PRESETS = [
      { label: 'Warm',    rgb: [255, 180, 107] },
      { label: 'Candle',  rgb: [255, 147, 41]  },
      { label: 'Neutral', rgb: [255, 235, 200] },
      { label: 'White',   rgb: [255, 255, 255] },
      { label: 'Daylight',rgb: [220, 235, 255] },
      { label: 'Red',     rgb: [255, 50,  50]  },
      { label: 'Orange',  rgb: [255, 130, 0]   },
      { label: 'Yellow',  rgb: [255, 215, 0]   },
      { label: 'Lime',    rgb: [100, 220, 0]   },
      { label: 'Green',   rgb: [0,   190, 80]  },
      { label: 'Teal',    rgb: [0,   200, 180] },
      { label: 'Cyan',    rgb: [0,   190, 255] },
      { label: 'Blue',    rgb: [50,  100, 255] },
      { label: 'Indigo',  rgb: [110, 50,  255] },
      { label: 'Violet',  rgb: [180, 50,  255] },
      { label: 'Pink',    rgb: [255, 80,  160] },
    ];

    const currRgb = this._getRgbColor(entityId);

    const sheet = document.createElement('div');
    sheet.id = 'lima-colour-sheet';
    sheet.style.cssText = `position:fixed;inset:0;z-index:11000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);`;

    const inner = document.createElement('div');
    inner.style.cssText = `background:${popupBg};border:1px solid rgba(255,255,255,0.13);border-radius:22px;padding:18px;width:100%;max-width:380px;font-family:${this._haFont()};color:${textCol};`;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
    titleRow.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;">Choose Colour</div>
      <button style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;color:rgba(255,255,255,0.65);font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit;">✕</button>`;
    titleRow.querySelector('button').addEventListener('click', () => sheet.remove());
    inner.appendChild(titleRow);

    // Swatches grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;';

    PRESETS.forEach(({ label, rgb }) => {
      const isActive = currRgb
        && Math.abs(currRgb[0] - rgb[0]) < 10
        && Math.abs(currRgb[1] - rgb[1]) < 10
        && Math.abs(currRgb[2] - rgb[2]) < 10;

      const swatch = document.createElement('div');
      swatch.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;';

      const circle = document.createElement('div');
      circle.style.cssText = `width:44px;height:44px;border-radius:50%;background:rgb(${rgb[0]},${rgb[1]},${rgb[2]});border:2px solid ${isActive ? '#fff' : 'transparent'};transition:transform 0.12s ease,border-color 0.12s;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;

      const lbl = document.createElement('div');
      lbl.style.cssText = `font-size:10px;color:${isActive ? '#fff' : 'rgba(255,255,255,0.4)'};font-weight:${isActive ? '700' : '500'};text-align:center;`;
      lbl.textContent = label;

      swatch.appendChild(circle);
      swatch.appendChild(lbl);

      swatch.addEventListener('mouseenter', () => { circle.style.transform = 'scale(1.12)'; });
      swatch.addEventListener('mouseleave', () => { circle.style.transform = ''; });
      swatch.addEventListener('click', ev => {
        ev.stopPropagation();
        this._callService('light', 'turn_on', { entity_id: entityId, rgb_color: rgb });
        if (circleEl) circleEl.style.background = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        if (onUpdate) onUpdate();
        sheet.remove();
      });

      grid.appendChild(swatch);
    });
    inner.appendChild(grid);

    // Custom colour picker row
    const customRow = document.createElement('div');
    customRow.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid rgba(255,255,255,0.07);';
    const customLabel = document.createElement('div');
    customLabel.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.55);font-weight:500;flex:1;';
    customLabel.textContent = 'Custom colour';
    const customInput = document.createElement('input');
    customInput.type = 'color';
    customInput.value = currRgb
      ? '#' + currRgb.map(v => v.toString(16).padStart(2, '0')).join('')
      : '#ffffff';
    customInput.style.cssText = 'width:36px;height:36px;border:none;border-radius:50%;cursor:pointer;padding:2px;background:none;';
    customInput.addEventListener('change', () => {
      const hex = customInput.value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this._callService('light', 'turn_on', { entity_id: entityId, rgb_color: [r, g, b] });
      if (circleEl) circleEl.style.background = `rgb(${r},${g},${b})`;
      if (onUpdate) onUpdate();
      sheet.remove();
    });
    customRow.appendChild(customLabel);
    customRow.appendChild(customInput);
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

  _openEffectPicker(entityId, effectList, currentEffect, accent, popupBg, textCol) {
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
    `;

    // Wire title
    const titleEl = this.shadowRoot.getElementById('title');
    titleEl.addEventListener('blur', () => this._commitConfig('title', titleEl.value.trim()));
    titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') titleEl.blur(); });

    // Wire search
    const searchEl = this.shadowRoot.getElementById('entity-search');
    searchEl.addEventListener('input', () => {
      this._searchTerm = searchEl.value;
      this._filterEntityList();
    });

    this._renderEntityList();
    this._buildColourGrid();
    this._setupReordering();
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