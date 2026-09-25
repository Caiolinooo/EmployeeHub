"use client";

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiCopy } from 'react-icons/fi';
import Confetti from 'react-confetti';
import { useI18n } from '@/contexts/I18nContext';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import ModalCloseButton from '@/components/ui/ModalCloseButton';

interface ThankYouModalProps {
  protocol: string;
  onClose: () => void;
}

const ThankYouModal: React.FC<ThankYouModalProps> = ({ protocol, onClose }) => {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);
  const [windowSize, setWindowSize] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEscapeToClose(true, onClose);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(protocol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    >
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        recycle={false}
        numberOfPieces={200}
        gravity={0.15}
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        data-modal-panel=""
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center"
      >
        <div className="absolute right-1 top-1">
          <ModalCloseButton onClick={onClose} mobileOnly />
        </div>
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <FiCheckCircle className="w-10 h-10 text-green-500" />
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('reimbursement.form.submitSuccess')}</h2>

        <p className="text-gray-600 mb-6">
          {t('reimbursement.form.thankYouMessage')}
        </p>

        <div className="bg-gray-50 p-3 rounded-md mb-6">
          <p className="text-sm text-gray-500 mb-1">{t('reimbursement.form.protocol')}:</p>
          <div className="flex items-center justify-center">
            <p className="font-mono text-lg font-semibold text-gray-800 mr-2">{protocol}</p>
            <button
              onClick={copyToClipboard}
              className="text-blue-500 hover:text-blue-700 focus:outline-none"
              title={t('common.copy')}
            >
              {copied ? (
                <span className="text-green-500 text-xs">{t('common.copied')}</span>
              ) : (
                <FiCopy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('common.done')}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default ThankYouModal;