const RENEGOTIATE_ACCEPT_QUOTES = [
  'Thank you for continuing to believe in me. I won’t let you down.',
  'Let’s run it back. I’m locked in.',
  'That’s the respect I was looking for. I’m in.',
  'I want to finish what we started here.',
  'We’re aligned. Let’s get to work.',
  'I’m all in on this team. Appreciate the faith.',
  'That’s a fair deal. I’m ready.',
  'I like the commitment — I’m staying.',
  'Let’s chase something special together.',
  'I’m in. Time to win.',
  'That’s a strong offer. Let’s make it happen.',
  'I’m good with this. Let’s go.',
];

const RENEGOTIATE_DECLINE_QUOTES = [
  'Take that contract and shove it. I’m requesting to be released.',
  'My agent says we’re not even close.',
  'I’m insulted by this offer.',
  'That’s a non-starter for me.',
  'You’ll need to do much better than that.',
  'That number doesn’t respect my value.',
  'I’m not taking a step back. Pass.',
  'If that’s the offer, we’re done here.',
  'This doesn’t move the needle. No.',
  'I won’t accept those terms.',
  'That’s not a serious proposal.',
  'We’re too far apart on value.',
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getRenegotiateQuote = (accepted: boolean, seed: string) => {
  const pool = accepted ? RENEGOTIATE_ACCEPT_QUOTES : RENEGOTIATE_DECLINE_QUOTES;
  const index = hashString(seed) % pool.length;
  return pool[index] ?? pool[0];
};

export { RENEGOTIATE_ACCEPT_QUOTES, RENEGOTIATE_DECLINE_QUOTES };
