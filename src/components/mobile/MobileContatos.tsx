'use client';

import React, { useMemo, useState } from 'react';
import { FiInstagram, FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import DataCard from './DataCard';
import MobileShell from './MobileShell';

type DepartmentContact = {
  name: string;
  description: string;
  email?: string;
  phones?: { label: string; tel: string }[];
};

// Mesmos dados da página desktop /contatos (conteúdo estático, sem API)
const DEPARTMENTS: DepartmentContact[] = [
  {
    name: 'Logística',
    description: 'Programação de escala, embarque, dobras, faltas e folga indenizada',
    email: 'logistica@groupabz.com',
    phones: [{ label: '(22) 99207-4646', tel: '+5522992074646' }],
  },
  {
    name: 'Departamento Pessoal (Folha)',
    description: 'Dúvidas sobre Folha de Pagamento',
    email: 'rh@groupabz.com',
    phones: [
      { label: '(22) 99778-2348', tel: '+5522997782348' },
      { label: '(22) 99912-4131', tel: '+5522999124131' },
    ],
  },
  {
    name: 'Departamento Pessoal (Ponto)',
    description: 'Registro de Folha de Ponto',
    email: 'rh@groupabz.com',
    phones: [{ label: '(22) 99238-7332', tel: '+5522992387332' }],
  },
  {
    name: 'Departamento Pessoal (Benefícios)',
    description: 'Benefícios (Plano de saúde, VA, VR, entre outros)',
    email: 'rh@groupabz.com',
    phones: [{ label: '(22) 99208-1661', tel: '+5522992081661' }],
  },
  {
    name: 'QHSE (SGI)',
    description: 'EPI, registro de acidentes ou doenças ocupacionais',
    email: 'sgi@groupabz.com',
    phones: [{ label: '(22) 99949-4705', tel: '+5522999494705' }],
  },
  {
    name: 'Ouvidoria',
    description: 'Denúncias, queixas, elogios ou sugestões',
    email: 'ouvidoria@groupabz.com',
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function MobileContatos() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return DEPARTMENTS;
    return DEPARTMENTS.filter((d) =>
      normalize(
        [d.name, d.description, d.email ?? '', ...(d.phones ?? []).map((p) => p.label)].join(' '),
      ).includes(q),
    );
  }, [query]);

  return (
    <MobileShell title="Contatos">
      <div className="flex flex-col gap-3" data-abz-mobile-contatos="">
        <DataCard title="ABZ Group — Sede" subtitle="Segunda a Sexta: 8h às 18h">
          <p className="mt-2 flex items-start gap-2 text-sm text-gray-600">
            <FiMapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#005B96]" />
            <span>
              Edifício The Corporate
              <br />
              Av. Prefeito Aristeu Ferreira da Silva, 370
              <br />
              Granja dos Cavaleiros, Macaé - RJ, 27930-070
            </span>
          </p>
          <div className="mt-2 flex flex-col">
            <a
              href="mailto:contato@groupabz.com"
              className="touch-target inline-flex items-center gap-2 text-sm font-semibold text-[#005B96]"
            >
              <FiMail aria-hidden className="h-4 w-4" /> contato@groupabz.com
            </a>
            <a
              href="https://www.instagram.com/groupabz"
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center gap-2 text-sm font-semibold text-[#005B96]"
            >
              <FiInstagram aria-hidden className="h-4 w-4" /> @groupabz
            </a>
          </div>
        </DataCard>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Buscar contato
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Departamento, assunto, e-mail…"
            className="touch-target rounded-xl border border-gray-200 px-3 py-2 text-base"
            data-abz-mobile-contatos-search=""
          />
        </label>

        {filtered.map((dept) => (
          <DataCard key={dept.name} title={dept.name} subtitle={dept.description}>
            <div className="mt-2 flex flex-col">
              {(dept.phones ?? []).map((phone) => (
                <a
                  key={phone.tel}
                  href={`tel:${phone.tel}`}
                  className="touch-target inline-flex items-center gap-2 text-sm font-semibold text-green-700"
                >
                  <FiPhone aria-hidden className="h-4 w-4" /> {phone.label}
                </a>
              ))}
              {dept.email ? (
                <a
                  href={`mailto:${dept.email}`}
                  className="touch-target inline-flex items-center gap-2 text-sm font-semibold text-[#005B96]"
                >
                  <FiMail aria-hidden className="h-4 w-4" /> {dept.email}
                </a>
              ) : null}
            </div>
          </DataCard>
        ))}

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Nenhum contato encontrado para “{query}”.
          </p>
        ) : null}
      </div>
    </MobileShell>
  );
}
