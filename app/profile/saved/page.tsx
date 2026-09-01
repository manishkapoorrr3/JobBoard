'use client';
// Saved jobs page — shows all jobs the logged-in job seeker has bookmarked.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { RequireAuth } from '@/lib/auth-guards';
import { Job } from '@/lib/types';
import { CategoryBadge } from '@/lib/categories';
import { SaveButton } from '@/components/save-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MapPin, Banknote, Briefcase, Bookmark, Inbox } from 'lucide-react';
import { formatRelative } from '@/lib/format';

function SavedJobsInner() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Join saved_jobs -> jobs and only keep live or approved ones (a job may
      // have been un-approved, paused, or deleted after the user saved it).
      const { data, error } = await supabase
        .from('saved_jobs')
        .select('job_id, jobs(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        setLoading(false);
        return;
      }
      const approved = (data ?? [])
        .map((row) => row.jobs as unknown as Job)
        .filter((j): j is Job => !!j && (j.status === 'live' || j.status === 'approved'));
      setJobs(approved);
      setLoading(false);
    })();
  }, [supabase, user]);

  if (loading) {
    return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Saved jobs</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">You haven&apos;t saved any jobs yet.</p>
          <Link href="/jobs" className="mt-4"><Button variant="outline">Browse jobs</Button></Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => (
            <div key={job.id} className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900 group-hover:text-blue-700">{job.role_title}</h3>
                  <p className="truncate text-sm text-slate-600">{job.company_name}</p>
                </Link>
                <SaveButton jobId={job.id} />
              </div>

              <Link href={`/jobs/${job.id}`} className="mt-3 block space-y-2">
                <CategoryBadge category={job.category} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{job.location_type === 'Other City' ? job.city_name || 'Other City' : job.location_type}</span>
                  <span className="inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5 text-slate-400" />{job.salary_range}</span>
                  <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-slate-400" />{job.experience_required}</span>
                </div>
                <p className="text-xs text-slate-400">Posted {formatRelative(job.created_at)}</p>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SavedJobsPage() {
  return (
    <RequireAuth>
      <SavedJobsInner />
    </RequireAuth>
  );
}
