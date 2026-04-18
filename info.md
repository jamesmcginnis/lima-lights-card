# Lima Lights Card

A compact pill card for Home Assistant that shows how many lights are on at a glance. Tap to open a full light control popup — toggle lights, adjust brightness and colour temperature, and turn everything on or off at once.

## Key Features

- **Compact pill design** — a slim 56px card shows the current light count at a glance (e.g. *3 of 7 on*, *All off*); title is optional
- **Auto-detection** — automatically finds all `light` domain entities in your Home Assistant instance; no manual entity ID typing needed
- **Light overview popup** — tap the pill to open a popup showing each light as its own pill with its current state and brightness; tap the On/Off stat pills to highlight matching lights in the grid
- **All On / All Off** — quick-action buttons to control all configured lights simultaneously
- **Individual light control** — tap any light pill to open a full control popup with on/off toggle, brightness slider and colour temperature slider (shown only when the light supports them)
- **Friendly names** — assign a custom display name to any light directly in the visual editor
- **Drag-to-reorder** — drag selected lights in the visual editor to set the order they appear in the popup
- **Full colour control** — customise pill background, text, accent, light on colour, light off colour, popup background and bulb icon colours with native colour pickers

## Quick Start

```yaml
type: custom:lima-lights-card
entities:
  - light.living_room
  - light.bedroom
  - light.kitchen
title: Lights
accent_color: '#FFD60A'
on_color: '#FFD60A'
```

All settings can be configured through the built-in visual editor — no YAML editing required!
