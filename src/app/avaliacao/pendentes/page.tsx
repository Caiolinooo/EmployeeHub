import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import PendentesClient from './PendentesClient';

export default async function PendentesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('abzToken')?.value || cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login?redirect=/avaliacao/pendentes');
  }

  const decoded = await verifyToken(token);
  if (!decoded || (decoded.role !== 'MANAGER' && decoded.role !== 'ADMIN')) {
    redirect('/avaliacao');
  }

  return <PendentesClient />;
}
