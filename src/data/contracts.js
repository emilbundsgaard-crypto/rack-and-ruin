// Contract templates. Offers are generated from these, scaled to whatever
// capacity the player currently has, so the board stays relevant forever.
//
//   clients   – firms who might want this. One is picked per offer, so two
//               jobs of the same kind never arrive under the same name.
//   minRep    – reputation needed before the template shows up
//   size      – fraction of *sellable* capacity a typical offer asks for
//   pay       – multiplier on the market rate per unit of compute
//   net       – Gbps required per 1000 compute
//   uptime    – SLA floor; drop below it and penalties start
//   days      – contract length in game-days
//   penalty   – multiple of daily pay charged per breached day
//   research  – bonus research points per day while active (rare)

export const CONTRACT_TEMPLATES = [
  { id: 'static', name: 'Static site hosting', clients: ['Ashbrook Bakery', 'Pennyfield Post Office', 'Larkhill Parish Council'],
    minRep: 0, size: 0.46, pay: 1.00, net: 3, uptime: 0.80, days: 10, penalty: 0.4,
    blurb: 'Six pages and a contact form. It must simply not be down.' },
  { id: 'mail', name: 'Mail & backup', clients: ['Hadley & Finch, Accountants', 'Wray & Sons Solicitors', 'Corbett Veterinary'],
    minRep: 0, size: 0.54, pay: 1.05, net: 4, uptime: 0.85, days: 11, penalty: 0.5,
    blurb: 'Nightly backups and an IMAP server nobody has patched since 2019.' },
  { id: 'intranet', name: 'Corporate intranet', clients: ['Kestrel Logistics', 'Midvale Haulage', 'Brackenridge Foods'],
    minRep: 4, size: 0.53, pay: 1.15, net: 5, uptime: 0.90, days: 13, penalty: 0.6,
    blurb: 'Payroll, timesheets and a wiki with 4000 orphaned pages.' },
  { id: 'shop', name: 'E-commerce storefront', clients: ['Turnbull & Daughter', 'Shopfiy', 'Norfield Garden Centre'],
    minRep: 10, size: 0.59, pay: 1.30, net: 9, uptime: 0.95, days: 14, penalty: 0.9,
    blurb: 'Black Friday is coming and they know exactly when you flinch.' },
  { id: 'game', name: 'Game server cluster', clients: ['Vandal Interactive', 'Steem Interactive', 'Coldbrook Games'],
    minRep: 18, size: 0.62, pay: 1.35, net: 16, uptime: 0.94, days: 12, penalty: 1.0,
    blurb: 'Latency-sensitive, bursty, and the players are extremely vocal.' },
  { id: 'transcode', name: 'Video transcoding', clients: ['Larkfield Media', 'Netflicks', 'Yootube North'],
    minRep: 26, size: 0.65, pay: 1.40, net: 22, uptime: 0.90, days: 16, penalty: 0.8,
    blurb: 'A back catalogue of 40,000 hours, wanted in nine bitrates.' },
  { id: 'cdn', name: 'CDN edge caching', clients: ['Cloudflaire', 'Fastley', 'Aurora Edge'],
    minRep: 34, size: 0.56, pay: 1.30, net: 48, uptime: 0.97, days: 18, penalty: 1.1,
    blurb: 'Mostly bandwidth. Bring switching or do not bother bidding.' },
  { id: 'genome', name: 'Genomics pipeline', clients: ['Wexham Biosciences', 'Illumine Genomics', 'Trent Institute'],
    minRep: 42, size: 0.70, pay: 1.55, net: 12, uptime: 0.88, days: 19, penalty: 0.7,
    research: 1.5,
    blurb: 'Batch work. They care about throughput, not about latency.' },
  { id: 'weather', name: 'Regional weather model', clients: ['Meteorological Bureau', 'Storm Systems Group', 'Coastal Forecasting'],
    minRep: 52, size: 0.71, pay: 1.60, net: 20, uptime: 0.96, days: 21, penalty: 1.2,
    research: 2.5,
    blurb: 'Runs every six hours and must finish before the next one starts.' },
  { id: 'risk', name: 'Financial risk simulation', clients: ['Sterling & Vance Capital', 'Goldmoor Sachs', 'Blackstane Partners'],
    minRep: 64, size: 0.68, pay: 1.95, net: 26, uptime: 0.99, days: 16, penalty: 2.2,
    blurb: 'Overnight Monte Carlo. Miss the open and they will tell everyone.' },
  { id: 'finetune', name: 'LLM fine-tuning', clients: ['Antropik', 'OpenEye Labs', 'Mistrall AI'],
    minRep: 78, size: 0.74, pay: 2.10, net: 40, uptime: 0.97, days: 18, penalty: 1.6,
    research: 5,
    blurb: 'Rented by the GPU-hour, billed by the second, watched constantly.' },
  { id: 'molecular', name: 'Molecular dynamics', clients: ['Pfizzar Labs', 'AstraZenica Research', 'Novo Nordisc Compute'],
    minRep: 92, size: 0.73, pay: 2.05, net: 18, uptime: 0.93, days: 22, penalty: 1.3,
    research: 8,
    blurb: 'Ten million timesteps and a chemist who checks in every hour.' },
  { id: 'pretrain', name: 'Foundation model pretraining', clients: ['OpenEye', 'Antropik Frontier', 'Deap Mind'],
    minRep: 120, size: 0.85, pay: 2.60, net: 90, uptime: 0.995, days: 24, penalty: 3.0,
    research: 14,
    blurb: 'One run. Ninety days. Any interruption restarts the checkpoint.' },
  { id: 'sovereign', name: 'Sovereign AI cloud', clients: ['Department for Digital', 'Bundesrechenzentrum', 'Directorate of Sovereign Compute'],
    minRep: 160, size: 0.81, pay: 2.90, net: 70, uptime: 0.99, days: 29, penalty: 2.6,
    research: 20,
    blurb: 'Air-gapped, audited, and paid for out of a very large budget.' },
  { id: 'climate', name: 'Planetary climate twin', clients: ['Earth Systems Consortium', 'Global Climate Twin', 'Copernicos Programme'],
    minRep: 210, size: 0.85, pay: 3.20, net: 120, uptime: 0.995, days: 30, penalty: 3.4,
    research: 34,
    blurb: 'A kilometre-scale model of the whole atmosphere. Continuously.' },
  { id: 'lattice', name: 'Lattice QCD campaign', clients: ['Cavendish Collaboration', 'Fermilabb', 'Institute for Lattice Physics'],
    minRep: 280, size: 0.85, pay: 3.40, net: 60, uptime: 0.98, days: 30, penalty: 2.8,
    research: 55,
    blurb: 'Physicists with a grant, a deadline and infinite patience for queues.' },
  { id: 'synthesis', name: 'Autonomous materials lab', clients: ['Tessla Materials', 'Helix Foundry', 'Nvidea Labs'],
    minRep: 360, size: 0.85, pay: 3.80, net: 150, uptime: 0.995, days: 30, penalty: 4.0,
    research: 90,
    blurb: 'The model designs the alloy, orders it, tests it, and starts again.' },
  { id: 'oracle', name: 'Continental inference grid', clients: ['Gooogle, Amazorn and Micronsoft', 'The Compute Cartel', 'Everyone, jointly'],
    minRep: 460, size: 0.85, pay: 4.40, net: 240, uptime: 0.997, days: 30, penalty: 4.5,
    research: 150,
    blurb: 'Half a continent asks it questions. You answer all of them.' },

  // ---- the second column of the board.
  //
  // Eighteen templates meant the board repeated itself inside an hour once
  // your reputation was high enough to see most of them. These interleave
  // with the originals rather than extending past them: the same span of
  // reputation, twice as many kinds of work, so what is on offer stays worth
  // reading all the way through.
  { id: 'backup', name: 'Offsite backup vault', clients: ['Hawksmoor Dental', 'Trentside Veterinary', 'Culpepper Accountants'],
    minRep: 0, size: 0.42, pay: 0.95, net: 2, uptime: 0.75, days: 12, penalty: 0.3,
    blurb: 'Nothing ever reads it. It simply has to be there on the one day it is not.' },
  { id: 'cctv', name: 'Council CCTV retention', clients: ['Ashbrook Borough Council', 'Derwent Valley Authority', 'Hallamshire Constabulary'],
    minRep: 2, size: 0.50, pay: 1.02, net: 7, uptime: 0.88, days: 14, penalty: 0.45,
    blurb: 'Ninety days of footage nobody watches, retained because the law says ninety days.' },
  { id: 'payroll', name: 'Payroll bureau', clients: ['Midvale Payroll Services', 'Corbett & Vane', 'Northgate Bureau'],
    minRep: 6, size: 0.48, pay: 1.20, net: 4, uptime: 0.97, days: 15, penalty: 1.1,
    blurb: 'Wrong once and four thousand people notice on the same Friday morning.' },
  { id: 'render', name: 'Render farm overflow', clients: ['Kestrel Animation', 'Pinewoodd Post', 'Larkfield VFX'],
    minRep: 13, size: 0.64, pay: 1.28, net: 14, uptime: 0.86, days: 9, penalty: 0.55,
    blurb: 'Bursty, deadline-driven and entirely indifferent to latency.' },
  { id: 'ctimaging', name: 'Radiology archive', clients: ['Ashbrook General NHS Trust', 'Peak District Imaging', 'Derwent Radiology'],
    minRep: 21, size: 0.57, pay: 1.44, net: 11, uptime: 0.98, days: 20, penalty: 1.5,
    blurb: 'Every scan taken in the county, and every one of them needed within the hour.' },
  { id: 'ledger', name: 'Clearing house ledger', clients: ['Sterling Clearing', 'Mercantile Exchange', 'Northern Settlement'],
    minRep: 30, size: 0.60, pay: 1.62, net: 30, uptime: 0.993, days: 17, penalty: 2.4,
    blurb: 'Settles at four. Not settled by four is a phone call from someone very senior.' },
  { id: 'telemetry', name: 'Fleet telemetry ingest', clients: ['Kestrel Logistics', 'Voltway Mobility', 'Pennine Haulage'],
    minRep: 38, size: 0.66, pay: 1.38, net: 38, uptime: 0.92, days: 18, penalty: 0.85,
    blurb: 'Nine thousand vehicles, one message a second each, forever.' },
  { id: 'seismic', name: 'Seismic inversion', clients: ['Caledonian Survey', 'Brent Geophysics', 'North Sea Imaging'],
    minRep: 47, size: 0.72, pay: 1.70, net: 16, uptime: 0.90, days: 22, penalty: 0.9,
    research: 3,
    blurb: 'Batch work on data that cost more to gather than your site cost to build.' },
  { id: 'protein', name: 'Protein folding queue', clients: ['Wexham Biosciences', 'Ashbrook University', 'Medical Research Consortium'],
    minRep: 58, size: 0.70, pay: 1.82, net: 14, uptime: 0.91, days: 24, penalty: 1.0,
    research: 9,
    blurb: 'The university is two miles away and can no longer afford its own cluster.' },
  { id: 'grid', name: 'National grid dispatch', clients: ['System Operator', 'Balancing Mechanism', 'Transmission Control'],
    minRep: 70, size: 0.64, pay: 2.10, net: 34, uptime: 0.998, days: 26, penalty: 3.2,
    blurb: 'They balance the network your site is the largest single load on. Nobody enjoys the irony.' },
  { id: 'rag', name: 'Retrieval index rebuild', clients: ['Antropik', 'Perplexus', 'OpenEye Labs'],
    minRep: 86, size: 0.76, pay: 2.24, net: 64, uptime: 0.96, days: 15, penalty: 1.4,
    research: 7,
    blurb: 'The whole corpus, re-embedded, every fortnight, because the corpus keeps moving.' },
  { id: 'fusion', name: 'Plasma control loop', clients: ['Culhamm Centre', 'Tokamak Energy Group', 'ITER Support Network'],
    minRep: 104, size: 0.72, pay: 2.35, net: 28, uptime: 0.999, days: 21, penalty: 4.2,
    research: 22,
    blurb: 'It has eleven milliseconds to decide. Miss the window and they lose the shot and the wall.' },
  { id: 'census', name: 'National statistics run', clients: ['Office for Statistics', 'Bundesamt für Statistik', 'Statistics Division'],
    minRep: 130, size: 0.78, pay: 2.55, net: 44, uptime: 0.99, days: 28, penalty: 2.2,
    research: 16,
    blurb: 'Counts everyone in the country. The figure for Ashbrook is one you will read twice.' },
  { id: 'defence', name: 'Signals processing', clients: ['Programme Office', 'Joint Analysis Group', 'The Department'],
    minRep: 185, size: 0.80, pay: 3.00, net: 52, uptime: 0.997, days: 27, penalty: 3.0,
    blurb: 'They tell you the throughput and the uptime, and nothing whatsoever about the workload.' },
  { id: 'genomepop', name: 'Population genomics', clients: ['Hundred Thousand Genomes', 'Nordic Biobank', 'Wellcomme Sanger'],
    minRep: 240, size: 0.82, pay: 3.10, net: 80, uptime: 0.99, days: 30, penalty: 2.9,
    research: 44,
    blurb: 'Every genome in the country, aligned against every other one, overnight.' },
  { id: 'worldmodel', name: 'World model training', clients: ['Deap Mind', 'Antropik Frontier', 'Sovereign Compute Initiative'],
    minRep: 320, size: 0.84, pay: 3.60, net: 180, uptime: 0.996, days: 30, penalty: 3.8,
    research: 72,
    blurb: 'One run, ninety days, and a checkpoint nobody is allowed to lose.' },
  { id: 'exchange', name: 'Continental settlement', clients: ['The Clearing Union', 'Eurosystem Operations', 'Interbank Grid'],
    minRep: 400, size: 0.84, pay: 4.10, net: 200, uptime: 0.999, days: 28, penalty: 5.0,
    blurb: 'Every card transaction on the continent. There is no acceptable minute of downtime.' },
  { id: 'archive', name: 'The permanent record', clients: ['The National Archive', 'Long Now Foundation', 'Memory of the World'],
    minRep: 520, size: 0.86, pay: 4.60, net: 100, uptime: 0.9995, days: 30, penalty: 5.5,
    research: 200,
    blurb: 'Everything written down, kept readable for a thousand years, starting with this contract.' },
];

export const TEMPLATES_BY_ID = Object.fromEntries(CONTRACT_TEMPLATES.map((t) => [t.id, t]));

/** Who is asking this time. */
export function pickClient(t) {
  const list = t.clients || ['A customer'];
  return list[Math.floor(Math.random() * list.length)];
}

/** Slight name variation so the board does not read like a spreadsheet. */
const PREFIX = ['', '', '', 'Priority ', 'Renewal: ', 'Expanded ', 'Pilot ', 'Multi-year '];

export function decorate(template, seed) {
  const p = PREFIX[Math.floor(seed * PREFIX.length) % PREFIX.length];
  return p + template.name;
}
