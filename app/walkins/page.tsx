'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { Walkin, NCR_CITIES, EDUCATION_OPTIONS, SHIFT_OPTIONS } from '@/lib/types';
import { WalkinCard } from '@/components/walkin-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox, MessageCircle } from 'lucide-react';
import { localISODate } from '@/lib/format';

const CATEGORIES = ['Voice', 'Non-Voice', 'Semi-Voice'] as const;

function WalkinsPageInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const city = searchParams.get('city') || 'all';
  const dateFilter = searchParams.get('date') || 'week';
  const category = searchParams.get('category') || 'all';
  const shift = searchParams.get('shift') || 'all';
  const cab = searchParams.get('cab') || 'all';
  const education = searchParams.get('education') || 'all';

  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [loading, setLoading] = useState(true);
  // Filled on mount so the share link uses the real deployed origin
  // (window.location is not available during SSR).
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(typeof window !== 'undefined' ? window.location.origin + '/walkins' : '');
  }, []);

  useEffect(() => {
    (async () => {
      const today = localISODate();
      const { data } = await supabase
        .from('walkins')
        .select('*')
        .in('status', ['live', 'approved'])
        .gte('walkin_date', today)
        .order('walkin_date', { ascending: true });
      setWalkins((data as Walkin[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const todayStr = localISODate();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localISODate(tomorrow);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = localISODate(weekEnd);

  const filtered = useMemo(() => {
    return walkins.filter((w) => {
      if (city !== 'all' && w.city !== city) return false;
      if (category !== 'all' && w.category !== category) return false;
      if (shift !== 'all' && w.shift !== shift) return false;
      if (cab === 'yes' && !w.cab) return false;
      if (education !== 'all' && w.education !== education) return false;
      if (dateFilter === 'today' && w.walkin_date !== todayStr) return false;
      if (dateFilter === 'tomorrow' && w.walkin_date !== tomorrowStr) return false;
      if (dateFilter === 'week' && w.walkin_date > weekEndStr) return false;
      return true;
    });
  }, [walkins, city, category, shift, cab, education, dateFilter, todayStr, tomorrowStr, weekEndStr]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete(key);
    else params.set(key, value);
    router.push(`/walkins?${params.toString()}`);
  }

  function chip(label: string, key: string, value: string) {
    const active = (searchParams.get(key) || 'all') === value || (value === 'all' && !searchParams.get(key));
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Walk-in Interviews</h1>
        <span className="text-sm text-slate-500">{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</p>
          <div className="flex flex-wrap gap-2">
            {chip('Today', 'date', 'today')}
            {chip('Tomorrow', 'date', 'tomorrow')}
            {chip('This week', 'date', 'week')}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">City</p>
          <div className="flex flex-wrap gap-2">
            {chip('All NCR', 'city', 'all')}
            {NCR_CITIES.map((c) => chip(c, 'city', c))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</p>
          <div className="flex flex-wrap gap-2">
            {chip('All', 'category', 'all')}
            {CATEGORIES.map((c) => chip(c, 'category', c))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Shift</p>
            <div className="flex flex-wrap gap-2">
              {chip('All', 'shift', 'all')}
              {SHIFT_OPTIONS.map((s) => chip(s, 'shift', s))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cab</p>
            <div className="flex flex-wrap gap-2">
              {chip('All', 'cab', 'all')}
              {chip('Yes', 'cab', 'yes')}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Education</p>
            <div className="flex flex-wrap gap-2">
              {chip('All', 'education', 'all')}
              {EDUCATION_OPTIONS.map((e) => chip(e, 'education', e))}
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            No walk-ins for this filter — try All or Noida
          </p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Check out NCR Walk-in for BPO walk-ins in Delhi NCR: ${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Share on WhatsApp
          </a>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((w) => (
            <WalkinCard key={w.id} walkin={w} />
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
