import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import DataCard from '@/components/mobile/DataCard';
import MobileShell from '@/components/mobile/MobileShell';

function PreviewBody() {
  return (
    <MobileShell title="Kit mobile (dev)">
      <div className="flex flex-col gap-3" data-abz-mobile-preview="">
        <p className="text-sm text-gray-600">
          Vitrine de componentes. Fora de produção.
        </p>
        <DataCard title="DataCard" subtitle="Exemplo de lista" meta="dev" />
      </div>
    </MobileShell>
  );
}

export default function MobilePreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return (
    <Suspense fallback={<div className="min-h-dvh abz-m-bg" />}>
      <PreviewBody />
    </Suspense>
  );
}
