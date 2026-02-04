import { getCapHitSchedule } from '../src/server/logic/cap';
import { createSaveState, offerContractInState } from '../src/server/api/store';

const apy = 20;
const years = 3;
const schedule = getCapHitSchedule(apy, years);
const expectedYearOne = 10.0;

if (schedule[0] !== expectedYearOne) {
  throw new Error(
    `Expected year one cap hit ${expectedYearOne}, got ${schedule[0]}`,
  );
}

const state = createSaveState('cap-check', 'GB');
const initialCapSpace = state.header.capSpace;
const playerId = state.freeAgents[0]?.id;

if (!playerId) {
  throw new Error('No free agents available for cap check.');
}

offerContractInState(state, playerId, years, apy);
const expectedCapSpace = Number((initialCapSpace - expectedYearOne).toFixed(1));

if (state.header.capSpace !== expectedCapSpace) {
  throw new Error(
    `Expected cap space ${expectedCapSpace}, got ${state.header.capSpace}`,
  );
}

console.log('cap-math-check passed');
