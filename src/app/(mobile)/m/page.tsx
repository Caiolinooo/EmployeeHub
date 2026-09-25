import { Suspense } from 'react';
import MobileHome from '@/components/mobile/MobileHome';

export default function MobileHomePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh abz-m-bg" />}>
      <MobileHome />
    </Suspense>
  );
}
