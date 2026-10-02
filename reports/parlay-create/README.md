# Create a Parlay redesign

Replaced the existing web modal presentation with an 840px dark navy dialog, existing flask icon, condensed display typography, red prompt outline and CTA, five compact formulas, and informational footer. Omitted the decorative DATA / TRENDS / BETTER PICKS copy. Optional settings remain accessible and start collapsed. Existing web configure/generate/add/research handlers are retained.

Native Create a Parlay now opens a responsive React Native modal using the redesigned generator presentation. Existing native generator requests, validation, results, refinement, recent requests and add-to-slip flow remain in place. Additional suggestions remain available behind More suggestions. Safe-area spacing, keyboard avoidance and Android dismissal are included.

## Verification

- Web and native TypeScript checks passed.
- Existing research engine tests: 4 passed.
- Browser: all five formula selections, prompt counter, optional settings, Escape dismissal and disabled empty-market state verified.
- Desktop and 390px mobile-web screenshots captured in this directory.
- Current local data has no eligible markets; a live generated result was not verified.
- Native preview reached the login screen; native modal visual verification and physical iOS/Android testing remain outstanding.
- Existing browser test selectors updated to the new labels/collapsed settings; browser suite not run.
