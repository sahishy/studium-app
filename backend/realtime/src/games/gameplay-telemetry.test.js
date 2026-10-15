import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGameplayTelemetry, initializeGameplayTelemetry, recordGameplayAction } from './gameplay-telemetry.ts';
import { buildSatResultTelemetry } from './sat-questions.ts';

test('private counters survive serialization and player-state resets and result telemetry is a snapshot', () => {
  let game = { players: [{ userId: 'player', state: {} }], privateState: {} };
  initializeGameplayTelemetry(game);
  recordGameplayAction(game, 'player', 'timberLogsChopped');
  recordGameplayAction(game, 'player', 'stuns');
  game = JSON.parse(JSON.stringify(game));
  game.players[0].state = {};
  recordGameplayAction(game, 'player', 'timberLogsChopped');
  const result = buildSatResultTelemetry(game);
  assert.equal(result.gameplayByUserId.player.timberLogsChopped, 2);
  assert.equal(result.gameplayByUserId.player.stuns, 1);
  assert.equal(result.gameplayByUserId.player.trackedFromStart, true);
  recordGameplayAction(game, 'player', 'stuns');
  assert.equal(result.gameplayByUserId.player.stuns, 1);
});

test('old running matches cannot claim full tracking and missing telemetry remains optional', () => {
  const game = { players: [{ userId: 'player' }], privateState: {} };
  assert.deepEqual(buildGameplayTelemetry(game), {});
  recordGameplayAction(game, 'player', 'puncturePinsPlaced');
  const tally = buildGameplayTelemetry(game).gameplayByUserId.player;
  assert.equal(tally.puncturePinsPlaced, 1);
  assert.equal(tally.trackedFromStart, false);
});
