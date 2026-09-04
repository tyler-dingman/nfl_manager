import { NextRequest, NextResponse } from 'next/server';
import { constructStripeWebhookEvent, processStripeWebhookEvent } from '@/server/commerce/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, service: 'stripe-webhook' });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  try {
    const rawBody = await request.text();
    const event = constructStripeWebhookEvent(rawBody, signature);
    const result = await processStripeWebhookEvent(event);
    return NextResponse.json({ received: true, result: result.result });
  } catch (error) {
    console.warn(
      JSON.stringify({
        service: 'stripe-webhook',
        result: 'REJECTED',
        reason: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return NextResponse.json({ error: 'Webhook rejected.' }, { status: 400 });
  }
}
