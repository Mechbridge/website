// Recent highlights: a few client projects, not a full client list.
// Photos are in public/images/projects/<id>.webp (1200px) and <id>-640.webp. `pos` is the object-position
// used when a photo is cropped to the 4:5 frame.
import { site, track as reach } from './site';

export interface ProjectPhoto { id: string; w: number; h: number; alt: string; pos?: string }
export interface Project { slug: string; name: string; type: string; note?: string; photos: ProjectPhoto[] }

export const projects: Project[] = [
  {
    slug: 'jasleena-residence',
    name: 'Jasleena’s Residence',
    type: 'Private residence',
    photos: [
      { id: 'jasleena-1', w: 900, h: 1200, alt: 'Double-height living room with a curved glass balcony, a timber staircase and two crystal chandeliers' },
      { id: 'jasleena-2', w: 900, h: 1200, alt: 'Sitting room under a double-height ceiling with a crystal chandelier, cream sofas and carved armchairs' },
      { id: 'jasleena-3', w: 1170, h: 780, alt: 'Hallway with a timber ceiling feature, a marble floor and a linear air-conditioning grille', pos: '42% 50%' },
    ],
  },
  {
    slug: 'mohammed-residence',
    name: 'Mohammed’s Residence',
    type: 'Private residence',
    photos: [
      { id: 'mohammed-1', w: 960, h: 640, alt: 'Bedroom with a cream bedspread, patterned grey curtains and a ceiling air-conditioning grille', pos: '62% 50%' },
      { id: 'mohammed-2', w: 960, h: 596, alt: 'Balcony with two wicker chairs beside the sliding door to the bedroom', pos: '72% 50%' },
    ],
  },
  {
    slug: 'zangos',
    name: 'Zangos',
    type: 'Restaurant',
    note: '3D visual',
    photos: [
      { id: 'zangos-1', w: 703, h: 1200, alt: 'Zangos restaurant shopfront with its red rooster sign and dining area, shown in a 3D visual', pos: '50% 28%' },
    ],
  },
];

// Figures confirmed by Mechbridge (November 2026), shared with site.ts.
export const track = { ...reach, years: site.years };
