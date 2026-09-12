// The research tree. Points are spent instantly; the gating is the
// prerequisite chain plus the cost curve.
//
// effects keys (all optional, multiplied/added together across nodes):
//   computeMult powerMult heatMult coolMult waterMult wearMult repairMult
//   researchMult priceMult repMult gridCostMult fuelMult upkeepMult
//   offerSize boardSize staffCap offlineHours uptimeBonus rackSlotBonus

export const RESEARCH = [
  // ============================================================== hardware
  { id: 'rnd_rails', name: 'Rack rails', cat: 'hardware', cost: 4, req: [],
    desc: 'Unlocks the 1U pizza box.' },
  { id: 'rnd_rack2', name: 'Enclosed racks', cat: 'facility', cost: 6, req: ['rnd_rails'],
    desc: 'Unlocks the enclosed rack: 18 slots and a real airflow path.' },
  { id: 'rnd_storage', name: 'Storage arrays', cat: 'hardware', cost: 10, req: ['rnd_rails'],
    desc: 'Unlocks the 2U database node.' },
  { id: 'rnd_blades', name: 'Blade architecture', cat: 'hardware', cost: 32, req: ['rnd_storage'],
    desc: 'Unlocks the blade chassis.' },
  { id: 'rnd_gpu', name: 'GPU acceleration', cat: 'hardware', cost: 90, req: ['rnd_blades'],
    desc: 'Unlocks the quad-GPU node. This is where the money starts.' },
  { id: 'rnd_trainpod', name: 'Training fabrics', cat: 'hardware', cost: 205, req: ['rnd_gpu', 'rnd_switch2'],
    desc: 'Unlocks the training pod.' },
  { id: 'rnd_tensor', name: 'Systolic arrays', cat: 'hardware', cost: 382, req: ['rnd_trainpod'],
    desc: 'Unlocks the tensor rack unit.' },
  { id: 'rnd_superpod', name: 'Direct-to-chip liquid', cat: 'hardware', cost: 661, req: ['rnd_tensor', 'rnd_rack4'],
    desc: 'Unlocks the liquid superpod.' },
  { id: 'rnd_photonic', name: 'Silicon photonics', cat: 'hardware', cost: 1_059, req: ['rnd_superpod'],
    desc: 'Unlocks the photonic accelerator.' },
  { id: 'rnd_quantum', name: 'Error-corrected qubits', cat: 'hardware', cost: 1_710, req: ['rnd_photonic', 'rnd_cryo'],
    desc: 'Unlocks the quantum coprocessor.' },
  { id: 'rnd_neuro', name: 'Neuromorphic silicon', cat: 'hardware', cost: 2_664, req: ['rnd_quantum'],
    desc: 'Unlocks the neuromorphic lattice.' },
  { id: 'rnd_zetta', name: 'Zettascale integration', cat: 'hardware', cost: 4_590, req: ['rnd_neuro', 'rnd_fusion'],
    desc: 'Unlocks the zettascale core. There is nothing after this.' },

  // ---- the sibling at each tier. Each hangs off its tier-mate, so the
  // alternative arrives a beat after the thing it is an alternative to,
  // rather than presenting two unknowns at once.
  { id: 'rnd_minipc', name: 'Small form factor', cat: 'hardware', cost: 5, req: ['rnd_rails'],
    desc: 'Unlocks the mini PC cluster: less work per slot, a third of the heat.' },
  { id: 'rnd_archive', name: 'Cold storage', cat: 'hardware', cost: 14, req: ['rnd_storage'],
    desc: 'Unlocks the archive node. Cheap to run and hard to break.' },
  { id: 'rnd_twin', name: 'Twin-node chassis', cat: 'hardware', cost: 41, req: ['rnd_blades'],
    desc: 'Unlocks the twin 1U node: density, at a temperature that costs you.' },
  { id: 'rnd_fpga', name: 'Reconfigurable logic', cat: 'hardware', cost: 112, req: ['rnd_gpu'],
    desc: 'Unlocks the FPGA array. Frugal, patient, and dear per unit of work.' },
  { id: 'rnd_arm', name: 'Many-core ARM', cat: 'hardware', cost: 244, req: ['rnd_trainpod'],
    desc: 'Unlocks the ARM microserver sled. Sips power, wants switching.' },
  { id: 'rnd_inference', name: 'Serving appliances', cat: 'hardware', cost: 430, req: ['rnd_tensor'],
    desc: 'Unlocks the inference appliance: built to serve rather than to train.' },
  { id: 'rnd_denspod', name: 'High-density packaging', cat: 'hardware', cost: 742, req: ['rnd_superpod'],
    desc: 'Unlocks the dense compute pod. More per slot, and it eats itself doing it.' },
  { id: 'rnd_wafer', name: 'Wafer-scale integration', cat: 'hardware', cost: 1_190, req: ['rnd_photonic'],
    desc: 'Unlocks the wafer-scale engine: one die the size of a dinner plate.' },
  { id: 'rnd_optic', name: 'Optical switching', cat: 'hardware', cost: 1_880, req: ['rnd_quantum', 'rnd_switch4'],
    desc: 'Unlocks the optical fabric node. A third of the network to feed it.' },
  { id: 'rnd_analog', name: 'Analogue compute', cat: 'hardware', cost: 2_930, req: ['rnd_neuro'],
    desc: 'Unlocks the analogue compute array: the cheapest work at its tier, and the shortest-lived.' },
  { id: 'rnd_swarm', name: 'Swarm redundancy', cat: 'hardware', cost: 4_880, req: ['rnd_zetta'],
    desc: 'Unlocks the swarm node. Less output than a zettascale core and a fraction of the wear.' },
  { id: 'rnd_supercon', name: 'Room-temperature superconduction', cat: 'hardware', cost: 6_400, req: ['rnd_zetta', 'rnd_cryo2'],
    desc: 'Unlocks the superconducting core: the most work a single slot can hold.' },

  { id: 'rnd_tune1', name: 'Kernel tuning', cat: 'hardware', cost: 7, req: ['rnd_rails'],
    effects: { computeMult: 1.2 }, desc: '+20% compute from all hardware.' },
  { id: 'rnd_tune2', name: 'Vectorised runtimes', cat: 'hardware', cost: 40, req: ['rnd_tune1'],
    effects: { computeMult: 1.3 }, desc: '+30% compute from all hardware.' },
  { id: 'rnd_tune3', name: 'Scheduler overhaul', cat: 'hardware', cost: 156, req: ['rnd_tune2'],
    effects: { computeMult: 1.35 }, desc: '+35% compute from all hardware.' },
  { id: 'rnd_tune4', name: 'Sparsity exploitation', cat: 'hardware', cost: 542, req: ['rnd_tune3', 'rnd_gpu'],
    effects: { computeMult: 1.4 }, desc: '+40% compute from all hardware.' },
  { id: 'rnd_tune5', name: 'Compiler autotuning', cat: 'hardware', cost: 1_264, req: ['rnd_tune4'],
    effects: { computeMult: 1.45 }, desc: '+45% compute from all hardware.' },
  { id: 'rnd_tune6', name: 'Speculative co-issue', cat: 'hardware', cost: 3_041, req: ['rnd_tune5', 'rnd_photonic'],
    effects: { computeMult: 1.5 }, desc: '+50% compute from all hardware.' },
  { id: 'rnd_undervolt', name: 'Undervolting', cat: 'hardware', cost: 25, req: ['rnd_tune1'],
    effects: { powerMult: 0.9, heatMult: 0.9 }, desc: '-10% hardware power and heat.' },
  { id: 'rnd_process', name: 'Smaller process node', cat: 'hardware', cost: 269, req: ['rnd_undervolt', 'rnd_gpu'],
    effects: { powerMult: 0.85, heatMult: 0.85 }, desc: 'Another -15% power and heat.' },
  { id: 'rnd_backside', name: 'Backside power delivery', cat: 'hardware', cost: 1_182, req: ['rnd_process'],
    effects: { powerMult: 0.82, heatMult: 0.85 }, desc: 'Another -18% power, -15% heat.' },
  { id: 'rnd_reversible', name: 'Adiabatic logic', cat: 'hardware', cost: 3_727, req: ['rnd_backside', 'rnd_neuro'],
    effects: { powerMult: 0.7, heatMult: 0.65 }, desc: 'Near-reversible switching. -30% power, -35% heat.' },

  // ============================================================== facility
  { id: 'rnd_slots1', name: 'Blanking panels', cat: 'facility', cost: 14, req: ['rnd_rack2'],
    effects: { rackSlotBonus: 2 }, desc: '+2 slots in every rack.' },
  { id: 'rnd_rack3', name: 'High-density cabinets', cat: 'facility', cost: 68, req: ['rnd_slots1'],
    desc: 'Unlocks the high-density cabinet: 34 slots.' },
  { id: 'rnd_slots2', name: 'Deep-frame retrofit', cat: 'facility', cost: 173, req: ['rnd_rack3'],
    effects: { rackSlotBonus: 4 }, desc: '+4 more slots in every rack.' },
  { id: 'rnd_rack4', name: 'Immersion cooling', cat: 'facility', cost: 501, req: ['rnd_slots2', 'rnd_chiller'],
    desc: 'Unlocks the immersion tank, which cools 45% of its own heat.' },
  { id: 'rnd_slots3', name: 'Vertical stacking', cat: 'facility', cost: 1_382, req: ['rnd_rack4'],
    effects: { rackSlotBonus: 8 }, desc: '+8 more slots in every rack.' },
  { id: 'rnd_rack5', name: 'Cryogenic vaults', cat: 'facility', cost: 3_383, req: ['rnd_slots3', 'rnd_cryo'],
    desc: 'Unlocks the cryo vault: 84 slots and 70% self-cooling.' },
  { id: 'rnd_slots4', name: 'Chassis densification', cat: 'facility', cost: 5_463, req: ['rnd_rack5'],
    effects: { rackSlotBonus: 14 }, desc: '+14 more slots in every rack.' },
  { id: 'rnd_prefab', name: 'Prefab modules', cat: 'facility', cost: 124, req: ['rnd_rack3'],
    effects: { buildCostMult: 0.85 }, desc: 'All buildings cost 15% less.' },
  { id: 'rnd_prefab2', name: 'Factory-built halls', cat: 'facility', cost: 982, req: ['rnd_prefab'],
    effects: { buildCostMult: 0.82 }, desc: 'Another 18% off every building.' },

  // ================================================================= power
  { id: 'rnd_pdu2', name: 'Metered PDUs', cat: 'power', cost: 8, req: [],
    desc: 'Unlocks the rack PDU: 400 kW over 3 tiles.' },
  { id: 'rnd_ups', name: 'Battery backup', cat: 'power', cost: 22, req: ['rnd_pdu2'],
    desc: 'Unlocks the UPS cabinet, which rides through short outages.' },
  { id: 'rnd_genset', name: 'Standby generation', cat: 'power', cost: 35, req: ['rnd_ups'],
    desc: 'Unlocks the diesel genset.' },
  { id: 'rnd_pdu3', name: 'Overhead busway', cat: 'power', cost: 76, req: ['rnd_pdu2'],
    desc: 'Unlocks the busway tap: 8 MW over 4 tiles.' },
  { id: 'rnd_solar', name: 'Photovoltaics', cat: 'power', cost: 103, req: ['rnd_genset'],
    desc: 'Unlocks the solar array. Daylight only.' },
  { id: 'rnd_grid1', name: 'Utility negotiation', cat: 'power', cost: 49, req: ['rnd_pdu2'],
    effects: { gridCostMult: 0.85 }, desc: 'Grid electricity costs 15% less.' },
  { id: 'rnd_wind', name: 'Wind generation', cat: 'power', cost: 303, req: ['rnd_solar'],
    desc: 'Unlocks the wind turbine.' },
  { id: 'rnd_pdu4', name: 'Own substation', cat: 'power', cost: 621, req: ['rnd_pdu3', 'rnd_grid1'],
    desc: 'Unlocks the substation bay: 120 MW over 6 tiles.' },
  { id: 'rnd_turbine', name: 'Combined cycle', cat: 'power', cost: 940, req: ['rnd_wind'],
    desc: 'Unlocks the gas turbine.' },
  { id: 'rnd_grid2', name: 'Wholesale contracts', cat: 'power', cost: 781, req: ['rnd_grid1'],
    effects: { gridCostMult: 0.78 }, desc: 'Another 22% off grid electricity.' },
  { id: 'rnd_fuel', name: 'Fuel logistics', cat: 'power', cost: 1_059, req: ['rnd_turbine'],
    effects: { fuelMult: 0.7 }, desc: 'Generator fuel costs 30% less.' },
  { id: 'rnd_smr', name: 'Modular fission', cat: 'power', cost: 2_456, req: ['rnd_turbine', 'rnd_pdu4'],
    desc: 'Unlocks the small modular reactor.' },
  { id: 'rnd_pdu5', name: 'HVDC distribution', cat: 'power', cost: 3_641, req: ['rnd_pdu4', 'rnd_smr'],
    desc: 'Unlocks the HVDC spine: 2 GW over 9 tiles.' },
  { id: 'rnd_fusion', name: 'Magnetic confinement', cat: 'power', cost: 6_356, req: ['rnd_smr', 'rnd_pdu5'],
    desc: 'Unlocks the fusion tokamak. 6 GW on site.' },

  // =============================================================== cooling
  { id: 'rnd_split', name: 'Refrigerant cooling', cat: 'cooling', cost: 9, req: [],
    desc: 'Unlocks the split AC unit.' },
  { id: 'rnd_airflow', name: 'Hot aisle containment', cat: 'cooling', cost: 28, req: ['rnd_split'],
    effects: { coolMult: 1.25 }, desc: '+25% capacity from every cooling unit.' },
  { id: 'rnd_crac', name: 'Raised floor plenum', cat: 'cooling', cost: 64, req: ['rnd_airflow'],
    desc: 'Unlocks the CRAC unit.' },
  { id: 'rnd_setpoint', name: 'Raised setpoints', cat: 'cooling', cost: 132, req: ['rnd_crac'],
    effects: { coolMult: 1.2, wearMult: 1.05 }, desc: '+20% cooling, 5% more wear. Worth it.' },
  { id: 'rnd_chiller', name: 'Chilled water loops', cat: 'cooling', cost: 343, req: ['rnd_setpoint'],
    desc: 'Unlocks the chilled water plant.' },
  { id: 'rnd_vfd', name: 'Variable speed drives', cat: 'cooling', cost: 462, req: ['rnd_chiller'],
    effects: { coolDrawMult: 0.72 }, desc: 'Cooling equipment draws 28% less power.' },
  { id: 'rnd_freecool', name: 'Economiser mode', cat: 'cooling', cost: 1_142, req: ['rnd_vfd'],
    desc: 'Unlocks the free-cooling gallery, which rides the night air.' },
  { id: 'rnd_coolmult', name: 'Rear-door exchangers', cat: 'cooling', cost: 1_588, req: ['rnd_freecool'],
    effects: { coolMult: 1.35 }, desc: '+35% capacity from every cooling unit.' },
  { id: 'rnd_adiabatic', name: 'Evaporative assist', cat: 'cooling', cost: 2_621, req: ['rnd_coolmult'],
    desc: 'Unlocks the adiabatic tower.' },
  { id: 'rnd_cryo', name: 'Two-phase coolant', cat: 'cooling', cost: 4_373, req: ['rnd_adiabatic'],
    desc: 'Unlocks the cryogenic loop. Sub-ambient, site-wide.' },
  { id: 'rnd_coolmult2', name: 'Thermal modelling', cat: 'cooling', cost: 5_023, req: ['rnd_cryo'],
    effects: { coolMult: 1.5, coolDrawMult: 0.8 }, desc: '+50% cooling capacity, -20% cooling power.' },

  // ================================================================= water
  { id: 'rnd_mains', name: 'Municipal supply', cat: 'water', cost: 12, req: ['rnd_split'],
    desc: 'Unlocks the mains connection.' },
  { id: 'rnd_well', name: 'Groundwater rights', cat: 'water', cost: 94, req: ['rnd_mains'],
    desc: 'Unlocks the borehole well.' },
  { id: 'rnd_loop', name: 'Closed loops', cat: 'water', cost: 190, req: ['rnd_well'],
    effects: { waterMult: 0.7 }, desc: 'Cooling uses 30% less water per kW removed.' },
  { id: 'rnd_tower', name: 'Recirculating towers', cat: 'water', cost: 582, req: ['rnd_loop'],
    desc: 'Unlocks the cooling tower.' },
  { id: 'rnd_recycler', name: 'Greywater treatment', cat: 'water', cost: 1_956, req: ['rnd_tower'],
    desc: 'Unlocks the greywater recycler.' },
  { id: 'rnd_loop2', name: 'Zero-blowdown chemistry', cat: 'water', cost: 2_789, req: ['rnd_recycler'],
    effects: { waterMult: 0.6 }, desc: 'Another 40% off cooling water use.' },
  { id: 'rnd_desal', name: 'Reverse osmosis', cat: 'water', cost: 4_805, req: ['rnd_loop2'],
    desc: 'Unlocks the desalination skid.' },

  // =================================================================== ops
  { id: 'rnd_office', name: 'Hire people', cat: 'ops', cost: 7, req: [],
    effects: { staffCap: 2 }, desc: 'Unlocks the office and lets you employ anybody at all.' },
  { id: 'rnd_workshop', name: 'Spares inventory', cat: 'ops', cost: 30, req: ['rnd_office'],
    desc: 'Unlocks the repair workshop.' },
  { id: 'rnd_monitor', name: 'Monitoring stack', cat: 'ops', cost: 53, req: ['rnd_workshop'],
    effects: { repairMult: 1.4, uptimeBonus: 0.02 }, desc: '+40% repair speed, +2% uptime.' },
  { id: 'rnd_security', name: 'Physical security', cat: 'ops', cost: 148, req: ['rnd_monitor'],
    desc: 'Unlocks the security post and reduces intrusion damage.' },
  { id: 'rnd_lab', name: 'In-house R&D', cat: 'ops', cost: 303, req: ['rnd_monitor'],
    desc: 'Unlocks the research lab.' },
  { id: 'rnd_noc', name: 'Follow-the-sun ops', cat: 'ops', cost: 621, req: ['rnd_lab'],
    desc: 'Unlocks the operations centre.' },
  { id: 'rnd_predict', name: 'Predictive maintenance', cat: 'ops', cost: 1_059, req: ['rnd_noc'],
    effects: { wearMult: 0.65, repairMult: 1.5 }, desc: '-35% wear, +50% repair speed.' },
  { id: 'rnd_auto', name: 'Robotic hands', cat: 'ops', cost: 2_123, req: ['rnd_predict'],
    effects: { repairMult: 2.2, staffCap: 6 }, desc: '+120% repair speed, +6 staff capacity.' },
  { id: 'rnd_selfheal', name: 'Self-healing fleet', cat: 'ops', cost: 4_070, req: ['rnd_auto'],
    effects: { wearMult: 0.5, uptimeBonus: 0.04 }, desc: 'Halves wear again, +4% uptime.' },
  { id: 'rnd_offline1', name: 'Night shift', cat: 'ops', cost: 68, req: ['rnd_workshop'],
    effects: { offlineHours: 4 }, desc: '+4 hours of offline progress.' },
  { id: 'rnd_offline2', name: 'Autonomous operations', cat: 'ops', cost: 820, req: ['rnd_offline1', 'rnd_noc'],
    effects: { offlineHours: 8, offlineRate: 0.2 }, desc: '+8 offline hours, +20% offline rate.' },
  { id: 'rnd_offline3', name: 'Lights-out datacentre', cat: 'ops', cost: 3_087, req: ['rnd_offline2'],
    effects: { offlineHours: 12, offlineRate: 0.3 }, desc: '+12 offline hours, +30% offline rate.' },

  // ============================================================== business
  { id: 'rnd_sales1', name: 'First sales hire', cat: 'business', cost: 13, req: ['rnd_office'],
    effects: { offerSize: 1.2 }, desc: 'Customers offer 20% bigger jobs.' },
  { id: 'rnd_sla', name: 'SLA templates', cat: 'business', cost: 35, req: ['rnd_sales1'],
    effects: { priceMult: 1.2 }, desc: 'Contracts pay 20% more.' },
  { id: 'rnd_sales2', name: 'Account management', cat: 'business', cost: 114, req: ['rnd_sla'],
    effects: { boardSize: 1, repMult: 1.3 }, desc: 'One more offer on the board, +30% reputation gain.' },
  { id: 'rnd_switch2', name: 'Spine-leaf fabric', cat: 'business', cost: 103, req: ['rnd_sla'],
    desc: 'Unlocks the aggregation switch.' },
  { id: 'rnd_brand', name: 'Industry reputation', cat: 'business', cost: 262, req: ['rnd_sales2'],
    effects: { priceMult: 1.25, repMult: 1.4 }, desc: '+25% contract pay, +40% reputation gain.' },
  { id: 'rnd_switch3', name: 'Coherent optics', cat: 'business', cost: 739, req: ['rnd_switch2'],
    desc: 'Unlocks the optical spine.' },
  { id: 'rnd_salesfloor', name: 'Enterprise sales', cat: 'business', cost: 900, req: ['rnd_brand'],
    effects: { offerSize: 1.25 }, desc: '25% bigger jobs, and unlocks the sales floor.' },
  { id: 'rnd_hedge', name: 'Energy hedging', cat: 'business', cost: 1_223, req: ['rnd_salesfloor'],
    effects: { priceStability: 0.5 }, desc: 'Halves swings in the electricity price.' },
  { id: 'rnd_lean', name: 'Lean operations', cat: 'business', cost: 1_794, req: ['rnd_hedge'],
    effects: { upkeepMult: 0.7 }, desc: 'All upkeep and salaries cost 30% less.' },
  { id: 'rnd_switch4', name: 'Own transit', cat: 'business', cost: 2_873, req: ['rnd_switch3'],
    desc: 'Unlocks the transit landing.' },
  { id: 'rnd_hyper', name: 'Hyperscale contracts', cat: 'business', cost: 3_938, req: ['rnd_lean', 'rnd_switch4'],
    effects: { offerSize: 1.5, priceMult: 1.5 }, desc: 'Jobs half again as big, and they pay 50% more.' },
  { id: 'rnd_monopoly', name: 'Regional monopoly', cat: 'business', cost: 6_800, req: ['rnd_hyper'],
    effects: { priceMult: 1.8, repMult: 2 }, desc: '+80% contract pay. Nobody else can build here.' },

  // ============================================== the second branch of each tree
  // Everything the additions unlock. Costs sit beside their neighbour on the
  // main line rather than after it: these are alternatives, so they should be
  // reachable at roughly the moment the choice becomes interesting.

  // ---- facility
  { id: 'rnd_wallmount', name: 'Wall mounting', cat: 'facility', cost: 3, req: [],
    desc: 'Unlocks the wall-mount bracket: four slots, no floor.' },
  { id: 'rnd_hotaisle', name: 'Open hot aisle', cat: 'facility', cost: 96, req: ['rnd_rack3'],
    desc: 'Unlocks the open-frame hot aisle: more slots than the sealed cabinet, and no containment at all.' },
  { id: 'rnd_rack6', name: 'Sealed pods', cat: 'facility', cost: 5_600, req: ['rnd_rack5', 'rnd_cryo2'],
    desc: 'Unlocks the sealed pod. A room inside the room, and the most slots there will ever be.' },

  // ---- power
  { id: 'rnd_threephase', name: 'Three-phase drops', cat: 'power', cost: 22, req: ['rnd_pdu2'],
    desc: 'Unlocks the three-phase drop: a dense row rather than a wide floor.' },
  { id: 'rnd_busloop', name: 'Bus loops', cat: 'power', cost: 260, req: ['rnd_pdu3'],
    desc: 'Unlocks the overhead bus loop: less capacity, half the floor again in reach.' },
  { id: 'rnd_flywheel', name: 'Kinetic storage', cat: 'power', cost: 86, req: ['rnd_ups'],
    desc: 'Unlocks the flywheel store: thirty-five seconds that never degrade.' },
  { id: 'rnd_bess', name: 'Grid-scale batteries', cat: 'power', cost: 410, req: ['rnd_flywheel'],
    desc: 'Unlocks the battery wall: a long ride-through, by the tonne.' },
  { id: 'rnd_hydro', name: 'Run-of-river', cat: 'power', cost: 560, req: ['rnd_wind'],
    desc: 'Unlocks the run-of-river turbine. The weir was there first.' },
  { id: 'rnd_biogas', name: 'Anaerobic digestion', cat: 'power', cost: 640, req: ['rnd_turbine'],
    desc: 'Unlocks the biogas engine: cheaper fuel than the turbine, and a great deal more of it.' },
  { id: 'rnd_geo', name: 'Deep geothermal', cat: 'power', cost: 1_480, req: ['rnd_hydro'],
    desc: 'Unlocks the geothermal well: four kilometres down to something reliably hot.' },
  { id: 'rnd_gridtie', name: 'Dual utility feed', cat: 'power', cost: 2_240, req: ['rnd_pdu4'],
    desc: 'Unlocks the second grid feed, from a separate substation. The only thing that survives the first one failing.' },
  { id: 'rnd_fission', name: 'Full-scale fission', cat: 'power', cost: 4_100, req: ['rnd_smr'],
    desc: 'Unlocks the pressurised water plant. Not modular, and not quick.' },

  // ---- cooling
  { id: 'rnd_ducting', name: 'Ducted extract', cat: 'cooling', cost: 4, req: [],
    desc: 'Unlocks ducted extract: the hot air goes outside instead of around.' },
  { id: 'rnd_inrow', name: 'In-row cooling', cat: 'cooling', cost: 46, req: ['rnd_airflow'],
    desc: 'Unlocks the in-row cooler: short reach, and nothing wasted.' },
  { id: 'rnd_rdhx', name: 'Passive rear doors', cat: 'cooling', cost: 186, req: ['rnd_crac'],
    desc: 'Unlocks the rear-door exchanger. It never fights the room.' },
  { id: 'rnd_dryair', name: 'Dry cooling', cat: 'cooling', cost: 520, req: ['rnd_chiller'],
    desc: 'Unlocks the dry cooler bank: no water at all, and worse on a hot afternoon.' },
  { id: 'rnd_absorb', name: 'Absorption cycles', cat: 'cooling', cost: 1_320, req: ['rnd_vfd', 'rnd_turbine'],
    desc: 'Unlocks the absorption chiller, which runs on waste heat instead of electricity.' },
  { id: 'rnd_heatoff', name: 'District heat offtake', cat: 'cooling', cost: 1_960, req: ['rnd_freecool'],
    desc: 'Unlocks the heat offtake: sell it to the city rather than throw it at the sky.' },
  { id: 'rnd_seawater', name: 'Seawater cooling', cat: 'cooling', cost: 3_060, req: ['rnd_adiabatic'],
    desc: 'Unlocks the seawater loop. In cold, out four degrees warmer, answered for annually.' },
  { id: 'rnd_cryo2', name: 'Dilution refrigeration', cat: 'cooling', cost: 5_840, req: ['rnd_cryo'],
    desc: 'Unlocks the dilution stage: millikelvin at the die, and a plant room the size of the old foundry.' },

  // ---- water
  { id: 'rnd_rain', name: 'Rainwater harvesting', cat: 'water', cost: 12, req: ['rnd_mains'],
    desc: 'Unlocks rainwater harvesting. Nearly free, and it does what the weather does.' },
  { id: 'rnd_abstract', name: 'Abstraction licence', cat: 'water', cost: 148, req: ['rnd_well'],
    desc: 'Unlocks river abstraction. Everything downstream is somebody else’s problem.' },
  { id: 'rnd_aquifer', name: 'Deep boreholes', cat: 'water', cost: 880, req: ['rnd_abstract'],
    desc: 'Unlocks the deep aquifer array. It does not come back.' },
  { id: 'rnd_zld', name: 'Zero liquid discharge', cat: 'water', cost: 2_680, req: ['rnd_recycler'],
    desc: 'Unlocks zero liquid discharge: nothing leaves but steam and salt.' },
  { id: 'rnd_pipeline', name: 'Inter-catchment transfer', cat: 'water', cost: 4_420, req: ['rnd_desal'],
    desc: 'Unlocks the transfer pipeline. Ninety kilometres, and three public inquiries.' },

  // ---- support
  { id: 'rnd_stack', name: 'Switch stacking', cat: 'business', cost: 26, req: [],
    desc: 'Unlocks the stacked edge switch: cheaper per gigabit than aggregation, and no cleverer.' },
  { id: 'rnd_peering', name: 'Carrier peering', cat: 'business', cost: 320, req: ['rnd_switch2'],
    desc: 'Unlocks the peering room and stops you paying transit to reach the next county.' },
  { id: 'rnd_canteen', name: 'Shift welfare', cat: 'business', cost: 54, req: ['rnd_office'],
    desc: 'Unlocks the canteen: six more on payroll and a reason to stay to the end of the shift.' },
  { id: 'rnd_spares', name: 'Spares holding', cat: 'business', cost: 168, req: ['rnd_workshop'],
    desc: 'Unlocks the spares store. Repairs stop waiting on a courier from Leeds.' },
  { id: 'rnd_fire', name: 'Inert suppression', cat: 'business', cost: 610, req: ['rnd_security'],
    desc: 'Unlocks the suppression plant, the only system here you hope never reports in.' },
  { id: 'rnd_academy', name: 'In-house training', cat: 'business', cost: 900, req: ['rnd_canteen', 'rnd_spares'],
    desc: 'Unlocks the training academy, which is the only way to get technicians once the city stops having any.' },
  { id: 'rnd_robot', name: 'Robotic maintenance', cat: 'business', cost: 2_090, req: ['rnd_spares', 'rnd_noc'],
    desc: 'Unlocks the robotic swap cell. It racks the new sled at four in the morning.' },
  { id: 'rnd_legal', name: 'Planning and consents', cat: 'business', cost: 1_740, req: ['rnd_salesfloor'],
    desc: 'Unlocks the planning office: the licence, the grid queue and the inquiry, in one room.' },
  { id: 'rnd_noc2', name: 'Follow-the-sun operations', cat: 'business', cost: 2_880, req: ['rnd_noc'],
    desc: 'Unlocks the global operations floor. Three shifts, and none of them see daylight.' },
  { id: 'rnd_lab2', name: 'Materials science', cat: 'business', cost: 3_640, req: ['rnd_lab'],
    desc: 'Unlocks the materials laboratory, where the next coolant comes from.' },

  // ================================================= depth, not more unlocks
  // Forty nodes that buy an effect rather than a building. The tree was one
  // long line of keys to doors; this gives it a middle, where a point can go
  // into making what you already own work better instead of into the next
  // thing to buy.

  // ---- hardware
  { id: 'rnd_sched', name: 'Instruction scheduling', cat: 'hardware', cost: 620, req: ['rnd_tune3'],
    effects: { computeMult: 1.18 }, desc: '+18% compute from all hardware.' },
  { id: 'rnd_pipe', name: 'Speculative pipelines', cat: 'hardware', cost: 1_640, req: ['rnd_sched'],
    effects: { computeMult: 1.22 }, desc: '+22% compute from all hardware.' },
  { id: 'rnd_fleetc', name: 'Whole-fleet compilation', cat: 'hardware', cost: 3_900, req: ['rnd_pipe'],
    effects: { computeMult: 1.26 }, desc: '+26% compute from all hardware.' },
  { id: 'rnd_binning', name: 'Die binning', cat: 'hardware', cost: 210, req: ['rnd_gpu'],
    effects: { computeMult: 1.07, wearMult: 0.95 }, desc: '+7% compute and -5% wear, from sorting what arrives.' },
  { id: 'rnd_derate', name: 'Conservative derating', cat: 'hardware', cost: 480, req: ['rnd_binning'],
    effects: { wearMult: 0.82 }, desc: '-18% wear. Everything runs a little below what it says on the box.' },
  { id: 'rnd_lifecycle', name: 'Lifecycle modelling', cat: 'hardware', cost: 1_420, req: ['rnd_derate'],
    effects: { wearMult: 0.84, hwCostMult: 0.95 }, desc: '-16% wear and hardware costs 5% less.' },
  { id: 'rnd_dvfs', name: 'Dynamic voltage scaling', cat: 'hardware', cost: 890, req: ['rnd_process'],
    effects: { powerMult: 0.88, heatMult: 0.9 }, desc: '-12% hardware power and -10% heat.' },
  { id: 'rnd_nearthr', name: 'Near-threshold operation', cat: 'hardware', cost: 2_480, req: ['rnd_dvfs'],
    effects: { powerMult: 0.86, heatMult: 0.88 }, desc: 'Another -14% power and -12% heat.' },
  { id: 'rnd_blindmate', name: 'Blind-mate backplanes', cat: 'facility', cost: 2_100, req: ['rnd_slots3'],
    effects: { rackSlotBonus: 4 }, desc: '+4 slots in every rack on the floor.' },
  { id: 'rnd_zerou', name: 'Zero-U packaging', cat: 'facility', cost: 5_200, req: ['rnd_blindmate'],
    effects: { rackSlotBonus: 6 }, desc: '+6 more slots in every rack.' },

  // ---- cooling
  { id: 'rnd_cfd', name: 'Airflow modelling', cat: 'cooling', cost: 78, req: ['rnd_airflow'],
    effects: { coolMult: 1.12 }, desc: '+12% cooling, from finding out where the air actually goes.' },
  { id: 'rnd_plenum', name: 'Plenum pressure control', cat: 'cooling', cost: 240, req: ['rnd_crac'],
    effects: { coolMult: 1.14, coolDrawMult: 0.94 }, desc: '+14% cooling and the plant draws 6% less.' },
  { id: 'rnd_glycol', name: 'Glycol loop chemistry', cat: 'cooling', cost: 700, req: ['rnd_chiller'],
    effects: { coolMult: 1.16, waterMult: 0.94 }, desc: '+16% cooling and -6% water.' },
  { id: 'rnd_setpoint2', name: 'ASHRAE class A4', cat: 'cooling', cost: 1_080, req: ['rnd_setpoint'],
    effects: { coolMult: 1.2, wearMult: 1.06 }, desc: 'Run the room warmer: +20% effective cooling, +6% wear.' },
  { id: 'rnd_coolctl', name: 'Predictive plant control', cat: 'cooling', cost: 2_240, req: ['rnd_vfd'],
    effects: { coolDrawMult: 0.84 }, desc: 'Cooling plant draws 16% less, by starting before it is needed.' },
  { id: 'rnd_phase', name: 'Phase-change materials', cat: 'cooling', cost: 3_460, req: ['rnd_coolmult'],
    effects: { coolMult: 1.22, heatMult: 0.95 }, desc: '+22% cooling and -5% hardware heat.' },
  { id: 'rnd_coolmult3', name: 'Whole-campus thermal model', cat: 'cooling', cost: 6_900, req: ['rnd_coolmult2'],
    effects: { coolMult: 1.3, coolDrawMult: 0.9 }, desc: '+30% cooling for 10% less plant draw.' },

  // ---- power
  { id: 'rnd_pfc', name: 'Power factor correction', cat: 'power', cost: 64, req: ['rnd_pdu2'],
    effects: { gridCostMult: 0.93 }, desc: 'Grid electricity costs 7% less.' },
  { id: 'rnd_losses', name: 'Distribution loss audit', cat: 'power', cost: 330, req: ['rnd_pfc'],
    effects: { powerMult: 0.95, gridCostMult: 0.95 }, desc: '-5% draw and 5% off the grid bill.' },
  { id: 'rnd_mv', name: 'Medium-voltage distribution', cat: 'power', cost: 1_180, req: ['rnd_pdu3'],
    effects: { powerMult: 0.93, gridCostMult: 0.92 }, desc: '-7% draw and 8% off the grid bill.' },
  { id: 'rnd_dc', name: 'DC distribution', cat: 'power', cost: 2_760, req: ['rnd_mv'],
    effects: { powerMult: 0.9, heatMult: 0.94 }, desc: '-10% draw and -6% heat: one conversion instead of four.' },
  { id: 'rnd_demand', name: 'Demand response contracts', cat: 'power', cost: 1_520, req: ['rnd_bess'],
    effects: { gridCostMult: 0.86 }, desc: 'Electricity costs 14% less: you are paid to be interruptible.' },
  { id: 'rnd_chp', name: 'Combined heat and power', cat: 'power', cost: 2_020, req: ['rnd_biogas'],
    effects: { fuelMult: 0.78, upkeepMult: 0.96 }, desc: 'Fuel goes 22% further and running costs drop 4%.' },
  { id: 'rnd_island', name: 'Islanding capability', cat: 'power', cost: 3_880, req: ['rnd_gridtie'],
    effects: { powerSupplyMult: 1.08, uptimeBonus: 0.006 }, desc: '+8% supply and a little more uptime: the site can run detached.' },

  // ---- water
  { id: 'rnd_leak', name: 'Leak detection', cat: 'water', cost: 46, req: ['rnd_mains'],
    effects: { waterMult: 0.94 }, desc: '-6% water demand. Most of it was going into the ground.' },
  { id: 'rnd_cycles', name: 'Cycles of concentration', cat: 'water', cost: 290, req: ['rnd_tower'],
    effects: { waterMult: 0.88 }, desc: '-12% water: run the loop longer before you blow it down.' },
  { id: 'rnd_treat', name: 'Side-stream treatment', cat: 'water', cost: 1_240, req: ['rnd_cycles'],
    effects: { waterMult: 0.9, waterCostMult: 0.88 }, desc: '-10% water demand at 12% less per litre.' },
  { id: 'rnd_membrane', name: 'Membrane recovery', cat: 'water', cost: 3_120, req: ['rnd_recycler'],
    effects: { waterMult: 0.86, waterSupplyMult: 1.1 }, desc: '-14% demand and 10% more out of every source.' },
  { id: 'rnd_brine', name: 'Brine management', cat: 'water', cost: 5_100, req: ['rnd_zld'],
    effects: { waterCostMult: 0.75, upkeepMult: 0.97 }, desc: 'Water costs 25% less per litre and the plant is cheaper to run.' },

  // ---- business
  { id: 'rnd_terms', name: 'Standard terms', cat: 'business', cost: 58, req: ['rnd_sla'],
    effects: { penaltyMult: 0.78 }, desc: 'SLA penalties cost 22% less.' },
  { id: 'rnd_terms2', name: 'Negotiated liability caps', cat: 'business', cost: 640, req: ['rnd_terms'],
    effects: { penaltyMult: 0.7 }, desc: 'Penalties cost another 30% less.' },
  { id: 'rnd_pipeline2', name: 'Pipeline management', cat: 'business', cost: 410, req: ['rnd_sales1'],
    effects: { boardSize: 1, repMult: 1.2 }, desc: 'One more offer on the board and reputation grows 20% faster.' },
  { id: 'rnd_known', name: 'A name people know', cat: 'business', cost: 1_560, req: ['rnd_pipeline2'],
    effects: { priceMult: 1.15, repMult: 1.25 }, desc: 'Contracts pay 15% more and your name travels faster still.' },
  { id: 'rnd_multi', name: 'Multi-year framework', cat: 'business', cost: 3_240, req: ['rnd_known'],
    effects: { priceMult: 1.2, priceStability: 1.3 }, desc: '+20% contract pay and a steadier market price.' },
  { id: 'rnd_procure', name: 'Procurement function', cat: 'business', cost: 520, req: ['rnd_office'],
    effects: { hwCostMult: 0.93, buildCostMult: 0.95 }, desc: 'Hardware 7% cheaper, buildings 5% cheaper.' },
  { id: 'rnd_procure2', name: 'Global sourcing', cat: 'business', cost: 2_340, req: ['rnd_procure'],
    effects: { hwCostMult: 0.9, buildCostMult: 0.92 }, desc: 'Another 10% off hardware and 8% off buildings.' },
  { id: 'rnd_shift', name: 'Three-shift rota', cat: 'business', cost: 380, req: ['rnd_canteen'],
    effects: { staffCap: 6, repairMult: 1.2 }, desc: '+6 payroll and +20% repair speed.' },
  { id: 'rnd_remote', name: 'Remote hands', cat: 'business', cost: 1_720, req: ['rnd_shift'],
    effects: { repairMult: 1.5, offlineHours: 4 }, desc: '+50% repair speed, and the site runs four hours longer unattended.' },
  { id: 'rnd_autonomy', name: 'Lights-out operation', cat: 'business', cost: 4_260, req: ['rnd_remote', 'rnd_robot'],
    effects: { repairMult: 1.7, offlineHours: 10, upkeepMult: 0.9 }, desc: 'Nobody on site at all, most nights.' },
  { id: 'rnd_audit', name: 'Continuous audit', cat: 'business', cost: 2_640, req: ['rnd_noc2'],
    effects: { uptimeBonus: 0.012, penaltyMult: 0.85 }, desc: 'Higher baseline uptime, and fewer penalties when it slips anyway.' },
];

/**
 * How much dearer the tree is than it reads above, and why it is done here
 * rather than by editing 174 numbers.
 *
 * Money in this game compounds: reinvest, earn more, reinvest more. Time to
 * afford anything is therefore logarithmic in its price — make the whole
 * facility ladder ten times dearer and the game gets about 20% longer, not
 * ten times longer. Measured: tier 9 arrived on day 176.
 *
 * Research is the one system here that does not compound. Points accrue as
 * compute to the power of 0.3, so doubling the site does not double the
 * output — which means time to finish the tree is very nearly linear in what
 * the tree costs, and it is the only lever in the game with that property.
 * Making research the thing that gates the end is what buys the length.
 *
 * The knee leaves the opening exactly as it was. Nothing at or below it moves,
 * so the guided start still researches its first node in the first minute;
 * everything above it is stretched, and the stretch is all in the part of the
 * game that was finishing in under an hour.
 */
export const RESEARCH_KNEE = 50;
// A plain constant, not an environment override. It was one while I was
// searching for the right value, and `process` does not exist in a browser:
// referencing it threw before optional chaining could help, and the game did
// not boot at all. The check suite caught it by failing to find the start
// button, which is the bluntest possible way to be told.
export const RESEARCH_SCALE = 200;

for (const node of RESEARCH) {
  if (node.cost > RESEARCH_KNEE) {
    node.cost = Math.round(RESEARCH_KNEE + (node.cost - RESEARCH_KNEE) * RESEARCH_SCALE);
  }
}

export const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

export const RESEARCH_CATS = [
  { id: 'hardware', name: 'Hardware' },
  { id: 'facility', name: 'Facility' },
  { id: 'power', name: 'Power' },
  { id: 'cooling', name: 'Cooling' },
  { id: 'water', name: 'Water' },
  { id: 'ops', name: 'Operations' },
  { id: 'business', name: 'Business' },
];

export function available(node, state) {
  return node.req.every((r) => state.research.done.includes(r));
}
