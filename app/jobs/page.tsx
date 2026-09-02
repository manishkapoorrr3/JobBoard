'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Job, JobCategory, BPO_CATEGORIES, FINANCE_CATEGORIES, NCR_CITIES } from '@/lib/types';
import { JobCard } from '@/components/job-card';
import { SaveButton } from '@/components/save-button';
import { ReportButton } from '@/components/report-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox } from 'lucide-react';

function JobsPageInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const activeCategory = (searchParams.get('category') as JobCategory | 'all') || 'all';
  const activeCity = searchParams.get('city') || 'all';
  const canSave = !!user && profile?.account_type === 'job_seeker';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .in('status', ['live', 'approved'])
        .order('created_at', { ascending: false });
      setJobs((data as Job[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (activeCategory !== 'all' && j.category !== activeCategory) return false;
      if (activeCity !== 'all') {
        if (activeCity === 'Remote' && j.location_type !== 'Remote') return false;
        if (activeCity !== 'Remote' && j.city !== activeCity) return false;
      }
      return true;
    });
  }, [jobs, activeCategory, activeCity]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete(key);
    else params.set(key, value);
    router.push(`/jobs?${params.toString()}`);
  }

  function chip(label: string, key: string, value: string) {
    const current = searchParams.get(key) || 'all';
    const active = current === value || (value === 'all' && !searchParams.get(key));
    return (
      <button
        key={`${key}-${value}`}
        type="button"
        onClick={() => updateFilter(key, value)}
        className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
          active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        {label}
      </button>
    );
  }

  const tabs: { group: string; items: { label: string; value: JobCategory | 'all' }[] }[] = [
    { group: 'All', items: [{ label: 'All', value: 'all' }] },
    { group: 'BPO Roles', items: BPO_CATEGORIES.map((c) => ({ label: c, value: c })) },
    { group: 'More (Finance / BFSI)', items: FINANCE_CATEGORIES.map((c) => ({ label: c, value: c })) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
        <span className="text-sm text-slate-500">{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Location</p>
          <div className="flex flex-wrap gap-2">
            {chip('All', 'city', 'all')}
            {chip('Remote', 'city', 'Remote')}
            {NCR_CITIES.map((c) => chip(c, 'city', c))}
          </div>
        </div>

        {tabs.map((section) => (
          <div key={section.group} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section.group}</p>
            <div className="flex flex-wrap gap-2">
              {section.items.map((t) => chip(t.label, 'category', t.value))}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No jobs match this filter. Try All or a different city.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((job) => (
            <div key={job.id} className="relative">
              <JobCard job={job} />
              <div className="absolute right-3 top-3 flex items-center gap-1">
                {canSave && <SaveButton jobId={job.id} />}
                {user && <ReportButton jobId={job.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Loading…</div>}>
      <JobsPageInner />
    </Suspense>
  );
}
