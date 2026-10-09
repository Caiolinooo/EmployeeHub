'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/'
};

import {
    FiArrowLeft, FiFileText, FiUsers, FiEdit3,
    FiCheck, FiX, FiPlus, FiChevronLeft, FiChevronRight,
    FiTrash2, FiSave, FiSettings, FiCopy, FiRefreshCw
} from 'react-icons/fi';
import DraggableFloatingPanel from '@/components/ui/DraggableFloatingPanel';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/authUtils';
import {
    adoptServerIds,
    isPersistedFieldId,
    isStaleLiveSave,
    mergeDocumentFileUrls,
    remapIds,
} from '@/lib/contracts/field-live';
import SignaturePositionOverlay, { getSignerColor } from '@/components/contratos/SignaturePositionOverlay';
import { useI18n } from '@/contexts/I18nContext';
import toast from 'react-hot-toast';
import MainLayout from '@/components/Layout/MainLayout';

export default function TemplateFieldsEditorPage() {
    const params = useParams();
    const router = useRouter();
    const templateId = params?.id as string;

    const { t } = useI18n();

    const [template, setTemplate] = useState<any>(null);
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [activeDocIndex, setActiveDocIndex] = useState(0);
    const [campos, setCampos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const hasTemplate = useRef(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [fieldRequired, setFieldRequired] = useState(true);
    const [pdfWidth, setPdfWidth] = useState(620);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState<number>(0);
    
    // Placement state
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedRole, setSelectedRole] = useState('');
    const [fieldType, setFieldType] = useState<'assinatura' | 'rubrica' | 'texto' | 'checkbox'>('assinatura');
    const [clickPos, setClickPos] = useState<{ x: number; y: number; page: number } | null>(null);

    const [originalPageSize, setOriginalPageSize] = useState<{ width: number; height: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const activeDoc = documentos[activeDocIndex];
    const routerRef = useRef(router);
    routerRef.current = router;
    const camposRef = useRef<any[]>([]);
    const epochRef = useRef(0);
    const ackedEpochRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flushingRef = useRef(false);
    const flushAgainRef = useRef(false);
    const flushInflightRef = useRef<Promise<void> | null>(null);
    const failRetryRef = useRef(0);

    const loadTemplateData = useCallback(async (background?: boolean) => {
        const soft = !!background && hasTemplate.current;
        try {
            if (soft) setRefreshing(true);
            else setLoading(true);
            const res = await fetchWithAuth(`/api/contracts/templates?id=${templateId}`);
            const data = await res.json();
            if (data.success) {
                hasTemplate.current = true;
                setTemplate(data.template);
                setDocumentos((prev) => mergeDocumentFileUrls(prev, data.documentos || []));
                if (epochRef.current === ackedEpochRef.current) {
                    const nextCampos = data.campos || [];
                    camposRef.current = nextCampos;
                    setCampos(nextCampos);
                }
                if (data.template?.papeis?.length > 0) {
                    setSelectedRole((prev) => prev || data.template.papeis[0]);
                }
            } else {
                toast.error(data.error || 'Erro ao carregar template');
                routerRef.current.push('/contratos');
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao conectar ao servidor');
            routerRef.current.push('/contratos');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [templateId]);

    useEffect(() => {
        if (templateId) {
            loadTemplateData();
        }
    }, [templateId, loadTemplateData]);

    const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
        setNumPages(n);
    };

    const flushTemplateSave = (): Promise<void> => {
        if (flushInflightRef.current) {
            flushAgainRef.current = true;
            return flushInflightRef.current;
        }
        flushingRef.current = true;
        let failed = false;
        const job = (async () => {
        try {
            do {
                flushAgainRef.current = false;
                const epoch = epochRef.current;
                const payload = camposRef.current.map((c) => ({ ...c }));
                let data: { success?: boolean; error?: string; campos?: { id: string; client_id?: string | null }[] };
                try {
                    const res = await fetchWithAuth('/api/contracts/templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: templateId,
                            campos: payload.map(({ id: fieldId, ...rest }) => ({
                                ...rest,
                                id: isPersistedFieldId(fieldId) ? fieldId : undefined,
                                client_id: fieldId,
                            })),
                        }),
                    });
                    data = await res.json();
                } catch (err) {
                    console.error(err);
                    if (!isStaleLiveSave(epoch, epochRef.current)) {
                        toast.error('Erro ao conectar ao servidor');
                        failed = true;
                    } else {
                        flushAgainRef.current = true;
                    }
                    break;
                }
                if (!data.success) {
                    if (!isStaleLiveSave(epoch, epochRef.current)) {
                        toast.error(data.error || 'Erro ao salvar template');
                        failed = true;
                    } else {
                        flushAgainRef.current = true;
                    }
                    break;
                }
                if (isStaleLiveSave(epoch, epochRef.current)) {
                    flushAgainRef.current = true;
                    continue;
                }
                const returned = Array.isArray(data.campos) ? data.campos : [];
                failRetryRef.current = 0;
                ackedEpochRef.current = epoch;
                setCampos((prev) => {
                    if (isStaleLiveSave(epoch, epochRef.current)) return prev;
                    const adopted = adoptServerIds(prev, returned);
                    camposRef.current = adopted;
                    return adopted;
                });
                setSelectedIds((prev) => (
                    isStaleLiveSave(epoch, epochRef.current) ? prev : remapIds(prev, returned)
                ));
            } while (flushAgainRef.current);
        } finally {
            flushingRef.current = false;
            flushInflightRef.current = null;
        }
        if (flushAgainRef.current || (!failed && epochRef.current !== ackedEpochRef.current)) {
            flushAgainRef.current = false;
            await flushTemplateSave();
        } else if (failed && epochRef.current !== ackedEpochRef.current && failRetryRef.current < 2) {
            failRetryRef.current += 1;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => { void flushTemplateSave(); }, 800);
        }
        })();
        flushInflightRef.current = job;
        return job;
    };

    const commitCampos = (updater: (prev: any[]) => any[]) => {
        const next = updater(camposRef.current);
        camposRef.current = next;
        setCampos(next);
        epochRef.current += 1;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { void flushTemplateSave(); }, 300);
    };

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    const onPageLoadSuccess = (page: any) => {
        const viewport = page.getViewport({ scale: 1.0 });
        setOriginalPageSize({ width: viewport.width, height: viewport.height });
    };

    const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAssigning) return;
        if ((e.target as HTMLElement).closest('.cursor-grab')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        setClickPos({
            x: clickX,
            y: clickY,
            page: currentPage
        });
    };

    const handleSaveField = () => {
        if (!clickPos || !activeDoc) return;

        let finalX = clickPos.x;
        let finalY = clickPos.y;
        let finalW = fieldType === 'rubrica' ? 90 : (fieldType === 'checkbox' ? 18 : (fieldType === 'texto' ? 120 : 150));
        let finalH = fieldType === 'rubrica' ? 24 : (fieldType === 'checkbox' ? 18 : (fieldType === 'texto' ? 24 : 28));

        if (originalPageSize) {
            const scaleFactor = originalPageSize.width / pdfWidth;
            finalX = Math.round(clickPos.x * scaleFactor);
            finalY = Math.round(clickPos.y * scaleFactor);
            finalW = Math.round(finalW * scaleFactor);
            finalH = Math.round(finalH * scaleFactor);
        }

        const newField = {
            id: `temp-${Date.now()}`,
            documento_id: activeDoc.id,
            papel_nome: selectedRole,
            pagina_assinatura: clickPos.page,
            posicao_x: finalX,
            posicao_y: finalY,
            largura_assinatura: finalW,
            altura_assinatura: finalH,
            tipo: fieldType,
            obrigatorio: fieldRequired,
            ordem: camposRef.current.filter(c => c.documento_id === activeDoc.id).length + 1
        };

        commitCampos(prev => [...prev, newField]);
        setClickPos(null);
        toast.success('Campo inserido na página!');
    };

    const handleRemoveField = (id: string) => {
        commitCampos(prev => prev.filter(c => c.id !== id));
        setSelectedIds(prev => prev.filter(selected => selected !== id));
        toast.success('Campo removido do template');
    };

    const pointsPerPx = originalPageSize ? originalPageSize.width / pdfWidth : 1;

    const moveFields = (id: string, newX: number, newY: number) => {
        if (!originalPageSize) return;
        commitCampos(prev => {
            const field = prev.find(c => c.id === id);
            if (!field) return prev;
            const oldPx = field.posicao_x / pointsPerPx;
            const oldPy = field.posicao_y / pointsPerPx;
            const dx = newX - oldPx;
            const dy = newY - oldPy;
            const ids = selectedIds.includes(id) ? selectedIds : [id];
            return prev.map(c => {
                if (!ids.includes(c.id)) return c;
                const px = c.id === id ? newX : (c.posicao_x / pointsPerPx) + dx;
                const py = c.id === id ? newY : (c.posicao_y / pointsPerPx) + dy;
                return { ...c, posicao_x: Math.round(Math.max(0, px) * pointsPerPx), posicao_y: Math.round(Math.max(0, py) * pointsPerPx) };
            });
        });
    };

    const resizeField = (id: string, box: { x: number; y: number; width: number; height: number }) => {
        commitCampos(prev => prev.map(c => c.id === id ? {
            ...c,
            posicao_x: Math.round(box.x * pointsPerPx),
            posicao_y: Math.round(box.y * pointsPerPx),
            largura_assinatura: Math.round(box.width * pointsPerPx),
            altura_assinatura: Math.round(box.height * pointsPerPx),
        } : c));
    };

    const copySelected = () => {
        const copies = camposRef.current.filter(c => selectedIds.includes(c.id)).map((c, i) => ({
            ...c,
            id: `temp-${Date.now()}-${i}`,
            posicao_x: (c.posicao_x || 0) + 16,
            posicao_y: (c.posicao_y || 0) + 16,
        }));
        if (copies.length === 0) return;
        commitCampos(prev => [...prev, ...copies]);
        setSelectedIds(copies.map(c => c.id));
        toast.success('Campo copiado');
    };

    const handleSaveTemplateFields = async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        await flushTemplateSave();
        if (epochRef.current === ackedEpochRef.current) {
            toast.success('Template de campos salvo com sucesso!');
        }
    };

    if (loading && !template) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[70vh] text-gray-500">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">Carregando editor de template...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-[1400px] mx-auto px-4 py-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <Link 
                            href="/contratos"
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            <FiArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg uppercase">
                                    Configurador de Template
                                </span>
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mt-1">
                                {template?.titulo}
                            </h1>
                            <p className="text-xs text-gray-500">
                                Posicione as caixas de assinatura e campos de texto onde cada papel deve interagir.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSaveTemplateFields}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-semibold shadow-sm"
                        >
                            <FiSave className="w-4 h-4" />
                            {t('common.save', 'Salvar Template')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Sidebar: Settings & Controls */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* Documents selector */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-950 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <FiFileText className="text-gray-400" /> Documentos do Template
                            </h3>
                            <div className="space-y-2">
                                {documentos.map((doc, idx) => (
                                    <button
                                        key={doc.id}
                                        onClick={() => {
                                            setActiveDocIndex(idx);
                                            setCurrentPage(1);
                                        }}
                                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                                            idx === activeDocIndex
                                                ? 'border-blue-500 bg-blue-50/40  text-blue-700  font-semibold'
                                                : 'border-gray-100  hover:bg-gray-50  text-gray-700 '
                                        }`}
                                    >
                                        <FiFileText className="w-5 h-5 flex-shrink-0" />
                                        <div className="overflow-hidden">
                                            <p className="text-xs truncate font-medium">{doc.titulo}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">Ordem: {idx + 1}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Position Tool */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-950 mb-3 uppercase tracking-wider flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2"><FiSettings className="text-gray-400" /> Ferramenta de Campos</span>
                                <button type="button" onClick={() => loadTemplateData(true)} title="Atualizar" className="p-1 text-gray-400 hover:text-gray-700">
                                    <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
                                </button>
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">1. Selecione o Papel</label>
                                    <select
                                        value={selectedRole}
                                        onChange={e => setSelectedRole(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        {template?.papeis?.map((role: string) => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">2. Tipo de Campo</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'assinatura', name: 'Assinatura' },
                                            { id: 'rubrica', name: 'Rúbrica' },
                                            { id: 'texto', name: 'Texto por Extenso' },
                                            { id: 'checkbox', name: 'Seleção (Checkbox)' }
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setFieldType(t.id as any)}
                                                className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                                                    fieldType === t.id
                                                        ? 'border-blue-500 bg-blue-50 text-blue-600  '
                                                        : 'border-gray-200  hover:bg-gray-50  text-gray-600 '
                                                }`}
                                            >
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} />
                                    Novo campo obrigatório
                                </label>

                                {selectedIds.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={copySelected} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-lg">
                                            <FiCopy /> Copiar
                                        </button>
                                        <button type="button" onClick={() => commitCampos(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, obrigatorio: true } : c))} className="px-2 py-1 text-xs border rounded-lg">Obrigatório</button>
                                        <button type="button" onClick={() => commitCampos(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, obrigatorio: false } : c))} className="px-2 py-1 text-xs border rounded-lg">Opcional</button>
                                        <button type="button" onClick={() => { commitCampos(prev => prev.filter(c => !selectedIds.includes(c.id))); setSelectedIds([]); }} className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded-lg">Excluir</button>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAssigning(!isAssigning);
                                            setClickPos(null);
                                        }}
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${
                                            isAssigning 
                                                ? 'bg-red-50 text-red-600 border border-red-200   '
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                    >
                                        {isAssigning ? 'Cancelar Marcação' : 'Marcar Campo no PDF'}
                                    </button>
                                </div>

                                {isAssigning && (
                                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-700 leading-relaxed">
                                        <strong>Como posicionar:</strong> Clique na página do PDF à direita no local exato onde deseja posicionar o campo <strong>{fieldType}</strong> para o papel <strong>{selectedRole}</strong>.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* List of positioned fields for active document */}
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-950 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <FiUsers className="text-gray-400" /> Campos no Documento
                            </h3>
                            
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {campos.filter(c => c.documento_id === activeDoc?.id).length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-4">Nenhum campo posicionado neste documento.</p>
                                ) : (
                                    campos.filter(c => c.documento_id === activeDoc?.id).map((c) => {
                                        const color = getSignerColor(c.papel_nome);
                                        return (
                                            <div 
                                                key={c.id} 
                                                className="flex items-center justify-between p-3 border border-gray-100 rounded-xl"
                                            >
                                                <div className="overflow-hidden">
                                                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${color.bg} ${color.text} border ${color.border} mb-1`}>
                                                        {c.papel_nome}
                                                    </span>
                                                    <p className="text-xs font-semibold text-gray-800 capitalize">
                                                        {c.tipo} (Pág. {c.pagina_assinatura})
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveField(c.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Right Area: PDF Viewer */}
                    <div className="lg:col-span-8 flex flex-col items-center">
                        {activeDoc ? (
                            <div className="w-full flex flex-col items-center">
                                {/* Navigation / Zoom Bar */}
                                <div className="w-full max-w-[640px] flex items-center justify-between bg-white border border-gray-100 px-4 py-2.5 rounded-2xl mb-4 shadow-sm">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage <= 1}
                                            className="p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 rounded-xl transition-all"
                                        >
                                            <FiChevronLeft className="w-5 h-5" />
                                        </button>
                                        <span className="text-xs font-bold text-gray-800 px-2">
                                            Página {currentPage} de {numPages || '?'}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
                                            disabled={currentPage >= numPages}
                                            className="p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 rounded-xl transition-all"
                                        >
                                            <FiChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPdfWidth(prev => Math.max(400, prev - 50))}
                                            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                                        >
                                            A-
                                        </button>
                                        <button
                                            onClick={() => setPdfWidth(prev => Math.min(900, prev + 50))}
                                            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                                        >
                                            A+
                                        </button>
                                    </div>
                                </div>

                                {/* PDF Container */}
                                <div 
                                    ref={containerRef}
                                    onClick={handlePdfClick}
                                    className="relative border border-gray-200 rounded-2xl overflow-hidden bg-gray-50 shadow-lg cursor-pointer p-1"
                                    style={{ width: pdfWidth + 10 }}
                                >
                                    <Document
                                        key={activeDoc.id}
                                        file={activeDoc.arquivo_url}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        onLoadError={t => {
                                            console.error('PDF load error:', t);
                                            toast.error('Erro ao abrir documento PDF.');
                                        }}
                                        options={PDF_OPTIONS}
                                        loading={
                                            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                                                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                                                Renderizando PDF...
                                            </div>
                                        }
                                    >
                                        <Page
                                            pageNumber={currentPage}
                                            width={pdfWidth}
                                            onLoadSuccess={onPageLoadSuccess}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                        />
                                    </Document>

                                    {/* Position overlays for fields */}
                                    {campos
                                        .filter(c => c.documento_id === activeDoc.id && c.pagina_assinatura === currentPage)
                                        .map((c) => {
                                            const color = getSignerColor(c.papel_nome);
                                            let displayX = c.posicao_x;
                                            let displayY = c.posicao_y;
                                            let displayW = c.largura_assinatura || 150;
                                            let displayH = c.altura_assinatura || 50;

                                            if (originalPageSize) {
                                                const scaleFactor = pdfWidth / originalPageSize.width;
                                                displayX = Math.round(c.posicao_x * scaleFactor);
                                                displayY = Math.round(c.posicao_y * scaleFactor);
                                                displayW = Math.round(displayW * scaleFactor);
                                                displayH = Math.round(displayH * scaleFactor);
                                            }

                                            return (
                                                <SignaturePositionOverlay
                                                    key={c.id}
                                                    x={displayX}
                                                    y={displayY}
                                                    width={displayW}
                                                    height={displayH}
                                                    label={`${c.tipo.toUpperCase()}: ${c.papel_nome}`}
                                                    tipo={c.tipo}
                                                    draggable={true}
                                                    resizable={true}
                                                    selected={selectedIds.includes(c.id)}
                                                    required={c.obrigatorio !== false}
                                                    onSelect={(e) => {
                                                        if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                                            setSelectedIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                                                        } else if (!selectedIds.includes(c.id)) {
                                                            setSelectedIds([c.id]);
                                                        }
                                                    }}
                                                    onDragEnd={(newX, newY) => moveFields(c.id, newX, newY)}
                                                    onResizeEnd={(box) => resizeField(c.id, box)}
                                                    colorClasses={color}
                                                />
                                            );
                                        })}

                                    {/* Click setup position confirmation overlay */}
                                    {clickPos && clickPos.page === currentPage && (
                                        <DraggableFloatingPanel title="Confirmar campo" onClose={() => setClickPos(null)} width={280} zIndex={90}>
                                            <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                                            <div className="text-[10px] text-gray-500 leading-normal space-y-1">
                                                <p><strong>Papel:</strong> {selectedRole}</p>
                                                <p><strong>Tipo:</strong> {fieldType.toUpperCase()}</p>
                                                <p><strong>Pág:</strong> {clickPos.page}</p>
                                            </div>
                                            <label className="flex items-center gap-2 text-[10px] text-gray-600 font-medium">
                                                <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} />
                                                Campo obrigatório
                                            </label>
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => setClickPos(null)}
                                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-semibold"
                                                >
                                                    <FiX /> Cancelar
                                                </button>
                                                <button
                                                    onClick={handleSaveField}
                                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold"
                                                >
                                                    <FiCheck /> Confirmar
                                                </button>
                                            </div>
                                            </div>
                                        </DraggableFloatingPanel>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="py-24 text-center text-gray-400">
                                Nenhum documento no template.
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </MainLayout>
    );
}
