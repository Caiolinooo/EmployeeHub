import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/contexts/I18nContext';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';
import ModalCloseButton from '@/components/ui/ModalCloseButton';

interface DeleteCourseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (deleteCertificates: boolean) => void;
    courseTitle: string;
}

export default function DeleteCourseModal({
    isOpen,
    onClose,
    onConfirm,
    courseTitle
}: DeleteCourseModalProps) {
    const { t } = useI18n();
    const [deleteCertificates, setDeleteCertificates] = useState(false);

    // Reset state when opening
    React.useEffect(() => {
        if (isOpen) {
            setDeleteCertificates(false);
        }
    }, [isOpen]);

    useEscapeToClose(isOpen, onClose);
    useEscapeCapture(isOpen, onClose);
    useRestoreFocus(isOpen);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    data-modal-panel=""
                    className="relative w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden"
                >
                    <ModalCloseButton onClick={onClose} mobileOnly mountOnlyWhenMobile className="absolute right-1 top-1" />
                    <div className="p-6">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                            </div>
                            <div className="ml-4 mt-0 text-left">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    {t('academy.excluirCurso') || 'Excluir Curso'}
                                </h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <p>
                                        {t('academy.temCertezaExcluirResto')} <strong>"{courseTitle}"</strong>? {t('academy.estaAcaoRemoveraModulosTurmasTestesProgressos')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Checkbox to delete certificates */}
                        <div className="mt-6 ml-14 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded"
                                        checked={deleteCertificates}
                                        onChange={(e) => setDeleteCertificates(e.target.checked)}
                                    />
                                </div>
                                <div className="text-sm">
                                    <span className="font-medium text-gray-900">{t('academy.apagarTambemCertificadosGeradosModoTeste') || 'Apagar também os certificados gerados (Modo Teste)'}</span>
                                    <p className="text-gray-500">
                                        {t('academy.seMarcadoExcluiraPermanentementepdfsCertificadosEmitidosParaEsteCurso') || 'Se marcado, excluirá permanentemente os PDFs de certificados emitidos para este curso. Útil para limpar dados de testes.'}
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 gap-3">
                        <button
                            type="button"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 max-md:min-h-11 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                            onClick={() => onConfirm(deleteCertificates)}
                        >
                            {t('academy.simExcluir') || 'Sim, excluir'}
                        </button>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 max-md:min-h-11 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            {t('academy.cancelar') || 'Cancelar'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
