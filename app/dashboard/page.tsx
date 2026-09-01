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

const PRICE = 499;

function DashboardInner() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewingId, setRenewingId] = useState<string | null>(null);

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

  // Load the Razorpay checkout.js script once.
  function loadCheckoutScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  // Client-side demo activation (no real payment) — mirrors the post flow.
  async function demoRenew(id: string) {
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 7);
    const { error } = await supabase
      .from('walkins')
      .update({ status: 'live', paid_until: paidUntil.toISOString() })
      .eq('id', id);
    setRenewingId(null);
    if (error) return toast.error('Could not renew listing.');
    setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'live', paid_until: paidUntil.toISOString() } : w)));
    toast.success('Renewed for 7 days!');
  }

  async function renew(id: string) {
    setRenewingId(id);

    let order: {
      demo?: boolean;
      key_id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
    };
    try {
      const res = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walkin_id: id }),
      });
      order = await res.json();
    } catch {
      order = { demo: true };
    }

    if (order.demo || !order.order_id || !order.key_id) {
      await demoRenew(id);
      return;
    }

    const loaded = await loadCheckoutScript();
    if (!loaded) {
      toast.error('Could not load the payment gateway. Please try again.');
      setRenewingId(null);
      return;
    }

    const rzp = new (window as any).Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount ?? PRICE * 100,
      currency: order.currency ?? 'INR',
      name: 'NCR Walk-in',
      description: 'Renew walk-in listing — 7 days',
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const vRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              walkin_id: id,
            }),
          });
          const result = await vRes.json();
          if (vRes.ok && result.ok) {
            const paidUntil = result.paid_until ?? new Date(Date.now() + 7 * 86400000).toISOString();
            setRenewingId(null);
            setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'live', paid_until: paidUntil } : w)));
            toast.success('Renewed for 7 days!');
          } else if (result.activateClientSide) {
            await demoRenew(id);
          } else {
            setRenewingId(null);
            toast.error(result.error || 'Payment verification failed. Please contact support.');
          }
        } catch {
          setRenewingId(null);
          toast.error('Payment verification failed. Please contact support.');
        }
      },
      modal: { ondismiss: () => setRenewingId(null) },
    });
    rzp.open();
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
                    <Button
                      size="sm"
                      onClick={() => renew(w.id)}
                      disabled={renewingId === w.id}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {renewingId === w.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Renew Rs 499
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
