import { services } from './services';

export const site = {
  name: 'Mechbridge International',
  company: 'Mechbridge International MEP Consultants',
  domain: 'mechbridgegroup.com',
  url: 'https://mechbridgegroup.com',
  connect: 'connect@mechbridgegroup.com',
  support: 'support@mechbridgegroup.com',
  careers: 'careers@mechbridgegroup.com',
  intern: 'intern@mechbridgegroup.com',
  years: '15+',
};

// Headquarters in Dubai; teams operate from Dubai and India. Street addresses are not confirmed (CONTENT-TODO.md).
export const offices = [
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', role: 'Headquarters', note: 'Head office: consultancy, design management and client delivery', img: 'office-dubai' },
  { id: 'india', city: 'India', country: 'India', role: 'Operations', note: 'Design production, shop drawings, BIM and estimation', img: 'office-india' },
];

// Countries we serve and hire in: the six GCC states and India.
export const gcc = ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];
export const serves = [...gcc, 'India'];
export const servesShort = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'India'];

export interface NavItem { href: string; label: string; children?: { href: string; label: string; note?: string }[] }
export const nav: NavItem[] = [
  {
    href: '/services',
    label: 'Services',
    children: [
      ...services.map((s) => ({ href: `/services/${s.slug}`, label: s.title, note: s.highlights.join(' · ') })),
      { href: '/training', label: 'Professional Engineering Training', note: 'HVAC · Firefighting · Plumbing · AutoCAD · Revit MEP' },
    ],
  },
  { href: '/training', label: 'Training' },
  { href: '/internships', label: 'Internships' },
  { href: '/careers', label: 'Careers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];
