import type { ReactNode } from 'react';
import UiSurfaceSwitch from '@/components/mobile/UiSurfaceSwitch';

/** Wrapper do login desktop. Sem cookie `ui=desktop` o switch é null. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <UiSurfaceSwitch />
    </>
  );
}
