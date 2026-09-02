'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { Walkin, Job } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function AdminPage() {
  const supabase = getSupabase();
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '499499';

  function tryAuth(e: React.FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setAuthed(true);
      toast.success('Admin access granted.');
    } else {
      toast.error('Wrong PIN.');
    }
  }

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    (async () => {
      const [{ data: w }, { data: j }] = await Promise.all([
        supabase.from('walkins').select('*').order('created_at', { ascending: false }),
        supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      ]);
      setWalkins((w as Walkin[]) ?? []);
      setJobs((j as Job[]) ?? []);
      setLoading(false);
    })();
  }, [supabase, authed]);

  async function setWalkinStatus(id: string, status: string) {
    const { error } = await supabase.from('walkins').update({ status }).eq('id', id);
    if (error) return toast.error('Could not update status.');
    setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: status as any } : w)));
    toast.success('Updated.');
  }

  async function setJobStatus(id: string, status: string) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', id);
    if (error) return toast.error('Could not update status.');
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: status as any } : j)));
    toast.success('Updated.');
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        </div>
        <form onSubmit={tryAuth} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pin">Admin PIN</Label>
            <Input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" />
          </div>
          <Button type="submit" className="w-full">Enter</Button>
        </form>
      </div>
    );
  }

  const reportedWalkins = walkins.filter((w) => w.status === 'reported');
  const reportedJobs = jobs.filter((j) => j.status === 'reported');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
      </div>

      {(reportedWalkins.length > 0 || reportedJobs.length > 0) && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {reportedWalkins.length + reportedJobs.length} listing(s) reported and hidden. Review below.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Walkins */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Walk-ins ({walkins.length})</h2>
            <div className="space-y-2">
              {walkins.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{w.role_title} — {w.company_name}</p>
                    <p className="text-xs text-slate-500">Status: {w.status} | {w.city}, {w.area} | {w.walkin_date}</p>
                  </div>
                  <div className="flex gap-1">
                    {w.status === 'reported' && (
                      <Button size="sm" variant="outline" onClick={() => setWalkinStatus(w.id, 'live')}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Unhide
                      </Button>
                    )}
                    {w.status !== 'reported' && (
                      <Button size="sm" variant="ghost" onClick={() => setWalkinStatus(w.id, 'reported')}>
                        <EyeOff className="mr-1 h-3.5 w-3.5" />Hide
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Jobs */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Jobs ({jobs.length})</h2>
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{j.role_title} — {j.company_name}</p>
                    <p className="text-xs text-slate-500">Status: {j.status} | {j.location_type}</p>
                  </div>
                  <div className="flex gap-1">
                    {j.status === 'reported' && (
                      <Button size="sm" variant="outline" onClick={() => setJobStatus(j.id, 'live')}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Unhide
                      </Button>
                    )}
                    {j.status !== 'reported' && (
                      <Button size="sm" variant="ghost" onClick={() => setJobStatus(j.id, 'reported')}>
                        <EyeOff className="mr-1 h-3.5 w-3.5" />Hide
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
