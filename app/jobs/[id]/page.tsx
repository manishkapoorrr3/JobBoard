'use client';
// Job detail page — full info for one approved job.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Job } from '@/lib/types';
import { CategoryBadge } from '@/lib/categories';
import { SaveButton } from '@/components/save-button';
import { ReportButton } from '@/components/report-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Banknote, Briefcase, Phone, Mail, Inbox } from 'lucide-react';
import { formatRelative } from '@/lib/format';

// Build a readable location string from location_type + city_name + area.
function locationLabel(job: Job): string {
  const area = job.location;
  if (job.location_type === 'Remote') return `Remote (${area})`;
  if (job.location_type === 'Other City') return `${job.city_name || 'Other City'} — ${area}`;
  return `Delhi NCR — ${area}`;
}

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
      // Only show approved jobs to the public. (Recruiters viewing their own
      // pending post isn't required for Phase 0.)
      if (data && data.status === 'approved') setJob(data as Job);
      setLoading(false);
    })();
  }, [supabase, id]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-2 text-slate-600">This job is no longer available.</p>
        <Link href="/jobs" className="mt-4"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to jobs</Button></Link>
      </div>
    );
  }

  const canSave = !!user && profile?.account_type === 'job_seeker';
  const isEmail = /@/.test(job.contact_email_or_phone);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/jobs" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="mr-1 h-4 w-4" />All jobs
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.role_title}</h1>
            <p className="text-slate-600">{job.company_name}</p>
          </div>
          <div className="flex items-center gap-1">
            {canSave && <SaveButton jobId={job.id} />}
            {user && <ReportButton jobId={job.id} />}
          </div>
        </div>

        <div className="mt-3"><CategoryBadge category={job.category} /></div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={locationLabel(job)} />
          <InfoRow icon={<Banknote className="h-4 w-4" />} label="Salary" value={job.salary_range} />
          <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Experience" value={job.experience_required} />
          <InfoRow
            icon={isEmail ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            label="Contact"
            value={job.contact_email_or_phone}
          />
        </div>

        <p className="mt-2 text-xs text-slate-400">Posted {formatRelative(job.created_at)}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Job description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{job.job_description}</p>
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
