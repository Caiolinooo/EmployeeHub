'use client';

/**
 * ContasBancariasCards (§7.1): contas da empresa com banco/agência/conta/titular.
 */
import React, { useEffect, useState } from 'react';
import { FiCreditCard } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { listContasBancarias } from '@/lib/financeiro/api-client';
import type { FinContaBancaria } from '@/types/financeiro';
import { FIN_CARD_CLASS, mensagemErro } from '@/components/financeiro/shared';

export default function ContasBancariasCards() {
  const { t } = useI18n();
  const [contas, setContas] = useState<FinContaBancaria[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    listContasBancarias()
      .then((lista) => {
        if (vivo) setContas(lista);
      })
      .catch((e) => {
        toast.error(mensagemErro(e, t('financeiro.erroGeral')));
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [t]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('financeiro.contas')}</h3>
      {carregando && <p className="text-sm text-gray-400">{t('financeiro.carregando')}</p>}
      {!carregando && contas.length === 0 && <p className="text-sm text-gray-400">—</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {contas.map((conta) => (
          <div key={conta.id} className={`${FIN_CARD_CLASS} flex items-start gap-3 p-4`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abz-light-blue text-abz-blue">
              <FiCreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                {conta.banco_nome || conta.banco_codigo}
              </p>
              <p className="text-xs text-gray-500">
                {t('financeiro.cfgAgencia')} {conta.agencia ?? '—'} · {t('financeiro.cfgConta')} {conta.conta ?? '—'}
                {conta.digito ? `-${conta.digito}` : ''}
              </p>
              <p className="truncate text-xs text-gray-400">{conta.titular_nome}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
