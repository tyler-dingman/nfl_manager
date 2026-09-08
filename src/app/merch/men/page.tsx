import type { Metadata } from 'next';
import MerchCategoryPage from '@/components/merch/merch-category-page';

export const metadata: Metadata = {
  title: "Men's Football Apparel | Down & Distance",
  description:
    'Original football-inspired shirts, hoodies, and everyday gear from Down & Distance.',
  alternates: { canonical: '/merch/men' },
};
export default function MenPage() {
  return <MerchCategoryPage category="Men" />;
}
