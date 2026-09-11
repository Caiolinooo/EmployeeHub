'use client';

import { useState } from 'react';
import { FiDownload, FiEye, FiFolder, FiFileText, FiAlertTriangle, FiSave } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

interface PreviewTree {
  success: boolean;
  template: string;
  total_funcionarios: number;
  total_documentos: number;
  total_sem_arquivo: number;
  tree: { path: string; arquivos: string[] }[];
  avisos: string[];
  presets?: { id: string; label: string; template: string }[];
  placeholders?: string[];
  limites?: { padrao: number; maximo: number };
}

const DEFAULT_TEMPLATE = 'empresa/centro_custo/funcionario/tipo_documento';

export default function ExportarTab() {
  const [funcionarios, setFuncionarios] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [limite, setLimite] = useState(50);
  const [preview, setPreview] = useState<PreviewTree | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingTpl, setIsSavingTpl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const buildQuery = (withPreview: boolean) => {
    const params = new URLSearchParams();
    if (funcionarios.trim()) params.set('funcionarios', funcionarios.trim());
    if (empresa.trim()) params.set('empresa', empresa.trim());
    if (centroCusto.trim()) params.set('centro_custo', centroCusto.trim());
    if (template.trim()) params.set('template', template.trim());
    if (limite > 0) params.set('limite', String(limite));
    if (withPreview) params.set('preview', '1');
    return params.toString();
  };

  const handlePreview = async () => {
    setIsLoadingPreview(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/export?${buildQuery(true)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `Erro ${res.status} no preview`);
        setPreview(null);
      } else {
        setPreview(data);
      }
    } catch {
      setError('Falha de conexão ao gerar preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/export?${buildQuery(false)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Erro ${res.status} na exportação`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cd);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = m?.[1] || 'gestao-tripulantes_export.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const avisosEnc = res.headers.get('X-Export-Avisos');
      const nDocs = res.headers.get('X-Export-Documentos');
      const nFunc = res.headers.get('X-Export-Funcionarios');
      let msg = `Download iniciado: ${nFunc ?? '?'} funcionários, ${nDocs ?? '?'} arquivos de documentos.`;
      if (avisosEnc) {
        try {
          const avisos = decodeURIComponent(avisosEnc).split(' | ');
          msg += ` Avisos: ${avisos.slice(0, 3).join('; ')}${avisos.length > 3 ? '…' : ''}`;
        } catch { /* ignore */ }
      }
      setMessage(msg);
    } catch {
      setError('Falha ao baixar o arquivo .zip');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSalvarTemplate = async () => {
    setIsSavingTpl(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Erro ao salvar template');
      } else {
        setMessage(`Template salvo como padrão: ${data.template}`);
        if (typeof data.template === 'string') setTemplate(data.template);
      }
    } catch {
      setError('Falha ao salvar o template');
    } finally {
      setIsSavingTpl(false);
    }
  };

  const presets = preview?.presets || [];
  const placeholders = preview?.placeholders || ['empresa', 'centro_custo', 'funcionario', 'cpf', 'cargo', 'tipo_documento', 'ano'];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Exportar Documentos e Dados</h3>
        <p className="text-sm text-gray-500">
          Gera um .zip com os documentos originais do Supabase Storage organizados por pasta, mais resumos JSON/CSV por funcionário.
          Placeholders disponíveis: {placeholders.map((p) => `{${p}}`).join(', ')}.
        </p>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Funcionários (ids ou nomes, separados por vírgula)</label>
          <input
            type="text"
            value={funcionarios}
            onChange={(e) => setFuncionarios(e.target.value)}
            placeholder="ex.: João Silva, 8f0e..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Empresa</label>
          <input
            type="text"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="id ou parte do nome"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Centro de Custo</label>
          <input
            type="text"
            value={centroCusto}
            onChange={(e) => setCentroCusto(e.target.value)}
            placeholder="id ou parte do nome"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {/* Template */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Template de pastas (níveis separados por /)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
            <button
              onClick={handleSalvarTemplate}
              disabled={isSavingTpl}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap text-sm flex items-center"
              title="Salvar como template padrão"
            >
              <FiSave className="mr-1" /> Salvar padrão
            </button>
          </div>
          {presets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTemplate(p.template)}
                  className={`px-2 py-1 text-xs rounded border ${
                    template === p.template
                      ? 'bg-abz-blue text-white border-abz-blue'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={p.template}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Limite de funcionários por exportação</label>
          <input
            type="number"
            min={1}
            max={200}
            value={limite}
            onChange={(e) => setLimite(parseInt(e.target.value, 10) || 50)}
            className="w-full md:w-40 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Proteção contra estouro de memória: máximo 200 funcionários e ~250MB de arquivos por requisição.
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handlePreview}
          disabled={isLoadingPreview}
          className="flex items-center px-4 py-2 bg-white border border-abz-blue text-abz-blue rounded-md hover:bg-blue-50 disabled:opacity-50"
        >
          <FiEye className="mr-2" />
          {isLoadingPreview ? 'Gerando...' : 'Visualizar árvore'}
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <FiDownload className="mr-2" />
          {isDownloading ? 'Preparando download...' : 'Baixar .zip'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
      )}
      {message && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">{message}</div>
      )}

      {/* Preview da árvore */}
      {preview && (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span><strong>{preview.total_funcionarios}</strong> funcionários</span>
            <span><strong>{preview.total_documentos}</strong> documentos</span>
            {preview.total_sem_arquivo > 0 && (
              <span className="text-orange-600"><strong>{preview.total_sem_arquivo}</strong> sem arquivo no Storage</span>
            )}
            <span className="font-mono text-xs text-gray-500">{preview.template}</span>
          </div>
          {(preview?.avisos?.length ?? 0) > 0 && (
            <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-800 flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 shrink-0" />
              <span>{preview.avisos.join('; ')}</span>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
            {(preview?.tree || []).map((dir) => (
              <div key={dir.path} className="mb-2">
                <div className="flex items-center text-gray-700">
                  <FiFolder className="mr-1 shrink-0" /> {dir.path}/
                </div>
                {dir.arquivos.map((f) => (
                  <div key={f} className="flex items-center text-gray-400 pl-5">
                    <FiFileText className="mr-1 shrink-0" /> {f}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
