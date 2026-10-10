import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { readAdminSession } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export default async function AdminDramaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get('__session')?.value;
  if (token) {
    const session = await readAdminSession(token);
    if (session === 'user') notFound();
  }
  return children;
}
