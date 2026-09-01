// Shared TypeScript types matching the database schema.

export type AccountType = 'job_seeker' | 'recruiter';

export type JobCategory =
  | 'Voice'
  | 'Non-Voice'
  | 'Semi-Voice'
  | 'BFSI/Finance Ops'
  | 'Reconciliation'
  | 'KYC/AML'
  | 'Capital Markets';

export const JOB_CATEGORIES: JobCategory[] = [
  'Voice',
  'Non-Voice',
  'Semi-Voice',
  'BFSI/Finance Ops',
  'Reconciliation',
  'KYC/AML',
  'Capital Markets',
];

// BPO categories get blue badges; Finance/BFSI categories get green badges.
export const BPO_CATEGORIES: JobCategory[] = ['Voice', 'Non-Voice', 'Semi-Voice'];
export const FINANCE_CATEGORIES: JobCategory[] = [
  'BFSI/Finance Ops',
  'Reconciliation',
  'KYC/AML',
  'Capital Markets',
];

// NCR cities for walk-in location selection.
export const NCR_CITIES = ['Noida', 'Greater Noida', 'Gurgaon', 'Delhi', 'Ghaziabad', 'Faridabad'] as const;
export type NCRCity = typeof NCR_CITIES[number];

export const EDUCATION_OPTIONS = ['10th', '12th', 'Graduate'] as const;
export type Education = typeof EDUCATION_OPTIONS[number];

export const SHIFT_OPTIONS = ['Day', 'Night', 'Rotational'] as const;
export type Shift = typeof SHIFT_OPTIONS[number];

export const LANGUAGE_OPTIONS = ['English', 'Hindi', 'both'] as const;
export type LanguageOption = typeof LANGUAGE_OPTIONS[number];

// Where a job is based. "Other City" requires a free-text city_name.
export type LocationType = 'Remote' | 'Delhi NCR' | 'Other City';
export const LOCATION_TYPES: LocationType[] = ['Remote', 'Delhi NCR', 'Other City'];

export type ListingStatus = 'draft' | 'live' | 'expired' | 'reported' | 'pending' | 'approved' | 'rejected';

// Common skill suggestions shown as checkboxes on the profile form.
export const SKILL_OPTIONS = [
  'Voice Process',
  'Email Support',
  'Chat Support',
  'Sales',
  'Customer Service',
  'Telecalling',
  'Reconciliation',
  'KYC',
  'AML',
  'Capital Markets Ops',
  'Back Office',
  'Data Entry',
];

export const DOMAIN_OPTIONS = ['BPO/Voice', 'BPO/Non-Voice', 'BFSI/Finance Ops', 'Both'];

export interface Profile {
  user_id: string;
  full_name: string;
  phone: string | null;
  experience_years: number;
  skills: string[];
  domain_experience: string[];
  current_location: string | null;
  resume_link: string | null;
  account_type: AccountType;
}

export interface Job {
  id: string;
  posted_by_user_id: string;
  company_name: string;
  role_title: string;
  category: JobCategory;
  location: string;
  location_type: LocationType;
  city_name: string | null;
  salary_range: string;
  experience_required: string;
  job_description: string;
  contact_email_or_phone: string;
  status: ListingStatus;
  created_at: string;
  city: string | null;
  area: string | null;
  salary_min: number | null;
  salary_max: number | null;
  education: Education | null;
  shift: Shift | null;
  cab: boolean;
  languages: LanguageOption | null;
  whatsapp_number: string | null;
  hr_phone: string | null;
  openings: number | null;
  is_sample: boolean;
  paid_until: string | null;
}

export interface Walkin {
  id: string;
  posted_by_user_id: string;
  company_name: string;
  role_title: string;
  category: JobCategory;
  walkin_date: string;
  walkin_time: string;
  location_address: string;
  contact_person: string | null;
  status: ListingStatus;
  created_at: string;
  city: string | null;
  area: string | null;
  salary_min: number | null;
  salary_max: number | null;
  education: Education | null;
  shift: Shift | null;
  cab: boolean;
  languages: LanguageOption | null;
  whatsapp_number: string | null;
  hr_phone: string | null;
  openings: number | null;
  description: string | null;
  is_sample: boolean;
  paid_until: string | null;
}

export interface SavedJob {
  user_id: string;
  job_id: string;
  created_at: string;
}

// Build a WhatsApp apply URL with a pre-filled message.
export function whatsappApplyUrl(number: string, role: string, company: string, location: string): string {
  const clean = number.replace(/\D/g, '');
  const text = `Hi, I saw your walk-in on NCR Walk-in for ${role} at ${company}, ${location}. I want to apply.`;
  return `https://wa.me/91${clean}?text=${encodeURIComponent(text)}`;
}

// Format salary range from min/max integers.
export function formatSalary(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Salary not disclosed';
  const fmt = (n: number) => {
    if (n >= 100000) return `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
    return `${(n / 1000).toFixed(0)}k`;
  };
  if (min != null && max != null) return `${fmt(min)} - ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

// Full INR salary string for detail pages.
export function formatSalaryFull(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Salary not disclosed';
  const fmt = (n: number) => `Rs ${n.toLocaleString('en-IN')}`;
  if (min != null && max != null) return `${fmt(min)} - ${fmt(max)}`;
  if (min != null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}
