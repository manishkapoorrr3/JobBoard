'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Job, whatsappApplyUrl, formatSalaryFull } from '@/lib/types';
import { SaveButton } from '@/components/save-button';
import { ReportButton } from '@/components/report-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Briefcase, MessageCircle, Phone, GraduationCap, Moon, Car, Languages, Users, Inbox } from 'lucide-react';
import { formatRelative } from '@/lib/format';

export default function JobDetailPage() {
  const supabase = getSupabase();
  const params = useParams();
  const id = params.id as string;
  const { user, profile } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (data && (data.status === 'live' || data.status === 'approved')) setJob(data as Job);
      setLoading(false);
    })();
  }, [supabase, id]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-2 text-slate-600">This job is no longer available.</p>
        <Link href="/jobs" className="mt-4">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to jobs</Button>
        </Link>
      </div>
    );
  }

  const canSave = !!user && profile?.account_type === 'job_seeker';
  const locationStr = job.location_type === 'Remote'
    ? 'Remote'
    : [job.city, job.area].filter(Boolean).join(', ') || job.location;
  const waUrl = job.whatsapp_number
    ? whatsappApplyUrl(job.whatsapp_number, job.role_title, job.company_name, job.city || 'NCR')
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/jobs" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="mr-1 h-4 w-4" />All jobs
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.role_title}</h1>
            <p className="text-slate-600">{job.company_name}</p>
          </div>
          <div className="flex items-center gap-1">
            {canSave && <SaveButton jobId={job.id} />}
            {user && <ReportButton jobId={job.id} />}
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-blue-50 p-3">
          <p className="text-2xl font-bold text-blue-700">
            {job.salary_min || job.salary_max ? formatSalaryFull(job.salary_min, job.salary_max) : job.salary_range}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={locationStr} />
          <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Experience" value={job.experience_required} />
          {job.shift && <InfoRow icon={<Moon className="h-4 w-4" />} label="Shift" value={job.shift} />}
          {job.education && <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Education" value={job.education} />}
          {job.cab && <InfoRow icon={<Car className="h-4 w-4" />} label="Cab" value="Pickup & drop provided" />}
          {job.languages && <InfoRow icon={<Languages className="h-4 w-4" />} label="Languages" value={job.languages === 'both' ? 'English & Hindi' : job.languages} />}
          {job.openings != null && <InfoRow icon={<Users className="h-4 w-4" />} label="Openings" value={`${job.openings}`} />}
        </div>

        <p className="mt-2 text-xs text-slate-400">Posted {formatRelative(job.created_at)}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Job description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{job.job_description}</p>
      </div>

      {/* Apply buttons */}
      <div className="flex gap-3">
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
        {job.hr_phone && (
          <a
            href={`tel:${job.hr_phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Phone className="h-5 w-5" />
            Call HR
          </a>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="break-words text-sm text-slate-800">{value}</p>
      </div>
    </div>
  );
}
