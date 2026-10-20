# RC3 hosted qualification harness

Run from the RC3 repository root. These tools target only the existing staging host and account; they do not create resources. Keep credentials in the existing restricted temporary directory referenced by `/private/tmp/dd-rc3-private-location.txt`, never in source, output, URLs or screenshots.

Local redirect regression: `node --test scripts/hosted-staging/redirect-validation.test.mjs`.

`qualify-access.mjs` verifies denied anonymous/assets/API access, invalid and expired credentials, exact authorized static bytes, same-origin signed-out authentication redirect and login payload, absent product session, authorized auth configuration, and private internal Worker URLs. Browser hydration is checked separately by `browser-smoke.mjs`; the server payload may contain only the login client bundle rather than rendered input fields. An arbitrary 307, wrong destination/next parameter, off-origin redirect, loop or unexpected authenticated redirect is rejected.

`exposure.mjs enable|disable` controls only the existing Web workers.dev endpoint and records read-back verification. Refresh actual account inventory and all five Worker settings before enabling: the existing safety preconditions depend on the recorded private settings and successful deployments. Run only within owner-authorized staging qualification. Any bypass or unexpected exposure requires immediate disable and a remote stop.

The browser harness blocks all off-host requests. It uses the synthetic account's current application session separately from the staging cookie, captures only unfilled login UI/failure screenshots, and does not exercise provider integration. A browser rendering is not native Android/iOS validation.

No harness change was uploaded as application code in this mission. The unchanged private API Worker was redeployed once solely for persistence testing. Per-operation Cloudflare CPU/query evidence is in `reports/hosted-staging-rc3/completion/measured-operations.json` and `persistence-and-product-metrics.json`. Temporary measurement runners held raw authentication material outside the repository; only sanitized trace metrics were exported.
