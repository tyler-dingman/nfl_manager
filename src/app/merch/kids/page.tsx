import type { Metadata } from 'next';
import MerchCategoryPage from '@/components/merch/merch-category-page';

export const metadata: Metadata = {
  title: "Kids' Football Apparel | Down & Distance",
  description: 'Original football-inspired gear for the next generation of fans.',
  alternates: { canonical: '/merch/kids' },
};
export default function KidsPage() {
  return <MerchCategoryPage category="Kids" />;
}
