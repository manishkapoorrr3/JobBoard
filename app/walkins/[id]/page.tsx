'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Walkin, whatsappApplyUrl, formatSalaryFull } from '@/lib/types';
import { ReportButton } from '@/components/report-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Clock, MessageCircle, Phone, Users, GraduationCap, Moon, Car, Languages, Inbox, Share2 } from 'lucide-react';
import { formatWalkinDate, formatDate } from '@/lib/format';

export default function WalkinDetailPage() {
  const supabase = getSupabase();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [walkin, setWalkin] = useState<Walkin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('walkins')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (data && (data.status === 'live' || data.status === 'approved' || data.status === 'expired')) {
        setWalkin(data as Walkin);
      }
      setLoading(false);
    })();
  }, [supabase, id]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!walkin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-2 text-slate-600">This walk-in is no longer available.</p>
        <Link href="/walkins" className="mt-4">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to walk-ins</Button>
        </Link>
      </div>
    );
  }

  const locationStr = [walkin.city, walkin.area].filter(Boolean).join(', ') || walkin.location_address;
  const fullAddress = walkin.location_address || [walkin.area, walkin.city].filter(Boolean).join(', ');
  const waUrl = walkin.whatsapp_number
    ? whatsappApplyUrl(walkin.whatsapp_number, walkin.role_title, walkin.company_name, walkin.city || 'NCR')
    : null;
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;
  const dateLabel = formatWalkinDate(walkin.walkin_date);
  const isExpired = walkin.status === 'expired';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/walkins" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="mr-1 h-4 w-4" />All walk-ins
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{walkin.role_title}</h1>
            <p className="text-slate-600">{walkin.company_name}</p>
          </div>
          {user && <ReportButton walkinId={walkin.id} />}
        </div>

        <div className="mt-4 rounded-lg bg-emerald-50 p-3">
          <p className="text-2xl font-bold text-emerald-700">{formatSalaryFull(walkin.salary_min, walkin.salary_max)}</p>
          <p className="text-xs text-emerald-600">per month + incentives</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<Clock className="h-4 w-4" />} label="When" value={`${dateLabel}, ${walkin.walkin_time}`} sub={formatDate(walkin.walkin_date)} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Where" value={locationStr} sub={walkin.location_address} />
          {walkin.shift && <InfoRow icon={<Moon className="h-4 w-4" />} label="Shift" value={walkin.shift} />}
          {walkin.education && <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Education" value={walkin.education} />}
          {walkin.cab && <InfoRow icon={<Car className="h-4 w-4" />} label="Cab" value="Pickup & drop provided" />}
          {walkin.languages && <InfoRow icon={<Languages className="h-4 w-4" />} label="Languages" value={walkin.languages === 'both' ? 'English & Hindi' : walkin.languages} />}
          {walkin.openings != null && <InfoRow icon={<Users className="h-4 w-4" />} label="Openings" value={`${walkin.openings}`} />}
        </div>

        {/* Chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[walkin.category, walkin.shift, walkin.cab && 'Cab', walkin.education].filter(Boolean).map((c) => (
            <span key={c as string} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {c as string}
            </span>
          ))}
        </div>
      </div>

      {walkin.description && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Details</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{walkin.description}</p>
        </div>
      )}

      {/* What to bring */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">What to bring</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>Updated CV / resume</li>
          <li>Aadhaar card (original + photocopy)</li>
          <li>2 passport-size photos</li>
          {walkin.education && <li>{walkin.education} certificate / marksheet</li>}
        </ul>
      </div>

      {/* Map link */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
        >
          <MapPin className="h-4 w-4" />
          Open in Google Maps
        </a>
        <p className="mt-1 text-sm text-slate-600">{fullAddress}</p>
      </div>

      {isExpired && (
        <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-800">
          This walk-in has expired. Check current listings on the walk-ins page.
        </div>
      )}

      {/* Sticky WhatsApp apply bar — mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 md:hidden">
        <div className="flex gap-2">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-5 w-5" />
              Apply on WhatsApp
            </a>
          )}
          {walkin.hr_phone && (
            <a
              href={`tel:${walkin.hr_phone}`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-3 text-slate-700"
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>

      {/* Desktop apply buttons */}
      <div className="hidden gap-3 md:flex">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="h-5 w-5" />
            Apply on WhatsApp
          </a>
        )}
        {walkin.hr_phone && (
          <a
            href={`tel:${walkin.hr_phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Phone className="h-5 w-5" />
            Call HR
          </a>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Walk-in: ${walkin.role_title} at ${walkin.company_name}, ${locationStr}. Apply via NCR Walk-in.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-slate-600 hover:bg-slate-50"
        >
          <Share2 className="h-5 w-5" />
        </a>
      </div>

      {/* Spacer for sticky bar on mobile */}
      <div className="h-16 md:hidden" />
    </div>
  );
}

function InfoRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="break-words text-sm text-slate-800">{value}</p>
        {sub && <p className="mt-0.5 break-words text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
