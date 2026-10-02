import localFont from 'next/font/local';
export const huddleFont = localFont({
  src: [
    {
      path: '../../../apps/mobile/assets/fonts/BarlowCondensed-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../apps/mobile/assets/fonts/BarlowCondensed-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../../apps/mobile/assets/fonts/BarlowCondensed-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../../../apps/mobile/assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf',
      weight: '800',
      style: 'italic',
    },
  ],
  variable: '--font-huddle',
  display: 'swap',
});
