import MobileSurfaceMarker from '@/components/mobile/MobileSurfaceMarker';
import { MOBILE_SURFACE_CSS } from '@/components/mobile/mobile-styles';

export default function MobileRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-abz-ui="mobile" className="min-h-dvh abz-m-bg">
      <style dangerouslySetInnerHTML={{ __html: MOBILE_SURFACE_CSS }} />
      <MobileSurfaceMarker />
      {children}
    </div>
  );
}
