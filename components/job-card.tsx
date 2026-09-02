'use client';
import Link from 'next/link';
import { Job, whatsappApplyUrl, formatSalary } from '@/lib/types';
import { MapPin, Briefcase, MessageCircle, Phone } from 'lucide-react';
import { formatRelative } from '@/lib/format';

export function JobCard({ job }: { job: Job }) {
  const locationStr = job.location_type === 'Remote'
    ? 'Remote'
    : [job.city, job.area].filter(Boolean).join(', ') || job.location;

  const waUrl = job.whatsapp_number
    ? whatsappApplyUrl(job.whatsapp_number, job.role_title, job.company_name, job.city || 'NCR')
    : null;

  const chips: string[] = [];
  if (job.category) chips.push(job.category);
  if (job.shift) chips.push(job.shift);
  if (job.cab) chips.push('Cab');
  if (job.education) chips.push(job.education);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900">{job.role_title}</h3>
          <p className="truncate text-sm text-slate-600">{job.company_name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-blue-700">
            {job.salary_min || job.salary_max ? formatSalary(job.salary_min, job.salary_max) : job.salary_range}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {locationStr}
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
          {job.experience_required}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-400">Posted {formatRelative(job.created_at)}</p>
        {waUrl && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </span>
        )}
      </div>
    </Link>
  );
}
