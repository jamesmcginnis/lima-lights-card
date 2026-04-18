# Lima Lights Card

A compact pill card for Home Assistant that shows how many lights are on at a glance. Tap to open a full light control popup — toggle any light on or off, adjust brightness and colour temperature, and use the All On / All Off buttons to control everything at once.

![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1+-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![License](https://img.shields.io/badge/license-MIT-green)

[![Open your Home Assistant instance and add this repository to HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=lima-lights-card&category=plugin)

---

## ✨ Features

### Pill Card
- 💡 **Compact pill design** — a slim 56px card shows how many of your lights are currently on at a glance (e.g. *3 of 7 on*, *All off*, *All on*)
- 🏷️ **Optional title** — show a label on the pill, or leave it blank to show just the count
- 🎨 **Frosted-glass popups** — smooth slide-up animations and fully customisable colours
- 📱 **Mobile optimised** — touch-friendly tap targets designed for iPhone dashboards

### Light Overview Popup
- 📊 **Stats bar** — shows On and Off counts across all configured lights; tap either pill to highlight the matching lights in the grid
- 💊 **Light pills** — each light is shown as its own tappable pill with its current state and brightness percentage; lit up in your accent colour when on, dimmed when off
- 🔘 **All On / All Off** — two quick-action buttons at the bottom to control all lights simultaneously

### Individual Light Control Popup
- 🔆 **Brightness slider** — smooth slider to set brightness from 1–100%; updates the light in real time as you drag
- 🌡️ **Colour temperature slider** — warm-to-cool gradient slider for lights that support colour temperature; displays the value in Kelvin
- 🔛 **On/Off toggle** — large, clear button to toggle the individual light; shows current brightness when on
- ℹ️ **Info row** — shows when the light last changed state

### Visual Editor
- 🔍 **Auto-detected lights** — all `light` domain entities in your Home Assistant instance are shown automatically
- 🔎 **Search and filter** — type to instantly filter the light list
- ☑️ **Toggle to select** — tap the toggle next to any light to add or remove it
- ↕️ **Drag-to-reorder** — drag selected lights using the grip handle to set the order they appear in the popup
- 🏷️ **Friendly names** — expand any selected light to set a custom display name
- 🎨 **Colour control** — seven colour pickers: Pill Background, Text, Accent, Light On, Light Off, Popup Background and Bulb Icon

### Configuration
- ⚙️ **Full visual editor** — no YAML required for any setting
- 📝 **YAML support** — all options are also configurable in YAML for power users

---

## 🚀 Installation

### HACS (Recommended)

[![Open your Home Assistant instance and add this repository to HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=lima-lights-card&category=plugin)

1. Open **HACS** in your Home Assistant instance
2. Click **Frontend**
3. Click the ⋮ menu → **Custom repositories**
4. Paste `https://github.com/jamesmcginnis/lima-lights-card` and set the category to **Dashboard**
5. Click **Download**
6. Restart Home Assistant

### Manual Installation

1. Download `lima-lights-card.js`
2. Copy it into your `config/www/` folder
3. Add the resource in your Lovelace configuration:

```yaml
lovelace:
  resources:
    - url: /local/lima-lights-card.js
      type: module
```

4. Restart Home Assistant

---

## ⚙️ Configuration

### Quick Start

1. Edit your dashboard and click **Add Card**
2. Search for **Lima Lights**
3. Use the **visual editor** to select your lights and configure colours
4. Hit **Save** — done!

### YAML Example

```yaml
type: custom:lima-lights-card
entities:
  - light.living_room
  - light.bedroom
  - light.kitchen
  - light.hallway
title: Lights
accent_color: '#FFD60A'
on_color: '#FFD60A'
off_color: '#48484A'
icon_color: '#FFD60A'
pill_bg: '#1c1c1e'
text_color: '#ffffff'
popup_bg: '#1c1c1e'
friendly_names:
  light.living_room: Living Room
  light.bedroom: Bedroom
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entities` | list | `[]` | List of light entity IDs to display, in display order |
| `title` | string | _(blank)_ | Label shown on the pill card. Leave blank to hide |
| `accent_color` | string | `#FFD60A` | Highlight colour for active states, sliders and controls |
| `on_color` | string | `#FFD60A` | Colour used to indicate a light is on |
| `off_color` | string | `#48484A` | Colour used to indicate a light is off |
| `icon_color` | string | `#FFD60A` | Colour of the bulb icon on the pill card |
| `pill_bg` | string | `#1c1c1e` | Background colour of the main pill card |
| `text_color` | string | `#ffffff` | Primary text colour |
| `popup_bg` | string | `#1c1c1e` | Background colour of all popup dialogs |
| `friendly_names` | map | `{}` | Custom display names keyed by entity ID |

---

## 🎨 Colour System

| Field | Default | What it affects |
|-------|---------|----------------|
| **Pill Background** | `#1c1c1e` | The background of the main pill card |
| **Text** | `#ffffff` | Labels and count text |
| **Accent** | `#FFD60A` | Slider colour, active stat pill highlight, control buttons |
| **Light On** | `#FFD60A` | Pill icon and brightness text when a light is on |
| **Light Off** | `#48484A` | Pill icon when a light is off |
| **Popup Background** | `#1c1c1e` | The background of the overview and control popups |
| **Bulb Icon** | `#FFD60A` | The bulb icon on the pill card |

---

## 💡 How Controls Work

### Brightness
The brightness slider is shown for any light that supports dimming (i.e. reports a `brightness` attribute). Dragging the slider sends a `light.turn_on` service call with `brightness_pct`. Updates are debounced by 200ms to avoid flooding the HA bus while dragging.

### Colour Temperature
The colour temperature slider is shown for lights that include `color_temp` in their `supported_color_modes`. The slider spans the light's own `min_color_temp_kelvin` to `max_color_temp_kelvin` and displays a warm-to-cool gradient. Values are sent as `color_temp_kelvin`.

### All On / All Off
These buttons call `light.turn_on` or `light.turn_off` for every entity in your configured list simultaneously.

---

## 🔍 Auto-Detection

The visual editor automatically discovers all entities in the `light` domain from your Home Assistant instance, sorted alphabetically by friendly name. No manual entity ID typing required.

---

## 🔧 Troubleshooting

**Card doesn't appear after installation**
- Add the resource to Lovelace (see Installation above) and hard-refresh: `Ctrl+Shift+R` / `Cmd+Shift+R`

**No lights appear in the editor**
- Ensure your entities are in the `light` domain (entity IDs starting with `light.`)

**Brightness slider doesn't appear**
- The slider only appears for lights that report a `brightness` attribute. Lights that only support on/off will show just the toggle button

**Colour temperature slider doesn't appear**
- The slider only appears for lights with `color_temp` in their `supported_color_modes` attribute

**Popup doesn't open when tapping the pill**
- Ensure at least one entity is configured and that the entity exists in your Home Assistant instance

**Keyboard closes while typing on iPhone**
- All text fields save on blur rather than on every keystroke, which prevents HA from rebuilding the editor mid-input. Tap the field, type, then tap elsewhere to save

---

## 📄 License

MIT License — free to use, modify and distribute.

---

## ⭐ Support

If this card is useful to you, please **star the repository** and share it with the community!

For bugs or feature requests, use the [GitHub Issues](../../issues) page.
