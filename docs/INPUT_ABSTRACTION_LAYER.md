# Input Abstraction Layer (IAL) Blueprint

**Document Version:** 1.0
**Date:** April 14, 2026
**Status:** Draft

---

## 1. Overview

The **Input Abstraction Layer (IAL)** is a central component that normalizes all hardware inputs into a unified channel representation before passing them to the simulator.

```
┌──────────────────────────────────────────────────────────┐
│  Hardware Inputs                                         │
│                                                          │
│  ┌────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │  Gamepad   │    │  SITL/HITL   │    │  Keyboard   │ │
│  └─────┬──────┘    └──────┬───────┘    └──────┬──────┘ │
│        │                   │                   │        │
│        └───────────────────┼───────────────────┘        │
│                            ▼                             │
│                  ┌─────────────────┐                    │
│                  │   IAL           │                    │
│                  │  (normalization, │                    │
│                  │   mapping,      │                    │
│                  │   priority)     │                    │
│                  └────────┬────────┘                    │
│                           ▼                             │
│                  ┌─────────────────┐                    │
│                  │   Simulator     │                    │
│                  └─────────────────┘                    │
└──────────────────────────────────────────────────────────┘
```

**Control flow:**
```
Gamepad  → IAL → Simulator
SITL/HITL → IAL → Simulator   (overrides gamepad/keyboard for aircraft control)
Keyboard → IAL → Simulator     (always available for local overrides: pause, reset)
```

**Control selection:** Priority-based with "last active wins" fallback:
```
[SBUS / Plugin] → [Gamepad] → [Keyboard] → (hard fallback)
```

When SITL/HITL is connected:
- Aircraft control inputs are **hard overridden** by SITL (gamepad/keyboard bypassed for flight surfaces)
- Keyboard/gamepad remain active for **local simulator controls only** (pause, reset)

---

## 2. Channel Model

- **16 channels** (matching RC receiver standard)
- Each channel is a normalized float: `-1.0 to +1.0` (control surfaces), `0.0 to 1.0` (throttle/flags)
- Default mapping (Simple Mode):

| Channel | Default Control |
|---------|-----------------|
| 1 | Aileron |
| 2 | Elevator |
| 3 | Throttle |
| 4 | Rudder |
| 5–16 | Reserved / FC modes / custom |

---

## 3. Modes

### Simple Mode

User maps axes/buttons directly to control names (aileron, elevator, throttle, rudder). IAL internally maps to channel numbers.

```
Axis 0 → Aileron (→ Channel 1)
Axis 1 → Elevator (→ Channel 2)
Axis 3 → Throttle (→ Channel 3)
```

### Advanced Mode

User maps axes/buttons directly to channel numbers. Enables FC mode switches, flaps, and other extended channel usage.

```
Axis 0 → Channel 1
Button 4 → Channel 5 (flaps toggle)
Button 5 → Channel 8 (mode switch)
```

---

## 4. Input Sources

### Gamepad / Keyboard

- Managed by `GamepadManager` and `KeyboardInput`
- Gamepad profiles stored per-controller ID
- Keyboard is always the final fallback for aircraft control

### Plugin System (SBUS, CRSF, iBus, PPM, etc.)

- Each plugin is a protocol decoder
- Plugins communicate via event-based interface (plugin fires event with channel data)
- Third-party extensible (internal included)
- Plugin delivery mechanism: **deferred to future phase**

**Plugin interface (conceptual):**
```typescript
interface InputPlugin {
  readonly id: string;
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): void;
  onChannelData: (channels: number[]) => void;
}
```

---

## 5. Gamepad Profile

Each profile stores:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | User-assigned name (e.g., "Xbox Controller") |
| `gamepadIdPattern` | Substring match against `Gamepad.id` for auto-detection |
| `mode` | Simple or Advanced |
| `axisMappings` | Array of `{ axisIndex, channel, inverted, deadzone }` |
| `buttonMappings` | Array of `{ buttonIndex, channel, action }` |
| `trim` | Per-channel one-directional offset values (channel → offset, range ±10%) |
| `globalDeadzone` | Default deadzone for all axes |

---

## 6. Controller Onboarding & Detection

### On first connect of a new controller:

1. Detect hardware connected
2. Prompt user: "Auto-map" (move sticks/press buttons to learn) or "Manual map"
3. After onboarding, auto-switch to that controller as active

### On reconnect of known controller:

1. Detect hardware connected
2. Match against saved profiles by `gamepadIdPattern`
3. Auto-activate matched profile

### Active controller switching:

- If multiple controllers connected, user can switch manually
- "Last active wins" — if active controller disconnects, fallback to last-used controller
- Keyboard is always the final fallback

---

## 7. SITL/HITL Integration

- SITL provides channel data (not limited to 4 channels — all 16 channels supported)
- SITL overrides all other inputs for aircraft control (gamepad/keyboard hard bypassed)
- Keyboard/gamepad remain available for local simulator controls (pause, reset)
- SITL passthrough mode: SITL channels → IAL → Simulator (preserving extended channels for FC modes)

---

## 8. Persistence

Stored in localStorage:

- Gamepad profiles
- Last active controller index
- Per-profile trim values
- Channel mapping preferences
- Active IAL mode (simple/advanced)

---

## 9. Extended Channels in Simulator

- `FlySimCore` supports all 16 channels (ch 0–3 primary surfaces: aileron, elevator, throttle, rudder; ch 4–15 extended/FC modes, mapped to `fcs/channel-N-norm` properties)
- `AircraftControls` / `SimManager` accept the full 16-channel array via `setChannels()`
- SITL passes through all 16 channels

---

## 10. Telemetry

- Toggle to show all 16 channels or just primary 4
- Default view: 4 primary channels
- Extended channels shown on demand

---

## 11. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Plugin discovery and loading mechanism (npm, user-upload, registry) | Deferred |
| 2 | Per-channel trim range (currently ±10%) | TBD |
| 3 | UI implementation details (modal vs inline) | TBD |

---

*End of Document*
