import { Storage, utf8 } from './core';
const fields = ['summary', 'whatHappened', 'whyItMatters', 'whatsNext', 'claims'];
export async function packCanonical(s: Storage, value: any, key: 'story' | 'synth') {
  const body: any = {},
    metadata = { ...value };
  for (const field of fields)
    if (Object.hasOwn(value, field)) {
      body[field] = value[field];
      delete metadata[field];
    }
  if (!s.objects.compactTrees || utf8.encode(JSON.stringify(body)).length <= 4096)
    return { schema: 1, [key]: value };
  return {
    schema: 2,
    kind: 'CANONICAL_PROSE',
    [key]: metadata,
    bodyHash: await s.put({ schema: 1, kind: 'CANONICAL_PROSE_BODY', body }),
  };
}
export async function expandCanonical(s: Storage, envelope: any, key: 'story' | 'synth') {
  if (envelope.schema === 1 && envelope[key]) return envelope[key];
  if (envelope.schema !== 2 || envelope.kind !== 'CANONICAL_PROSE' || !envelope[key])
    throw Error('Invalid canonical editorial envelope');
  const body = await s.get<any>(envelope.bodyHash);
  if (
    body.schema !== 1 ||
    body.kind !== 'CANONICAL_PROSE_BODY' ||
    !body.body ||
    Object.keys(body.body).some((k) => !fields.includes(k))
  )
    throw Error('Invalid canonical prose body');
  if (fields.some((k) => Object.hasOwn(envelope[key], k))) throw Error('Ambiguous canonical prose');
  return { ...envelope[key], ...body.body };
}
