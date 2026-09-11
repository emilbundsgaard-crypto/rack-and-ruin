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
    desc: 'One more offer on the board, and better ones.',
  },
  // ================================================================ additions
  //
  // A second option beside most of the ladder rather than a longer ladder.
  // The rule each of these had to meet: it must be worse than its neighbour
  // at something. A building that is strictly better is not a choice, it is
  // a delay before the obvious purchase.

  // ---------------------------------------------------------------- compute
  {
    id: 'rackw', name: 'Wall-mount bracket', glyph: 'rack', tag: 'WALL', h: 20, cat: 'compute', cost: 380, slots: 4,
    draw: 0.01, upkeep: 1, color: '#356ec0', req: 'rnd_wallmount',
    desc: 'Four units screwed to the brickwork. For when the floor is the thing you have run out of.',
  },
  {
    id: 'rack2h', name: 'Half-height cabinet', glyph: 'rack', tag: 'HALF', h: 24, cat: 'compute', cost: 7_400, slots: 11,
    draw: 0.04, upkeep: 5, color: '#4787d4', req: 'rnd_rack2',
    desc: 'Cheaper per slot than the full enclosed rack, and it fits under a low ceiling.',
  },
  {
    id: 'rack3o', name: 'Open-frame hot aisle', glyph: 'rack', tag: 'AISLE', h: 38, cat: 'compute', cost: 190_000, slots: 40,
    draw: 0.1, upkeep: 44, color: '#58a2ea', req: 'rnd_hotaisle',
    desc: 'More slots than the sealed cabinet and none of the containment. Cool it properly or do not use it.',
  },
  {
    id: 'rack4s', name: 'Single-phase bath', glyph: 'tank', tag: 'BATH', h: 14, cat: 'compute', cost: 4_800_000, slots: 44,
    draw: 0.35, upkeep: 520, color: '#6fc4f4', req: 'rnd_rack4',
    coolSelf: 0.3,
    desc: 'Half the price of the full immersion tank and two thirds of the heat it takes off you.',
  },
  {
    id: 'rack6', name: 'Sealed pod', glyph: 'tank', tag: 'POD', h: 46, cat: 'compute', cost: 22_000_000_000, slots: 132,
    draw: 14, upkeep: 1_400_000, color: '#c8f2ff', req: 'rnd_rack6',
    coolSelf: 0.55,
    desc: 'A room inside the room, with its own atmosphere. The most slots anything will ever give you.',
  },

  // ------------------------------------------------------------------ power
  {
    id: 'pdu1b', name: 'Extension reel', glyph: 'plug', tag: 'REEL', h: 10, cat: 'power', cost: 120, radius: 1, powerCap: 11,
    draw: 0.01, upkeep: 1, color: '#c08f32',
    desc: 'Exactly as bad an idea as it looks, and it is what you can afford on day one.',
  },
  {
    id: 'pdu2b', name: 'Three-phase drop', glyph: 'plug', tag: '3-PHASE', h: 18, cat: 'power', cost: 24_000, radius: 2, powerCap: 900,
    draw: 0.08, upkeep: 14, color: '#e0ac44', req: 'rnd_threephase',
    desc: 'Twice the capacity of a rack PDU over a shorter reach. Feeds a dense row, not a floor.',
  },
  {
    id: 'pdu3b', name: 'Overhead bus loop', glyph: 'busbar', tag: 'LOOP', h: 24, cat: 'power', cost: 340_000, radius: 6, powerCap: 6_200,
    draw: 0.5, upkeep: 210, color: '#efbf52', req: 'rnd_busloop',
    desc: 'Less capacity than a busway tap and half the floor again in reach. Buy it for the shape of the room.',
  },
  {
    id: 'battery', name: 'Battery wall', glyph: 'battery', tag: 'BESS', h: 20, cat: 'power', cost: 1_900_000, ride: 220,
    draw: 1.4, upkeep: 1_900, color: '#f0c86a', req: 'rnd_bess',
    desc: 'Lithium iron phosphate by the tonne. Rides out a long cut, and one day it will be recycled.',
  },
  {
    id: 'flywheel', name: 'Flywheel store', glyph: 'battery', tag: 'FLYWHL', h: 18, cat: 'power', cost: 420_000, ride: 35,
    draw: 2.2, upkeep: 700, color: '#e6bb58', req: 'rnd_flywheel',
    desc: 'Thirty-five seconds of spinning steel. Long enough for the generators, and it never degrades.',
  },
  {
    id: 'hydro', name: 'Run-of-river turbine', glyph: 'wave', tag: 'HYDRO', h: 22, cat: 'power', cost: 38_000_000, supplyKW: 2_400,
    upkeep: 28_000, color: '#e9c46a', req: 'rnd_hydro',
    desc: 'The weir was there before you were. Steady, quiet, and the anglers will never forgive you.',
  },
  {
    id: 'geo', name: 'Geothermal well', glyph: 'well', tag: 'GEO', h: 16, cat: 'power', cost: 240_000_000, supplyKW: 9_800,
    upkeep: 150_000, draw: 40, color: '#f2d07a', req: 'rnd_geo',
    desc: 'Four kilometres down to something that has been hot since before there was a valley.',
  },
  {
    id: 'biogas', name: 'Biogas engine', glyph: 'flame', tag: 'BIOGAS', h: 20, cat: 'power', cost: 6_400_000, supplyKW: 900,
    upkeep: 9_000, fuel: 0.06, heatOut: 260, color: '#e0b84e', req: 'rnd_biogas',
    desc: 'Runs on what the county was paying to bury. Cheaper fuel than the turbine and a great deal more of it.',
  },
  {
    id: 'gridtie', name: 'Second grid feed', glyph: 'transformer', tag: 'FEED 2', h: 30, cat: 'power', cost: 2_800_000_000, supplyKW: 260_000,
    upkeep: 3_400_000, color: '#ffd98f', req: 'rnd_gridtie',
    desc: 'A separate connection from a separate substation, which is the only thing that survives the first one failing.',
  },
  {
    id: 'fission', name: 'Pressurised water plant', glyph: 'reactor', tag: 'PWR', h: 42, cat: 'power', cost: 180_000_000_000, supplyKW: 3_200_000,
    upkeep: 420_000_000, heatOut: 900_000, color: '#ffe6b0', req: 'rnd_fission',
    desc: 'Full scale, not modular. Twelve years of planning inquiry compressed into a purchase order.',
  },

  // ---------------------------------------------------------------- cooling
  {
    id: 'ducted', name: 'Ducted extract', glyph: 'louvre', tag: 'DUCT', h: 14, cat: 'cooling', cost: 1_100, radius: 3, coolCap: 9,
    draw: 0.35, upkeep: 3, color: '#3fc493', req: 'rnd_ducting',
    desc: 'Takes the hot air outside instead of around. Three times the fan for four times the reach.',
  },
  {
    id: 'inrow', name: 'In-row cooler', glyph: 'coil', tag: 'IN-ROW', h: 22, cat: 'cooling', cost: 34_000, radius: 2, coolCap: 120,
    draw: 3.4, water: 0.021, upkeep: 60, color: '#4ad0a0', req: 'rnd_inrow',
    desc: 'Sits in the row and takes the heat where it is made. Short reach, and nothing is wasted.',
  },
  {
    id: 'rdhx', name: 'Rear-door exchanger', glyph: 'coil', tag: 'RDHX', h: 28, cat: 'cooling', cost: 460_000, radius: 3, coolCap: 620,
    draw: 9, water: 0.031, upkeep: 520, color: '#54dcb0', req: 'rnd_rdhx',
    desc: 'A radiator on the back of the cabinet. Passive where it can be, and it never fights the room.',
  },
  {
    id: 'dryair', name: 'Dry cooler bank', glyph: 'louvre', tag: 'DRY', h: 26, cat: 'cooling', cost: 9_800_000, radius: 5, coolCap: 5_200,
    draw: 140, upkeep: 12_000, color: '#6ae6c0', req: 'rnd_dryair',
    ambient: true,
    desc: 'No water at all. Worse than the chiller on a hot afternoon and free of the abstraction licence.',
  },
  {
    id: 'absorb', name: 'Absorption chiller', glyph: 'coil', tag: 'ABSORB', h: 32, cat: 'cooling', cost: 120_000_000, radius: 6,
    coolCap: 42_000, draw: 90, water: 0.049, upkeep: 88_000, color: '#7aeecc', req: 'rnd_absorb',
    desc: 'Runs on the generators’ waste heat rather than on electricity. Almost no draw, and it wants a lot of water.',
  },
  {
    id: 'seawater', name: 'Seawater loop', glyph: 'wave', tag: 'SEA', h: 30, cat: 'cooling', cost: 3_400_000_000, radius: 8,
    coolCap: 620_000, draw: 5_200, water: 0.004, upkeep: 2_100_000, color: '#9af4de', req: 'rnd_seawater',
    desc: 'Pipe it in cold, put it back four degrees warmer, and answer for the four degrees every year.',
  },
  {
    id: 'heatoff', name: 'District heat offtake', glyph: 'coil', tag: 'OFFTAKE', h: 24, cat: 'cooling', cost: 640_000_000, radius: 7,
    coolCap: 95_000, draw: 700, water: 0.006, upkeep: 260_000, color: '#88f0d4', req: 'rnd_heatoff',
    desc: 'Sells the heat to the city instead of throwing it at the sky. There is less city every year to sell it to.',
  },
  {
    id: 'cryo2', name: 'Dilution stage', glyph: 'snow', tag: 'MILLIK', h: 38, cat: 'cooling', cost: 700_000_000_000, radius: 10,
    coolCap: 9_400_000, draw: 42_000, water: 0.010, upkeep: 90_000_000, color: '#d0fff4', req: 'rnd_cryo2',
    desc: 'Millikelvin at the die and a plant room the size of the old foundry. Nothing else will cool what comes next.',
  },

  // ------------------------------------------------------------------ water
  {
    id: 'bowser', name: 'Water bowser', glyph: 'barrel', tag: 'BOWSER', h: 18, cat: 'water', cost: 3_200, supplyWater: 0.3,
    upkeep: 22, waterCost: 4.5, color: '#3570bb',
    desc: 'A tanker on a standing order. Dear per litre and it arrives whatever the mains is doing.',
  },
  {
    id: 'rain', name: 'Rainwater harvesting', glyph: 'recycle', tag: 'RAIN', h: 16, cat: 'water', cost: 46_000, supplyWater: 1.4,
    upkeep: 90, waterCost: 0.05, color: '#4a97e6', req: 'rnd_rain',
    desc: 'The roof is large and the weather is Derbyshire. Nearly free, and it does what the weather does.',
  },
  {
    id: 'river', name: 'River abstraction', glyph: 'wave', tag: 'ABSTRACT', h: 20, cat: 'water', cost: 1_800_000, supplyWater: 26,
    upkeep: 3_400, draw: 6, waterCost: 0.22, color: '#4588cc', req: 'rnd_abstract',
    desc: 'A licence, a screen and a pump. Everything downstream of it is somebody else’s problem.',
  },
  {
    id: 'aquifer', name: 'Deep aquifer array', glyph: 'well', tag: 'DEEP', h: 16, cat: 'water', cost: 62_000_000, supplyWater: 420,
    upkeep: 74_000, draw: 110, waterCost: 0.18, color: '#3f84c4', req: 'rnd_aquifer',
    desc: 'Nine boreholes into water that fell as rain before the Romans. It does not come back.',
  },
  {
    id: 'zld', name: 'Zero liquid discharge', glyph: 'recycle', tag: 'ZLD', h: 30, cat: 'water', cost: 2_600_000_000, supplyWater: 9_800,
    upkeep: 2_900_000, draw: 2_400, waterCost: 0.02, color: '#74c0ff', req: 'rnd_zld',
    desc: 'Nothing leaves the site but steam and salt. The salt is a different department’s problem.',
  },
  {
    id: 'pipeline', name: 'Transfer pipeline', glyph: 'tap', tag: 'PIPE', h: 12, cat: 'water', cost: 46_000_000_000, supplyWater: 78_000,
    upkeep: 54_000_000, draw: 14_000, waterCost: 0.04, color: '#a0dcff', req: 'rnd_pipeline',
    desc: 'Ninety kilometres from a reservoir in another catchment, which is a sentence three inquiries were held about.',
  },

  // ---------------------------------------------------------------- support
  {
    id: 'patch', name: 'Patch panel', glyph: 'switch', tag: 'PATCH', h: 11, cat: 'support', cost: 260, net: 4,
    draw: 0.05, upkeep: 2, color: '#7d60c4',
    desc: 'Four gigabits and a great deal of cable tidying. It is what you have before you have a switch.',
  },
  {
    id: 'switch1b', name: 'Stacked edge switch', glyph: 'switch', tag: 'STACK', h: 15, cat: 'support', cost: 22_000, net: 90,
    draw: 0.9, upkeep: 34, color: '#9878e0', req: 'rnd_stack',
    desc: 'Four top-of-rack switches behaving as one. Cheaper per gigabit than the aggregation layer and no cleverer.',
  },
  {
    id: 'peering', name: 'Peering room', glyph: 'globe', tag: 'PEER', h: 19, cat: 'support', cost: 2_400_000, net: 6_400,
    draw: 9, upkeep: 4_200, color: '#ab88ee', req: 'rnd_peering',
    desc: 'Meet the carriers in a locked cage and stop paying transit to reach the next county.',
  },
  {
    id: 'canteen', name: 'Canteen', glyph: 'desk', tag: 'MESS', h: 20, cat: 'support', cost: 96_000, staff: 6, uptime: 0.008,
    draw: 3, upkeep: 340, color: '#cfc6b2', req: 'rnd_canteen',
    desc: 'Six more on payroll and a reason for the night shift to stay until the end of it.',
  },
  {
    id: 'store', name: 'Spares store', glyph: 'wrench', tag: 'SPARES', h: 20, cat: 'support', cost: 310_000, repair: 0.9,
    draw: 0.6, upkeep: 380, color: '#a8926c', req: 'rnd_spares',
    desc: 'A rack of everything that fails. Repairs stop waiting on a courier from Leeds.',
  },
  {
    id: 'robot', name: 'Robotic swap cell', glyph: 'wrench', tag: 'ROBOT', h: 24, cat: 'support', cost: 78_000_000, repair: 6.5,
    draw: 42, upkeep: 190_000, color: '#c0a882', req: 'rnd_robot',
    desc: 'It pulls the dead sled and racks the new one at four in the morning without being asked twice.',
  },
  {
    id: 'noc2', name: 'Global operations floor', glyph: 'screen', tag: 'GNOC', h: 28, cat: 'support', cost: 260_000_000, uptime: 0.014,
    draw: 60, upkeep: 640_000, color: '#e0cc90', req: 'rnd_noc2',
    desc: 'Follow-the-sun, three shifts, and nobody on it has ever seen the site in daylight.',
  },
  {
    id: 'fire', name: 'Suppression plant', glyph: 'shield', tag: 'FM200', h: 22, cat: 'support', cost: 1_400_000, security: 0.22, uptime: 0.006,
    draw: 1.1, upkeep: 3_100, color: '#8f96a2', req: 'rnd_fire',
    desc: 'Inert gas, very fast valves, and the only system here you hope never reports in.',
  },
  {
    id: 'lab2', name: 'Materials laboratory', glyph: 'flask', tag: 'MATLAB', h: 26, cat: 'support', cost: 420_000_000, research: 34,
    draw: 220, upkeep: 1_100_000, color: '#ea94ba', req: 'rnd_lab2',
    desc: 'Where the next coolant comes from. Fifteen times the output of the research lab and rather more than fifteen times the bill.',
  },
  {
    id: 'legal', name: 'Planning office', glyph: 'tag', tag: 'LEGAL', h: 22, cat: 'support', cost: 46_000_000, contract: 1, uptime: 0.004,
    draw: 6, upkeep: 120_000, color: '#eab07a', req: 'rnd_legal',
    desc: 'Four people whose entire job is the abstraction licence, the grid queue and the inquiry. They pay for themselves.',
  },
  {
    id: 'academy', name: 'Training academy', glyph: 'desk', tag: 'ACADEMY', h: 24, cat: 'support', cost: 8_800_000, staff: 14, repair: 1.4,
    draw: 12, upkeep: 42_000, color: '#d8cfb8', req: 'rnd_academy',
    desc: 'Grows its own technicians, which is the only way to get them once the city stops having any.',
  },
];


export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export const CATEGORIES = [
  { id: 'compute', name: 'Racks' },
  { id: 'power', name: 'Power' },
  { id: 'cooling', name: 'Cooling' },
  { id: 'water', name: 'Water' },
  { id: 'support', name: 'Support' },
];

export function isUnlocked(b, state) {
  return !b.req || state.research.done.includes(b.req);
}
