'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import {
    FiUpload, FiFileText, FiSearch, FiFilter,
    FiClock, FiCheckCircle, FiXCircle, FiChevronRight,
    FiCalendar, FiUser, FiRefreshCw, FiSettings
} from 'react-icons/fi';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/authUtils';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import DocumentUploadModal from '@/components/contratos/DocumentUploadModal';
import DocumentStatusBadge from '@/components/contratos/DocumentStatusBadge';
import { useI18n } from '@/contexts/I18nContext';
import toast from 'react-hot-toast';

type FilterStatus = 'ALL' | 'PENDING' | 'SIGNED';

export default function ContratosPage() {
    const { hasPermission, loading: permsLoading } = useEffectivePermissions();
    const { t } = useI18n();
    const [documentos, setDocumentos] = useState<any[]>([]);
    // Ações vêm do servidor (loadContractAccess): JSONB + ACL + role, mesma regra das rotas
    const [can, setCan] = useState<Record<string, boolean>>({});
    const canTemplates = !!(can['templates.view'] || can['templates.manage'] || can['templates.use']);
    // Escopo vem do servidor (contratos.view_all / view_own); o filtro real é aplicado na API
    const [scope, setScope] = useState<'all' | 'own'>('own');
    const viewAll = scope === 'all';
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const hasList = React.useRef(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadModalTab, setUploadModalTab] = useState<'envelope' | 'templates'>('envelope');

    const fetchDocumentos = useCallback(async (background?: boolean) => {
        const soft = !!background && hasList.current;
        try {
            if (soft) setRefreshing(true);
            else setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.set('status', statusFilter);
            if (searchTerm.trim()) params.set('search', searchTerm.trim());

            const res = await fetchWithAuth(`/api/contracts?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                setDocumentos(data.documentos || []);
                hasList.current = true;
                setScope(data.scope === 'all' ? 'all' : 'own');
                setCan(data.can || {});
            } else {
                toast.error(data.error || t('contratos.error_loading', 'Erro ao carregar documentos'));
            }
        } catch (err) {
            console.error('Erro ao buscar documentos:', err);
            toast.error(t('contratos.error_loading', 'Erro ao carregar documentos'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter, searchTerm]);

    useEffect(() => {
        fetchDocumentos();
    }, [fetchDocumentos]);

    // Stats
    const totalDocs = documentos.length;
    const pendingDocs = documentos.filter((d: any) => d.total_pendentes > 0).length;
    const signedDocs = documentos.filter((d: any) => d.total_pendentes === 0 && d.total_assinados > 0).length;

    if (permsLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                </div>
            </MainLayout>
        );
    }

    if (!hasPermission('contratos')) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <FiFileText className="w-16 h-16 text-gray-300 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('common.access_restricted', 'Acesso Restrito')}</h2>
                    <p className="text-gray-500 max-w-md">{t('common.no_permission_contract', 'Você não tem permissão para acessar o módulo de contratos e assinaturas.')}</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {viewAll ? t('contratos.title_manager', 'Envelopes de Contratos') : t('contratos.title_user', 'Meus Documentos')}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {viewAll
                                ? t('contratos.desc_manager', 'Crie envelopes com múltiplos documentos, atribua assinaturas e acompanhe o progresso')
                                : t('contratos.desc_user', 'Documentos pendentes de assinatura eletrônica')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchDocumentos(true)}
                            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title={t('common.update', 'Atualizar')}
                        >
                            <FiRefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        {(can.create || canTemplates) && (
                            <>
                                {canTemplates && <button
                                    onClick={() => {
                                        setUploadModalTab('templates');
                                        setIsUploadOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                                >
                                    <FiSettings className="w-4 h-4 text-gray-500" />
                                    {t('contratos.btn_templates', 'Configurar Templates')}
                                </button>}
                                {can.create && <button
                                    onClick={() => {
                                        setUploadModalTab('envelope');
                                        setIsUploadOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                                >
                                    <FiUpload className="w-4 h-4" />
                                    {t('contratos.btn_create', 'Criar Envelope')}
                                </button>}
                            </>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl">
                            <FiFileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalDocs}</p>
                            <p className="text-xs text-gray-500">{viewAll ? t('contratos.total_envelopes', 'Total de Envelopes') : t('contratos.total_docs', 'Total de Documentos')}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <FiClock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{pendingDocs}</p>
                            <p className="text-xs text-gray-500">{t('contratos.pending', 'Pendentes')}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-xl">
                            <FiCheckCircle className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{signedDocs}</p>
                            <p className="text-xs text-gray-500">{t('contratos.completed', 'Concluídos')}</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('contratos.search_placeholder', 'Buscar por título...')}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="flex gap-2">
                            {(['ALL', 'PENDING', 'SIGNED'] as FilterStatus[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${statusFilter === s
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                >
                                    {s === 'ALL' ? t('common.all', 'Todos') : s === 'PENDING' ? t('contratos.pending', 'Pendentes') : t('contratos.signed', 'Assinados')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Document List */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {loading && documentos.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                        </div>
                    ) : documentos.length === 0 ? (
                        <div className="text-center py-16">
                            <FiFileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">{viewAll ? t('contratos.no_envelope', 'Nenhum envelope encontrado') : t('contratos.no_document', 'Nenhum documento encontrado')}</p>
                            {can.create && (
                                <button
                                    onClick={() => setIsUploadOpen(true)}
                                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    {t('contratos.create_first', 'Criar o primeiro envelope →')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {documentos.map((doc: any) => {
                                const docId = doc.id;
                                const titulo = doc.titulo;
                                const dataCriacao = doc.data_criacao;
                                const docStatus = doc.total_pendentes > 0 ? 'PENDING' : doc.total_assinados > 0 ? 'SIGNED' : 'ACTIVE';

                                return (
                                    <Link
                                        key={doc.id}
                                        href={`/contratos/${docId}`}
                                        className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                                docStatus === 'SIGNED' ? 'bg-emerald-50' :
                                                docStatus === 'PENDING' ? 'bg-amber-50' : 'bg-blue-50'
                                            }`}>
                                                <FiFileText className={`w-5 h-5 ${
                                                    docStatus === 'SIGNED' ? 'text-emerald-500' :
                                                    docStatus === 'PENDING' ? 'text-amber-500' : 'text-blue-500'
                                                }`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {titulo}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                                        <FiCalendar className="w-3 h-3" />
                                                        {dataCriacao && new Date(dataCriacao).toLocaleDateString('pt-BR')}
                                                    </span>
                                                    {viewAll && (
                                                        <>
                                                            <span className="flex items-center gap-1 text-xs text-gray-400 border-l border-gray-200 pl-2">
                                                                <FiFileText className="w-3 h-3" />
                                                                {doc.total_documentos || 0} {t('contratos.docs_short', 'docs')}
                                                            </span>
                                                            <span className="flex items-center gap-1 text-xs text-gray-400 border-l border-gray-200 pl-2">
                                                                <FiUser className="w-3 h-3" />
                                                                {t('contratos.signed_count', '{signed}/{total} assinados').replace('{signed}', (doc.total_assinados || 0).toString()).replace('{total}', (doc.total_solicitacoes || 0).toString())}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <DocumentStatusBadge status={docStatus} />
                                            <FiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            <DocumentUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onSuccess={fetchDocumentos}
                initialTab={uploadModalTab}
            />
        </MainLayout>
    );
}
