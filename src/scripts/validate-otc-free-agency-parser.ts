import assert from 'node:assert/strict';

import { parseAjaxFreeAgencyRows } from '@/server/data-sources/overthecap-free-agency';
import { normalizePlayerName } from '@/server/ingest/normalize';

const SAMPLE_ROWS = `
<tr class="sortable" data-old-team="TEN" data-new-team="" data-position="WR" data-fatype="SFA">
  <td><a href="/player/deandre-h*">DeAndre Hopkins</a></td>
  <td>WR</td>
  <td><a class="team-link TEN">Titans</a></td>
  <td> </td>
  <td>SFA</td>
  <td>65.2%</td>
  <td>33</td>
  <td>$8,000,000</td>
  <td class="mobile_drop">$4,500,000</td>
</tr>
<tr class="sortable" data-old-team="MIA" data-new-team="BUF" data-position="WR" data-fatype="SFA">
  <td><a href="/player/tyreek-hill/4878/">Tyreek Hill</a></td>
  <td>WR</td>
  <td><a class="team-link MIA">Dolphins</a></td>
  <td><a class="team-link BUF">Bills</a></td>
  <td>SFA</td>
  <td>15.8%</td>
  <td>32</td>
  <td>$30,000,000</td>
  <td class="mobile_drop">$54,000,000</td>
</tr>
`;

const parsed = parseAjaxFreeAgencyRows(SAMPLE_ROWS);
const foundHopkins = parsed.some(
  (row) => row.normalizedName === normalizePlayerName('DeAndre Hopkins'),
);
const unsignedCount = parsed.filter((row) => row.nextTeamAbbr === null).length;

assert.ok(foundHopkins, 'Expected parser to find DeAndre Hopkins');
assert.ok(unsignedCount > 0, 'Expected parser to produce unsigned players');

console.log(
  `[otc:fa:test] rows=${parsed.length} unsigned=${unsignedCount} deandre_hopkins_found=${foundHopkins}`,
);
