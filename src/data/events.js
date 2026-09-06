// Random events. Some are pure modifiers with a duration, some stop the game
// and ask you a question. Weight is relative; minTier gates the big ones.
//
// mods (active for `days` game-days):
//   coolMult powerSupplyMult waterSupplyMult priceMult gridCostMult
//   wearMult computeMult uptimePenalty

export const EVENTS = [
  {
    id: 'heatwave', name: 'Heatwave', weight: 10, minTier: 0, days: 3.5, tone: 'bad',
    mods: { coolMult: 0.7 },
    text: 'Thirty-six degrees outside and the condensers are giving up. Cooling capacity is down 30% for a few days.',
  },
  {
    id: 'coldsnap', name: 'Cold snap', weight: 7, minTier: 1, days: 3, tone: 'good',
    mods: { coolMult: 1.35 },
    text: 'Freezing air outside means the economisers do the work for free. +35% cooling.',
  },
  {
    id: 'gridsag', name: 'Grid brownout', weight: 8, minTier: 1, days: 1.6, tone: 'bad',
    mods: { powerSupplyMult: 0.62 },
    text: 'The utility is shedding load across the region. Your grid feed is cut to 62% until it clears.',
  },
  {
    id: 'pricespike', name: 'Spot price spike', weight: 9, minTier: 0, days: 2.5, tone: 'bad',
    mods: { gridCostMult: 2.4 },
    text: 'Wholesale electricity has gone vertical. Grid power costs 2.4× as much this week.',
  },
  {
    id: 'pricecrash', name: 'Negative spot prices', weight: 5, minTier: 2, days: 2, tone: 'good',
    mods: { gridCostMult: 0.25 },
    text: 'Too much wind on the network. Electricity is almost free for two days.',
  },
  {
    id: 'drought', name: 'Drought restrictions', weight: 7, minTier: 2, days: 5, tone: 'bad',
    mods: { waterSupplyMult: 0.55 },
    text: 'The municipality has cut non-domestic abstraction. Water supply down 45%.',
  },
  {
    id: 'watermain', name: 'Water main break', weight: 5, minTier: 1, days: 1.5, tone: 'bad',
    mods: { waterSupplyMult: 0.2 },
    text: 'A contractor put a digger through the feeder. Water is down to a trickle.',
  },
  {
    id: 'demand', name: 'Compute crunch', weight: 8, minTier: 1, days: 4, tone: 'good',
    mods: { priceMult: 1.6 },
    text: 'Everyone wants capacity at once. Contract rates are up 60%.',
  },
  {
    id: 'glut', name: 'Capacity glut', weight: 6, minTier: 2, days: 4, tone: 'bad',
    mods: { priceMult: 0.7 },
    text: 'Three competitors lit up new halls this month. Rates are down 30%.',
  },
  {
    id: 'dust', name: 'Filter contamination', weight: 6, minTier: 1, days: 4, tone: 'bad',
    mods: { wearMult: 1.8, coolMult: 0.9 },
    text: 'Construction dust in the intakes. Hardware wears 80% faster until the filters are swapped.',
  },
  {
    id: 'firmware', name: 'Firmware regression', weight: 6, minTier: 2, days: 2.5, tone: 'bad',
    mods: { computeMult: 0.82 },
    text: 'A vendor firmware update tanked performance. 18% of your compute is gone until it is rolled back.',
  },
  {
    id: 'optimise', name: 'Kernel breakthrough', weight: 5, minTier: 3, days: 5, tone: 'good',
    mods: { computeMult: 1.3 },
    text: 'One of your engineers rewrote the hot loop. +30% compute while it holds.',
  },
  {
    id: 'audit', name: 'Regulatory inspection', weight: 5, minTier: 3, days: 3, tone: 'neutral',
    mods: {},
    inspect: true,
    text: 'An inspector is on site for three days. Keep temperatures under control or expect a fine.',
  },

  // ------------------------------------------------------------- decisions
  {
    id: 'poach', name: 'Talent poaching', weight: 6, minTier: 2, tone: 'neutral', choice: true,
    text: 'A competitor is offering your senior technicians 40% more. They are waiting for your answer.',
    options: [
      { label: 'Match the offer', hint: 'Costs 6 days of total salary', effect: 'poach_pay' },
      { label: 'Let them walk', hint: 'Lose 2 technicians', effect: 'poach_lose' },
    ],
  },
  {
    id: 'ransom', name: 'Ransomware', weight: 6, minTier: 3, tone: 'bad', choice: true,
    text: 'Something is encrypting your management plane. There is a countdown and a wallet address.',
    options: [
      { label: 'Pay quietly', hint: 'Costs 4% of your cash', effect: 'ransom_pay' },
      { label: 'Rebuild from backup', hint: '2 days at 45% output, −6 reputation', effect: 'ransom_rebuild' },
    ],
  },
  {
    id: 'vc', name: 'Investment offer', weight: 5, minTier: 2, tone: 'good', choice: true,
    text: 'A fund wants in. They will wire you a serious cheque against a slice of future revenue.',
    options: [
      { label: 'Take the money', hint: 'Big cash injection, −12% contract pay for 20 days', effect: 'vc_take' },
      { label: 'Stay independent', hint: '+8 reputation', effect: 'vc_decline' },
    ],
  },
  {
    id: 'recall', name: 'Hardware recall', weight: 5, minTier: 3, tone: 'bad', choice: true,
    text: 'The vendor has recalled a batch of boards. Yours are in it.',
    options: [
      { label: 'Return them now', hint: 'Lose 12% of installed units, get 70% of value back', effect: 'recall_return' },
      { label: 'Keep running them', hint: 'Wear doubles for 8 days', effect: 'recall_keep' },
    ],
  },
  {
    id: 'bigclient', name: 'Anchor tenant', weight: 4, minTier: 4, tone: 'good', choice: true,
    text: 'A hyperscaler wants to pre-buy capacity for a year, at a discount, paid up front.',
    options: [
      { label: 'Sign it', hint: 'Large lump sum, −18% contract pay for 30 days', effect: 'anchor_sign' },
      { label: 'Decline', hint: '+14 reputation, they respect the discipline', effect: 'anchor_decline' },
    ],
  },
  {
    id: 'grant', name: 'Research grant', weight: 5, minTier: 3, tone: 'good', choice: true,
    text: 'A public programme will fund efficiency work if you commit compute to their benchmark.',
    options: [
      { label: 'Commit 15% of compute', hint: '10 days of heavy research income', effect: 'grant_take' },
      { label: 'Politely decline', hint: 'Nothing changes', effect: 'grant_decline' },
    ],
  },
  {
    id: 'fire', name: 'Battery fire', weight: 3, minTier: 4, tone: 'bad', choice: true,
    text: 'A UPS string has gone thermal. Suppression has fired. Something is going to be lost.',
    options: [
      { label: 'Emergency shutdown', hint: '1.5 days offline, hardware safe', effect: 'fire_shutdown' },
      { label: 'Isolate and keep running', hint: 'Damage 8% of units, stay online', effect: 'fire_isolate' },
    ],
  },
];

export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
