"use client";

import React, { useEffect, useState } from "react";
import { FiBell, FiSave, FiSend, FiRefreshCw } from "react-icons/fi";
import { fetchWithToken } from "@/lib/tokenStorage";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";

interface NotificationSettings {
  autoNotifyNewsPosts: boolean;
  newsPostTitle: string;
  newsPostMessage: string;
  defaultPriority: "low" | "normal" | "high" | "urgent";
  defaultExpiresDays: number;
}

export default function AdminNotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Broadcast form
  const [bTitle, setBTitle] = useState("");
  const [bMessage, setBMessage] = useState("");
  const [bUrl, setBUrl] = useState("");
  const [bPriority, setBPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [bExpiresAt, setBExpiresAt] = useState<string>("");
  const [bRoles, setBRoles] = useState<string[]>([]);
  const [bUserIds, setBUserIds] = useState<string>("");
  const [bIncludeInactive, setBIncludeInactive] = useState(false);
  const [bIgnorePrefs, setBIgnorePrefs] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [vapidPublic, setVapidPublic] = useState<string | null>(null);
  const [vapidLoading, setVapidLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetchWithToken("/api/admin/notifications/settings");
      const data = await res.json();
      setSettings(data as NotificationSettings);
    } catch (e) {
      console.error(e);
      showToast("Falha ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadVapid();
  }, []);

  const loadVapid = async () => {
    try {
      setVapidLoading(true);
      const res = await fetchWithToken('/api/admin/notifications/push/vapid');
      const data = await res.json();
      setVapidPublic(data?.publicKey || null);
    } catch (e) {
      console.error(e);
    } finally {
      setVapidLoading(false);
    }
  };

  const generateVapid = async () => {
    try {
      setVapidLoading(true);
      const res = await fetchWithToken('/api/admin/notifications/push/vapid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotate: !vapidPublic })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'vapid error');
      setVapidPublic(data?.publicKey || null);
      showToast('Chaves VAPID configuradas');
    } catch (e) {
      console.error(e);
      showToast('Falha ao configurar VAPID');
    } finally {
      setVapidLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const res = await fetchWithToken("/api/admin/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error("save error");
      showToast("Configurações salvas");
    } catch (e) {
      console.error(e);
      showToast("Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcast = async () => {
    if (!bTitle.trim()) {
      showToast("Título é obrigatório");
      return;
    }
    try {
      setSending(true);
      const roles = bRoles;
      const user_ids = bUserIds
        .split(/[,\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
      const res = await fetchWithToken("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bTitle,
          message: bMessage,
          action_url: bUrl || undefined,
          priority: bPriority,
          expires_at: bExpiresAt || undefined,
          roles: roles.length ? roles : undefined,
          user_ids: user_ids.length ? user_ids : undefined,
          includeInactive: bIncludeInactive,
          ignorePrefs: bIgnorePrefs
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "broadcast error");
      showToast(`Notificações enviadas: ${data.inserted || 0}`);
      // Clean form
      setBTitle(""); setBMessage(""); setBUrl(""); setBUserIds(""); setBRoles([]); setBIncludeInactive(false);
    } catch (e) {
      console.error(e);
      showToast("Falha ao enviar notificações");
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute managerOnly>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FiBell className="w-6 h-6 text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          </div>
          <button onClick={loadSettings} className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600">
            <FiRefreshCw className="w-4 h-4" /><span>Atualizar</span>
          </button>
        </div>

        {toast && (
          <div className="p-3 bg-blue-50 text-blue-700 rounded border border-blue-200">{toast}</div>
        )}


        {/* Web Push */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Web Push</h2>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {vapidLoading ? 'Verificando chaves...' : vapidPublic ? 'Chave pública configurada' : 'Chaves VAPID ausentes'}
            </div>
            <button onClick={generateVapid} disabled={vapidLoading} className="px-3 py-2 bg-indigo-600 text-white rounded">
              {vapidLoading ? 'Processando...' : (vapidPublic ? 'Rotacionar chaves' : 'Gerar chaves')}
            </button>
          </div>
        </div>

        {/* Configurações Globais */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Configurações Globais</h2>
          {loading || !settings ? (
            <div className="text-gray-500">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.autoNotifyNewsPosts}
                  onChange={(e) => setSettings({ ...settings, autoNotifyNewsPosts: e.target.checked })}
                />
                <span>Notificar automaticamente novos posts de notícias</span>
              </label>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Título padrão</label>
                <input
                  type="text"
                  value={settings.newsPostTitle}
                  onChange={(e) => setSettings({ ...settings, newsPostTitle: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Mensagem padrão</label>
                <input
                  type="text"
                  value={settings.newsPostMessage}
                  onChange={(e) => setSettings({ ...settings, newsPostMessage: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Use {{author}} e {{title}} como variáveis"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Prioridade padrão</label>
                  <select
                    value={settings.defaultPriority}
                    onChange={(e) => setSettings({ ...settings, defaultPriority: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Expiração padrão (dias)</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.defaultExpiresDays}
                    onChange={(e) => setSettings({ ...settings, defaultExpiresDays: Number(e.target.value || 0) })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button onClick={saveSettings} disabled={saving} className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  <FiSave className="w-4 h-4" />
                  <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Envio Manual (Broadcast) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Envio Manual</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Título</label>
              <input value={bTitle} onChange={(e) => setBTitle(e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Mensagem</label>
              <textarea value={bMessage} onChange={(e) => setBMessage(e.target.value)} className="w-full px-3 py-2 border rounded" rows={3} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Link (opcional)</label>
                <input value={bUrl} onChange={(e) => setBUrl(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Prioridade</label>
                <select value={bPriority} onChange={(e) => setBPriority(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Expira em (ISO opcional)</label>
                <input type="datetime-local" value={bExpiresAt} onChange={(e) => setBExpiresAt(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Filtrar por papéis (roles)</label>
                <div className="flex gap-3">
                  {['ADMIN','MANAGER','USER'].map(r => (
                    <label key={r} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={bRoles.includes(r)} onChange={(e) => {
                        setBRoles(prev => e.target.checked ? [...prev, r] : prev.filter(x => x !== r));
                      }} /> {r}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ou IDs de usuários (separados por vírgula)</label>
                <input value={bUserIds} onChange={(e) => setBUserIds(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="uuid1, uuid2, ..." />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={bIncludeInactive} onChange={(e) => setBIncludeInactive(e.target.checked)} />
              <span>Incluir usuários inativos</span>
            </label>

            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={bIgnorePrefs} onChange={(e) => setBIgnorePrefs(e.target.checked)} />
              <span>Ignorar preferências dos usuários (enviar para todos selecionados)</span>
            </label>

            {/* Pré-visualização */}
            <div className="mt-4 p-4 border rounded bg-gray-50">
              <div className="text-sm text-gray-500 mb-2">Pré-visualização</div>
              <div className="bg-white border rounded p-3">
                <div className="font-semibold">{bTitle || '(Título)'}</div>
                {bMessage && (<div className="text-sm text-gray-700 mt-1 whitespace-pre-line">{bMessage}</div>)}
                {bUrl && (
                  <div className="mt-2">
                    <a className="text-blue-600 underline text-sm" href={bUrl} target="_blank" rel="noreferrer">{bUrl}</a>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button onClick={sendBroadcast} disabled={sending} className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                <FiSend className="w-4 h-4" />
                <span>{sending ? 'Enviando...' : 'Enviar Notificação'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

