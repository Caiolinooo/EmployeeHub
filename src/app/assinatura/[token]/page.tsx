'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { FiArrowLeft, FiArrowRight, FiCheck, FiShield, FiFileText, FiAlertCircle, FiDownload, FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut, FiGlobe } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useSignature } from '@/contexts/SignatureContext';
import SignaturePositionOverlay, { getSignerColor } from '@/components/contratos/SignaturePositionOverlay';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import { normalizeCpf, formatCpf, isValidCpf, namesMatch, birthDatesMatch } from '@/lib/utils/identity';
import { missingRequiredFieldValue, uniqueSignatureDocuments } from '@/lib/contracts/signature-queue';



pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/'
};

export default function AssinaturaExternaPage() {
    const params = useParams();
    const token = params?.token as string;
    const { requestSignature } = useSignature();
    const { user: authUser, profile: authProfile, isAuthenticated, isLoading: isAuthLoading } = useSupabaseAuth();
    const { t, setLocale, locale } = useI18n();

    const [showLangModal, setShowLangModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Trigger Language selection overlay conditionally on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const chosen = sessionStorage.getItem('signature_lang_chosen');
            if (!chosen) {
                setShowLangModal(true);
            }
        }
    }, []);
    const [queue, setQueue] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const hasQueue = React.useRef(false);
    
    // Auth & Legal steps
    const [step, setStep] = useState<'AUTH' | 'REVIEW' | 'SIGNED'>('AUTH');
    const [authData, setAuthData] = useState({ nome: '', cpf: '', email: '', dataNascimento: '' });
    const [fieldErrors, setFieldErrors] = useState<{
        nome?: string; cpf?: string; email?: string; dataNascimento?: string;
    }>({});
    const [legalAccepted, setLegalAccepted] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [filledValues, setFilledValues] = useState<{ [solicitacaoId: string]: string }>({});


    const handleConfirmLang = () => {
        sessionStorage.setItem('signature_lang_chosen', 'true');
        setShowLangModal(false);
    };

    // PDF Viewing State
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfWidth, setPdfWidth] = useState(600);
    const [pdfScale, setPdfScale] = useState(1.0);
    const pdfContainerRef = React.useRef<HTMLDivElement>(null);
    const [originalPageSize, setOriginalPageSize] = useState<{ width: number; height: number } | null>(null);

    // Auto-size PDF container
    useEffect(() => {
        const updateWidth = () => {
            if (pdfContainerRef.current) {
                // Account for padding/borders
                const w = pdfContainerRef.current.clientWidth - 16; 
                setPdfWidth(Math.min(w, 1000));
            }
        };
        updateWidth();
        // Small delay to catch initial rendering size
        const timer = setTimeout(updateWidth, 200);
        window.addEventListener('resize', updateWidth);
        return () => {
            window.removeEventListener('resize', updateWidth);
            clearTimeout(timer);
        };
    }, []);

    const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
        setNumPages(n);
        setCurrentPage(1);
    };

    const onPageLoadSuccess = (page: any) => {
        const viewport = page.getViewport({ scale: 1.0 });
        setOriginalPageSize({ width: viewport.width, height: viewport.height });
    };

    const onDocumentLoadError = (error: Error) => {
        console.error('[AssinaturaExterna] Erro ao carregar PDF:', error);
        toast.error(t('assinatura.externa.erro_visualizar_pdf', { erro: error.message }, `Erro ao processar visualização do documento: ${error.message}`));
    };

    useEffect(() => {
        if (!token) return;

        const fetchTokenData = async (background?: boolean) => {
            const soft = !!background && hasQueue.current;
            if (!soft) setLoading(true);
            try {
                const res = await fetch(`/api/contracts/sign-access/${token}`);
                const data = await res.json();

                if (data.success && data.queue) {
                    // Filter only pending items for user progression
                    // Filter only pending items that require signing/action for user progression
                    const pendingSignableItems = data.queue.filter((q: any) => q.status === 'PENDING' && (q.tipo === 'assinatura' || q.tipo === 'rubrica'));
                    const pendingItems = pendingSignableItems.length > 0
                        ? pendingSignableItems
                        : data.queue.filter((q: any) => q.status === 'PENDING');
                    
                    if (pendingItems.length === 0) {
                        // Already signed everything in this queue
                        setStep('SIGNED');
                    } else {
                        // Populate filledValues with any existing database values
                        const initialValues: Record<string, string> = {};
                        data.queue.forEach((q: any) => {
                            if (q.valor_preenchido !== null && q.valor_preenchido !== undefined) {
                                initialValues[q.id] = q.valor_preenchido;
                            }
                        });
                        setFilledValues(initialValues);

                        hasQueue.current = true;
                        setQueue(data.queue); // Keep full list for visual sequence context
                        const docFiles = Array.isArray(data.documentos) && data.documentos.length > 0
                            ? data.documentos
                            : uniqueSignatureDocuments(data.queue).map((item: any) => ({
                                id: item.documento?.id,
                                titulo: item.documento?.titulo,
                                pdf_url: item.pdf_url,
                            }));
                        setFiles(docFiles);
                        // Set initial active index to first pending signature or fallback
                        const firstPendingIdx = data.queue.findIndex((q: any) => q.status === 'PENDING' && (q.tipo === 'assinatura' || q.tipo === 'rubrica'));
                        const chosenIdx = firstPendingIdx !== -1 
                            ? firstPendingIdx 
                            : data.queue.findIndex((q: any) => q.status === 'PENDING');
                        const finalIdx = chosenIdx !== -1 ? chosenIdx : 0;
                        setActiveIndex(finalIdx);

                        // Pre-fill data from queue item
                        const activeItem = data.queue[chosenIdx];
                        if (activeItem) {
                            const initialAuthData = {
                                nome: activeItem.target_name || '',
                                email: activeItem.target_email || '',
                                cpf: activeItem.target_tax_id ? formatCpf(activeItem.target_tax_id) : '',
                                dataNascimento: activeItem.target_birth_date || ''
                            };
                            setAuthData(initialAuthData);

                            // Auto-fill bypass ONLY if ALL required fields are complete
                            if (initialAuthData.nome && initialAuthData.email && initialAuthData.cpf) {
                                setStep('REVIEW');
                                toast.success(t('assinatura.externa.sucesso_auto_id', 'Identificação automática de colaborador concluída!'), {
                                    icon: '🔐',
                                    id: 'auto-id-completed'
                                });
                            }
                        }

                    }
                } else {
                    toast.error(data.error || t('assinatura.externa.erro_token_invalido', 'Token inválido ou expirado'));
                }
            } catch (err) {
                toast.error(t('assinatura.externa.erro_buscar_fila', 'Erro ao buscar fila de documentos'));
            } finally {
                setLoading(false);
            }
        };

        fetchTokenData();
    }, [token]);

    // Auto-recognize and log in authenticated portal users
    useEffect(() => {
        if (isAuthenticated && !isAuthLoading && (authProfile || authUser) && queue.length > 0 && step === 'AUTH') {
            const profile = authProfile || {};
            const user = authUser || {};
            
            const firstName = (profile as any).first_name || (user as any).first_name || '';
            const lastName = (profile as any).last_name || (user as any).last_name || '';
            const name = `${firstName} ${lastName}`.trim();
            const email = (profile as any).email || (user as any).email || '';
            const taxId = (profile as any).tax_id || (user as any).tax_id || (profile as any).profile_data?.cpf || '';
            
            if (email) {
                // Check if the authenticated email matches the expected recipient email to be safe
                const expectedEmail = queue[activeIndex]?.target_email?.toLowerCase()?.trim();
                const currentEmail = email.toLowerCase().trim();
                
                if (expectedEmail && currentEmail !== expectedEmail) {
                    // We are logged in as a different user than the expected signer
                    // Do NOT auto-fill to avoid signing as the wrong person!
                    console.warn('[AssinaturaExterna] Usuário logado não corresponde ao destinatário esperado do envelope.');
                    return;
                }
                
                setAuthData({
                    nome: name || 'Usuário Autenticado',
                    email: email,
                    cpf: taxId ? formatCpf(taxId) : '',
                    dataNascimento: (authProfile as any)?.birth_date || ''
                });

                setStep('REVIEW');
                toast.success(t('assinatura.externa.sucesso_autenticado', 'Bem-vindo de volta! Carregamos seus dados do portal.'), {
                    icon: '👤',
                    id: 'portal-auth-restore'
                });
            }
        }
    }, [isAuthenticated, isAuthLoading, authProfile, authUser, queue, step, activeIndex]);

    // Track document visualization
    useEffect(() => {
        if (step === 'REVIEW' && token) {
            fetch('/api/contracts/sign', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            }).catch(e => console.warn('[Tracker] Erro ao registrar visualização:', e));
        }
    }, [step, token]);

    const currentItem = queue[activeIndex];
    const documento = currentItem?.documento;
    const pdfUrl = currentItem?.pdf_url;

    const handleAuthSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: { nome?: string; cpf?: string; email?: string; dataNascimento?: string } = {};

        // Layer 1: required field presence
        if (!authData.nome.trim()) errors.nome = t('assinatura.externa.erro_nome_obrigatorio', 'Nome é obrigatório');
        if (!authData.cpf.trim()) errors.cpf = t('assinatura.externa.erro_cpf_obrigatorio', 'CPF é obrigatório');
        if (!authData.email.trim()) errors.email = t('assinatura.externa.erro_email_obrigatorio', 'E-mail é obrigatório');

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            toast.error(t('assinatura.externa.erro_preencher_campos', 'Preencha todos os campos para continuar'));
            return;
        }

        // Layer 2: CPF format validity
        const normalizedCpf = normalizeCpf(authData.cpf);
        if (!isValidCpf(normalizedCpf)) {
            setFieldErrors({ cpf: t('assinatura.externa.erro_cpf_invalido', 'CPF inválido — verifique o formato (000.000.000-00)') });
            return;
        }

        const expectedEmail = currentItem?.target_email?.toLowerCase()?.trim();
        const typedEmail = authData.email.toLowerCase().trim();
        const expectedTaxId = currentItem?.target_tax_id;
        const expectedBirthDate = currentItem?.target_birth_date;
        const expectedName = currentItem?.target_name;

        // Layer 3: email match
        if (expectedEmail && typedEmail !== expectedEmail) {
            setFieldErrors({ email: t('assinatura.externa.erro_email_incorreto', 'E-mail não reconhecido para este documento') });
            toast.error(t('assinatura.externa.erro_email_incorreto', 'E-mail não reconhecido para este documento'), { icon: '🔒', duration: 5000 });
            return;
        }

        // Layer 4: CPF match (only if target has a tax_id registered)
        if (expectedTaxId) {
            const normalizedExpected = normalizeCpf(expectedTaxId);
            if (normalizedCpf !== normalizedExpected) {
                setFieldErrors({ cpf: t('assinatura.externa.erro_cpf_nao_confere', 'CPF não confere com o cadastro deste signatário') });
                toast.error(t('assinatura.externa.erro_cpf_nao_confere', 'CPF não confere com o cadastro deste signatário'), { icon: '🔒', duration: 5000 });
                return;
            }
        }

        // Layer 5: birth date match (only if registered)
        if (expectedBirthDate && authData.dataNascimento) {
            if (!birthDatesMatch(authData.dataNascimento, expectedBirthDate)) {
                setFieldErrors({ dataNascimento: t('assinatura.externa.erro_nascimento_nao_confere', 'Data de nascimento não confere') });
                toast.error(t('assinatura.externa.erro_nascimento_nao_confere', 'Data de nascimento não confere'), { icon: '🔒', duration: 5000 });
                return;
            }
        }

        // Layer 6: fuzzy name match
        if (expectedName && !namesMatch(authData.nome, expectedName)) {
            setFieldErrors({ nome: t('assinatura.externa.erro_nome_nao_confere', 'Nome não corresponde ao destinatário deste documento') });
            toast.error(t('assinatura.externa.erro_nome_nao_confere', 'Nome não corresponde ao destinatário deste documento'), { icon: '🔒', duration: 5000 });
            return;
        }

        setFieldErrors({});
        setStep('REVIEW');
    };


    const handleSign = async () => {
        if (!legalAccepted || !currentItem) {
            toast.error(t('assinatura.externa.erro_termos_legais', 'Você deve aceitar os termos legais.'));
            return;
        }

        try {
            const result = await requestSignature({
                title: t('assinatura.externa.modal_assinar_titulo', 'Assinar Documento'),
                description: t('assinatura.externa.modal_assinar_desc', { titulo: documento?.titulo || 'Contrato' }, `Assine o documento: ${documento?.titulo || 'Contrato'}`),
            });

            if (!result) return;

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

            const authToken = getToken();
            const headers: Record<string, string> = { 
                'Content-Type': 'application/json' 
            };
            
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const res = await fetch('/api/contracts/sign', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    solicitacao_id: currentItem.id,
                    signature_base64: signatureBase64,
                    signer_data: {
                        nome: authData.nome,
                        email: authData.email,
                        cpf: normalizeCpf(authData.cpf),
                        data_nascimento: authData.dataNascimento || null,
                    },
                    sign_method: 'externo_token',
                    field_values: filledValues,
                }),
            });


            const data = await res.json();

            if (data.success) {
                toast.success(t('assinatura.externa.sucesso_assinatura', 'Documento assinado com sucesso!'));
                
                // Locate the next pending document in queue
                // The API completes sibling fields (text, checkbox, etc.) for the current document,
                // so we mark them all as SIGNED.
                const updatedQueue = queue.map((q: any) => {
                    if (q.documento?.id === currentItem.documento?.id && q.status === 'PENDING') {
                        return { ...q, status: 'SIGNED' };
                    }
                    return q;
                });
                setQueue(updatedQueue);
                
                const nextPendingIdx = updatedQueue.findIndex((q) => q.documento?.id !== currentItem.documento?.id && q.status === 'PENDING' && (q.tipo === 'assinatura' || q.tipo === 'rubrica'));
                const fallbackPendingIdx = nextPendingIdx !== -1 
                    ? nextPendingIdx 
                    : updatedQueue.findIndex((q) => q.documento?.id !== currentItem.documento?.id && q.status === 'PENDING' && q.tipo !== 'copia');
                
                if (fallbackPendingIdx !== -1) {
                    setActiveIndex(fallbackPendingIdx);
                    setLegalAccepted(false); // Reset agreement for next document
                    toast.success(t('assinatura.externa.carregando_proximo', 'Carregando próximo documento da fila...'), { icon: '📄' });
                } else {
                    // Fully finished!
                    setStep('SIGNED');
                }
            } else {
                toast.error(data.error || t('assinatura.externa.erro_assinar', 'Erro ao assinar documento'));
            }
        } catch (err) {
            toast.error(t('assinatura.externa.erro_conexao', 'Erro de conexão ao assinar'));
        } finally {
            setIsSigning(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    if (step === 'SIGNED') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-emerald-500">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiCheck className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{t('assinatura.externa.concluida_titulo', 'Assinatura Concluída!')}</h2>
                    <p className="text-gray-600 text-sm mb-6">{t('assinatura.externa.concluida_desc', 'Todas as suas atribuições neste envelope foram completadas com sucesso. Possuem validade jurídica (MP 2.200-2/2001).')}</p>
                    <p className="text-xs text-gray-400">{t('assinatura.externa.concluida_rodape', 'Você já pode fechar esta aba. Uma cópia dos documentos será gerada e enviada ao seu e-mail assim que o fluxo completo for finalizado.')}</p>
                </div>
            </div>
        );
    }

    if (!queue || queue.length === 0 || !currentItem) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiAlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{t('assinatura.externa.link_invalido_titulo', 'Link Inválido')}</h2>
                    <p className="text-gray-600 text-sm">{t('assinatura.externa.link_invalido_desc', 'Este link de assinatura expirou ou o envelope associado já foi processado.')}</p>
                </div>
            </div>
        );
    }

    // Arquivos = PDFs distintos. queue.length conta campos e fazia "02 files" com 1 PDF.
    const signatureFiles = files.length > 0 ? files : uniqueSignatureDocuments(queue).map((item: any) => ({
        id: item.documento?.id,
        titulo: item.documento?.titulo,
        pdf_url: item.pdf_url,
    }));
    const totalDocs = signatureFiles.length;
    const completedFileCount = signatureFiles.filter((file) => {
        const fields = queue.filter((q: any) => q.documento?.id === file.id && q.tipo !== 'copia');
        return fields.length > 0 && fields.every((q: any) => q.status === 'SIGNED');
    }).length;
    const completedCount = completedFileCount;
    const pendingCount = totalDocs - completedCount;
    const activeFileIndex = Math.max(0, signatureFiles.findIndex((file) => file.id === currentItem?.documento?.id));

    // Calculate pending text/checkbox fields for the current document that are still empty
    const currentDocId = currentItem?.documento?.id;
    const pendingTextFields = step === 'REVIEW' ? queue.filter((q: any) =>
        q.documento?.id === currentDocId &&
        q.status === 'PENDING' &&
        (q.tipo === 'texto' || q.tipo === 'checkbox') &&
        missingRequiredFieldValue(q, filledValues)
    ) : [];
    const pendingPages = [...new Set(pendingTextFields.map((q: any) => q.pagina_assinatura))].sort((a, b) => a - b);


    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
                        <FiShield className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-900 leading-tight text-base">{t('assinatura.externa.cabecalho_titulo', 'Portal de Assinatura Segura')}</h1>
                        <p className="text-xs text-gray-500">ABZ Group</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {step === 'REVIEW' && totalDocs > 1 && (
                        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-gray-500 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                            <FiFileText />
                            <span>{t('assinatura.externa.progresso_label', { atual: completedCount + 1, total: totalDocs }, `Progresso: ${completedCount + 1} de ${totalDocs}`)}</span>
                        </div>
                    )}
                    <div className={`text-xs font-semibold px-3 py-1.5 rounded-full ${step === 'AUTH' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                        {step === 'AUTH' ? t('assinatura.externa.passo_identificacao', 'Passo 1: Identificação') : t('assinatura.externa.passo_assinatura', 'Passo 2: Assinatura')}
                    </div>
                </div>
            </header>

            {/* Continuous progress bar */}
            {step === 'REVIEW' && totalDocs > 1 && (
                <div className="h-1 w-full bg-gray-200">
                    <div 
                        className="h-full bg-blue-600 transition-all duration-500 ease-out" 
                        style={{ width: `${((completedCount) / totalDocs) * 100}%` }}
                    />
                </div>
            )}

            <main className="flex-1 flex flex-col md:flex-row md:overflow-hidden max-w-7xl mx-auto w-full p-4 gap-6">
                
                {/* Left Panel - Document Viewer */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[70vh] md:h-auto relative">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-20">
                        <div className="flex items-center gap-2 min-w-0">
                            <FiFileText className="text-blue-600 flex-shrink-0" />
                            <h2 className="font-semibold text-gray-800 text-sm truncate">
                                {documento?.titulo || t('assinatura.externa.visualizando_doc', 'Visualizando Documento')}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {totalDocs > 1 && (
                                <div className="text-xs font-medium bg-white border px-2 py-1 rounded text-gray-500">
                                    Doc {activeFileIndex + 1}/{totalDocs}
                                </div>
                            )}
                            {pdfUrl && (
                                <a 
                                    href={pdfUrl} 
                                    download 
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title={t('assinatura.externa.baixar_doc', 'Baixar Documento')}
                                >
                                    <FiDownload className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>
                    
                    {signatureFiles.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-gray-100 bg-white">
                            {signatureFiles.map((file, index) => (
                                <button
                                    key={file.id || index}
                                    type="button"
                                    onClick={() => {
                                        const idx = queue.findIndex((q: any) => q.documento?.id === file.id && q.tipo !== 'copia');
                                        if (idx >= 0) setActiveIndex(idx);
                                    }}
                                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                        file.id === documento?.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-transparent text-gray-600'
                                    }`}
                                >
                                    {index + 1}. {file.titulo || 'Documento'}
                                </button>
                            ))}
                        </div>
                    )}
                    <div ref={pdfContainerRef} className="flex-1 bg-gray-100 overflow-auto custom-scrollbar relative">
                        {step === 'AUTH' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md bg-gray-100/90 z-[60]">
                                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 mb-4">
                                    <FiShield className="w-8 h-8" />
                                </div>
                                <h3 className="font-semibold text-gray-900 text-lg mb-2">{t('assinatura.externa.acesso_restrito_titulo', 'Acesso Restrito')}</h3>
                                <p className="text-sm text-gray-600 max-w-sm">{t('assinatura.externa.acesso_restrito_desc', 'Complete a sua identificação no painel ao lado para visualizar o conteúdo deste documento e realizar a assinatura.')}</p>
                            </div>
                        ) : null}

                        {pdfUrl ? (
                            <div className="flex flex-col items-center min-h-full py-4">
                                {numPages > 1 && (
                                    <div className="sticky top-2 z-30 flex items-center gap-3 bg-black/80 text-white px-4 py-2 rounded-full shadow-lg backdrop-blur mb-4">
                                        <button 
                                            disabled={currentPage <= 1} 
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            className="p-1 hover:text-blue-400 disabled:opacity-30"
                                        >
                                            <FiChevronLeft className="w-5 h-5" />
                                        </button>
                                        <span className="text-xs font-medium select-none">{t('assinatura.externa.pagina_x_de_y', { atual: currentPage, total: numPages }, `Página ${currentPage} de ${numPages}`)}</span>
                                        <button 
                                            disabled={currentPage >= numPages} 
                                            onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
                                            className="p-1 hover:text-blue-400 disabled:opacity-30"
                                        >
                                            <FiChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}

                                <div className="shadow-2xl bg-white">
                                    <Document
                                        key={documento?.id || pdfUrl || 'pdf'}
                                        file={pdfUrl}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        onLoadError={onDocumentLoadError}
                                        loading={
                                            <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
                                                <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
                                                <p className="text-sm text-gray-500">{t('assinatura.externa.carregando_doc', 'Carregando documento...')}</p>
                                            </div>
                                        }
                                        options={PDF_OPTIONS}
                                    >
                                        <div className="relative inline-block bg-white">
                                            <Page
                                                pageNumber={currentPage}
                                                width={pdfWidth}
                                                scale={pdfScale}
                                                renderTextLayer={true}
                                                renderAnnotationLayer={true}
                                                onLoadSuccess={onPageLoadSuccess}
                                            />
                                            {/* Inject Floating Overlay */}
                                            {step !== 'AUTH' && queue
                                                .filter((q: any) => q.documento?.id === documento?.id && q.pagina_assinatura === currentPage)
                                                .map((q: any) => {
                                                    // Compute display coordinates
                                                    let displayX = q.posicao_x;
                                                    let displayY = q.posicao_y;
                                                    let displayW = q.largura_assinatura || (q.tipo === 'rubrica' ? 100 : (q.tipo === 'checkbox' ? 16 : 150));
                                                    let displayH = q.altura_assinatura || (q.tipo === 'rubrica' ? 30 : (q.tipo === 'checkbox' ? 16 : (q.tipo === 'texto' ? 22 : 50)));
                                                    
                                                    if (originalPageSize) {
                                                        const baseScale = pdfWidth / originalPageSize.width;
                                                        const totalScale = baseScale * pdfScale;
                                                        
                                                        displayX = displayX * totalScale;
                                                        displayY = displayY * totalScale;
                                                        displayW = displayW * totalScale;
                                                        displayH = displayH * totalScale;
                                                    }

                                                    const isCurrent = q.id === currentItem.id;

                                                    if (q.status === 'PENDING' && q.tipo === 'texto') {
                                                        return (
                                                            <div
                                                                key={`ext-input-${q.id}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${displayX}px`,
                                                                    top: `${displayY}px`,
                                                                    width: `${displayW}px`,
                                                                    height: `${displayH}px`,
                                                                    zIndex: 40,
                                                                    pointerEvents: 'auto',
                                                                }}
                                                            >
                                                                <input
                                                                    type="text"
                                                                    value={filledValues[q.id] ?? ''}
                                                                    onChange={(e) => setFilledValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                                    placeholder={t('assinatura.externa.preencha_aqui', 'Preencha aqui...')}
                                                                    className="w-full h-full text-xs px-1 border-2 border-dashed border-blue-500 bg-blue-50/80 rounded focus:border-blue-600 focus:bg-white outline-none text-gray-900 shadow-sm"
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    if (q.status === 'PENDING' && q.tipo === 'checkbox') {
                                                        return (
                                                            <div
                                                                key={`ext-checkbox-${q.id}`}
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
                                                                    pointerEvents: 'auto',
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filledValues[q.id] === 'true'}
                                                                    onChange={(e) => setFilledValues(prev => ({ ...prev, [q.id]: e.target.checked ? 'true' : 'false' }))}
                                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer border-2 border-blue-500 bg-blue-50"
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    if (q.status === 'SIGNED' && q.tipo === 'texto') {
                                                        return (
                                                            <div
                                                                key={`ext-input-signed-${q.id}`}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: `${displayX}px`,
                                                                    top: `${displayY}px`,
                                                                    width: `${displayW}px`,
                                                                    height: `${displayH}px`,
                                                                    zIndex: 40,
                                                                }}
                                                                className="flex items-center bg-gray-50 border border-gray-300 rounded px-1 text-xs text-gray-600 select-none overflow-hidden truncate"
                                                            >
                                                                {q.valor_preenchido || ''}
                                                            </div>
                                                        );
                                                    }

                                                    if (q.status === 'SIGNED' && q.tipo === 'checkbox') {
                                                        return (
                                                            <div
                                                                key={`ext-checkbox-signed-${q.id}`}
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
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={q.valor_preenchido === 'true'}
                                                                    disabled
                                                                    className="w-4 h-4 rounded text-gray-500 border-gray-300 bg-gray-50 cursor-not-allowed"
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    const label = q.tipo === 'rubrica' 
                                                        ? t('assinatura.externa.local_rubrica', 'Sua Rubrica') 
                                                        : t('assinatura.externa.local_assinatura', 'Seu local de Assinatura');

                                                    return (
                                                        <SignaturePositionOverlay
                                                            key={`ext-overlay-${q.id}`}
                                                            x={displayX}
                                                            y={displayY}
                                                            width={displayW}
                                                            height={displayH}
                                                            label={label}
                                                            status={q.status as any}
                                                            interactive={isCurrent}
                                                            pulse={isCurrent}
                                                            colorClasses={getSignerColor(q?.target_email || q?.id)}
                                                        />
                                                    );
                                                })}
                                        </div>
                                    </Document>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                <div className="animate-pulse flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                    <span>{t('assinatura.externa.carregando_visualizador', 'Carregando visualizador...')}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Actions */}
                <div className="w-full md:w-[380px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 overflow-y-auto flex flex-col h-fit max-h-full sticky top-6">
                    {step === 'AUTH' ? (
                        <div className="space-y-6">
                            <div>
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                                    <FiShield className="w-5 h-5 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{t('assinatura.externa.identificacao_necessaria', 'Identificação Necessária')}</h3>
                                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                                    {t('assinatura.externa.identificacao_desc', 'Para garantir a validade jurídica das assinaturas, precisamos confirmar quem é você.')}
                                </p>
                            </div>

                            <form onSubmit={handleAuthSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{t('assinatura.externa.nome_completo_label', 'Nome Completo')}</label>
                                    <input 
                                        type="text" 
                                        required
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900 ${
                                            fieldErrors.nome ? 'border-red-400 bg-red-50 focus:border-red-400' : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500'
                                        }`}
                                        placeholder="Ex: João da Silva"
                                        value={authData.nome}
                                        onChange={e => { setAuthData({...authData, nome: e.target.value}); setFieldErrors(p => ({...p, nome: undefined})); }}
                                    />
                                    {fieldErrors.nome && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.nome}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{t('assinatura.externa.cpf_label', 'CPF')}</label>
                                    <input 
                                        type="text" 
                                        required
                                        maxLength={14}
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900 ${
                                            fieldErrors.cpf ? 'border-red-400 bg-red-50 focus:border-red-400' : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500'
                                        }`}
                                        placeholder="000.000.000-00"
                                        value={authData.cpf}
                                        onChange={e => { setAuthData({...authData, cpf: formatCpf(e.target.value)}); setFieldErrors(p => ({...p, cpf: undefined})); }}
                                    />
                                    {fieldErrors.cpf && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.cpf}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{t('assinatura.externa.email_label', 'E-mail')}</label>
                                    <input 
                                        type="email" 
                                        required
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900 ${
                                            fieldErrors.email ? 'border-red-400 bg-red-50 focus:border-red-400' : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500'
                                        }`}
                                        placeholder="joao@exemplo.com"
                                        value={authData.email}
                                        onChange={e => { setAuthData({...authData, email: e.target.value}); setFieldErrors(p => ({...p, email: undefined})); }}
                                    />
                                    {fieldErrors.email && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.email}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">{t('assinatura.externa.nascimento_label', 'Data de Nascimento')}</label>
                                    <input
                                        type="date"
                                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-900 ${
                                            fieldErrors.dataNascimento ? 'border-red-400 bg-red-50 focus:border-red-400' : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500'
                                        }`}
                                        value={authData.dataNascimento}
                                        onChange={e => { setAuthData({...authData, dataNascimento: e.target.value}); setFieldErrors(p => ({...p, dataNascimento: undefined})); }}
                                    />
                                    {fieldErrors.dataNascimento && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.dataNascimento}</p>}
                                </div>
                                
                                <button 
                                    type="submit"
                                    className="w-full flex items-center justify-center gap-2 mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
                                >
                                    <span>{t('assinatura.externa.botao_continuar', 'Continuar para os Documentos')}</span>
                                    <FiArrowRight className="w-4 h-4" />
                                </button>
                            </form>

                            
                            <div className="flex items-start gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-800 leading-relaxed">
                                <FiShield className="text-blue-600 mt-0.5 shrink-0 w-4 h-4" />
                                <p>
                                    {t('assinatura.externa.lgpd_aviso', 'Dados protegidos sob a LGPD. Serão utilizados exclusivamente para compor a integridade da trilha de auditoria do documento.')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{t('assinatura.externa.revisao_titulo', 'Revisão e Assinatura')}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{t('assinatura.externa.revisao_subtitulo', 'Leia com atenção antes de prosseguir.')}</p>
                                </div>
                                {totalDocs > 1 && (
                                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                                        {completedCount + 1}/{totalDocs}
                                    </span>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('assinatura.externa.signatario_label', 'Signatário')}</span>
                                    <button 
                                        onClick={() => setStep('AUTH')}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        {t('assinatura.externa.alterar_label', 'Alterar')}
                                    </button>
                                </div>
                                <div className="font-bold text-gray-900 truncate">{authData.nome}</div>
                                <div className="text-xs text-gray-600 mt-0.5">{t('assinatura.externa.cpf_label', 'CPF')} {authData.cpf} | {authData.email}</div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase mb-2">
                                        <FiFileText className="w-3.5 h-3.5" />
                                        {t('assinatura.externa.doc_atual_label', 'Documento Atual')}
                                    </div>
                                    <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 shadow-sm break-words">
                                        {documento?.titulo}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative group cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setLegalAccepted(!legalAccepted)}>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <div className="mt-0.5">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={legalAccepted}
                                                onChange={() => {}} // Handled by parent onClick
                                            />
                                        </div>
                                        <span className="text-xs text-slate-700 leading-relaxed select-none">
                                            {t('assinatura.externa.declaracao_termo', 'Declaro que li e compreendi o documento exibido. Reconheço a validade jurídica desta assinatura eletrônica conforme o Art. 10, § 2º, da MP nº 2.200-2/2001.')}
                                        </span>
                                    </label>
                                </div>
                                
                                {/* Pending fields warning banner */}
                                {pendingTextFields.length > 0 && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                                        <div className="flex items-start gap-2">
                                            <FiAlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold mb-1">
                                                    {t('assinatura.externa.campos_pendentes', { count: pendingTextFields.length }, `Preencha ${pendingTextFields.length} campo(s) obrigatório(s) antes de assinar`)}
                                                </p>
                                                <p className="text-amber-700">
                                                    {t('assinatura.externa.paginas_pendentes', 'Páginas com campos pendentes:')}{' '}
                                                    {pendingPages.map((pg, i) => (
                                                        <button
                                                            key={pg}
                                                            type="button"
                                                            onClick={() => setCurrentPage(pg)}
                                                            className="font-bold underline underline-offset-2 hover:text-amber-900 transition-colors"
                                                        >
                                                            {i > 0 ? ', ' : ''}{t('assinatura.externa.pagina_label', 'pág.')} {pg}
                                                        </button>
                                                    ))}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={handleSign}
                                    disabled={!legalAccepted || isSigning || pendingTextFields.length > 0}
                                    title={pendingTextFields.length > 0 ? t('assinatura.externa.campos_pendentes_tooltip', 'Preencha todos os campos antes de assinar') : ''}
                                    className={`w-full flex items-center justify-center gap-3 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] ${
                                        !legalAccepted || isSigning || pendingTextFields.length > 0
                                        ? 'bg-gray-300 shadow-none cursor-not-allowed' 
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                    }`}
                                >

                                    {isSigning ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                    ) : (
                                        <FiCheck className="w-5 h-5" />
                                    )}
                                    <span>
                                        {isSigning 
                                            ? t('assinatura.externa.processando', 'Processando...') 
                                            : (pendingCount > 1 
                                                ? t('assinatura.externa.assinar_e_proximo', 'Assinar e Próximo') 
                                                : t('assinatura.externa.concordar_e_assinar', 'Concordar e Assinar'))}
                                    </span>
                                </button>

                                {pendingCount > 1 && (
                                    <p className="text-center text-xs text-gray-500 font-medium">
                                        {t('assinatura.externa.restam_documentos', { count: pendingCount - 1 }, `Ainda restam ${pendingCount - 1} documentos neste lote`)}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
            {/* Blocking Language Selection Modal */}
            {showLangModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-8 animate-in zoom-in-95 duration-300">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4 text-blue-600">
                                <FiGlobe className="w-8 h-8 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 leading-snug">
                                {t('assinatura.externa.modal_idioma_titulo', 'Escolha seu Idioma / Choose your Language')}
                            </h3>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                {t('assinatura.externa.modal_idioma_desc', 'Selecione o idioma para prosseguir com a visualização e assinatura dos documentos.')}
                            </p>
                        </div>

                        <div className="space-y-3 mb-8">
                            {/* PT-BR Button */}
                            <button
                                type="button"
                                onClick={() => setLocale('pt-BR')}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    locale === 'pt-BR'
                                        ? 'border-blue-600 bg-blue-50/50'
                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center gap-3 text-left">
                                    <span className="text-2xl">🇧🇷</span>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">Português</p>
                                        <p className="text-slate-500 text-xs">Brasil</p>
                                    </div>
                                </div>
                                {locale === 'pt-BR' && (
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-sm">
                                        <FiCheck className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                )}
                            </button>

                            {/* EN-US Button */}
                            <button
                                type="button"
                                onClick={() => setLocale('en-US')}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    locale === 'en-US'
                                        ? 'border-blue-600 bg-blue-50/50'
                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center gap-3 text-left">
                                    <span className="text-2xl">🇺🇸</span>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">English</p>
                                        <p className="text-slate-500 text-xs">United States</p>
                                    </div>
                                </div>
                                {locale === 'en-US' && (
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-sm">
                                        <FiCheck className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                )}
                            </button>
                        </div>

                        <button
                            onClick={handleConfirmLang}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold tracking-wide transition-all active:scale-[0.98] shadow-lg"
                        >
                            {t('assinatura.externa.idioma_confirmar', 'Confirmar / Confirm')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
