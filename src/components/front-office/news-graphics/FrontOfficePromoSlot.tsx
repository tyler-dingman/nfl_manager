import Link from 'next/link';

import styles from './league-news-page.module.css';

export type FrontOfficePromo = {
  type: 'MERCH' | 'SPONSOR' | 'HOUSE_AD';
  image?: string;
  headline: string;
  cta: string;
  destinationUrl: string;
  campaignId: string;
};

const defaultPromo: FrontOfficePromo = {
  type: 'MERCH',
  headline: 'More football. Less noise.',
  cta: 'Visit the merch shop',
  destinationUrl: '/merch',
  campaignId: 'dd-merch-house',
};

export function FrontOfficePromoSlot({ promo = defaultPromo }: { promo?: FrontOfficePromo }) {
  return (
    <Link
      href={promo.destinationUrl}
      className={styles.promo}
      data-campaign-id={promo.campaignId}
      data-promo-type={promo.type}
      style={promo.image ? { backgroundImage: `url(${promo.image})` } : undefined}
    >
      <strong>{promo.headline}</strong>
      <span>{promo.cta} →</span>
    </Link>
  );
}
