// The existing footer has labels only; no public legal/info routes exist yet.
export const FOOTER_INFORMATION = ['About', 'Sources', 'Privacy', 'Terms'] as const;
export const footerCopyright = (year: number) => `© ${year} Down & Distance`;
