import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { readAdminSessionCookie } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export default async function AdminDramaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get('__session')?.value;
  if (!token) notFound();
  if ((await readAdminSessionCookie(token)) !== 'admin') notFound();
  return children;
}
