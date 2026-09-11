'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminESocialRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/department/e-social');
  }, [router]);

  return null;
}
