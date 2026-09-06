// A five-step guided opening. Each step names one thing to do, points at the
// control that does it, and completes itself when the game state says so.
//
//   tab / cat  – where the step lives; the panel switches there once, when the
//                step becomes current, and then leaves you alone
//   aim        – CSS selectors to ring, given the current state
//   done       – the condition that advances the step

export const STEPS = [
  {
    id: 't1',
    title: 'Give it power',
    body: 'Nothing runs without a distribution point. Pick the Power strip, then click a tile on the floor to place it.',
    note: 'It powers anything within two tiles.',
    tab: 'build', cat: 'power',
    aim: (state, view) => (view.tool === 'pdu' ? ['#canvaswrap'] : ['[data-build="pdu"]']),
    done: (d) => (d.counts.anyPdu || 0) > 0,
  },
  {
    id: 't2',
    title: 'Somewhere to put servers',
    body: 'Place an Open frame rack next to the power strip — inside its two-tile reach, or it gets nothing.',
    note: 'A rack is just slots. It is the hardware inside that earns.',
    tab: 'build', cat: 'compute',
    aim: (state, view) => (view.tool === 'rack' ? ['#canvaswrap'] : ['[data-build="rack"]']),
    done: (d) => (d.counts.rackAll || 0) > 0,
  },
  {
    id: 't3',
    title: 'Move the heat',
    body: 'Servers turn every watt into heat. Put a Box fan within two tiles of the rack before you fill it, not after.',
    note: 'A cooler only serves racks inside its radius.',
    tab: 'build', cat: 'cooling',
    aim: (state, view) => (view.tool === 'fan' ? ['#canvaswrap'] : ['[data-build="fan"]']),
    done: (d) => (d.counts.anyCooling || 0) > 0,
  },
  {
    id: 't4',
    title: 'Fill it with iron',
    body: 'On the Hardware tab, press "Fill all racks" under Salvaged desktop. It buys as many as your cash and your power supply allow.',
    note: 'It never overfills you into a brownout. Watch Peak temp as they come online.',
    tab: 'racks',
    aim: () => ['[data-fill="desktop"]'],
    done: (d) => d.unitsTotal >= 1,
  },
  {
    id: 't5',
    title: 'Now get paid',
    body: 'Compute earns nothing until it is sold. Open Contracts and sign an offer that fits inside your capacity.',
    note: 'Sign more than you can deliver and the SLA penalty starts immediately.',
    tab: 'contracts',
    aim: () => ['[data-sign]'],
    done: (d) => d.state.contracts.active.length > 0,
  },
];

export const FINISH = {
  title: 'That is the whole game',
  body: 'Power, cooling, water, switching, maintenance — and contracts to pay for all of it. '
    + 'Everything from here is those same five problems at a larger scale, with better machines. '
    + 'Offers keep arriving on the board, so there is always something to sign.',
};

export function current(state) {
  if (!state.tutorial || state.tutorial.skipped) return null;
  return STEPS[state.tutorial.step] || null;
}

export function active(state) {
  return !!current(state);
}

/** Advance if the current step is satisfied. Returns the step just finished. */
export function advance(state, d) {
  const step = current(state);
  if (!step) return null;
  let ok = false;
  try { ok = step.done(d); } catch (err) { ok = false; }
  if (!ok) return null;
  state.tutorial.step++;
  return step;
}

export function skip(state) {
  if (state.tutorial) state.tutorial.skipped = true;
}
