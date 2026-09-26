import { useState } from 'react';
import { Loader2, FileText, X, Search, Calendar, Shield, Package } from "lucide-react";
import { toast } from 'react-hot-toast';
import { generateEPIStockReport } from '@/lib/pdf/generateEPIStockReport';

interface EPIStockReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function EPIStockReportModal({ isOpen, onClose }: EPIStockReportModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [reportType, setReportType] = useState<'all' | 'low_stock' | 'movements'>('all');
    const [includeMovements, setIncludeMovements] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // New Filters
    const [filterName, setFilterName] = useState('');
    const [filterCA, setFilterCA] = useState('');
    const [filterValidity, setFilterValidity] = useState('');
    const [filterQuantity, setFilterQuantity] = useState('');

    if (!isOpen) return null;

    const handleGenerate = async () => {
        try {
            setIsLoading(true);

            // 1. Fetch Stock Levels
            const levelsResponse = await fetch('/api/epi/stock?view=levels');
            if (!levelsResponse.ok) {
                throw new Error('Erro ao buscar dados de estoque');
            }
            const levelsJson = await levelsResponse.json();
            const stocks = levelsJson.data || [];

            // Map of epi_type_id to ca_number and name for fast lookup
            const epiTypeMap = stocks.reduce((acc: any, s: any) => {
                if (s.epi_type) {
                    acc[s.epi_type_id] = s.epi_type;
                }
                return acc;
            }, {} as Record<string, any>);

            // 2. Fetch Movements if requested
            let movements = [];
            const shouldFetchMovements = includeMovements || reportType === 'movements';

            if (shouldFetchMovements) {
                let url = '/api/epi/stock?view=movements&limit=500';
                if (startDate) url += `&startDate=${new Date(startDate).toISOString()}`;
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    url += `&endDate=${endOfDay.toISOString()}`;
                }

                const movementsResponse = await fetch(url);
                if (!movementsResponse.ok) {
                    throw new Error('Erro ao buscar movimentações de estoque');
                }
                const movementsJson = await movementsResponse.json();
                movements = movementsJson.data || [];
            }

            // Apply Client-Side Filters
            let filteredStocks = stocks;
            let filteredMovements = movements;

            // Filter by Name
            if (filterName) {
                const nameLower = filterName.toLowerCase();
                filteredStocks = filteredStocks.filter((s: any) => 
                    s.epi_type?.name?.toLowerCase().includes(nameLower)
                );
                filteredMovements = filteredMovements.filter((m: any) => 
                    m.epi_type_name?.toLowerCase().includes(nameLower)
                );
            }

            // Filter by CA Number
            if (filterCA) {
                filteredStocks = filteredStocks.filter((s: any) => 
                    s.epi_type?.ca_number?.toString().includes(filterCA)
                );
                filteredMovements = filteredMovements.filter((m: any) => {
                    const epi = epiTypeMap[m.epi_type_id];
                    return epi?.ca_number?.toString().includes(filterCA);
                });
            }

            // Filter by CA Validity Date (CA validity <= targetDate)
            if (filterValidity) {
                const targetDate = new Date(filterValidity);
                filteredStocks = filteredStocks.filter((s: any) => {
                    if (!s.epi_type?.ca_validity_date) return false;
                    const valDate = new Date(s.epi_type.ca_validity_date);
                    return valDate <= targetDate;
                });
                filteredMovements = filteredMovements.filter((m: any) => {
                    const epi = epiTypeMap[m.epi_type_id];
                    if (!epi?.ca_validity_date) return false;
                    const valDate = new Date(epi.ca_validity_date);
                    return valDate <= targetDate;
                });
            }

            // Filter by Stock Quantity (current_quantity <= targetQty)
            if (filterQuantity !== '') {
                const qtyLimit = parseInt(filterQuantity);
                if (!isNaN(qtyLimit)) {
                    filteredStocks = filteredStocks.filter((s: any) => 
                        s.current_quantity <= qtyLimit
                    );
                    filteredMovements = filteredMovements.filter((m: any) => {
                        const epiStock = stocks.find((s: any) => s.epi_type_id === m.epi_type_id);
                        return epiStock ? epiStock.current_quantity <= qtyLimit : false;
                    });
                }
            }

            // Verify if there are results
            if (reportType === 'low_stock' && filteredStocks.filter((s: any) => s.is_low_stock).length === 0) {
                toast.error('Nenhum item com estoque baixo encontrado para os filtros selecionados.');
                setIsLoading(false);
                return;
            }

            if (reportType !== 'movements' && filteredStocks.length === 0) {
                toast.error('Nenhum item de estoque corresponde aos filtros aplicados.');
                setIsLoading(false);
                return;
            }

            if (reportType === 'movements' && filteredMovements.length === 0) {
                toast.error('Nenhuma movimentação corresponde aos filtros aplicados.');
                setIsLoading(false);
                return;
            }

            // 3. Generate the PDF
            generateEPIStockReport(filteredStocks, filteredMovements, {
                reportType,
                includeMovements: shouldFetchMovements,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                title: 'Relatório de Estoque de EPIs'
            });

            toast.success('Relatório de estoque gerado!');
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
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden text-gray-800">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold">Gerar Relatório de Estoque</h2>
                        <p className="text-sm text-gray-500 mt-1">Configure os filtros do relatório em PDF.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors" aria-label="Fechar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Visualização Principal */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Tipo de Relatório</label>
                        <select
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white transition-all"
                            value={reportType}
                            onChange={(e) => {
                                const val = e.target.value as 'all' | 'low_stock' | 'movements';
                                setReportType(val);
                                if (val === 'movements') {
                                    setIncludeMovements(true);
                                }
                            }}
                        >
                            <option value="all">Estoque Atual Completo</option>
                            <option value="low_stock">Apenas Estoque Baixo (Alerta)</option>
                            <option value="movements">Apenas Histórico de Movimentações</option>
                        </select>
                    </div>

                    {/* Filtros de Especificação de EPI */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <Search className="w-3.5 h-3.5" /> Filtros de Especificação
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">Nome do EPI</label>
                                <input
                                    type="text"
                                    placeholder="ex: Capacete"
                                    className="w-full p-2 text-sm border rounded-md outline-none bg-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                                    value={filterName}
                                    onChange={(e) => setFilterName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">Número do CA</label>
                                <input
                                    type="text"
                                    placeholder="ex: 12345"
                                    className="w-full p-2 text-sm border rounded-md outline-none bg-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                                    value={filterCA}
                                    onChange={(e) => setFilterCA(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">CA Válido Até (Data Limite)</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        className="w-full p-2 text-sm border rounded-md outline-none bg-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                                        value={filterValidity}
                                        onChange={(e) => setFilterValidity(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-600">Estoque Máximo (Qtd &le;)</label>
                                <input
                                    type="number"
                                    placeholder="ex: 10"
                                    min="0"
                                    className="w-full p-2 text-sm border rounded-md outline-none bg-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                                    value={filterQuantity}
                                    onChange={(e) => setFilterQuantity(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Checkbox para incluir movimentações se não for o relatório exclusivo de movimentações */}
                    {reportType !== 'movements' && (
                        <div className="pt-1">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                    checked={includeMovements}
                                    onChange={(e) => setIncludeMovements(e.target.checked)}
                                />
                                <span className="text-sm text-gray-700 font-medium">Incluir histórico de movimentações</span>
                            </label>
                        </div>
                    )}

                    {/* Filtros de data (Visíveis se incluir movimentações) */}
                    {(includeMovements || reportType === 'movements') && (
                        <div className="space-y-3 pt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" /> Período de Movimentações
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-600">Data Início</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-600">Data Fim</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="flex items-center px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
