// Recent highlights: a few client projects, not a full client list. Names, scope, locations and briefs
// supplied by Mechbridge (2026-11-24). Photos are in public/images/projects/<id>.webp (up to 1400px)
// and <id>-640.webp. `pos` is the object-position used when a photo is cropped to the 4:5 frame.
import { site, track as reach } from './site';

export interface ProjectPhoto { id: string; w: number; h: number; alt: string; pos?: string }
export interface Project {
  slug: string;
  name: string;
  scope: string; // what Mechbridge did
  location: string;
  summary: string;
  note?: string; // shown after the location, e.g. "3D visual"
  photos: ProjectPhoto[];
}

export const projects: Project[] = [
  {
    slug: 'murthaz-residence',
    name: 'Murthaz Residence',
    scope: 'HVAC design',
    location: 'Thalassery, Kerala, India',
    summary: 'HVAC layouts, ducting arrangements, ventilation systems, related engineering requirements',
    photos: [
      { id: 'murthaz-1', w: 1376, h: 768, alt: 'Bedroom with a cream bedspread, patterned grey curtains and a ceiling air-conditioning grille', pos: '62% 50%' },
      { id: 'murthaz-2', w: 1376, h: 768, alt: 'Balcony with two wicker chairs beside the sliding door to the bedroom', pos: '72% 50%' },
    ],
  },
  {
    slug: 'jasleena-residence',
    name: 'Jasleena’s Residence',
    scope: 'HVAC design and execution',
    location: 'Aluva, Kerala, India',
    summary: 'Technical drawings, system coordination, site implementation',
    photos: [
      { id: 'jasleena-1', w: 896, h: 1200, alt: 'Double-height living room with a curved glass balcony, a timber staircase and two crystal chandeliers' },
      { id: 'jasleena-2', w: 896, h: 1200, alt: 'Sitting room under a double-height ceiling with a crystal chandelier, cream sofas and carved armchairs' },
      { id: 'jasleena-3', w: 1376, h: 768, alt: 'Hallway with a timber ceiling feature, a marble floor and a linear air-conditioning grille', pos: '42% 50%' },
    ],
  },
  {
    slug: 'zangos',
    name: 'Zangos',
    scope: 'HVAC load calculations',
    location: 'Al Khobar, Saudi Arabia',
    summary: 'Cooling load calculations, room-wise heat load assessments, equipment capacity estimations',
    note: '3D visual',
    photos: [
      { id: 'zangos-1', w: 768, h: 1376, alt: 'Zangos restaurant shopfront with its red rooster sign and dining area, shown in a 3D visual', pos: '50% 28%' },
    ],
  },
];

// Figures confirmed by Mechbridge (November 2026), shared with site.ts.
export const track = { ...reach, years: site.years };
