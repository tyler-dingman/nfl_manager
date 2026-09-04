'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState, type FormEvent } from 'react';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey?.startsWith('pk_test_') ? loadStripe(publishableKey) : null;

function StripePaymentForm({
  orderId,
  totalCents,
  onConfirmed,
  onBeforeConfirm,
  onBack,
}: {
  orderId: string;
  totalCents: number;
  onConfirmed: (paymentIntentId: string) => Promise<void>;
  onBeforeConfirm: () => Promise<void>;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    try {
      await onBeforeConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to prepare payment retry.');
      setSubmitting(false);
      return;
    }
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${orderId}` },
      redirect: 'if_required',
    });
    if (result.error) {
      setError("Payment didn't go through. Check your card details and try again.");
      setSubmitting(false);
      return;
    }
    if (!result.paymentIntent || result.paymentIntent.status !== 'succeeded') {
      setError('Payment is not complete yet. Follow the Stripe prompt and try again.');
      setSubmitting(false);
      return;
    }
    try {
      setFinalizing(true);
      await onConfirmed(result.paymentIntent.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to confirm your payment.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex-1 overflow-y-auto p-6">
      <div className="rounded-2xl bg-[#F4D9B7] p-4 text-sm font-bold">
        STRIPE TEST MODE — NO REAL CHARGE WILL BE MADE
      </div>
      <section className="mt-6 rounded-2xl bg-white p-5">
        <div className="mb-5 flex justify-between text-lg font-black">
          <span>Order total</span>
          <span>${(totalCents / 100).toFixed(2)}</span>
        </div>
        <PaymentElement
          options={{
            layout: 'tabs',
            wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
          }}
        />
      </section>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
      <button
        disabled={!stripe || !elements || submitting}
        className="mt-6 h-14 w-full rounded-full bg-[#FF3D38] font-black text-white disabled:opacity-50"
      >
        {finalizing
          ? 'PAYMENT RECEIVED — CONFIRMING ORDER…'
          : submitting
            ? 'CONFIRMING PAYMENT…'
            : `PAY $${(totalCents / 100).toFixed(2)}`}
      </button>
      <button type="button" onClick={onBack} className="mt-2 w-full py-3 text-sm font-black">
        Back to shipping information
      </button>
    </form>
  );
}

export function StripeCardPayment({
  clientSecret,
  orderId,
  totalCents,
  onConfirmed,
  onBeforeConfirm,
  onBack,
}: {
  clientSecret: string;
  orderId: string;
  totalCents: number;
  onConfirmed: (paymentIntentId: string) => Promise<void>;
  onBeforeConfirm: () => Promise<void>;
  onBack: () => void;
}) {
  if (!stripePromise)
    return (
      <div role="alert" className="m-6 rounded-xl bg-red-50 p-4 font-bold text-red-700">
        Card checkout is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and redeploy.
      </div>
    );
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#FF3D38', borderRadius: '12px', fontFamily: 'inherit' },
        },
      }}
    >
      <StripePaymentForm
        orderId={orderId}
        totalCents={totalCents}
        onConfirmed={onConfirmed}
        onBeforeConfirm={onBeforeConfirm}
        onBack={onBack}
      />
    </Elements>
  );
}
