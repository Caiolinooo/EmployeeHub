import '@/components/mobile/mobile.css';
import MobileSurfaceMarker from '@/components/mobile/MobileSurfaceMarker';

export default function MobileRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-abz-ui="mobile" className="min-h-dvh bg-[var(--mobile-bg,#f3f6fb)]">
      <MobileSurfaceMarker />
      {children}
    </div>
  );
}
