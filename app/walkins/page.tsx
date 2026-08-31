'use client';
// Public walk-in listing — shows ONLY approved walk-ins, nearest upcoming first.
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Walkin, JobCategory, BPO_CATEGORIES, FINANCE_CATEGORIES } from '@/lib/types';
import { CategoryBadge, FilterTab } from '@/lib/categories';
import { ReportButton } from '@/components/report-button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, Clock, User, Inbox } from 'lucide-react';
import { formatDate } from '@/lib/format';

function WalkinsPageInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const activeCategory = (searchParams.get('category') as JobCategory | 'all') || 'all';

  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      // Fetch approved walk-ins on or after today, sorted by date ascending.
      const { data, error } = await supabase
        .from('walkins')
        .select('*')
        .eq('status', 'approved')
        .gte('walkin_date', today)
        .order('walkin_date', { ascending: true });
      if (error) {
        setLoading(false);
        return;
      }
      setWalkins((data as Walkin[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return walkins;
    return walkins.filter((w) => w.category === activeCategory);
  }, [walkins, activeCategory]);

  function setCategory(c: JobCategory | 'all') {
    const qs = c === 'all' ? '' : `?category=${encodeURIComponent(c)}`;
    router.push(`/walkins${qs}`);
  }

  const tabs: { group: string; items: { label: string; value: JobCategory | 'all' }[] }[] = [
    { group: 'All', items: [{ label: 'All', value: 'all' }] },
    { group: 'BPO Roles', items: BPO_CATEGORIES.map((c) => ({ label: c, value: c })) },
    { group: 'Finance / BFSI Roles', items: FINANCE_CATEGORIES.map((c) => ({ label: c, value: c })) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Walk-in Interviews</h1>
        <span className="text-sm text-slate-500">{filtered.length} upcoming</span>
      </div>

      <div className="space-y-3">
        {tabs.map((section) => (
          <div key={section.group} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section.group}</p>
            <div className="flex flex-wrap gap-2">
              {section.items.map((t) => (
                <FilterTab key={t.value} label={t.label} active={activeCategory === t.value} onClick={() => setCategory(t.value)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No upcoming walk-ins in this category.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((w) => (
            <div key={w.id} className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900">{w.role_title}</h3>
                  <p className="truncate text-sm text-slate-600">{w.company_name}</p>
                </div>
                {user && <ReportButton walkinId={w.id} />}
              </div>

              <div className="mt-3 space-y-2">
                <CategoryBadge category={w.category} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />{formatDate(w.walkin_date)}
                  </span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" />{w.walkin_time}</span>
                </div>
                <p className="inline-flex items-start gap-1 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{w.location_address}</span>
                </p>
                {w.contact_person && (
                  <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <User className="h-3 w-3" />{w.contact_person}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WalkinsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Loading…</div>}>
      <WalkinsPageInner />
    </Suspense>
  );
}
