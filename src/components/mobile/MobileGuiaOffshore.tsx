'use client';

import React, { useState } from 'react';
import DataCard from './DataCard';
import MobileShell from './MobileShell';

// Seções reais do guia (mesmas do desktop: GuiaOffshoreContent)
const SECTIONS = [
  {
    id: 'manual-embarque',
    title: 'Manual de Embarque',
    description:
      'Documentação, vacinas e preparativos antes de subir a bordo.',
  },
  {
    id: 'vida-a-bordo',
    title: 'Vida a Bordo',
    description:
      'Regras de convivência, horários e facilidades disponíveis nas unidades.',
  },
];

export default function MobileGuiaOffshore() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <MobileShell title="Guia Offshore">
      <div className="flex flex-col gap-3" data-abz-mobile-guia-offshore="">
        <p className="text-sm text-gray-600">
          Acesse o guia completo com todas as informações necessárias para sua
          rotina offshore, incluindo segurança, convivência e procedimentos de
          embarque.
        </p>

        {SECTIONS.map((section) => {
          const isOpen = expanded === section.id;
          return (
            <DataCard
              key={section.id}
              title={section.title}
              meta={isOpen ? 'Fechar' : 'Ver'}
              onClick={() => setExpanded(isOpen ? null : section.id)}
            >
              {isOpen ? (
                <p className="mt-2 text-sm text-gray-600">
                  {section.description}
                </p>
              ) : null}
            </DataCard>
          );
        })}
      </div>
    </MobileShell>
  );
}
