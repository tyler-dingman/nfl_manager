'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV_ITEMS } from '@/config/primary-navigation';
import { FOOTER_INFORMATION, footerCopyright } from '../../packages/navigation/footer';
import styles from './site-footer.module.css';

export default function SiteFooter() {
  const pathname = usePathname();
  const hiddenPrefixes = ['/admin', '/login', '/onboarding', '/start', '/preview', '/dev'];
  if (hiddenPrefixes.some((prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)))
    return null;
  return (
    <footer className={`site-footer ${styles.footer}`}>
      <div className={styles.inner}>
        <Link href="/" aria-label="Down & Distance home" className={styles.brand}>
          Down &amp; Distance
        </Link>
        <nav aria-label="Explore Down & Distance" className={styles.primary}>
          {PRIMARY_NAV_ITEMS.map((item) => (
            <Link key={item.id} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.information} aria-label="Site information">
          {FOOTER_INFORMATION.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <small className={styles.copyright}>{footerCopyright(new Date().getFullYear())}</small>
      </div>
    </footer>
  );
}
