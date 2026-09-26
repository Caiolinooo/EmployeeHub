import { useState } from 'react';
import { Loader2, FileText, X } from "lucide-react";
import { toast } from 'react-toastify';
import { generateGeneralEPIReport } from '@/lib/pdf/generateGeneralEPIReport';

interface EPIReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function EPIReportModal({ isOpen, onClose }: EPIReportModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState('all');
    const [includeExpired, setIncludeExpired] = useState(false);
    const [unifyRequests, setUnifyRequests] = useState(false);
    const [onlyRequests, setOnlyRequests] = useState(false);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        try {
            setIsLoading(true);

            // Fetch data via API
            const response = await fetch('/api/epi/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    status: status === 'all' ? undefined : status,
                    onlyRequests
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao buscar dados');
            }

            const json = await response.json();
            const data = json.data;

            if (!data || data.length === 0) {
                toast.warning('Nenhum dado encontrado para os filtros selecionados.');
                setIsLoading(false);
                return;
            }

            // Generate PDF (Client Side)
            generateGeneralEPIReport(data, {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                includeExpired,
                unifyRequests,
                onlyRequests,
                title: 'Relatório Geral de EPIs'
            });

            toast.success('Relatório gerado com sucesso!');
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Erro ao gerar relatório.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold">Gerar Relatório Geral de EPI</h2>
                        <p className="text-sm text-gray-500 mt-1">Selecione os filtros para o PDF.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="Fechar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Data Início</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Data Fim</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <select
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendente</option>
                            <option value="approved">Aprovado</option>
                            <option value="delivered">Entregue</option>
                            <option value="returned">Devolvido</option>
                        </select>
                    </div>

                    <div className="space-y-3 pt-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                checked={includeExpired}
                                onChange={(e) => setIncludeExpired(e.target.checked)}
                            />
                            <span className="text-sm text-gray-700">Destacar EPIs com CA vencido</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                checked={unifyRequests}
                                onChange={(e) => setUnifyRequests(e.target.checked)}
                            />
                            <span className="text-sm text-gray-700">Agrupar por Funcionário (Unificar Kits)</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                checked={onlyRequests}
                                onChange={(e) => setOnlyRequests(e.target.checked)}
                            />
                            <span className="text-sm text-gray-700">Somente Solicitações (Excluir Kits Auto)</span>
                        </label>
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4 mr-2" />
                                Gerar PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
