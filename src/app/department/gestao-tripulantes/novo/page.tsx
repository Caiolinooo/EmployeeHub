'use client';

import ColaboradorCadastroForm from '@/components/gestao-tripulantes/ColaboradorCadastroForm';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

export default function NovoColaboradorPage() {
  return (
    <GtPageShell>
      <div className={GT_PAGE_SCROLLPORT_CLASS}>
        <ColaboradorCadastroForm
          mode="create"
          returnTo="/department/gestao-tripulantes"
        />
      </div>
    </GtPageShell>
  );
}
