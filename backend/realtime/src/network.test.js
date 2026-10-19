import assert from 'node:assert/strict';
import test from 'node:test';
import { ingressRegion, matchRegion } from './network.ts';
import { findMatch, createBotFillAt } from './matchmaking.ts';
import { issueAdmission, verifyAdmission } from './admission.ts';

test('North American ingress and selected match placement follow participants', () => {
    assert.equal(ingressRegion({ cf: { continent: 'NA', latitude: '40', longitude: '-74' } }), 'enam');
    assert.equal(ingressRegion({ cf: { continent: 'NA', latitude: '37', longitude: '-122' } }), 'wnam');
    assert.equal(matchRegion([{ networkRegion: 'wnam' }, { networkRegion: 'wnam' }, { isBot: true, networkRegion: 'enam' }]), 'wnam');
});
test('nearby eligible humans are preferred without excluding distant fallback or changing bot timing', () => {
    const entry = (id, region, rating) => ({ id, networkRegion: region, joinedAt: 1000, userIds: [id], players: [], averageElo: rating });
    const anchor = entry('oldest', 'wnam', 500), near = entry('near', 'wnam', 540), far = entry('far', 'enam', 500);
    assert.deepEqual(findMatch([anchor, far, near], 2, 1001).map((e) => e.id), ['oldest', 'near']);
    assert.deepEqual(findMatch([anchor, far], 2, 1001).map((e) => e.id), ['oldest', 'far']);
    assert.equal(createBotFillAt(1000, () => 0), 6000);
});
test('admission tickets reject tampering, wrong users, rooms, and expiry', async () => {
    const secret = 'test-only-signing-secret';
    const ticket = await issueAdmission(secret, 'one', 'room', 1000);
    assert.equal(await verifyAdmission(secret, ticket, 'one', 'room', 1001), true);
    assert.equal(await verifyAdmission(secret, ticket, 'two', 'room', 1001), false);
    assert.equal(await verifyAdmission(secret, ticket, 'one', 'other', 1001), false);
    assert.equal(await verifyAdmission(secret, ticket, 'one', 'room', 901000), false);
    assert.equal(await verifyAdmission(secret, ticket.slice(1), 'one', 'room', 1001), false);
    assert.equal(await verifyAdmission(undefined, ticket, 'one', 'room', 1001), false);
});
