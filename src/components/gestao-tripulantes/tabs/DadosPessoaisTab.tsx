'use client';

import React, { useState } from 'react';
import { FiEdit2, FiUser, FiMapPin, FiBriefcase, FiCreditCard, FiFileText } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { formatBirthDate } from '@/lib/utils/identity';
import { formatRegimeDisplay } from '@/lib/gestao-tripulantes/regime-escala';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';
import ColaboradorCadastroForm from '@/components/gestao-tripulantes/ColaboradorCadastroForm';

interface CollaboratorDetail {
  id: string;
  nome_completo: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  nacionalidade: string;
  naturalidade: string;
  nome_mae: string;
  nome_pai: string;
  estado_civil: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_cep: string;
  matricula: string;
  matricula_esocial?: string | null;
  cargo_id?: string | null;
  cargo_nome: string;
  empresa_id?: string | null;
  empresa_nome: string;
  embarcacao_atual_id?: string | null;
  embarcacao_nome: string;
  centro_custo_id?: string | null;
  centro_custo_nome: string;
  status_embarque: string;
  standby: boolean;
  regime_trabalho?: string | null;
  escala_embarque?: number | string | null;
  escala_folga?: number | string | null;
  data_admissao: string;
  data_ultimo_embarque?: string | null;
  data_ultimo_desembarque?: string | null;
  data_proximo_embarque: string;
  sexo?: string | null;
  genero?: string | null;
  peso?: number | string | null;
  altura?: number | string | null;
  raca_cor?: string | null;
  escolaridade?: string | null;
  pis_pasep?: string | null;
  ctps?: string | null;
  ctps_serie?: string | null;
  ctps_uf?: string | null;
  cnh?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  salario?: number | string | null;
  tipo_salario?: string | null;
  forma_pagamento?: string | null;
  tipo_contrato?: string | null;
  departamento?: string | null;
  ativo?: boolean | null;
  dados_bancarios?: Record<string, string> | null;
  [key: string]: unknown;
}

interface Props {
  data: CollaboratorDetail;
  onUpdate?: (updated: Partial<CollaboratorDetail>) => void;
  onRefresh?: () => void;
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-800 font-medium mt-0.5">{value || '—'}</p>
    </div>
  );
}

function toDateInput(d?: string | null): string {
  if (!d) return '';
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function displayDate(d?: string | null): string {
  if (!d) return '—';
  const iso = toDateInput(d);
  return iso ? formatBirthDate(iso) : '—';
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-blue-600" />
      <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">{title}</h4>
    </div>
  );
}

export default function DadosPessoaisTab({ data, onUpdate, onRefresh }: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);

  const statusColors: Record<string, string> = {
    embarcado: 'bg-green-100 text-green-700',
    standby: 'bg-orange-100 text-orange-700',
    folga: 'bg-blue-100 text-blue-700',
    desembarcado: 'bg-gray-100 text-gray-600',
    afastado: 'bg-red-100 text-red-700',
    ferias: 'bg-purple-100 text-purple-700',
    treinamento: 'bg-yellow-100 text-yellow-700',
  };

  const bank = data.dados_bancarios && typeof data.dados_bancarios === 'object'
    ? data.dados_bancarios
    : null;

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} p-6`}>
      <div className="flex justify-end shrink-0 mb-6">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <FiEdit2 className="w-3.5 h-3.5" /> {t('gestaoTripulantes.profile.edit')}
          </button>
        )}
      </div>

      {editing ? (
        <div className={COLLABORATOR_MODAL_TABLE_SCROLL_CLASS}>
          <ColaboradorCadastroForm
            mode="edit"
            colaboradorId={data.id}
            initialData={data as unknown as Record<string, unknown>}
            embedded
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              onUpdate?.(updated as Partial<CollaboratorDetail>);
              setEditing(false);
              onRefresh?.();
            }}
          />
        </div>
      ) : (
        <div className={`${COLLABORATOR_MODAL_TABLE_SCROLL_CLASS} space-y-6`}>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[data.status_embarque] || 'bg-gray-100 text-gray-600'}`}>
              {t(`gestaoTripulantes.status.${data.status_embarque}`, data.status_embarque)}
              {data.standby && data.status_embarque !== 'standby' && data.status_embarque !== 'embarcado' ? ' • StandBy' : ''}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${data.ativo === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {data.ativo === false ? 'Inativo' : 'Ativo'}
            </span>
          </div>

          <div>
            <SectionTitle icon={FiUser} title={t('gestaoTripulantes.personalData.fullName', 'Dados Pessoais')} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoField label="Nome Completo" value={data.nome_completo} />
              <InfoField label={t('gestaoTripulantes.personalData.cpf')} value={data.cpf} />
              <InfoField label={t('gestaoTripulantes.personalData.rg')} value={data.rg} />
              <InfoField label={t('gestaoTripulantes.personalData.registrationNumber')} value={data.matricula} />
              <InfoField label="Matrícula e-Social" value={data.matricula_esocial} />
              <InfoField label={t('gestaoTripulantes.personalData.birthDate')} value={displayDate(data.data_nascimento)} />
              <InfoField label="Sexo" value={data.sexo} />
              <InfoField label={t('gestaoTripulantes.personalData.nationality')} value={data.nacionalidade} />
              <InfoField label={t('gestaoTripulantes.personalData.birthplace')} value={data.naturalidade} />
              <InfoField label={t('gestaoTripulantes.personalData.motherName')} value={data.nome_mae} />
              <InfoField label={t('gestaoTripulantes.personalData.fatherName')} value={data.nome_pai} />
              <InfoField label={t('gestaoTripulantes.personalData.maritalStatus')} value={data.estado_civil} />
              <InfoField label={t('gestaoTripulantes.personalData.email')} value={data.email} />
              <InfoField label="Telefone" value={data.telefone} />
              <InfoField label="Escolaridade" value={data.escolaridade} />
              <InfoField label="Raça/Cor" value={data.raca_cor} />
            </div>
          </div>

          <div>
            <SectionTitle icon={FiBriefcase} title="Dados Profissionais" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoField label={t('gestaoTripulantes.personalData.position')} value={data.cargo_nome} />
              <InfoField label={t('gestaoTripulantes.personalData.company')} value={data.empresa_nome} />
              <InfoField label={t('gestaoTripulantes.personalData.vessel', 'Embarcação')} value={data.embarcacao_nome} />
              <InfoField label={t('gestaoTripulantes.personalData.costCenter')} value={data.centro_custo_nome} />
              <InfoField label="Departamento" value={data.departamento} />
              <InfoField label="Regime / Escala de Trabalho" value={formatRegimeDisplay(data)} />
              <InfoField label="Contrato" value={data.tipo_contrato} />
              <InfoField
                label="Salário"
                value={
                  data.salario != null && data.salario !== ''
                    ? [
                        String(data.salario),
                        (data.salario_moeda as string) || 'BRL',
                        (data.salario_periodo as string) || 'mes',
                        (data.salario_natureza as string) || 'bruto',
                      ].join(' · ')
                    : null
                }
              />
              <InfoField label="Tipo de Salário" value={data.tipo_salario} />
              <InfoField label="Forma de Pagamento" value={data.forma_pagamento} />
              <InfoField label={t('gestaoTripulantes.personalData.admissionDate')} value={displayDate(data.data_admissao)} />
              <InfoField label="Último Embarque" value={displayDate(data.data_ultimo_embarque)} />
              <InfoField label="Último Desembarque" value={displayDate(data.data_ultimo_desembarque)} />
              <InfoField label="Próximo Embarque" value={displayDate(data.data_proximo_embarque)} />
            </div>
          </div>

          <div>
            <SectionTitle icon={FiFileText} title="Documentos de identidade" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoField label="PIS/PASEP" value={data.pis_pasep} />
              <InfoField label="CTPS" value={[data.ctps, data.ctps_serie, data.ctps_uf].filter(Boolean).join(' / ') || null} />
              <InfoField label="CNH" value={[data.cnh, data.cnh_categoria, displayDate(data.cnh_validade) !== '—' ? displayDate(data.cnh_validade) : null].filter(Boolean).join(' · ') || null} />
            </div>
          </div>

          <div>
            <SectionTitle icon={FiCreditCard} title="Dados bancários" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoField label="Banco" value={bank?.codigo} />
              <InfoField label="Agência" value={bank?.agencia} />
              <InfoField label="Conta" value={bank?.conta} />
              <InfoField label="Tipo" value={bank?.tipo} />
            </div>
          </div>

          <div>
            <SectionTitle icon={FiMapPin} title={t('gestaoTripulantes.personalData.address')} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoField label="Logradouro" value={`${data.endereco_logradouro || ''}${data.endereco_numero ? `, ${data.endereco_numero}` : ''}`} />
              <InfoField label="Complemento" value={data.endereco_complemento} />
              <InfoField label="Bairro" value={data.endereco_bairro} />
              <InfoField label="Cidade/UF" value={`${data.endereco_cidade || ''}${data.endereco_uf ? `/${data.endereco_uf}` : ''}`} />
              <InfoField label="CEP" value={data.endereco_cep} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
