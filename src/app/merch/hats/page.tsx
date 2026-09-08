import type { Metadata } from 'next';
import MerchCategoryPage from '@/components/merch/merch-category-page';

export const metadata: Metadata = {
  title: 'Football Hats | Down & Distance',
  description: 'Original Down & Distance hats for game day and every day.',
  alternates: { canonical: '/merch/hats' },
};
export default function HatsPage() {
  return <MerchCategoryPage category="Hats" />;
}
