'use client';

import React, { useRef, useState, useEffect } from 'react';
import { FiCalendar, FiSearch, FiCheckCircle, FiXCircle, FiClock, FiAlertCircle, FiEye, FiTrash2, FiShield, FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx-js-style';
import toast from 'react-hot-toast';
import { LeaveRequest } from '@/services/leaveService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getToken } from '@/lib/tokenStorage';

interface UnifiedUser {
    id: string;
    name: string;
    email: string;
    sector_id: string;
}

interface RequestWithUser extends LeaveRequest {
    user: UnifiedUser;
    sector?: { name: string };
}

export default function AdminLeaveRequestsPage() {
    const [requests, setRequests] = useState<RequestWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    // Modal state
    const [selectedReq, setSelectedReq] = useState<RequestWithUser | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [actionReason, setActionReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            if (filterStatus !== 'ALL') queryParams.append('status', filterStatus);

            const token = getToken();
            const res = await fetch(`/api/admin/leave-requests?${queryParams.toString()}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error('Failed to fetch requests');

            const data = await res.json();
            setRequests(data.requests || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast.error('Erro ao carregar solicitações.');
        } finally {
            setLoading(false);
        }
    };

    // We do simple frontend filtering for search
    const filteredRequests = requests.filter(req => {
        if (!searchTerm) return true;
        const lowSearch = searchTerm.toLowerCase();
        return (
            req.user?.name?.toLowerCase().includes(lowSearch) ||
            req.sector?.name?.toLowerCase().includes(lowSearch) ||
            req.status.toLowerCase().includes(lowSearch)
        );
    });

    const tableRef = useRef<HTMLTableElement>(null);

    const exportToExcel = () => {
        if (!tableRef.current) return;
        const wb = XLSX.utils.table_to_book(tableRef.current, { sheet: 'Férias' });
        const ws = wb.Sheets['Férias'];
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z100');
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[addr]) continue;
                ws[addr].s = {
                    font: { name: 'Calibri', sz: 11 },
                    alignment: { vertical: 'center', wrapText: true },
                    border: {
                        top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                        left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                        right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                    }
                };
                if (R === 0) {
                    ws[addr].s.font = { name: 'Calibri', sz: 11, bold: true };
                    ws[addr].s.fill = { fgColor: { rgb: 'E8EDF5' } };
                }
            }
        }
        ws['!cols'] = [
            { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 22 }
        ];
        XLSX.writeFile(wb, `Ferias_Solicitacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success('Planilha exportada com sucesso!');
    };

    const handleAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !actionReason.trim()) {
            toast.error('Por favor, informe um motivo para a rejeição (obrigatório).');
            return;
        }

        try {
            setIsProcessing(true);
            const token = getToken();
            const response = await fetch('/api/admin/leave-approvals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    request_id: requestId,
                    action,
                    reason: actionReason,
                    force_admin: true
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Falha ao processar solicitação');
            }

            toast.success(action === 'APPROVE' ? 'Férias aprovadas com sucesso!' : 'Férias rejeitadas.');
            setIsModalOpen(false);
            fetchRequests();
        } catch (error: any) {
            console.error('Approval/Rejection error:', error);
            toast.error(error.message || 'Erro ao processar solicitação.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (requestId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            setIsProcessing(true);
            const token = getToken();
            const response = await fetch(`/api/admin/leave-requests?id=${requestId}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Falha ao excluir solicitação');
            }

            toast.success('Solicitação excluída com sucesso!');
            setIsModalOpen(false);
            fetchRequests();
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error(error.message || 'Erro ao excluir solicitação.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadComprovante = async (req: RequestWithUser) => {
        try {
            const token = getToken();
            if (!token) {
                toast.error('Sessão expirada. Faça login novamente para baixar o formulário.');
                return;
            }
            const res = await fetch(`/api/leave/${req.id}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({} as { error?: string }));
                if (errData?.error) throw new Error(errData.error);
                if (res.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
                if (res.status === 403) throw new Error('Sem permissão para baixar este formulário.');
                if (res.status === 404) throw new Error('Solicitação não encontrada ou dados do colaborador indisponíveis.');
                throw new Error('Falha ao gerar comprovante');
            }

            const blob = await res.blob();
            if (!blob.size) throw new Error('PDF vazio recebido do servidor.');
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Comprovante_Ferias_${req.id.slice(0, 8)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Comprovante baixado com sucesso!');
        } catch (error: any) {
            console.error('Error downloading comprovante:', error);
            toast.error(error.message || 'Erro ao baixar comprovante');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><FiCheckCircle className="mr-1" /> Aprovado</span>;
            case 'REJECTED':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><FiXCircle className="mr-1" /> Rejeitado</span>;
            case 'PENDING_LEADER':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><FiClock className="mr-1" /> Análise do Líder</span>;
            case 'PENDING_MANAGER':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><FiClock className="mr-1" /> Análise do Gerente</span>;
            case 'CANCELLED':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><FiXCircle className="mr-1" /> Cancelado</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        try {
            return format(parseISO(dateString), "dd 'de' MMMM, yyyy", { locale: ptBR });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="flex flex-col min-h-0 flex-1 h-full max-w-7xl mx-auto w-full">
            <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <FiCalendar className="w-8 h-8 text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Todas as Solicitações de Férias</h1>
                        <p className="text-gray-500">Visão global de todos os pedidos de férias do sistema.</p>
                    </div>
                </div>
                <a
                    href="/admin/ferias-access"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
                >
                    <FiShield className="w-4 h-4" />
                    Gerenciar Acesso
                </a>
            </div>

            {/* Filters */}
            <div className="shrink-0 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg self-start md:self-auto overflow-x-auto w-full md:w-auto">
                    {[
                        { id: 'ALL', label: 'Todas' },
                        { id: 'PENDING_LEADER', label: 'Pendentes Líder' },
                        { id: 'PENDING_MANAGER', label: 'Pendentes Gerente' },
                        { id: 'APPROVED', label: 'Aprovadas' },
                        { id: 'REJECTED', label: 'Rejeitadas' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterStatus(tab.id)}
                            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === tab.id
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3 items-center w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        onClick={exportToExcel}
                        disabled={filteredRequests.length === 0}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition font-medium text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiDownload />
                        Exportar XLSX
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-auto">
                    <table ref={tableRef} className="w-full min-w-[800px]">
                        <thead className="bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Colaborador / Setor</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Período Principal</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Atual</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data da Solicitação</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <FiAlertCircle className="mx-auto h-8 w-8 mb-3 text-gray-400" />
                                        Nenhuma solicitação encontrada.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{req.user?.name || 'Não identificado'}</div>
                                            <div className="text-sm text-gray-500">{req.sector?.name || 'Sem setor'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 border border-gray-200 rounded-md px-2 py-1 bg-gray-50 inline-block font-mono">
                                                {req.start_date} até {req.end_date}
                                            </div>
                                            {req.periods && req.periods.length > 1 && (
                                                <div className="text-xs text-blue-600 mt-1 font-medium italic">
                                                    (+ Férias Fracionadas)
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(req.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedReq(req);
                                                    setActionReason('');
                                                    setIsModalOpen(true);
                                                }}
                                                className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors border border-blue-100"
                                            >
                                                <FiEye className="mr-1.5" /> Detalhes / Ação
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Detalhes e Ações Administrativas */}
            {isModalOpen && selectedReq && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity" onClick={() => !isProcessing && setIsModalOpen(false)}>
                            <div className="absolute inset-0 bg-gray-900 opacity-50"></div>
                        </div>

                        <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full border border-gray-100">
                            <div className="bg-white px-6 pb-6 pt-6">
                                <div className="sm:flex sm:items-start mb-6 pb-4 border-b border-gray-100">
                                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                                        <FiCalendar className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                                        <h3 className="text-xl leading-6 font-bold text-gray-900">
                                            Detalhes da Solicitação de Férias
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {selectedReq.user?.name} - {selectedReq.sector?.name}
                                        </p>
                                    </div>
                                    <div className="mt-2 sm:mt-0 ml-auto">
                                        {getStatusBadge(selectedReq.status)}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Períodos Fracionados */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Períodos de Gozo</h4>
                                        {selectedReq.periods && selectedReq.periods.length > 0 ? (
                                            <div className="space-y-2">
                                                {selectedReq.periods.map((p, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white border border-gray-200 p-3 rounded-md shadow-sm">
                                                        <span className="font-medium text-gray-700 text-sm">Período {idx + 1}</span>
                                                        <span className="text-gray-600 font-mono text-sm">{p.start_date} até {p.end_date} • <span className="text-blue-600 font-bold">{p.duration} dias</span></span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center bg-white border border-gray-200 p-3 rounded-md shadow-sm">
                                                <span className="font-medium text-gray-700 text-sm">Período Único</span>
                                                <span className="text-gray-600 font-mono text-sm">{selectedReq.start_date} até {selectedReq.end_date}</span>
                                            </div>
                                        )}
                                    </div>

                                    {selectedReq.justification && (
                                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                            <h4 className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-2">Observações / Motivo</h4>
                                            <p className="text-sm text-gray-700 italic border-l-2 border-blue-300 pl-3">"{selectedReq.justification}"</p>
                                        </div>
                                    )}

                                    {/* Ações (Apenas Administrativas) */}
                                    {(selectedReq.status === 'PENDING_LEADER' || selectedReq.status === 'PENDING_MANAGER') ? (
                                        <div className="border-t border-gray-200 pt-5 mt-5">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                <FiAlertCircle className="text-orange-500" />
                                                Ações de Intervenção Administrativa
                                            </h4>
                                            <p className="text-xs text-gray-500 mb-4">
                                                Como administrador, você pode aprovar ou reprovar esta solicitação em nome da hierarquia do setor. Esta ação é definitiva e acionará os alertas normais por e-mail para o usuário e aprovadores.
                                            </p>
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Motivo da Rejeição <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(Apenas ao rejeitar)</span>
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2"
                                                    placeholder="Insira o motivo se for reprovar..."
                                                    value={actionReason}
                                                    onChange={(e) => setActionReason(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-t border-gray-200 pt-5 mt-5">
                                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                                <FiCheckCircle className="text-gray-400" />
                                                Esta solicitação já foi finalizada e não pode sofrer novas ações.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => !isProcessing && setIsModalOpen(false)}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                                >
                                    Fechar
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleDownloadComprovante(selectedReq)}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:text-sm disabled:opacity-50"
                                >
                                    <FiDownload className="mr-2" /> Baixar formulário PDF (preenchido)
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleDelete(selectedReq.id)}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-100 text-base font-medium text-red-700 hover:bg-red-200 focus:outline-none sm:text-sm disabled:opacity-50"
                                >
                                    {isProcessing ? 'Excluindo...' : <><FiTrash2 className="mr-2" /> Excluir</>}
                                </button>

                                {(selectedReq.status === 'PENDING_LEADER' || selectedReq.status === 'PENDING_MANAGER') && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleAction(selectedReq.id, 'REJECT')}
                                            disabled={isProcessing}
                                            className="w-full sm:w-auto inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:text-sm disabled:opacity-50"
                                        >
                                            {isProcessing ? 'Processando...' : <><FiXCircle className="mr-2" /> Rejeitar</>}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAction(selectedReq.id, 'APPROVE')}
                                            disabled={isProcessing}
                                            className="w-full sm:w-auto inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:text-sm disabled:opacity-50"
                                        >
                                            {isProcessing ? 'Processando...' : <><FiCheckCircle className="mr-2" /> Forçar Aprovação Final</>}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
