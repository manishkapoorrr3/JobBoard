'use client';
// Public jobs listing — shows ONLY approved jobs, newest first.
// Filter tabs grouped into BPO Roles / Finance-BFSI Roles, plus All.
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Job, JobCategory, BPO_CATEGORIES, FINANCE_CATEGORIES, LocationType } from '@/lib/types';
import { CategoryBadge, FilterTab } from '@/lib/categories';
import { SaveButton } from '@/components/save-button';
import { ReportButton } from '@/components/report-button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Banknote, Briefcase, Inbox, Globe } from 'lucide-react';
import { formatRelative } from '@/lib/format';

function JobsPageInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  // Read the category + location filters from the URL.
  const activeCategory = (searchParams.get('category') as JobCategory | 'all') || 'all';
  const activeLocation = (searchParams.get('location') as LocationType | 'Other Cities' | 'all') || 'all';
  const canSave = !!user && profile?.account_type === 'job_seeker';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch approved jobs once.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) {
        setLoading(false);
        return;
      }
      setJobs((data as Job[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  // Apply both category and location filters on the client.
  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      const catOk = activeCategory === 'all' || j.category === activeCategory;
      const locOk =
        activeLocation === 'all' ||
        (activeLocation === 'Other Cities' && j.location_type === 'Other City') ||
        j.location_type === activeLocation;
      return catOk && locOk;
    });
  }, [jobs, activeCategory, activeLocation]);

  function setFilter(category: JobCategory | 'all', location: LocationType | 'Other Cities' | 'all') {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (location !== 'all') params.set('location', location);
    const qs = params.toString();
    router.push(`/jobs${qs ? `?${qs}` : ''}`);
  }
  function setCategory(c: JobCategory | 'all') { setFilter(c, activeLocation as LocationType | 'Other Cities' | 'all'); }
  function setLocation(l: LocationType | 'Other Cities' | 'all') { setFilter(activeCategory, l); }

  // Location filter tabs.
  const locationTabs: { label: string; value: LocationType | 'Other Cities' | 'all' }[] = [
    { label: 'All Locations', value: 'all' },
    { label: 'Remote', value: 'Remote' },
    { label: 'Delhi NCR', value: 'Delhi NCR' },
    { label: 'Other Cities', value: 'Other Cities' },
  ];

  // Filter tabs: All, then BPO group, then Finance group.
  const tabs: { group: string; items: { label: string; value: JobCategory | 'all' }[] }[] = [
    { group: 'All', items: [{ label: 'All', value: 'all' }] },
    {
      group: 'BPO Roles',
      items: BPO_CATEGORIES.map((c) => ({ label: c, value: c })),
    },
    {
      group: 'Finance / BFSI Roles',
      items: FINANCE_CATEGORIES.map((c) => ({ label: c, value: c })),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
        <span className="text-sm text-slate-500">{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Scope note */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        <Globe className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Job listings from anywhere in India (remote or on-site) — walk-in interviews are Delhi NCR only, see the Walk-ins page.</p>
      </div>

      {/* Filter tabs */}
      <div className="space-y-3">
        {/* Location filter */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Location</p>
          <div className="flex flex-wrap gap-2">
            {locationTabs.map((t) => (
              <FilterTab
                key={t.value}
                label={t.label}
                active={activeLocation === t.value}
                onClick={() => setLocation(t.value)}
              />
            ))}
          </div>
        </div>

        {tabs.map((section) => (
          <div key={section.group} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section.group}</p>
            <div className="flex flex-wrap gap-2">
              {section.items.map((t) => (
                <FilterTab
                  key={t.value}
                  label={t.label}
                  active={activeCategory === t.value}
                  onClick={() => setCategory(t.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Job cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No jobs in this category yet. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((job) => (
            <div
              key={job.id}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900 group-hover:text-blue-700">
                    {job.role_title}
                  </h3>
                  <p className="truncate text-sm text-slate-600">{job.company_name}</p>
                </Link>
                <div className="flex items-center gap-1">
                  {canSave && <SaveButton jobId={job.id} />}
                  {user && <ReportButton jobId={job.id} />}
                </div>
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

// useSearchParams must be wrapped in a Suspense boundary for the build.
export default function JobsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Loading…</div>}>
      <JobsPageInner />
    </Suspense>
  );
}
