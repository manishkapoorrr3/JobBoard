'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { RequireRecruiter } from '@/lib/auth-guards';
import { Walkin, formatSalary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ExternalLink, Calendar } from 'lucide-react';
import { formatWalkinDate } from '@/lib/format';

function DashboardInner() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('walkins')
        .select('*')
        .eq('posted_by_user_id', user.id)
        .order('created_at', { ascending: false });
      setWalkins((data as Walkin[]) ?? []);
      setLoading(false);
    })();
  }, [supabase, user]);

  async function renew(id: string) {
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 7);
    const { error } = await supabase
      .from('walkins')
      .update({ status: 'live', paid_until: paidUntil.toISOString() })
      .eq('id', id);
    if (error) return toast.error('Could not renew listing.');
    setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'live', paid_until: paidUntil.toISOString() } : w)));
    toast.success('Renewed for 7 days!');
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Listings</h1>
        <Link href="/walkins/new">
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">Post new walk-in</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : walkins.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">You have not posted any walk-ins yet.</p>
          <Link href="/walkins/new" className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:underline">
            Post your first walk-in →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {walkins.map((w) => {
            const isExpired = w.status === 'expired' || (w.paid_until && new Date(w.paid_until) < now);
            const isLive = w.status === 'live' && (!w.paid_until || new Date(w.paid_until) >= now);
            return (
              <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-900">{w.role_title}</h3>
                    <p className="truncate text-sm text-slate-600">{w.company_name}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatWalkinDate(w.walkin_date)} {w.walkin_time}
                      </span>
                      <span className="font-medium text-emerald-700">{formatSalary(w.salary_min, w.salary_max)}</span>
                      <span className="text-slate-400">{w.city}, {w.area}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {isLive && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Live</span>}
                    {isExpired && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Expired</span>}
                    {w.status === 'draft' && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Draft</span>}
                    {w.status === 'reported' && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Reported</span>}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link href={`/walkins/${w.id}`}>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />View
                    </Button>
                  </Link>
                  {isExpired && (
                    <Button size="sm" onClick={() => renew(w.id)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Renew Rs 499
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireRecruiter>
      <DashboardInner />
    </RequireRecruiter>
  );
}
