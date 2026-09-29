'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import {
    FiServer, FiRefreshCw, FiCheck, FiX, FiPlus, FiTrash2,
    FiFolder, FiFile, FiChevronRight, FiChevronDown,
    FiPlay, FiClock, FiAlertTriangle, FiSave, FiEye, FiEyeOff,
    FiActivity, FiDatabase, FiSettings, FiLink, FiDownload,
    FiUpload, FiFolderPlus, FiEdit2
} from 'react-icons/fi';

interface SmbConnection {
    id?: string;
    name: string;
    host: string;
    share: string;
    domain: string;
    username: string;
    password?: string;
    base_path: string;
    port: number;
    is_active: boolean;
    sync_target_category: string;
    last_sync_at?: string;
    last_sync_status?: string;
    last_sync_files_count?: number;
    last_sync_error?: string;
    local_path?: string;
}

interface SmbFile {
    name: string;
    path: string;
    isDirectory: boolean;
}

interface SyncLog {
    id: string;
    status: string;
    files_synced: number;
    files_failed: number;
    files_skipped: number;
    error_message?: string;
    started_at: string;
    completed_at?: string;
}

const emptyConnection: SmbConnection = {
    name: '',
    host: '',
    share: '',
    domain: '',
    username: '',
    password: '',
    base_path: '',
    port: 445,
    is_active: true,
    sync_target_category: 'Políticas Internas',
};

export default function SmbConnectorPage() {
    const { profile } = useSupabaseAuth();
    const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'admin';

    // State
    const [connections, setConnections] = useState<SmbConnection[]>([]);
    const [selectedConn, setSelectedConn] = useState<SmbConnection | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<SmbConnection>(emptyConnection);
    const [showPassword, setShowPassword] = useState(false);
    const [connectionType, setConnectionType] = useState<'smb' | 'local'>('smb');

    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);


    const [files, setFiles] = useState<SmbFile[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [isBrowsing, setIsBrowsing] = useState(false);

    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);

    const [activeTab, setActiveTab] = useState<'config' | 'browser' | 'sync'>('config');
    const [loading, setLoading] = useState(true);

    // Fetch connections
    const fetchConnections = useCallback(async () => {
        try {
            const res = await fetchWithToken('/api/smb/config');
            if (res.ok) {
                const data = await res.json();
                setConnections(data);
                if (data.length > 0 && !selectedConn) {
                    setSelectedConn(data[0]);
                }
            }
        } catch (e) {
            console.error('Failed to fetch connections:', e);
        } finally {
            setLoading(false);
        }
    }, [selectedConn]);

    useEffect(() => {
        if (isAdmin) fetchConnections();
    }, [isAdmin, fetchConnections]);

    // Fetch sync logs when connection changes
    useEffect(() => {
        if (selectedConn?.id) {
            fetchWithToken(`/api/smb/sync?connection_id=${selectedConn.id}`)
                .then(r => r.json())
                .then(data => setSyncLogs(Array.isArray(data) ? data : []))
                .catch(() => setSyncLogs([]));
        }
    }, [selectedConn?.id]);

    // Test connection
    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const payload = selectedConn?.id
                ? { connection_id: selectedConn.id }
                : {
                    host: editForm.host,
                    share: editForm.share,
                    domain: editForm.domain,
                    username: editForm.username,
                    password: editForm.password,
                    port: editForm.port,
                    local_path: connectionType === 'local' ? editForm.local_path : undefined,
                };

            const res = await fetchWithToken('/api/smb/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            setTestResult(data);
        } catch (e: any) {
            setTestResult({ success: false, message: e.message });
        } finally {
            setIsTesting(false);
        }
    };

    // Save connection
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Prepare payload based on type
            const payload = { ...editForm };
            if (connectionType === 'local') {
                payload.host = '';
                payload.share = '';
                payload.username = '';
                payload.password = '';
                payload.domain = '';
            } else {
                payload.local_path = '';
            }

            const res = await fetchWithToken('/api/smb/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                const saved = await res.json();
                setSelectedConn(saved);
                setIsEditing(false);
                await fetchConnections();
            } else {
                const err = await res.json();
                alert(`Erro ao salvar: ${err.error || 'Erro desconhecido'}`);
            }
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete connection
    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover esta conexão?')) return;
        try {
            await fetchWithToken(`/api/smb/config?id=${id}`, { method: 'DELETE' });
            setSelectedConn(null);
            await fetchConnections();
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    // Browse SMB
    const browsePath = async (path: string = '') => {
        if (!selectedConn?.id) return;
        setIsBrowsing(true);
        try {
            const res = await fetchWithToken(`/api/smb/browse?connection_id=${selectedConn.id}&path=${encodeURIComponent(path)}`);
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files || []);
                setCurrentPath(path);
            }
        } catch (e) {
            console.error('Browse failed:', e);
        } finally {
            setIsBrowsing(false);
        }
    };

    // File manager: download / upload / mkdir / rename / delete
    const [fileOpBusy, setFileOpBusy] = useState(false);
    const [fileOpError, setFileOpError] = useState<string | null>(null);

    const itemPath = (name: string) => (currentPath ? `${currentPath}/${name}` : name);

    const runFileOp = async (fn: () => Promise<void>) => {
        setFileOpBusy(true);
        setFileOpError(null);
        try {
            await fn();
            await browsePath(currentPath);
        } catch (e: any) {
            setFileOpError(e.message || 'Operação falhou');
        } finally {
            setFileOpBusy(false);
        }
    };

    const downloadFile = (file: SmbFile) => runFileOp(async () => {
        const res = await fetchWithToken(
            `/api/smb/files?connection_id=${selectedConn!.id}&path=${encodeURIComponent(itemPath(file.name))}`
        );
        if (!res.ok) throw new Error((await res.json()).error || 'Falha no download');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
    });

    const uploadFiles = (fileList: FileList | null) => runFileOp(async () => {
        if (!fileList || !selectedConn?.id) return;
        for (const f of Array.from(fileList)) {
            const form = new FormData();
            form.append('connection_id', selectedConn.id);
            form.append('path', currentPath);
            form.append('file', f);
            const res = await fetchWithToken('/api/smb/files', { method: 'POST', body: form });
            if (!res.ok) throw new Error((await res.json()).error || `Falha no upload de ${f.name}`);
        }
    });

    const createFolder = () => runFileOp(async () => {
        const name = window.prompt('Nome da nova pasta:');
        if (!name || !selectedConn?.id) return;
        const res = await fetchWithToken('/api/smb/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connection_id: selectedConn.id, action: 'mkdir', path: itemPath(name) }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao criar pasta');
    });

    const renameItem = (file: SmbFile) => runFileOp(async () => {
        const newName = window.prompt('Novo nome:', file.name);
        if (!newName || newName === file.name || !selectedConn?.id) return;
        const res = await fetchWithToken('/api/smb/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connection_id: selectedConn.id, action: 'rename', path: itemPath(file.name), newName }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao renomear');
    });

    const deleteItem = (file: SmbFile) => runFileOp(async () => {
        if (!window.confirm(`Excluir ${file.isDirectory ? 'a pasta' : 'o arquivo'} "${file.name}"?`)) return;
        const res = await fetchWithToken(
            `/api/smb/files?connection_id=${selectedConn!.id}&path=${encodeURIComponent(itemPath(file.name))}&isDirectory=${file.isDirectory}`,
            { method: 'DELETE' }
        );
        if (!res.ok) throw new Error((await res.json()).error || 'Falha ao excluir');
    });

    // Sync
    const handleSync = async () => {
        if (!selectedConn?.id) return;
        setIsSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetchWithToken('/api/smb/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_id: selectedConn.id }),
            });
            const data = await res.json();
            setSyncResult(data);
            // Refresh connections and logs
            await fetchConnections();
        } catch (e: any) {
            setSyncResult({ error: e.message, status: 'failed' });
        } finally {
            setIsSyncing(false);
        }
    };

    // Start editing
    const startEditing = (conn?: SmbConnection) => {
        if (conn) {
            setEditForm({ ...conn, password: '' });
            setConnectionType(conn.local_path ? 'local' : 'smb');
        } else {
            setEditForm({ ...emptyConnection });
            setConnectionType('smb');
        }
        setIsEditing(true);
        setTestResult(null);
    };

    // ... (if !isAdmin)

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto">
                {/* ... (Header) */}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* ... (Sidebar) */}

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {isEditing ? (
                            /* ── Edit Form ── */
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        {editForm.id ? 'Editar Conexão' : 'Nova Conexão'}
                                    </h3>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setConnectionType('smb')}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${connectionType === 'smb' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            SMB (Rede)
                                        </button>
                                        <button
                                            onClick={() => setConnectionType('local')}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${connectionType === 'local' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Caminho Local (Servidor)
                                        </button>
                                    </div>
                                </div>
                                <div className="p-6 space-y-5">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da Conexão</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder={connectionType === 'local' ? "Ex: Pasta RH Local" : "Ex: Servidor de Políticas"}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    {connectionType === 'local' ? (
                                        /* Local Path Fields */
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Caminho Absoluto (No Servidor)</label>
                                            <input
                                                type="text"
                                                value={editForm.local_path || ''}
                                                onChange={e => setEditForm(f => ({ ...f, local_path: e.target.value }))}
                                                placeholder="Ex: C:\Arquivos\RH ou \\192.168.1.10\Compartilhamento"
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Use caminhos locais (ex: <code>D:\Dados</code>) ou UNC (ex: <code>\\server\share</code>) acessíveis pelo servidor Node.js
                                            </p>
                                        </div>
                                    ) : (
                                        /* SMB Fields */
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Host */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Host / IP</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.host}
                                                        onChange={e => setEditForm(f => ({ ...f, host: e.target.value }))}
                                                        placeholder="dcserver01.groupabz.com"
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                                {/* Share */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Share</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.share}
                                                        onChange={e => setEditForm(f => ({ ...f, share: e.target.value }))}
                                                        placeholder="DATA-ABZ"
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Base Path - Optional for both but shown here for SMB */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Caminho Base (Opcional)</label>
                                                <input
                                                    type="text"
                                                    value={editForm.base_path}
                                                    onChange={e => setEditForm(f => ({ ...f, base_path: e.target.value }))}
                                                    placeholder="1. Publico/6. Políticas"
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Domain */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Domínio</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.domain}
                                                        onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))}
                                                        placeholder="GROUPABZ"
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                                {/* Username */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuário</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.username}
                                                        onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                                                        placeholder="usuario.smb"
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                                {/* Port */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Porta</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.port}
                                                        onChange={e => setEditForm(f => ({ ...f, port: parseInt(e.target.value) || 445 }))}
                                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Password */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Senha {editForm.id && <span className="text-gray-400">(deixe vazio para manter a atual)</span>}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={editForm.password || ''}
                                                        onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                                                        placeholder="••••••••"
                                                        className="w-full px-4 py-2.5 pr-12 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Sync Target Category */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoria na Biblioteca</label>
                                        <input
                                            type="text"
                                            value={editForm.sync_target_category}
                                            onChange={e => setEditForm(f => ({ ...f, sync_target_category: e.target.value }))}
                                            placeholder="Políticas Internas"
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>

                                    {/* Test Result */}
                                    {testResult && (
                                        <div className={`p-4 rounded-xl border ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                            <div className="flex items-center gap-2">
                                                {testResult.success ? <FiCheck className="w-5 h-5" /> : <FiX className="w-5 h-5" />}
                                                <span className="font-medium">{testResult.message}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            onClick={handleTest}
                                            disabled={isTesting || !editForm.host || !editForm.share || !editForm.username}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isTesting ? (
                                                <FiRefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <FiLink className="w-4 h-4" />
                                            )}
                                            Testar Conexão
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || !editForm.name || !editForm.host || !editForm.share || !editForm.username}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                        >
                                            {isSaving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSave className="w-4 h-4" />}
                                            Salvar
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-4 py-2.5 text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : selectedConn ? (
                            /* ── Connection Detail ── */
                            <div className="space-y-6">
                                {/* Connection Info Card */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="p-6 flex items-center justify-between border-b border-gray-100">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${selectedConn.is_active ? 'bg-emerald-400 shadow-lg shadow-emerald-200' : 'bg-gray-300'}`} />
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-800">{selectedConn.name}</h3>
                                                <p className="text-sm text-gray-400">\\\\{selectedConn.host}\\{selectedConn.share}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => startEditing(selectedConn)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <FiSettings className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => selectedConn.id && handleDelete(selectedConn.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Remover"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
                                        <div className="p-4 text-center">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Status</p>
                                            <p className={`text-sm font-medium ${selectedConn.last_sync_status === 'completed' ? 'text-emerald-600' : selectedConn.last_sync_status === 'completed_with_errors' ? 'text-amber-600' : 'text-gray-600'}`}>
                                                {selectedConn.last_sync_status === 'completed' ? '✅ OK' :
                                                    selectedConn.last_sync_status === 'completed_with_errors' ? '⚠️ Parcial' :
                                                        selectedConn.last_sync_status || '—'}
                                            </p>
                                        </div>
                                        <div className="p-4 text-center">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Último Sync</p>
                                            <p className="text-sm font-medium text-gray-600">
                                                {selectedConn.last_sync_at
                                                    ? new Date(selectedConn.last_sync_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                    : '—'}
                                            </p>
                                        </div>
                                        <div className="p-4 text-center">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Arquivos</p>
                                            <p className="text-sm font-medium text-gray-600">{selectedConn.last_sync_files_count || 0}</p>
                                        </div>
                                        <div className="p-4 text-center">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Categoria</p>
                                            <p className="text-sm font-medium text-gray-600 truncate">{selectedConn.sync_target_category}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="flex border-b border-gray-100">
                                        {[
                                            { id: 'config' as const, label: 'Detalhes', icon: FiSettings },
                                            { id: 'browser' as const, label: 'Explorar Arquivos', icon: FiFolder },
                                            { id: 'sync' as const, label: 'Sincronização', icon: FiActivity },
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab(tab.id);
                                                    if (tab.id === 'browser' && files.length === 0) browsePath('');
                                                }}
                                                className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id
                                                    ? 'text-blue-600 border-blue-600 bg-blue-50/50'
                                                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <tab.icon className="w-4 h-4" />
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-6">
                                        {/* Details Tab */}
                                        {activeTab === 'config' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {[
                                                        { label: 'Host', value: selectedConn.host },
                                                        { label: 'Share', value: selectedConn.share },
                                                        { label: 'Domínio', value: selectedConn.domain || '—' },
                                                        { label: 'Usuário', value: selectedConn.username },
                                                        { label: 'Porta', value: selectedConn.port },
                                                        { label: 'Caminho Base', value: selectedConn.base_path || '(raiz)' },
                                                    ].map((item, i) => (
                                                        <div key={i} className="bg-gray-50 rounded-xl p-3">
                                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{item.label}</p>
                                                            <p className="text-sm font-medium text-gray-700 font-mono">{item.value}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                {selectedConn.last_sync_error && (
                                                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-4">
                                                        <p className="text-sm font-medium text-red-700 mb-1 flex items-center gap-2">
                                                            <FiAlertTriangle className="w-4 h-4" />
                                                            Último erro
                                                        </p>
                                                        <p className="text-sm text-red-600 font-mono">{selectedConn.last_sync_error}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Browser Tab */}
                                        {activeTab === 'browser' && (
                                            <div>
                                                {/* Breadcrumb */}
                                                <div className="flex items-center gap-1 mb-4 text-sm">
                                                    <button
                                                        onClick={() => browsePath('')}
                                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        Raiz
                                                    </button>
                                                    {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
                                                        <React.Fragment key={i}>
                                                            <FiChevronRight className="w-3 h-3 text-gray-400" />
                                                            <button
                                                                onClick={() => browsePath(arr.slice(0, i + 1).join('/'))}
                                                                className={`${i === arr.length - 1 ? 'text-gray-600' : 'text-blue-600 hover:text-blue-800'} font-medium truncate max-w-[150px]`}
                                                            >
                                                                {part}
                                                            </button>
                                                        </React.Fragment>
                                                    ))}
                                                    <button
                                                        onClick={() => browsePath(currentPath)}
                                                        className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                                    >
                                                        <FiRefreshCw className={`w-4 h-4 ${isBrowsing ? 'animate-spin' : ''}`} />
                                                    </button>
                                                </div>

                                                {/* Toolbar */}
                                                <div className="flex items-center gap-2 mb-4">
                                                    <button
                                                        onClick={createFolder}
                                                        disabled={fileOpBusy}
                                                        className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                                                    >
                                                        <FiFolderPlus className="w-4 h-4" /> Nova pasta
                                                    </button>
                                                    <label className={`flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer ${fileOpBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                                                        <FiUpload className="w-4 h-4" /> Upload
                                                        <input
                                                            type="file"
                                                            multiple
                                                            className="hidden"
                                                            onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }}
                                                        />
                                                    </label>
                                                    {fileOpBusy && <FiRefreshCw className="w-4 h-4 text-blue-600 animate-spin" />}
                                                    {fileOpError && (
                                                        <span className="text-xs text-red-600 truncate" title={fileOpError}>
                                                            {fileOpError}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* File List */}
                                                {isBrowsing ? (
                                                    <div className="flex justify-center py-12">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                                    </div>
                                                ) : files.length === 0 ? (
                                                    <div className="text-center py-12 text-gray-400">
                                                        <FiFolder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                        <p>Nenhum arquivo encontrado neste diretório</p>
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                                                        {files.map((file, i) => (
                                                            <div
                                                                key={i}
                                                                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                                                            >
                                                                <button
                                                                    onClick={() => file.isDirectory && browsePath(itemPath(file.name))}
                                                                    className={`flex items-center gap-3 flex-1 min-w-0 text-left ${file.isDirectory ? 'cursor-pointer' : 'cursor-default'}`}
                                                                >
                                                                    {file.isDirectory ? (
                                                                        <FiFolder className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                                                    ) : (
                                                                        <FiFile className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                                    )}
                                                                    <span className={`text-sm truncate ${file.isDirectory ? 'font-medium text-gray-700' : 'text-gray-600'}`}>
                                                                        {file.name}
                                                                    </span>
                                                                    {file.isDirectory && (
                                                                        <FiChevronRight className="w-4 h-4 text-gray-300" />
                                                                    )}
                                                                </button>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {!file.isDirectory && (
                                                                        <button
                                                                            onClick={() => downloadFile(file)}
                                                                            disabled={fileOpBusy}
                                                                            title="Baixar"
                                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                                        >
                                                                            <FiDownload className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => renameItem(file)}
                                                                        disabled={fileOpBusy}
                                                                        title="Renomear"
                                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                                                    >
                                                                        <FiEdit2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteItem(file)}
                                                                        disabled={fileOpBusy}
                                                                        title="Excluir"
                                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Sync Tab */}
                                        {activeTab === 'sync' && (
                                            <div className="space-y-6">
                                                {/* Sync Action */}
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h4 className="font-semibold text-gray-800">Sincronização Manual</h4>
                                                            <p className="text-sm text-gray-500 mt-0.5">
                                                                Baixa todos os novos arquivos do SMB e importa para a Biblioteca
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={handleSync}
                                                            disabled={isSyncing}
                                                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 active:scale-95"
                                                        >
                                                            {isSyncing ? (
                                                                <FiRefreshCw className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <FiPlay className="w-4 h-4" />
                                                            )}
                                                            {isSyncing ? 'Sincronizando...' : 'Iniciar Sync'}
                                                        </button>
                                                    </div>

                                                    {/* Sync Result */}
                                                    {syncResult && (
                                                        <div className={`mt-4 p-4 rounded-xl ${syncResult.status === 'completed' ? 'bg-emerald-50 border border-emerald-200' : syncResult.status === 'failed' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                                                            <div className="flex items-center gap-3 text-sm">
                                                                {syncResult.status === 'completed' ? (
                                                                    <FiCheck className="w-5 h-5 text-emerald-600" />
                                                                ) : syncResult.status === 'failed' ? (
                                                                    <FiX className="w-5 h-5 text-red-600" />
                                                                ) : (
                                                                    <FiAlertTriangle className="w-5 h-5 text-amber-600" />
                                                                )}
                                                                <div>
                                                                    <p className="font-medium">
                                                                        {syncResult.files_synced || 0} sincronizados
                                                                        {syncResult.files_skipped ? `, ${syncResult.files_skipped} já existentes` : ''}
                                                                        {syncResult.files_failed ? `, ${syncResult.files_failed} falhas` : ''}
                                                                    </p>
                                                                    {syncResult.error && <p className="text-red-600 mt-1">{syncResult.error}</p>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Sync Logs */}
                                                <div>
                                                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                        <FiClock className="w-4 h-4" />
                                                        Histórico de Sincronizações
                                                    </h4>
                                                    {syncLogs.length === 0 ? (
                                                        <p className="text-sm text-gray-400 text-center py-8">Nenhuma sincronização realizada ainda</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {syncLogs.map(log => (
                                                                <div key={log.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-2 h-2 rounded-full ${log.status === 'completed' ? 'bg-emerald-400' :
                                                                            log.status === 'running' ? 'bg-blue-400 animate-pulse' :
                                                                                log.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                                                                            }`} />
                                                                        <div>
                                                                            <p className="text-sm font-medium text-gray-700">
                                                                                {log.files_synced} arquivo(s) sincronizado(s)
                                                                                {log.files_failed > 0 && <span className="text-red-500"> · {log.files_failed} falha(s)</span>}
                                                                            </p>
                                                                            <p className="text-xs text-gray-400">
                                                                                {new Date(log.started_at).toLocaleDateString('pt-BR', {
                                                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                                                    hour: '2-digit', minute: '2-digit'
                                                                                })}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${log.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                                        log.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                                                            log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                                        }`}>
                                                                        {log.status === 'completed' ? 'Concluído' :
                                                                            log.status === 'running' ? 'Em execução' :
                                                                                log.status === 'failed' ? 'Falhou' : 'Parcial'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Script Info */}
                                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                                                    <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                        <FiDatabase className="w-4 h-4" />
                                                        Sync Automático (Script)
                                                    </h4>
                                                    <p className="text-sm text-gray-500 mb-3">
                                                        Para ambientes de produção (Netlify), use o script standalone em uma máquina com acesso à rede:
                                                    </p>
                                                    <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-sm">
                                                        <p className="text-gray-400"># Executar sincronização manualmente</p>
                                                        <p className="text-emerald-400">npm run smb:sync</p>
                                                        <p className="text-gray-400 mt-2"># Agendar no Windows Task Scheduler ou cron</p>
                                                        <p className="text-amber-400">schtasks /create /tn &ldquo;SMB Sync&rdquo; /tr &ldquo;npm run smb:sync&rdquo; /sc daily /st 08:00</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ── Empty State ── */
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <FiServer className="w-8 h-8 text-blue-500" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhuma conexão selecionada</h3>
                                    <p className="text-gray-400 text-sm mb-4">Selecione uma conexão existente ou crie uma nova</p>
                                    <button
                                        onClick={() => startEditing()}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all mx-auto"
                                    >
                                        <FiPlus className="w-4 h-4" />
                                        Nova Conexão
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
