# Player transaction redesign validation

Implemented shared transaction presentation for signing, renegotiating, and releasing on web and the native roster/free-agency screens. Production mutations, contract inputs, scoring modules, and release confirmation behavior remain connected to their original handlers. Market comparables are unavailable and disabled rather than populated with sample data.

## Checks

- Web and native TypeScript checks pass.
- Existing contract acceptance checks pass (`node --import tsx scripts/contract-acceptance-check.ts`).
- Existing cap check fails: expected first-year cap hit 12, actual 8. The cap engine and check were not changed by this redesign.
- Desktop browser inspection: Seattle sign layout, Chiefs renegotiation layout, and initials fallback.
- Saved screenshot: `sign-desktop-sea.png`.
- Screenshot uses an isolated, clearly labeled visual fixture, including a real repository headshot and sample contract values. No franchise mutations were performed.
- Subsequent Chrome navigation failed with ERR_BLOCKED_BY_CLIENT for localhost and loopback. Release, responsive mobile, Eagles, and Vikings screenshots remain unverified. iOS/Android device rendering is also unverified.

Development-only preview: `/dev-transaction-visual`. Choose mode and team, then Open preview. The preview includes simulated error/acceptance responses and never writes franchise data. Production returns 404 for this page.
