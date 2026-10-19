import { D1AuthRepository } from '../../../packages/storage/auth';
import { MailQueue } from '../../../packages/storage/mail';
import { digest, utf8 } from '../../../packages/storage/core';
import { applicationEnvironment, applicationStorage } from '../persistence/bindings';
export async function stageAuthToken(
  repo: D1AuthRepository,
  userId: string,
  email: string,
  type: string,
  token: string,
  minutes: number,
) {
  const env = applicationEnvironment();
  if (!env.AUTH_BASE_URL || !env.AUTH_JWT_SECRET || !env.APP_MAIL_ENCRYPTION_KEY)
    throw Error('Recovery mail configuration is incomplete');
  const url = new URL('/login', env.AUTH_BASE_URL);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    throw Error('Recovery links require HTTPS');
  url.searchParams.set(type === 'PASSWORD_RESET' ? 'resetToken' : 'verifyToken', token);
  const hash = await digest(utf8.encode(token)),
    mail = await new MailQueue(repo.s, env.APP_MAIL_ENCRYPTION_KEY).stage(
      userId,
      'TRANSACTIONAL',
      `${type}:${hash}`,
      {
        to: email,
        subject:
          type === 'PASSWORD_RESET'
            ? 'Reset your Down & Distance password'
            : 'Verify your Down & Distance email',
        text: `${type === 'PASSWORD_RESET' ? 'Reset your password' : 'Verify your email'}: ${url.href}`,
        expiresAt: Date.now() + minutes * 60000,
      },
    );
  return [...repo.tokenStatements(userId, type, hash, minutes), ...(mail ? [mail] : [])];
}
export async function createD1EmailSignup(
  input: { email: string; passwordHash: string; displayName?: string | null },
  token: string,
) {
  const repo = new D1AuthRepository(applicationStorage('D1_USERS')),
    plan = repo.emailUserPlan(input),
    mail = await stageAuthToken(repo, plan.id, input.email, 'EMAIL_VERIFICATION', token, 24 * 60);
  await repo.s.batch([...plan.statements, ...mail]);
  return (await repo.findUserById(plan.id))! as Parameters<
    typeof import('./postgres-repository').toPublicUser
  >[0];
}
