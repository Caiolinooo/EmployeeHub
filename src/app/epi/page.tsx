'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiShield, FiPlus, FiList, FiClock, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import MainLayout from '@/components/Layout/MainLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import EPIList from '@/components/epi/EPIList';
import EPIForm from '@/components/epi/EPIForm';
import EPIStatusBadge from '@/components/epi/EPIStatusBadge';
import { EPIRegistration, EPIType } from '@/types/epi';
import SignaturePad from '@/components/epi/SignaturePad';
import { useSignature } from '@/contexts/SignatureContext';
import { toast } from 'react-hot-toast';
import { generateEPIReport } from '@/lib/pdf/generateEPIReport';

type TabType = 'list' | 'request' | 'history';

export default function EPIPage() {
    const { t } = useI18n();
    const router = useRouter();
    const { user, profile, isAdmin, hasAccess } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<TabType>('list');
    const [registrations, setRegistrations] = useState<EPIRegistration[]>([]);
    const [epiTypes, setEpiTypes] = useState<EPIType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Signature - global system
    const { requestSignature } = useSignature();
    const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);

    const isManager = profile?.role === 'MANAGER' || profile?.role === 'ADMIN' || hasAccess('epi');

    // Fetch registrations and EPI types on mount
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Fetch registrations
            const registrationsRes = await fetch('/api/epi');
            if (!registrationsRes.ok) {
                throw new Error('Erro ao carregar registros de EPI');
            }
            const registrationsData = await registrationsRes.json();
            setRegistrations(registrationsData.data || []);

            // Fetch EPI types
            const typesRes = await fetch('/api/epi/types');
            if (typesRes.ok) {
                const typesData = await typesRes.json();
                setEpiTypes(typesData.data || []);
            }
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching EPI data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRequest = async (data: { equipment_type: string; quantity: number; reason: string }) => {
        try {
            const res = await fetch('/api/epi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Erro ao criar solicitação');
            }

            setShowForm(false);
            await fetchData();
            setActiveTab('list');
            toast.success('Solicitação criada com sucesso!');
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleCancelRequest = async (id: string) => {
        try {
            const res = await fetch(`/api/epi?id=${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Erro ao cancelar solicitação');
            }

            await fetchData();
            toast.success('Solicitação cancelada.');
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleOpenSignature = async () => {
        const approvedItems = registrations
            .filter(r => r.status === 'approved')
            .map(r => r.id);

        if (approvedItems.length === 0) {
            toast.error('Não há itens aprovados para assinar.');
            return;
        }

        // Use the global signature system
        const result = await requestSignature({
            title: 'Assinar Recebimento de EPI',
            description: 'Confirme sua identidade para registrar o recebimento dos EPIs aprovados.',
        });

        if (!result) return; // User cancelled

        try {
            setIsSubmittingSignature(true);
            const userId = user?.id || profile?.id;
            if (!userId) throw new Error('Usuário não identificado');

            const res = await fetch('/api/epi/delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    registrationIds: approvedItems,
                    signatureUrl: result.signatureUrl,
                    authMethod: result.authMethod,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Erro ao confirmar entrega');
            }

            toast.success('Recebimento confirmado com sucesso!');
            await fetchData();
        } catch (err: any) {
            console.error('Signature error:', err);
            toast.error(err.message || 'Erro ao salvar assinatura.');
        } finally {
            setIsSubmittingSignature(false);
        }
    };

    const pendingCount = registrations.filter(r => r.status === 'pending').length;
    const approvedCount = registrations.filter(r => r.status === 'approved').length; // Only approved, not delivered for this counter perhaps? Or keep logic
    const deliveredCount = registrations.filter(r => r.status === 'delivered').length;

    // Items ready to sign
    const hasItemsToSign = registrations.some(r => r.status === 'approved');

    const handleGenerateReport = () => {
        try {
            generateEPIReport(registrations as any, 'Meus EPIs');
            toast.success('Relatório gerado com sucesso!');
        } catch (err) {
            console.error(err);
            toast.error('Erro ao gerar relatório.');
        }
    };

    return (
        <MainLayout>
            <ErrorBoundary>
                <div className="flex flex-col min-h-0 flex-1 h-full w-full max-w-full overflow-hidden">
                    {/* Header */}
                    <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-yellow-100 rounded-lg">
                                <FiShield className="w-6 h-6 text-yellow-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">EPI</h1>
                                <p className="text-sm text-gray-500">Equipamentos de Proteção Individual</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={handleGenerateReport}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                            >
                                <FiList className="w-4 h-4" />
                                Relatório
                            </button>
                            {hasItemsToSign && (
                                <button
                                    onClick={handleOpenSignature}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                >
                                    <FiCheck className="w-4 h-4" />
                                    Assinar Recebimento ({approvedCount})
                                </button>
                            )}
                            <button
                                onClick={() => setShowForm(true)}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
                            >
                                <FiPlus className="w-4 h-4" />
                                Solicitar EPI
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Total Solicitado</p>
                                    <p className="text-2xl font-bold text-gray-900">{registrations.length}</p>
                                </div>
                                <div className="p-2 bg-blue-50 rounded-full">
                                    <FiList className="w-6 h-6 text-blue-500" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Pendentes</p>
                                    <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                                </div>
                                <div className="p-2 bg-yellow-50 rounded-full">
                                    <FiClock className="w-6 h-6 text-yellow-500" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Entregues</p>
                                    <p className="text-2xl font-bold text-green-600">{deliveredCount}</p>
                                </div>
                                <div className="p-2 bg-green-50 rounded-full">
                                    <FiCheck className="w-6 h-6 text-green-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="shrink-0 mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 text-red-700">
                                <FiAlertCircle className="w-5 h-5" />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="bg-white rounded-lg shadow w-full flex-1 min-h-0 flex flex-col">
                        <div className="shrink-0 border-b border-gray-200 overflow-x-auto w-full scrollbar-hide">
                            <nav className="flex -mb-px">
                                <button
                                    onClick={() => { setActiveTab('list'); setShowForm(false); }}
                                    className={`px-4 sm:px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'list' && !showForm
                                        ? 'border-yellow-500 text-yellow-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Meus Itens
                                </button>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className={`px-4 sm:px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${showForm
                                        ? 'border-yellow-500 text-yellow-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Nova Solicitação
                                </button>
                                <button
                                    onClick={() => { setActiveTab('history'); setShowForm(false); }}
                                    className={`px-4 sm:px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'history' && !showForm
                                        ? 'border-yellow-500 text-yellow-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Histórico Completo
                                </button>
                                {isManager && (
                                    <button
                                        onClick={() => router.push('/admin/epi')}
                                        className="ml-auto px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap"
                                    >
                                        Área Admin
                                    </button>
                                )}
                            </nav>
                        </div>

                        <div className="p-3 sm:p-6 w-full max-w-full flex-1 min-h-0 overflow-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                                    <span className="ml-3 text-gray-500">Carregando...</span>
                                </div>
                            ) : showForm ? (
                                <EPIForm
                                    epiTypes={epiTypes}
                                    onSubmit={handleCreateRequest}
                                    onCancel={() => setShowForm(false)}
                                />
                            ) : activeTab === 'list' ? (
                                <EPIList
                                    registrations={registrations.filter(r => ['pending', 'approved', 'delivered'].includes(r.status))}
                                    onCancel={handleCancelRequest}
                                    showActions={true}
                                />
                            ) : (
                                <EPIList
                                    registrations={registrations}
                                    onCancel={handleCancelRequest}
                                    showActions={false}
                                    showHistory={true}
                                />
                            )}
                        </div>
                    </div>
                </div>


            </ErrorBoundary>
        </MainLayout>
    );
}
