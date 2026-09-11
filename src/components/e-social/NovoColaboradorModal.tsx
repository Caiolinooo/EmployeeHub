'use client';

import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import toast from 'react-hot-toast';
import SearchableCreatableSelect from '@/components/gestao-tripulantes/SearchableCreatableSelect';
import {
  createGtLookupOption,
  toLookupOptions,
  type GtLookupKind,
} from '@/components/gestao-tripulantes/createGtLookupOption';

type TabId = 'dados-pessoais' | 'documentos' | 'endereco' | 'contato' | 'dados-bancarios' | 'vinculo' | 'esocial';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dados-pessoais', label: 'Dados Pessoais' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'endereco', label: 'Endereço' },
  { id: 'contato', label: 'Contato' },
  { id: 'dados-bancarios', label: 'Dados Bancários' },
  { id: 'vinculo', label: 'Vínculo Empregatício' },
  { id: 'esocial', label: 'e-Social' },
];

interface Option { id: string; nome: string; [k: string]: any; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovoColaboradorModal({ isOpen, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('dados-pessoais');
  const [saving, setSaving] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);

  // Dropdown data
  const [cargos, setCargos] = useState<Option[]>([]);
  const [empresas, setEmpresas] = useState<Option[]>([]);
  const [embarcacoes, setEmbarcacoes] = useState<Option[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<Option[]>([]);

  // Form data
  const [form, setForm] = useState<Record<string, any>>({
    origem: 'manual',
    status_embarque: 'desembarcado',
    nacionalidade: 'BRASILEIRA',
    pais_nascimento: 'Brasil',
  });

  useEffect(() => {
    if (!isOpen) return;

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
    }).catch(err => {
      console.error('Erro ao carregar dados dos dropdowns:', err);
      toast.error('Erro ao carregar opções dos formulários');
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const handleCreateLookup = async (
    kind: GtLookupKind,
    label: string,
    setter: React.Dispatch<React.SetStateAction<Option[]>>,
  ) => {
    try {
      const created = await createGtLookupOption(kind, label);
      setter(prev => (prev.some(o => o.id === created.id) ? prev : [...prev, { id: created.id, nome: created.nome, codigo: created.codigo }]));
      toast.success(`«${created.label}» adicionado`);
      return created;
    } catch (err: any) {
      toast.error(err.message || 'Falha ao adicionar');
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
      options={toLookupOptions(options, kind, form[field] ? { id: form[field], label: form[field] } : undefined)}
      value={form[field] || ''}
      onChange={id => set(field, id)}
      allowCreate
      onCreate={label => handleCreateLookup(kind, label, setter)}
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
          const c = json.data.campos;
          const updates: Record<string, any> = {};
          if (c.cpf) updates.cpf = c.cpf;
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
          toast.success(`OCR concluído (confiança: ${Math.round(json.data.confianca * 100)}%)`);
        }
      } catch { toast.error('Erro no OCR'); }
      finally { setOcrRunning(false); }
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (!form.nome_completo || !form.cpf) {
      toast.error('Nome completo e CPF são obrigatórios');
      setActiveTab('dados-pessoais');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Convert types
      if (payload.salario) payload.salario = Number(payload.salario);
      if (payload.peso) payload.peso = Number(payload.peso);
      if (payload.altura) payload.altura = Number(payload.altura);
      if (payload.standby === 'true') payload.standby = true;
      else if (payload.standby === 'false') payload.standby = false;
      // Clean empty objects
      if (payload.dados_bancarios && typeof payload.dados_bancarios === 'object' && Object.keys(payload.dados_bancarios).length === 0) {
        payload.dados_bancarios = null;
      }

      const res = await fetchWithToken('/api/gestao-tripulantes/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao salvar'); }
      toast.success('Colaborador cadastrado com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const label = (text: string, required?: boolean) => (
    <label className="block text-xs font-semibold text-gray-600 mb-1">
      {text}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  const input = (field: string, opts?: { type?: string; placeholder?: string; required?: boolean; className?: string }) => (
    <input
      type={opts?.type || 'text'}
      className={`w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${opts?.className || ''}`}
      placeholder={opts?.placeholder}
      value={form[field] || ''}
      onChange={e => set(field, e.target.value)}
      required={opts?.required}
    />
  );

  const select = (field: string, options: Option[] | readonly string[], opts?: { placeholder?: string }) => {
    const items = Array.isArray(options) && options.length > 0 && typeof options[0] === 'object'
      ? (options as Option[])
      : (options as string[]).map(v => ({ id: v, nome: v }));
    return (
      <select
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        value={form[field] || ''}
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
    <div className="mb-4">
      <h3 className="text-xs font-bold text-gray-700 border-b pb-1 mb-2 tracking-wide uppercase">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'dados-pessoais':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-sm font-bold text-gray-800">Dados Pessoais</h4>
              <button type="button" onClick={() => handleOcrDocument('rg')} disabled={ocrRunning}
                className="text-[11px] bg-purple-50 text-purple-700 px-3 py-1 rounded-lg border border-purple-200 hover:bg-purple-100 flex items-center gap-1 transition">
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
            </>)}
            {section('Nascimento', <>
              <div>{label('Data de Nascimento')}{input('data_nascimento', { type: 'date' })}</div>
              <div>{label('Sexo')}{select('sexo', ['Masculino', 'Feminino'])}</div>
              <div>{label('Gênero')}{input('genero')}</div>
              <div>{label('Estado Civil')}{select('estado_civil', ['Solteiro', 'Casado', 'Divorciado', 'Viúvo', 'União Estável'])}</div>
              <div>{label('Nacionalidade')}{input('nacionalidade')}</div>
              <div>{label('Naturalidade (Cidade)')}{input('naturalidade')}</div>
              <div>{label('Naturalidade UF')}{select('naturalidade_uf', ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])}</div>
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
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-sm font-bold text-gray-800">Documentos</h4>
              <button type="button" onClick={() => handleOcrDocument('ctps')} disabled={ocrRunning}
                className="text-[11px] bg-purple-50 text-purple-700 px-3 py-1 rounded-lg border border-purple-200 hover:bg-purple-100 flex items-center gap-1 transition">
                <span>{ocrRunning ? 'Processando...' : 'OCR Documento'}</span>
              </button>
            </div>
            {section('CTPS (Carteira de Trabalho)', <>
              <div>{label('Número CTPS')}{input('ctps')}</div>
              <div>{label('Série')}{input('ctps_serie')}</div>
              <div>{label('UF')}{select('ctps_uf', ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])}</div>
            </>)}
            {section('PIS/PASEP', <>
              <div>{label('Número PIS/PASEP')}{input('pis_pasep')}</div>
            </>)}
            {section('CNH (Carteira Nacional de Habilitação)', <>
              <div>{label('Número CNH')}{input('cnh')}</div>
              <div>{label('Categoria')}{select('cnh_categoria', ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'])}</div>
              <div>{label('Validade')}{input('cnh_validade', { type: 'date' })}</div>
              <div>{label('UF Emissão')}{select('cnh_uf', ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])}</div>
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
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-800 mb-1">Endereço</h4>
            {section('Endereço Residencial', <>
              <div className="lg:col-span-2">{label('Logradouro')}{input('endereco_logradouro')}</div>
              <div>{label('Número')}{input('endereco_numero')}</div>
              <div>{label('Complemento')}{input('endereco_complemento')}</div>
              <div>{label('Bairro')}{input('endereco_bairro')}</div>
              <div>{label('CEP')}{input('endereco_cep')}</div>
              <div>{label('Cidade')}{input('endereco_cidade')}</div>
              <div>{label('UF')}{select('endereco_uf', ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])}</div>
            </>)}
          </div>
        );

      case 'contato':
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-800 mb-1">Contato</h4>
            {section('Informações de Contato', <>
              <div>{label('E-mail')}{input('email', { type: 'email' })}</div>
              <div>{label('Telefone 1')}{input('telefone')}</div>
            </>)}
          </div>
        );

      case 'dados-bancarios':
        const bk = (form.dados_bancarios || {}) as Record<string, string>;
        const setBank = (f: string, v: string) => setForm(p => ({ ...p, dados_bancarios: { ...(p.dados_bancarios || {}), [f]: v } }));
        const bankInput = (field: string, placeholder?: string) => (
          <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={placeholder} value={bk[field] || ''} onChange={e => setBank(field, e.target.value)} />
        );
        const bankSelect = (field: string, opts: string[]) => (
          <select className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            value={bk[field] || ''} onChange={e => setBank(field, e.target.value)}>
            <option value="">Selecione...</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-800 mb-1">Dados Bancários</h4>
            {section('Banco', <>
              <div>{label('Código do Banco')}{bankInput('codigo', '001')}</div>
              <div>{label('Agência')}{bankInput('agencia')}</div>
              <div>{label('Conta')}{bankInput('conta')}</div>
              <div>{label('Tipo')}{bankSelect('tipo', ['Corrente', 'Poupança', 'Salário'])}</div>
            </>)}
          </div>
        );

      case 'vinculo':
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-800 mb-1">Vínculo Empregatício</h4>
            {section('Empresa e Cargo', <>
              <div>{label('Empresa')}{select('empresa_id', empresas)}</div>
              <div>{label('Cargo/Função')}{select('cargo_id', cargos)}</div>
              <div>{label('CBO')}{input('cbo', { placeholder: 'Código Brasileiro de Ocupações' })}</div>
              <div>{label('Centro de Custo')}{select('centro_custo_id', centrosCusto)}</div>
              <div>{label('Embarcação Atual')}{select('embarcacao_atual_id', embarcacoes)}</div>
              <div>{label('Departamento')}{input('departamento')}</div>
            </>)}
            {section('Datas', <>
              <div>{label('Data de Admissão')}{input('data_admissao', { type: 'date' })}</div>
              <div>{label('Data de Demissão')}{input('data_demissao', { type: 'date' })}</div>
              <div>{label('Motivo da Demissão')}{input('motivo_demissao')}</div>
            </>)}
            {section('Remuneração', <>
              <div>{label('Salário base (R$)')}{input('salario', { type: 'number' })}</div>
              <div>{label('Tipo de Salário')}{select('tipo_salario', ['Mensal', 'Por Hora', 'Por Dia', 'Comissionado'])}</div>
              <div>{label('Forma de Pagamento')}{select('forma_pagamento', ['Depósito', 'Cheque', 'Dinheiro', 'Pix'])}</div>
              <div>{label('Sindicato')}{input('sindicato')}</div>
            </>)}
            {section('Regime e Contrato', <>
              <div>{label('Regime de Trabalho')}{select('regime_trabalho', ['Offshore', 'Presencial', 'Híbrido', 'Home Office', 'Escala'])}</div>
              <div>{label('Tipo de Contrato')}{select('tipo_contrato', ['CLT', 'PJ', 'Temporário', 'Estágio', 'Autônomo'])}</div>
              <div>{label('Prazo do Contrato')}{input('prazo_contrato')}</div>
              <div>{label('Categoria do Contrato')}{input('categoria_contrato')}</div>
              <div>{label('Tipo de Trabalho')}{input('tipo_trabalho')}</div>
              <div>{label('Tipo de Mão de Obra')}{input('tipo_mao_de_obra')}</div>
              <div>{label('Escala Embarque')}{input('escala_embarque', { placeholder: 'Ex: 14x21' })}</div>
              <div>{label('Escala Folga')}{input('escala_folga', { placeholder: 'Ex: 21x14' })}</div>
              <div>{label('Jornada Semanal (Horas)')}{input('jornada_semanal')}</div>
              <div>{label('Jornada Mensal (Horas)')}{input('jornada_mensal')}</div>
              <div>{label('Status de Embarque')}{select('status_embarque', ['embarcado','standby','folga','desembarcado','afastado','ferias','treinamento'])}</div>
              <div>{label('Standby')}{select('standby', [{ id: 'true', nome: 'Sim' }, { id: 'false', nome: 'Não' }])}</div>
            </>)}
          </div>
        );

      case 'esocial':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-bold text-gray-800">e-Social</h4>
              <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded">Informações complementares para e-Social</span>
            </div>
            {section('Evento S-2200 (Cadastramento Inicial)', <>
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-[11px] text-gray-500 mb-2">
                  O evento S-2200 é gerado a partir dos dados das abas anteriores. Complete os campos abaixo requeridos para o e-Social.
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
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-[11px] text-gray-500">
                  Os exames ASO devem ser registrados no portal após o cadastro para envio do evento S-2220.
                </p>
              </div>
            </>)}
            {section('Condições Ambientais (S-2240)', <>
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-[11px] text-gray-500">
                  Os fatores de risco associados ao cargo/função serão herdados automaticamente.
                </p>
              </div>
            </>)}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Novo Colaborador</h2>
            <p className="text-xs text-gray-500">Cadastre um novo colaborador no sistema e inicie a geração do e-Social automaticamente</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Salvando...' : 'Salvar Colaborador'}
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6 bg-white overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {TABS.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors uppercase tracking-wider
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-white min-h-0">
          {renderTab()}
        </div>

        {/* Bottom Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <button type="button" onClick={() => {
            const idx = TABS.findIndex(t => t.id === activeTab);
            if (idx > 0) setActiveTab(TABS[idx - 1].id);
          }} disabled={activeTab === TABS[0].id}
            className="px-4 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition">
            Anterior
          </button>
          <button type="button" onClick={() => {
            const idx = TABS.findIndex(t => t.id === activeTab);
            if (idx < TABS.length - 1) { setActiveTab(TABS[idx + 1].id); }
            else handleSubmit();
          }}
            className="px-5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            {activeTab === TABS[TABS.length - 1].id ? 'Salvar' : 'Próximo'}
          </button>
        </div>

      </div>
    </div>
  );
}
