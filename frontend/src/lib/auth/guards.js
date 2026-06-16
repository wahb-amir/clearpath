import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

/**
 * Use this in any Server Component or Layout to require authentication.
 *
 * Usage:
 *   const session = await requireSession();
 *   // session.userId is now guaranteed to be defined
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

/**
 * Returns the current session or null — does not redirect.
 * Use this in components that render differently for logged-in vs. guest users.
 */
export async function optionalSession() {
  return await getSession();
}
