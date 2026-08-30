import type { ReactNode } from 'react';

import { MerchCartProvider } from '@/components/merch/merch-cart';

export default function MerchLayout({ children }: { children: ReactNode }) {
  return <MerchCartProvider>{children}</MerchCartProvider>;
}
