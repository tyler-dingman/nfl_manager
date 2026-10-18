/** Synthetic loopback RPC only. Never a deployable public SQL API. */
export default {
  async fetch(
    request: Request,
    env: {
      CONTENT_ENV: string;
      LOCAL_INGEST_TOKEN: string;
      EDITORIAL_DB: D1Database;
      EDITORIAL_ARCHIVE: R2Bucket;
    },
  ) {
    const url = new URL(request.url);
    if (
      env.CONTENT_ENV !== 'local' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      request.method !== 'POST' ||
      env.LOCAL_INGEST_TOKEN.length < 32 ||
      request.headers.get('authorization') !== `Bearer ${env.LOCAL_INGEST_TOKEN}`
    )
      return new Response('Forbidden', { status: 403 });
    if (Number(request.headers.get('content-length')) > 8_000_000)
      return new Response('Too large', { status: 413 });
    try {
      const reader=request.body?.getReader();if(!reader)throw Error('Missing body');
      const chunks:Uint8Array[]=[];let size=0;
      while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8_000_000){await reader.cancel();return new Response('Too large',{status:413});}chunks.push(part.value);}
      const bytesIn=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytesIn.set(chunk,offset);offset+=chunk.length;}
      const body = JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytesIn)) as any;
      if (body.op === 'sql') {
        if (!Array.isArray(body.statements) || body.statements.length > 50)
          throw Error('Batch limit');
        const result = await env.EDITORIAL_DB.batch(
          body.statements.map((s: any) => env.EDITORIAL_DB.prepare(s.sql).bind(...s.values)),
        );
        return Response.json(result);
      }
      if (!/^application\/v1\/[a-f0-9]{64}$/.test(body.key)) throw Error('Invalid application key');
      if (body.op === 'get') {
        const o = await env.EDITORIAL_ARCHIVE.get(body.key);
        return Response.json(o ? Array.from(new Uint8Array(await o.arrayBuffer())) : null);
      }
      if (body.op === 'put') {
        const bytes = new Uint8Array(body.bytes);
        if (bytes.length > 4_000_000) throw Error('Object limit');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(body.key!==`application/v1/${hash}`)throw Error('Immutable digest mismatch');
        const prior = await env.EDITORIAL_ARCHIVE.get(body.key);
        if (prior) {
          const a = new Uint8Array(await prior.arrayBuffer());
          if (a.length !== bytes.length || a.some((v, i) => v !== bytes[i]))
            throw Error('Immutable conflict');
        } else await env.EDITORIAL_ARCHIVE.put(body.key, bytes);
        return Response.json({ ok: true });
      }
      throw Error('Unsupported operation');
    } catch {
      return Response.json({ error: 'Local operation failed' }, { status: 409 });
    }
  },
};
