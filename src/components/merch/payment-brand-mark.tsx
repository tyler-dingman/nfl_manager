'use client';

import { useState } from 'react';
import type { ExpressProviderId } from '@/features/merch/express-checkout';

const marks: Partial<Record<ExpressProviderId, { src: string; alt: string }>> = {
  PAYPAL: {
    src: 'https://www.paypalobjects.com/marketing/web/logos/paypal-mark-color_new.svg',
    alt: 'PayPal',
  },
  GOOGLE_PAY: {
    src: 'https://developers.google.com/static/pay/api/images/brand-guidelines/google-pay-mark.png',
    alt: 'Google Pay',
  },
};

export function PaymentBrandMark({ provider }: { provider: ExpressProviderId }) {
  const [failed, setFailed] = useState(false);
  if (provider === 'APPLE_PAY') return <span className="apple-pay-fallback">Apple Pay</span>;
  const mark = marks[provider];
  return (
    <span className="flex items-center justify-center gap-3">
      {!failed && mark ? (
        // Provider-hosted official artwork. Adjacent text is the resilient fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mark.src}
          alt=""
          aria-hidden="true"
          onError={() => setFailed(true)}
          className={provider === 'PAYPAL' ? 'h-7 w-7 object-contain' : 'h-8 w-14 object-contain'}
        />
      ) : null}
      {provider === 'PAYPAL' || failed ? (
        <span>{provider === 'PAYPAL' ? 'PayPal Checkout' : mark?.alt}</span>
      ) : null}
    </span>
  );
}
