// Primary offering of Mechbridge International MEP Consultants.
// Scope lists come from the company's own service portfolio (Nov 2026).

export interface ScopeGroup { title: string; items: string[] }
export interface Service {
  slug: string;
  ref: string; // drawing-sheet style discipline code
  title: string;
  short: string; // card line
  highlights: string[]; // the three or four headline capabilities
  lede: string;
  groups: ScopeGroup[];
  deliverables: string[];
  codes: string[];
  img: string; // ImageSlot id prefix: <img>, <img>-wide, <img>-detail
}

export const services: Service[] = [
  {
    slug: 'hvac-engineering',
    ref: 'M',
    title: 'HVAC Engineering',
    short: 'Air conditioning, ventilation, and cooling and heating systems sized for GCC conditions.',
    highlights: ['Air conditioning', 'Ventilation', 'Cooling and heating systems'],
    lede: 'We design air conditioning and ventilation for buildings that run through 46°C summers: load calculations, equipment selection, ductwork and smoke control, drawn to the codes each authority enforces.',
    groups: [
      {
        title: 'HVAC system design',
        items: [
          'Heating and cooling load calculations',
          'Equipment selection and sizing',
          'Chilled water systems',
          'VRF and VRV systems',
          'DX and split AC systems',
          'Duct sizing and layout',
        ],
      },
      {
        title: 'Ventilation and life safety air',
        items: [
          'Ventilation and exhaust systems',
          'Smoke management systems',
          'Stair and lift pressurisation systems',
          'Energy-efficient HVAC solutions',
        ],
      },
      {
        title: 'Construction documentation',
        items: ['HVAC ductwork shop drawings', 'HVAC piping shop drawings', 'Plant room detailed layouts', 'Equipment installation details'],
      },
    ],
    deliverables: ['Heat load calculations', 'Equipment schedules', 'Duct and chilled water layouts', 'Schematics and riser diagrams', 'Design basis report'],
    codes: ['ASHRAE 62.1', 'ASHRAE 90.1', 'SMACNA', 'UAE Fire & Life Safety Code', 'Saudi Building Code 501'],
    img: 'svc-hvac',
  },
  {
    slug: 'firefighting-engineering',
    ref: 'FP',
    title: 'Firefighting Engineering',
    short: 'Fire protection, suppression and hydraulic design, taken through Civil Defence approval.',
    highlights: ['Fire protection', 'Suppression', 'Hydraulic design'],
    lede: 'A building can’t open until Civil Defence signs off its fire systems. We design sprinkler, hydrant and suppression systems, prove them with hydraulic calculations, and coordinate them with every other service.',
    groups: [
      {
        title: 'Fire protection systems',
        items: [
          'Firefighting system design',
          'Automatic sprinkler systems',
          'Fire hose reel systems',
          'Fire hydrant systems',
          'Fire pump room design',
          'Fire water tank sizing',
        ],
      },
      {
        title: 'Suppression',
        items: ['Clean agent fire suppression systems', 'Kitchen hood suppression systems'],
      },
      {
        title: 'Hydraulics and compliance',
        items: ['Fire protection hydraulic calculations', 'Firefighting shop drawings', 'Fire code compliance and coordination'],
      },
    ],
    deliverables: ['Hydraulic calculation reports', 'Sprinkler and hydrant layouts', 'Pump room and tank details', 'Firefighting piping shop drawings', 'Authority submission sets'],
    codes: ['UAE Fire & Life Safety Code', 'Saudi Building Code 801', 'NFPA 13', 'NFPA 14', 'NFPA 20', 'NFPA 2001'],
    img: 'svc-fire',
  },
  {
    slug: 'plumbing-engineering',
    ref: 'P',
    title: 'Plumbing Engineering',
    short: 'Water supply, drainage and public health systems, from fixture units to pump sets.',
    highlights: ['Water supply', 'Drainage', 'Public health systems'],
    lede: 'Water and drainage are where approval comments pile up. We design supply, hot water, drainage and storm systems the way municipalities expect them, from fixture calculations to riser diagrams.',
    groups: [
      {
        title: 'Water supply',
        items: ['Domestic water supply systems', 'Hot water circulation systems', 'Water tank sizing', 'Transfer and booster pump systems', 'Plumbing fixture calculations'],
      },
      {
        title: 'Drainage and public health',
        items: ['Drainage and sewerage systems', 'Stormwater drainage', 'Rainwater harvesting systems', 'Swimming pool plumbing'],
      },
      {
        title: 'Construction documentation',
        items: ['Plumbing piping shop drawings', 'Plant room detailed layouts', 'Pipe support details'],
      },
    ],
    deliverables: ['Water demand calculations', 'Schematic and riser diagrams', 'Floor layouts', 'Pump and tank schedules', 'Plumbing shop drawings'],
    codes: ['Uniform Plumbing Code', 'BS EN 12056', 'Saudi Building Code 701 / 702', 'Local municipality regulations'],
    img: 'svc-plumbing',
  },
  {
    slug: 'mep-design',
    ref: 'D',
    title: 'MEP Design',
    short: 'CAD drafting, coordination and shop drawings, from concept to as-built.',
    highlights: ['CAD drafting', 'Coordination', 'Shop drawings'],
    lede: 'Our drawings are made for the people who build from them. We take MEP design from concept to IFC, coordinate every service in the ceiling, and produce the shop drawings and builders’ work a site team needs.',
    groups: [
      {
        title: 'Engineering design and drafting',
        items: [
          'MEP concept design',
          'MEP schematic design',
          'MEP detailed design',
          'Design development drawings',
          'Construction documentation',
          'IFC (Issued for Construction) drawings',
          'MEP schematic and riser diagrams',
          'MEP design modification and revision',
          'Existing drawing conversion and digitisation',
          'PDF-to-CAD drawing conversion',
        ],
      },
      {
        title: 'Shop drawings and construction documentation',
        items: [
          'HVAC ductwork and piping shop drawings',
          'Firefighting piping shop drawings',
          'Plumbing piping shop drawings',
          'Equipment installation details',
          'Plant room detailed layouts',
          'Pipe and duct support details',
          'MEP builders’ work drawings',
          'Slab and wall opening coordination',
          'MEP penetration drawings',
        ],
      },
      {
        title: 'Coordination and close-out',
        items: ['MEP ceiling coordination drawings', 'Combined services drawings', 'Material submittal drawings', 'MEP as-built documentation'],
      },
    ],
    deliverables: ['IFC drawing sets', 'Shop drawings per discipline', 'Combined services and ceiling coordination', 'Builders’ work and opening drawings', 'As-built sets'],
    codes: ['AutoCAD MEP', 'Revit MEP', 'Navisworks', 'Project CAD and BIM standards'],
    img: 'svc-design',
  },
  {
    slug: 'mep-estimation-project-management',
    ref: 'QS',
    title: 'MEP Estimation and Project Management',
    short: 'BOQ, cost estimation, tendering and project execution for MEP packages.',
    highlights: ['BOQ', 'Cost estimation', 'Tendering', 'Project execution'],
    lede: 'We measure MEP packages item by item, price them against real supply and installation rates, and stay with the project through tender and execution, so the budget you approve is the one you build to.',
    groups: [
      {
        title: 'Quantity takeoff',
        items: [
          'HVAC ductwork, piping and equipment takeoff',
          'Firefighting piping and fire protection equipment takeoff',
          'Plumbing piping and fixtures takeoff',
          'Insulation takeoff',
          'Valves, accessories and fittings takeoff',
          'Supports and hangers takeoff',
          'BIM-based quantity takeoff',
          'Drawing-based material quantity extraction',
        ],
      },
      {
        title: 'BOQ preparation',
        items: [
          'HVAC, firefighting and plumbing BOQs',
          'Combined MEP BOQ preparation',
          'Item descriptions and measurement units',
          'Material specifications and schedules',
          'Equipment schedules',
          'Labour and installation quantity schedules',
          'Tender and revised BOQ preparation',
          'Variation quantity assessment',
        ],
      },
      {
        title: 'Cost estimation',
        items: [
          'Preliminary and detailed MEP cost estimation',
          'Material, labour and installation cost estimation',
          'Unit rate and supply-and-install rate analysis',
          'Project budget preparation',
          'Vendor quotation comparison',
          'Value engineering and cost optimisation',
          'Variation and change order estimation',
          'Final quantity reconciliation',
        ],
      },
      {
        title: 'Tendering and project execution',
        items: ['Tender pricing support', 'Tender document review', 'Project planning and execution support', 'Site coordination and progress tracking', 'Handover and close-out'],
      },
    ],
    deliverables: ['Quantity takeoff sheets', 'Priced and unpriced BOQs', 'Cost plans and budgets', 'Quotation comparisons', 'Variation and reconciliation reports'],
    codes: ['POMI', 'NRM', 'CESMM', 'Project measurement rules'],
    img: 'svc-estimation',
  },
];

export const trainingOffering = {
  title: 'Professional Engineering Training',
  short: 'One course covering HVAC, firefighting, plumbing, AutoCAD and Revit MEP, taught by our engineers.',
  highlights: ['HVAC', 'Firefighting', 'Plumbing', 'AutoCAD', 'Revit MEP'],
};

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);

export const projectProcess = [
  ['Brief and survey', 'We read the architecture, visit the site and agree the design basis.'],
  ['Concept and schematic', 'System options, loads and space planning, compared on cost and performance.'],
  ['Detailed design and IFC', 'Coordinated drawings, calculations and specifications, issued for construction.'],
  ['Shop drawings', 'Installation drawings, builders’ work and combined services for the site team.'],
  ['BOQ and tender', 'Quantities, priced BOQs and quotation comparisons for award.'],
  ['Execution and as-built', 'Site coordination, variations and as-built records at handover.'],
];

export const codesWeUse = ['UAE Fire & Life Safety Code', 'Saudi Building Code', 'NFPA 13 / 14 / 20', 'ASHRAE 62.1 / 90.1', 'SMACNA', 'Uniform Plumbing Code', 'BS EN 12056', 'Dubai Municipality', 'Civil Defence', 'Al Sa’fat', 'Estidama'];
