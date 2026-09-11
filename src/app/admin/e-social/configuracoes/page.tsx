'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminESocialConfiguracoesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/department/e-social/configuracoes');
  }, [router]);

  return null;
}
