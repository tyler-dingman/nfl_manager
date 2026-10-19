import { publicContentPath } from './public-content-policy';
/** An anonymous miss at the private preview gate may retry with the original
 * caller's credentials. That retry must never enter a shared cache. */
export async function publicContentWithPreviewFallback(
  path: string,
  anonymous: (path: string) => Promise<Response>,
  authenticated: (path: string) => Promise<Response>,
) {
  if (!publicContentPath(path)) throw Error('Unsupported public route');
  const response = await anonymous(path);
  return response.status === 401 || response.status === 403 ? authenticated(path) : response;
}
