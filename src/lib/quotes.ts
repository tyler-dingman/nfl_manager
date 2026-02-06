const ACCEPT_QUOTES = {
  QB: [
    'Let’s finish what we started in {teamName}. I’m locked in.',
    '{teamName} believed in me—now it’s time to deliver.',
    'I wanted stability, and {teamName} is where I can win.',
    'Same huddle. Same mission. I’m back.',
    'I’m ready to lead this locker room again. Let’s go.',
  ],
  RB: [
    'I’m staying put—this backfield is home.',
    'I love this system. I’m ready to keep running for {teamName}.',
    'One more grind with these guys? Say less.',
    'The work isn’t finished here. I’m back.',
    'I’m here to earn every yard. Let’s do it.',
  ],
  WR: [
    'I can’t wait to make plays for {teamName} again.',
    'I’m staying—this offense still has another level.',
    'The fans deserve more highlights. I’m back.',
    'Chemistry matters. I’m not walking away from it.',
    'Let’s keep stacking wins and touchdowns.',
  ],
  TE: [
    'I love this locker room. I’m staying with {teamName}.',
    'I’m here to move chains and win games—let’s run it back.',
    'This is the right fit. I’m back.',
    'I’m staying. Now let’s get to work.',
    'I want rings, and this is the place to chase them.',
  ],
  OL: [
    'Protecting my QB here just feels right. I’m back.',
    'This line is family. I’m not leaving.',
    'Same trenches, same fight—let’s go.',
    'I wanted to stay where the work is respected. {teamName} is it.',
    'I’m ready to keep building something special up front.',
  ],
  DL: [
    'I’m staying—time to hunt.',
    'This defense has unfinished business. I’m back.',
    'I like what we’re building. Let’s keep it rolling.',
    'I’m here to wreck pockets and win games.',
    '{teamName} feels like the right place to keep grinding.',
  ],
  EDGE: [
    'I’m back. Quarterbacks should be nervous.',
    'I’m staying—let’s keep closing games.',
    'This scheme lets me eat. I’m not leaving.',
    'I want to win here. Let’s go get it.',
    'Same city, same mission—more sacks.',
  ],
  LB: [
    'I’m staying. I love leading this defense.',
    'I’m back—time to set the tone.',
    'The culture here matters. I’m not leaving.',
    'I’m ready to fly around and make plays again.',
    '{teamName} is home. Let’s get after it.',
  ],
  CB: [
    'I’m staying—lockdown season starts now.',
    'I like the challenge here. I’m back.',
    'I’m ready to compete every snap for {teamName}.',
    'This secondary can be special. I’m in.',
    'Same colors, same confidence—let’s go.',
  ],
  S: [
    'I’m staying—time to patrol the back end.',
    'I love how we play defense here. I’m back.',
    'Communication, chemistry—can’t replace it. I’m staying.',
    'I’m ready to set the tone on Sundays.',
    'This is where I want to win. Let’s do it.',
  ],
  KP: [
    'I’m staying. Consistency wins games.',
    'I’m back—time to put points on the board.',
    'I like it here. Let’s keep stacking makes.',
    'Same spot, same work—let’s go.',
    '{teamName} is where I want to kick.',
  ],
};

const DECLINE_QUOTES = {
  QB: [
    'I respect it, but I’m looking for a situation that fits my goals.',
    'My agent thinks the market will be stronger than this.',
    'I’m going to explore other options—nothing personal.',
    'I need a deal that matches my value. This isn’t quite it.',
    'I appreciate the offer, but I’m not ready to commit on these terms.',
  ],
  RB: [
    'I appreciate it, but I’m chasing the best opportunity.',
    'I’m going to test free agency and see what’s out there.',
    'The terms aren’t quite where I need them to be.',
    'I need more security than this offer provides.',
    'It’s close, but not enough for me to sign.',
  ],
  WR: [
    'I respect the offer, but I believe I can get more on the market.',
    'I’m looking for a bigger commitment.',
    'My agent is telling me to wait—so I am.',
    'I need the deal to reflect my production.',
    'I appreciate the interest, but I’m going to move on.',
  ],
  TE: [
    'I like it here, but the numbers don’t work for me.',
    'I’m going to explore options before I decide.',
    'I need a longer commitment than this.',
    'I’m betting there’s a better fit out there.',
    'I appreciate it, but I’m passing.',
  ],
  OL: [
    'I need more respect in the value to sign.',
    'I’m looking for more guaranteed money.',
    'I’m going to see what the market says.',
    'The years aren’t lining up with what I want.',
    'I appreciate it, but I’m not taking this deal.',
  ],
  DL: [
    'I’m going to see what other offers come in.',
    'I need a deal closer to my market value.',
    'The guaranteed isn’t where it needs to be.',
    'I’m looking for a better situation and terms.',
    'I appreciate it, but I’m out.',
  ],
  EDGE: [
    'I’m looking for a bigger commitment.',
    'My agent says I can do better—so we’re waiting.',
    'The value isn’t there for me right now.',
    'I need more guaranteed to lock this in.',
    'Respectfully, I’m going to test the market.',
  ],
  LB: [
    'I appreciate it, but I need a better package.',
    'I’m going to see what’s out there before signing.',
    'The years and security aren’t right for me.',
    'I want a deal that reflects my role and impact.',
    'Thanks, but no—I’m moving on.',
  ],
  CB: [
    'The market for corners is different. I’m going to test it.',
    'I need more guaranteed to sign.',
    'I’m looking for a better long-term deal.',
    'I respect it, but it’s not enough.',
    'My agent says hold—so I’m holding.',
  ],
  S: [
    'I appreciate it, but I need better terms.',
    'I’m going to explore free agency.',
    'The value doesn’t match what I’m looking for.',
    'I need more security.',
    'It’s close, but I’m passing.',
  ],
  KP: [
    'I appreciate it, but I’m going to see what else is out there.',
    'The terms aren’t quite right for me.',
    'I’m looking for a better fit and value.',
    'I need more security.',
    'Thanks, but I’m not signing this.',
  ],
};

const replaceVars = (value: string, vars: Record<string, string>) =>
  value.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');

const positionGroupMap: Record<string, keyof typeof ACCEPT_QUOTES> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  OT: 'OL',
  OG: 'OL',
  IOL: 'OL',
  OL: 'OL',
  DL: 'DL',
  DT: 'DL',
  EDGE: 'EDGE',
  LB: 'LB',
  CB: 'CB',
  S: 'S',
  K: 'KP',
  P: 'KP',
};

const getGroup = (position: string): keyof typeof ACCEPT_QUOTES =>
  positionGroupMap[position] ?? 'LB';

export const getReSignQuote = ({
  accepted,
  position,
  teamName,
}: {
  accepted: boolean;
  position: string;
  teamName: string;
}): string => {
  const group = getGroup(position);
  const pool = accepted ? ACCEPT_QUOTES[group] : DECLINE_QUOTES[group];
  const quote = pool[Math.floor(Math.random() * pool.length)] ?? '';

  return replaceVars(quote, {
    teamName,
  });
};
