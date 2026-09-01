'use client';
// Admin panel — talks to the server-side /api/admin route (service-role backed).
// The PIN never touches the client bundle: it's entered by the operator and sent
// as the `x-admin-pin` header on every request. The server compares it against
// ADMIN_PIN and uses the service-role client to read/update.
import { useState } from 'react';
import { Walkin, Job } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Loader2, Eye, EyeOff, AlertTriangle, Flag } from 'lucide-react';
import { formatRelative } from '@/lib/format';

interface ReportRow {
  id: string;
  job_id: string | null;
  walkin_id: string | null;
  reason: string;
  detail: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [walkinCounts, setWalkinCounts] = useState<Record<string, number>>({});
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadData(currentPin: string): Promise<boolean> {
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        headers: { 'x-admin-pin': currentPin },
        cache: 'no-store',
      });
      if (res.status === 503) {
        toast.error('Admin API is not configured on the server.');
        return false;
      }
      if (res.status === 401) {
        toast.error('Wrong PIN.');
        return false;
      }
      if (!res.ok) {
        toast.error('Could not load admin data.');
        return false;
      }
      const data = await res.json();
      setWalkins((data.walkins as Walkin[]) ?? []);
      setJobs((data.jobs as Job[]) ?? []);
      setReports((data.reports as ReportRow[]) ?? []);
      setWalkinCounts(data.walkinReportCounts ?? {});
      setJobCounts(data.jobReportCounts ?? {});
      return true;
    } catch {
      toast.error('Could not reach the admin API.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function tryAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return toast.error('Enter the admin PIN.');
    const ok = await loadData(pin);
    if (ok) {
      setAuthed(true);
      toast.success('Admin access granted.');
    }
  }

  async function setStatus(table: 'walkins' | 'jobs', id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, status }),
      });
      if (res.status === 503) return toast.error('Admin API is not configured on the server.');
      if (res.status === 401) return toast.error('Session expired — re-enter PIN.');
      if (!res.ok) return toast.error('Could not update status.');

      if (table === 'walkins') {
        setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: status as Walkin['status'] } : w)));
      } else {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: status as Job['status'] } : j)));
      }
      toast.success('Updated.');
    } catch {
      toast.error('Could not update status.');
    } finally {
      setBusyId(null);
    }
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
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enter
          </Button>
        </form>
      </div>
    );
  }

  const reportedWalkins = walkins.filter((w) => w.status === 'reported');
  const reportedJobs = jobs.filter((j) => j.status === 'reported');

  function reportTarget(r: ReportRow): string {
    if (r.walkin_id) {
      const w = walkins.find((x) => x.id === r.walkin_id);
      return w ? `Walk-in: ${w.role_title} — ${w.company_name}` : `Walk-in ${r.walkin_id.slice(0, 8)}`;
    }
    if (r.job_id) {
      const j = jobs.find((x) => x.id === r.job_id);
      return j ? `Job: ${j.role_title} — ${j.company_name}` : `Job ${r.job_id.slice(0, 8)}`;
    }
    return 'Unknown target';
  }

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
          {/* Recent reports */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Flag className="h-4 w-4 text-red-500" />
              Recent reports ({reports.length})
            </h2>
            {reports.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No reports yet.
              </p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{reportTarget(r)}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatRelative(r.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      <span className="font-medium text-red-600">{r.reason}</span>
                      {r.detail ? ` — ${r.detail}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Walkins */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Walk-ins ({walkins.length})</h2>
            <div className="space-y-2">
              {walkins.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {w.role_title} — {w.company_name}
                      {(walkinCounts[w.id] ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <Flag className="h-3 w-3" />{walkinCounts[w.id]}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">Status: {w.status} | {w.city}, {w.area} | {w.walkin_date}</p>
                  </div>
                  <div className="flex gap-1">
                    {busyId === w.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : w.status === 'reported' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus('walkins', w.id, 'live')}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Unhide
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus('walkins', w.id, 'reported')}>
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
                    <p className="truncate text-sm font-medium text-slate-900">
                      {j.role_title} — {j.company_name}
                      {(jobCounts[j.id] ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <Flag className="h-3 w-3" />{jobCounts[j.id]}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">Status: {j.status} | {j.location_type}</p>
                  </div>
                  <div className="flex gap-1">
                    {busyId === j.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : j.status === 'reported' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus('jobs', j.id, 'live')}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Unhide
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus('jobs', j.id, 'reported')}>
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
