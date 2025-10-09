"use client";

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import { fetchWithToken } from '@/lib/tokenStorage';
import CertificateTemplateEditor from '@/components/Academy/CertificateTemplateEditor';

export default function CertificatesAdminPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('Template');
  const [courseId, setCourseId] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetchWithToken('/api/admin/academy/certificates/templates');
      const data = await res.json();
      setTemplates(data?.templates || []);
    } catch (e) {
      console.error(e);
      showToast('Falha ao carregar templates');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTemplates(); }, []);

  const initFromRepo = async () => {
    try {
      setLoading(true);
      const res = await fetchWithToken('/api/admin/academy/certificates/templates/init', { method: 'POST' });
      if (!res.ok) throw new Error('init error');
      await loadTemplates();
      showToast('Template inicial carregado do repositório');
    } catch (e) {
      console.error(e);
      showToast('Falha ao inicializar do repo');
    } finally { setLoading(false); }
  };

  const uploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { showToast('Selecione um arquivo PDF'); return; }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      if (courseId) form.append('course_id', courseId);
      if (configJson) form.append('config_json', configJson);
      const res = await fetchWithToken('/api/admin/academy/certificates/templates/upload', { method: 'POST', body: form as any });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'upload error');
      showToast('Template enviado');
      setFile(null); setName('Template'); setCourseId(''); setConfigJson('');
      await loadTemplates();
    } catch (e) {
      console.error(e);
      showToast('Falha ao enviar template');
    } finally { setLoading(false); }
  };
  const editTemplate = async (t: any) => {
    try {
      setLoading(true);
      setSelectedTemplate(t);
      setName(t.name || 'Template');
      setCourseId(t.course_id || '');
      setConfigJson(JSON.stringify(t.config_json || { page: 1, fields: {} }, null, 2));
      setFile(null);
      const res = await fetchWithToken(`/api/admin/academy/certificates/templates/signed-url?path=${encodeURIComponent(t.storage_path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'signed url error');
      setPreviewUrl(data.signedUrl);
      showToast('Template carregado para edição');
    } catch (e) {
      console.error(e);
      showToast('Falha ao carregar template');
    } finally {
      setLoading(false);
    }
  };

  const saveSelectedTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      setLoading(true);
      let parsed: any = {};
      try { parsed = configJson ? JSON.parse(configJson) : {}; } catch { showToast('JSON inválido'); setLoading(false); return; }
      const res = await fetchWithToken(`/api/admin/academy/certificates/templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, course_id: courseId || null, config_json: parsed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'update error');
      showToast('Template atualizado');
      await loadTemplates();
    } catch (e) {
      console.error(e);
      showToast('Falha ao salvar alterações');
    } finally {
      setLoading(false);
    }
  };


  return (
    <ProtectedRoute managerOnly>
      <MainLayout>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Certificados - Templates</h1>
            <button onClick={initFromRepo} className="px-3 py-2 bg-indigo-600 text-white rounded">Usar template do repositório</button>
          </div>

          {toast && <div className="p-3 bg-blue-50 text-blue-700 rounded border border-blue-200">{toast}</div>}

          <div className="bg-white border border-gray-200 rounded p-4">
            <h2 className="text-lg font-semibold mb-3">Enviar novo template (PDF)</h2>
            <form onSubmit={uploadTemplate} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Arquivo PDF</label>
                <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nome</label>
                <input value={name} onChange={e => setName(e.target.value)} className="border px-3 py-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Course ID (opcional)</label>
                <input value={courseId} onChange={e => setCourseId(e.target.value)} className="border px-3 py-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Config JSON (posições)</label>
                <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} rows={8} className="border px-3 py-2 rounded w-full font-mono text-sm" placeholder='{"page":1, "fields": {"student_name": {"x": 200, "y": 360, "size": 24}}}' />
                <CertificateTemplateEditor file={file} url={previewUrl} configJson={configJson} onChangeConfig={setConfigJson} />
              </div>
              <div className="flex items-center gap-3">
                <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">{loading ? 'Processando...' : 'Salvar template (novo)'}</button>
                {selectedTemplate && (
                  <button type="button" onClick={saveSelectedTemplate} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded">
                    {loading ? 'Salvando...' : 'Salvar alterações do template selecionado'}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded p-4">
            <h2 className="text-lg font-semibold mb-3">Templates existentes</h2>
            {loading ? <div>Carregando...</div> : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className="p-3 border rounded flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-sm text-gray-600">course_id: {t.course_id || 'Global'} | path: {t.storage_path} | ativo: {String(t.active)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>editTemplate(t)} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border">Editar</button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && <div className="text-sm text-gray-600">Nenhum template cadastrado.</div>}
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}


