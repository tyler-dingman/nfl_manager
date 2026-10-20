/** Redirect checks never send credentials to another origin. Callers supply product
 * authentication state separately from the outer staging credential. */
export async function validatePage({ base, path, applicationAuthenticated, request, maxHops = 3 }) {
  const origin = new URL(base).origin,
    seen = new Set(),
    chain = [];
  let url = new URL(path, base);
  for (let hops = 0; hops <= maxHops; hops++) {
    if (url.origin !== origin) throw Error('Untrusted redirect origin');
    if (seen.has(url.href)) throw Error('Redirect loop');
    seen.add(url.href);
    const response = await request(url.href),
      status = response.status;
    chain.push({ path: url.pathname + url.search, status });
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.get('location');
      if (!location) throw Error('Redirect missing Location');
      const next = new URL(location, url);
      if (next.origin !== origin || next.username || next.password)
        throw Error('Untrusted redirect origin');
      if (applicationAuthenticated) throw Error('Unexpected redirect for authenticated page');
      if (next.pathname !== '/login' || next.searchParams.get('next') !== path)
        throw Error('Unexpected authentication redirect');
      if (url.pathname === '/login') throw Error('Redirect loop');
      url = next;
      continue;
    }
    if (status === 401 || status === 403) throw Error('Authorized staging request denied');
    if (status !== 200) throw Error('Page returned ' + status);
    if (!applicationAuthenticated && url.pathname !== '/login')
      throw Error('Signed-out protected page did not require login');
    if (!response.headers.get('content-type')?.includes('text/html'))
      throw Error('Page did not return HTML');
    const body = await response.text();
    if (!/<html[\s>]/i.test(body)) throw Error('Page body is not HTML');
    if (
      !applicationAuthenticated &&
      !/password|sign.in|log.in|\/app\/login\/page-[a-z0-9]+\.js/i.test(body)
    )
      throw Error('Login page payload missing');
    return {
      chain,
      applicationAuthenticated,
      finalPath: url.pathname,
      htmlBytes: Buffer.byteLength(body),
    };
  }
  throw Error('Too many redirects');
}
