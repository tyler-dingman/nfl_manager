export type MoneyQuote = { subtotalCents: number; discountCents: number };

export interface PaymentProvider {
  createPayment(input: {
    amountCents: number;
    fixture?: 'SUCCESS' | 'DECLINED';
  }): Promise<{ status: 'PAID' | 'DECLINED'; reference: string }>;
  refundPayment(reference: string, amountCents: number): Promise<{ status: 'REFUNDED' }>;
}
export interface ShippingProvider {
  quote(method: 'STANDARD' | 'EXPRESS'): { amountCents: number; label: string };
}
export interface TaxProvider {
  calculate(input: MoneyQuote): { amountCents: number; estimated: true };
}

export const demoPaymentProvider: PaymentProvider = {
  async createPayment({ fixture = 'SUCCESS' }) {
    return {
      status: fixture === 'DECLINED' ? 'DECLINED' : 'PAID',
      reference: `demo_pay_${randomUUID()}`,
    };
  },
  async refundPayment() {
    return { status: 'REFUNDED' };
  },
};
export const manualShippingProvider: ShippingProvider = {
  quote(method) {
    const standard = Number(process.env.COMMERCE_STANDARD_SHIPPING_CENTS ?? 699);
    const express = Number(process.env.COMMERCE_EXPRESS_SHIPPING_CENTS ?? 1299);
    return {
      amountCents: method === 'EXPRESS' ? express : standard,
      label: method === 'EXPRESS' ? 'Express' : 'Standard',
    };
  },
};
export const demoTaxProvider: TaxProvider = {
  calculate({ subtotalCents, discountCents }) {
    const rate = Number(process.env.COMMERCE_DEMO_TAX_RATE ?? 0.0825);
    return {
      amountCents: Math.round(Math.max(0, subtotalCents - discountCents) * rate),
      estimated: true,
    };
  },
};
import { randomUUID } from 'node:crypto';
