import assert from 'node:assert/strict';
import test from 'node:test';
import { playerDevelopmentTrends } from './player-development-trends';
import type { PlayerRowDTO } from '@/types/player';
import type { FranchiseSimulationState } from '@/types/front-office';
const roster = Array.from({length: 8}, (_, i) => ({ id: String(i), teamAbbr: 'KC', position: 'RB', age: i < 3 ? 24 : 33, rating: 85-i, baselineRating: 99 })) as PlayerRowDTO[];
test('Week 1 has three upward outlooks, at most two older depth declines, regardless of baseline deficits', () => {
  const trends = playerDevelopmentTrends(roster, null, 'KC');
  assert.equal([...trends.values()].filter(t=>t.direction===1).length,3);
  assert.equal([...trends.values()].filter(t=>t.direction===-1).length,2);
  assert.equal(trends.get('0')?.direction,1);
});
test('latest game replaces opening outlook; 75 rushing yards qualifies, including an older player', () => {
  const state = { currentWeek: 2, games: [
    {week:1, played:true, homeTeam:'KC', awayTeam:'CHI', result:{playerStats:[{playerId:'0',rushingYards:100}]}},
    {week:2, played:true, homeTeam:'KC', awayTeam:'DAL', result:{playerStats:[{playerId:'7',rushingYards:75},{playerId:'0',rushingYards:20}]}},
  ]} as FranchiseSimulationState;
  const trends = playerDevelopmentTrends(roster,state,'KC');
  assert.equal(trends.get('7')?.direction,1);
  assert.equal(trends.get('0')?.direction,0);
  assert.equal([...trends.values()].filter(t=>t.direction===-1).length,2);
});
test('missing box scores do not invent good games or penalize young players', () => {
  const state = {currentWeek:1,games:[{week:1,played:true,homeTeam:'KC',awayTeam:'CHI'}]} as FranchiseSimulationState;
  const trends = playerDevelopmentTrends(roster,state,'KC');
  assert.equal([...trends.values()].filter(t=>t.direction===1).length,0);
  assert.equal(trends.get('0')?.direction,0);
});
