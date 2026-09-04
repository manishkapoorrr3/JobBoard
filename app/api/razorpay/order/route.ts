// Razorpay — create order.
//
// Creates a Razorpay order for a walk-in listing (Rs 499 => 49900 paise).
//
// Demo mode: { demo: true } is returned ONLY when the Razorpay key id /
// secret are not configured — the frontend then uses its client-side demo
// activation. When Razorpay IS configured, any failure (network error,
// 4xx/5xx from api.razorpay.com) returns a 502 error instead, so a
// configured deployment can never silently degrade into a free
// client-side activation. The DB guard (migration 20260902000000) makes
// this a hard guarantee regardless.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fixed listing price in paise (Rs 499).
const AMOUNT_PAISE = 49900;

const ORDER_ERROR = 'Could not create payment order. Please try again.';

export async function POST(req: NextRequest) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // Razorpay not configured => demo mode (client-side demo activation).
  if (!keyId || !keySecret) {
    return NextResponse.json({ demo: true });
  }

  let body: { walkin_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const walkinId = typeof body.walkin_id === 'string' ? body.walkin_id : undefined;

  // Razorpay receipt must be <= 40 chars.
  const receipt = `walkin_${(walkinId ?? 'na').slice(0, 30)}`;

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: AMOUNT_PAISE,
        currency: 'INR',
        receipt,
        notes: { walkin_id: walkinId ?? '' },
      }),
    });

    if (!res.ok) {
      // Razorpay rejected the request — surface an error. Do NOT fall back
      // to demo mode: a configured deployment must never pay-for-nothing.
      return NextResponse.json({ error: ORDER_ERROR }, { status: 502 });
    }

    const order = await res.json();
    return NextResponse.json({
      demo: false,
      key_id: keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch {
    return NextResponse.json({ error: ORDER_ERROR }, { status: 502 });
  }
}
