import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { OrderedLink, startProxy } from './impairment-proxy';

test('jitter changes delivery time without reordering reliable messages', async () => {
    const rolls = [0, 1, 0];
    const link = new OrderedLink(() => ({ rttMs: 80, jitterMs: 30 }), () => rolls.shift()!);
    const delivered: number[] = [], at: number[] = [], start = Date.now();
    await new Promise<void>((resolve) => {
        for(let i = 0; i < 3; i++) link.send(() => { delivered.push(i); at.push(Date.now() - start); if(delivered.length === 3) resolve(); });
    });
    assert.deepEqual(delivered, [0, 1, 2]); assert.ok(at[0] >= 8); assert.ok(at[1] >= 65); assert.ok(at[2] >= at[1]);
});
test('closed links discard pending packets rather than replaying them', async () => {
    const link = new OrderedLink(() => ({ rttMs: 100, jitterMs: 0 }));
    let delivered = false; link.send(() => { delivered = true; }); link.close();
    await new Promise((resolve) => setTimeout(resolve, 70)); assert.equal(delivered, false);
});
test('large jittered bursts remain FIFO when many packets share a delivery deadline', async () => {
    const link = new OrderedLink(() => ({ rttMs: 60, jitterMs: 30 }));
    const delivered: number[] = [];
    await new Promise<void>((resolve) => {
        for(let i = 0; i < 2000; i++) link.send(() => { delivered.push(i); if(delivered.length === 2000) resolve(); });
    });
    assert.deepEqual(delivered, Array.from({ length: 2000 }, (_, i) => i));
});
test('proxy delays actual outbound and inbound WebSocket traffic', async () => {
    const echo = new WebSocketServer({ port: 0, host: '127.0.0.1', verifyClient: (_info, done) => { setTimeout(() => done(true), 100); } }); await once(echo, 'listening');
    const echoAddress = echo.address() as { port: number };
    let received = 0;
    echo.on('connection', (socket) => socket.on('message', (data) => { received = Date.now(); socket.send(data.toString()); }));
    const proxy = startProxy(`http://127.0.0.1:${echoAddress.port}`, 0); await once(proxy, 'listening');
    const address = proxy.address() as { port: number };
    await fetch(`http://127.0.0.1:${address.port}/__network`, { method: 'POST', body: JSON.stringify({ rttMs: 80, jitterMs: 0 }) });
    const connectingAt = Date.now();
    const client = new WebSocket(`ws://127.0.0.1:${address.port}/parties/game/test`); await once(client, 'open');
    assert.ok(Date.now() - connectingAt >= 95, 'client OPEN must wait for the upstream handshake');
    const start = Date.now(), response = once(client, 'message'); client.send('input');
    const [wire] = await response; assert.equal(String(wire), 'input'); assert.ok(received - start >= 35); assert.ok(Date.now() - received >= 35);
    client.close(); await once(client, 'close');
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    await new Promise<void>((resolve) => echo.close(() => resolve()));
});
