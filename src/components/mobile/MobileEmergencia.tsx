'use client';

import React from 'react';
import { FiAlertTriangle, FiMail, FiPhone } from 'react-icons/fi';
import DataCard from './DataCard';
import MobileShell from './MobileShell';

type EmergencyChannel = {
  name: string;
  procedure: string;
  phone?: { label: string; tel: string; whatsapp?: string };
  email?: string;
};

// Mesmos canais da página desktop /emergencia (conteúdo estático, sem API).
// "procedure" reaproveita a descrição de cada canal usada em /contatos.
const CHANNELS: EmergencyChannel[] = [
  {
    name: 'Logística',
    procedure: 'Programação de escala, embarque, dobras, faltas e folga indenizada.',
    phone: { label: '(22) 99207-4346', tel: '+5522992074346', whatsapp: 'https://wa.me/5522992074346' },
    email: 'logistica@groupabz.com',
  },
  {
    name: 'Folha de Pagamento',
    procedure: 'Dúvidas sobre Folha de Pagamento.',
    phone: { label: '(22) 99912-4131', tel: '+5522999124131', whatsapp: 'https://wa.me/5522999124131' },
    email: 'rh@groupabz.com',
  },
  {
    name: 'Benefícios',
    procedure: 'Plano de saúde, VA, VR e demais benefícios.',
    phone: { label: '(22) 99208-1661', tel: '+5522992081661', whatsapp: 'https://wa.me/5522992081661' },
    email: 'rh@groupabz.com',
  },
  {
    name: 'Folha de Ponto',
    procedure: 'Registro de Folha de Ponto.',
    phone: { label: '(22) 99208-7337', tel: '+5522992087337', whatsapp: 'https://wa.me/5522992087337' },
    email: 'rh@groupabz.com',
  },
  {
    name: 'QHSE',
    procedure: 'EPI, registro de acidentes ou doenças ocupacionais.',
    phone: { label: '(22) 99949-4705', tel: '+5522999494705', whatsapp: 'https://wa.me/5522999494705' },
    email: 'sgi@groupabz.com',
  },
  {
    name: 'Ouvidoria',
    procedure: 'Denúncias, queixas, elogios ou sugestões.',
    email: 'ouvidoria@groupabz.com',
  },
];

const PUBLIC_PHONES = [
  { name: 'Bombeiros', number: '193' },
  { name: 'Polícia Militar', number: '190' },
  { name: 'SAMU', number: '192' },
];

export default function MobileEmergencia() {
  return (
    <MobileShell title="Emergência">
      <div className="flex flex-col gap-3" data-abz-mobile-emergencia="">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-red-800">
            <FiAlertTriangle aria-hidden className="h-5 w-5 text-red-600" />
            Emergência pública — toque para ligar
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PUBLIC_PHONES.map((p) => (
              <a
                key={p.number}
                href={`tel:${p.number}`}
                className="touch-target flex flex-col items-center justify-center rounded-xl bg-white px-2 py-3 text-center shadow-sm"
              >
                <span className="text-2xl font-bold text-red-600">{p.number}</span>
                <span className="text-xs font-medium text-red-800">{p.name}</span>
              </a>
            ))}
          </div>
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Canais de atendimento
        </h2>

        {CHANNELS.map((channel) => (
          <DataCard key={channel.name} title={channel.name} subtitle={channel.procedure}>
            <div className="mt-2 flex flex-col">
              {channel.phone ? (
                <>
                  <a
                    href={`tel:${channel.phone.tel}`}
                    className="touch-target inline-flex items-center gap-2 text-sm font-semibold text-green-700"
                  >
                    <FiPhone aria-hidden className="h-4 w-4" /> Ligar {channel.phone.label}
                  </a>
                  {channel.phone.whatsapp ? (
                    <a
                      href={channel.phone.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="touch-target inline-flex items-center gap-2 text-sm font-semibold text-green-700"
                    >
                      <FiPhone aria-hidden className="h-4 w-4" /> WhatsApp {channel.phone.label}
                    </a>
                  ) : null}
                </>
              ) : null}
              {channel.email ? (
                <a
                  href={`mailto:${channel.email}`}
                  className="touch-target inline-flex items-center gap-2 text-sm font-semibold text-[#005B96]"
                >
                  <FiMail aria-hidden className="h-4 w-4" /> {channel.email}
                </a>
              ) : null}
            </div>
          </DataCard>
        ))}
      </div>
    </MobileShell>
  );
}
