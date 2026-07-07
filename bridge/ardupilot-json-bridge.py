#!/usr/bin/env python3
"""
FlySim-RC / Bentang Langit — ArduPilot JSON-backend bridge

Modern ArduPilot removed MAVLink HIL_* support; the supported way to plug in
an external physics engine is the SITL "JSON" backend:

    ArduPlane --model json:<bridge-ip> ...

ArduPilot then sends a binary servo packet to UDP <bridge-ip>:9002 every
frame and lock-steps on a JSON state reply. This bridge makes the browser sim
that physics engine:

    ArduPilot (UDP 9002)  <->  this bridge  <->  browser (WebSocket 8765)

  - servo packet PWM[16] -> normalized channels -> browser 'control' message
  - browser 'hil_state'  -> cached -> JSON reply per ArduPilot frame

ArduPilot advances its clock with our timestamps, so it effectively runs at
the browser's physics rate (120 Hz real-time).

Usage:
  python ardupilot-json-bridge.py [--udp-port 9002] [--ws-port 8765]
  ArduPlane -w -S --model json:127.0.0.1 --home 0.0,0.0,0,0

Requires: pip install websockets
"""

import argparse
import asyncio
import json
import math
import struct
import socket
from typing import Optional

try:
    import websockets
except ImportError:
    print("ERROR: Install websockets:  pip install websockets")
    raise

FT2M = 0.3048
SERVO_MAGIC = 18458
# uint16 magic, uint16 frame_rate, uint32 frame_count, uint16 pwm[16]
SERVO_STRUCT = struct.Struct("<HHI16H")


def pwm_to_norm(pwm: int, bipolar: bool) -> float:
    """1000-2000 µs -> [-1,1] (surfaces) or [0,1] (throttle)."""
    if bipolar:
        return max(-1.0, min(1.0, (pwm - 1500) / 500.0))
    return max(0.0, min(1.0, (pwm - 1000) / 1000.0))


class JsonBridge:
    def __init__(self, udp_port: int, ws_host: str, ws_port: int):
        self.udp_port = udp_port
        self.ws_host = ws_host
        self.ws_port = ws_port
        self.ws_client = None
        self.state: Optional[dict] = None      # latest browser hil_state
        self.home: Optional[tuple] = None      # (lat_rad, lon_rad, alt_ft)
        self.frames = 0
        self.last_ctrl_sent = 0.0
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # ── ArduPilot side ───────────────────────────────────────────────────────

    def _json_reply(self) -> bytes:
        s = self.state
        # simTime drives ArduPilot's clock; it must only ever increase.
        t = float(s.get("simTime", 0.0))
        lat = math.radians(float(s.get("lat", 0.0)))
        lon = math.radians(float(s.get("lon", 0.0)))
        alt_ft = float(s.get("alt", 0.0))
        if self.home is None:
            self.home = (lat, lon, alt_ft)
            print(f"[json-bridge] home locked: {math.degrees(lat):.6f}, "
                  f"{math.degrees(lon):.6f}, {alt_ft:.1f} ft")
        hlat, hlon, halt = self.home

        R = 6378137.0
        north = (lat - hlat) * R
        east = (lon - hlon) * R * math.cos(hlat)
        down = -(alt_ft - halt) * FT2M

        gyro = s.get("gyro", [0.0, 0.0, 0.0])
        accel_ftss = s.get("accel", [0.0, 0.0, -32.17405])
        vel_fps = s.get("velNED", [0.0, 0.0, 0.0])

        reply = {
            "timestamp": t,
            "imu": {
                "gyro": [float(g) for g in gyro],
                "accel_body": [float(a) * FT2M for a in accel_ftss],
            },
            "position": [north, east, down],
            "attitude": [float(s.get("roll", 0.0)),
                         float(s.get("pitch", 0.0)),
                         float(s.get("heading", 0.0))],
            "velocity": [float(v) * FT2M for v in vel_fps],
            "airspeed": float(s.get("airspeed", 0.0)) * FT2M,
        }
        return ("\n" + json.dumps(reply) + "\n").encode("ascii")

    def _handle_servo_packet(self, data: bytes, addr, transport):
        if len(data) < SERVO_STRUCT.size:
            return
        magic, frame_rate, frame_count, *pwm = SERVO_STRUCT.unpack_from(data)
        if magic != SERVO_MAGIC:
            return
        self.frames += 1
        if self.frames == 1:
            print(f"[json-bridge] ArduPilot connected from {addr[0]}:{addr[1]} "
                  f"(requested rate {frame_rate} Hz)")
        if self.frames % 1200 == 0:
            print(f"[json-bridge] {self.frames} frames (count={frame_count}), pwm[0..3] = {pwm[:4]}")

        # Reply with the latest browser state (lock-step release).
        if self.state is not None:
            transport.sendto(self._json_reply(), addr)

        # Forward actuators to the browser, throttled to ~60 Hz.
        now = asyncio.get_event_loop().time()
        if self.ws_client is not None and now - self.last_ctrl_sent > 1 / 60:
            self.last_ctrl_sent = now
            # ArduPlane default outputs: 1=aileron 2=elevator 3=throttle 4=rudder
            ch = [0.0] * 16
            ch[0] = pwm_to_norm(pwm[0], True)
            ch[1] = pwm_to_norm(pwm[1], True)
            ch[2] = pwm_to_norm(pwm[2], False)
            ch[3] = pwm_to_norm(pwm[3], True)
            for i in range(4, 16):
                ch[i] = pwm_to_norm(pwm[i], True) if pwm[i] > 0 else 0.0
            msg = {"type": "control", "channels": ch,
                   "aileron": ch[0], "elevator": ch[1],
                   "throttle": ch[2], "rudder": ch[3]}
            asyncio.ensure_future(self._ws_send(json.dumps(msg)), loop=self._loop)

    async def _ws_send(self, text: str):
        try:
            if self.ws_client:
                await self.ws_client.send(text)
        except Exception:
            pass

    # ── Browser side ─────────────────────────────────────────────────────────

    async def _handle_ws_client(self, ws):
        print(f"[json-bridge] Browser connected from {ws.remote_address}")
        self.ws_client = ws
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue
                if msg.get("type") == "hil_state":
                    self.state = msg
        except Exception as e:
            print(f"[json-bridge] WS disconnect: {e}")
        finally:
            if self.ws_client is ws:
                self.ws_client = None
            print("[json-bridge] Browser disconnected")

    # ── Entry point ──────────────────────────────────────────────────────────

    async def run(self):
        self._loop = asyncio.get_running_loop()

        bridge = self

        class UdpProto(asyncio.DatagramProtocol):
            def connection_made(self, transport):
                self.transport = transport

            def datagram_received(self, data, addr):
                bridge._handle_servo_packet(data, addr, self.transport)

        await self._loop.create_datagram_endpoint(
            UdpProto, local_addr=("0.0.0.0", self.udp_port))
        print(f"[json-bridge] UDP listening on 0.0.0.0:{self.udp_port} "
              f"(start ArduPilot with --model json:127.0.0.1)")

        print(f"[json-bridge] WebSocket server on ws://{self.ws_host}:{self.ws_port}")
        async with websockets.serve(self._handle_ws_client, self.ws_host, self.ws_port):
            await asyncio.Future()


def main():
    p = argparse.ArgumentParser(description="ArduPilot JSON-backend <-> browser bridge")
    p.add_argument("--udp-port", type=int, default=9002)
    p.add_argument("--ws-host", default="localhost")
    p.add_argument("--ws-port", type=int, default=8765)
    a = p.parse_args()
    asyncio.run(JsonBridge(a.udp_port, a.ws_host, a.ws_port).run())


if __name__ == "__main__":
    main()
