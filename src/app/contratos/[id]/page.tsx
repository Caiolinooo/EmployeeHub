'use client';

import { normalizeCpf, formatCpf } from '@/lib/utils/identity';

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
    FiDownload, FiCheck, FiX, FiPlus,
    FiChevronLeft, FiChevronRight, FiChevronDown, FiTrash2, FiShield,
    FiMail, FiLink, FiPenTool, FiCheckCircle,
    FiTarget, FiEdit, FiUserPlus, FiPlusCircle, FiSearch, FiEye, FiRefreshCw, FiCopy
} from 'react-icons/fi';
import DraggableFloatingPanel from '@/components/ui/DraggableFloatingPanel';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/authUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSignature } from '@/contexts/SignatureContext';
import DocumentStatusBadge from '@/components/contratos/DocumentStatusBadge';
import SignaturePositionOverlay, { getSignerColor } from '@/components/contratos/SignaturePositionOverlay';
import AuditInfoPanel from '@/components/contratos/AuditInfoPanel';
import { useI18n } from '@/contexts/I18nContext';
import {
    insertFields,
    mergeDocumentFileUrls,
    patchFields,
    removeFields,
    restoreRemoved,
    revertIfUnchanged,
    swapFieldId,
} from '@/lib/contracts/field-live';
import toast from 'react-hot-toast';
import MainLayout from '@/components/Layout/MainLayout';

export default function ContratoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const docId = params?.id as string;

    const { user } = useSupabaseAuth();
    const { requestSignature } = useSignature();
    const { t } = useI18n();

    // Ações vêm do servidor (loadContractAccess): JSONB + ACL + role, mesma regra das rotas
    const [can, setCan] = useState<Record<string, boolean>>({});
    const isManager = !!can['signers.manage'];

    const [envelope, setEnvelope] = useState<any>(null);
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [activeDocIndex, setActiveDocIndex] = useState(0);
    const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const hasEnvelope = useRef(false);
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
    const [fieldRequired, setFieldRequired] = useState(true);
    const [pdfWidth, setPdfWidth] = useState(600);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState<number>(0);

    // Assignment state (HR)
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedColaborador, setSelectedColaborador] = useState('');
    const [colaboradores, setColaboradores] = useState<any[]>([]);
    const [clickPos, setClickPos] = useState<{ x: number; y: number; page: number; tipo: 'assinatura' | 'rubrica' | 'texto' | 'checkbox' | 'copia'; w?: number; h?: number } | null>(null);
    const [signatureType, setSignatureType] = useState<'assinatura' | 'rubrica' | 'texto' | 'checkbox' | 'copia'>('assinatura');
    const [signatureOrder, setSignatureOrder] = useState<number>(1);
    
    // Advanced Search / External signer states
    const [searchQuery, setSearchQuery] = useState('');
    const [manualSignerName, setManualSignerName] = useState('');
    const [manualSignerEmail, setManualSignerEmail] = useState('');
    const [manualSignerTaxId, setManualSignerTaxId] = useState('');
    const [manualSignerBirthDate, setManualSignerBirthDate] = useState('');
    const [isExternalInput, setIsExternalInput] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [reuseSignerInfo, setReuseSignerInfo] = useState(true); // default true for convenience
    const [lastSigner, setLastSigner] = useState<{
        colaborador_id: string;
        external_name: string;
        external_email: string;
        isExternal: boolean;
    } | null>(null);

    // CC (Cópia) States
    const [ccEmail, setCcEmail] = useState('');
    const [ccName, setCcName] = useState('');
    const [isAddingCC, setIsAddingCC] = useState(false);

    // Check for first-time tutorial on load
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasSeen = localStorage.getItem('has_seen_sign_tutorial');
            if (!hasSeen) setShowTutorial(true);
        }
    }, []);

    const dismissTutorial = () => {
        localStorage.setItem('has_seen_sign_tutorial', 'true');
        setShowTutorial(false);
    };

    const resetAssignState = () => {
        if (reuseSignerInfo && lastSigner) {
            setSelectedColaborador(lastSigner.colaborador_id);
            setManualSignerName(lastSigner.external_name);
            setManualSignerEmail(lastSigner.external_email);
            setIsExternalInput(lastSigner.isExternal);
        } else {
            setSelectedColaborador('');
            setManualSignerName('');
            setManualSignerEmail('');
            setManualSignerTaxId('');
            setManualSignerBirthDate('');
            setIsExternalInput(false);
        }
        setSearchQuery('');
        setClickPos(null);
    };
    
    // Original PDF Dimensions (Points) used for scaling normalization
    const [originalPageSize, setOriginalPageSize] = useState<{ width: number; height: number } | null>(null);

    // Send modal state
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendMode, setSendMode] = useState<'email' | 'link' | null>(null);
    // Signing state (Collaborator)
    const [isSigning, setIsSigning] = useState(false);
    const [mySolicitacao, setMySolicitacao] = useState<any>(null);
    const [showLegalConfirm, setShowLegalConfirm] = useState(false);
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [signMethod, setSignMethod] = useState<'certificado' | 'dados' | null>(null);
    const [signerData, setSignerData] = useState({ nome: '', cpf: '', email: '', telefone: '' });

    // Signed PDF URL (available after signing)
    const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
    const [filledValues, setFilledValues] = useState<{ [solicitacaoId: string]: string }>({});

    // Audit data
    const [auditData, setAuditData] = useState<any>(null);
    const [expandedSigners, setExpandedSigners] = useState<Record<string, boolean>>({});

    const pdfContainerRef = useRef<HTMLDivElement>(null);

    // Active document selector
    const currentDocumento = documentos[activeDocIndex] || null;
    // Filtered assignments for current document (EXCLUDING CCs)
    const currentSolicitacoes = solicitacoes.filter((s: any) => s.documento_id === currentDocumento?.id && s.tipo !== 'copia');
    // Active CCs (Observers) in the entire envelope
    const ccSolicitacoes = solicitacoes.filter((s: any) => s.tipo === 'copia');

    const solicitacoesRef = useRef<any[]>([]);
    const fieldWrites = useRef(0);
    const routerRef = useRef(router);
    routerRef.current = router;
    const tRef = useRef(t);
    tRef.current = t;

    const applySolicitacoes = (updater: (prev: any[]) => any[]) => {
        const next = updater(solicitacoesRef.current);
        solicitacoesRef.current = next;
        setSolicitacoes(next);
    };

    const fetchDocumento = useCallback(async (background?: boolean) => {
        const soft = !!background && hasEnvelope.current;
        try {
            if (soft) setRefreshing(true);
            else setLoading(true);
            const res = await fetchWithAuth(`/api/contracts?id=${docId}`);
            const data = await res.json();

            if (data.success) {
                console.log('[ContratoDetail] Envelope carregado:', data.envelope?.titulo);
                hasEnvelope.current = true;
                setEnvelope(data.envelope);
                setCan(data.can || {});
                setDocumentos((prev) => mergeDocumentFileUrls(prev, data.documentos || []));
                // Escrita de campo em curso: não substituir a lista (o GET traria a posição antiga).
                if (fieldWrites.current === 0) {
                    const nextSolicitacoes = data.solicitacoes || [];
                    solicitacoesRef.current = nextSolicitacoes;
                    setSolicitacoes(nextSolicitacoes);
                }

                const initialValues: Record<string, string> = {};
                (data.solicitacoes || []).forEach((s: any) => {
                    if (s.valor_preenchido !== null && s.valor_preenchido !== undefined) {
                        initialValues[s.id] = s.valor_preenchido;
                    }
                });
                setFilledValues(prev => ({ ...initialValues, ...prev }));
            } else {
                toast.error(data.error || tRef.current('contratos.detail.envelope_not_found', 'Envelope não encontrado'));
                routerRef.current.push('/contratos');
            }
        } catch (err) {
            toast.error(tRef.current('contratos.detail.error_loading_envelope', 'Erro ao carregar envelope'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [docId]);

    useEffect(() => {
        if (docId) fetchDocumento();
    }, [docId, fetchDocumento]);

    useEffect(() => {
        if (!user?.id) {
            setMySolicitacao(null);
            return;
        }
        const mine = solicitacoes.find((s: any) => s.colaborador_id === user.id && s.status === 'PENDING' && (s.tipo === 'assinatura' || s.tipo === 'rubrica'))
            || solicitacoes.find((s: any) => s.colaborador_id === user.id && s.status === 'PENDING')
            || solicitacoes.find((s: any) => s.colaborador_id === user.id);
        setMySolicitacao(mine || null);
    }, [user?.id, solicitacoes]);

    // When switching documents, reset page
    useEffect(() => {
        setCurrentPage(1);
        resetAssignState();
    }, [activeDocIndex]);

    // Fetch collaborators for assignment (HR only)
    useEffect(() => {
        if (isManager) {
            console.log('[ContratoDetail] Buscando colaboradores...');
            fetchWithAuth('/api/users?limit=200')
                .then(res => res.json())
                .then(data => {
                    const users = data.users || (Array.isArray(data) ? data : []) || [];
                    setColaboradores(Array.isArray(users) ? users : []);
                })
                .catch((err) => {
                    console.error('[ContratoDetail] Erro ao buscar usuários:', err);
                    setColaboradores([]);
                });
        }
    }, [isManager]);

    // Auto-size PDF container
    useEffect(() => {
        const updateWidth = () => {
            if (pdfContainerRef.current) {
                const w = pdfContainerRef.current.clientWidth - 32;
                setPdfWidth(Math.min(w, 800));
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
        setNumPages(n);
    };

    const onPageLoadSuccess = (page: any) => {
        const viewport = page.getViewport({ scale: 1.0 });
        console.log('[ContratoDetail] Página carregada - Dimensões originais:', viewport.width, viewport.height);
        setOriginalPageSize({ width: viewport.width, height: viewport.height });
    };

    const onDocumentLoadError = (error: Error) => {
        console.error('[ContratoDetail] Erro ao carregar PDF:', error);
        toast.error(`${t('contratos.detail.error_loading_pdf', 'Erro ao carregar PDF')}: ${error.message}`);
    };

    // Handle click on PDF to set signature position
    const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAssigning || signatureType === 'copia') return;

        // Prevent setting a new position if we are clicking on an existing Draggable overlay
        if ((e.target as HTMLElement).closest('.cursor-grab')) return;
        
        // Also prevent if already have a clickPos active (force resolve that one first, or allow move?)
        // Actually allowing replace is good UX.

        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);

        // Scroll slightly if needed?
        
        setClickPos({
            x,
            y,
            page: currentPage,
            tipo: signatureType
        });
        
        // Keep current selections unless explicitly desired to reset
        // actually, just toast the positional lock.
    };

    // Copy specific token link
    const handleCopyTokenLink = async (token: string) => {
        const link = `${window.location.origin}/assinatura/${token}`;
        await navigator.clipboard.writeText(link);
        toast.success(t('contratos.detail.success_link_copied', 'Link único de assinatura copiado!'));
    };

    // Save assignment (HR)
    const handleSaveAssignment = async () => {
        console.log('[ContratoDetail] Salvando atribuição...', {
            selectedColaborador,
            manualSignerEmail,
            clickPos
        });

        const hasInternal = !!selectedColaborador;
        const hasExternal = !!manualSignerEmail;

        if (!hasInternal && !hasExternal) {
            toast.error(t('contratos.detail.error_select_signer', 'Selecione um colaborador da lista ou informe um e-mail válido.'));
            return;
        }

        const posX = clickPos?.x || 100;
        const posY = clickPos?.y || 500;
        const posPage = clickPos?.page || 1;
        const posTipo = clickPos?.tipo || signatureType;

        if (!currentDocumento?.id) {
            toast.error(t('contratos.detail.error_no_doc', 'Nenhum documento selecionado'));
            return;
        }

        // CONVERSION: Scale pixel browser clicks to canonical PDF Points
        let finalX = posX;
        let finalY = posY;
        let finalW = clickPos?.w || (posTipo === 'rubrica' ? 90 : (posTipo === 'checkbox' ? 18 : (posTipo === 'texto' ? 120 : 150)));
        let finalH = clickPos?.h || (posTipo === 'rubrica' ? 24 : (posTipo === 'checkbox' ? 18 : (posTipo === 'texto' ? 24 : 28)));

        if (originalPageSize) {
            const scaleFactor = originalPageSize.width / pdfWidth;
            finalX = Math.round(posX * scaleFactor);
            finalY = Math.round(posY * scaleFactor);
            finalW = Math.round(finalW * scaleFactor);
            finalH = Math.round(finalH * scaleFactor);
        }

        const colab = colaboradores.find(c => (c.id || c._id) === selectedColaborador);
        const tempId = `temp-${Date.now()}`;
        const optimistic = {
            id: tempId,
            documento_id: currentDocumento.id,
            envelope_id: docId,
            colaborador_id: selectedColaborador || null,
            colaborador: colab ? {
                id: colab.id || colab._id,
                first_name: colab.first_name,
                last_name: colab.last_name,
                email: colab.email,
            } : null,
            external_signer_name: manualSignerName || null,
            external_signer_email: manualSignerEmail || null,
            pagina_assinatura: posPage,
            posicao_x: finalX,
            posicao_y: finalY,
            largura_assinatura: finalW,
            altura_assinatura: finalH,
            tipo: posTipo,
            ordem: signatureOrder,
            obrigatorio: fieldRequired,
            status: 'PENDING',
        };
        applySolicitacoes(prev => insertFields(prev, [optimistic]));
        setClickPos(null);
        fieldWrites.current += 1;

        try {
            const res = await fetchWithAuth(`/api/contracts/${docId}/assign`, {
                method: 'POST',
                body: JSON.stringify({
                    documento_id: currentDocumento.id,
                    colaborador_id: selectedColaborador || null,
                    external_signer_name: manualSignerName || null,
                    external_signer_email: manualSignerEmail || null,
                    external_signer_tax_id: manualSignerTaxId ? normalizeCpf(manualSignerTaxId) : null,
                    external_signer_birth_date: manualSignerBirthDate || null,
                    pagina_assinatura: posPage,
                    posicao_x: finalX,
                    posicao_y: finalY,
                    largura_assinatura: finalW,
                    altura_assinatura: finalH,
                    tipo: posTipo,
                    ordem: signatureOrder,
                    obrigatorio: fieldRequired,
                }),
            });

            const data = await res.json();

            if (data.success && data.solicitacao?.id) {
                const serverId = data.solicitacao.id as string;
                applySolicitacoes(prev => patchFields(swapFieldId(prev, tempId, serverId), [{
                    id: serverId,
                    ...(data.solicitacao.token_acesso ? { token_acesso: data.solicitacao.token_acesso } : {}),
                }]));
                toast.success(t('contratos.detail.success_assigned', 'Assinatura posicionada com sucesso!'));
                const newLastSigner = reuseSignerInfo ? {
                    colaborador_id: selectedColaborador,
                    external_name: manualSignerName,
                    external_email: manualSignerEmail,
                    isExternal: isExternalInput
                } : null;
                setLastSigner(newLastSigner);
                
                if (reuseSignerInfo && newLastSigner) {
                    setSelectedColaborador(newLastSigner.colaborador_id);
                    setManualSignerName(newLastSigner.external_name);
                    setManualSignerEmail(newLastSigner.external_email);
                    setIsExternalInput(newLastSigner.isExternal);
                } else {
                    setSelectedColaborador('');
                    setManualSignerName('');
                    setManualSignerEmail('');
                    setIsExternalInput(false);
                }
                setSearchQuery('');
            } else {
                applySolicitacoes(prev => removeFields(prev, [tempId]));
                toast.error(data.error || t('contratos.detail.error_assigning', 'Erro ao atribuir'));
            }
        } catch (err) {
            applySolicitacoes(prev => removeFields(prev, [tempId]));
            toast.error(t('contratos.detail.error_assigning_save', 'Erro ao salvar atribuição'));
        } finally {
            fieldWrites.current -= 1;
        }
    };

    // Add CC (Cópia) observer
    const handleSaveCC = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ccName.trim() || !ccEmail.trim()) {
            toast.error(t('contratos.detail.error_cc_fields', 'Informe o nome e e-mail para enviar em cópia.'));
            return;
        }
        if (!currentDocumento?.id) {
            toast.error(t('contratos.detail.error_active_doc', 'Nenhum documento ativo.'));
            return;
        }

        const tempId = `temp-cc-${Date.now()}`;
        const optimistic = {
            id: tempId,
            documento_id: currentDocumento.id,
            envelope_id: docId,
            external_signer_name: ccName.trim(),
            external_signer_email: ccEmail.trim(),
            tipo: 'copia',
            ordem: 1,
            status: 'PENDING',
        };
        applySolicitacoes(prev => insertFields(prev, [optimistic]));
        setCcName('');
        setCcEmail('');
        fieldWrites.current += 1;

        try {
            setIsAddingCC(true);
            const res = await fetchWithAuth(`/api/contracts/${docId}/assign`, {
                method: 'POST',
                body: JSON.stringify({
                    documento_id: currentDocumento.id,
                    external_signer_name: optimistic.external_signer_name,
                    external_signer_email: optimistic.external_signer_email,
                    tipo: 'copia',
                    ordem: 1,
                }),
            });

            const data = await res.json();

            if (data.success && data.solicitacao?.id) {
                const serverId = data.solicitacao.id as string;
                applySolicitacoes(prev => patchFields(swapFieldId(prev, tempId, serverId), [{
                    id: serverId,
                    ...(data.solicitacao.token_acesso ? { token_acesso: data.solicitacao.token_acesso } : {}),
                }]));
                toast.success(t('contratos.detail.success_cc_added', 'Pessoa em cópia adicionada com sucesso!'));
            } else {
                applySolicitacoes(prev => removeFields(prev, [tempId]));
                toast.error(data.error || t('contratos.detail.error_cc_add', 'Erro ao adicionar pessoa em cópia'));
            }
        } catch {
            applySolicitacoes(prev => removeFields(prev, [tempId]));
            toast.error(t('contratos.detail.error_cc_comms', 'Erro de comunicação ao salvar cópia'));
        } finally {
            setIsAddingCC(false);
            fieldWrites.current -= 1;
        }
    };

    // Delete assignment (HR)
    const deleteSolicitacoesLive = async (ids: string[]) => {
        const snapshots = solicitacoesRef.current.filter((s: any) => ids.includes(s.id));
        applySolicitacoes(prev => removeFields(prev, ids));
        setSelectedFieldIds(prev => prev.filter(id => !ids.includes(id)));
        fieldWrites.current += 1;
        try {
            const results = await Promise.all(ids.map(async (id) => {
                const res = await fetchWithAuth(`/api/contracts/${docId}/assign?solicitacao_id=${id}`, {
                    method: 'DELETE',
                });
                const data = await res.json().catch(() => ({}));
                return res.ok && data.success !== false;
            }));
            const failed = snapshots.filter((_, index) => !results[index]);
            if (failed.length > 0) {
                applySolicitacoes(prev => restoreRemoved(prev, failed));
                toast.error(t('common.error_removing', 'Erro ao remover'));
                return false;
            }
            return true;
        } catch {
            applySolicitacoes(prev => restoreRemoved(prev, snapshots));
            toast.error(t('common.error_removing', 'Erro ao remover'));
            return false;
        } finally {
            fieldWrites.current -= 1;
        }
    };

    const handleDeleteAssignment = async (solicitacaoId: string) => {
        if (!confirm(t('contratos.detail.confirm_delete_assign', 'Remover esta atribuição?'))) return;
        const ok = await deleteSolicitacoesLive([solicitacaoId]);
        if (ok) toast.success(t('contratos.detail.success_removed', 'Atribuição removida'));
    };

    const handleDeleteAllSignerAssignments = async (name: string, items: any[]) => {
        if (!confirm(t('contratos.detail.confirm_delete_all_signer', 'Remover todas as atribuições de {name}?').replace('{name}', name))) return;
        const ok = await deleteSolicitacoesLive(items.map((s) => s.id));
        if (ok) toast.success(t('contratos.detail.success_removed_all', 'Todas as atribuições removidas'));
    };

    const pointsPerPx = originalPageSize ? originalPageSize.width / pdfWidth : 1;

    const patchField = async (id: string, body: Record<string, unknown>) => {
        const res = await fetchWithAuth(`/api/contracts/${docId}/assign`, {
            method: 'PATCH',
            body: JSON.stringify({ solicitacao_id: id, ...body }),
        });
        const data = await res.json();
        if (!data.success) {
            toast.error(data.error || 'Erro ao atualizar campo');
            return false;
        }
        return true;
    };

    const handleSelectField = (id: string, e: React.PointerEvent) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
            setSelectedFieldIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
        } else if (!selectedFieldIds.includes(id)) {
            setSelectedFieldIds([id]);
        }
    };

    const handleFieldDragEnd = async (id: string, newX: number, newY: number) => {
        if (!originalPageSize) return;
        const current = solicitacoesRef.current;
        const field = current.find((s: any) => s.id === id);
        if (!field || field.status !== 'PENDING') return;
        const oldPx = field.posicao_x / pointsPerPx;
        const oldPy = field.posicao_y / pointsPerPx;
        const dx = newX - oldPx;
        const dy = newY - oldPy;
        const ids = selectedFieldIds.includes(id) ? selectedFieldIds : [id];
        const snapshots = current.filter((s: any) => ids.includes(s.id) && s.status === 'PENDING');
        const updates = snapshots.map((f: any) => {
            const px = f.id === id ? newX : (f.posicao_x / pointsPerPx) + dx;
            const py = f.id === id ? newY : (f.posicao_y / pointsPerPx) + dy;
            return {
                id: f.id,
                posicao_x: Math.round(Math.max(0, px) * pointsPerPx),
                posicao_y: Math.round(Math.max(0, py) * pointsPerPx),
            };
        });
        applySolicitacoes(prev => patchFields(prev, updates));
        fieldWrites.current += 1;
        try {
            const ok = await Promise.all(updates.map((u: any) => patchField(u.id, {
                posicao_x: u.posicao_x,
                posicao_y: u.posicao_y,
            })));
            const failed = updates.filter((_: any, index: number) => !ok[index]);
            if (failed.length > 0) {
                const failedSnaps = snapshots.filter((s: any) => failed.some((f: any) => f.id === s.id));
                applySolicitacoes(prev => revertIfUnchanged(prev, failed, failedSnaps));
            }
        } finally {
            fieldWrites.current -= 1;
        }
    };

    const handleFieldResizeEnd = async (id: string, box: { x: number; y: number; width: number; height: number }) => {
        if (!originalPageSize) return;
        const snap = solicitacoesRef.current.find((s: any) => s.id === id);
        if (!snap || snap.status !== 'PENDING') return;
        const update = {
            id,
            posicao_x: Math.round(box.x * pointsPerPx),
            posicao_y: Math.round(box.y * pointsPerPx),
            largura_assinatura: Math.round(box.width * pointsPerPx),
            altura_assinatura: Math.round(box.height * pointsPerPx),
        };
        applySolicitacoes(prev => patchFields(prev, [update]));
        fieldWrites.current += 1;
        try {
            const ok = await patchField(id, {
                posicao_x: update.posicao_x,
                posicao_y: update.posicao_y,
                largura_assinatura: update.largura_assinatura,
                altura_assinatura: update.altura_assinatura,
            });
            if (!ok) applySolicitacoes(prev => revertIfUnchanged(prev, [update], [snap]));
        } finally {
            fieldWrites.current -= 1;
        }
    };

    const handleCopySelected = async () => {
        const fields = solicitacoesRef.current.filter((s: any) => selectedFieldIds.includes(s.id) && s.status === 'PENDING' && s.tipo !== 'copia');
        if (fields.length === 0) return;
        const copies = fields.map((s: any, index: number) => ({
            ...s,
            id: `temp-${Date.now()}-${index}`,
            posicao_x: (s.posicao_x || 0) + 16,
            posicao_y: (s.posicao_y || 0) + 16,
            status: 'PENDING',
        }));
        applySolicitacoes(prev => insertFields(prev, copies));
        setSelectedFieldIds(copies.map((c: any) => c.id));
        fieldWrites.current += 1;
        try {
            const created = await Promise.all(copies.map(async (s: any) => {
                const res = await fetchWithAuth(`/api/contracts/${docId}/assign`, {
                    method: 'POST',
                    body: JSON.stringify({
                        documento_id: s.documento_id,
                        colaborador_id: s.colaborador_id || null,
                        external_signer_name: s.external_signer_name || null,
                        external_signer_email: s.external_signer_email || null,
                        pagina_assinatura: s.pagina_assinatura,
                        posicao_x: s.posicao_x,
                        posicao_y: s.posicao_y,
                        largura_assinatura: s.largura_assinatura,
                        altura_assinatura: s.altura_assinatura,
                        tipo: s.tipo,
                        ordem: s.ordem || 1,
                        obrigatorio: s.obrigatorio !== false,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                return { tempId: s.id, data };
            }));
            const failedIds: string[] = [];
            for (const row of created) {
                if (row.data?.success && row.data.solicitacao?.id) {
                    const serverId = row.data.solicitacao.id as string;
                    applySolicitacoes(prev => patchFields(swapFieldId(prev, row.tempId, serverId), [{
                        id: serverId,
                        ...(row.data.solicitacao.token_acesso ? { token_acesso: row.data.solicitacao.token_acesso } : {}),
                    }]));
                    setSelectedFieldIds(prev => prev.map(id => id === row.tempId ? serverId : id));
                } else {
                    failedIds.push(row.tempId);
                }
            }
            if (failedIds.length > 0) {
                applySolicitacoes(prev => removeFields(prev, failedIds));
                setSelectedFieldIds(prev => prev.filter(id => !failedIds.includes(id)));
                toast.error(t('contratos.detail.error_assigning', 'Erro ao atribuir'));
            } else {
                toast.success('Campo copiado');
            }
        } catch {
            applySolicitacoes(prev => removeFields(prev, copies.map((c: any) => c.id)));
            toast.error(t('contratos.detail.error_assigning_save', 'Erro ao salvar atribuição'));
        } finally {
            fieldWrites.current -= 1;
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedFieldIds.length === 0) return;
        if (!confirm(`Remover ${selectedFieldIds.length} campo(s)?`)) return;
        const ok = await deleteSolicitacoesLive(selectedFieldIds);
        if (ok) toast.success('Campos removidos');
    };

    const handleToggleRequired = async (value: boolean) => {
        const ids = selectedFieldIds.length ? selectedFieldIds : [];
        if (ids.length === 0) {
            setFieldRequired(value);
            return;
        }
        const snapshots = solicitacoesRef.current.filter((s: any) => ids.includes(s.id));
        const updates = ids.map((id) => ({ id, obrigatorio: value }));
        applySolicitacoes(prev => patchFields(prev, updates));
        setFieldRequired(value);
        fieldWrites.current += 1;
        try {
            const ok = await Promise.all(ids.map((id) => patchField(id, { obrigatorio: value })));
            const failed = updates.filter((_, index) => !ok[index]);
            if (failed.length > 0) {
                const failedSnaps = snapshots.filter((s: any) => failed.some((f) => f.id === s.id));
                applySolicitacoes(prev => revertIfUnchanged(prev, failed, failedSnaps));
            }
        } finally {
            fieldWrites.current -= 1;
        }
    };

    // Dispatch envelope sequence (HR)
    const handleSendEnvelope = async () => {
        try {
            setLoading(true);
            const res = await fetchWithAuth(`/api/contracts/${docId}/dispatch`, {
                method: 'POST',
            });
            const data = await res.json();

            if (data.success) {
                toast.success(t('contratos.detail.success_dispatched', 'Fluxo de assinaturas iniciado! Os signatários da vez foram notificados.'));
                setShowSendModal(false);
                fetchDocumento(true); 
            } else {
                toast.error(data.error || t('contratos.detail.error_dispatch', 'Erro ao disparar envelope'));
            }
        } catch (err) {
            toast.error(t('contratos.detail.error_dispatch_net', 'Erro de rede ao enviar envelope'));
        } finally {
            setLoading(false);
        }
    };

    // Delete complete envelope (HR)
    const handleDeleteEnvelope = async () => {
        if (!window.confirm(t('contratos.detail.confirm_delete_envelope', 'ATENÇÃO: Esta ação é IRREVERSÍVEL.\n\nVocê tem certeza que deseja EXCLUIR este envelope, todos os seus documentos e assinaturas permanentemente da plataforma e do armazenamento em nuvem?'))) {
            return;
        }
        
        try {
            setLoading(true);
            const res = await fetchWithAuth(`/api/contracts?id=${docId}`, {
                method: 'DELETE',
            });
            const data = await res.json();

            if (data.success) {
                toast.success(t('contratos.detail.success_envelope_deleted', 'Envelope excluído com sucesso!'));
                router.push('/contratos');
            } else {
                toast.error(data.error || t('contratos.detail.error_envelope_delete', 'Falha ao excluir envelope'));
                setLoading(false);
            }
        } catch (err) {
            toast.error(t('contratos.detail.error_net_delete', 'Erro de rede ao tentar excluir'));
            setLoading(false);
        }
    };

    // Sign document (Collaborator)
    const handleSign = async () => {
        if (!mySolicitacao || !legalAccepted) return;

        setShowLegalConfirm(false);

        try {
            const result = await requestSignature({
                title: t('contratos.detail.sign_action_title', 'Assinar Documento'),
                description: `${t('contratos.detail.sign_action_desc', 'Assine o documento')}: ${currentDocumento?.titulo || ''}`,
            });

            if (!result) return;

            try {
                setIsSigning(true);

                let signatureBase64 = result.signatureUrl;
                if (result.signatureUrl.startsWith('http')) {
                    const sigRes = await fetch(result.signatureUrl);
                    const blob = await sigRes.blob();
                    signatureBase64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                }

                const res = await fetchWithAuth('/api/contracts/sign', {
                    method: 'POST',
                    body: JSON.stringify({
                        solicitacao_id: mySolicitacao.id,
                        signature_base64: signatureBase64,
                        field_values: filledValues,
                    }),
                });

                const data = await res.json();

                if (data.success) {
                    toast.success(t('contratos.detail.success_signed_now', 'Documento assinado com sucesso!'));
                    if (data.arquivo_assinado_url) {
                        setSignedPdfUrl(data.arquivo_assinado_url);
                    }
                    fetchDocumento(true);
                } else {
                    toast.error(data.error || t('contratos.detail.error_signing', 'Erro ao assinar'));
                }
            } catch (err: any) {
                toast.error(err.message || t('contratos.detail.error_signing_action', 'Erro ao assinar documento'));
            } finally {
                setIsSigning(false);
            }
        } catch {
            toast.error(t('contratos.detail.error_init_sign', 'Erro ao iniciar assinatura'));
        }
    };

    // Render PDF URL for current document
    const pdfUrl = currentDocumento?.arquivo_url;

    if (loading && !envelope) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    if (!envelope) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <FiFileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t('contratos.detail.envelope_not_found', 'Envelope não encontrado')}</p>
                    <Link href="/contratos" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                        ← {t('contratos.detail.back_to_list', 'Voltar para lista')}
                    </Link>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Back + Header */}
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <Link
                            href="/contratos"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                        >
                            <FiArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded uppercase tracking-wide font-bold">Envelope</span>
                                {envelope.titulo}
                            </h1>
                            {envelope.descricao && (
                                <p className="text-sm text-gray-500 mt-0.5">{envelope.descricao}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <DocumentStatusBadge
                            status={
                                envelope.total_pendentes > 0 ? 'PENDING' :
                                envelope.total_assinados > 0 ? 'SIGNED' : 'ACTIVE'
                            }
                            size="md"
                        />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fetchDocumento(true)}
                                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                                title="Atualizar"
                            >
                                <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            {can.delete && (
                                <button
                                    onClick={handleDeleteEnvelope}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium shadow-sm"
                                    title={t('contratos.detail.title_delete', 'Excluir envelope e limpar arquivos')}
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                    <span>{t('common.delete', 'Excluir')}</span>
                                </button>
                            )}
                            {(envelope?.status === 'SENT' ? can.resend : can.dispatch) && envelope?.status !== 'COMPLETED' && (
                                <button
                                    onClick={() => setShowSendModal(true)}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
                                >
                                    <FiMail className="w-4 h-4" />
                                    {t('contratos.detail.btn_send', 'Enviar Envelope')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Document Tabs Selector */}
                {documentos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200">
                        {documentos.map((doc, index) => {
                            const isActive = index === activeDocIndex;
                            const docSols = solicitacoes.filter(s => s.documento_id === doc.id);
                            const hasSigned = docSols.some(s => s.status === 'SIGNED');
                            
                            return (
                                <button
                                    key={doc.id}
                                    onClick={() => {
                                        setActiveDocIndex(index);
                                        setIsAssigning(false);
                                    }}
                                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                        isActive 
                                            ? 'bg-white border-blue-200 text-blue-700 shadow-sm' 
                                            : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <FiFileText className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <span className="max-w-[180px] truncate">{doc.titulo}</span>
                                    {hasSigned && <FiCheckCircle className="w-3 h-3 text-emerald-500" />}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {docSols.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {isManager && selectedFieldIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs">
                        <span className="font-semibold text-gray-700">{selectedFieldIds.length} selecionado(s)</span>
                        <button type="button" onClick={handleCopySelected} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">
                            <FiCopy className="w-3.5 h-3.5" /> Copiar
                        </button>
                        <button type="button" onClick={() => handleToggleRequired(true)} className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Obrigatório</button>
                        <button type="button" onClick={() => handleToggleRequired(false)} className="px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Opcional</button>
                        <button type="button" onClick={handleDeleteSelected} className="px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Excluir</button>
                        <span className="text-gray-400">Shift ou Ctrl para multi-seleção. Arraste para mover. Cantos para redimensionar.</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* PDF Viewer (2 cols) */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
                        {/* Active Document Status Header */}
                        {currentDocumento && documentos.length > 1 && (
                            <div className="bg-blue-50/50 px-4 py-2 text-xs font-medium text-blue-700 border-b border-blue-100 flex items-center gap-2">
                                <span className="uppercase tracking-wider opacity-70">{t('contratos.detail.viewing_doc', 'Visualizando Documento')} {activeDocIndex + 1} {t('common.of', 'de')} {documentos.length}:</span>
                                <strong>{currentDocumento.titulo}</strong>
                            </div>
                        )}

                        {/* PDF Controls */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">
                                    {t('common.page', 'Página')}: <input
                                        type="number"
                                        min="1"
                                        value={currentPage}
                                        onChange={(e) => setCurrentPage(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center"
                                    />
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                                >
                                    <FiChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="p-1 rounded hover:bg-gray-200"
                                >
                                    <FiChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {isManager && (
                                <button
                                    onClick={() => {
                                        setIsAssigning(!isAssigning);
                                        if (!isAssigning) setClickPos(null);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                        ${isAssigning
                                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                >
                                    {isAssigning ? <FiX className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                                    {isAssigning ? t('common.cancel', 'Cancelar') : t('contratos.detail.btn_position', 'Posicionar Assinatura')}
                                </button>
                            )}
                        </div>

                        {/* Informative Banner when Assigning Mode Active */}
                        {isAssigning && (
                            <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <FiTarget className="w-5 h-5 text-blue-600 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-blue-900">{t('contratos.detail.assign_active', 'Modo de Posicionamento Ativo')}</p>
                                        <p className="text-xs text-blue-700">{t('contratos.detail.assign_tip', 'Selecione o tipo abaixo, navegue até a página e clique no local para posicionar.')}</p>
                                    </div>
                                </div>
                                
                                {/* Field Type Selector */}
                                <div className="flex bg-white border border-blue-200 rounded-lg p-0.5 shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => { setSignatureType('assinatura'); setClickPos(null); }}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${signatureType === 'assinatura' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                                    >
                                        Assinatura
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSignatureType('rubrica'); setClickPos(null); }}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${signatureType === 'rubrica' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                                    >
                                        Rubrica
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSignatureType('texto'); setClickPos(null); }}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${signatureType === 'texto' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                                    >
                                        Texto
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSignatureType('checkbox'); setClickPos(null); }}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${signatureType === 'checkbox' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                                    >
                                        Checkbox
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    {showTutorial === false && (
                                        <button onClick={() => setShowTutorial(true)} className="text-xs font-medium text-blue-600 hover:underline px-2">
                                            {t('common.help', 'Ajuda?')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsAssigning(false)}
                                        className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        {t('contratos.detail.exit_mode', 'Sair do Modo')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Onboarding Tutorial Modal */}
                        {isAssigning && showTutorial && (
                            <div className="fixed inset-0 z-[99] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                                <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center relative">
                                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                                        <div className="bg-white/20 backdrop-blur-md w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-inner border border-white/30">
                                            <FiEdit className="w-8 h-8 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white">{t('contratos.detail.tutorial.title', 'Como posicionar assinaturas?')}</h3>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                                            <p className="text-sm text-gray-600 pt-1">{t('contratos.detail.tutorial.step1', 'Clique no PDF exatamente onde a assinatura deve ficar.')}</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                                            <p className="text-sm text-gray-600 pt-1">{t('contratos.detail.tutorial.step2', 'Selecione a pessoa digitando o nome/email ou opte por um signatário externo.')}</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">3</div>
                                            <p className="text-sm text-gray-600 pt-1">{t('contratos.detail.tutorial.step3', 'Confirme no card flutuante que surgirá no local.')}</p>
                                        </div>
                                        
                                        <button 
                                            onClick={dismissTutorial}
                                            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]"
                                        >
                                            {t('contratos.detail.tutorial.ok', 'Entendi, vamos lá!')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PDF Renderer */}
                        <div
                            ref={pdfContainerRef}
                            className="p-4 flex flex-col items-center overflow-auto bg-gray-100 min-h-[600px]"
                            style={{ position: 'relative' }}
                        >
                            {pdfUrl ? (
                                <div className="w-full space-y-3">
                                    {/* Controls */}
                                    <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage <= 1}
                                                className="p-1.5 rounded bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 transition-colors"
                                            >
                                                <FiChevronLeft className="w-5 h-5" />
                                            </button>
                                            <span className="text-sm font-medium text-gray-700">
                                                {t('common.page', 'Página')} {currentPage} {t('common.of', 'de')} {numPages || '-'}
                                            </span>
                                            <button 
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, numPages || 1))}
                                                disabled={currentPage >= (numPages || 1)}
                                                className="p-1.5 rounded bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 transition-colors"
                                            >
                                                <FiChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <a
                                                href={pdfUrl}
                                                target="_blank"
                                                rel="noopener"
                                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                <FiDownload className="w-4 h-4" />
                                                {t('contratos.detail.open_tab', 'Abrir em nova aba')}
                                            </a>
                                        </div>
                                    </div>

                                    {/* PDF Native Renderer */}
                                    <div className="flex justify-center bg-gray-200/50 p-6 rounded-lg overflow-hidden border border-gray-300">
                                        <Document
                                            key={currentDocumento?.id || 'pdf'}
                                            file={pdfUrl}
                                            onLoadSuccess={onDocumentLoadSuccess}
                                            onLoadError={onDocumentLoadError}
                                            loading={<div className="p-10 text-gray-500 flex flex-col items-center gap-3">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                                <p>{t('contratos.detail.loading_doc', 'Carregando Documento...')}</p>
                                            </div>}
                                            options={PDF_OPTIONS}
                                        >
                                            <div 
                                                className="relative inline-block shadow-lg bg-white" 
                                                onClick={handlePdfClick}
                                                style={{ cursor: isAssigning ? 'crosshair' : 'default' }}
                                            >
                                                <Page
                                                    pageNumber={currentPage}
                                                    width={pdfWidth}
                                                    renderTextLayer={true}
                                                    renderAnnotationLayer={true}
                                                    onLoadSuccess={onPageLoadSuccess}
                                                />
                                                {/* Signature overlays specific to CURRENT DOCUMENT and current page */}
                                                {currentSolicitacoes.filter((s: any) => s.pagina_assinatura === currentPage).map((s: any) => {
                                                    let displayX = s.posicao_x;
                                                    let displayY = s.posicao_y;
                                                    let displayW = s.largura_assinatura || (s.tipo === 'rubrica' ? 100 : (s.tipo === 'checkbox' ? 16 : 150));
                                                    let displayH = s.altura_assinatura || (s.tipo === 'rubrica' ? 30 : (s.tipo === 'checkbox' ? 16 : (s.tipo === 'texto' ? 22 : 50)));

                                                    if (originalPageSize) {
                                                        const baseScale = pdfWidth / originalPageSize.width;
                                                        displayX = displayX * baseScale;
                                                        displayY = displayY * baseScale;
                                                        displayW = displayW * baseScale;
                                                        displayH = displayH * baseScale;
                                                    }

                                                    const signerId = s.colaborador_id || s.external_signer_email || s.id;
                                                    const isMyField = s.colaborador_id === user?.id;

                                                    if (s.status === 'PENDING' && s.tipo === 'texto' && isMyField && !isManager) {
                                                        return (
                                                            <div
                                                                key={`input-overlay-${s.id}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${displayX}px`,
                                                                    top: `${displayY}px`,
                                                                    width: `${displayW}px`,
                                                                    height: `${displayH}px`,
                                                                    zIndex: 40,
                                                                    pointerEvents: isMyField ? 'auto' : 'none',
                                                                }}
                                                            >
                                                                <input
                                                                    type="text"
                                                                    value={filledValues[s.id] ?? ''}
                                                                    onChange={(e) => setFilledValues(prev => ({ ...prev, [s.id]: e.target.value }))}
                                                                    disabled={!isMyField}
                                                                    placeholder={isMyField ? t('contratos.detail.fill_here', 'Preencha aqui...') : t('contratos.detail.pending_field', 'Pendente')}
                                                                    className={`w-full h-full text-xs px-1 border-2 border-dashed rounded outline-none shadow-sm transition-colors ${
                                                                        isMyField
                                                                            ? 'border-blue-500 bg-blue-50/80 focus:border-blue-600 focus:bg-white text-gray-900'
                                                                            : 'border-gray-300 bg-gray-50/50 text-gray-500 cursor-not-allowed'
                                                                    }`}
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    if (s.status === 'PENDING' && s.tipo === 'checkbox' && isMyField && !isManager) {
                                                        return (
                                                            <div
                                                                key={`checkbox-overlay-${s.id}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${displayX}px`,
                                                                    top: `${displayY}px`,
                                                                    width: `${displayW}px`,
                                                                    height: `${displayH}px`,
                                                                    zIndex: 40,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    pointerEvents: isMyField ? 'auto' : 'none',
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filledValues[s.id] === 'true'}
                                                                    onChange={(e) => setFilledValues(prev => ({ ...prev, [s.id]: e.target.checked ? 'true' : 'false' }))}
                                                                    disabled={!isMyField}
                                                                    className={`w-4 h-4 rounded focus:ring-blue-500 border-2 transition-colors ${
                                                                        isMyField
                                                                            ? 'text-blue-600 border-blue-500 bg-blue-50 cursor-pointer'
                                                                            : 'text-gray-400 border-gray-300 bg-gray-100 cursor-not-allowed'
                                                                    }`}
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    if (s.status === 'SIGNED' && s.tipo === 'texto') {
                                                        return (
                                                            <div
                                                                key={`text-val-overlay-${s.id}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${displayX}px`,
                                                                    top: `${displayY}px`,
                                                                    width: `${displayW}px`,
                                                                    height: `${displayH}px`,
                                                                    zIndex: 30,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                }}
                                                                className="text-xs text-gray-800 font-medium px-1 bg-gray-100/50 border border-gray-300 rounded overflow-hidden select-none"
                                                            >
                                                                {s.valor_preenchido || ''}
                                                            </div>
                                                        );
                                                    }

                                                    if (s.status === 'SIGNED' && s.tipo === 'checkbox') {
                                                        return (
                                                            <div
                                                                key={`checkbox-val-overlay-${s.id}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${displayX}px`,
                                                                    top: `${displayY}px`,
                                                                    width: `${displayW}px`,
                                                                    height: `${displayH}px`,
                                                                    zIndex: 30,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    disabled
                                                                    checked={s.valor_preenchido === 'true'}
                                                                    className="w-4 h-4 text-gray-600 border-gray-300 bg-gray-100 rounded cursor-not-allowed"
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    const displayName = s.colaborador?.first_name 
                                                        ? `${s.colaborador.first_name}` 
                                                        : (s.external_signer_name || s.external_signer_email || 'Convidado');

                                                    const canEditField = isManager && s.status === 'PENDING';
                                                    return (
                                                        <SignaturePositionOverlay
                                                            key={s.id}
                                                            x={displayX}
                                                            y={displayY}
                                                            width={displayW}
                                                            height={displayH}
                                                            label={`${displayName}`}
                                                            status={s.status as 'PENDING' | 'SIGNED' | 'REJECTED'}
                                                            tipo={s.tipo}
                                                            interactive={canEditField}
                                                            draggable={canEditField}
                                                            resizable={canEditField}
                                                            selected={selectedFieldIds.includes(s.id)}
                                                            required={s.obrigatorio !== false}
                                                            onSelect={(e) => handleSelectField(s.id, e)}
                                                            onDragEnd={(newX, newY) => handleFieldDragEnd(s.id, newX, newY)}
                                                            onResizeEnd={(box) => handleFieldResizeEnd(s.id, box)}
                                                            colorClasses={getSignerColor(signerId)}
                                                        />
                                                    );
                                                })}
                                                {/* Click position indicator AND Configuration Floating Card */}
                                                {clickPos && clickPos.page === currentPage && signatureType !== 'copia' && (
                                                    <>
                                                        <SignaturePositionOverlay
                                                            x={clickPos.x}
                                                            y={clickPos.y}
                                                            width={clickPos.w || (signatureType === 'rubrica' ? 90 : (signatureType === 'checkbox' ? 18 : (signatureType === 'texto' ? 120 : 150)))}
                                                            height={clickPos.h || (signatureType === 'rubrica' ? 24 : (signatureType === 'checkbox' ? 18 : (signatureType === 'texto' ? 24 : 28)))}
                                                            label={selectedColaborador 
                                                                ? (colaboradores.find(c => (c.id||c._id) === selectedColaborador)?.first_name || t('common.selected', 'Selecionado')) 
                                                                : (manualSignerName || t('contratos.detail.new_position', 'Posição Nova'))}
                                                            status="PENDING"
                                                            interactive={true}
                                                            draggable={true}
                                                            resizable={true}
                                                            required={fieldRequired}
                                                            onDragEnd={(newX, newY) => setClickPos(prev => prev ? { ...prev, x: newX, y: newY } : null)}
                                                            onResizeEnd={(box) => setClickPos(prev => prev ? { ...prev, x: box.x, y: box.y, w: box.width, h: box.height } : null)}
                                                            colorClasses={getSignerColor(selectedColaborador || manualSignerEmail || 'temp')}
                                                        />

                                                        <DraggableFloatingPanel
                                                            title={t('contratos.detail.signer', 'Signatário')}
                                                            onClose={() => resetAssignState()}
                                                            width={340}
                                                            zIndex={80}
                                                        >
                                                            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-between gap-2 py-1 px-2.5 bg-blue-50/50 rounded-lg border border-blue-100/50 mb-1">
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-blue-600 block">{t('contratos.detail.flow', 'Fluxo de Assinatura')}</label>
                                                                        <span className="text-[11px] text-gray-600">{t('contratos.detail.flow_desc', 'Posição para assinatura digital')}</span>
                                                                    </div>
                                                                    <div className="w-16">
                                                                        <label className="text-[9px] font-bold text-gray-500 block mb-0.5 text-right">{t('contratos.detail.order', 'Ordem')}</label>
                                                                        <input 
                                                                            type="number"
                                                                            min="1"
                                                                            value={signatureOrder}
                                                                            onChange={(e) => setSignatureOrder(parseInt(e.target.value) || 1)}
                                                                            className="w-full px-2 py-1 border border-gray-200 rounded-md text-xs bg-white text-center focus:ring-1 focus:ring-blue-500 outline-none font-semibold"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="relative pt-1">
                                                                    <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('contratos.detail.link_whom', 'Vincular a quem?')}</label>
                                                                    
                                                                    {!isExternalInput && !selectedColaborador && (
                                                                        <div className="relative">
                                                                            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                                                            <input 
                                                                                type="text"
                                                                                placeholder={t('contratos.detail.search_placeholder_signer', 'Buscar nome ou email...')}
                                                                                value={searchQuery}
                                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                                                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm placeholder:text-gray-300"
                                                                            />
                                                                            
                                                                            {searchQuery.length > 1 && (
                                                                                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 shadow-xl rounded-lg max-h-48 overflow-y-auto z-[70] divide-y divide-gray-50">
                                                                                    {colaboradores
                                                                                        .filter(c => 
                                                                                            `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                                                            c.email?.toLowerCase().includes(searchQuery.toLowerCase())
                                                                                        )
                                                                                        .slice(0, 5)
                                                                                        .map(c => (
                                                                                            <div 
                                                                                                key={c.id||c._id}
                                                                                                className="p-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2 transition-colors"
                                                                                                onClick={() => {
                                                                                                    setSelectedColaborador(c.id || c._id);
                                                                                                    setSearchQuery('');
                                                                                                }}
                                                                                            >
                                                                                                {c.avatar_url ? (
                                                                                                    <img src={c.avatar_url} className="w-6 h-6 rounded-full object-cover border border-gray-200" />
                                                                                                ) : (
                                                                                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                                                                        {c.first_name?.[0]}{(c.last_name || c.first_name?.[1])?.[0]}
                                                                                                    </div>
                                                                                                )}
                                                                                                <div className="min-w-0 flex-1">
                                                                                                    <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{c.first_name} {c.last_name}</p>
                                                                                                    <p className="text-[10px] text-gray-500 truncate">{c.email}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))
                                                                                    }
                                                                                    <div 
                                                                                        className="p-2.5 bg-gray-50 hover:bg-indigo-50 cursor-pointer text-[11px] font-bold text-indigo-600 text-center border-t border-dashed border-gray-200 transition-colors flex items-center justify-center gap-1"
                                                                                        onClick={() => {
                                                                                            setIsExternalInput(true);
                                                                                            setManualSignerEmail(searchQuery.includes('@') ? searchQuery : '');
                                                                                        }}
                                                                                    >
                                                                                        <FiPlusCircle className="w-3 h-3" /> {t('contratos.detail.add_external', 'Inserir Signatário Externo')}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {selectedColaborador && (
                                                                        <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                                                                                {colaboradores.find(c => (c.id||c._id) === selectedColaborador)?.first_name?.[0] || 'U'}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-xs font-bold text-gray-900 truncate">
                                                                                    {colaboradores.find(c => (c.id||c._id) === selectedColaborador)?.first_name} {colaboradores.find(c => (c.id||c._id) === selectedColaborador)?.last_name}
                                                                                </p>
                                                                                <p className="text-[10px] text-blue-600 font-medium">{t('contratos.detail.internal_base', 'Base Interna ABZ')}</p>
                                                                            </div>
                                                                            <button onClick={() => setSelectedColaborador('')} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-white transition-colors">
                                                                                <FiX className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {isExternalInput && !selectedColaborador && (
                                                                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                                                            <input 
                                                                                type="email"
                                                                                placeholder={t('contratos.detail.signer_email_placeholder', 'E-mail do signatário')}
                                                                                value={manualSignerEmail}
                                                                                onChange={(e) => setManualSignerEmail(e.target.value)}
                                                                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                            />
                                                                            <input 
                                                                                type="text"
                                                                                placeholder={t('contratos.detail.signer_name_placeholder', 'Nome Completo')}
                                                                                value={manualSignerName}
                                                                                onChange={(e) => setManualSignerName(e.target.value)}
                                                                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                            />
                                                                            {/* Optional identity fields for validation during mobile signing */}
                                                                            <div className="pt-1 border-t border-dashed border-gray-200">
                                                                                <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5">
                                                                                    {t('contratos.detail.identity_optional', 'Dados de identidade (opcional — reforça validação)')}
                                                                                </p>
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="CPF (000.000.000-00)"
                                                                                    value={manualSignerTaxId}
                                                                                    onChange={(e) => setManualSignerTaxId(formatCpf(e.target.value))}
                                                                                    maxLength={14}
                                                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none mb-2"
                                                                                />
                                                                                <input
                                                                                    type="date"
                                                                                    placeholder={t('contratos.detail.birth_date', 'Data de Nascimento')}
                                                                                    value={manualSignerBirthDate}
                                                                                    onChange={(e) => setManualSignerBirthDate(e.target.value)}
                                                                                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                                />
                                                                            </div>
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => { setIsExternalInput(false); setManualSignerName(''); setManualSignerEmail(''); setManualSignerTaxId(''); setManualSignerBirthDate(''); }}
                                                                                className="text-[10px] text-gray-500 font-medium flex items-center gap-1 hover:text-gray-800"
                                                                            >
                                                                                <FiArrowLeft className="w-2.5 h-2.5" /> {t('contratos.detail.back_to_search', 'Voltar para busca')}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <label className="flex items-center gap-2 py-1 px-1 text-[10px] text-gray-600 font-medium">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={fieldRequired}
                                                                        onChange={(e) => setFieldRequired(e.target.checked)}
                                                                        className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5"
                                                                    />
                                                                    Campo obrigatório
                                                                </label>

                                                                {/* Checkbox for reusing signer info */}
                                                                <div className="flex items-center gap-2 py-1 px-1">
                                                                    <input 
                                                                        type="checkbox"
                                                                        id="reuse-signer-chk"
                                                                        checked={reuseSignerInfo}
                                                                        onChange={(e) => setReuseSignerInfo(e.target.checked)}
                                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                                    />
                                                                    <label htmlFor="reuse-signer-chk" className="text-[10px] text-gray-500 font-medium cursor-pointer select-none">
                                                                        Lembrar este assinante para próximos campos
                                                                    </label>
                                                                </div>

                                                                <div className="pt-1">
                                                                    <button 
                                                                        onClick={handleSaveAssignment}
                                                                        disabled={!selectedColaborador && (!manualSignerEmail || !manualSignerName)}
                                                                        className="w-full px-3 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 disabled:opacity-40 disabled:shadow-none transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                                                                    >
                                                                        <FiCheckCircle className="w-3.5 h-3.5" /> {t('contratos.detail.fix_signature', 'Fixar Assinatura')}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </DraggableFloatingPanel>
                                                    </>
                                                )}
                                            </div>
                                        </Document>
                                    </div>

                                    {/* Posições já definidas - lista lateral */}
                                    {currentSolicitacoes.length > 0 && (
                                        <div className="bg-white rounded-lg p-3 text-sm">
                                            <p className="font-medium text-gray-700 mb-2">📍 {t('contratos.detail.defined_positions', 'Posições definidas para este documento')}:</p>
                                            <div className="space-y-1">
                                                {currentSolicitacoes.map((s: any) => (
                                                    <div key={s.id} className="flex justify-between text-xs">
                                                        <span className="text-gray-600">
                                                            {s.colaborador?.first_name 
                                                                ? `${s.colaborador.first_name}` 
                                                                : (s.external_signer_name || s.external_signer_email || t('common.guest', 'Convidado'))}
                                                            {s.tipo === 'rubrica' ? ` (${t('contratos.detail.rubric', 'Rubrica')})` : ` (${t('contratos.detail.signature_label', 'Assinatura')})`}
                                                        </span>
                                                        <span className="text-gray-400">
                                                            {t('common.page_short', 'Pág')} {s.pagina_assinatura} | X:{s.posicao_x} Y:{s.posicao_y}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-20 text-gray-500">
                                    <FiFileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm">{t('contratos.detail.no_doc_selected', 'Nenhum documento selecionado')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar (1 col) */}
                    <div className="space-y-4">
                        {/* Document Info */}
                        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <FiFileText className="w-4 h-4 text-gray-400" />
                                {t('contratos.detail.envelope_info', 'Informações do Envelope')}
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">{t('contratos.detail.created_by', 'Criado por')}</span>
                                    <span className="text-gray-800 font-medium">
                                        {envelope.enviado_por_nome || 'RH'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">{t('common.date', 'Data')}</span>
                                    <span className="text-gray-800">
                                        {new Date(envelope.data_criacao).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">{t('contratos.total_docs', 'Documentos')}</span>
                                    <span className="text-gray-800 font-medium">
                                        {documentos.length}
                                    </span>
                                </div>
                            </div>

                            {/* Download options */}
                            {currentDocumento && (
                                <div className="pt-3 border-t border-gray-100 space-y-2">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">{t('contratos.detail.current_file', 'Arquivo Atual')}</p>
                                    <a
                                        href={currentDocumento.arquivo_url}
                                        target="_blank"
                                        rel="noopener"
                                        className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors"
                                    >
                                        <FiDownload className="w-4 h-4" />
                                        {t('contratos.detail.download_current', 'Baixar Doc Atual')}
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Assignments for ALL DOCUMENTS grouped by UNIQUE SIGNER */}
                        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <FiUsers className="w-4 h-4 text-gray-400" />
                                {t('contratos.detail.general_signatures', 'Assinaturas Gerais')} ({(() => {
                                    const activeSols = solicitacoes.filter(s => s.tipo !== 'copia');
                                    const uniqueKeys = new Set(activeSols.map(s => s.colaborador_id 
                                        ? `colab-${s.colaborador_id}` 
                                        : `ext-${(s.external_signer_email || s.external_signer_name || 'unknown').toLowerCase()}`));
                                    return uniqueKeys.size;
                                })()})
                            </h3>

                            {(() => {
                                const activeSols = solicitacoes.filter(s => s.tipo !== 'copia');
                                if (activeSols.length === 0) {
                                    return <p className="text-xs text-gray-400 py-2">{t('contratos.detail.no_signatures_assigned', 'Nenhuma assinatura atribuída no envelope')}</p>;
                                }

                                // Compute grouped signers
                                const groupedSignersMap = new Map<string, {
                                    key: string;
                                    colaborador_id?: string;
                                    colaborador?: any;
                                    name: string;
                                    email: string;
                                    status: 'PENDING' | 'SIGNED' | 'REJECTED';
                                    viewed_at?: string;
                                    items: any[];
                                }>();

                                activeSols.forEach((s: any) => {
                                    const key = s.colaborador_id 
                                        ? `colab-${s.colaborador_id}` 
                                        : `ext-${(s.external_signer_email || s.external_signer_name || 'unknown').toLowerCase()}`;
                                    
                                    const existing = groupedSignersMap.get(key);
                                    if (existing) {
                                        existing.items.push(s);
                                        if (s.status === 'REJECTED') {
                                            existing.status = 'REJECTED';
                                        } else if (existing.status !== 'REJECTED' && s.status === 'PENDING') {
                                            existing.status = 'PENDING';
                                        }
                                        if (s.visualizado_em && (!existing.viewed_at || new Date(s.visualizado_em) > new Date(existing.viewed_at))) {
                                            existing.viewed_at = s.visualizado_em;
                                        }
                                    } else {
                                        const name = s.colaborador?.first_name 
                                            ? `${s.colaborador.first_name} ${s.colaborador.last_name || ''}`
                                            : (s.external_signer_name || s.external_signer_email || 'Externo');
                                        const email = s.colaborador?.email || s.external_signer_email || '';
                                        
                                        groupedSignersMap.set(key, {
                                            key,
                                            colaborador_id: s.colaborador_id,
                                            colaborador: s.colaborador,
                                            name,
                                            email,
                                            status: s.status,
                                            viewed_at: s.visualizado_em || undefined,
                                            items: [s]
                                        });
                                    }
                                });

                                const groupedList = Array.from(groupedSignersMap.values());

                                return (
                                    <div className="space-y-3">
                                        {groupedList.map((signer) => {
                                            const isExpanded = !!expandedSigners[signer.key];
                                            const totalFields = signer.items.length;
                                            const signedFields = signer.items.filter(item => item.status === 'SIGNED').length;
                                            const hasActiveDocField = signer.items.some(item => item.documento_id === currentDocumento?.id);

                                            return (
                                                <div
                                                    key={signer.key}
                                                    className={`flex flex-col rounded-xl border transition-all duration-200 ${
                                                        hasActiveDocField 
                                                            ? 'border-blue-200 bg-blue-50/10 shadow-xs' 
                                                            : 'border-gray-100 bg-gray-50/40 hover:bg-gray-50/80'
                                                    }`}
                                                >
                                                    {/* Signer Header Info */}
                                                    <div 
                                                        onClick={() => setExpandedSigners(prev => ({ ...prev, [signer.key]: !isExpanded }))}
                                                        className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                {isExpanded ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-gray-800 truncate">
                                                                    {signer.name}
                                                                </p>
                                                                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                                                    {signer.email || t('contratos.detail.no_email', 'Sem e-mail')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 shrink-0">
                                                            <span className="text-[10.5px] font-medium text-gray-500 bg-white border border-gray-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                                                                {signedFields}/{totalFields}
                                                            </span>
                                                            <DocumentStatusBadge status={signer.status} />
                                                        </div>
                                                    </div>

                                                    {/* Expanded Fields List */}
                                                    {isExpanded && (
                                                        <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100 bg-white/70 rounded-b-xl space-y-2">
                                                            {signer.viewed_at && signer.status === 'PENDING' && (
                                                                <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 bg-indigo-50/60 px-2.5 py-1 rounded-lg font-medium border border-indigo-100/30 w-full shadow-2xs">
                                                                    <FiEye className="w-3 h-3 text-indigo-500" /> 
                                                                    {t('contratos.detail.viewed_at', 'Visualizado às {time} ({date})').replace('{time}', new Date(signer.viewed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })).replace('{date}', new Date(signer.viewed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}
                                                                </div>
                                                            )}

                                                            <div className="space-y-1.5">
                                                                {signer.items.map((item: any) => {
                                                                    const docAssigned = documentos.find(d => d.id === item.documento_id);
                                                                    return (
                                                                        <div 
                                                                            key={item.id} 
                                                                            className="flex items-center justify-between text-xs py-1.5 px-2 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100/40"
                                                                        >
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                                    item.status === 'SIGNED' ? 'bg-emerald-500' : item.status === 'REJECTED' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
                                                                                }`} />
                                                                                <span className="text-gray-500 capitalize shrink-0 font-medium">
                                                                                    [{item.tipo || 'campo'}]:
                                                                                </span>
                                                                                <span className="text-gray-700 truncate max-w-[120px]" title={docAssigned?.titulo}>
                                                                                    {docAssigned?.titulo || 'Documento'}
                                                                                </span>
                                                                            </div>

                                                                            {isManager && (
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    {item.status === 'PENDING' && item.token_acesso && (
                                                                                        <button
                                                                                            onClick={() => handleCopyTokenLink(item.token_acesso)}
                                                                                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                                                            title={t('contratos.detail.title_copy_unique', 'Copiar Link Único de Assinatura')}
                                                                                        >
                                                                                            <FiLink className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => handleDeleteAssignment(item.id)}
                                                                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                                                        title={t('contratos.detail.title_remove_assign', 'Remover atribuição')}
                                                                                    >
                                                                                        <FiTrash2 className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {isManager && signer.status === 'PENDING' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteAllSignerAssignments(signer.name, signer.items)}
                                                                    className="w-full mt-2 py-1.5 px-3 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                                                                >
                                                                    <FiTrash2 className="w-3.5 h-3.5" />
                                                                    {t('contratos.detail.remove_all_signer_fields', 'Remover Todas as Atribuições')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* CC / Observers Management Panel */}
                        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <FiMail className="w-4 h-4 text-indigo-500" />
                                    {t('contratos.detail.cc_title', 'Acompanhamento (Cópia)')}
                                </h3>
                                <span className="bg-indigo-50 text-indigo-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                    {ccSolicitacoes.length}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                {t('contratos.detail.cc_desc', 'Pessoas listadas aqui não assinam, mas recebem cópias do documento final e notificações de andamento.')}
                            </p>

                            {/* Active CC list */}
                            {ccSolicitacoes.length > 0 && (
                                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                    {ccSolicitacoes.map((cc: any) => (
                                        <div key={cc.id} className="flex items-center justify-between bg-indigo-50/20 border border-indigo-100/40 rounded-lg p-2.5 text-xs">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-gray-800 truncate">
                                                    {cc.external_signer_name}
                                                </p>
                                                <p className="text-[10px] text-gray-500 truncate">{cc.external_signer_email}</p>
                                            </div>
                                            {isManager && (
                                                <button 
                                                    onClick={() => handleDeleteAssignment(cc.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                    title={t('contratos.detail.title_remove_observer', 'Remover observador')}
                                                >
                                                    <FiTrash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Simple creation form */}
                            {isManager && (
                                <form onSubmit={handleSaveCC} className="pt-2 border-t border-dashed border-gray-100 space-y-2">
                                    <input 
                                        type="text"
                                        required
                                        placeholder={t('contratos.detail.cc_name_placeholder', 'Nome do observador')}
                                        value={ccName}
                                        onChange={(e) => setCcName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white hover:border-gray-300 focus:border-indigo-500 outline-none transition-colors"
                                    />
                                    <div className="flex gap-2">
                                        <input 
                                            type="email"
                                            required
                                            placeholder={t('common.email', 'E-mail')}
                                            value={ccEmail}
                                            onChange={(e) => setCcEmail(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white hover:border-gray-300 focus:border-indigo-500 outline-none transition-colors"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={isAddingCC || !currentDocumento?.id}
                                            className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold shadow-sm disabled:opacity-50 flex items-center justify-center"
                                        >
                                            {isAddingCC ? (
                                                <div className="animate-spin h-3.5 w-3.5 border border-white border-t-transparent rounded-full" />
                                            ) : (
                                                t('common.add', 'Adicionar')
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Audit Info */}
                        {currentDocumento?.hash_original && (
                            <AuditInfoPanel hashOriginal={currentDocumento.hash_original} />
                        )}

                        {/* Sign Button (Collaborator) */}
                        {mySolicitacao && mySolicitacao.status === 'PENDING' && (
                            <button
                                onClick={() => setShowLegalConfirm(true)}
                                disabled={isSigning}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium text-sm shadow-sm"
                            >
                                {isSigning ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                ) : (
                                    <FiEdit3 className="w-4 h-4" />
                                )}
                                {isSigning ? `${t('contratos.detail.signing', 'Assinando')}...` : t('contratos.detail.btn_sign_doc', 'Assinar Documento')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Send Envelope Dispatch Modal */}
                {showSendModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <FiMail className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{t('contratos.detail.dispatch_modal.title', 'Disparar Envelope')}</h3>
                                    <p className="text-xs text-gray-500">{t('contratos.detail.dispatch_modal.subtitle', 'Iniciar fluxo de assinaturas sequencial')}</p>
                                </div>
                                <button
                                    onClick={() => setShowSendModal(false)}
                                    className="ml-auto text-gray-400 hover:text-gray-600"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="px-6 py-6 space-y-5">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-sm text-blue-800 font-medium mb-2">{t('contratos.detail.dispatch_modal.what_happens', 'O que acontecerá ao confirmar?')}</p>
                                    <ul className="space-y-2 text-xs text-blue-700 list-disc ml-4">
                                        <li>{t('contratos.detail.dispatch_modal.step1', 'O sistema identificará a ordem cronológica definida nas atribuições.')}</li>
                                        <li>{t('contratos.detail.dispatch_modal.step2', 'Apenas os signatários de Ordem 1 receberão as notificações iniciais.')}</li>
                                        <li>{t('contratos.detail.dispatch_modal.step3', 'O envelope será marcado como Enviado e o fluxo avança automaticamente à medida que cada parte assina.')}</li>
                                    </ul>
                                </div>

                                {solicitacoes.length === 0 ? (
                                    <div className="p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs flex items-start gap-2">
                                        <FiShield className="flex-shrink-0 w-4 h-4 mt-0.5" />
                                        <span>{t('contratos.detail.dispatch_modal.warning_empty', 'Aviso: Não existem assinaturas configuradas neste envelope ainda. Adicione signatários antes de enviar.')}</span>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-600">
                                        {t('contratos.detail.dispatch_modal.total_configured', 'Total de signatários configurados')}: <strong className="text-gray-900">{solicitacoes.length}</strong>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => setShowSendModal(false)}
                                        className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                    >
                                        {t('common.review', 'Revisar')}
                                    </button>
                                    <button
                                        onClick={handleSendEnvelope}
                                        disabled={solicitacoes.length === 0 || loading}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold shadow-sm"
                                    >
                                        {loading ? `${t('contratos.detail.dispatching', 'Disparando')}...` : t('contratos.detail.dispatch_confirm', 'Confirmar e Disparar')}
                                        {!loading && <FiArrowLeft className="rotate-180 w-4 h-4 ml-1" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Legal Confirmation Modal */}
                {showLegalConfirm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <FiShield className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{t('contratos.detail.legal_modal.title', 'Confirmação Legal')}</h3>
                                    <p className="text-xs text-gray-500">{t('contratos.detail.legal_modal.subtitle', 'Leia atentamente antes de assinar')}</p>
                                </div>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed">
                                    {t('contratos.detail.legal_modal.intro', 'Ao assinar eletronicamente este documento, você declara que:')}
                                    <ul className="list-disc ml-4 mt-2 space-y-1 text-xs text-gray-600">
                                        <li>{t('contratos.detail.legal_modal.term1', 'É o titular autenticado desta conta no Portal ABZ')}</li>
                                        <li>{t('contratos.detail.legal_modal.term2', 'Leu e compreendeu o conteúdo integral do documento')}</li>
                                        <li>{t('contratos.detail.legal_modal.term3', 'Reconhece a validade jurídica desta assinatura conforme MP 2.200-2/2001')}</li>
                                        <li>{t('contratos.detail.legal_modal.term4', 'Está ciente de que IP, data/hora e navegador serão registrados')}</li>
                                    </ul>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={legalAccepted}
                                        onChange={(e) => setLegalAccepted(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                                    />
                                    <span className="text-sm text-gray-700">
                                        {t('contratos.detail.legal_modal.confirm_checkbox', 'Confirmo ser o titular desta conta e assino eletronicamente este documento, reconhecendo sua validade jurídica e integridade.')}
                                    </span>
                                </label>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => {
                                            setShowLegalConfirm(false);
                                            setLegalAccepted(false);
                                        }}
                                        className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        {t('common.cancel', 'Cancelar')}
                                    </button>
                                    <button
                                        onClick={handleSign}
                                        disabled={!legalAccepted || isSigning}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                    >
                                        {isSigning ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                        ) : (
                                            <FiEdit3 className="w-4 h-4" />
                                        )}
                                        {isSigning ? `${t('contratos.detail.signing', 'Assinando')}...` : t('contratos.detail.btn_sign_doc', 'Assinar Documento')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}