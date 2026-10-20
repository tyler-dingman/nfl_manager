import { generateKeyPair, exportJWK, SignJWT } from 'jose';
export async function firebaseFixture() {
  const project = 'synthetic-render-staging',
    pair = await generateKeyPair('RS256'),
    jwk = { ...(await exportJWK(pair.publicKey)), kid: 'local-render-fixture', alg: 'RS256' },
    now = Math.floor(Date.now() / 1000);
  const users = new Map<
      string,
      {
        uid: string;
        email: string;
        password: string;
        displayName?: string;
        validSince: number;
        deleted?: boolean;
      }
    >(),
    refresh = new Map<string, string>(),
    issued = new Map<string, string>();
  let count = 0,
    keyFetches = 0,
    lookups = 0;
  const configuration = {
    apiKey: 'synthetic-render-browser-key',
    projectId: project,
    authDomain: project + '.firebaseapp.com',
    appId: '1:1:web:fixture',
  };
  async function identity(uid: string) {
    const user = users.get(uid)!;
    const token = await new SignJWT({
      auth_time: now,
      email: user.email,
      email_verified: true,
      name: user.displayName,
    })
      .setSubject(uid)
      .setAudience(project)
      .setIssuer('https://securetoken.google.com/' + project)
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
      .sign(pair.privateKey);
    issued.set(token, uid);
    return token;
  }
  async function result(uid: string) {
    const u = users.get(uid)!,
      r = 'synthetic-refresh-' + crypto.randomUUID();
    refresh.set(r, uid);
    return {
      localId: uid,
      email: u.email,
      displayName: u.displayName,
      idToken: await identity(uid),
      refreshToken: r,
      expiresIn: '3600',
      registered: true,
    };
  }
  function error(message: string) {
    return Response.json({ error: { code: 400, message } }, { status: 400 });
  }
  async function respond(urlText: string, bodyText = '') {
    const url = new URL(urlText);
    if (url.origin === 'https://www.googleapis.com' && url.pathname.includes('/jwk/securetoken@')) {
      keyFetches++;
      return Response.json({ keys: [jwk] });
    }
    if (url.origin === 'https://securetoken.googleapis.com') {
      const uid = refresh.get(new URLSearchParams(bodyText).get('refresh_token') ?? '');
      if (!uid || users.get(uid)?.deleted) return error('INVALID_REFRESH_TOKEN');
      const r = await result(uid);
      return Response.json({
        access_token: r.idToken,
        id_token: r.idToken,
        refresh_token: r.refreshToken,
        expires_in: r.expiresIn,
        token_type: 'Bearer',
        user_id: uid,
        project_id: project,
      });
    }
    if (url.origin !== 'https://identitytoolkit.googleapis.com') return null;
    if (url.pathname.includes('recaptchaConfig'))
      return Response.json({ recaptchaEnforcementState: [] });
    const body = JSON.parse(bodyText || '{}'),
      operation = url.pathname.split(':').at(-1);
    if (operation === 'signUp') {
      if ([...users.values()].some((u) => u.email === body.email && !u.deleted))
        return error('EMAIL_EXISTS');
      const uid = 'synthetic-user-' + ++count;
      users.set(uid, { uid, email: body.email, password: body.password, validSince: now - 60 });
      return Response.json(await result(uid));
    }
    if (operation === 'signInWithPassword') {
      const u = [...users.values()].find(
        (u) => u.email === body.email && u.password === body.password && !u.deleted,
      );
      return u ? Response.json(await result(u.uid)) : error('INVALID_LOGIN_CREDENTIALS');
    }
    const uid = issued.get(body.idToken),
      user = users.get(uid ?? '');
    if (!uid || !user || user.deleted) return error('INVALID_ID_TOKEN');
    if (operation === 'lookup') {
      lookups++;
      return Response.json({
        users: [
          {
            localId: uid,
            email: user.email,
            displayName: user.displayName,
            validSince: String(user.validSince),
            emailVerified: true,
          },
        ],
      });
    }
    if (operation === 'update') {
      user.displayName = body.displayName ?? user.displayName;
      return Response.json({ ...(await result(uid)), providerUserInfo: [] });
    }
    if (operation === 'delete') {
      user.deleted = true;
      return Response.json({});
    }
    return error('UNSUPPORTED_FIXTURE_OPERATION');
  }
  return {
    configuration,
    respond,
    users,
    issued,
    identity,
    get keyFetches() {
      return keyFetches;
    },
    get lookups() {
      return lookups;
    },
  };
}
