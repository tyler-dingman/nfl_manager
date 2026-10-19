/** Tokenizer for lossless generated exports, including quoted semicolons and escaped quotes.
 * Generated schemas contain no triggers; arbitrary user SQL is not accepted by a public API. */
export function splitSql(script: string) {
  const statements: string[] = [];
  let start = 0,
    quote = '',
    line = false,
    block = false;
  for (let i = 0; i < script.length; i++) {
    const c = script[i],
      next = script[i + 1];
    if (line) {
      if (c === '\n') line = false;
      continue;
    }
    if (block) {
      if (c === '*' && next === '/') {
        block = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (c === quote) {
        if (next === quote) i++;
        else quote = '';
      }
      continue;
    }
    if (c === '-' && next === '-') {
      line = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      block = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === ';') {
      const s = script.slice(start, i).trim();
      if (/^CREATE\s+TRIGGER\b/i.test(s) && !/\bEND$/i.test(s)) continue;
      if (s.replace(/^--.*$/gm, '').trim()) statements.push(s);
      start = i + 1;
    }
  }
  if (quote || block) throw Error('Incomplete SQL export');
  const tail = script.slice(start).trim();
  if (tail.replace(/^--.*$/gm, '').trim()) statements.push(tail);
  return statements;
}
