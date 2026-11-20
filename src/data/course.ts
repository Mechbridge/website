// The single professional training course and the internship package.
// Durations, fees and dates are not confirmed: batches and intakes come from the admin portal.

export const course = {
  title: 'Professional MEP Engineering Training',
  code: 'MBI-PET',
  lede:
    'One course that covers the work our consultancy does every day: HVAC, firefighting and plumbing design, drafted in AutoCAD and modelled in Revit MEP. Taught by the engineers who design those systems on live projects across the GCC.',
  modules: [
    {
      code: 'M',
      title: 'HVAC',
      items: ['Heat load calculations for GCC climates', 'Equipment selection: chilled water, VRF/VRV, DX', 'Duct sizing and layout', 'Ventilation, exhaust and smoke management', 'Pressurisation systems'],
    },
    {
      code: 'FP',
      title: 'Firefighting',
      items: ['Hazard classification and system selection', 'Sprinkler, hose reel and hydrant design', 'Fire pump room and water tank sizing', 'Hydraulic calculations', 'Clean agent and kitchen hood suppression'],
    },
    {
      code: 'P',
      title: 'Plumbing',
      items: ['Water supply and fixture unit calculations', 'Hot water circulation', 'Drainage, sewerage and storm design', 'Tank and booster pump sizing', 'Riser and schematic diagrams'],
    },
    {
      code: 'CAD',
      title: 'AutoCAD',
      items: ['MEP drafting standards and layers', 'Layouts, sections and details', 'Shop drawings and builders’ work', 'Sheet setup and issue', 'PDF-to-CAD conversion'],
    },
    {
      code: 'BIM',
      title: 'Revit MEP',
      items: ['Templates, families and worksharing', 'Modelling ducts, pipes and equipment', 'Clash detection and coordination', 'Sheets and schedules from the model', 'BIM-based quantity takeoff'],
    },
  ],
};

export const compare = [
  ['Who teaches', 'Lecturers and full-time trainers', 'Practising engineers from our consultancy'],
  ['What you work on', 'Textbook examples', 'Project-style drawing sets from GCC building types'],
  ['Codes', 'Covered in general', 'UAE Fire Code, SBC and NFPA as authorities apply them'],
  ['Feedback', 'A marked exam', 'Design reviews with a senior engineer'],
  ['What you leave with', 'A certificate', 'A verifiable certificate and a portfolio of drawings'],
];

export const steps = [
  ['Enquire', 'Tell us your background. We reply with the next batch dates and the fee.'],
  ['Skills check', 'A short technical conversation so you start at the right level.'],
  ['Join a batch', 'Live, instructor-led sessions with our engineers, scheduled around a working week.'],
  ['Work the modules', 'Each module is a package of drawings and calculations, reviewed as you go.'],
  ['Final design review', 'Present your project set to a senior engineer.'],
  ['Certificate', 'You receive a certificate with a code anyone can verify on this site.'],
];

export const internship = {
  title: 'GCC-Ready Internship Package',
  lede:
    'For engineering students and fresh graduates who want to work in the GCC. The package combines the full training course with supervised work on project-style deliverables, so you arrive at your first interview with the skills and the portfolio GCC employers ask for.',
  includes: [
    ['The full training course', 'HVAC, firefighting, plumbing, AutoCAD and Revit MEP.'],
    ['Supervised project work', 'Shop drawings, coordination drawings and BOQs prepared the way our consultancy prepares them.'],
    ['GCC codes in practice', 'How authorities in the UAE, Saudi Arabia and the wider GCC read and approve MEP drawings.'],
    ['Portfolio review', 'A finished set of drawings and calculations you can show employers.'],
    ['CV and interview preparation', 'Technical interview practice for MEP design roles in the GCC.'],
    ['Verifiable certificate', 'An internship certificate with a code employers can check on this site.'],
  ],
  forWho: ['Final-year mechanical, civil and electrical engineering students', 'Fresh graduates preparing for GCC roles', 'Diploma holders moving into MEP design'],
};
