# Lima Lights Card

A compact pill card for Home Assistant that shows how many lights are on at a glance. Tap to open a full light control popup — toggle lights on or off, adjust brightness, colour temperature and RGB colour, pick light effects, and turn everything on or off at once with a confirmation step.

## Key Features

- **Compact pill design** — a slim 56px card shows the current light count at a glance (e.g. *3 of 7 On*, *All Off*); optional title label
- **Pill fill bar** — a proportional fill behind the pill grows as more lights turn on, with a configurable fill colour
- **Bulb icon shortcut** — tap the bulb icon to instantly turn all lights on or off (a friendly confirmation popup appears first)
- **Auto-detection** — automatically finds all `light` domain entities in your Home Assistant instance; no manual entity ID typing needed
- **Light overview popup** — tap the pill to open a popup showing each light as its own pill with its current state and brightness; tap the On or Off stat pill to highlight matching lights in the grid
- **Single tap to toggle** — tap any light pill in the overview to toggle it on or off immediately; the pill updates instantly without waiting for Home Assistant to respond
- **Long press for detail** — hold a light pill for 500 ms to open the full individual light control popup
- **All On / All Off** — quick-action buttons to control all configured lights simultaneously
- **Individual light control** — brightness slider, colour temperature slider, RGB colour picker (with 16 presets and a custom colour input), and an effects picker — each shown only when the light supports them
- **Colour-aware indicator** — the on/off circle in the detail popup reflects the light's current RGB colour and is tappable to open the colour picker
- **Light history** — tap the *Last changed* row in the detail popup to view a 24-hour state timeline
- **Basic light note** — lights that support only on/off and brightness show a friendly note explaining colour and effects are not available
- **Friendly names** — assign a custom display name to any light directly in the visual editor
- **Drag-to-reorder** — drag selected lights in the visual editor to set the order they appear in the popup
- **Full colour control** — eight colour pickers: Pill Background, Text, Accent, Pill Fill, Light On, Light Off, Popup Background and Bulb Icon

## Quick Start

```yaml
type: custom:lima-lights-card
entities:
  - light.living_room
  - light.bedroom
  - light.kitchen
title: Lights
accent_color: '#FFD60A'
fill_color: '#FFD60A'
on_color: '#FFD60A'
```

All settings can be configured through the built-in visual editor — no YAML editing required!