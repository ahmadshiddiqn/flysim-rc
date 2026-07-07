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

## Verified 2026-07-07

- ArduPlane V4.6.3 (prebuilt Windows binary) ran with `--model json`,
  streamed servo frames at 1200 Hz into the bridge; MAVProxy connected on
  TCP 5760 and detected the vehicle (heartbeat).
- Bridge replies validated against an exact emulation of ArduPilot's
  `SIM_JSON.cpp` receive path (framing between two newline separators,
  mandatory field set, monotonic timestamps): 60/60 frames accepted,
  physically consistent attitude/accel from the live browser sim.

### Windows Firewall caveat

On Windows, Defender Firewall silently creates **inbound Block rules** for
any new unsigned executable the moment it binds a socket — including
loopback UDP. This drops the bridge's JSON replies before ArduPilot's
`recv()` sees them (symptom: endless `No JSON sensor message received,
resending servos`). Renaming/moving the exe doesn't help; a new block rule
appears instantly. Fix once, as Administrator:

```bat
netsh advfirewall firewall delete rule name="arduplane.exe"
netsh advfirewall firewall add rule name="ArduPilot SITL" dir=in action=allow program="C:\path\to\ArduPlane.exe"
```

(Alternatively run ArduPilot SITL under WSL2/Docker so its sockets never
touch the Windows firewall.)
