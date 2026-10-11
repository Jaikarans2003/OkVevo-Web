import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { readAdminSessionCookie } from '@/lib/firebase-admin';

import AdminDramaClient from './AdminDramaClient';

export const dynamic = 'force-dynamic';

export default async function AdminDramaPage() {
  const token = (await cookies()).get('__session')?.value;
  if (!token) notFound();
  if ((await readAdminSessionCookie(token)) !== 'admin') notFound();
  return <AdminDramaClient />;
}
