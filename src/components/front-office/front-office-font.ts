import { Barlow_Condensed } from 'next/font/google';

// Only the two approved roles: upright KPI values and italic editorial features.
export const frontOfficeFont = Barlow_Condensed({
  weight: '800',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-front-office-barlow',
});
