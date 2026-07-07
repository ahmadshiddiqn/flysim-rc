# Functional Requirements Document (FRD)
# FlySim-RC: Browser-Based RC Aircraft Simulator

**Document Version:** 1.0  
**Date:** March 5, 2026  
**Author:** Development Team  
**Status:** Draft

---

## 1. Introduction

### 1.1 Purpose
This document defines the functional requirements for FlySim-RC, detailing what the system must do to meet user needs and achieve product goals.

### 1.2 Scope
This document covers all functional requirements for Phase 1 (Foundation) through Phase 3 (Integration). Each requirement includes a unique identifier, description, priority, and acceptance criteria.

### 1.3 Definitions & Acronyms

See PRD Section 8 (Glossary) for complete list.

---

## 2. Functional Requirements

### 2.1 Core Simulation Engine (SIM)

#### SIM-001: Flight Dynamics Model Integration
**Priority:** Critical  
**Description:** The system shall integrate JSBSim flight dynamics model compiled to WebAssembly.

**Requirements:**
- SIM-001.1: Load JSBSim as ES6 module in browser
- SIM-001.2: Initialize FDM with specified root directory
- SIM-001.3: Execute simulation steps at configurable rate (default 120Hz)
- SIM-001.4: Maintain simulation state across multiple steps
- SIM-001.5: Support pause/resume functionality

**Acceptance Criteria:**
- [ ] JSBSim WASM loads successfully in Chrome, Firefox, Safari, Edge
- [ ] Can initialize FDM with root path
- [ ] Can run 10,000 steps without memory leaks
- [ ] Pause/resume works without state corruption
- [ ] Physics rate configurable via UI (60-240Hz)

---

#### SIM-002: Property System Interface
**Priority:** Critical  
**Description:** The system shall provide bidirectional access to JSBSim property tree.

**Requirements:**
- SIM-002.1: Read double precision properties from FDM
- SIM-002.2: Write double precision properties to FDM
- SIM-002.3: Read string properties from FDM
- SIM-002.4: Write string properties to FDM
- SIM-002.5: Batch property updates (atomic transaction)

**Property Categories:**
- Position (lat, lon, alt, h-agl-ft)
- Attitude (phi, theta, psi)
- Velocities (u, v, w, p, q, r)
- Controls (aileron, elevator, rudder, throttle)
- Environment (wind-north, wind-east, wind-down)

**Acceptance Criteria:**
- [ ] Can read all standard aircraft properties
- [ ] Can write control inputs
- [ ] Property changes reflect in simulation within 1 physics step
- [ ] Can read 100+ properties at 60Hz without performance loss
- [ ] Invalid property names handled gracefully (return NaN or default)

---

#### SIM-003: Aircraft Loading
**Priority:** Critical  
**Description:** The system shall load aircraft definitions from XML configuration files.

**Requirements:**
- SIM-003.1: Load aircraft from embedded/preloaded files
- SIM-003.2: Parse JSBSim aircraft XML format
- SIM-003.3: Validate aircraft configuration
- SIM-003.4: Switch aircraft without page reload
- SIM-003.5: Display aircraft loading progress
- SIM-003.6: Handle missing or corrupt aircraft files gracefully

**Acceptance Criteria:**
- [ ] Load Cessna 172 from XML
- [ ] Load Piper Cub from XML
- [ ] Aircraft switch completes in <3 seconds
- [ ] Invalid aircraft shows error message (doesn't crash)
- [ ] Progress indicator shown during loading
- [ ] Can list available aircraft from root directory

---

#### SIM-004: Simulation Control
**Priority:** High  
**Description:** The system shall provide controls for managing simulation state.

**Requirements:**
- SIM-004.1: Start simulation
- SIM-004.2: Pause simulation
- SIM-004.3: Reset to initial conditions
- SIM-004.4: Single-step advance (frame-by-frame)
- SIM-004.5: Set simulation speed (0.25x - 2x real-time)
- SIM-004.6: Save simulation state (snapshot)
- SIM-004.7: Load simulation state (restore)

**Acceptance Criteria:**
- [ ] Play/pause toggle works via UI and keyboard (Space)
- [ ] Reset returns aircraft to initial position/attitude
- [ ] Single-step advances exactly one physics frame
- [ ] Time scale affects physics but not UI responsiveness
- [ ] Save/load preserves exact aircraft state
- [ ] Can save 10+ named snapshots

---

### 2.2 Input System (INP)

#### INP-001: Gamepad Support
**Priority:** High  
**Description:** The system shall support standard game controllers via Gamepad API with configurable profiles and extended channel mapping.

**Requirements:**
- INP-001.1: Detect connected gamepads and display in UI
- INP-001.2: Support multiple gamepads simultaneously, user selects active controller
- INP-001.3: Auto-detect controller by matching `Gamepad.id` against saved profile patterns
- INP-001.4: Gamepad profiles: name, ID pattern, axis-to-channel mapping, button-to-action mapping, trim, deadzone
- INP-001.5: Simple Mode: map axes to control names (aileron, elevator, throttle, rudder)
- INP-001.6: Advanced Mode: map axes directly to channel numbers (1–16)
- INP-001.7: Controller onboarding: auto-map via stick movement detection, manual map via UI dropdowns
- INP-001.8: Per-axis invert and deadzone per profile
- INP-001.9: Per-channel one-directional trim (range ±10%)
- INP-001.10: 16-channel support (extend from 4-channel model)

**Default Simple Mode Mapping:**
```
Axis 0 → Aileron   (Channel 1)
Axis 1 → Elevator  (Channel 2)
Axis 2 → Rudder    (Channel 4)
Axis 3 → Throttle  (Channel 3, inverted)
Button 0 → Reset aircraft
Button 1 → Pause
```

**Acceptance Criteria:**
- [ ] Detect Xbox and PlayStation controllers automatically
- [ ] On first connect, prompt for auto-map or manual map
- [ ] Auto-switch to newly onboarded controller after mapping
- [ ] "Last active wins" when active controller disconnects
- [ ] Fallback to keyboard when no gamepad connected
- [ ] Deadzone eliminates drift when centered
- [ ] Per-axis inversion configurable per profile
- [ ] Gamepad bypassed for aircraft control when SITL/HITL connected
- [ ] All 16 channels passed through to simulator (not limited to 4)

---

#### INP-002: Keyboard Controls
**Priority:** Medium  
**Description:** The system shall provide keyboard fallback for aircraft control.

**Requirements:**
- INP-002.1: Arrow keys or WASD for pitch/roll
- INP-002.2: Q/E or Z/C for rudder
- INP-002.3: Shift/Ctrl or W/S for throttle
- INP-002.4: Space for pause
- INP-002.5: R for reset
- INP-002.6: Configurable key bindings
- INP-002.7: Smooth ramping (not instant) for keyboard inputs
- INP-002.8: Keyboard always available for local simulator controls (pause, reset) even when SITL/HITL connected

**Acceptance Criteria:**
- [ ] All flight controls accessible via keyboard
- [ ] Input smoothing prevents jerky movements
- [ ] Key bindings shown in UI overlay
- [ ] Can reassign keys in settings
- [ ] Simultaneous key presses work correctly
- [ ] Keyboard always active for local controls regardless of SITL/HITL state

---

#### INP-003: Input Abstraction Layer (IAL)
**Priority:** High  
**Description:** The IAL is a central component that normalizes all hardware inputs into a unified 16-channel representation before passing to the simulator.

**Requirements:**
- INP-003.1: Central input router for all hardware sources
- INP-003.2: 16-channel normalized data model (-1.0 to +1.0 for control surfaces, 0.0 to 1.0 for throttle/flags)
- INP-003.3: Priority-based control selection: [SBUS/Plugin] → [Gamepad] → [Keyboard] → hard fallback
- INP-003.4: "Last active wins" with keyboard as final fallback
- INP-003.5: SITL/HITL hard overrides gamepad/keyboard for aircraft control; local controls remain active
- INP-003.6: Plugin interface for protocol decoders (SBUS, CRSF, iBus, PPM)
- INP-003.7: Extended channels (5–16) forwarded to FC via SITL for mode switches, flaps, arming, etc.
- INP-003.8: Persistence: profiles, trim, last active controller, mode preference

**Control Flow:**
```
Gamepad  → IAL → Simulator
SITL/HITL → IAL → Simulator  (overrides gamepad/keyboard for aircraft control)
Keyboard → IAL → Simulator   (always available for local controls)
```

**Acceptance Criteria:**
- [ ] All input sources feed through IAL
- [ ] 16 channels available to simulator
- [ ] SITL passthrough preserves all channels
- [ ] Active controller switches automatically on connect/disconnect
- [ ] Profiles persist across sessions

---

#### INP-004: Virtual Transmitter
**Priority:** Low  
**Description:** The system shall provide on-screen virtual RC transmitter.

**Requirements:**
- INP-004.1: Display 2D sticks (left/right)
- INP-004.2: Display trim sliders
- INP-004.3: Touch/mouse control of sticks
- INP-004.4: Mode selection (Mode 1/Mode 2/Mode 3/Mode 4)
- INP-004.5: Display channel values numerically
- INP-004.6: Toggle to show all 16 channels or primary 4

**Acceptance Criteria:**
- [ ] Virtual transmitter visible on screen
- [ ] Sticks respond to mouse/touch drag
- [ ] Mode 2 (default): Left stick throttle/yaw, Right stick pitch/roll
- [ ] Trim values adjustable via UI
- [ ] Works on touchscreen devices
- [ ] Extended channels (5–16) visible on demand

---

### 2.3 Output & Visualization (OUT)

#### OUT-001: 2D Instrument Panel
**Priority:** High  
**Description:** The system shall display essential flight instruments in 2D panel.

**Requirements:**
- OUT-001.1: Airspeed indicator (knots and km/h)
- OUT-001.2: Altimeter (ft and m)
- OUT-001.3: Artificial horizon (attitude indicator)
- OUT-001.4: Heading indicator (compass)
- OUT-001.5: Vertical speed indicator (VSI)
- OUT-001.6: Turn coordinator
- OUT-001.7: Engine instruments (tachometer, fuel)
- OUT-001.8: Configurable instrument layout

**Acceptance Criteria:**
- [ ] All instruments update at 30Hz minimum
- [ ] Airspeed reads 0-200 knots
- [ ] Altitude reads -1000 to 50,000 ft
- [ ] Horizon shows roll ±60°, pitch ±30°
- [ ] Instruments match real aircraft appearance
- [ ] Can toggle individual instruments on/off

---

#### OUT-002: Telemetry Display
**Priority:** Medium  
**Description:** The system shall display raw telemetry data for debugging.

**Requirements:**
- OUT-002.1: Display position (lat/lon/alt)
- OUT-002.2: Display velocities (body and earth frame)
- OUT-002.3: Display angular rates (p, q, r)
- OUT-002.4: Display control surface positions
- OUT-002.5: Display forces and moments (optional)
- OUT-002.6: Copy-to-clipboard functionality
- OUT-002.7: Export to CSV format

**Acceptance Criteria:**
- [ ] Telemetry panel shows 20+ parameters
- [ ] Values update at 10Hz
- [ ] Export creates valid CSV file
- [ ] Scientific notation for small values
- [ ] Configurable precision (decimal places)

---

#### OUT-003: Flight Visualization
**Priority:** Medium  
**Description:** The system shall provide visual representation of aircraft state.

**Requirements:**
- OUT-003.1: 2D top-down view (map-like)
- OUT-003.2: 2D side view (profile)
- OUT-003.3: Display flight path trail
- OUT-003.4: Display ground track
- OUT-003.5: Display velocity vector
- OUT-003.6: Zoom and pan capabilities

**Acceptance Criteria:**
- [ ] Aircraft icon shows current heading
- [ ] Trail persists for last 60 seconds
- [ ] Ground track visible
- [ ] Velocity vector arrow direction and magnitude
- [ ] Zoom from 100m to 10km scale
- [ ] Pan to follow aircraft or free view

---

### 2.4 Recording & Replay (REC)

#### REC-001: Flight Recording
**Priority:** Medium  
**Description:** The system shall record flight sessions for later analysis.

**Requirements:**
- REC-001.1: Start/stop recording
- REC-001.2: Record at 10Hz (configurable)
- REC-001.3: Store position, attitude, velocities, controls
- REC-001.4: Auto-save on session end
- REC-001.5: Named recordings
- REC-001.6: Maximum recording duration (30 minutes)
- REC-001.7: Recording size limit (100MB)

**Acceptance Criteria:**
- [ ] Record 30-minute flight without data loss
- [ ] Recording format is JSON or binary
- [ ] Can name recordings at save
- [ ] List shows duration and file size
- [ ] Delete recordings individually

---

#### REC-002: Flight Replay
**Priority:** Medium  
**Description:** The system shall replay recorded flights.

**Requirements:**
- REC-002.1: Load recorded flight
- REC-002.2: Play/pause replay
- REC-002.3: Scrub timeline (jump to specific time)
- REC-002.4: Adjust replay speed (0.5x - 2x)
- REC-002.5: Display recording alongside live flight (ghost mode)
- REC-002.6: Export replay as video (future)

**Acceptance Criteria:**
- [ ] Replay matches recorded flight exactly
- [ ] Can pause and step frame-by-frame
- [ ] Scrubber shows position on timeline
- [ ] Ghost mode overlays recorded vs live
- [ ] Replay loop option

---

### 2.5 SITL/HITL Integration (SITL)

#### SITL-001: MAVLink Protocol Support
**Priority:** High  
**Description:** The system shall implement MAVLink protocol for autopilot communication.

**Requirements:**
- SITL-001.1: Parse MAVLink v2.0 messages
- SITL-001.2: Generate MAVLink messages
- SITL-001.3: Support HIL_ACTUATOR_CONTROLS (receive)
- SITL-001.4: Support HIL_SENSOR (send)
- SITL-001.5: Support HIL_GPS (send)
- SITL-001.6: Support HIL_STATE_QUATERNION (send)
- SITL-001.7: Message rate limiting

**Acceptance Criteria:**
- [ ] Connect to ArduPilot SITL successfully
- [ ] Receive actuator commands at 50Hz
- [ ] Send sensor data at 50Hz
- [ ] Latency <50ms measured end-to-end
- [ ] No dropped messages under normal conditions
- [ ] Works with both ArduPilot and PX4

---

#### SITL-002: WebSocket Server
**Priority:** High  
**Description:** The system shall provide WebSocket server for external connections.

**Requirements:**
- SITL-002.1: Start WebSocket server on configurable port
- SITL-002.2: Accept single client connection
- SITL-002.3: Binary message support (MAVLink)
- SITL-002.4: Connection status indicator
- SITL-002.5: Auto-reconnect support
- SITL-002.6: WSS (secure) support

**Acceptance Criteria:**
- [ ] Server starts on specified port
- [ ] Client can connect from external application
- [ ] Binary MAVLink messages transmit correctly
- [ ] Connection status visible in UI
- [ ] Graceful handling of disconnections

---

#### SITL-003: UDP Passthrough
**Priority:** Medium  
**Description:** The system shall support UDP passthrough mode for native tools.

**Requirements:**
- SITL-003.1: Configure UDP input port
- SITL-003.2: Configure UDP output port
- SITL-003.3: Forward MAVLink over UDP
- SITL-003.4: Localhost and remote host support
- SITL-003.5: Protocol selection (MAVLink or custom)

**Acceptance Criteria:**
- [ ] Connect to Mission Planner via UDP
- [ ] Connect to QGroundControl via UDP
- [ ] Bidirectional communication works
- [ ] Packet loss <1% on localhost

---

#### SITL-004: Configuration Interface
**Priority:** Medium  
**Description:** The system shall provide UI for configuring SITL connection.

**Requirements:**
- SITL-004.1: Select connection type (WebSocket/UDP)
- SITL-004.2: Configure port numbers
- SITL-004.3: Configure host address
- SITL-004.4: Test connection button
- SITL-004.5: Save configuration
- SITL-004.6: Display connection statistics

**Acceptance Criteria:**
- [ ] UI shows all configuration options
- [ ] Test connection verifies connectivity
- [ ] Settings persist across sessions
- [ ] Statistics show messages/sec and latency
- [ ] Error messages for connection failures

---

### 2.6 User Interface (UI)

#### UI-001: Main Interface Layout
**Priority:** High  
**Description:** The system shall provide organized, intuitive user interface.

**Requirements:**
- UI-001.1: Menu bar (File, Aircraft, View, Settings, Help)
- UI-001.2: Main viewport (instruments/visualization)
- UI-001.3: Sidebar panels (telemetry, controls, settings)
- UI-001.4: Status bar (connection, FPS, simulation time)
- UI-001.5: Responsive layout (resize handling)
- UI-001.6: Fullscreen mode

**Acceptance Criteria:**
- [ ] All UI elements visible at 1280x720
- [ ] Layout adapts to different aspect ratios
- [ ] Fullscreen toggle works (F11)
- [ ] No UI overlap at minimum resolution
- [ ] Touch-friendly targets (min 44px)

---

#### UI-002: Aircraft Selection
**Priority:** High  
**Description:** The system shall provide aircraft selection interface.

**Requirements:**
- UI-002.1: Display available aircraft list
- UI-002.2: Show aircraft thumbnail/preview
- UI-002.3: Show aircraft specifications
- UI-002.4: Filter by type (trainer, sport, warbird, etc.)
- UI-002.5: Search by name
- UI-002.6: Add custom aircraft (file upload)

**Acceptance Criteria:**
- [ ] List shows 10+ aircraft
- [ ] Thumbnails load quickly
- [ ] Specs show wingspan, weight, engine type
- [ ] Filter reduces list appropriately
- [ ] Search finds partial matches
- [ ] Upload validates XML format

---

#### UI-003: Settings Panel
**Priority:** Medium  
**Description:** The system shall provide comprehensive settings configuration.

**Requirements:**
- UI-003.1: Graphics settings (instrument transparency, etc.)
- UI-003.2: Input settings (sensitivity, deadzone, bindings)
- UI-003.3: Simulation settings (physics rate, time scale)
- UI-003.4: Audio settings (volume, mute)
- UI-003.5: SITL settings (connection parameters)
- UI-003.6: Export/import settings

**Acceptance Criteria:**
- [ ] All settings categories accessible
- [ ] Changes apply immediately or on save
- [ ] Settings persist in localStorage
- [ ] Export creates downloadable JSON
- [ ] Import validates settings file
- [ ] Reset to defaults option

---

#### UI-004: Help System
**Priority:** Low  
**Description:** The system shall provide in-application help.

**Requirements:**
- UI-004.1: Keyboard shortcuts reference
- UI-004.2: Quick start guide
- UI-004.3: Control reference for current aircraft
- UI-004.4: Troubleshooting tips
- UI-004.5: Link to online documentation
- UI-004.6: Context-sensitive tooltips

**Acceptance Criteria:**
- [ ] Help accessible via F1 or menu
- [ ] Shortcuts shown in table format
- [ ] Tooltips appear on hover (1 second delay)
- [ ] Quick start covers basic flight
- [ ] External links open in new tab

---

## 3. Data Requirements

### 3.1 Aircraft Data Format

Aircraft definitions follow JSBSim XML format:

```xml
<Aircraft name="Cessna 172">
  <Description>
    <Author>...</Author>
    <FileCreationDate>...</FileCreationDate>
  </Description>
  <Metrics>...</Metrics>
  <MassBalance>...</MassBalance>
  <GroundReactions>...</GroundReactions>
  <Propulsion>...</Propulsion>
  <FlightControl>...</FlightControl>
  <Aerodynamics>...</Aerodynamics>
</Aircraft>
```

### 3.2 Configuration Storage

User settings stored in browser localStorage:

```json
{
  "version": "1.0",
  "aircraft": {
    "lastUsed": "c172p",
    "favorites": ["c172p", "pa18"]
  },
  "input": {
    "gamepadSensitivity": 1.0,
    "deadzone": 0.1,
    "keyboardSmoothing": 0.3
  },
  "simulation": {
    "physicsRate": 120,
    "timeScale": 1.0
  },
  "sitl": {
    "connectionType": "websocket",
    "port": 5760,
    "host": "127.0.0.1"
  },
  "ui": {
    "instrumentOpacity": 0.9,
    "theme": "dark"
  }
}
```

### 3.3 Telemetry Export Format

CSV export format:

```csv
time,altitude_ft,airspeed_kts,heading_deg,pitch_deg,roll_deg
0.0,1000.0,60.0,90.0,2.0,0.0
0.1,1000.2,60.1,90.1,2.1,0.1
...
```

---

## 4. Interface Specifications

### 4.1 JavaScript API

```javascript
// Core simulation interface — actual shipped API.
// One FlySimCore instance owns one FDM; create multiple instances for
// multiple aircraft (there is no createFDM(id) multiplexing).
class FlySimCore {
  static async create(options: FlySimOptions): Promise<FlySimCore>;
  loadAircraftScript(path, deltaT?, initFile?): boolean;
  loadModel(model, options?): boolean;
  start(): void;
  stop(): void;
  destroy(): void;
  getProperty(path): number;
  setProperty(path, value): void;
  queryPropertyCatalog(prefix): string;
  hasProperty(path): boolean;
  getPropertyOrNull(path): number | null;
  getPropertyStrict(path): number;
  setControls(controls): void;
  setChannels(ch): void;          // 16-channel input (0–3 primary, 4–15 → fcs/channel-N-norm)
  [Symbol.dispose](): void;
  [Symbol.asyncDispose](): Promise<void>;
}

// Input Abstraction Layer interface
class InputManager {
  // Gamepad management
  getConnectedGamepads(): Gamepad[];
  getActiveGamepadIndex(): number | null;
  setActiveGamepad(index: number): void;

  // Profile management
  getProfiles(): GamepadProfile[];
  createProfile(name: string, gamepadIdPattern: string): GamepadProfile;
  updateProfile(id: string, patch: Partial<GamepadProfile>): void;
  deleteProfile(id: string): void;
  setActiveProfile(id: string | null): void;

  // Configuration
  getConfig(): GamepadConfig;
  saveConfig(): void;
  loadConfig(): GamepadConfig;

  // Events
  on(event: 'gamepadConnected' | 'gamepadDisconnected' | 'profileChanged', cb: Function): void;
}

// GamepadProfile structure
interface GamepadProfile {
  id: string;
  name: string;
  gamepadIdPattern: string;
  mode: 'simple' | 'advanced';
  axisMappings: AxisMapping[];   // { axisIndex, channel, inverted, deadzone }
  buttonMappings: ButtonMapping[]; // { buttonIndex, channel, action }
  trim: Record<number, number>;  // channel → offset (-0.1 to 0.1)
  globalDeadzone: number;
}

// 16-channel normalized format
type ChannelArray = [number, number, number, number, number, number, number, number,
                     number, number, number, number, number, number, number, number];

// InputPlugin interface (extensible)
interface InputPlugin {
  readonly id: string;
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): void;
  onChannelData: (channels: ChannelArray) => void;
}

// SITL interface — implemented in the UI app (codename-bentang-langit) as
// SitlHitlLayer (src/sim/SitlHitlLayer.ts), not in the SDK. It is a
// WebSocket client to bridge.py / udp-bridge.py with JSON and raw
// MAVLink v2 protocol modes and automatic reconnect.
class SitlHitlLayer {
  constructor(opts?: { wsUrl?, ial?, mode?: 'json' | 'mavlink', onStatusChange? });
  connect(url?: string): void;
  disconnect(): void;
  setMode(mode: 'json' | 'mavlink'): void;
  sendHilState(state: AircraftState): void;
  get status(): 'disconnected' | 'connecting' | 'connected' | 'error';
}
```

> **Where each interface lives:** `FlySimCore` ships in this SDK
> (flysim-rc). `InputManager`/`GamepadProfile` are realized in
> codename-bentang-langit as the IAL (`src/input/IAL.ts`) plus
> `GamepadProfile.ts`, and `SITLManager` as `SitlHitlLayer` — see the
> README section "FRD feature split".

### 4.2 WebSocket Protocol

**Connection:** `wss://host:port/flysim` or `ws://host:port/flysim`

**Message Format:** Binary MAVLink v2.0

**Supported Messages:**
- `HIL_ACTUATOR_CONTROLS` (ID: 93) - Autopilot → Simulator (16 channels)
- `HIL_SENSOR` (ID: 107) - Simulator → Autopilot
- `HIL_GPS` (ID: 113) - Simulator → Autopilot
- `HIL_STATE_QUATERNION` (ID: 115) - Simulator → Autopilot

**Extended Channel Passthrough:**
- All 16 channels forwarded from SITL/HITL through IAL to simulator
- Channels 5–16 available for FC mode switches, flaps, arming, and custom functions
- SITL connection overrides gamepad/keyboard for aircraft control
- `HIL_STATE_QUATERNION` (ID: 115) - Simulator → Autopilot

---

## 5. Error Handling

### 5.1 Error Categories

| Code | Category | Severity | User Action |
|------|----------|----------|-------------|
| E001 | Aircraft Load | High | Check file format |
| E002 | Gamepad | Low | Use keyboard |
| E003 | SITL Connection | Medium | Check settings |
| E004 | Memory | High | Close other tabs |
| E005 | WASM | Critical | Reload page |

### 5.2 Error Display

- Errors displayed in modal dialog
- Error logged to console with stack trace
- Critical errors offer reload option
- Non-critical errors auto-dismiss after 5 seconds

---

## 6. Appendices

### Appendix A: Use Case Matrix

| Use Case | SIM | INP | OUT | REC | SITL | UI |
|----------|-----|-----|-----|-----|------|-----|
| Casual Flying | ✓ | ✓ | ✓ | | | ✓ |
| Training | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Competition Practice | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Autopilot Dev | ✓ | | ✓ | ✓ | ✓ | ✓ |
| Research | ✓ | ✓ | ✓ | ✓ | | ✓ |
| HITL Testing | ✓ | ✓ | ✓ | | ✓ | ✓ |

### Appendix B: Performance Budget

| Component | Time Budget | Notes |
|-----------|-------------|-------|
| Physics step (120Hz) | 8.3ms | Must complete within frame |
| Render (60Hz) | 16.6ms | Includes instrument updates |
| Input polling | 1ms | Every frame |
| SITL message handling | 2ms | Per message batch |
| UI updates | 2ms | Non-critical, can skip frames |

### Appendix C: Browser APIs Used

- **WebAssembly**: Core JSBSim execution
- **Gamepad API**: Controller input
- **WebSocket**: SITL communication
- **WebHID**: Future RC transmitter support
- **File API**: Aircraft upload
- **localStorage**: Settings persistence
- **Canvas 2D**: Instrument rendering
- **requestAnimationFrame**: Render loop

---

*End of Document*
