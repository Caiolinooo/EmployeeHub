'use client';

/**
 * CobrancaModal (§7.1): conta + boleto/pix + vencimento → linha digitável/QR
 * copiáveis (POST /api/financeiro/cobrancas).
 */
import React, { useState } from 'react';
import { FiX, FiCopy, FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { createCobranca } from '@/lib/financeiro/api-client';
import type { FinCobranca, FinContaBancaria, FinFatura } from '@/types/financeiro';
import {
  FIN_BTN_PRIMARY_CLASS,
  FIN_BTN_SECONDARY_CLASS,
  FIN_INPUT_CLASS,
  copiarTexto,
  formatarMoeda,
  mensagemErro,
} from '@/components/financeiro/shared';

export default function CobrancaModal({
  fatura,
  contas,
  onClose,
  onGerada,
}: {
  fatura: FinFatura;
  contas: FinContaBancaria[];
  onClose: () => void;
  onGerada?: (cobranca: FinCobranca) => void;
}) {
  const { t } = useI18n();
  const [contaId, setContaId] = useState(contas[0]?.id ?? '');
  const [tipo, setTipo] = useState<'boleto' | 'pix'>(contas.length > 0 ? 'boleto' : 'boleto');
  const [vencimento, setVencimento] = useState(
    fatura.data_vencimento ? fatura.data_vencimento.slice(0, 10) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [valor, setValor] = useState(String(fatura.valor_total ?? ''));
  const [gerando, setGerando] = useState(false);
  const [gerada, setGerada] = useState<FinCobranca | null>(null);

  const temContas = contas.length > 0;

  async function gerar() {
    if (!contaId) {
      toast.error(t('financeiro.semContaBancaria'));
      return;
    }
    setGerando(true);
    try {
      const cobranca = await createCobranca({
        faturaId: fatura.id,
        contaBancariaId: contaId,
        tipo,
        vencimento: vencimento || undefined,
        valor: Number(valor) || undefined,
      });
      setGerada(cobranca);
      toast.success(t('financeiro.cobrancaCriada'));
      onGerada?.(cobranca);
    } catch (e) {
      toast.error(mensagemErro(e, t('financeiro.erroGeral')));
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-abz-blue to-abz-blue-dark px-6 py-4 text-white">
          <div>
            <h3 className="text-base font-bold">{t('financeiro.cobrar')}</h3>
            <p className="text-xs opacity-80">
              {t('financeiro.numero')} {fatura.numero}/{fatura.ano} · {formatarMoeda(fatura.valor_total, fatura.moeda)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={t('financeiro.fechar')}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {!temContas && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {t('financeiro.semContaBancaria')}
            </p>
          )}

          {!gerada && (
            <>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.contaBancaria')}</label>
                <select value={contaId} onChange={(e) => setContaId(e.target.value)} className={FIN_INPUT_CLASS} disabled={!temContas}>
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.banco_nome || conta.banco_codigo} · {conta.agencia}/{conta.conta} — {conta.titular_nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">{t('financeiro.tipoCobranca')}</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as 'boleto' | 'pix')} className={FIN_INPUT_CLASS}>
                    <option value="boleto">{t('financeiro.boleto')}</option>
                    <option value="pix">{t('financeiro.pix')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    {tipo === 'boleto' ? t('financeiro.vencimento') : t('financeiro.valor')}
                  </label>
                  {tipo === 'boleto' ? (
                    <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={FIN_INPUT_CLASS} />
                  ) : (
                    <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={FIN_INPUT_CLASS} />
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className={FIN_BTN_SECONDARY_CLASS}>
                  {t('financeiro.fechar')}
                </button>
                <button type="button" onClick={gerar} disabled={gerando || !temContas} className={FIN_BTN_PRIMARY_CLASS}>
                  <FiSend className="h-4 w-4" /> {t('financeiro.cobrar')}
                </button>
              </div>
            </>
          )}

          {gerada && (
            <div className="space-y-3">
              {gerada.linha_digitavel && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-bold uppercase text-gray-500">{t('financeiro.linhaDigitavel')}</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate text-sm text-gray-900">{gerada.linha_digitavel}</code>
                    <button
                      type="button"
                      onClick={() => copiarTexto(gerada.linha_digitavel!, t('financeiro.copiado'))}
                      className={FIN_BTN_SECONDARY_CLASS}
                    >
                      <FiCopy className="h-4 w-4" /> {t('financeiro.copiar')}
                    </button>
                  </div>
                </div>
              )}
              {gerada.qr_code_emv && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-bold uppercase text-gray-500">{t('financeiro.qrCodeCopiar')}</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate text-xs text-gray-900">{gerada.qr_code_emv}</code>
                    <button
                      type="button"
                      onClick={() => copiarTexto(gerada.qr_code_emv!, t('financeiro.copiado'))}
                      className={FIN_BTN_SECONDARY_CLASS}
                    >
                      <FiCopy className="h-4 w-4" /> {t('financeiro.copiar')}
                    </button>
                  </div>
                </div>
              )}
              {gerada.txid && (
                <p className="text-xs text-gray-500">
                  txid: <code className="text-gray-700">{gerada.txid}</code>
                </p>
              )}
              <div className="flex justify-end pt-2">
                <button type="button" onClick={onClose} className={FIN_BTN_PRIMARY_CLASS}>
                  {t('financeiro.fechar')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
