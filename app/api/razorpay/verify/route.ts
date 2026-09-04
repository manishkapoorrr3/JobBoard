// Razorpay — verify payment and activate the walk-in.
//
// Steps:
//  1. Verify the checkout signature: HMAC-SHA256(order_id|payment_id, secret)
//     compared with a constant-time comparison.
//  2. Fetch the payment from Razorpay and require status === 'captured' and
//     amount === 49900 (Rs 499) to defend against tampering.
//  3. Fetch the order and require notes.walkin_id === the submitted walkin_id
//     (the note is written by /api/razorpay/order), so a valid payment can
//     only ever activate the listing it was created for.
//  4. Activate the walk-in via the service-role client (status 'live',
//     paid_until = now + 7 days). Idempotent: a listing that is already
//     'live' with a future paid_until is acknowledged without re-extending.
//
// This is the ONLY path that sets a walk-in to 'live' when
// RAZORPAY_KEY_SECRET + SUPABASE_SERVICE_ROLE_KEY are configured. The DB
// guard (migration 20260902000000_enforce_paid_activation) blocks every
// browser-side (anon/authenticated) 'live' transition, and the frontend
// never self-activates once Razorpay is configured.
//
// Graceful degradation:
//  - No Razorpay keys => { demo: true } (demo mode; the client uses its
//    demo activation, which only works on databases without the
//    20260902000000 hardening).
//  - Razorpay configured but no service-role key => 500 with a support
//    error. There is deliberately NO client-side fallback here: the
//    payment was verified, and only the server may flip 'live'.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AMOUNT_PAISE = 49900;

// Constant-time string comparison over hex signatures.
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // Razorpay not configured => demo mode.
  if (!keyId || !keySecret) {
    return NextResponse.json({ demo: true });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    walkin_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, walkin_id } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields.' }, { status: 400 });
  }
  if (!walkin_id || typeof walkin_id !== 'string') {
    return NextResponse.json({ error: 'Missing walkin_id.' }, { status: 400 });
  }

  // 1. Verify the signature.
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (!safeEqualHex(expected, razorpay_signature)) {
    return NextResponse.json({ error: 'Signature verification failed.' }, { status: 400 });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  // 2. Fetch the payment and confirm it was captured for the right amount.
  try {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not verify payment.' }, { status: 400 });
    }
    const payment = await res.json();
    if (payment.status !== 'captured' || payment.amount !== AMOUNT_PAISE) {
      return NextResponse.json({ error: 'Payment not captured or amount mismatch.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not verify payment.' }, { status: 400 });
  }

  // 3. The paid order must belong to this listing (notes.walkin_id is set at
  //    order creation in /api/razorpay/order).
  let orderWalkinId: string | undefined;
  try {
    const res = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not verify payment order.' }, { status: 400 });
    }
    const order = await res.json();
    orderWalkinId =
      typeof order?.notes?.walkin_id === 'string' ? order.notes.walkin_id : undefined;
  } catch {
    return NextResponse.json({ error: 'Could not verify payment order.' }, { status: 400 });
  }
  if (!orderWalkinId || orderWalkinId !== walkin_id) {
    return NextResponse.json(
      { error: 'Payment order does not match this listing.' },
      { status: 400 }
    );
  }

  // 4. Activate the walk-in. If there is no service key, the payment was
  //    verified but the server cannot activate — report a support error.
  //    Never delegate this to the client.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          'Payment verified but could not be activated on the server. Please contact support.',
      },
      { status: 500 }
    );
  }

  const supabase = getServiceSupabase();

  // Idempotency: if the listing is already live with a future expiry,
  // acknowledge without extending it again.
  const { data: existing } = await supabase
    .from('walkins')
    .select('status, paid_until')
    .eq('id', walkin_id)
    .maybeSingle();

  if (
    existing &&
    existing.status === 'live' &&
    existing.paid_until &&
    new Date(existing.paid_until) > new Date()
  ) {
    return NextResponse.json({
      ok: true,
      already_live: true,
      paid_until: existing.paid_until,
    });
  }

  const paidUntil = new Date();
  paidUntil.setDate(paidUntil.getDate() + 7);

  const { error } = await supabase
    .from('walkins')
    .update({ status: 'live', paid_until: paidUntil.toISOString() })
    .eq('id', walkin_id);

  if (error) {
    return NextResponse.json({ error: 'Activation failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paid_until: paidUntil.toISOString() });
}
