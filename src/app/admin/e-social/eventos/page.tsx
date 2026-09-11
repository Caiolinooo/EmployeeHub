'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminESocialEventosRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/department/e-social/eventos');
  }, [router]);

  return null;
}
