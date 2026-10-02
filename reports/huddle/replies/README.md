# Inline Huddle replies

Daily/GameDay Live and Chat reuse their existing composer under the selected fan comment. No reply data model or API changes. The main composer returns when reply mode closes. Existing draft and attachment state is retained when switching targets or cancelling; successful submission clears it.

Desktop and 390px mobile-web screenshots cover normal, open, typed and posted states. Browser checks verified autofocus, cancel, emoji, KLIPY selection/removal, and text submission retaining the correct parent. Posting remains local-preview-only; real-time/server posting was not enabled. Image selection retains the existing preview-only behavior.

The existing 1,000-character message limit is preserved (the supplied mockup shows 500). The counter matches actual validation. Both TypeScript checks and five shared Huddle/GIF tests passed. Native code was updated, but physical iOS/Android rendering and keyboard behavior were not tested. No GameDay live data refresh was enabled.
