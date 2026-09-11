'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminESocialRevisaoRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/department/e-social/revisao');
  }, [router]);

  return null;
}
