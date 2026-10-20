// Reuse locally installed Chrome; no browser download, owner profile, or remote project required.
const base = require('./playwright.config.cjs');
module.exports = {
  ...base,
  use: { ...base.use, video: 'off' },
  projects: [{ name: 'Local Chrome', use: { ...base.projects[0].use, channel: 'chrome' } }],
};
