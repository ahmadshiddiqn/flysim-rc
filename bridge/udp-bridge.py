#!/usr/bin/env python3
"""
FlySim-RC / Bentang Langit — raw MAVLink UDP passthrough bridge (plan §E3)

Unlike bridge.py (which translates browser JSON <-> MAVLink via pymavlink),
this bridge forwards raw MAVLink v2 bytes untouched between a UDP endpoint
and the browser's WebSocket. Pair it with the browser's 'mavlink' protocol
mode — the browser does its own MAVLink parsing/encoding (src/sim/mavlink.ts).

Because nothing is interpreted, any MAVLink peer works: ArduPilot SITL,
PX4 SITL, Mission Planner, QGroundControl, mavproxy.

Usage:
  python udp-bridge.py                                   # UDP listen 0.0.0.0:14550, WS localhost:8765
  python udp-bridge.py --udp-port 14551                  # custom UDP port
  python udp-bridge.py --udp-target 127.0.0.1:14555      # send to fixed peer instead of last sender
  python udp-bridge.py --ws-host 0.0.0.0 --ws-port 8765

Requires:
  pip install websockets
"""

import argparse
import asyncio
from typing import Optional, Tuple

try:
    import websockets
except ImportError:
    print("ERROR: Install websockets:  pip install websockets")
    raise


class UdpEndpoint(asyncio.DatagramProtocol):
    """UDP side. Learns the peer address from the first packet received
    (udpin behavior, matching how ArduPilot/PX4 SITL dial out), unless a
    fixed --udp-target was given."""

    def __init__(self, fixed_target: Optional[Tuple[str, int]]):
        self.transport: Optional[asyncio.DatagramTransport] = None
        self.peer = fixed_target
        self.fixed = fixed_target is not None
        self.on_datagram = None  # set by the bridge

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data: bytes, addr):
        if not self.fixed and self.peer != addr:
            print(f"[udp-bridge] MAVLink peer: {addr[0]}:{addr[1]}")
            self.peer = addr
        if self.on_datagram:
            self.on_datagram(data)

    def send(self, data: bytes):
        if self.transport and self.peer:
            self.transport.sendto(data, self.peer)


class UdpPassthrough:
    def __init__(self, udp_host: str, udp_port: int,
                 udp_target: Optional[Tuple[str, int]],
                 ws_host: str, ws_port: int):
        self.udp_host = udp_host
        self.udp_port = udp_port
        self.udp_target = udp_target
        self.ws_host = ws_host
        self.ws_port = ws_port
        self.endpoint: Optional[UdpEndpoint] = None
        self.ws_client = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def _udp_to_ws(self, data: bytes):
        """Forward a UDP datagram to the browser (called from the UDP protocol)."""
        ws = self.ws_client
        if ws is None or self._loop is None:
            return
        try:
            asyncio.ensure_future(ws.send(data), loop=self._loop)
        except Exception:
            pass

    async def _handle_ws_client(self, ws):
        print(f"[udp-bridge] Browser connected from {ws.remote_address}")
        self.ws_client = ws
        try:
            async for raw in ws:
                # Only binary frames are MAVLink; ignore stray text frames.
                if isinstance(raw, (bytes, bytearray)) and self.endpoint:
                    self.endpoint.send(bytes(raw))
        except Exception as e:
            print(f"[udp-bridge] WS disconnect: {e}")
        finally:
            if self.ws_client is ws:
                self.ws_client = None
            print("[udp-bridge] Browser disconnected")

    async def run(self):
        self._loop = asyncio.get_running_loop()

        transport, endpoint = await self._loop.create_datagram_endpoint(
            lambda: UdpEndpoint(self.udp_target),
            local_addr=(self.udp_host, self.udp_port),
        )
        endpoint.on_datagram = self._udp_to_ws
        self.endpoint = endpoint
        print(f"[udp-bridge] UDP listening on {self.udp_host}:{self.udp_port}"
              + (f" → fixed target {self.udp_target[0]}:{self.udp_target[1]}"
                 if self.udp_target else " (peer learned from first packet)"))

        print(f"[udp-bridge] WebSocket server on ws://{self.ws_host}:{self.ws_port}")
        print("[udp-bridge] Select protocol 'MAVLink' in the browser and connect")
        async with websockets.serve(self._handle_ws_client, self.ws_host, self.ws_port):
            await asyncio.Future()  # run forever


def main():
    parser = argparse.ArgumentParser(description="Raw MAVLink UDP <-> WebSocket passthrough")
    parser.add_argument("--udp-host",   default="0.0.0.0",
                        help="UDP bind host (default 0.0.0.0)")
    parser.add_argument("--udp-port",   type=int, default=14550,
                        help="UDP bind port (default 14550)")
    parser.add_argument("--udp-target", default="",
                        help="Fixed peer host:port; default replies to last sender")
    parser.add_argument("--ws-host",    default="localhost",
                        help="WebSocket bind host (default localhost)")
    parser.add_argument("--ws-port",    type=int, default=8765,
                        help="WebSocket bind port (default 8765)")
    args = parser.parse_args()

    target = None
    if args.udp_target:
        host, port = args.udp_target.rsplit(":", 1)
        target = (host, int(port))

    bridge = UdpPassthrough(args.udp_host, args.udp_port, target,
                            args.ws_host, args.ws_port)
    asyncio.run(bridge.run())


if __name__ == "__main__":
    main()
