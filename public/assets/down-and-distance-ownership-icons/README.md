# Down & Distance — Ownership icons

90 original SVG outline icons for Ownership Central, Stadium, Facilities, Business, Fans, Report Card, and Legacy.

## Design

Drawn to match the supplied Ownership screenshot’s simple single-color, rounded outline style. All icons use `viewBox="0 0 24 24"`, `stroke-width="1.75"`, `fill="none"`, `stroke="currentColor"`, and rounded caps and joins. Default size is 24 × 24. Use 20–32 px in the interface; 24 px is the preferred size. Strokes scale naturally with the icon.

## Files

- Five category folders contain 90 individual SVGs with descriptive kebab-case filenames.
- `index.html`: self-contained searchable visual index; open in any modern browser. Includes light/dark themes and size controls.
- `manifest.json`: exact file paths, category names, and suggested use for every icon.
- `preview.svg`: overview sheet of the complete collection.

## Integration

Inline the SVG markup or use your app’s SVG-to-component loader so `currentColor` inherits the surrounding CSS text color. An SVG loaded through an HTML `<img>` does not inherit the page’s text color; use inline SVG for theme-aware icons.

```html
<span style="color: #d9e5e8">
  <!-- Insert the selected SVG markup here. -->
</span>
```

For decorative icons beside visible text, add `aria-hidden="true"` and `focusable="false"` to the SVG. For an icon-only button, put an accessible label on the button and hide its decorative SVG. For a standalone meaningful graphic, add `role="img"` and an `aria-label` to the SVG. Raw assets deliberately leave accessibility attributes to the consuming component.

In React, convert SVG attributes to `strokeWidth`, `strokeLinecap`, and `strokeLinejoin`, or let your SVG component loader do it. Set width and height together to keep the aspect ratio. Do not add fills or per-icon stroke overrides.

Folder names use spaces and ampersands for readability. Use `manifest.json` to resolve paths; encode URL path segments when serving them directly.

## Usage rights

These icons were created for this request. No third-party icon libraries, fonts, logos, scripts, or remote assets are included. You may use and modify the delivered assets in Down & Distance.

## Icon inventory

### Stadium & Game Day (28)

| File | Suggested use |
| --- | --- |
| `stadium.svg` | Stadium overview and snapshot |
| `suites.svg` | Private premium suites |
| `premium-seating.svg` | Premium ticket tiers and hospitality |
| `club-seating.svg` | Club seats and lounges |
| `seating.svg` | General seating upgrades |
| `video.svg` | Video production and content |
| `video-boards.svg` | Stadium screens and replay boards |
| `wi-fi.svg` | Connectivity and wireless coverage |
| `restrooms.svg` | Restrooms and family facilities |
| `sound.svg` | Stadium sound system |
| `concessions.svg` | Concession stands and revenue |
| `food.svg` | Dining and food quality |
| `hot-dog.svg` | Hot dogs and game-day food |
| `hamburger.svg` | Burgers and concession menus |
| `drink.svg` | Soft drinks and beverages |
| `beer.svg` | Beer and beverage sales |
| `grab-and-go.svg` | Grab & Go markets |
| `entry-gates.svg` | Entry gates and turnstiles |
| `accessibility.svg` | Accessible seating and facilities |
| `parking.svg` | Parking and arrival experience |
| `security.svg` | Security and guest safety |
| `shovel.svg` | Groundbreaking and construction |
| `renovate.svg` | Renovate current stadium |
| `expand.svg` | Expand capacity and footprint |
| `new-stadium.svg` | Build new stadium |
| `lighting.svg` | Field and stadium lighting |
| `game-day.svg` | Game day operations |
| `project-timeline.svg` | Project duration and construction schedule |

### Facilities & Player Development (20)

| File | Suggested use |
| --- | --- |
| `training-facility.svg` | Training facility overview |
| `training.svg` | Player training and conditioning |
| `dumbbell.svg` | Weight room and strength equipment |
| `medical-center.svg` | Medical center upgrades |
| `nutrition.svg` | Nutrition programs and healthy meals |
| `recovery.svg` | Recovery and rehabilitation |
| `practice-fields.svg` | Practice fields and playing surfaces |
| `locker-room.svg` | Locker room and player storage |
| `player-amenities.svg` | Player lounges and amenities |
| `scouting.svg` | Scouting facilities and evaluation |
| `facility-technology.svg` | Facility technology and equipment |
| `team-offices.svg` | Administrative and team offices |
| `training-staff.svg` | Training staff quality |
| `treatment-room.svg` | Training room and treatment tables |
| `hydrotherapy.svg` | Recovery pools and hydrotherapy |
| `sleep-rest.svg` | Rest and sleep amenities |
| `player-development.svg` | Player development impact |
| `free-agent-appeal.svg` | Free-agent appeal and desirability |
| `equipment.svg` | Equipment storage and operations |
| `team-travel.svg` | Team travel quality |

### Business & Revenue (18)

| File | Suggested use |
| --- | --- |
| `franchise-value.svg` | Franchise valuation |
| `annual-revenue.svg` | Annual revenue and revenue breakdown |
| `operating-income.svg` | Operating income and profitability |
| `available-capital.svg` | Available capital and spending balance |
| `budget.svg` | Budgets and financial planning |
| `partnerships.svg` | Partnerships and business deals |
| `sponsorship.svg` | Sponsor placements and sponsorship offers |
| `naming-rights.svg` | Venue naming-rights offers |
| `contract.svg` | Contracts and signed agreements |
| `negotiation.svg` | Negotiating offers |
| `merchandise.svg` | Merchandise sales and apparel |
| `ticket-revenue.svg` | Ticket sales and pricing |
| `pricing.svg` | Prices, discounts, and affordability |
| `business-opportunity.svg` | New business opportunities and initiatives |
| `investment.svg` | Capital and facility investments |
| `financial-report.svg` | Financial updates and reports |
| `owners-desk.svg` | Owner action queue and decisions |
| `approval.svg` | Approve projects and offers |

### Fans & Community (14)

| File | Suggested use |
| --- | --- |
| `fans.svg` | Fans and market overview |
| `fan-experience.svg` | Fan experience and approval |
| `attendance.svg` | Attendance and capacity utilization |
| `fan-sentiment.svg` | Fan sentiment and survey results |
| `season-ticket-renewal.svg` | Season-ticket renewal and retention |
| `community.svg` | Community programs and local impact |
| `community-investment.svg` | Community investment and giving |
| `families.svg` | Treatment of families and family amenities |
| `digital-social.svg` | Digital and social engagement |
| `fan-feedback.svg` | Feedback and fan comments |
| `fan-insights.svg` | Key fan insights and research |
| `featured-initiative.svg` | Featured initiatives and campaigns |
| `market.svg` | Market reach and fan geography |
| `loyalty.svg` | Fan loyalty and retention |

### Report Card & Legacy (10)

| File | Suggested use |
| --- | --- |
| `report-card.svg` | Overall grade and category report card |
| `league-rank.svg` | League rank and comparison |
| `trend.svg` | Grade trends and value growth |
| `key-issues.svg` | Key issues and improvement priorities |
| `legacy.svg` | Ownership history and lasting legacy |
| `owner-tenure.svg` | Owner tenure and seasons served |
| `championships.svg` | Championships and trophies |
| `playoff-appearances.svg` | Playoff appearances and honors |
| `win-loss-history.svg` | Win-loss record and season history |
| `milestones.svg` | Major decisions, completed projects, and milestones |
