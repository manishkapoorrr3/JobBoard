// Razorpay — webhook receiver.
//
// Razorpay sends server-to-server events signed with the webhook secret. We
// verify the `x-razorpay-signature` header (HMAC-SHA256 of the raw body) and, on
// `payment.captured` or `order.paid`, activate the walk-in referenced by the
// order's notes.walkin_id via the service-role client.
//
// The activation is idempotent: if the walk-in is already 'live' with a future
// paid_until, the event is acknowledged without extending the listing again
// (Razorpay retries on non-2xx, and the checkout verify call may have already
// activated the same payment).
//
// Degrades gracefully: without the webhook secret we reject with 400 only if a
// signature is present; without the service-role key we acknowledge the event
// (200) so Razorpay does not retry indefinitely, but do nothing.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  // Raw body is required for signature verification.
  const raw = await req.text();

  if (!webhookSecret) {
    if (signature) {
      // A signed event reached us but we cannot verify it — reject so the
      // event is not silently dropped.
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }
    return NextResponse.json({ demo: true });
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
  if (!signature || !safeEqualHex(expected, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const event = payload?.event as string | undefined;
  if (event !== 'payment.captured' && event !== 'order.paid') {
    // Not an event we act on — acknowledge so Razorpay stops retrying.
    return NextResponse.json({ ok: true, ignored: event ?? null });
  }

  const walkinId = payload?.payload?.order?.entity?.notes?.walkin_id as string | undefined;
  if (!walkinId) {
    return NextResponse.json({ ok: true, note: 'No walkin_id in order notes.' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Nothing we can do server-side; acknowledge to avoid retries.
    return NextResponse.json({ ok: true, note: 'Service key not configured.' });
  }

  const supabase = getServiceSupabase();

  // Idempotency: don't re-extend a listing that is already live.
  const { data: existing } = await supabase
    .from('walkins')
    .select('status, paid_until')
    .eq('id', walkinId)
    .maybeSingle();

  if (
    existing &&
    existing.status === 'live' &&
    existing.paid_until &&
    new Date(existing.paid_until) > new Date()
  ) {
    return NextResponse.json({
      ok: true,
      walkin_id: walkinId,
      note: 'Already live; nothing to do.',
    });
  }

  const paidUntil = new Date();
  paidUntil.setDate(paidUntil.getDate() + 7);

  const { error } = await supabase
    .from('walkins')
    .update({ status: 'live', paid_until: paidUntil.toISOString() })
    .eq('id', walkinId);

  if (error) {
    return NextResponse.json({ error: 'Activation failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, walkin_id: walkinId });
}
