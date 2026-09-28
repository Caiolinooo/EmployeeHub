'use client';

import React from 'react';
import { FiBookOpen, FiDownload, FiExternalLink, FiPlay, FiSmartphone } from 'react-icons/fi';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

// Links externos idênticos à página desktop /ponto (o registro de ponto é
// feito no sistema Ahgora externo — não há API de ponto no painel).
const EXTERNAL_URL = 'https://www.ahgora.com.br/novabatidaonline/';
const MANUAL_URL = '/documentos/Manual de Uso Ponto Ahgora.pdf';

const MYAHGORA_GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=br.com.ahgora.myahgora';
const MYAHGORA_APP_STORE = 'https://apps.apple.com/br/app/my-ahgora/id1502293191';
const AHGORA_MULTI_GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=br.com.ahgora.ahgoramulti';
const AHGORA_MULTI_APP_STORE = 'https://apps.apple.com/us/app/ahgora-multi/id1436645391';

function StoreButtons({ appStore, googlePlay }: { appStore?: string; googlePlay: string }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {appStore ? (
        <TouchButton asChild variant="ghost" className="w-full justify-center">
          <a href={appStore} target="_blank" rel="noopener noreferrer">
            <FiSmartphone aria-hidden className="mr-2 h-4 w-4" />
            App Store
          </a>
        </TouchButton>
      ) : null}
      <TouchButton asChild variant="ghost" className="w-full justify-center">
        <a href={googlePlay} target="_blank" rel="noopener noreferrer">
          <FiPlay aria-hidden className="mr-2 h-4 w-4" />
          Google Play
        </a>
      </TouchButton>
    </div>
  );
}

export default function MobilePonto() {
  return (
    <MobileShell title="Ponto">
      <div className="flex flex-col gap-3" data-abz-mobile-ponto="">
        <DataCard title="Bem-vindo ao Batida Online">
          <p className="mt-2 text-sm text-gray-600">
            O Batida Online é a plataforma utilizada pela ABZ Group para o registro de ponto dos
            colaboradores, automatizando processos e facilitando o dia a dia.
          </p>
        </DataCard>

        <TouchButton asChild className="w-full justify-center" data-abz-mobile-ponto-batida="">
          <a href={EXTERNAL_URL} target="_blank" rel="noopener noreferrer">
            <FiExternalLink aria-hidden className="mr-2 h-5 w-5" />
            Acessar Batida Online
          </a>
        </TouchButton>

        <DataCard title="Ahgora Multi" subtitle="Aplicativo de registro de ponto">
          <p className="mt-2 text-sm text-gray-600">
            Chave de ativação: informada pelo DP/RH no primeiro acesso.
          </p>
          <StoreButtons appStore={AHGORA_MULTI_APP_STORE} googlePlay={AHGORA_MULTI_GOOGLE_PLAY} />
        </DataCard>

        <DataCard title="MyAhgora" subtitle="Aplicativo do colaborador">
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Código da empresa:</span> 4811
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Senha de cadastro:</span> informada pelo DP/RH no primeiro
            acesso.
          </p>
          <StoreButtons appStore={MYAHGORA_APP_STORE} googlePlay={MYAHGORA_GOOGLE_PLAY} />
        </DataCard>

        <DataCard title="Recursos adicionais" subtitle="Manual de uso do ponto">
          <p className="mt-2 text-sm text-gray-600">
            Consulte o manual completo do sistema Ahgora para dúvidas sobre o registro de ponto.
          </p>
          <TouchButton asChild variant="ghost" className="mt-3 w-full justify-center">
            <a
              href={MANUAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              download="Manual de Uso Ponto Ahgora.pdf"
            >
              <FiBookOpen aria-hidden className="mr-2 h-4 w-4" />
              <FiDownload aria-hidden className="mr-1 h-4 w-4" />
              Baixar manual (PDF)
            </a>
          </TouchButton>
        </DataCard>
      </div>
    </MobileShell>
  );
}
