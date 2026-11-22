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

// Headquarters in Dubai; teams operate from Dubai and Kozhikode (India). Addresses confirmed November 2026.
export interface Office {
  id: string; city: string; label: string; country: string; role: string; note: string; img: string;
  address: string[]; // lines as printed
  street: string; region?: string; postalCode?: string; // for structured data
}
export const offices: Office[] = [
  {
    id: 'dubai', city: 'Dubai', label: 'Dubai, UAE', country: 'United Arab Emirates', role: 'Headquarters',
    note: 'Head office: consultancy, design management and client delivery', img: 'office-dubai',
    address: ['Unbox, World Trade Center', 'Dubai, United Arab Emirates'], street: 'Unbox, World Trade Center',
  },
  {
    id: 'india', city: 'Kozhikode', label: 'Kozhikode, India', country: 'India', role: 'Operations',
    note: 'Design production, shop drawings, BIM and estimation', img: 'office-india',
    address: ['C.M Mathew Brothers Arcade, Edapally Panvel Highway', 'Vikas Nagar Housing Colony, West Nadakkave, Bilathikkulam', 'Kozhikode, Kerala 673006, India'],
    street: 'C.M Mathew Brothers Arcade, Edapally Panvel Highway, Vikas Nagar Housing Colony, West Nadakkave, Bilathikkulam', region: 'Kerala', postalCode: '673006',
  },
];

// Countries we serve and hire in: the six GCC states and India. Marketing lists add "Worldwide" last,
// so the GCC reads first without saying it is the only market.
export const gcc = ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'];
export const serves = [...gcc, 'India'];
export const servesShort = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'India'];
export const servesWorld = [...servesShort, 'Worldwide'];
export const track = { projects: '7,000+', countries: '10+' }; // confirmed by Mechbridge, November 2026

export interface NavItem { href: string; label: string; children?: { href: string; label: string; note?: string }[] }
export const nav: NavItem[] = [
  {
    href: '/services',
    label: 'Services',
    children: [
      ...services.map((s) => ({ href: `/services/${s.slug}`, label: s.title, note: s.highlights.join(' · ') })),
      { href: '/training', label: 'Professional Engineering Training', note: 'HVAC · Firefighting · Plumbing' },
    ],
  },
  { href: '/training', label: 'Training' },
  { href: '/internships', label: 'Internships' },
  { href: '/careers', label: 'Careers' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];
