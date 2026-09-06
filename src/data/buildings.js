// Anything you can place on the floor grid.
//
// Categories drive the build menu tabs:
//   compute | power | cooling | water | support
//
// Coverage fields:
//   radius       – Chebyshev tile radius the machine serves
//   powerCap     – kW of distribution capacity offered to racks in radius (PDU)
//   coolCap      – kW of heat a cooling unit can remove, before efficiency
//   water        – litres/second consumed per kW of heat actually removed
//   supplyKW     – kW of electricity produced
//   supplyWater  – litres/second of water produced
//   draw         – kW the machine itself consumes
//   upkeep       – $/day fixed running cost
//   fuel         – $/kWh burned on top of upkeep (generators)

export const BUILDINGS = [
  // ---------------------------------------------------------------- compute
  {
    id: 'rack', name: 'Open frame rack', glyph: 'rack', tag: 'FRAME', h: 32, cat: 'compute', cost: 1_200, slots: 8,
    draw: 0.03, upkeep: 2, color: '#3f7dd6',
    desc: 'Two posts and a prayer. Holds eight units.',
  },
  {
    id: 'rack2', name: 'Enclosed rack', glyph: 'rack', tag: 'RACK', h: 36, cat: 'compute', cost: 14_000, slots: 18,
    draw: 0.06, upkeep: 9, color: '#4f95e8', req: 'rnd_rack2',
    desc: 'Doors, blanking panels and a sane airflow path.',
  },
  {
    id: 'rack3', name: 'High-density cabinet', glyph: 'rack', tag: 'CABINET', h: 40, cat: 'compute', cost: 260_000, slots: 34,
    draw: 0.14, upkeep: 55, color: '#63aef7', req: 'rnd_rack3',
    desc: 'Rear-door heat exchanger, deep enough for GPU sleds.',
  },
  {
    id: 'rack4', name: 'Immersion tank', glyph: 'tank', tag: 'IMMERSE', h: 16, cat: 'compute', cost: 9_500_000, slots: 56,
    draw: 0.6, upkeep: 900, color: '#7fd0ff', req: 'rnd_rack4',
    coolSelf: 0.45,
    desc: 'Dielectric bath. Removes 45% of its own heat and never rattles.',
  },
  {
    id: 'rack5', name: 'Cryo vault', glyph: 'cryo', tag: 'VAULT', h: 44, cat: 'compute', cost: 1_400_000_000, slots: 84,
    draw: 6, upkeep: 90_000, color: '#a8e5ff', req: 'rnd_rack5',
    coolSelf: 0.7,
    desc: 'Sealed, sub-ambient and slightly terrifying to stand next to.',
  },

  // ------------------------------------------------------------------ power
  {
    id: 'pdu', name: 'Power strip', glyph: 'plug', tag: 'STRIP', h: 12, cat: 'power', cost: 400, radius: 2, powerCap: 30,
    draw: 0.02, upkeep: 1, color: '#d8a13a',
    desc: 'Eight sockets on a cable. Spreads 30 kW over two tiles.',
  },
  {
    id: 'pdu2', name: 'Rack PDU', glyph: 'plug', tag: 'PDU', h: 16, cat: 'power', cost: 6_500, radius: 3, powerCap: 400,
    draw: 0.05, upkeep: 6, color: '#e8b44a', req: 'rnd_pdu2',
    desc: 'Metered, switched, and it will not melt at 40 amps.',
  },
  {
    id: 'pdu3', name: 'Busway tap', glyph: 'busbar', tag: 'BUSWAY', h: 22, cat: 'power', cost: 140_000, radius: 4, powerCap: 8_000,
    draw: 0.3, upkeep: 90, color: '#f5c95f', req: 'rnd_pdu3',
    desc: 'Overhead busway. Add taps wherever a row grows.',
  },
  {
    id: 'pdu4', name: 'Substation bay', glyph: 'transformer', tag: 'SUBSTN', h: 28, cat: 'power', cost: 6_800_000, radius: 6, powerCap: 120_000,
    draw: 3, upkeep: 3_400, color: '#ffd980', req: 'rnd_pdu4',
    desc: 'Medium voltage in, three-phase out, humming all night.',
  },
  {
    id: 'pdu5', name: 'HVDC spine', glyph: 'transformer', tag: 'HVDC', h: 34, cat: 'power', cost: 900_000_000, radius: 9, powerCap: 2_000_000,
    draw: 30, upkeep: 400_000, color: '#ffe9b0', req: 'rnd_pdu5',
    desc: 'One conversion step instead of four. The efficiency is the point.',
  },
  {
    id: 'ups', name: 'UPS cabinet', glyph: 'battery', tag: 'UPS', h: 24, cat: 'power', cost: 22_000, ride: 12, draw: 0.4,
    upkeep: 40, color: '#c98b2f', req: 'rnd_ups',
    desc: 'Rides through 12 seconds of grid loss. Stack them for longer.',
  },
  {
    id: 'genset', name: 'Diesel genset', glyph: 'engine', tag: 'GENSET', h: 22, cat: 'power', cost: 48_000, supplyKW: 220,
    upkeep: 60, fuel: 0.32, color: '#a8632c', req: 'rnd_genset', heatOut: 6,
    desc: 'Starts in nine seconds, costs a fortune per kWh, saves the quarter.',
  },
  {
    id: 'solar', name: 'Solar array', glyph: 'sun', tag: 'SOLAR', h: 7, cat: 'power', cost: 130_000, supplyKW: 160,
    upkeep: 25, color: '#4a7fc0', req: 'rnd_solar', solar: true,
    desc: 'Free power between sunrise and sunset. Nothing at 03:00.',
  },
  {
    id: 'wind', name: 'Wind turbine', glyph: 'turbine', tag: 'WIND', h: 52, cat: 'power', cost: 1_100_000, supplyKW: 900,
    upkeep: 320, color: '#7fa8c8', req: 'rnd_wind', wind: true,
    desc: 'Output rides the weather. Averages well, spikes badly.',
  },
  {
    id: 'turbine', name: 'Gas turbine', glyph: 'flame', tag: 'TURBINE', h: 30, cat: 'power', cost: 9_200_000, supplyKW: 9_000,
    upkeep: 4_200, fuel: 0.11, color: '#c0703a', req: 'rnd_turbine', heatOut: 90,
    desc: 'Combined cycle when you bolt a heat recovery unit on the back.',
  },
  {
    id: 'smr', name: 'Small modular reactor', glyph: 'atom', tag: 'REACTOR', h: 38, cat: 'power', cost: 2_400_000_000, supplyKW: 260_000,
    upkeep: 1_100_000, color: '#5fd0a8', req: 'rnd_smr', heatOut: 900,
    desc: '260 MW behind the fence, refuelled once a decade.',
  },
  {
    id: 'fusion', name: 'Fusion tokamak', glyph: 'star', tag: 'FUSION', h: 46, cat: 'power', cost: 900_000_000_000, supplyKW: 6_000_000,
    upkeep: 90_000_000, color: '#9ff0d8', req: 'rnd_fusion', heatOut: 12_000,
    desc: 'Twenty years away, as always. You got there first.',
  },

  // ---------------------------------------------------------------- cooling
  {
    id: 'fan', name: 'Box fan', glyph: 'fan', tag: 'FAN', h: 11, cat: 'cooling', cost: 250, radius: 2, coolCap: 3.5,
    draw: 0.12, upkeep: 1, color: '#3fb98a',
    desc: 'Moves hot air somewhere else. Somewhere else is also the room.',
  },
  {
    id: 'split', name: 'Split AC unit', glyph: 'fan', tag: 'AC UNIT', h: 16, cat: 'cooling', cost: 5_200, radius: 3, coolCap: 22,
    draw: 0.9, water: 0.012, upkeep: 8, color: '#45c99a', req: 'rnd_split',
    desc: 'A real compressor with a condenser hanging off the wall.',
  },
  {
    id: 'crac', name: 'CRAC unit', glyph: 'coil', tag: 'CRAC', h: 26, cat: 'cooling', cost: 95_000, radius: 4, coolCap: 190,
    draw: 6.5, water: 0.028, upkeep: 120, color: '#4fdca8', req: 'rnd_crac',
    desc: 'Computer room air conditioning, blowing into a raised floor.',
  },
  {
    id: 'chiller', name: 'Chilled water plant', glyph: 'coil', tag: 'CHILLER', h: 30, cat: 'cooling', cost: 2_100_000, radius: 5,
    coolCap: 1_800, draw: 42, water: 0.045, upkeep: 2_600, color: '#5fe8c0', req: 'rnd_chiller',
    desc: 'Chillers, pumps and a loop that runs the whole hall.',
  },
  {
    id: 'freecool', name: 'Free-cooling gallery', glyph: 'louvre', tag: 'ECON', h: 24, cat: 'cooling', cost: 46_000_000, radius: 6,
    coolCap: 17_000, draw: 190, water: 0.020, upkeep: 34_000, color: '#7ff0d0', req: 'rnd_freecool',
    ambient: true,
    desc: 'Louvres and economisers. Nearly free when the night is cold.',
  },
  {
    id: 'adiabatic', name: 'Adiabatic tower', glyph: 'cooltower', tag: 'ADIABAT', h: 40, cat: 'cooling', cost: 700_000_000, radius: 7,
    coolCap: 150_000, draw: 1_100, water: 0.058, upkeep: 480_000, color: '#8ff8dc', req: 'rnd_adiabatic',
    desc: 'Evaporative cooling at scale. Drinks a river, cools a campus.',
  },
  {
    id: 'cryo', name: 'Cryogenic loop', glyph: 'snow', tag: 'CRYO', h: 34, cat: 'cooling', cost: 90_000_000_000, radius: 9,
    coolCap: 2_600_000, draw: 14_000, water: 0.014, upkeep: 22_000_000, color: '#b0ffe8', req: 'rnd_cryo',
    desc: 'Two-phase coolant near its triple point. Sub-ambient everywhere.',
  },

  // ------------------------------------------------------------------ water
  {
    id: 'tank', name: 'Water tank', glyph: 'barrel', tag: 'TANK', h: 20, cat: 'water', cost: 900, supplyWater: 0.06,
    upkeep: 2, color: '#3b7fd0',
    desc: 'A tank somebody refills. Small, dumb, reliable.',
  },
  {
    id: 'mains', name: 'Mains connection', glyph: 'tap', tag: 'MAINS', h: 9, cat: 'water', cost: 18_000, supplyWater: 0.85,
    upkeep: 30, waterCost: 2.2, color: '#4390e0', req: 'rnd_mains',
    desc: 'Municipal supply, metered, and the first thing cut in a drought.',
  },
  {
    id: 'well', name: 'Borehole well', glyph: 'well', tag: 'WELL', h: 14, cat: 'water', cost: 320_000, supplyWater: 9,
    upkeep: 260, draw: 2.4, waterCost: 0.4, color: '#3a78bb', req: 'rnd_well',
    desc: 'Your own aquifer tap. Cheap water, slow recharge.',
  },
  {
    id: 'tower', name: 'Cooling tower', glyph: 'cooltower', tag: 'TOWER', h: 38, cat: 'water', cost: 4_200_000, supplyWater: 80,
    upkeep: 5_800, draw: 26, waterCost: 0.9, color: '#4f9fee', req: 'rnd_tower',
    desc: 'Recirculates the loop. Loses a fraction to the sky as steam.',
  },
  {
    id: 'recycler', name: 'Greywater recycler', glyph: 'recycle', tag: 'RECYCLE', h: 26, cat: 'water', cost: 120_000_000, supplyWater: 1_400,
    upkeep: 190_000, draw: 320, waterCost: 0.15, color: '#63b4ff', req: 'rnd_recycler',
    desc: 'Filters and returns 92% of the loop. The regulator loves it.',
  },
  {
    id: 'desal', name: 'Desalination skid', glyph: 'wave', tag: 'DESAL', h: 28, cat: 'water', cost: 22_000_000_000, supplyWater: 34_000,
    upkeep: 26_000_000, draw: 9_000, waterCost: 0.05, color: '#8cd0ff', req: 'rnd_desal',
    desc: 'The sea is right there and it is not getting any smaller.',
  },

  // ---------------------------------------------------------------- support
  {
    id: 'switch', name: 'Top-of-rack switch', glyph: 'switch', tag: 'SWITCH', h: 13, cat: 'support', cost: 900, net: 12,
    draw: 0.25, upkeep: 6, color: '#8f6fd8',
    desc: 'Twelve gigabits of switching for the row.',
  },
  {
    id: 'switch2', name: 'Aggregation switch', glyph: 'switch', tag: 'AGGREG', h: 17, cat: 'support', cost: 180_000, net: 700,
    draw: 2.2, upkeep: 190, color: '#a07fe8', req: 'rnd_switch2',
    desc: 'Spine layer. Now the racks can actually talk to each other.',
  },
  {
    id: 'switch3', name: 'Optical spine', glyph: 'fibre', tag: 'OPTICAL', h: 21, cat: 'support', cost: 24_000_000, net: 45_000,
    draw: 30, upkeep: 21_000, color: '#b494f5', req: 'rnd_switch3',
    desc: 'Coherent optics between halls, at wire speed.',
  },
  {
    id: 'switch4', name: 'Transit landing', glyph: 'globe', tag: 'TRANSIT', h: 27, cat: 'support', cost: 9_000_000_000, net: 3_000_000,
    draw: 600, upkeep: 6_500_000, color: '#c8adff', req: 'rnd_switch4',
    desc: 'Your own subsea landing station. Peering is now free.',
  },
  {
    id: 'office', name: 'Office', glyph: 'desk', tag: 'OFFICE', h: 22, cat: 'support', cost: 26_000, staff: 4,
    draw: 0.8, upkeep: 45, color: '#c9c2b0', req: 'rnd_office',
    desc: 'Desks, a kettle and room for four more people on payroll.',
  },
  {
    id: 'workshop', name: 'Repair workshop', glyph: 'wrench', tag: 'REPAIR', h: 22, cat: 'support', cost: 74_000, repair: 0.55,
    draw: 1.2, upkeep: 130, color: '#b09a72', req: 'rnd_workshop',
    desc: '+55% repair throughput for the whole site.',
  },
  {
    id: 'noc', name: 'Operations centre', glyph: 'screen', tag: 'NOC', h: 24, cat: 'support', cost: 1_600_000, uptime: 0.035,
    draw: 6, upkeep: 2_800, color: '#d0b878', req: 'rnd_noc',
    desc: 'Eyes on glass. Catches faults before the customer does.',
  },
  {
    id: 'security', name: 'Security post', glyph: 'shield', tag: 'SECURE', h: 20, cat: 'support', cost: 420_000, security: 0.3,
    draw: 2, upkeep: 900, color: '#9aa0aa', req: 'rnd_security',
    desc: 'Mantrap, cameras and somebody who reads the badge logs.',
  },
  {
    id: 'lab', name: 'Research lab', glyph: 'flask', tag: 'LAB', h: 24, cat: 'support', cost: 3_800_000, research: 2.2,
    draw: 14, upkeep: 9_500, color: '#e07fa8', req: 'rnd_lab',
    desc: '+2.2 research points per day, on top of your engineers.',
  },
  {
    id: 'sales', name: 'Sales floor', glyph: 'tag', tag: 'SALES', h: 22, cat: 'support', cost: 12_000_000, contract: 1,
    draw: 5, upkeep: 26_000, color: '#e8a05f', req: 'rnd_salesfloor',
    desc: 'One extra contract slot, and better offers on the board.',
  },
];

export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export const CATEGORIES = [
  { id: 'compute', name: 'Compute' },
  { id: 'power', name: 'Power' },
  { id: 'cooling', name: 'Cooling' },
  { id: 'water', name: 'Water' },
  { id: 'support', name: 'Support' },
];

export function isUnlocked(b, state) {
  return !b.req || state.research.done.includes(b.req);
}
