// The six training tracks run by Mechbridge MEP Consultants.
// Durations, fees, dates and trainer names are not confirmed: they render as [TBC] (see CONTENT-TODO.md).

export interface Track {
  slug: string;
  code: string; // drawing-sheet style reference used on cards
  title: string;
  short: string;
  lede: string;
  forWho: string[];
  modules: { title: string; detail: string }[];
  deliverables: string[];
  codes: string[];
  tools: string[];
  img: string;
}

export const tracks: Track[] = [
  {
    slug: 'hvac-design',
    code: 'M-101',
    title: 'HVAC Design',
    short: 'Heat loads to duct and pipe sizing, on Gulf buildings.',
    lede:
      'Cooling a building at 46°C outside is a different job from the textbook. You size chillers, AHUs, FCUs, ducts and chilled water pipes for real Gulf towers and villas, then defend them in a design review.',
    forWho: [
      'Mechanical engineering graduates aiming for MEP design roles',
      'Site engineers who want to move into design',
      'Draughtspeople ready to take on engineering calculations',
    ],
    modules: [
      { title: 'Heat load for the Gulf climate', detail: 'Design conditions for Dubai and Riyadh, envelope, people, lighting and fresh air loads, worked on a live residential tower.' },
      { title: 'Ventilation and fresh air', detail: 'ASHRAE 62.1 rates, car park and kitchen extract, toilet exhaust and pressure regimes.' },
      { title: 'Air-side design', detail: 'AHU and FCU selection, duct sizing by equal friction and static regain, diffuser layouts and acoustics.' },
      { title: 'Chilled water and DX systems', detail: 'Chiller and pump selection, pipe sizing, district cooling interfaces, VRF layouts.' },
      { title: 'Smoke management basics', detail: 'Stair pressurisation and smoke extract as required by the UAE Fire & Life Safety Code.' },
      { title: 'Drawings and review', detail: 'Produce a full HVAC drawing set, then take a design review with a senior engineer.' },
    ],
    deliverables: ['Heat load workbook', 'Equipment schedules', 'Ducting and chilled water layouts', 'Design basis report'],
    codes: ['ASHRAE 62.1', 'ASHRAE 90.1', 'UAE Fire & Life Safety Code', 'Dubai Green Building Regulations', 'SBC 501'],
    tools: ['HAP', 'AutoCAD MEP', 'Revit MEP', 'Duct and pipe sizers'],
    img: 'track-hvac',
  },
  {
    slug: 'plumbing-drainage',
    code: 'P-201',
    title: 'Plumbing & Drainage',
    short: 'Water supply, drainage and storm design to authority standards.',
    lede:
      'Water and drainage are where approval comments pile up. You design supply, hot water, drainage and storm systems the way Dubai Municipality and Saudi authorities expect them, from fixture units to riser diagrams.',
    forWho: [
      'Mechanical and civil graduates entering building services',
      'Plumbing site engineers moving to design',
      'Engineers relocating to the GCC who need the local standards',
    ],
    modules: [
      { title: 'Cold and hot water supply', detail: 'Demand by fixture units, tank and pump sizing, pressure zones in high-rise buildings.' },
      { title: 'Drainage and venting', detail: 'Soil, waste and vent systems, stack sizing and the details that fail inspections.' },
      { title: 'Storm water and irrigation interfaces', detail: 'Roof drainage, rainfall intensities for the region, interface with civil and landscape.' },
      { title: 'Plant rooms and equipment', detail: 'Booster sets, water heaters, solar hot water and lifting stations.' },
      { title: 'Authority submissions', detail: 'Preparing drawings and calculations for municipality approval.' },
      { title: 'Drawings and review', detail: 'Full plumbing and drainage set for a live project, reviewed by a senior engineer.' },
    ],
    deliverables: ['Water demand calculations', 'Riser and schematic diagrams', 'Floor layouts', 'Plant room details'],
    codes: ['Dubai Municipality plumbing regulations', 'Uniform Plumbing Code', 'BS EN 12056', 'SBC 701 / 702'],
    tools: ['AutoCAD MEP', 'Revit MEP', 'Pipe sizing tools'],
    img: 'track-plumbing',
  },
  {
    slug: 'fire-fighting-alarm',
    code: 'FP-301',
    title: 'Fire Fighting & Fire Alarm',
    short: 'Sprinklers, hydrants, alarm and voice evac, to Civil Defence.',
    lede:
      'Fire and life safety is the one system a building can’t open without. You design sprinkler, hydrant and suppression systems, fire alarm and voice evacuation, and learn how Civil Defence reviews them.',
    forWho: [
      'Mechanical and electrical engineers specialising in fire protection',
      'Fire contractors’ engineers who want design depth',
      'MEP engineers who keep getting Civil Defence comments',
    ],
    modules: [
      { title: 'Hazard classification', detail: 'Occupancy and hazard classes, and what they mean for density, area and duration.' },
      { title: 'Sprinkler design and hydraulics', detail: 'Layouts, pipe sizing and hydraulic calculations worked by hand and in software.' },
      { title: 'Hydrants, hose reels and pumps', detail: 'Wet and dry risers, fire pump selection, water storage.' },
      { title: 'Clean agent and special systems', detail: 'FM-200 and similar gas suppression, kitchen hood systems.' },
      { title: 'Fire alarm and voice evacuation', detail: 'Detector spacing, cause-and-effect matrices, interfaces with HVAC, lifts and doors.' },
      { title: 'Civil Defence review', detail: 'How DCD and SBC 801 submissions are checked, and how to answer comments.' },
    ],
    deliverables: ['Hydraulic calculation report', 'Sprinkler and hydrant layouts', 'Fire alarm layouts and riser', 'Cause-and-effect matrix'],
    codes: ['UAE Fire & Life Safety Code', 'SBC 801', 'NFPA 13', 'NFPA 14', 'NFPA 20', 'NFPA 72'],
    tools: ['Hydraulic calculation software', 'AutoCAD', 'Revit MEP'],
    img: 'track-fire',
  },
  {
    slug: 'electrical-elv',
    code: 'E-401',
    title: 'Electrical & ELV',
    short: 'Load schedules to single lines, lighting and low-current systems.',
    lede:
      'You size the power system for a building from the first load estimate to the utility submission, then add the low-current systems every modern building now expects.',
    forWho: [
      'Electrical engineering graduates entering building services',
      'Electrical site engineers moving into design',
      'ELV and security engineers who want the power side',
    ],
    modules: [
      { title: 'Load estimation and schedules', detail: 'Connected and demand loads, diversity, DB and MDB schedules.' },
      { title: 'Cable sizing and protection', detail: 'Voltage drop, short circuit, discrimination and earthing.' },
      { title: 'Single line diagrams', detail: 'From substation and transformer to final circuits, ready for DEWA or SEC.' },
      { title: 'Lighting design', detail: 'Lux levels, layouts, emergency lighting and controls.' },
      { title: 'ELV systems', detail: 'Structured cabling, CCTV, access control, public address and BMS interfaces.' },
      { title: 'Utility submissions and review', detail: 'Preparing DEWA and SEC packages, then a review with a senior engineer.' },
    ],
    deliverables: ['Load schedules', 'Single line diagram', 'Lighting and power layouts', 'ELV riser diagrams'],
    codes: ['DEWA regulations', 'SEC distribution code', 'BS 7671', 'IEC 60364', 'SBC 401'],
    tools: ['DIALux', 'ETAP or equivalent', 'AutoCAD', 'Revit MEP'],
    img: 'track-electrical',
  },
  {
    slug: 'revit-mep-bim',
    code: 'BIM-501',
    title: 'Revit MEP & BIM Coordination',
    short: 'Model, coordinate and clash-check like a design office does.',
    lede:
      'Gulf projects are now coordinated in BIM. You model all MEP services in Revit, run clash detection in Navisworks, and learn how a coordination meeting on a live job actually runs.',
    forWho: [
      'MEP engineers who design in 2D and need to move to BIM',
      'Draughtspeople and modellers who want coordination roles',
      'Graduates who want a fast route into a design office',
    ],
    modules: [
      { title: 'Revit MEP set-up', detail: 'Templates, families, worksharing and the standards a consultancy uses.' },
      { title: 'Modelling services', detail: 'Ducts, pipes, cable trays and equipment, modelled to LOD 300 and 350.' },
      { title: 'Coordination and clash detection', detail: 'Navisworks clash tests, issue tracking and resolution with other trades.' },
      { title: 'Sheets and schedules', detail: 'Producing issue-ready drawings and quantities straight from the model.' },
      { title: 'BIM execution plans', detail: 'Roles, LOD, naming and exchange as written into Gulf contracts.' },
      { title: 'Live coordination session', detail: 'Join a coordination round on a project model, then present your clash report.' },
    ],
    deliverables: ['Coordinated MEP model', 'Clash report', 'Issued drawing sheets', 'Model schedules'],
    codes: ['ISO 19650', 'Dubai Municipality BIM requirements', 'Project BIM execution plans'],
    tools: ['Revit MEP', 'Navisworks Manage', 'BIM 360 / ACC'],
    img: 'track-bim',
  },
  {
    slug: 'codes-approvals',
    code: 'A-601',
    title: 'Codes & Authority Approvals',
    short: 'How submissions to DM, DCD, DEWA and Saudi authorities get approved.',
    lede:
      'Most delays on a project come from submissions. You learn the codes each authority enforces, how they read a drawing, and how our engineers prepare packages and answer comments.',
    forWho: [
      'Design engineers in any MEP discipline',
      'Project and design managers who handle submissions',
      'Engineers new to the UAE or Saudi Arabia',
    ],
    modules: [
      { title: 'The authority map', detail: 'Who approves what in Dubai, the wider UAE and Saudi Arabia, and in which order.' },
      { title: 'UAE Fire & Life Safety Code', detail: 'The chapters MEP engineers use every day, and the ones they forget.' },
      { title: 'Saudi Building Code', detail: 'SBC 201, 401, 501, 701 and 801 for MEP, and how Saudi reviews differ.' },
      { title: 'Utility approvals', detail: 'DEWA, SEC and water authority submissions.' },
      { title: 'Green building regulations', detail: 'Al Sa’fat, Estidama and their MEP requirements.' },
      { title: 'Comment response workshop', detail: 'Work through real (redacted) authority comments and draft the responses.' },
    ],
    deliverables: ['Submission checklist per authority', 'Code compliance matrix', 'Comment response log'],
    codes: ['UAE Fire & Life Safety Code', 'SBC series', 'NFPA', 'Al Sa’fat', 'Estidama'],
    tools: ['Authority portals walkthrough', 'Compliance matrices'],
    img: 'track-codes',
  },
];
