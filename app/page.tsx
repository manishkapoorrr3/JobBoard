'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Walkin } from '@/lib/types';
import { WalkinCard } from '@/components/walkin-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Footprints, Calendar, MapPin, ShieldCheck, Phone, Briefcase } from 'lucide-react';
import { isToday, isThisWeek } from '@/lib/format';

export default function Home() {
  const supabase = getSupabase();
  const { user, profile } = useAuth();
  const isRecruiter = profile?.account_type === 'recruiter';
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
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

  const todayWalkins = walkins.filter((w) => isToday(w.walkin_date));
  const weekCount = walkins.filter((w) => isThisWeek(w.walkin_date)).length;

  const cityChips = [
    { label: 'Noida', href: '/walkins?city=Noida' },
    { label: 'Greater Noida', href: '/walkins?city=Greater+Noida' },
    { label: 'Gurgaon', href: '/walkins?city=Gurgaon' },
    { label: 'Delhi', href: '/walkins?city=Delhi' },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-10 text-white sm:px-10 sm:py-14">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            BPO walk-ins in Noida, Gurgaon &amp; Greater Noida — today
          </h1>
          <p className="mt-3 text-emerald-50 sm:text-lg">
            Voice, non-voice, night shift, cab. Salary on the card. Apply on WhatsApp.
          </p>
          <p className="mt-1 text-sm text-emerald-100" lang="hi">
            आज के वॉक-इन, व्हाट्सऐप पर अप्लाई करें।
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/walkins">
              <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
                <Calendar className="mr-2 h-4 w-4" />
                See today&apos;s walk-ins
              </Button>
            </Link>
            {!user && (
              <Link href="/signup">
                <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                  Sign up for alerts
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Count + city chips */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Footprints className="h-5 w-5 text-emerald-600" />
          {loading ? 'Loading walk-ins…' : `${weekCount} walk-in${weekCount !== 1 ? 's' : ''} this week`}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/walkins">
            <span className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white">All NCR</span>
          </Link>
          {cityChips.map((c) => (
            <Link key={c.label} href={c.href}>
              <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200">
                {c.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Today strip */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900"> happening today</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : todayWalkins.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {todayWalkins.slice(0, 6).map((w) => (
              <WalkinCard key={w.id} walkin={w} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">No walk-ins today. Check tomorrow or browse all this week.</p>
            <Link href="/walkins" className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:underline">
              Browse all walk-ins →
            </Link>
          </div>
        )}
        {todayWalkins.length > 0 && (
          <Link href="/walkins" className="inline-block text-sm font-medium text-emerald-600 hover:underline">
            See all walk-ins →
          </Link>
        )}
      </section>

      {/* Recruiter CTA */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Hiring? Post a walk-in — Rs 499</h3>
            <p className="mt-1 text-sm text-slate-600">
              Your listing goes live instantly. Visible for 7 days. Reach candidates across Delhi NCR.
            </p>
          </div>
          <Link href={isRecruiter ? '/walkins/new' : '/pricing'}>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Briefcase className="mr-2 h-4 w-4" />
              Post a walk-in
            </Button>
          </Link>
        </div>
      </section>

      {/* Trust */}
      <section className="flex items-start gap-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p>
          Companies pay to post. Fake walk-ins get removed. See something wrong?
          Use the Report button on any listing.
        </p>
      </section>

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/walkins" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
          <Calendar className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="font-semibold text-slate-900">Walk-in Interviews</p>
            <p className="text-sm text-slate-600">Today and this week across NCR</p>
          </div>
        </Link>
        <Link href="/jobs" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
          <Briefcase className="h-6 w-6 text-blue-600" />
          <div>
            <p className="font-semibold text-slate-900">Regular Jobs</p>
            <p className="text-sm text-slate-600">BPO roles, including remote</p>
          </div>
        </Link>
      </section>
    </div>
  );
}
