'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminESocialCertificadosRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/department/e-social/certificados');
  }, [router]);

  return null;
}
