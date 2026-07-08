# SITL / HITL bridges

Three bridges connect the browser sim (WebSocket) to autopilot ecosystems.
All need only `pip install websockets` unless noted.

| Bridge | Autopilot side | Browser protocol mode | Use for |
|--------|----------------|----------------------|---------|
| `bridge.py` | MAVLink over UDP or serial (pymavlink; also `pip install pymavlink`) | JSON | Older HIL-style autopilots, real FCs on serial |
| `udp-bridge.py` | Raw MAVLink v2 UDP passthrough (nothing interpreted) | MAVLink | PX4 SITL HIL, Mission Planner, mavproxy, any MAVLink peer |
| `ardupilot-json-bridge.py` | ArduPilot SITL **JSON backend** (`--model json:<ip>`) | JSON | Modern ArduPilot (4.x) — HIL_* was removed; the browser becomes the physics engine |

## ArduPilot JSON quick start

```bash
python ardupilot-json-bridge.py                  # UDP 9002 + WS 8765
# in the browser: Start the sim, then Autopilot… → Connect (JSON protocol)
ArduPlane -w -S --model json:127.0.0.1 --home 0.000001,0.000001,0,0
mavproxy.py --master=tcp:127.0.0.1:5760
```

ArduPilot lock-steps on the browser's 120 Hz state stream (timestamps drive
its clock). The browser publishes body rates, specific force, and NED
velocity (added to `AircraftState` for this purpose), so the EKF gets real
IMU-grade data from JSBSim.

## Verified 2026-07-08 (live, end-to-end)

Full stack exercised with **ArduPlane V4.6.3** (prebuilt cygwin Windows
binary from firmware.ardupilot.org) + **MAVProxy** + browser:

- ArduPlane SITL with its internal `plane` model **armed and flew**
  (TAKEOFF mode, climb to 50 m AGL at 16 m/s, TECS loiter at 23.5 kt /
  56% throttle), monitored and commanded through MAVProxy's UDP tee.
- `bridge.py --mode sitl --udp 127.0.0.1:14550` fed by
  `mavproxy --master=tcp:127.0.0.1:5760 --out=udp:127.0.0.1:14550`:
  ArduPilot's live SERVO_OUTPUT_RAW drove the browser aircraft — the
  panel mirrored TECS throttle (0.55) and stabilization surface commands
  in real time, and the JSBSim aircraft physically accelerated under
  ArduPilot throttle.
- `ardupilot-json-bridge.py` (browser as the physics engine): replies
  validated against a byte-exact emulation of ArduPilot's `SIM_JSON.cpp`
  receive path — 60/60 frames accepted, mandatory fields, advancing
  lock-step timestamps.

### Windows/cygwin JSON-backend caveat

The prebuilt **cygwin** SITL binaries never receive the JSON backend's UDP
replies on Windows (symptom: endless `No JSON sensor message received,
resending servos`). This is **not** the Windows Firewall: it persists with
allow-only rules and was reproduced with every reply variant (same-socket
9002 source, ephemeral source, connected-UDP, port 9003). TCP (SERIAL0)
and outbound UDP work fine — the defect is specific to inbound UDP on the
cygwin build's auto-bound JSON socket.

Workarounds for full closed-loop (browser as physics):
- run ArduPilot SITL under **WSL2 / Docker / a Linux box** pointing
  `--model json:<windows-host-ip>` at this bridge, or
- use the **mirroring topology** above (`bridge.py` + SERVO_OUTPUT_RAW),
  which works with the Windows binaries as-is.
