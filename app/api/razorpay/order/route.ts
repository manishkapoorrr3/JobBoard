// Razorpay — create order.
//
// Creates a Razorpay order for a walk-in listing (Rs 100 => 10000 paise).
// Degrades gracefully to demo mode ({ demo: true }) when the Razorpay key id /
// secret are not configured, or if the Razorpay API call fails, so the frontend
// can fall back to the existing client-side demo activation.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fixed listing price in paise (Rs 100).
const AMOUNT_PAISE = 10000;

export async function POST(req: NextRequest) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // No real Razorpay credentials => demo mode.
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
      // Razorpay rejected the request — fall back to demo so the user is not blocked.
      return NextResponse.json({ demo: true });
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
    return NextResponse.json({ demo: true });
  }
}
