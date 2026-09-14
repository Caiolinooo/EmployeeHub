'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithToken } from '@/lib/tokenStorage';
import toast from 'react-hot-toast';
import SearchableCreatableSelect from '@/components/gestao-tripulantes/SearchableCreatableSelect';
import {
  createGtLookupOption,
  toLookupOptions,
  type GtLookupKind,
} from '@/components/gestao-tripulantes/createGtLookupOption';
import {
  REGIME_TRABALHO_OPTIONS,
  escalaDiasParaForm,
  inferRegimeUi,
  isRegimeSemRotacao,
  parseNxNPair,
  parseRegimeTrabalho,
  persistirCamposEscala,
} from '@/lib/gestao-tripulantes/regime-escala';
import { formatCpf, isValidCpf } from '@/lib/utils/identity';

type TabId =
  | 'dados-pessoais'
  | 'documentos'
  | 'endereco'
  | 'contato'
  | 'dados-bancarios'
  | 'vinculo'
  | 'esocial';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dados-pessoais', label: 'Dados Pessoais' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'endereco', label: 'Endereço' },
  { id: 'contato', label: 'Contato' },
  { id: 'dados-bancarios', label: 'Dados Bancários' },
  { id: 'vinculo', label: 'Vínculo Empregatício' },
  { id: 'esocial', label: 'e-Social' },
];

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

interface Option { id: string; nome: string; [k: string]: unknown }

const CREATE_DEFAULTS: Record<string, unknown> = {
  origem: 'manual',
  status_embarque: 'desembarcado',
  nacionalidade: 'BRASILEIRA',
  pais_nascimento: 'Brasil',
  ativo: true,
};

function toDateInput(d?: string | null): string {
  if (!d) return '';
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function emptyToNull(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

export function hydrateCadastroForm(data?: Record<string, unknown> | null): Record<string, unknown> {
  if (!data) return { ...CREATE_DEFAULTS };
  const regimeUi = inferRegimeUi(data);
  const bank = data.dados_bancarios && typeof data.dados_bancarios === 'object'
    ? data.dados_bancarios
    : {};
  return {
    ...CREATE_DEFAULTS,
    ...data,
    cpf: data.cpf ? formatCpf(String(data.cpf)) : '',
    dados_bancarios: bank,
    regime_trabalho: regimeUi || data.regime_trabalho || '',
    escala_embarque: escalaDiasParaForm(regimeUi || String(data.regime_trabalho || ''), data.escala_embarque as number | string | null),
    escala_folga: escalaDiasParaForm(regimeUi || String(data.regime_trabalho || ''), data.escala_folga as number | string | null),
    data_nascimento: toDateInput(data.data_nascimento as string | null),
    data_emissao_rg: toDateInput(data.data_emissao_rg as string | null),
    data_admissao: toDateInput(data.data_admissao as string | null),
    data_demissao: toDateInput(data.data_demissao as string | null),
    cnh_validade: toDateInput(data.cnh_validade as string | null),
    data_ultimo_embarque: toDateInput(data.data_ultimo_embarque as string | null),
    data_ultimo_desembarque: toDateInput(data.data_ultimo_desembarque as string | null),
    data_proximo_embarque: toDateInput(data.data_proximo_embarque as string | null),
    standby: Boolean(data.standby),
    ativo: data.ativo !== false,
  };
}

export interface ColaboradorCadastroFormProps {
  mode: 'create' | 'edit';
  colaboradorId?: string;
  initialData?: Record<string, unknown> | null;
  returnTo?: string;
  embedded?: boolean;
  onSaved?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
}

export default function ColaboradorCadastroForm({
  mode,
  colaboradorId,
  initialData,
  returnTo,
  embedded = false,
  onSaved,
  onCancel,
}: ColaboradorCadastroFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('dados-pessoais');
  const [saving, setSaving] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [cargos, setCargos] = useState<Option[]>([]);
  const [empresas, setEmpresas] = useState<Option[]>([]);
  const [embarcacoes, setEmbarcacoes] = useState<Option[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<Option[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>(() => hydrateCadastroForm(initialData));

  useEffect(() => {
    if (initialData) setForm(hydrateCadastroForm(initialData));
  }, [initialData]);

  useEffect(() => {
    Promise.all([
      fetchWithToken('/api/gestao-tripulantes/cargos').then(r => r.ok ? r.json() : { data: [] }),
      fetchWithToken('/api/gestao-tripulantes/empresas').then(r => r.ok ? r.json() : { data: [] }),
      fetchWithToken('/api/gestao-tripulantes/embarcacoes').then(r => r.ok ? r.json() : { data: [] }),
      fetchWithToken('/api/gestao-tripulantes/centros-custo').then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([c, e, emb, cc]) => {
      setCargos(c.data || []);
      setEmpresas(e.data || []);
      setEmbarcacoes(emb.data || []);
      setCentrosCusto(cc.data || []);
    });
  }, []);

  const set = (field: string, value: unknown) => setForm(p => ({ ...p, [field]: value }));

  const handleCreateLookup = async (
    kind: GtLookupKind,
    labelText: string,
    setter: React.Dispatch<React.SetStateAction<Option[]>>,
  ) => {
    try {
      const created = await createGtLookupOption(kind, labelText);
      setter(prev => (prev.some(o => o.id === created.id) ? prev : [...prev, { id: created.id, nome: created.nome, codigo: created.codigo }]));
      toast.success(`«${created.label}» adicionado`);
      return created;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao adicionar');
      throw err;
    }
  };

  const lookupSelect = (
    field: string,
    options: Option[],
    kind: GtLookupKind,
    setter: React.Dispatch<React.SetStateAction<Option[]>>,
  ) => (
    <SearchableCreatableSelect
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      options={toLookupOptions(options, kind, form[field] ? { id: String(form[field]), label: String(form[field]) } : undefined)}
      value={form[field] ? String(form[field]) : ''}
      onChange={id => set(field, id)}
      allowCreate
      onCreate={labelText => handleCreateLookup(kind, labelText, setter)}
      placeholder="Buscar ou adicionar..."
    />
  );

  const handleOcrDocument = async (tipo: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setOcrRunning(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('tipo_documento', tipo);
        const res = await fetchWithToken('/api/gestao-tripulantes/ocr/extract', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) { toast.error('Falha no OCR'); return; }
        const json = await res.json();
        if (json.success && json.data.campos) {
          const c = json.data.campos as Record<string, unknown>;
          const updates: Record<string, unknown> = {};
          if (c.cpf) updates.cpf = formatCpf(String(c.cpf));
          if (c.nome_completo) updates.nome_completo = c.nome_completo;
          if (c.data_nascimento) updates.data_nascimento = c.data_nascimento;
          if (c.rg) updates.rg = c.rg;
          if (c.nome_mae) updates.nome_mae = c.nome_mae;
          if (c.nome_pai) updates.nome_pai = c.nome_pai;
          if (c.ctps) updates.ctps = c.ctps;
          if (c.cnh) updates.cnh = c.cnh;
          if (c.pis_pasep) updates.pis_pasep = c.pis_pasep;
          if (c.endereco_logradouro) updates.endereco_logradouro = c.endereco_logradouro;
          if (c.endereco_cep) updates.endereco_cep = c.endereco_cep;
          setForm(p => ({ ...p, ...updates }));
          toast.success(`OCR concluído (confiança: ${Math.round((json.data.confianca || 0) * 100)}%)`);
        }
      } catch {
        toast.error('Erro no OCR');
      } finally {
        setOcrRunning(false);
      }
    };
    input.click();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    router.back();
  };

  const handleSubmit = async () => {
    const nome = String(form.nome_completo || '').trim();
    const cpf = String(form.cpf || '');
    if (!nome || !cpf) {
      toast.error('Nome completo e CPF são obrigatórios');
      setActiveTab('dados-pessoais');
      return;
    }
    if (!isValidCpf(cpf)) {
      toast.error('CPF inválido');
      setActiveTab('dados-pessoais');
      return;
    }

    setSaving(true);
    try {
      const escalaPersistida = persistirCamposEscala({
        regime_trabalho: (form.regime_trabalho as string) || null,
        escala_embarque: form.escala_embarque as string | number | null,
        escala_folga: form.escala_folga as string | number | null,
      });
      const matricula = String(form.matricula || '').trim();
      const matriculaEsocial = String(form.matricula_esocial || matricula || '').trim();
      const payload: Record<string, unknown> = {
        ...form,
        nome_completo: nome,
        cpf,
        matricula: matricula || null,
        matricula_esocial: matriculaEsocial || null,
        salario: emptyToNull(form.salario),
        peso: emptyToNull(form.peso),
        altura: emptyToNull(form.altura),
        standby: form.standby === true || form.standby === 'true',
        ativo: form.ativo !== false && form.ativo !== 'false',
        regime_trabalho: escalaPersistida.regime_trabalho,
        escala_embarque: escalaPersistida.escala_embarque,
        escala_folga: escalaPersistida.escala_folga,
        cargo_id: emptyToNull(form.cargo_id),
        empresa_id: emptyToNull(form.empresa_id),
        embarcacao_atual_id: emptyToNull(form.embarcacao_atual_id),
        centro_custo_id: emptyToNull(form.centro_custo_id),
      };
      if (payload.dados_bancarios && typeof payload.dados_bancarios === 'object' && Object.keys(payload.dados_bancarios as object).length === 0) {
        payload.dados_bancarios = null;
      }

      const url = mode === 'edit' && colaboradorId
        ? `/api/gestao-tripulantes/colaboradores/${colaboradorId}`
        : '/api/gestao-tripulantes/colaboradores';
      const res = await fetchWithToken(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar');
      toast.success(mode === 'edit' ? 'Cadastro atualizado' : 'Colaborador cadastrado com sucesso!');
      onSaved?.(json.data || payload);
      if (!embedded && returnTo) {
        router.push(returnTo);
      } else if (!embedded && mode === 'create') {
        router.push('/department/gestao-tripulantes');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const label = (text: string, required?: boolean) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  const input = (field: string, opts?: { type?: string; placeholder?: string; required?: boolean; className?: string; disabled?: boolean }) => (
    <input
      type={opts?.type || 'text'}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${opts?.className || ''}`}
      placeholder={opts?.placeholder}
      value={form[field] == null ? '' : String(form[field])}
      onChange={e => set(field, field === 'cpf' ? formatCpf(e.target.value) : e.target.value)}
      required={opts?.required}
      disabled={opts?.disabled}
    />
  );

  const select = (field: string, options: Option[] | readonly string[], opts?: { placeholder?: string }) => {
    const items = Array.isArray(options) && options.length > 0 && typeof options[0] === 'object'
      ? (options as Option[])
      : (options as string[]).map(v => ({ id: v, nome: v }));
    return (
      <select
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        value={form[field] == null ? '' : String(form[field])}
        onChange={e => set(field, e.target.value)}
      >
        <option value="">{opts?.placeholder || 'Selecione...'}</option>
        {items.map(o => (
          <option key={o.id} value={o.id}>{o.nome}</option>
        ))}
      </select>
    );
  };

  const section = (title: string, children: React.ReactNode) => (
    <div className="mb-6">
      <h3 className="text-md font-semibold text-gray-800 border-b pb-1 mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'dados-pessoais':
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Dados Pessoais</h2>
              <button type="button" onClick={() => handleOcrDocument('rg')} disabled={ocrRunning}
                className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 flex items-center gap-1">
                <span>{ocrRunning ? 'Processando...' : 'OCR RG / CPF'}</span>
              </button>
            </div>
            {section('Identificação', <>
              <div>{label('Nome Completo', true)}{input('nome_completo', { required: true })}</div>
              <div>{label('CPF', true)}{input('cpf', { placeholder: '000.000.000-00', required: true })}</div>
              <div>{label('RG')}{input('rg')}</div>
              <div>{label('Órgão Emissor')}{input('orgao_emissor')}</div>
              <div>{label('Data Emissão RG')}{input('data_emissao_rg', { type: 'date' })}</div>
              <div>{label('Matrícula')}{input('matricula')}</div>
              <div>{label('Matrícula e-Social')}{input('matricula_esocial', { placeholder: 'Copia a matrícula se vazio' })}</div>
              <div>
                {label('Situação')}
                <label className="flex items-center gap-2 text-sm text-gray-800 mt-2">
                  <input
                    type="checkbox"
                    checked={form.ativo !== false && form.ativo !== 'false'}
                    onChange={e => set('ativo', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  Ativo na folha
                </label>
              </div>
            </>)}
            {section('Nascimento', <>
              <div>{label('Data de Nascimento')}{input('data_nascimento', { type: 'date' })}</div>
              <div>{label('Sexo')}{select('sexo', ['Masculino', 'Feminino'])}</div>
              <div>{label('Gênero')}{input('genero')}</div>
              <div>{label('Estado Civil')}{select('estado_civil', ['Solteiro', 'Casado', 'Divorciado', 'Viúvo', 'União Estável'])}</div>
              <div>{label('Nacionalidade')}{input('nacionalidade')}</div>
              <div>{label('Naturalidade (Cidade)')}{input('naturalidade')}</div>
              <div>{label('Naturalidade UF')}{select('naturalidade_uf', UFS)}</div>
              <div>{label('País de Nascimento')}{input('pais_nascimento')}</div>
            </>)}
            {section('Filiação', <>
              <div>{label('Nome da Mãe')}{input('nome_mae')}</div>
              <div>{label('Nome do Pai')}{input('nome_pai')}</div>
            </>)}
            {section('Características', <>
              <div>{label('Raça/Cor')}{select('raca_cor', ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena'])}</div>
              <div>{label('Escolaridade')}{select('escolaridade', [
                'Analfabeto', 'Ensino Fundamental Incompleto', 'Ensino Fundamental Completo',
                'Ensino Médio Incompleto', 'Ensino Médio Completo',
                'Ensino Superior Incompleto', 'Ensino Superior Completo',
                'Pós-Graduação', 'Mestrado', 'Doutorado',
              ])}</div>
              <div>{label('Peso (kg)')}{input('peso', { type: 'number' })}</div>
              <div>{label('Altura (cm)')}{input('altura', { type: 'number' })}</div>
              <div>{label('Deficiência')}{input('deficiencia')}</div>
              <div>{label('CID da Deficiência')}{input('deficiencia_cid')}</div>
            </>)}
          </div>
        );
      case 'documentos':
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Documentos</h2>
              <button type="button" onClick={() => handleOcrDocument('ctps')} disabled={ocrRunning}
                className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 flex items-center gap-1">
                <span>{ocrRunning ? 'Processando...' : 'OCR Documento'}</span>
              </button>
            </div>
            {section('CTPS (Carteira de Trabalho)', <>
              <div>{label('Número CTPS')}{input('ctps')}</div>
              <div>{label('Série')}{input('ctps_serie')}</div>
              <div>{label('UF')}{select('ctps_uf', UFS)}</div>
            </>)}
            {section('PIS/PASEP', <>
              <div>{label('Número PIS/PASEP')}{input('pis_pasep')}</div>
            </>)}
            {section('CNH (Carteira Nacional de Habilitação)', <>
              <div>{label('Número CNH')}{input('cnh')}</div>
              <div>{label('Categoria')}{select('cnh_categoria', ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'])}</div>
              <div>{label('Validade')}{input('cnh_validade', { type: 'date' })}</div>
              <div>{label('UF Emissão')}{select('cnh_uf', UFS)}</div>
            </>)}
            {section('Título de Eleitor', <>
              <div>{label('Número')}{input('titulo_eleitor')}</div>
              <div>{label('Zona')}{input('titulo_eleitor_zona')}</div>
              <div>{label('Seção')}{input('titulo_eleitor_sessao')}</div>
            </>)}
            {section('Certidão', <>
              <div>{label('Tipo')}{select('certidao_tipo', ['Nascimento', 'Casamento'])}</div>
              <div>{label('Número')}{input('certidao_numero')}</div>
              <div>{label('Cartório')}{input('certidao_cartorio')}</div>
            </>)}
          </div>
        );
      case 'endereco':
        return (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Endereço</h2>
            {section('Endereço Residencial', <>
              <div className="lg:col-span-2">{label('Logradouro')}{input('endereco_logradouro')}</div>
              <div>{label('Número')}{input('endereco_numero')}</div>
              <div>{label('Complemento')}{input('endereco_complemento')}</div>
              <div>{label('Bairro')}{input('endereco_bairro')}</div>
              <div>{label('CEP')}{input('endereco_cep')}</div>
              <div>{label('Cidade')}{input('endereco_cidade')}</div>
              <div>{label('UF')}{select('endereco_uf', UFS)}</div>
            </>)}
          </div>
        );
      case 'contato':
        return (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Contato</h2>
            {section('Informações de Contato', <>
              <div>{label('E-mail')}{input('email', { type: 'email' })}</div>
              <div>{label('Telefone 1')}{input('telefone')}</div>
            </>)}
          </div>
        );
      case 'dados-bancarios': {
        const bk = (form.dados_bancarios || {}) as Record<string, string>;
        const setBank = (f: string, v: string) => setForm(p => ({
          ...p,
          dados_bancarios: { ...((p.dados_bancarios as Record<string, string>) || {}), [f]: v },
        }));
        const bankInput = (field: string, placeholder?: string) => (
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={placeholder}
            value={bk[field] || ''}
            onChange={e => setBank(field, e.target.value)}
          />
        );
        return (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Dados Bancários</h2>
            {section('Banco', <>
              <div>{label('Código do Banco')}{bankInput('codigo', '001')}</div>
              <div>{label('Agência')}{bankInput('agencia')}</div>
              <div>{label('Conta')}{bankInput('conta')}</div>
              <div>
                {label('Tipo')}
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={bk.tipo || ''}
                  onChange={e => setBank('tipo', e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {['Corrente', 'Poupança', 'Salário'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </>)}
          </div>
        );
      }
      case 'vinculo':
        return (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Vínculo Empregatício</h2>
            {section('Empresa e Cargo', <>
              <div>{label('Empresa')}{lookupSelect('empresa_id', empresas, 'empresas', setEmpresas)}</div>
              <div>{label('Cargo/Função')}{lookupSelect('cargo_id', cargos, 'cargos', setCargos)}</div>
              <div>{label('CBO')}{input('cbo', { placeholder: 'Código Brasileiro de Ocupações' })}</div>
              <div>{label('Centro de Custo')}{lookupSelect('centro_custo_id', centrosCusto, 'centros-custo', setCentrosCusto)}</div>
              <div>{label('Embarcação Atual')}{lookupSelect('embarcacao_atual_id', embarcacoes, 'embarcacoes', setEmbarcacoes)}</div>
              <div>{label('Departamento')}{input('departamento')}</div>
            </>)}
            {section('Datas', <>
              <div>{label('Data de Admissão')}{input('data_admissao', { type: 'date' })}</div>
              <div>{label('Data de Demissão')}{input('data_demissao', { type: 'date' })}</div>
              <div>{label('Motivo da Demissão')}{input('motivo_demissao')}</div>
              <div>{label('Último Embarque')}{input('data_ultimo_embarque', { type: 'date' })}</div>
              <div>{label('Último Desembarque')}{input('data_ultimo_desembarque', { type: 'date' })}</div>
              <div>{label('Próximo Embarque')}{input('data_proximo_embarque', { type: 'date' })}</div>
            </>)}
            {section('Remuneração', <>
              <div>{label('Salário')}{input('salario', { type: 'number' })}</div>
              <div>{label('Tipo de Salário')}{select('tipo_salario', ['Mensal', 'Por Hora', 'Por Dia', 'Comissionado'])}</div>
              <div>{label('Forma de Pagamento')}{select('forma_pagamento', ['Depósito', 'Cheque', 'Dinheiro', 'Pix'])}</div>
              <div>{label('Sindicato')}{input('sindicato')}</div>
            </>)}
            {section('Regime e Contrato', <>
              <div>
                {label('Regime de Trabalho')}
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={form.regime_trabalho == null ? '' : String(form.regime_trabalho)}
                  onChange={e => {
                    // Trocar de regime substitui o par de dias já digitado pelo
                    // default do regime (sem rotação zera os dois campos); o
                    // usuário ainda pode ajustar os dias depois.
                    const regimeSelecionado = e.target.value || null;
                    const regimeConhecido = parseRegimeTrabalho(regimeSelecionado);
                    const parRegime = regimeConhecido ? parseNxNPair(regimeConhecido) : null;
                    const persistido = persistirCamposEscala({
                      regime_trabalho: regimeSelecionado,
                      escala_embarque: parRegime ? parRegime[0] : form.escala_embarque as string | number | null,
                      escala_folga: parRegime ? parRegime[1] : form.escala_folga as string | number | null,
                    });
                    setForm(p => ({
                      ...p,
                      regime_trabalho: persistido.regime_trabalho || e.target.value,
                      escala_embarque: persistido.escala_embarque == null ? '' : String(persistido.escala_embarque),
                      escala_folga: persistido.escala_folga == null ? '' : String(persistido.escala_folga),
                    }));
                  }}
                >
                  <option value="">Selecione...</option>
                  {REGIME_TRABALHO_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>{label('Tipo de Contrato')}{select('tipo_contrato', ['CLT', 'PJ', 'Temporário', 'Estágio', 'Autônomo'])}</div>
              <div>{label('Prazo do Contrato')}{input('prazo_contrato')}</div>
              <div>{label('Categoria do Contrato')}{input('categoria_contrato')}</div>
              <div>{label('Tipo de Trabalho')}{input('tipo_trabalho')}</div>
              <div>{label('Tipo de Mão de Obra')}{input('tipo_mao_de_obra')}</div>
              <div>
                {label('Dias a bordo')}
                {input('escala_embarque', {
                  type: 'number',
                  placeholder: isRegimeSemRotacao(String(form.regime_trabalho || '')) ? '0' : 'Ex: 14',
                  disabled: isRegimeSemRotacao(String(form.regime_trabalho || '')),
                })}
              </div>
              <div>
                {label('Dias de folga')}
                {input('escala_folga', {
                  type: 'number',
                  placeholder: isRegimeSemRotacao(String(form.regime_trabalho || '')) ? '0' : 'Ex: 14',
                  disabled: isRegimeSemRotacao(String(form.regime_trabalho || '')),
                })}
              </div>
              <div>{label('Jornada Semanal')}{input('jornada_semanal')}</div>
              <div>{label('Jornada Mensal')}{input('jornada_mensal')}</div>
              <div>{label('Status de Embarque')}{select('status_embarque', ['embarcado', 'standby', 'folga', 'desembarcado', 'afastado', 'ferias', 'treinamento'])}</div>
              <div>{label('Standby')}{select('standby', [{ id: 'true', nome: 'Sim' }, { id: 'false', nome: 'Não' }])}</div>
            </>)}
          </div>
        );
      case 'esocial':
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">e-Social</h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Informações complementares para eventos e-Social</span>
            </div>
            {section('Evento S-2200 (Cadastramento Inicial)', <>
              <div className="lg:col-span-1">
                <p className="text-xs text-gray-500 mb-3">
                  O S-2200 será gerado automaticamente a partir dos dados preenchidos nas abas anteriores.
                  Abaixo estão campos complementares exigidos pelo e-Social.
                </p>
              </div>
              <div>{label('NIS (PIS/PASEP)')}{input('pis_pasep')}</div>
              <div>{label('CBO')}{input('cbo')}</div>
              <div>{label('Tipo de Admissão')}{select('tipo_admissao', ['Admissão', 'Transferência', 'Readaptação'])}</div>
              <div>{label('Natureza da Atividade')}{select('natureza_atividade', ['Urbana', 'Rural', 'Aprendiz'])}</div>
            </>)}
            {section('Jornada de Trabalho', <>
              <div>{label('Tipo de Jornada')}{select('tipo_jornada', ['Jornada Fixa', 'Jornada Variável'])}</div>
              <div>{label('Horas Semanais')}{input('jornada_semanal')}</div>
              <div>{label('Horas Mensais')}{input('jornada_mensal')}</div>
            </>)}
            {section('Lotação', <>
              <div>{label('Tipo de Lotação')}{select('tipo_lotacao', ['01 - CNPJ do Empregador', '02 - CNPJ da Obra', '03 - Estabelecimento', '04 - Atividade'])}</div>
            </>)}
            {section('Informações de Saúde (S-2220)', <>
              <div className="lg:col-span-3">
                <p className="text-xs text-gray-500">
                  Os exames ASO devem ser registrados na aba Documentos do colaborador após o cadastro.
                  O evento S-2220 será gerado via OCR do ASO.
                </p>
              </div>
            </>)}
            {section('Condições Ambientais (S-2240)', <>
              <div className="lg:col-span-3">
                <p className="text-xs text-gray-500">
                  Os fatores de risco serão vinculados ao cargo do colaborador automaticamente.
                  Configure na seção de Cargos no módulo de Gestão de Tripulantes.
                </p>
              </div>
            </>)}
          </div>
        );
      default: {
        const _exhaustive: never = activeTab;
        return _exhaustive;
      }
    }
  };

  const saveLabel = mode === 'edit' ? 'Salvar alterações' : 'Salvar Colaborador';

  return (
    <div className={embedded ? 'w-full' : 'max-w-7xl mx-auto'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <button type="button" onClick={handleCancel} className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1">
              &larr; Voltar
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {mode === 'edit' ? 'Editar colaborador' : 'Novo Colaborador'}
            </h1>
            <p className="text-gray-500 text-sm">
              {mode === 'edit'
                ? 'Altere qualquer dado do cadastro. Grava em gt_colaboradores via API interna.'
                : 'Cadastro do zero no mesmo banco interno (gt_colaboradores). Sem tabela paralela.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleCancel}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? 'Salvando...' : saveLabel}
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex justify-end gap-2 mb-4">
          <button type="button" onClick={handleCancel}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : saveLabel}
          </button>
        </div>
      )}

      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[400px]">
        {renderTab()}
      </div>

      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={() => {
            const idx = TABS.findIndex(t => t.id === activeTab);
            if (idx > 0) setActiveTab(TABS[idx - 1].id);
          }}
          disabled={activeTab === TABS[0].id}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-30"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => {
            const idx = TABS.findIndex(t => t.id === activeTab);
            if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
            else handleSubmit();
          }}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {activeTab === TABS[TABS.length - 1].id ? 'Salvar' : 'Próximo'}
        </button>
      </div>
    </div>
  );
}
