import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { readAdminSession } from '@/lib/firebase-admin';

import AdminDramaClient from './AdminDramaClient';
import SignInIsland from './SignInIsland';

export const dynamic = 'force-dynamic';

export default async function AdminDramaPage() {
  const token = (await cookies()).get('__session')?.value;
  if (!token) return <SignInIsland />;
  const session = await readAdminSession(token);
  if (session !== 'admin') notFound();
  return <AdminDramaClient />;
}
