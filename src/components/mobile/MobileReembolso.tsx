'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import { validateCPF, validateCurrency, validatePixKey } from '@/lib/schema';
import {
  EXPENSE_TYPES,
  validateExpenseValue,
  validateTotalValue,
  validateExpenseDate,
  parseCurrencyValue,
  getTodayDateString,
} from '@/lib/reimbursementValidation';
import BottomSheet from './BottomSheet';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type Reimbursement = {
  id: string;
  protocolo?: string | null;
  tipo_reembolso?: string | null;
  tipoReembolso?: string | null;
  descricao?: string | null;
  valor_total?: number | null;
  valorTotal?: number | null;
  moeda?: string | null;
  status?: string | null;
  data?: string | null;
  created_at?: string | null;
};

const COST_CENTERS = [
  { value: 'abz', label: 'ABZ' },
  { value: 'luz_maritima', label: 'Luz Marítima' },
  { value: 'fms', label: 'FMS' },
  { value: 'msi', label: 'MSI' },
  { value: 'omega', label: 'Omega' },
  { value: 'constellation', label: 'Constellation' },
  { value: 'sentinel', label: 'Sentinel' },
  { value: 'ahk', label: 'AHK' },
];

const PIX_TYPES = [
  { value: 'cpf', label: 'CPF' },
  { value: 'email', label: 'Email' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  pago: 'Pago',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
};

function statusLabel(status?: string | null): string {
  if (!status) return 'Pendente';
  return STATUS_LABEL[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s === 'aprovado' || s === 'approved') return 'text-green-700';
  if (s === 'rejeitado' || s === 'rejected') return 'text-red-700';
  if (s === 'pago') return 'text-blue-700';
  return 'text-amber-700';
}

function typeLabel(value?: string | null): string {
  const found = EXPENSE_TYPES.find((t) => t.value === value);
  return found ? found.label : 'Reembolso';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR');
}

function formatMoney(item: Reimbursement): string {
  const value = item.valor_total ?? item.valorTotal;
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mesmo mapeamento departamento → centro de custo do formulário desktop
function costCenterFromDepartment(department?: string | null): string {
  const dep = (department || '').toLowerCase();
  if (dep.includes('luz') || dep.includes('maritima')) return 'luz_maritima';
  if (dep.includes('fms')) return 'fms';
  if (dep.includes('msi')) return 'msi';
  if (dep.includes('omega')) return 'omega';
  if (dep.includes('constellation')) return 'constellation';
  if (dep.includes('sentinel')) return 'sentinel';
  if (dep.includes('ahk')) return 'ahk';
  return 'abz';
}

const inputClass = 'touch-target rounded-xl border border-gray-200 px-3 py-2 text-base';
const labelClass = 'flex flex-col gap-1 text-sm font-medium text-gray-700';

export default function MobileReembolso() {
  const { user, profile, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [tipoReembolso, setTipoReembolso] = useState('alimentacao');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(getTodayDateString());
  const [descricao, setDescricao] = useState('');
  const [centroCusto, setCentroCusto] = useState('abz');
  const [metodoPagamento, setMetodoPagamento] = useState('deposito');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [pixTipo, setPixTipo] = useState('cpf');
  const [pixChave, setPixChave] = useState('');
  const [cpf, setCpf] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/reembolso/user?page=${pageToLoad}&limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: Reimbursement[] = Array.isArray(json) ? json : json.data || [];
      setItems((prev) => (append ? [...prev, ...list] : list));
      const total = json.pagination?.total;
      setHasMore(
        typeof json.pagination?.hasMore === 'boolean'
          ? json.pagination.hasMore
          : typeof total === 'number'
            ? pageToLoad * 10 < total
            : list.length === 10,
      );
      setPage(pageToLoad);
    } catch {
      setError('Não foi possível carregar seus reembolsos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load(1, false);
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, authLoading, load]);

  // Pré-preenche centro de custo a partir do departamento, como no desktop
  useEffect(() => {
    if (profile) setCentroCusto(costCenterFromDepartment(profile.department));
  }, [profile]);

  const openForm = () => {
    setFormError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!user?.id) return;
    setFormError(null);

    const nome = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    const email = (profile?.email || user.email || '').trim();
    if (!nome || !email) {
      setFormError('Não foi possível identificar nome e e-mail do seu perfil. Complete o cadastro pela versão desktop.');
      return;
    }

    // Validações espelhadas do schema desktop (src/lib/schema.ts + reimbursementValidation)
    const dateCheck = validateExpenseDate(data);
    if (!dateCheck.valid) {
      setFormError(dateCheck.errorMessage || 'Data inválida');
      return;
    }
    if (descricao.trim().length < 5) {
      setFormError('Descrição é obrigatória (mínimo 5 caracteres).');
      return;
    }
    if (descricao.length > 500) {
      setFormError('Descrição muito longa (máximo 500 caracteres).');
      return;
    }
    if (!valor || !validateCurrency(valor)) {
      setFormError('Valor inválido. Use o formato "0,00" (vírgula como separador de centavos).');
      return;
    }
    const valueCheck = validateExpenseValue(tipoReembolso, valor);
    if (!valueCheck.valid) {
      setFormError(valueCheck.errorMessage || 'Valor inválido para o tipo selecionado.');
      return;
    }
    const numericValue = parseCurrencyValue(valor);
    const totalCheck = validateTotalValue(numericValue);
    if (!totalCheck.valid) {
      setFormError(totalCheck.errorMessage || 'Valor total inválido.');
      return;
    }
    if (!centroCusto.trim()) {
      setFormError('Centro de custo é obrigatório.');
      return;
    }
    if (!validateCPF(cpf)) {
      setFormError('CPF inválido.');
      return;
    }
    if (metodoPagamento === 'deposito') {
      if (!banco.trim() || !agencia.trim() || !conta.trim()) {
        setFormError('Banco, agência e conta são obrigatórios para depósito bancário.');
        return;
      }
    }
    if (metodoPagamento === 'pix') {
      if (!pixTipo) {
        setFormError('Tipo de chave PIX é obrigatório.');
        return;
      }
      if (!pixChave.trim() || !validatePixKey(pixTipo, pixChave.trim())) {
        setFormError(`Chave PIX inválida para o tipo ${pixTipo}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const token = getToken();
      const formattedTotal = numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const expense = {
        id: Math.random().toString(36).substr(2, 9),
        tipoReembolso,
        descricao: descricao.trim(),
        valor: valor.replace(/\./g, '').replace(',', '.'),
        comprovantes: [],
      };
      const res = await fetch('/api/reembolso/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nome,
          email,
          telefone: profile?.phone_number || '',
          cpf: cpf.replace(/\D/g, ''),
          cargo: profile?.position || '',
          centroCusto: centroCusto.trim(),
          data,
          tipoReembolso,
          descricao: `${tipoReembolso}: ${descricao.trim()}`,
          valorTotal: formattedTotal,
          moeda: 'BRL',
          metodoPagamento,
          banco: metodoPagamento === 'deposito' ? banco.trim() : null,
          agencia: metodoPagamento === 'deposito' ? agencia.trim() : null,
          conta: metodoPagamento === 'deposito' ? conta.trim() : null,
          pixTipo: metodoPagamento === 'pix' ? pixTipo : null,
          pixChave: metodoPagamento === 'pix' ? pixChave.trim() : null,
          expenses: [expense],
          comprovantes: [],
          observacoes: null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setFormOpen(false);
      setValor('');
      setDescricao('');
      setData(getTodayDateString());
      setBanco('');
      setAgencia('');
      setConta('');
      setPixChave('');
      setCpf('');
      setSuccessMsg(
        json.protocolo
          ? `Reembolso enviado para aprovação. Protocolo: ${json.protocolo}`
          : 'Reembolso enviado para aprovação.',
      );
      await load(1, false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao enviar reembolso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell title="Reembolso">
      <div className="flex flex-col gap-3" data-abz-mobile-reembolso="">
        {!isAuthenticated && !authLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Entre para ver seus reembolsos.
          </p>
        ) : (
          <>
            {successMsg ? (
              <div className="abz-m-alert-ok rounded-xl p-3 text-sm" role="status">
                {successMsg}
              </div>
            ) : null}
            {error ? (
              <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
                {error}
                <TouchButton variant="ghost" className="mt-1" onClick={() => load(1, false)}>
                  Tentar de novo
                </TouchButton>
              </div>
            ) : null}

            <TouchButton
              className="w-full justify-center"
              onClick={openForm}
              data-abz-mobile-reembolso-new=""
            >
              Novo reembolso
            </TouchButton>

            {items.map((item) => (
              <DataCard
                key={item.id}
                title={typeLabel(item.tipo_reembolso || item.tipoReembolso)}
                subtitle={item.descricao || undefined}
                meta={formatMoney(item) || undefined}
              >
                <span className={`mt-2 block text-xs font-semibold ${statusTone(item.status)}`}>
                  {statusLabel(item.status)}
                  {item.protocolo ? ` · ${item.protocolo}` : ''}
                  {item.data || item.created_at
                    ? ` · ${formatDate(item.data || item.created_at)}`
                    : ''}
                </span>
              </DataCard>
            ))}

            {loading ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
            ) : null}
            {!loading && items.length === 0 && !error ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Nenhum reembolso solicitado.
              </p>
            ) : null}
            {hasMore && !loading ? (
              <TouchButton variant="ghost" onClick={() => load(page + 1, true)}>
                Carregar mais
              </TouchButton>
            ) : null}
          </>
        )}
      </div>

      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title="Novo reembolso">
        <div className="flex flex-col gap-3" data-abz-mobile-reembolso-form="">
          <label className={labelClass}>
            Tipo de despesa
            <select
              value={tipoReembolso}
              onChange={(e) => setTipoReembolso(e.target.value)}
              className={inputClass}
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Valor (R$)
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Data da despesa
            <input
              type="date"
              max={getTodayDateString()}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Descrição
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex.: Almoço com cliente em São Paulo"
              className="rounded-xl border border-gray-200 px-3 py-2 text-base"
            />
          </label>
          <label className={labelClass}>
            Centro de custo
            <select
              value={centroCusto}
              onChange={(e) => setCentroCusto(e.target.value)}
              className={inputClass}
            >
              {COST_CENTERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Método de pagamento
            <select
              value={metodoPagamento}
              onChange={(e) => setMetodoPagamento(e.target.value)}
              className={inputClass}
            >
              <option value="deposito">Depósito Bancário</option>
              <option value="pix">PIX</option>
              <option value="agente">Agente Financeiro (Dinheiro)</option>
            </select>
          </label>

          {metodoPagamento === 'deposito' ? (
            <>
              <label className={labelClass}>
                Banco
                <input
                  type="text"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Agência
                <input
                  type="text"
                  inputMode="numeric"
                  value={agencia}
                  onChange={(e) => setAgencia(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Conta
                <input
                  type="text"
                  inputMode="numeric"
                  value={conta}
                  onChange={(e) => setConta(e.target.value)}
                  className={inputClass}
                />
              </label>
            </>
          ) : null}

          {metodoPagamento === 'pix' ? (
            <>
              <label className={labelClass}>
                Tipo de chave PIX
                <select
                  value={pixTipo}
                  onChange={(e) => setPixTipo(e.target.value)}
                  className={inputClass}
                >
                  {PIX_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Chave PIX
                <input
                  type="text"
                  value={pixChave}
                  onChange={(e) => setPixChave(e.target.value)}
                  className={inputClass}
                />
              </label>
            </>
          ) : null}

          <label className={labelClass}>
            CPF
            <input
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className={inputClass}
            />
          </label>

          <p className="text-xs text-gray-500">
            Os comprovantes podem ser anexados depois pela versão desktop, se necessário.
          </p>

          {formError ? (
            <p className="abz-m-alert-error rounded-xl p-2 text-sm" role="alert">
              {formError}
            </p>
          ) : null}
          <TouchButton className="w-full justify-center" onClick={submit} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar reembolso'}
          </TouchButton>
        </div>
      </BottomSheet>
    </MobileShell>
  );
}
