// Razorpay — verify payment and activate the walk-in.
//
// Steps:
//  1. Verify the checkout signature: HMAC-SHA256(order_id|payment_id, secret)
//     compared with a constant-time comparison.
//  2. Fetch the payment from Razorpay and require status === 'captured' and
//     amount === 49900 (Rs 499) to defend against tampering.
//  3. Activate the walk-in via the service-role client (status 'live',
//     paid_until = now + 7 days).
//
// Graceful degradation:
//  - No Razorpay secret  => { demo: true }
//  - No service-role key => { demo: true, activateClientSide: true } (the
//    browser will run the existing client-side demo activation).
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

  // No Razorpay secret => demo mode.
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

  // 1. Verify the signature.
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (!safeEqualHex(expected, razorpay_signature)) {
    return NextResponse.json({ error: 'Signature verification failed.' }, { status: 400 });
  }

  // 2. Fetch the payment and confirm it was captured for the right amount.
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
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

  // 3. Activate the walk-in. If there is no service key, ask the client to
  //    run its existing demo activation instead.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ demo: true, activateClientSide: true });
  }

  const targetId = walkin_id;
  if (!targetId) {
    return NextResponse.json({ error: 'Missing walkin_id.' }, { status: 400 });
  }

  const paidUntil = new Date();
  paidUntil.setDate(paidUntil.getDate() + 7);

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('walkins')
    .update({ status: 'live', paid_until: paidUntil.toISOString() })
    .eq('id', targetId);

  if (error) {
    return NextResponse.json({ error: 'Activation failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paid_until: paidUntil.toISOString() });
}
