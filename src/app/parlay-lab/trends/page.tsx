import Link from 'next/link';
import MainSiteHeader from '@/components/main-site-header';

export default function TrendsPage() {
  return (
    <>
      <MainSiteHeader active="parlay-lab" />
      <main style={{ maxWidth: 1100, margin: '40px auto', padding: '0 24px', color: '#071b30' }}>
        <p
          style={{
            fontWeight: 900,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            fontSize: 12,
          }}
        >
          Down &amp; Distance Labs
        </p>
        <h1 style={{ fontSize: 52, margin: '8px 0' }}>Trend Research</h1>
        <p style={{ color: '#61758a', maxWidth: 720, lineHeight: 1.6 }}>
          Current sportsbook markets are available, but this project does not yet store player game
          logs. Last 5, Last 10, opponent splits, and hit-rate trends will appear here only after a
          historical data source is connected.
        </p>
        <Link
          href="/parlay-lab"
          style={{ display: 'inline-block', marginTop: 20, color: '#076bc2', fontWeight: 800 }}
        >
          ← Back to Parlay Lab
        </Link>
      </main>
    </>
  );
}
