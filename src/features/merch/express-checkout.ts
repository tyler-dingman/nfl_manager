export type ExpressProviderId = 'PAYPAL' | 'APPLE_PAY' | 'GOOGLE_PAY';

export type DemoExpressCheckoutProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
};

export interface ExpressCheckoutProvider {
  id: ExpressProviderId;
  label: string;
  startCheckout(): Promise<DemoExpressCheckoutProfile>;
  confirmOrder(): Promise<{ authorized: true }>;
}

export const demoExpressProfile: DemoExpressCheckoutProfile = {
  firstName: 'Demo',
  lastName: 'Shopper',
  email: 'demo-shopper@downanddistance.test',
  phone: '555-0100',
  address1: '100 Football Way',
  city: 'Kansas City',
  state: 'MO',
  postalCode: '64129',
};

const provider = (id: ExpressProviderId, label: string): ExpressCheckoutProvider => ({
  id,
  label,
  async startCheckout() {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return demoExpressProfile;
  },
  async confirmOrder() {
    return { authorized: true };
  },
});

export const demoExpressProviders: Record<ExpressProviderId, ExpressCheckoutProvider> = {
  PAYPAL: provider('PAYPAL', 'PayPal Checkout'),
  APPLE_PAY: provider('APPLE_PAY', 'Apple Pay'),
  GOOGLE_PAY: provider('GOOGLE_PAY', 'Google Pay'),
};
