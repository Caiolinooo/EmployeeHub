import { Suspense } from 'react';
import MobileLoginForm from '@/components/mobile/MobileLoginForm';

export default function MobileLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f3f6fb]" />}>
      <MobileLoginForm />
    </Suspense>
  );
}
