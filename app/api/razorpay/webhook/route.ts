// Razorpay — webhook receiver.
//
// Razorpay sends server-to-server events signed with the webhook secret. We
// verify the `x-razorpay-signature` header (HMAC-SHA256 of the raw body) and, on
// `payment.captured` or `order.paid`, activate the walk-in referenced by the
// order's notes.walkin_id via the service-role client.
//
// Degrades gracefully: without the webhook secret or the service-role key we
// acknowledge the event (200) so Razorpay does not retry indefinitely, but do
// nothing.
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

  const paidUntil = new Date();
  paidUntil.setDate(paidUntil.getDate() + 7);

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('walkins')
    .update({ status: 'live', paid_until: paidUntil.toISOString() })
    .eq('id', walkinId);

  if (error) {
    return NextResponse.json({ error: 'Activation failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, walkin_id: walkinId });
}
