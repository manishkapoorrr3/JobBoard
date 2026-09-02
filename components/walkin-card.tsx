'use client';
import Link from 'next/link';
import { Walkin, whatsappApplyUrl, formatSalary } from '@/lib/types';
import { formatWalkinDate } from '@/lib/format';
import { MapPin, Clock, MessageCircle, Phone, Users } from 'lucide-react';

export function WalkinCard({ walkin }: { walkin: Walkin }) {
  const dateLabel = formatWalkinDate(walkin.walkin_date);
  const locationStr = [walkin.city, walkin.area].filter(Boolean).join(', ') || walkin.location_address;
  const waUrl = walkin.whatsapp_number
    ? whatsappApplyUrl(walkin.whatsapp_number, walkin.role_title, walkin.company_name, walkin.city || 'NCR')
    : null;

  const chips: string[] = [];
  if (walkin.category) chips.push(walkin.category);
  if (walkin.shift) chips.push(walkin.shift);
  if (walkin.cab) chips.push('Cab');
  if (walkin.education) chips.push(walkin.education);

  return (
    <Link
      href={`/walkins/${walkin.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900">{walkin.role_title}</h3>
          <p className="truncate text-sm text-slate-600">{walkin.company_name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-emerald-700">{formatSalary(walkin.salary_min, walkin.salary_max)}</p>
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
        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
          <Clock className="h-3.5 w-3.5 text-emerald-600" />
          {dateLabel} {walkin.walkin_time}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {locationStr}
        </span>
        {walkin.openings != null && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            {walkin.openings} openings
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Apply
          </a>
        )}
        {walkin.hr_phone && (
          <a
            href={`tel:${walkin.hr_phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        )}
      </div>
    </Link>
  );
}
