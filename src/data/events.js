// Random events. Some are pure modifiers with a duration, some stop the game
// and ask you a question. Weight is relative; minTier gates the big ones.
//
// mods (active for `days` game-days):
//   coolMult powerSupplyMult waterSupplyMult priceMult gridCostMult
//   wearMult computeMult uptimePenalty

export const EVENTS = [
  {
    id: 'heatwave', name: 'Heatwave', weight: 10, minTier: 0, days: 3.5, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.7 },
    text: 'Thirty-six degrees outside and the condensers are giving up. Cooling capacity is down 30% for a few days.',
  },
  {
    id: 'coldsnap', name: 'Cold snap', weight: 7, minTier: 1, days: 3, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.35 },
    text: 'Freezing air outside means the economisers do the work for free. +35% cooling.',
  },
  {
    id: 'gridsag', name: 'Grid brownout', weight: 8, minTier: 1, days: 1.6, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 0.62 },
    text: 'The utility is shedding load across the region. Your grid feed is cut to 62% until it clears.',
  },
  {
    id: 'pricespike', name: 'Spot price spike', weight: 9, minTier: 0, days: 2.5, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { gridCostMult: 1.85 },
    text: 'Wholesale electricity has gone vertical. Grid power costs 1.85\u00d7 as much this week.',
  },
  {
    id: 'pricecrash', name: 'Negative spot prices', weight: 5, minTier: 2, days: 2, tone: 'good',
    when: (s, d) => d.gridUsed > 0,
    mods: { gridCostMult: 0.25 },
    text: 'Too much wind on the network. Electricity is almost free for two days.',
  },
  {
    id: 'drought', name: 'Drought restrictions', weight: 7, minTier: 2, days: 5, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.55 },
    text: 'The municipality has cut non-domestic abstraction. Water supply down 45%.',
  },
  {
    id: 'watermain', name: 'Water main break', weight: 5, minTier: 1, days: 1.5, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.42 },
    text: 'A contractor put a digger through the feeder. Water is down to a trickle while they dig it back up.',
  },
  {
    id: 'demand', name: 'Compute crunch', weight: 8, minTier: 1, days: 4, tone: 'good',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 1.6 },
    text: 'Everyone wants capacity at once. Contract rates are up 60%.',
  },
  {
    id: 'glut', name: 'Capacity glut', weight: 6, minTier: 2, days: 4, tone: 'bad',
    when: (s, d) => s.contracts.active.length > 0,
    mods: { priceMult: 0.7 },
    text: 'Three competitors lit up new halls this month. Rates are down 30%.',
  },
  {
    id: 'dust', name: 'Filter contamination', weight: 6, minTier: 1, days: 4, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { wearMult: 1.8, coolMult: 0.9 },
    text: 'Construction dust in the intakes. Hardware wears 80% faster until the filters are swapped.',
  },
  {
    id: 'firmware', name: 'Firmware regression', weight: 6, minTier: 2, days: 2.5, tone: 'bad',
    when: (s, d) => d.computeTotal > 0,
    mods: { computeMult: 0.82 },
    text: 'A vendor firmware update tanked performance. 18% of your compute is gone until it is rolled back.',
  },
  {
    id: 'optimise', name: 'Kernel breakthrough', weight: 5, minTier: 3, days: 5, tone: 'good',
    when: (s, d) => d.computeTotal > 0,
    mods: { computeMult: 1.3 },
    text: 'One of your engineers rewrote the hot loop. +30% compute while it holds.',
  },
  {
    id: 'audit', name: 'Regulatory inspection', weight: 5, minTier: 3, days: 3, tone: 'neutral',
    when: (s, d) => d.unitsTotal > 0,
    mods: {},
    inspect: true,
    text: 'An inspector is on site for three days. Keep temperatures under control or expect a fine.',
  },

  // ------------------------------------------------------------- decisions
  {
    id: 'poach', name: 'Talent poaching', weight: 6, minTier: 2, tone: 'neutral', choice: true,
    when: (s) => (s.staff.tech || 0) >= 2,
    text: 'A competitor is offering your senior technicians 40% more. They are waiting for your answer.',
    options: [
      { label: 'Match the offer', hint: 'Costs 6 days of total salary', effect: 'poach_pay' },
      { label: 'Let them walk', hint: 'Lose 2 technicians', effect: 'poach_lose' },
    ],
  },
  {
    id: 'ransom', name: 'Ransomware', weight: 6, minTier: 3, tone: 'bad', choice: true,
    when: (s, d) => d.computeTotal > 0 && s.money > 0,
    text: 'Something is encrypting your management plane. There is a countdown and a wallet address.',
    options: [
      { label: 'Pay quietly', hint: 'Costs 4% of your cash', effect: 'ransom_pay' },
      { label: 'Rebuild from backup', hint: '2 days at 45% output, −6 reputation', effect: 'ransom_rebuild' },
    ],
  },
  {
    id: 'vc', name: 'Investment offer', weight: 5, minTier: 2, tone: 'good', choice: true,
    when: (s, d) => d.revenue > 0,
    text: 'A fund wants in. They will wire you a serious cheque against a slice of future revenue.',
    options: [
      { label: 'Take the money', hint: 'Big cash injection, −12% contract pay for 20 days', effect: 'vc_take' },
      { label: 'Stay independent', hint: '+8 reputation', effect: 'vc_decline' },
    ],
  },
  {
    id: 'recall', name: 'Hardware recall', weight: 5, minTier: 3, tone: 'bad', choice: true,
    when: (s, d) => d.unitsTotal >= 8,
    text: 'The vendor has recalled a batch of boards. Yours are in it.',
    options: [
      { label: 'Return them now', hint: 'Lose 12% of installed units, get 70% of value back', effect: 'recall_return' },
      { label: 'Keep running them', hint: 'Wear doubles for 8 days', effect: 'recall_keep' },
    ],
  },
  {
    id: 'bigclient', name: 'Anchor tenant', weight: 4, minTier: 4, tone: 'good', choice: true,
    when: (s, d) => d.computeSellable > 0,
    text: 'A hyperscaler wants to pre-buy capacity for a year, at a discount, paid up front.',
    options: [
      { label: 'Sign it', hint: 'Large lump sum, −18% contract pay for 30 days', effect: 'anchor_sign' },
      { label: 'Decline', hint: '+14 reputation, they respect the discipline', effect: 'anchor_decline' },
    ],
  },
  {
    id: 'grant', name: 'Research grant', weight: 5, minTier: 3, tone: 'good', choice: true,
    when: (s, d) => d.computeTotal > 0,
    text: 'A public programme will fund efficiency work if you commit compute to their benchmark.',
    options: [
      { label: 'Commit 15% of compute', hint: '10 days of heavy research income', effect: 'grant_take' },
      { label: 'Politely decline', hint: 'Nothing changes', effect: 'grant_decline' },
    ],
  },
  // ----------------------------------------------------------- Ashbrook
  // The town notices. These only exist once your footprint has actually taken
  // something from it, and they get louder the less of it is left.
  {
    id: 'townnoise', name: 'Noise complaint', weight: 7, minTier: 1, days: 3, tone: 'bad',
    when: (s) => (s.town?.damage || 0) >= 0.12,
    mods: { upkeepMult: 1.15 },
    text: 'Mill Lane has been to the council about the transformer hum. Acoustic screening is going up, and it is on your bill.',
  },
  {
    id: 'townwater', name: 'Abstraction challenge', weight: 6, minTier: 2, days: 4, tone: 'bad',
    when: (s, d) => (s.town?.damage || 0) >= 0.25 && d.waterDemand > 0,
    mods: { waterSupplyMult: 0.7 },
    text: 'The angling club has forced a review of your licence. Abstraction is capped at 70% while it runs.',
  },
  {
    id: 'townpress', name: 'A reporter is asking', weight: 5, minTier: 3, days: 3, tone: 'bad',
    when: (s) => (s.town?.damage || 0) >= 0.5,
    mods: { repMult: 0.8 },
    text: 'A national paper has sent someone to photograph the empty terraces with your fence in the background.',
  },
  {
    id: 'townsell', name: 'Compulsory purchase', weight: 5, minTier: 4, tone: 'neutral', choice: true,
    // Only worth offering while there is still room to expand into.
    when: (s) => (s.town?.damage || 0) >= 0.62 && (s.expand?.h || 0) <= 6,
    text: 'The last families on Mill Lane want out, and the council will not stand in the way. You can buy the row.',
    options: [
      { label: 'Buy the street', hint: 'Costs 8 days of income, +2 rows of floor', effect: 'town_buy' },
      { label: 'Leave them to it', hint: '+10 reputation', effect: 'town_leave' },
    ],
  },
  {
    id: 'fire', name: 'Battery fire', weight: 3, minTier: 4, tone: 'bad', choice: true,
    when: (s, d) => (d.counts.rideSeconds || 0) > 0,
    text: 'A UPS string has gone thermal. Suppression has fired. Something is going to be lost.',
    options: [
      { label: 'Emergency shutdown', hint: '1.5 days offline, hardware safe', effect: 'fire_shutdown' },
      { label: 'Isolate and keep running', hint: 'Damage 8% of units, stay online', effect: 'fire_isolate' },
    ],
  },
  // ==================================================================== more
  //
  // Twenty-four more, written to the same severity as the originals: the
  // worst modifier here is no worse than the worst that was already in, and
  // every one of them still arrives through the ramp rather than all at once.
  {
    id: 'humid', name: 'Humid spell', weight: 8, minTier: 0, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.85 },
    text: 'Warm wet air off the Irish Sea. The evaporative stages are barely doing anything. −15% cooling.',
  },
  {
    id: 'clearnight', name: 'Clear nights', weight: 7, minTier: 0, days: 4, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 1.18 },
    text: 'A settled high and cold nights. The free-cooling hours run to nearly dawn. +18% cooling.',
  },
  {
    id: 'dustfilter', name: 'Filters blocked', weight: 6, minTier: 1, days: 2.5, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { coolMult: 0.88, upkeepMult: 1.06 },
    text: 'Pollen season, and nobody changed the panel filters. Airflow is down until somebody does.',
  },
  {
    id: 'windy', name: 'Named storm', weight: 6, minTier: 2, days: 2, tone: 'good',
    when: (s, d) => d.ownSupply > 0,
    mods: { powerSupplyMult: 1.2, coolMult: 1.1 },
    text: 'Storm Bronwen is sitting over the county. Everything with a blade on it is earning its keep.',
  },
  {
    id: 'gridcurtail', name: 'Curtailment notice', weight: 6, minTier: 3, days: 2.2, tone: 'bad',
    when: (s, d) => d.gridUsed > 0,
    mods: { powerSupplyMult: 0.78 },
    text: 'The network operator has issued a curtailment notice for large loads in the region. You are the large load.',
  },
  {
    id: 'cheapgas', name: 'Gas glut', weight: 5, minTier: 2, days: 4, tone: 'good',
    when: (s, d) => d.fuelCost > 0,
    mods: { fuelMult: 0.55 },
    text: 'A mild winter across Europe and full storage. Fuel is cheap for as long as that lasts.',
  },
  {
    id: 'fuelspike', name: 'Fuel on allocation', weight: 5, minTier: 2, days: 3.5, tone: 'bad',
    when: (s, d) => d.fuelCost > 0,
    mods: { fuelMult: 1.7 },
    text: 'The supplier has moved everyone to allocation. What you can get costs 70% more.',
  },
  {
    id: 'mainsburst', name: 'Water main burst', weight: 6, minTier: 2, days: 2, tone: 'bad',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 0.6 },
    text: 'A Victorian main has gone under the ring road. Pressure is down across the whole district.',
  },
  {
    id: 'wetweek', name: 'A very wet week', weight: 6, minTier: 1, days: 4, tone: 'good',
    when: (s, d) => d.waterDemand > 0,
    mods: { waterSupplyMult: 1.25, coolMult: 1.08 },
    text: 'Four inches in six days. The river is up, the harvesting tanks are full, and the air is cold.',
  },
  {
    id: 'fancurve', name: 'Broken fan curve', weight: 7, minTier: 2, days: 3, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 0.9, wearMult: 1.15 },
    text: 'A vendor update shipped with a broken fan curve. Everything runs hotter and slower until it is rolled back.',
  },
  {
    id: 'kernelfix', name: 'Scheduler patch', weight: 6, minTier: 2, days: 5, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { computeMult: 1.12 },
    text: 'Somebody upstream fixed the scheduler. The same machines are doing 12% more work for nothing.',
  },
  {
    id: 'batchbad', name: 'Bad silicon batch', weight: 5, minTier: 3, days: 6, tone: 'bad',
    when: (s, d) => d.unitsTotal > 20,
    mods: { wearMult: 1.4 },
    text: 'A whole shipment came off a line with a marginal process corner. They will not last as long as they should.',
  },
  {
    id: 'coolant', name: 'Coolant contract', weight: 5, minTier: 4, days: 6, tone: 'good',
    when: (s, d) => d.coolCap > 0,
    mods: { coolMult: 1.15, waterCostMult: 0.8 },
    text: 'A three-year supply deal signed at the bottom of the market. The plant runs better and cheaper.',
  },
  {
    id: 'auditlow', name: 'Efficiency audit', weight: 6, minTier: 3, days: 7, tone: 'good',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 0.85 },
    text: 'The consultants found nine things. Six of them were true and four of them were free.',
  },
  {
    id: 'insurance', name: 'Premium review', weight: 6, minTier: 3, days: 8, tone: 'bad',
    when: (s, d) => d.unitsTotal > 0,
    mods: { upkeepMult: 1.14 },
    text: 'The underwriters have looked at what is on the floor and repriced accordingly.',
  },
  {
    id: 'demandsurge', name: 'Capacity crunch', weight: 7, minTier: 3, days: 4, tone: 'good',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 1.22 },
    text: 'Everyone wants compute this quarter and nobody has any. New contracts are paying 22% over.',
  },
  {
    id: 'demandslump', name: 'Capacity glut', weight: 6, minTier: 3, days: 5, tone: 'bad',
    when: (s, d) => d.computeSellable > 0,
    mods: { priceMult: 0.84 },
    text: 'Three new campuses came online in the same month. Nobody is paying list this quarter.',
  },
  {
    id: 'reference', name: 'A good reference', weight: 6, minTier: 2, days: 6, tone: 'good',
    when: (s) => (s.reputation || 0) > 4,
    mods: { repMult: 1.35, offerSize: 1.12 },
    text: 'A customer said something kind in public, and the kind of people who read that are now calling.',
  },
  {
    id: 'outage', name: 'A visible outage', weight: 5, minTier: 3, days: 4, tone: 'bad',
    when: (s, d) => d.contractDemand > 0,
    mods: { repMult: 0.75 },
    text: 'Forty minutes, in the middle of a weekday, and it made a trade paper. Everyone saw it.',
  },
  {
    id: 'strike', name: 'Contractors walk out', weight: 4, minTier: 4, days: 3, tone: 'bad',
    when: (s, d) => d.brokenTotal > 0,
    mods: { repairMult: 0.5, upkeepMult: 1.08 },
    text: 'The maintenance contractor is in dispute. Nothing gets fixed this week that is not on fire.',
  },

  // ---- decisions
  {
    id: 'earlyaccess', name: 'Early access silicon', weight: 4, minTier: 3, tone: 'neutral', choice: true,
    when: (s, d) => d.unitsTotal > 10,
    text: 'A vendor will give you the next generation six months early, on the understanding that you find the faults.',
    options: [
      { label: 'Take the boards', hint: '30 days of research income, wear up 25% for 12 days', effect: 'early_take' },
      { label: 'Wait for retail', hint: 'Nothing changes', effect: 'early_decline' },
    ],
  },
  {
    id: 'licence', name: 'Abstraction renewal', weight: 4, minTier: 4, tone: 'neutral', choice: true,
    when: (s, d) => d.waterDemand > 0 && (s.town?.damage || 0) >= 0.2,
    text: 'Your water licence is up. The regulator will renew it quietly, or hold a hearing you would win slowly.',
    options: [
      { label: 'Settle it quietly', hint: 'Costs 5 days of income, −6 reputation', effect: 'licence_settle' },
      { label: 'Go to the hearing', hint: '12 days at 70% water, +10 reputation', effect: 'licence_fight' },
    ],
  },
  {
    id: 'heatdeal', name: 'The district heat scheme', weight: 4, minTier: 5, tone: 'good', choice: true,
    when: (s, d) => d.heatLoad > 0 && (s.town?.damage || 0) >= 0.35,
    text: 'The council will take your waste heat for what is left of the housing stock, if you pay for the pipe.',
    options: [
      { label: 'Pay for the pipe', hint: 'Costs 10 days of income, +16 reputation', effect: 'heat_build' },
      { label: 'Not this year', hint: 'Nothing changes', effect: 'heat_decline' },
    ],
  },
  {
    id: 'poach2', name: 'The whole night shift', weight: 3, minTier: 5, tone: 'bad', choice: true,
    when: (s) => (s.staff?.tech || 0) >= 4,
    text: 'A campus two counties over has offered the entire night shift a move, together, with a bonus.',
    options: [
      { label: 'Beat the offer', hint: 'Costs 12 days of total salary', effect: 'poach2_pay' },
      { label: 'Rebuild the shift', hint: 'Lose half your technicians, +30 days of reduced wages', effect: 'poach2_lose' },
    ],
  },
];


export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
