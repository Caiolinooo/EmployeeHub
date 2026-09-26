"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    FiMessageSquare,
    FiRefreshCw,
    FiCheck,
    FiX,
    FiClock,
    FiAlertCircle,
    FiHelpCircle,
    FiFilter,
    FiChevronDown,
    FiChevronUp,
    FiUser,
    FiMonitor,
    FiExternalLink,
    FiTrash2,
    FiImage,
    FiCode,
    FiInfo,
    FiDownload,
    FiMaximize2
} from "react-icons/fi";
import { fetchWithToken } from "@/lib/tokenStorage";
import ProtectedRoute from "@/components/Auth/ProtectedRoute";

interface ConsoleLog {
    type: 'log' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: string;
}

interface BrowserInfo {
    language?: string;
    platform?: string;
    cookiesEnabled?: boolean;
    onLine?: boolean;
    deviceMemory?: string | number;
    hardwareConcurrency?: string | number;
    colorDepth?: number;
    pixelRatio?: number;
    timezone?: string;
    pageLoadTime?: number;
    domContentLoaded?: number;
    timeToFirstByte?: number;
    memoryUsage?: string;
    timestamp?: string;
}

interface Attachment {
    name: string;
    type: string;
    data: string;
    size: number;
}

interface Feedback {
    id: string;
    user_id: string | null;
    type: 'doubt' | 'bug' | 'suggestion' | 'other';
    message: string;
    url: string | null;
    user_agent: string | null;
    screen_resolution: string | null;
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
    created_at: string;
    updated_at: string;
    // Enhanced fields
    user_name?: string;
    user_email?: string;
    console_logs?: ConsoleLog[];
    browser_info?: BrowserInfo;
    screenshot_url?: string;
    attachments?: Attachment[];
}

const typeConfig = {
    doubt: { color: 'bg-blue-100 text-blue-800', icon: FiHelpCircle, label: 'Dúvida', emoji: '❓' },
    bug: { color: 'bg-red-100 text-red-800', icon: FiAlertCircle, label: 'Erro/Bug', emoji: '🐛' },
    suggestion: { color: 'bg-green-100 text-green-800', icon: FiMessageSquare, label: 'Sugestão', emoji: '💡' },
    other: { color: 'bg-gray-100 text-gray-800', icon: FiMessageSquare, label: 'Outro', emoji: '📝' }
};

const statusConfig = {
    open: { color: 'bg-yellow-100 text-yellow-800', icon: FiClock, label: 'Aberto' },
    in_progress: { color: 'bg-blue-100 text-blue-800', icon: FiRefreshCw, label: 'Em Andamento' },
    resolved: { color: 'bg-green-100 text-green-800', icon: FiCheck, label: 'Resolvido' },
    dismissed: { color: 'bg-gray-100 text-gray-800', icon: FiX, label: 'Descartado' }
};

export default function AdminFeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showLogsId, setShowLogsId] = useState<string | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Filtros
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const loadFeedbacks = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetchWithToken("/api/admin/feedback");
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setFeedbacks(data.feedbacks || []);
        } catch (e) {
            console.error(e);
            showToast("Falha ao carregar feedbacks");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFeedbacks();
    }, [loadFeedbacks]);

    const updateStatus = async (id: string, status: Feedback['status']) => {
        try {
            const res = await fetchWithToken(`/api/admin/feedback/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error("Failed to update");
            showToast(`Status atualizado para: ${statusConfig[status].label}`);
            loadFeedbacks();
        } catch (e) {
            console.error(e);
            showToast("Falha ao atualizar status");
        }
    };

    const deleteFeedback = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este feedback?")) return;
        try {
            const res = await fetchWithToken(`/api/admin/feedback/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Failed to delete");
            showToast("Feedback excluído");
            loadFeedbacks();
        } catch (e) {
            console.error(e);
            showToast("Falha ao excluir");
        }
    };

    const filteredFeedbacks = feedbacks.filter(fb => {
        if (filterType !== 'all' && fb.type !== filterType) return false;
        if (filterStatus !== 'all' && fb.status !== filterStatus) return false;
        return true;
    });

    const stats = {
        total: feedbacks.length,
        open: feedbacks.filter(f => f.status === 'open').length,
        inProgress: feedbacks.filter(f => f.status === 'in_progress').length,
        resolved: feedbacks.filter(f => f.status === 'resolved').length,
        bugs: feedbacks.filter(f => f.type === 'bug').length,
        doubts: feedbacks.filter(f => f.type === 'doubt').length,
        suggestions: feedbacks.filter(f => f.type === 'suggestion').length
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const parseUserAgent = (ua: string | null) => {
        if (!ua) return { browser: 'Desconhecido', os: 'Desconhecido' };

        let browser = 'Outro';
        let os = 'Outro';

        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Edg')) browser = 'Edge';
        else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac OS')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

        return { browser, os };
    };

    const downloadAttachment = (att: Attachment) => {
        const link = document.createElement('a');
        link.href = att.data;
        link.download = att.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <ProtectedRoute managerOnly>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <FiMessageSquare className="w-6 h-6 text-blue-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Central de Feedbacks</h1>
                    </div>
                    <button
                        onClick={loadFeedbacks}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>Atualizar</span>
                    </button>
                </div>

                {/* Toast */}
                {toast && (
                    <div className="p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                        {toast}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                        <div className="text-sm text-gray-500">Total</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <div className="text-2xl font-bold text-yellow-700">{stats.open}</div>
                        <div className="text-sm text-yellow-600">Abertos</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-2xl font-bold text-blue-700">{stats.inProgress}</div>
                        <div className="text-sm text-blue-600">Em Andamento</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-2xl font-bold text-green-700">{stats.resolved}</div>
                        <div className="text-sm text-green-600">Resolvidos</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <div className="text-2xl font-bold text-red-700">{stats.bugs}</div>
                        <div className="text-sm text-red-600">🐛 Bugs</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-2xl font-bold text-blue-700">{stats.doubts}</div>
                        <div className="text-sm text-blue-600">❓ Dúvidas</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-2xl font-bold text-green-700">{stats.suggestions}</div>
                        <div className="text-sm text-green-600">💡 Sugestões</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <FiFilter className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Filtros:</span>
                        </div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="all">Todos os tipos</option>
                            <option value="doubt">❓ Dúvidas</option>
                            <option value="bug">🐛 Bugs</option>
                            <option value="suggestion">💡 Sugestões</option>
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="all">Todos os status</option>
                            <option value="open">🟡 Abertos</option>
                            <option value="in_progress">🔵 Em Andamento</option>
                            <option value="resolved">🟢 Resolvidos</option>
                            <option value="dismissed">⚪ Descartados</option>
                        </select>
                        <div className="text-sm text-gray-500">
                            Mostrando {filteredFeedbacks.length} de {feedbacks.length}
                        </div>
                    </div>
                </div>

                {/* Feedbacks List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center">
                            <FiRefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
                            <p className="text-gray-500">Carregando feedbacks...</p>
                        </div>
                    ) : filteredFeedbacks.length === 0 ? (
                        <div className="bg-white rounded-lg p-8 border border-gray-200 text-center">
                            <FiMessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">Nenhum feedback encontrado</p>
                        </div>
                    ) : (
                        filteredFeedbacks.map((fb) => {
                            const typeInfo = typeConfig[fb.type] || typeConfig.other;
                            const statusInfo = statusConfig[fb.status];
                            const TypeIcon = typeInfo.icon;
                            const StatusIcon = statusInfo.icon;
                            const isExpanded = expandedId === fb.id;
                            const { browser, os } = parseUserAgent(fb.user_agent);
                            const hasLogs = fb.console_logs && fb.console_logs.length > 0;
                            const hasScreenshot = !!fb.screenshot_url;
                            const hasAttachments = fb.attachments && fb.attachments.length > 0;
                            const errorCount = fb.console_logs?.filter(l => l.type === 'error').length || 0;
                            const warnCount = fb.console_logs?.filter(l => l.type === 'warn').length || 0;

                            return (
                                <div
                                    key={fb.id}
                                    className={`bg-white rounded-lg border transition-all ${fb.status === 'open' ? 'border-yellow-300 shadow-sm' : 'border-gray-200'
                                        }`}
                                >
                                    {/* Header Row */}
                                    <div
                                        className="p-4 cursor-pointer hover:bg-gray-50"
                                        onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                                                    <TypeIcon className="w-5 h-5" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                                                            {typeInfo.emoji} {typeInfo.label}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                                            <StatusIcon className="inline w-3 h-3 mr-1" />
                                                            {statusInfo.label}
                                                        </span>
                                                        {hasScreenshot && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                                📷 Screenshot
                                                            </span>
                                                        )}
                                                        {hasLogs && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                                🖥️ {errorCount > 0 ? `${errorCount} erros` : ''} {warnCount > 0 ? `${warnCount} avisos` : ''}
                                                            </span>
                                                        )}
                                                        {hasAttachments && (
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                                📎 {fb.attachments!.length} anexo(s)
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-gray-400">
                                                            {formatDate(fb.created_at)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                                        <FiUser className="w-4 h-4" />
                                                        <span className="font-medium">{fb.user_name || 'Usuário Anônimo'}</span>
                                                        {fb.user_email && (
                                                            <span className="text-gray-400">({fb.user_email})</span>
                                                        )}
                                                    </div>

                                                    <p className={`text-gray-700 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                        {fb.message}
                                                    </p>
                                                </div>
                                            </div>

                                            <button className="p-2 text-gray-500 hover:text-gray-700" aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}>
                                                {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                                            {/* Screenshot */}
                                            {hasScreenshot && (
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                            <FiImage className="w-4 h-4" /> Screenshot Capturado
                                                        </h4>
                                                        <button
                                                            onClick={() => setLightboxImage(fb.screenshot_url!)}
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            <FiMaximize2 className="w-3 h-3" /> Ampliar
                                                        </button>
                                                    </div>
                                                    <img
                                                        src={fb.screenshot_url!}
                                                        alt="Screenshot"
                                                        className="w-full max-h-64 object-contain rounded-lg border cursor-pointer hover:opacity-90"
                                                        onClick={() => setLightboxImage(fb.screenshot_url!)}
                                                    />
                                                </div>
                                            )}

                                            {/* Attachments */}
                                            {hasAttachments && (
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                                                        📎 Anexos ({fb.attachments!.length})
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {fb.attachments!.map((att, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                                                <div className="flex items-center gap-2">
                                                                    {att.type.startsWith('image/') ? (
                                                                        <img
                                                                            src={att.data}
                                                                            alt={att.name}
                                                                            className="w-12 h-12 object-cover rounded cursor-pointer"
                                                                            onClick={() => setLightboxImage(att.data)}
                                                                        />
                                                                    ) : (
                                                                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                                                                            <FiCode className="w-5 h-5 text-gray-500" />
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <div className="text-sm font-medium">{att.name}</div>
                                                                        <div className="text-xs text-gray-500">{Math.round(att.size / 1024)}KB</div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => downloadAttachment(att)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                                >
                                                                    <FiDownload className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Browser Info & URL */}
                                            <div className="grid md:grid-cols-2 gap-4">
                                                {fb.url && (
                                                    <div className="bg-white p-3 rounded-lg border">
                                                        <div className="text-xs text-gray-500 mb-1">🔗 Página</div>
                                                        <a
                                                            href={fb.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline text-sm flex items-center gap-1 break-all"
                                                        >
                                                            {fb.url}
                                                            <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                                                        </a>
                                                    </div>
                                                )}

                                                <div className="bg-white p-3 rounded-lg border">
                                                    <div className="text-xs text-gray-500 mb-1">📱 Dispositivo</div>
                                                    <div className="flex items-center gap-4 text-sm">
                                                        <span className="flex items-center gap-1">
                                                            <FiMonitor className="w-4 h-4" />
                                                            {browser} / {os}
                                                        </span>
                                                        {fb.screen_resolution && (
                                                            <span className="text-gray-500">
                                                                {fb.screen_resolution}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Browser Info Details */}
                                            {fb.browser_info && Object.keys(fb.browser_info).length > 0 && (
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                                                        <FiInfo className="w-4 h-4" /> Informações Detalhadas
                                                    </h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                        {fb.browser_info.language && (
                                                            <div>
                                                                <span className="text-gray-500">Idioma:</span>{' '}
                                                                <span className="font-medium">{fb.browser_info.language}</span>
                                                            </div>
                                                        )}
                                                        {fb.browser_info.timezone && (
                                                            <div>
                                                                <span className="text-gray-500">Timezone:</span>{' '}
                                                                <span className="font-medium">{fb.browser_info.timezone}</span>
                                                            </div>
                                                        )}
                                                        {fb.browser_info.pageLoadTime && (
                                                            <div>
                                                                <span className="text-gray-500">Page Load:</span>{' '}
                                                                <span className="font-medium">{fb.browser_info.pageLoadTime}ms</span>
                                                            </div>
                                                        )}
                                                        {fb.browser_info.deviceMemory && (
                                                            <div>
                                                                <span className="text-gray-500">Memória:</span>{' '}
                                                                <span className="font-medium">{fb.browser_info.deviceMemory}GB</span>
                                                            </div>
                                                        )}
                                                        {fb.browser_info.hardwareConcurrency && (
                                                            <div>
                                                                <span className="text-gray-500">CPUs:</span>{' '}
                                                                <span className="font-medium">{fb.browser_info.hardwareConcurrency}</span>
                                                            </div>
                                                        )}
                                                        {fb.browser_info.memoryUsage && (
                                                            <div>
                                                                <span className="text-gray-500">Mem. JS:</span>{' '}
                                                                <span className="font-medium">{fb.browser_info.memoryUsage}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Console Logs */}
                                            {hasLogs && (
                                                <div className="bg-gray-900 p-3 rounded-lg">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                                                            <FiCode className="w-4 h-4" /> Console Logs ({fb.console_logs!.length})
                                                            {errorCount > 0 && <span className="text-red-400">({errorCount} erros)</span>}
                                                            {warnCount > 0 && <span className="text-yellow-400">({warnCount} avisos)</span>}
                                                        </h4>
                                                        <button
                                                            onClick={() => setShowLogsId(showLogsId === fb.id ? null : fb.id)}
                                                            className="text-xs text-blue-400 hover:underline"
                                                        >
                                                            {showLogsId === fb.id ? 'Esconder' : 'Mostrar todos'}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                                        {(showLogsId === fb.id ? fb.console_logs! : fb.console_logs!.slice(0, 5)).map((log, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`p-2 rounded text-xs font-mono ${log.type === 'error' ? 'bg-red-900/50 border-l-2 border-red-500' :
                                                                        log.type === 'warn' ? 'bg-yellow-900/50 border-l-2 border-yellow-500' :
                                                                            'bg-gray-800 border-l-2 border-gray-600'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2 text-gray-400 mb-1">
                                                                    <span className={
                                                                        log.type === 'error' ? 'text-red-400' :
                                                                            log.type === 'warn' ? 'text-yellow-400' : 'text-gray-400'
                                                                    }>
                                                                        [{log.type.toUpperCase()}]
                                                                    </span>
                                                                    <span>{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                                                                </div>
                                                                <div className="text-gray-300 break-all whitespace-pre-wrap">
                                                                    {log.message}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {!showLogsId && fb.console_logs!.length > 5 && (
                                                            <div className="text-center text-gray-500 text-xs py-2">
                                                                ...e mais {fb.console_logs!.length - 5} logs
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Full User Agent */}
                                            {fb.user_agent && (
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <div className="text-xs text-gray-500 mb-1">User Agent</div>
                                                    <code className="text-xs text-gray-600 break-all block">
                                                        {fb.user_agent}
                                                    </code>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-200">
                                                <span className="text-sm text-gray-500 mr-2">Alterar status:</span>
                                                {fb.status !== 'open' && (
                                                    <button
                                                        onClick={() => updateStatus(fb.id, 'open')}
                                                        className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm hover:bg-yellow-200 flex items-center gap-1"
                                                    >
                                                        <FiClock className="w-4 h-4" /> Abrir
                                                    </button>
                                                )}
                                                {fb.status !== 'in_progress' && (
                                                    <button
                                                        onClick={() => updateStatus(fb.id, 'in_progress')}
                                                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 flex items-center gap-1"
                                                    >
                                                        <FiRefreshCw className="w-4 h-4" /> Em Andamento
                                                    </button>
                                                )}
                                                {fb.status !== 'resolved' && (
                                                    <button
                                                        onClick={() => updateStatus(fb.id, 'resolved')}
                                                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 flex items-center gap-1"
                                                    >
                                                        <FiCheck className="w-4 h-4" /> Resolvido
                                                    </button>
                                                )}
                                                {fb.status !== 'dismissed' && (
                                                    <button
                                                        onClick={() => updateStatus(fb.id, 'dismissed')}
                                                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-1"
                                                    >
                                                        <FiX className="w-4 h-4" /> Descartar
                                                    </button>
                                                )}
                                                <div className="flex-1" />
                                                <button
                                                    onClick={() => deleteFeedback(fb.id)}
                                                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 flex items-center gap-1"
                                                >
                                                    <FiTrash2 className="w-4 h-4" /> Excluir
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Lightbox */}
                {lightboxImage && (
                    <div
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                        onClick={() => setLightboxImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-300"
                            onClick={() => setLightboxImage(null)}
                            aria-label="Fechar imagem"
                        >
                            <FiX className="w-8 h-8" />
                        </button>
                        <img
                            src={lightboxImage}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
