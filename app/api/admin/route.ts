// Admin API — privileged read + status updates over the service-role client.
//
// Auth is a shared PIN passed in the `x-admin-pin` header, compared against
// process.env.ADMIN_PIN. All data access uses the service-role Supabase client
// (RLS-bypassing), so this route MUST run on the Node.js runtime and must never
// leak the service key to the browser.
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isAdminConfigured } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Status values an admin is allowed to set, per table.
const ALLOWED_STATUS: Record<'walkins' | 'jobs', string[]> = {
  walkins: ['draft', 'live', 'expired', 'reported', 'pending', 'approved', 'rejected'],
  jobs: ['draft', 'live', 'expired', 'reported', 'pending', 'approved', 'rejected'],
};

function pinOk(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-pin') ?? '';
  const expected = process.env.ADMIN_PIN ?? '';
  return Boolean(expected) && provided === expected;
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Admin API is not configured on the server.', configured: false },
      { status: 503 }
    );
  }
  if (!pinOk(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const [walkinsRes, jobsRes, reportsRes] = await Promise.all([
    supabase.from('walkins').select('*').order('created_at', { ascending: false }),
    supabase.from('jobs').select('*').order('created_at', { ascending: false }),
    supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100),
  ]);

  if (walkinsRes.error || jobsRes.error || reportsRes.error) {
    return NextResponse.json(
      { error: 'Failed to load admin data.' },
      { status: 500 }
    );
  }

  const reports = reportsRes.data ?? [];

  // Per-listing report counts derived from the fetched reports.
  const walkinReportCounts: Record<string, number> = {};
  const jobReportCounts: Record<string, number> = {};
  for (const r of reports as Array<{ walkin_id: string | null; job_id: string | null }>) {
    if (r.walkin_id) walkinReportCounts[r.walkin_id] = (walkinReportCounts[r.walkin_id] ?? 0) + 1;
    if (r.job_id) jobReportCounts[r.job_id] = (jobReportCounts[r.job_id] ?? 0) + 1;
  }

  return NextResponse.json({
    walkins: walkinsRes.data ?? [],
    jobs: jobsRes.data ?? [],
    reports: reports.slice(0, 25),
    walkinReportCounts,
    jobReportCounts,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Admin API is not configured on the server.', configured: false },
      { status: 503 }
    );
  }
  if (!pinOk(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { table?: string; id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { table, id, status } = body;
  if (table !== 'walkins' && table !== 'jobs') {
    return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
  }
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  }
  if (!status || !ALLOWED_STATUS[table].includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from(table)
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: data });
}
