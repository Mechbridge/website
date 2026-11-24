// What each enquiry topic collects, on top of name, email, mobile, country and message (always required).
// Shared by the form (EnquiryForm.astro), the API (src/server/api.ts), the demo store, the staff portal and the alert email.
import type { LeadType } from './api/types';

export interface DetailField { key: string; label: string; placeholder?: string; options?: string[] }

// Extra details, all optional. Stored in leads.details as { key: value }; posted as d_<key>.
export const DETAIL_FIELDS: Record<LeadType, DetailField[]> = {
  consultancy: [
    { key: 'company', label: 'Company', placeholder: 'Your company or organisation' },
    { key: 'location', label: 'Project location', placeholder: 'City and country' },
  ],
  training: [{ key: 'background', label: 'Current role or studies', placeholder: 'e.g. Mechanical engineer, 2 years' }],
  internship: [
    { key: 'college', label: 'College or university' },
    { key: 'degree', label: 'Degree and year', placeholder: 'e.g. B.Tech Mechanical, final year' },
  ],
  job: [
    { key: 'role', label: 'Current role', placeholder: 'e.g. HVAC design engineer' },
    { key: 'experience', label: 'Years of experience', options: ['Less than 1', '1 to 3', '3 to 5', '5 to 10', 'More than 10'] },
  ],
  support: [{ key: 'project', label: 'Project name or reference' }],
  contact: [],
};

// Documents per topic: the CV and the internship's degree certificate or college ID.
export const DOCUMENTS: Record<LeadType, { cv?: 'required' | 'optional'; idDoc?: boolean }> = {
  consultancy: {}, training: {}, support: {}, contact: {},
  job: { cv: 'required' },
  internship: { cv: 'optional', idDoc: true },
};

export const detailLabel = (type: LeadType, key: string) => DETAIL_FIELDS[type]?.find((f) => f.key === key)?.label ?? key;

// Picks the allowed details for a topic out of form data, trimmed and capped.
export function readDetails(type: LeadType, get: (name: string) => unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of DETAIL_FIELDS[type] ?? []) {
    let v = String(get(`d_${f.key}`) ?? '').trim().slice(0, 160);
    if (f.options && v && !f.options.includes(v)) v = '';
    if (v) out[f.key] = v;
  }
  return out;
}
