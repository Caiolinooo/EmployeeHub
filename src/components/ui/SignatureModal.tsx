'use client';

import React, { useState } from 'react';
import { FiX, FiKey, FiCheck, FiEdit3, FiShield } from 'react-icons/fi';
import SignaturePad from '@/components/ui/SignaturePad';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';

export interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (signatureUrl: string, authMethod: string) => void;
    userSignatureUrl: string | null;
    isSubmitting?: boolean;
    title?: string;
    description?: string;
    onRegisterSignature: (base64: string) => Promise<string>; // Returns URL
}

type ModalStep = 'preview' | 'register' | 'authenticate';

/**
 * SignatureModal — Modal completo de assinatura global.
 * Renderizado pelo SignatureContext, NÃO deve ser usado diretamente.
 * 
 * Fluxo:
 * 1. Se não tem assinatura → Tela de cadastro (Canvas)
 * 2. Se tem assinatura → Preview + botões de autenticação
 * 3. Após autenticação → onConfirm(signatureUrl, authMethod)
 */
export default function SignatureModal({
    isOpen,
    onClose,
    onConfirm,
    userSignatureUrl,
    isSubmitting = false,
    title,
    description,
    onRegisterSignature,
}: SignatureModalProps) {
    const { t } = useI18n();
    const displayTitle = title || t('signature.modal.title_default', 'Assinatura Digital');
    const displayDescription = description || t('signature.modal.desc_default', 'Confirme sua identidade para assinar este documento.');

    const [step, setStep] = useState<ModalStep>(userSignatureUrl ? 'preview' : 'register');
    const [newSignatureBase64, setNewSignatureBase64] = useState<string | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
    const [currentSignatureUrl, setCurrentSignatureUrl] = useState(userSignatureUrl);

    // Reset state when modal opens/closes
    React.useEffect(() => {
        if (isOpen) {
            setCurrentSignatureUrl(userSignatureUrl);
            setStep(userSignatureUrl ? 'preview' : 'register');
            setNewSignatureBase64(null);
        }
    }, [isOpen, userSignatureUrl]);

    if (!isOpen) return null;

    // Step 1: Register new signature
    const handleRegisterSignature = async () => {
        if (!newSignatureBase64) {
            toast.error(t('signature.modal.toast.draw_required', 'Por favor, desenhe sua assinatura.'));
            return;
        }

        try {
            setIsRegistering(true);
            const url = await onRegisterSignature(newSignatureBase64);
            setCurrentSignatureUrl(url);
            setStep('preview');
            toast.success(t('signature.modal.toast.register_success', 'Assinatura cadastrada com sucesso!'));
        } catch (error: any) {
            toast.error(error.message || t('signature.modal.toast.register_error', 'Erro ao cadastrar assinatura'));
        } finally {
            setIsRegistering(false);
        }
    };

    // Step 2: Authenticate via Passkey/Biometria
    const handlePasskeyAuth = async () => {
        if (!currentSignatureUrl) return;

        try {
            setIsPasskeyLoading(true);
            const { startAuthentication } = await import('@simplewebauthn/browser');

            const optionsRes = await fetch('/api/auth/webauthn/sign/options', { method: 'POST' });
            const optionsPayload = await optionsRes.json().catch(() => null);
            if (!optionsRes.ok) throw new Error(optionsPayload?.error || t('signature.modal.toast.biometric_error', 'Erro ao iniciar autenticação biométrica'));

            let asseResp;
            try {
                asseResp = await startAuthentication({ optionsJSON: optionsPayload });
            } catch (err: any) {
                if (err.name === 'NotAllowedError') return; // User cancelled
                throw new Error(t('signature.modal.toast.biometric_failed', 'Falha ao usar biometria. Verifique se há uma Passkey cadastrada.'));
            }

            const verifyRes = await fetch('/api/auth/webauthn/sign/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(asseResp),
            });
            const verification = await verifyRes.json();

            if (verification.success) {
                toast.success(t('signature.modal.toast.biometric_success', 'Identidade confirmada via biometria!'));
                onConfirm(currentSignatureUrl, 'passkey');
            } else {
                throw new Error(verification.error || t('signature.modal.toast.biometric_error', 'Erro na verificação'));
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || t('signature.modal.toast.biometric_error', 'Erro ao autenticar com biometria'));
        } finally {
            setIsPasskeyLoading(false);
        }
    };

    // Step 2 alternative: Confirm without extra auth (canvas just drawn = identity already confirmed)
    const handleDirectConfirm = () => {
        if (!currentSignatureUrl) return;
        onConfirm(currentSignatureUrl, 'canvas');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-abz-light-blue rounded-lg">
                            <FiEdit3 className="w-5 h-5 text-abz-blue" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{displayTitle}</h3>
                            <p className="text-xs text-gray-500">{displayDescription}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting || isRegistering || isPasskeyLoading}
                        className="text-gray-500 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5">
                    {/* STEP: Register Signature */}
                    {step === 'register' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <FiShield className="w-5 h-5 text-abz-yellow-dark flex-shrink-0" />
                                <p className="text-sm text-amber-800">
                                    {currentSignatureUrl
                                        ? t('signature.modal.draw_to_replace', 'Desenhe sua nova assinatura abaixo para substituir a atual.')
                                        : t('signature.modal.draw_to_continue', 'Você ainda não possui assinatura cadastrada. Desenhe sua assinatura abaixo para continuar.')}
                                </p>
                            </div>

                            <SignaturePad
                                onSignatureChange={setNewSignatureBase64}
                                placeholder={t('signature.modal.draw_placeholder', 'Desenhe sua assinatura aqui')}
                                disabled={isRegistering}
                            />

                            <div className="flex items-center justify-end gap-3">
                                {currentSignatureUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setStep('preview')}
                                        disabled={isRegistering}
                                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        {t('signature.modal.cancel', 'Cancelar')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleRegisterSignature}
                                    disabled={!newSignatureBase64 || isRegistering}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-abz-blue text-white rounded-lg hover:bg-abz-blue-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                >
                                    {isRegistering ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    ) : (
                                        <FiCheck className="w-4 h-4" />
                                    )}
                                    {isRegistering ? t('signature.modal.saving', 'Salvando...') : t('signature.modal.register_btn', 'Cadastrar Assinatura')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: Preview + Authenticate */}
                    {step === 'preview' && currentSignatureUrl && (
                        <div className="space-y-4">
                            {/* Signature Preview */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                                    {t('signature.modal.your_signature', 'Sua Assinatura')}
                                </label>
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center min-h-[120px]">
                                    <img
                                        src={currentSignatureUrl}
                                        alt={t('signature.modal.alt_text', 'Minha assinatura')}
                                        className="max-h-24 max-w-full object-contain"
                                        crossOrigin="anonymous"
                                    />
                                </div>
                            </div>

                            {/* Update Signature Link */}
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setStep('register')}
                                    disabled={isSubmitting || isPasskeyLoading}
                                    className="text-xs text-abz-blue hover:text-abz-blue-dark font-medium underline underline-offset-2"
                                >
                                    {t('signature.modal.change_signature', 'Alterar assinatura')}
                                </button>
                            </div>

                            {/* Auth Methods */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">
                                    {t('signature.modal.confirm_identity', 'Confirme sua Identidade')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Direct Confirm (Canvas — identity implicitly confirmed) */}
                                    <button
                                        type="button"
                                        onClick={handleDirectConfirm}
                                        disabled={isSubmitting || isPasskeyLoading}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-abz-green text-white rounded-lg hover:bg-abz-green-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                                    >
                                        {isSubmitting && !isPasskeyLoading ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                        ) : (
                                            <FiCheck className="w-4 h-4" />
                                        )}
                                        {t('signature.modal.confirm_btn', 'Confirmar e Assinar')}
                                    </button>

                                    {/* Passkey / Biometria */}
                                    <button
                                        type="button"
                                        onClick={handlePasskeyAuth}
                                        disabled={isSubmitting || isPasskeyLoading}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-abz-blue text-white rounded-lg hover:bg-abz-blue-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                                    >
                                        {isPasskeyLoading ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                        ) : (
                                            <FiKey className="w-4 h-4" />
                                        )}
                                        {t('signature.modal.use_biometric_btn', 'Usar Biometria')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
