import type { MetadataRoute } from 'next';
import { prelaunchEnabled } from '@/lib/prelaunch';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return prelaunchEnabled()
    ? { rules: { userAgent: '*', disallow: '/' } }
    : { rules: { userAgent: '*', allow: '/' }, sitemap: 'https://downdistance.com/sitemap.xml' };
}
