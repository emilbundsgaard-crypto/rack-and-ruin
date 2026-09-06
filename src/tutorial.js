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
    body: 'Machines need somewhere to plug in. Click the Power strip below, then click a tile on the floor.',
    note: 'It powers anything within two tiles of itself.',
    tab: 'build', cat: 'power',
    aim: (state, view) => (view.tool === 'pdu' ? ['#canvaswrap'] : ['[data-build="pdu"]']),
    done: (d) => (d.counts.anyPdu || 0) > 0,
  },
  {
    id: 't2',
    title: 'Somewhere to put them',
    body: 'Put an Open frame rack next to the power strip. It has to be within two tiles or it gets no power.',
    note: 'A rack is just shelves. The machines inside are what earn.',
    tab: 'build', cat: 'compute',
    aim: (state, view) => (view.tool === 'rack' ? ['#canvaswrap'] : ['[data-build="rack"]']),
    done: (d) => (d.counts.rackAll || 0) > 0,
  },
  {
    id: 't3',
    title: 'Move the heat',
    body: 'Machines turn every watt into heat. Put a Box fan within two tiles of the rack — before you fill it, not after.',
    note: 'Cooling only helps racks close enough to reach.',
    tab: 'build', cat: 'cooling',
    aim: (state, view) => (view.tool === 'fan' ? ['#canvaswrap'] : ['[data-build="fan"]']),
    done: (d) => (d.counts.anyCooling || 0) > 0,
  },
  {
    id: 't4',
    title: 'Put machines in it',
    body: 'On the Machines tab, press "Fill all racks" under Salvaged desktop. It buys as many as your money and your power allow.',
    note: 'It will not buy more than you can power. Watch the Temp number as they switch on.',
    tab: 'racks',
    aim: () => ['[data-fill="desktop"]'],
    done: (d) => d.unitsTotal >= 1,
  },
  {
    id: 't5',
    title: 'Now get paid',
    body: 'Your machines make compute, and compute earns nothing until somebody buys it. Open Deals and sign one that fits.',
    note: 'Promise more than you can make and you start paying a fine.',
    tab: 'deals',
    aim: () => ['[data-sign]'],
    done: (d) => d.state.contracts.active.length > 0,
  },
];

export const FINISH = {
  title: 'That is the whole game',
  body: 'Power, cooling, water, network, repairs — and deals to pay for all of it. '
    + 'Everything from here is the same handful of problems, just bigger. '
    + 'When something is wrong, the list under the floor will tell you, and clicking it takes you '
    + 'straight to the fix.',
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
