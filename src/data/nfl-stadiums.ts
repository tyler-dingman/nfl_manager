export type RoofType = 'OPEN_AIR' | 'FIXED_DOME' | 'RETRACTABLE' | 'UNKNOWN';
export type Stadium = {
  team: string;
  stadium: string;
  city: string;
  state: string;
  timezone: string;
  roofType: RoofType;
};

export const NFL_STADIUMS: Record<string, Stadium> = Object.fromEntries(
  [
    ['ARI', 'State Farm Stadium', 'Glendale', 'AZ', 'America/Phoenix', 'RETRACTABLE'],
    ['ATL', 'Mercedes-Benz Stadium', 'Atlanta', 'GA', 'America/New_York', 'RETRACTABLE'],
    ['BAL', 'M&T Bank Stadium', 'Baltimore', 'MD', 'America/New_York', 'OPEN_AIR'],
    ['BUF', 'Highmark Stadium', 'Orchard Park', 'NY', 'America/New_York', 'OPEN_AIR'],
    ['CAR', 'Bank of America Stadium', 'Charlotte', 'NC', 'America/New_York', 'OPEN_AIR'],
    ['CHI', 'Soldier Field', 'Chicago', 'IL', 'America/Chicago', 'OPEN_AIR'],
    ['CIN', 'Paycor Stadium', 'Cincinnati', 'OH', 'America/New_York', 'OPEN_AIR'],
    ['CLE', 'Huntington Bank Field', 'Cleveland', 'OH', 'America/New_York', 'OPEN_AIR'],
    ['DAL', 'AT&T Stadium', 'Arlington', 'TX', 'America/Chicago', 'RETRACTABLE'],
    ['DEN', 'Empower Field at Mile High', 'Denver', 'CO', 'America/Denver', 'OPEN_AIR'],
    ['DET', 'Ford Field', 'Detroit', 'MI', 'America/New_York', 'FIXED_DOME'],
    ['GB', 'Lambeau Field', 'Green Bay', 'WI', 'America/Chicago', 'OPEN_AIR'],
    ['HOU', 'NRG Stadium', 'Houston', 'TX', 'America/Chicago', 'RETRACTABLE'],
    ['IND', 'Lucas Oil Stadium', 'Indianapolis', 'IN', 'America/New_York', 'RETRACTABLE'],
    ['JAX', 'EverBank Stadium', 'Jacksonville', 'FL', 'America/New_York', 'OPEN_AIR'],
    ['KC', 'GEHA Field at Arrowhead Stadium', 'Kansas City', 'MO', 'America/Chicago', 'OPEN_AIR'],
    ['LV', 'Allegiant Stadium', 'Las Vegas', 'NV', 'America/Los_Angeles', 'FIXED_DOME'],
    ['LAC', 'SoFi Stadium', 'Inglewood', 'CA', 'America/Los_Angeles', 'FIXED_DOME'],
    ['LAR', 'SoFi Stadium', 'Inglewood', 'CA', 'America/Los_Angeles', 'FIXED_DOME'],
    ['MIA', 'Hard Rock Stadium', 'Miami Gardens', 'FL', 'America/New_York', 'OPEN_AIR'],
    ['MIN', 'U.S. Bank Stadium', 'Minneapolis', 'MN', 'America/Chicago', 'FIXED_DOME'],
    ['NE', 'Gillette Stadium', 'Foxborough', 'MA', 'America/New_York', 'OPEN_AIR'],
    ['NO', 'Caesars Superdome', 'New Orleans', 'LA', 'America/Chicago', 'FIXED_DOME'],
    ['NYG', 'MetLife Stadium', 'East Rutherford', 'NJ', 'America/New_York', 'OPEN_AIR'],
    ['NYJ', 'MetLife Stadium', 'East Rutherford', 'NJ', 'America/New_York', 'OPEN_AIR'],
    ['PHI', 'Lincoln Financial Field', 'Philadelphia', 'PA', 'America/New_York', 'OPEN_AIR'],
    ['PIT', 'Acrisure Stadium', 'Pittsburgh', 'PA', 'America/New_York', 'OPEN_AIR'],
    ['SEA', 'Lumen Field', 'Seattle', 'WA', 'America/Los_Angeles', 'OPEN_AIR'],
    ['SF', "Levi's Stadium", 'Santa Clara', 'CA', 'America/Los_Angeles', 'OPEN_AIR'],
    ['TB', 'Raymond James Stadium', 'Tampa', 'FL', 'America/New_York', 'OPEN_AIR'],
    ['TEN', 'Nissan Stadium', 'Nashville', 'TN', 'America/Chicago', 'OPEN_AIR'],
    ['WAS', 'Northwest Stadium', 'Landover', 'MD', 'America/New_York', 'OPEN_AIR'],
  ].map(([team, stadium, city, state, timezone, roofType]) => [
    team,
    { team, stadium, city, state, timezone, roofType } as Stadium,
  ]),
);
