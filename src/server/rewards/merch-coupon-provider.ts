export type MerchRewardCouponInput = {
  userId: string;
  rewardId: string;
  percentOff: number;
  usageLimit: 1;
  stackable: false;
};

/**
 * Boundary for a future Shopify/commerce adapter. The current preview store has no real checkout,
 * so coupon issuance remains in the rewards domain and is never presented as an applied discount.
 */
export interface MerchCouponProvider {
  createCoupon(input: MerchRewardCouponInput): Promise<{ externalId: string; code: string }>;
  verifyRedemption(externalId: string): Promise<boolean>;
}
