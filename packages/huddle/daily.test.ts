import test from 'node:test';
import assert from 'node:assert/strict';
import {dailySnapshot} from './demo-daily';
import {demoSnapshot} from './demo-game';
import {dailyEntries,dailyRoomId,huddleExperience,pollResult} from './daily';
test('daily conversation reuses one dataset and filters system entries from Chat',()=>{
 const data=dailySnapshot('KC','Kansas City Chiefs');
 assert.equal(data.game,null); assert.equal(data.daily?.id,dailyRoomId('KC','2026-09-30'));
 assert.equal(dailyEntries(data.messages,'Live').length,8);
 assert.equal(dailyEntries(data.messages,'Chat').length,6);
 assert.ok(dailyEntries(data.messages,'Chat').every(m=>m.kind==='comment'));
 assert.equal(pollResult(data.polls[0]).percent,68);
 assert.equal(pollResult(data.polls[0]).total,1247);
 assert.ok(data.messages.length<=50);
});
test('a selected-team game takes priority only on its game date',()=>{
 const game=demoSnapshot(0).game!;
 assert.equal(huddleExperience(game,'PHI',game.kickoff.slice(0,10)),'gameday');
 assert.equal(huddleExperience(game,'KC',game.kickoff.slice(0,10)),'daily');
 assert.equal(huddleExperience(game,'PHI','2030-01-01'),'daily');
 assert.equal(huddleExperience(null,'KC','2026-09-30'),'daily');
});
test('another team gets its own room and neutral editorial fixture',()=>{
 const data=dailySnapshot('PHI','Philadelphia Eagles');
 assert.equal(data.daily?.team,'PHI');
 assert.ok(!JSON.stringify(data).includes('Mahomes'));
 assert.ok(!JSON.stringify(data).includes('Tyreek'));
 assert.equal(data.daily?.previous.length,5);
 assert.notEqual(dailyRoomId('KC','2026-09-30'),dailyRoomId('KC','2026-10-01'));
});
