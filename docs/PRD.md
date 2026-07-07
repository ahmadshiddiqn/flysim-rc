# Product Requirements Document (PRD)
# FlySim-RC: Browser-Based RC Aircraft Simulator

**Document Version:** 1.0  
**Date:** March 5, 2026  
**Author:** Development Team  
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Product Vision
FlySim-RC is a browser-based RC aircraft simulator that enables hobbyists, developers, and researchers to simulate radio-controlled aircraft flight dynamics using professional-grade physics (JSBSim) directly in the web browser. The simulator supports both standalone operation and integration with autopilot systems for Software-In-The-Loop (SITL) and Hardware-In-The-Loop (HITL) testing.

### 1.2 Problem Statement
Current RC flight simulators require:
- Native application installation (platform-specific)
- Expensive proprietary physics engines
- Complex setup for SITL/HITL integration
- Limited cross-platform compatibility

### 1.3 Solution
A zero-install, browser-native RC simulator that:
- Runs on any device with a modern web browser
- Uses open-source, NASA-validated flight dynamics (JSBSim)
- Provides seamless SITL/HITL integration via standard protocols (MAVLink)
- Supports both keyboard/gamepad input and real RC transmitter integration

### 1.4 Target Users

| User Type | Needs | Priority |
|-----------|-------|----------|
| **RC Hobbyists** | Practice flying, learn new aircraft, test setups | High |
| **Autopilot Developers** | SITL testing, algorithm validation, HITL integration | High |
| **Researchers/Students** | Flight dynamics education, control system experiments | Medium |
| **Drone Manufacturers** | Pre-flight testing, firmware validation | Medium |

---

## 2. Goals & Objectives

### 2.1 Primary Goals

1. **Accessibility**: Run complex flight simulation in any modern browser without installation
2. **Accuracy**: Provide physics fidelity comparable to desktop simulators using JSBSim
3. **Integration**: Support industry-standard SITL/HITL workflows with ArduPilot and PX4
4. **Usability**: Intuitive interface suitable for both beginners and advanced users
5. **Extensibility**: Easy aircraft model loading and custom scenario creation

### 2.2 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Physics accuracy | >95% match with real flight data | Validation against JSBSim desktop |
| Frame rate | 60 FPS on mid-range hardware | Browser performance API |
| Load time | <5 seconds to interactive | Web vitals |
| SITL latency | <50ms end-to-end | WebSocket timing |
| Supported aircraft | 10+ popular RC models | Community contributions |

### 2.3 Key Differentiators

- **Web-native**: No downloads, instant access, works on Chromebooks/tablets
- **Open-source**: Full source available, community-driven aircraft models
- **Professional physics**: NASA-validated JSBSim flight dynamics model
- **Universal integration**: MAVLink protocol support for any autopilot
- **Educational value**: Real-time telemetry, flight envelope visualization

---

## 3. Scope

### 3.1 In Scope (Phase 1-3)

**Core Simulation**
- Fixed-wing aircraft physics (JSBSim integration)
- Real-time flight dynamics at 120Hz physics / 60Hz render
- Aircraft loading from XML configuration files
- Basic environment (flat terrain, standard atmosphere)

**Input Methods**
- Gamepad API support (Xbox/PlayStation controllers)
- Keyboard controls for testing
- Input Abstraction Layer (IAL): unified 16-channel model for all input sources
- Gamepad profiles: save/load, auto-detect by controller ID, configurable mapping
- Simple Mode (control names) and Advanced Mode (channel numbers)
- Controller onboarding: auto-map via stick movement, manual map via UI
- Plugin system for protocol decoders (SBUS, CRSF, iBus, PPM) — third-party extensible
- SITL/HITL passthrough: all 16 channels forwarded to simulator
- Keyboard/gamepad bypassed for aircraft control when SITL/HITL connected
- Virtual transmitter on-screen
- RC transmitter via WebHID (future)

**Output & Visualization**
- 2D instrument panel (airspeed, altimeter, attitude indicator)
- Telemetry data display
- Flight path recording and replay
- Screenshot/video capture

**Integration**
- MAVLink protocol support for SITL
- WebSocket server for external connections
- UDP passthrough mode
- ArduPilot and PX4 compatibility

**Aircraft Models**
- Trainer aircraft (high-wing, stable)
- Sport aerobatic aircraft
- Scale warbirds
- Gliders (motorized and pure)
- Basic multirotor support (Phase 2)

### 3.2 Out of Scope (Future Phases)

- 3D terrain/scenery rendering
- Multiplayer networked flight
- Weather simulation (wind gusts, thermals)
- Advanced failure modeling
- Mobile app (web app only initially)
- VR/AR support
- Helicopter physics

### 3.3 Technical Constraints

| Constraint | Impact |
|------------|--------|
| Browser WASM limitations | No threading, limited file system |
| CORS restrictions | Aircraft data must be hosted or embedded |
| Gamepad API availability | Not all features available on all browsers |
| WebSocket security | WSS required for HTTPS sites |
| Memory limits | ~2GB typical browser limit |

---

## 4. User Stories

### 4.1 RC Hobbyist - Practice Mode

**Story:** As an RC hobbyist, I want to practice flying a trainer aircraft with my gamepad so that I can improve my skills before flying the real model.

**Acceptance Criteria:**
- [ ] Can select from 3+ trainer aircraft
- [ ] Gamepad controls map intuitively to aircraft surfaces
- [ ] Can reset aircraft position when crashed
- [ ] View real-time airspeed and altitude
- [ ] Session lasts at least 30 minutes without performance degradation

### 4.2 Autopilot Developer - SITL Testing

**Story:** As a drone developer, I want to connect my ArduPilot SITL instance to the browser simulator so that I can test autonomous flight algorithms.

**Acceptance Criteria:**
- [ ] Can configure MAVLink connection parameters
- [ ] Simulator receives actuator commands from autopilot
- [ ] Simulator sends sensor data (IMU, GPS, barometer) to autopilot
- [ ] Latency remains under 50ms
- [ ] Can run 10+ minute autonomous missions

### 4.3 Student - Flight Dynamics Learning

**Story:** As a student, I want to visualize how control surface deflections affect aircraft attitude so that I can understand flight mechanics.

**Acceptance Criteria:**
- [ ] Display control surface positions in real-time
- [ ] Show forces and moments (optional visualization)
- [ ] Plot flight envelope parameters
- [ ] Export telemetry data for analysis
- [ ] Compare different aircraft configurations

### 4.4 Instructor - Demonstration Mode

**Story:** As a flight instructor, I want to pause and step through simulation so that I can explain specific flight regimes to students.

**Acceptance Criteria:**
- [ ] Pause simulation at any point
- [ ] Step forward frame-by-frame
- [ ] Save and load flight states
- [ ] Display vectors for velocity, acceleration
- [ ] Screenshot current state with annotations

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| Metric | Requirement | Priority |
|--------|-------------|----------|
| Physics rate | 120 Hz minimum | Critical |
| Render rate | 60 FPS target | High |
| Input latency | <16ms (1 frame) | High |
| Channel processing | <2ms per input source | High |
| Memory usage | <512MB typical | Medium |
| Load time | <5 seconds | High |
| Aircraft switch | <3 seconds | Medium |

### 5.2 Browser Compatibility

| Browser | Minimum Version | Support Level |
|---------|----------------|---------------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support |
| Edge | 90+ | Full support |
| Mobile Chrome | 90+ | Limited (touch controls) |
| Mobile Safari | 14+ | Limited (touch controls) |
| WebHID API | Chrome 89+ | RC receiver support (future) |

### 5.3 Security Requirements

- All WebSocket connections must use WSS (secure)
- Aircraft files validated before loading (prevent XSS)
- No execution of user-provided code in WASM context
- Telemetry data sanitized before display
- No persistent storage of sensitive user data

### 5.4 Accessibility

- Keyboard-only operation mode
- Screen reader compatibility for UI elements
- High contrast mode for instruments
- Configurable font sizes
- Alternative input methods (eye tracking, sip/puff - future)

### 5.5 Reliability

- Graceful degradation when WASM unsupported
- Automatic recovery from simulation errors
- Session persistence (restore after browser crash)
- Offline capability (PWA - future)

---

## 6. Release Planning

### 6.1 Phase 1: Foundation (Weeks 1-4)
- WASM build with proper JS bindings
- Basic aircraft loading
- Gamepad/keyboard input
- 2D instrument panel
- Single aircraft (trainer)

### 6.2 Phase 2: Core Features (Weeks 5-10)
- Multiple aircraft support
- Aircraft switching
- Flight recording/replay
- Telemetry export
- 3 additional aircraft

### 6.3 Phase 3: Integration (Weeks 11-16)
- MAVLink protocol implementation
- SITL connection
- HITL support
- UDP passthrough
- Configuration UI

### 6.4 Phase 4: Polish (Weeks 17-20)
- Performance optimization
- Additional aircraft (5+)
- User profiles
- Tutorial mode
- Community features

---

## 7. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WASM performance insufficient | Low | High | Optimize physics rate, use Web Workers |
| Aircraft file loading blocked by CORS | Medium | Medium | Embed popular aircraft, provide proxy server |
| Gamepad API inconsistency | Medium | Low | Normalize inputs, provide keyboard fallback |
| MAVLink protocol complexity | Medium | Medium | Use existing libraries, limit feature set |
| Browser storage limitations | Low | Medium | Compress aircraft files, lazy loading |

---

## 8. Glossary

- **SITL**: Software-In-The-Loop - Testing autopilot software with simulated vehicle
- **HITL**: Hardware-In-The-Loop - Testing real autopilot hardware with simulated vehicle
- **MAVLink**: Micro Air Vehicle communication protocol standard
- **JSBSim**: Open source flight dynamics model library
- **WASM**: WebAssembly - Binary instruction format for web browsers
- **FDM**: Flight Dynamics Model - Physics simulation of aircraft
- **RC**: Radio Controlled - Remote control aircraft

---

## 9. Appendices

### Appendix A: Aircraft Priority List

1. Cessna 172 (high-wing trainer) - **Phase 1**
2. Piper Cub (classic trainer) - **Phase 1**
3. Extra 300 (aerobatic) - **Phase 2**
4. P-51 Mustang (scale warbird) - **Phase 2**
5. DG-1000 (glider) - **Phase 2**
6. F-16 (jet) - **Phase 3**
7. C-130 (multi-engine) - **Phase 3**
8. Quadrotor X-frame - **Phase 3**

### Appendix B: Supported MAVLink Messages

**Incoming (to simulator):**
- HIL_ACTUATOR_CONTROLS - Actuator commands from autopilot (16 channels)

**Outgoing (from simulator):**
- HIL_SENSOR - IMU, barometer, magnetometer data
- HIL_GPS - GPS position and velocity
- HIL_STATE_QUATERNION - Full state for verification

**Note:** All 16 channels are passed through the Input Abstraction Layer (IAL) to the simulator. Extended channels (5–16) are available for FC mode switches, flaps, arming, and custom functions.

**IAL Reference:** [`docs/INPUT_ABSTRACTION_LAYER.md`](docs/INPUT_ABSTRACTION_LAYER.md)

### Appendix C: References

- JSBSim Documentation: https://jsbsim.sourceforge.net/
- ArduPilot SITL: https://ardupilot.org/dev/docs/sitl-simulator-software-in-the-loop.html
- MAVLink Protocol: https://mavlink.io/en/
- Gamepad API: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API
- WebAssembly: https://webassembly.org/

---

*End of Document*
