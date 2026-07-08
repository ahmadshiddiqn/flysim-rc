#!/usr/bin/env python3
"""
FlySim-RC / Bentang Langit — SITL/HITL bridge

Bridges the browser sim (WebSocket JSON) with an autopilot (MAVLink over UDP or serial).

Usage:
  python bridge.py --mode sitl                          # ArduPilot SITL on UDP 127.0.0.1:14550
  python bridge.py --mode sitl --udp 0.0.0.0:14551     # Custom UDP address
  python bridge.py --mode hitl --port COM3              # Real FC on Windows serial
  python bridge.py --mode hitl --port /dev/ttyUSB0      # Real FC on Linux serial

Requires:
  pip install pymavlink websockets

JSON protocol (browser <-> bridge):
  Browser -> Bridge (each sim update, ~120 Hz):
    { "type": "hil_state", "roll": float, "pitch": float, "heading": float,
      "lat": float, "lon": float, "alt": float (ft), "airspeed": float (fps),
      "verticalSpeed": float (fps), "systemTimeMs": int }

  Bridge -> Browser (on autopilot actuator command):
    { "type": "control",
      "channels": [float x16],   # all 16 channels (IAL format)
      "aileron": float, "elevator": float,   # legacy 4-field fallback
      "rudder": float, "throttle": float }

ArduPlane HIL_ACTUATOR_CONTROLS mapping (fixed-wing):
  controls[0] = aileron  (-1..1)
  controls[1] = elevator (-1..1)
  controls[2] = throttle ( 0..1)
  controls[3] = rudder   (-1..1)
"""

import argparse
import asyncio
import json
import math
from typing import Optional

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    print("ERROR: Install websockets:  pip install websockets")
    raise

try:
    from pymavlink import mavutil
except ImportError:
    print("ERROR: Install pymavlink:  pip install pymavlink")
    raise


def euler_to_quaternion(roll: float, pitch: float, yaw: float) -> tuple:
    """Convert Euler angles (rad, ZYX convention) to quaternion [w, x, y, z]."""
    cr = math.cos(roll  / 2);  sr = math.sin(roll  / 2)
    cp = math.cos(pitch / 2);  sp = math.sin(pitch / 2)
    cy = math.cos(yaw   / 2);  sy = math.sin(yaw   / 2)
    return (
        cr * cp * cy + sr * sp * sy,   # w
        sr * cp * cy - cr * sp * sy,   # x
        cr * sp * cy + sr * cp * sy,   # y
        cr * cp * sy - sr * sp * cy,   # z
    )


class SitlBridge:
    def __init__(self, mav_connection_string: str, ws_host: str = "localhost", ws_port: int = 8765):
        self.mav_conn_str  = mav_connection_string
        self.ws_host       = ws_host
        self.ws_port       = ws_port
        self.mav           = None
        self.ws_client: Optional[WebSocketServerProtocol] = None
        self._running      = False

    # ── MAVLink setup ────────────────────────────────────────────────────────

    async def _connect_mavlink(self):
        print(f"[bridge] Connecting to autopilot: {self.mav_conn_str}")
        loop = asyncio.get_event_loop()
        self.mav = await loop.run_in_executor(
            None,
            lambda: mavutil.mavlink_connection(self.mav_conn_str, baud=57600)
        )
        print("[bridge] Waiting for heartbeat…")
        await loop.run_in_executor(None, lambda: self.mav.wait_heartbeat(timeout=30))
        print(f"[bridge] Heartbeat from system {self.mav.target_system},"
              f" component {self.mav.target_component}")

    # ── Actuator receive loop ────────────────────────────────────────────────

    async def _recv_mavlink_loop(self):
        """Read MAVLink actuator messages from autopilot and forward to browser."""
        loop = asyncio.get_event_loop()
        while self._running:
            try:
                msg = await loop.run_in_executor(None, lambda: self.mav.recv_match(
                    type=["HIL_ACTUATOR_CONTROLS", "SERVO_OUTPUT_RAW"],
                    blocking=True,
                    timeout=0.05,
                ))
                if msg is None:
                    continue

                controls = None

                if msg.get_type() == "HIL_ACTUATOR_CONTROLS":
                    # ArduPlane fixed-wing mapping: [0]=aileron [1]=elevator [2]=throttle [3]=rudder
                    # All 16 channels forwarded for extended RC channel support.
                    c = msg.controls
                    ch16 = [float(c[i]) if i < len(c) else 0.0 for i in range(16)]
                    controls = {
                        "type":     "control",
                        "channels": ch16,          # full 16-channel array (IAL v2 format)
                        # Legacy 4-field form kept for backwards compat with older browser builds:
                        "aileron":  ch16[0],
                        "elevator": ch16[1],
                        "throttle": ch16[2],
                        "rudder":   ch16[3],
                    }

                elif msg.get_type() == "SERVO_OUTPUT_RAW":
                    # Fallback: raw PWM 1000–2000 µs → normalized.
                    # Only 8 channels available from SERVO_OUTPUT_RAW; pad rest with 0.
                    def pwm(v):      return (v - 1500) / 500.0
                    def pwm_thr(v):  return (v - 1000) / 1000.0
                    ch_raw = [
                        pwm(msg.servo1_raw), pwm(msg.servo2_raw),
                        pwm_thr(msg.servo3_raw), pwm(msg.servo4_raw),
                        pwm(msg.servo5_raw), pwm(msg.servo6_raw),
                        pwm(msg.servo7_raw), pwm(msg.servo8_raw),
                    ] + [0.0] * 8
                    controls = {
                        "type":     "control",
                        "channels": ch_raw,
                        "aileron":  ch_raw[0],
                        "elevator": ch_raw[1],
                        "throttle": ch_raw[2],
                        "rudder":   ch_raw[3],
                    }

                if controls and self.ws_client:
                    try:
                        await self.ws_client.send(json.dumps(controls))
                    except Exception:
                        pass

            except Exception as e:
                print(f"[bridge] MAVLink recv error: {e}")
                await asyncio.sleep(0.1)

    # ── HIL state send ───────────────────────────────────────────────────────

    def _send_hil_state(self, data: dict):
        """Convert browser JSON hil_state → MAVLink HIL_STATE_QUATERNION."""
        if not self.mav:
            return
        try:
            roll  = float(data.get("roll",          0))
            pitch = float(data.get("pitch",         0))
            yaw   = float(data.get("heading",       0))
            lat   = float(data.get("lat",           0))
            lon   = float(data.get("lon",           0))
            alt_ft = float(data.get("alt",          0))
            as_fps = float(data.get("airspeed",     0))
            vs_fps = float(data.get("verticalSpeed",0))
            sys_ms = int(data.get("systemTimeMs",   0))

            qw, qx, qy, qz = euler_to_quaternion(roll, pitch, yaw)
            alt_mm  = int(alt_ft * 0.3048 * 1000)          # ft → mm
            as_cms  = int(as_fps * 0.3048 * 100)            # fps → cm/s
            vz_cms  = int(-vs_fps * 0.3048 * 100)           # fps → cm/s, NED down+

            self.mav.mav.hil_state_quaternion_send(
                time_usec            = sys_ms * 1000,
                attitude_quaternion  = [qw, qx, qy, qz],
                rollspeed            = 0.0,
                pitchspeed           = 0.0,
                yawspeed             = 0.0,
                lat                  = int(lat * 1e7),
                lon                  = int(lon * 1e7),
                alt                  = alt_mm,
                vx                   = 0,
                vy                   = 0,
                vz                   = vz_cms,
                ind_airspeed         = as_cms,
                true_airspeed        = as_cms,
                xacc                 = 0,
                yacc                 = 0,
                zacc                 = 0,
            )
        except Exception as e:
            print(f"[bridge] HIL send error: {e}")

    # ── WebSocket handler ────────────────────────────────────────────────────

    async def _handle_ws_client(self, ws: WebSocketServerProtocol):
        print(f"[bridge] Browser connected from {ws.remote_address}")
        self.ws_client = ws
        recv_task = asyncio.create_task(self._recv_mavlink_loop())
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "hil_state":
                        self._send_hil_state(msg)
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            print(f"[bridge] WS disconnect: {e}")
        finally:
            recv_task.cancel()
            # Only clear if we are still the active client — a reconnect may
            # already have replaced us, and nulling it would freeze the new
            # client's control stream.
            if self.ws_client is ws:
                self.ws_client = None
            print("[bridge] Browser disconnected")

    # ── Entry point ──────────────────────────────────────────────────────────

    async def run(self):
        self._running = True
        await self._connect_mavlink()
        print(f"[bridge] WebSocket server on ws://{self.ws_host}:{self.ws_port}")
        print("[bridge] Open the browser and click 'Connect to Autopilot'")
        async with websockets.serve(self._handle_ws_client, self.ws_host, self.ws_port):
            await asyncio.Future()  # run forever


def main():
    parser = argparse.ArgumentParser(description="FlySim-RC SITL/HITL bridge")
    parser.add_argument("--mode",    choices=["sitl", "hitl"], default="sitl",
                        help="sitl = UDP (ArduPilot/PX4);  hitl = serial (real FC)")
    parser.add_argument("--udp",     default="127.0.0.1:14550",
                        help="UDP address for SITL  host:port  (default 127.0.0.1:14550)")
    parser.add_argument("--port",    default="",
                        help="Serial port for HITL  (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud",    type=int, default=57600,
                        help="Baud rate for HITL serial  (default 57600)")
    parser.add_argument("--ws-host", default="localhost",
                        help="WebSocket bind host  (default localhost)")
    parser.add_argument("--ws-port", type=int, default=8765,
                        help="WebSocket bind port  (default 8765)")
    args = parser.parse_args()

    if args.mode == "sitl":
        host, port = args.udp.rsplit(":", 1)
        mav_conn = f"udpin:{host}:{port}"
        print(f"[bridge] Mode: SITL — MAVLink UDP {host}:{port}")
    else:
        if not args.port:
            parser.error("--port is required for HITL mode")
        mav_conn = args.port
        print(f"[bridge] Mode: HITL — serial {args.port} @ {args.baud} baud")

    bridge = SitlBridge(mav_conn, ws_host=args.ws_host, ws_port=args.ws_port)
    asyncio.run(bridge.run())


if __name__ == "__main__":
    main()
