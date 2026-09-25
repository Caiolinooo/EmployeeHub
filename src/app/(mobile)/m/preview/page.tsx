import { Suspense } from 'react';
import DataCard from '@/components/mobile/DataCard';
import MobileShell from '@/components/mobile/MobileShell';

function PreviewBody() {
  return (
    <MobileShell title="Portal mobile">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          Shell P0 — nav híbrida (Home, Notícias, Férias, Mais). Rotas ainda não listadas caem no
          desktop.
        </p>
        <DataCard title="Pedido 1042" subtitle="Reembolso · pendente" meta="R$ 320" />
        <DataCard title="Maria Silva" subtitle="DP · embarcada" meta="ON" />
        <DataCard title="Escala Man" subtitle="Grade operacional" meta="swipe" />
      </div>
    </MobileShell>
  );
}

export default function MobilePreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f3f6fb]" />}>
      <PreviewBody />
    </Suspense>
  );
}
