'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiUpload, FiCpu, FiCheckCircle, FiAlertCircle, FiSend, FiTrash, FiPlus } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { uploadDocumentoGt } from '@/lib/gestao-tripulantes/upload-client';
import { toast } from 'react-hot-toast';
import { cpfsMatch, formatCpf, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';

interface Collaborator {
  id: string;
  nome_completo: string;
  cpf: string;
  matricula?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportarASOModal({ isOpen, onClose, onSuccess }: Props) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [search, setSearch] = useState('');
  const [selectedColabId, setSelectedColabId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  // Pipeline steps: 'idle' | 'uploading' | 'ocr' | 'review' | 'saving'
  const [step, setStep] = useState<'idle' | 'uploading' | 'ocr' | 'review' | 'saving'>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [docId, setDocId] = useState<string | null>(null);

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  // Extracted/Editable fields
  const [tipoExame, setTipoExame] = useState('periodico');
  const [resultado, setResultado] = useState('apto');
  const [dataRealizacao, setDataRealizacao] = useState('');
  const [medicoNome, setMedicoNome] = useState('');
  const [medicoCrm, setMedicoCrm] = useState('');
  const [medicoUf, setMedicoUf] = useState('RJ');
  const [medicoPcmsoNome, setMedicoPcmsoNome] = useState('');
  const [medicoPcmsoCrm, setMedicoPcmsoCrm] = useState('');
  const [medicoPcmsoUf, setMedicoPcmsoUf] = useState('RJ');
  const [examesRealizados, setExamesRealizados] = useState<{ nome: string; data: string }[]>([]);
  const [nomeClinica, setNomeClinica] = useState('');
  const [ocrNome, setOcrNome] = useState('');
  const [ocrCpf, setOcrCpf] = useState('');
  const [identityMatch, setIdentityMatch] = useState<string | null>(null);
  const [canEditDocs, setCanEditDocs] = useState<boolean | null>(null);

  // Fetch collaborators + checa permissão de edição ANTES de upload/OCR,
  // para falhar rápido em vez de só no "Salvar & Enviar" (403 do PUT).
  useEffect(() => {
    async function loadCollaborators() {
      try {
        const res = await fetchWithToken('/api/gestao-tripulantes/colaboradores?limit=10000');
        if (res.ok) {
          const json = await res.json();
          setCollaborators(json.data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar colaboradores:', err);
      }
    }
    async function loadPermissions() {
      try {
        const res = await fetchWithToken('/api/gestao-tripulantes/documentos/permissions');
        if (res.ok) {
          const json = await res.json();
          setCanEditDocs(json.canEdit === true);
        } else {
          setCanEditDocs(false);
        }
      } catch (err) {
        console.error('Erro ao verificar permissões de documentos:', err);
        setCanEditDocs(false);
      }
    }
    if (isOpen) {
      loadCollaborators();
      loadPermissions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredColabs = collaborators.filter(c =>
    c.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf.includes(search)
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleStartPipeline = async () => {
    if (canEditDocs === false) {
      toast.error('Sem permissão para editar documentos do cadastro. Faça login com uma conta autorizada (ADMIN/MANAGER).');
      return;
    }
    if (!selectedColabId) {
      toast.error('Selecione um colaborador');
      return;
    }
    if (!file) {
      toast.error('Selecione um arquivo PDF de ASO');
      return;
    }

    try {
      // 1. Upload ASO Document
      setStep('uploading');
      // Title is storage label only — identity comes from OCR, never from filename.
      // Datas ficam vazias de propósito: o OCR grava emissão/validade reais.
      const uploadData = await uploadDocumentoGt({
        file,
        colaboradorId: selectedColabId,
        tipoDocumento: 'aso',
        titulo: 'ASO',
      });

      const uploadedDocId = uploadData.data.id;
      const uploadedDocUrl = uploadData.data.arquivo_url;
      setDocId(uploadedDocId);

      // 2. Execute OCR
      setStep('ocr');
      setOcrProgress(10);

      const { extractTextFromPdfOrImageClient } = await import('@/lib/ocr/pdf-to-images-client');
      
      const text = await extractTextFromPdfOrImageClient(uploadedDocUrl, (msg) => {
        console.log(`[OCR/Client] ${msg}`);
        if (msg.includes('Baixando')) setOcrProgress(20);
        else if (msg.includes('Verificando') || msg.includes('digital')) setOcrProgress(40);
        else if (msg.includes('Renderizando')) {
          const pageMatch = msg.match(/página (\d+) de (\d+)/);
          if (pageMatch) {
            const current = parseInt(pageMatch[1]);
            const total = parseInt(pageMatch[2]);
            setOcrProgress(40 + Math.round((current / total) * 30));
          } else {
            setOcrProgress(50);
          }
        } else if (msg.includes('Executando OCR')) {
          const pageMatch = msg.match(/página (\d+) de (\d+)/);
          if (pageMatch) {
            const current = parseInt(pageMatch[1]);
            const total = parseInt(pageMatch[2]);
            setOcrProgress(70 + Math.round((current / total) * 20));
          } else {
            setOcrProgress(80);
          }
        }
      });

      const ocrRes = await fetchWithToken(`/api/gestao-tripulantes/documentos/${uploadedDocId}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      setOcrProgress(100);

      if (!ocrRes.ok) {
        const errJson = await ocrRes.json();
        throw new Error(errJson.error || 'Falha ao executar o OCR do documento');
      }

      toast.success('OCR concluído com sucesso!');

      // 3. Fetch Extracted Data via API (includes gt_documentos_aso + OCR identity)
      let asoData: Record<string, any> | null = null;
      let ocrDados: Record<string, any> | null = null;
      try {
        const docRes = await fetchWithToken(`/api/gestao-tripulantes/documentos/${uploadedDocId}`);
        if (docRes.ok) {
          const docJson = await docRes.json();
          asoData = docJson.data?.aso || null;
          ocrDados = docJson.data?.ocr_dados_extraidos || null;
        }
      } catch (fetchErr) {
        console.warn('Falha ao buscar dados do ASO via API, usando fallback vazio', fetchErr);
      }

      if (!asoData) {
        console.warn('Dados do ASO não encontrados no banco, usando fallback vazio');
      }

      const extractedCpf = normalizeCpf(asoData?.cpf_documento || ocrDados?.cpf || '');
      const extractedNome = ocrDados?.nome_completo || '';
      setOcrCpf(extractedCpf);
      setOcrNome(extractedNome);
      setIdentityMatch(asoData?.identity_match || null);

      // If OCR reassigned/quarantined away from selected colab, warn
      const selected = collaborators.find(c => c.id === selectedColabId);
      const selectedCpf = normalizeCpf(selected?.cpf || '');
      if (extractedCpf.length === 11 && selectedCpf && !cpfsMatch(extractedCpf, selectedCpf)) {
        toast.error(
          `CPF do ASO (${formatCpf(extractedCpf)}) difere do colaborador selecionado (${formatCpf(selectedCpf)}). Envio ao e-Social ficará bloqueado.`,
          { duration: 6000 }
        );
      }

      // Pre-populate reviewed fields
      setTipoExame(asoData?.tipo_exame || 'periodico');
      setResultado(asoData?.resultado || 'apto');
      setDataRealizacao(asoData?.data_realizacao || new Date().toISOString().split('T')[0]);
      setMedicoNome(asoData?.medico_nome || '');
      setMedicoCrm(asoData?.medico_crm || '');
      setMedicoUf(asoData?.medico_uf || 'RJ');
      setMedicoPcmsoNome(asoData?.medico_pcmso_nome || '');
      setMedicoPcmsoCrm(asoData?.medico_pcmso_crm || '');
      setMedicoPcmsoUf(asoData?.medico_pcmso_uf || 'RJ');
      setExamesRealizados(asoData?.exames_realizados || []);
      setNomeClinica(asoData?.nome_clinica || '');

      setStep('review');
    } catch (err: any) {
      toast.error(err.message || 'Erro durante o processamento do ASO');
      setStep('idle');
      setOcrProgress(0);
    }
  };

  const handleSaveAndGenerateEvent = async () => {
    if (!docId) return;

    const selected = collaborators.find(c => c.id === selectedColabId);
    const selectedCpf = normalizeCpf(selected?.cpf || '');
    if (identityMatch === 'quarantine') {
      toast.error('ASO em quarentena de identidade — corrija o vínculo antes de enviar.');
      return;
    }
    if (ocrCpf.length === 11 && selectedCpf && !cpfsMatch(ocrCpf, selectedCpf)) {
      toast.error(`CPF OCR (${formatCpf(ocrCpf)}) ≠ perfil (${formatCpf(selectedCpf)}). Envio bloqueado.`);
      return;
    }

    try {
      setStep('saving');

      // Update the fields in gt_documentos_aso via API
      const saveRes = await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aso: {
            tipo_exame: tipoExame,
            resultado: resultado,
            data_realizacao: dataRealizacao,
            medico_nome: medicoNome || null,
            medico_crm: medicoCrm || null,
            medico_uf: medicoUf || null,
            medico_pcmso_nome: medicoPcmsoNome || null,
            medico_pcmso_crm: medicoPcmsoCrm || null,
            medico_pcmso_uf: medicoPcmsoUf || null,
            exames_realizados: examesRealizados.length > 0 ? examesRealizados : null,
            nome_clinica: nomeClinica || null,
          }
        }),
      });

      if (!saveRes.ok) {
        const errJson = await saveRes.json();
        throw new Error(errJson.error || 'Erro ao salvar edições nos metadados do ASO.');
      }

      // Trigger the e-Social event generation
      const esocialRes = await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}/esocial`, {
        method: 'POST',
      });

      if (!esocialRes.ok) {
        const errJson = await esocialRes.json();
        throw new Error(errJson.error || 'Erro ao gerar evento e-Social.');
      }

      toast.success('ASO processado e enviado para a fila de revisão do e-Social!');
      onSuccess();
      onClose();
      resetState();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar e-Social.');
      setStep('review');
    }
  };

  const resetState = () => {
    setSelectedColabId('');
    setSearch('');
    setFile(null);
    setStep('idle');
    setOcrProgress(0);
    setDocId(null);
    setTipoExame('periodico');
    setResultado('apto');
    setDataRealizacao('');
    setMedicoNome('');
    setMedicoCrm('');
    setMedicoUf('RJ');
    setMedicoPcmsoNome('');
    setMedicoPcmsoCrm('');
    setMedicoPcmsoUf('RJ');
    setExamesRealizados([]);
    setNomeClinica('');
    setOcrNome('');
    setOcrCpf('');
    setIdentityMatch(null);
  };

  const selectedColab = collaborators.find(c => c.id === selectedColabId);
  const selectedCpfNorm = normalizeCpf(selectedColab?.cpf || '');
  const identityBlocked =
    identityMatch === 'quarantine' ||
    (ocrCpf.length === 11 && selectedCpfNorm.length === 11 && !cpfsMatch(ocrCpf, selectedCpfNorm));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Importar ASO (OCR)</h3>
            <p className="text-xs text-slate-500">Faça o upload do ASO e preencha automaticamente o e-Social via OCR</p>
          </div>
          <button
            onClick={() => { onClose(); resetState(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {canEditDocs === false && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-700">
              <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold leading-relaxed">
                Sem permissão para editar documentos do cadastro. Esta conta não pode importar ASO nem enviar ao e-Social — faça login com uma conta autorizada (ADMIN/MANAGER).
              </p>
            </div>
          )}
          {step === 'idle' && (
            <div className="space-y-4">
              {/* Colaborador */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Colaborador</label>
                <input
                  type="text"
                  placeholder="Filtrar colaborador por nome ou CPF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                
                <select
                  value={selectedColabId}
                  onChange={(e) => setSelectedColabId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mt-2 max-h-40 overflow-y-auto"
                  size={5}
                >
                  <option value="" disabled className="text-slate-400">-- Selecione um Colaborador --</option>
                  {filteredColabs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome_completo} (CPF: {c.cpf})
                    </option>
                  ))}
                  {filteredColabs.length === 0 && (
                    <option disabled className="text-slate-400">Nenhum colaborador encontrado</option>
                  )}
                </select>
              </div>

              {/* Upload area */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Arquivo PDF do ASO</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors relative bg-slate-50/50 hover:bg-blue-50/10 group">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FiUpload className="w-8 h-8 mx-auto text-slate-400 group-hover:text-blue-500 transition-colors mb-2" />
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-600">Arraste ou clique para selecionar</p>
                      <p className="text-xs text-slate-400 mt-1">Apenas formato PDF (max. 20MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(step === 'uploading' || step === 'ocr') && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
                <FiCpu className="absolute w-6 h-6 text-blue-600 animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-800">
                  {step === 'uploading' ? 'Fazendo upload do arquivo...' : 'Processando OCR no documento...'}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {step === 'uploading' ? 'Enviando PDF para o servidor de armazenamento seguro.' : 'Extraindo texto e estruturando campos do ASO utilizando inteligência artificial.'}
                </p>
              </div>
              {step === 'ocr' && (
                <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className={`p-3 border rounded-lg flex items-start gap-2.5 ${
                identityBlocked
                  ? 'bg-red-50 border-red-100'
                  : 'bg-emerald-50 border-emerald-100'
              }`}>
                {identityBlocked ? (
                  <FiAlertCircle className="text-red-600 w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <FiCheckCircle className="text-emerald-600 w-5 h-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className={`text-xs font-bold ${identityBlocked ? 'text-red-800' : 'text-emerald-800'}`}>
                    {identityBlocked ? 'Identidade OCR não confere' : 'OCR Executado com Sucesso!'}
                  </h4>
                  <p className={`text-[11px] mt-0.5 ${identityBlocked ? 'text-red-600' : 'text-emerald-600'}`}>
                    Nome: {ocrNome || '—'} · CPF: {ocrCpf ? formatCpf(ocrCpf) : 'não extraído'}
                    {selectedCpfNorm ? ` · Perfil: ${formatCpf(selectedCpfNorm)}` : ''}
                    {identityMatch ? ` · Match: ${identityMatch}` : ''}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${identityBlocked ? 'text-red-600' : 'text-emerald-600'}`}>
                    {identityBlocked
                      ? 'Envio ao e-Social bloqueado até corrigir o vínculo (CPF-only).'
                      : 'Revise os dados extraídos abaixo antes de confirmar o envio ao e-Social.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* DADOS DO EXAME */}
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Dados do Exame</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Tipo de Exame</label>
                      <select
                        value={tipoExame}
                        onChange={(e) => setTipoExame(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800"
                      >
                        <option value="admissional">Admissional</option>
                        <option value="periodico">Periódico</option>
                        <option value="demissional">Demissional</option>
                        <option value="retorno">Retorno ao Trabalho</option>
                        <option value="mudanca_funcao">Mudança de Função</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Resultado</label>
                      <select
                        value={resultado}
                        onChange={(e) => setResultado(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800"
                      >
                        <option value="apto">Apto</option>
                        <option value="inapto">Inapto</option>
                        <option value="apto_condicional">Apto Condicional</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Data de Realização</label>
                      <input
                        type="date"
                        value={dataRealizacao}
                        onChange={(e) => setDataRealizacao(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Clínica Emissora</label>
                      <input
                        type="text"
                        value={nomeClinica}
                        onChange={(e) => setNomeClinica(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                        placeholder="Nome da clínica ou laboratório"
                      />
                    </div>
                  </div>
                </div>

                {/* MEDICO EXAMINADOR */}
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Médico Examinador</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Nome do Médico</label>
                      <input
                        type="text"
                        value={medicoNome}
                        onChange={(e) => setMedicoNome(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                        placeholder="Nome completo do médico"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">CRM</label>
                        <input
                          type="text"
                          value={medicoCrm}
                          onChange={(e) => setMedicoCrm(e.target.value)}
                          className="w-full px-1 py-1.5 text-xs rounded-lg border border-slate-200 outline-none text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                          placeholder="Ex: 12345"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">UF</label>
                        <select
                          value={medicoUf}
                          onChange={(e) => setMedicoUf(e.target.value)}
                          className="w-full px-1 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800"
                        >
                          {UFS.map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COORDENADOR PCMSO */}
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Médico Coordenador do PCMSO</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Nome do Médico Coordenador</label>
                      <input
                        type="text"
                        value={medicoPcmsoNome}
                        onChange={(e) => setMedicoPcmsoNome(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                        placeholder="Nome do coordenador"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">CRM</label>
                        <input
                          type="text"
                          value={medicoPcmsoCrm}
                          onChange={(e) => setMedicoPcmsoCrm(e.target.value)}
                          className="w-full px-1 py-1.5 text-xs rounded-lg border border-slate-200 outline-none text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white"
                          placeholder="Ex: 12345"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500">UF</label>
                        <select
                          value={medicoPcmsoUf}
                          onChange={(e) => setMedicoPcmsoUf(e.target.value)}
                          className="w-full px-1 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-slate-800"
                        >
                          {UFS.map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXAMES COMPLEMENTARES */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Exames e Procedimentos</h4>
                    <button
                      type="button"
                      onClick={() => setExamesRealizados([...examesRealizados, { nome: '', data: dataRealizacao || new Date().toISOString().split('T')[0] }])}
                      className="px-2 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded flex items-center gap-1 transition-colors bg-white shadow-sm"
                    >
                      <FiPlus size={10} /> Add Exame
                    </button>
                  </div>

                  {examesRealizados.length === 0 ? (
                    <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <p className="text-[11px] text-slate-400">Nenhum exame complementar cadastrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {examesRealizados.map((ex, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <input
                            type="text"
                            value={ex.nome}
                            onChange={(e) => {
                              const updated = [...examesRealizados];
                              updated[idx].nome = e.target.value;
                              setExamesRealizados(updated);
                            }}
                            placeholder="Nome do exame (Ex: ACUIDADE VISUAL)"
                            className="flex-1 px-2.5 py-1 text-xs rounded border border-slate-200 outline-none focus:border-blue-500 text-slate-800 bg-white"
                          />
                          <input
                            type="date"
                            value={ex.data}
                            onChange={(e) => {
                              const updated = [...examesRealizados];
                              updated[idx].data = e.target.value;
                              setExamesRealizados(updated);
                            }}
                            className="w-28 px-2 py-1 text-xs rounded border border-slate-200 outline-none focus:border-blue-500 text-slate-800 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setExamesRealizados(examesRealizados.filter((_, i) => i !== idx));
                            }}
                            className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <FiTrash size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin"></div>
              <h4 className="text-sm font-bold text-slate-800">Salvando e Gerando Evento...</h4>
              <p className="text-xs text-slate-400">Gravando dados estruturados do ASO e enfileirando o evento S-2220 do e-Social.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          {step === 'idle' && (
            <>
              <button
                onClick={() => { onClose(); resetState(); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleStartPipeline}
                disabled={!selectedColabId || !file || canEditDocs === false}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1.5"
              >
                <FiCpu className="w-3.5 h-3.5" />
                Upload e Processar OCR
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={resetState}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Refazer Upload
              </button>
              <button
                onClick={handleSaveAndGenerateEvent}
                disabled={identityBlocked}
                title={identityBlocked ? 'Bloqueado: CPF OCR ≠ perfil' : undefined}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
              >
                <FiSend className="w-3.5 h-3.5" />
                Salvar & Enviar ao e-Social
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
