import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

import { OrderedLink, type LinkProfile } from "./ordered-link";
export { OrderedLink } from "./ordered-link";

export const startProxy = (target = process.env.REALTIME_TARGET || "http://127.0.0.1:8788", port = Number(process.env.REALTIME_PROXY_PORT) || 8790) => {
  let profile: LinkProfile = { rttMs: 40, jitterMs: 0 };
  const connections = new Set<WebSocket>();
  let upstreamMessages = 0, downstreamMessages = 0;
  const server = createServer(async (request, response) => {
    if(request.url !== "/__network") { response.writeHead(404).end(); return; }
    if(request.method === "POST") {
      let raw = "";
      for await(const part of request) { raw += part; if(raw.length > 2048) { response.writeHead(413).end(); return; } }
      try {
        const next = JSON.parse(raw);
        profile = { rttMs: Math.max(0, Math.min(2000, Number(next.rttMs ?? profile.rttMs))), jitterMs: Math.max(0, Math.min(500, Number(next.jitterMs ?? profile.jitterMs))), stallMs: Math.max(0, Math.min(5000, Number(next.stallMs) || 0)) };
        if(next.disconnect) connections.forEach((socket) => socket.close(1001, "Test disconnect"));
      } catch { response.writeHead(400).end(); return; }
    }
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ profile, connections: connections.size, upstreamMessages, downstreamMessages }));
  });
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url!, target); url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const upstream = new WebSocket(url);
    // OPEN must mean the cloud socket is open too. Otherwise the client's first clock pings
    // include an asymmetric TLS handshake and produce a false future clock offset.
    const early: Array<{ data: any; binary: boolean }> = [];
    const capture = (data: any, binary: boolean) => early.push({ data, binary });
    upstream.on("message", capture);
    upstream.once("error", () => socket.destroy());
    upstream.once("open", () => sockets.handleUpgrade(request, socket, head, (client) => {
      upstream.off("message", capture);
      sockets.emit("connection", client, request, upstream, early);
    }));
    socket.once("close", () => { if(upstream.readyState === WebSocket.CONNECTING) upstream.terminate(); });
  });
  sockets.on("connection", (client: WebSocket, _request: IncomingMessage, upstream: WebSocket, early: Array<{ data: any; binary: boolean }>) => {
    const up = new OrderedLink(() => profile), down = new OrderedLink(() => profile);
    connections.add(client);
    client.on("message", (data, binary) => {
      up.send(() => {
        upstreamMessages++;
        if(upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary });
      });
    });
    const receive = (data: any, binary: boolean) => down.send(() => { if(client.readyState === WebSocket.OPEN) { downstreamMessages++; client.send(data, { binary }); } });
    upstream.on("message", receive);
    for(const { data, binary } of early) receive(data, binary);
    const close = () => { up.close(); down.close(); connections.delete(client); client.close(); upstream.close(); };
    client.on("close", close); upstream.on("close", close);
    client.on("error", close); upstream.on("error", close);
  });
  server.listen(port, "127.0.0.1", () => console.info(`Ordered WebSocket impairment proxy listening on 127.0.0.1:${port}`));
  return server;
};
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startProxy();
