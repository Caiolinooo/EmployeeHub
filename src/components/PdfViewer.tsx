"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FiX, FiDownload, FiCheckCircle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface PdfViewerProps {
  onClose: () => void;
  onUnderstand: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ onClose, onUnderstand }) => {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">{t('reimbursement.form.viewPolicy')}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto p-6">
          <div className="prose max-w-none">
            <h3>{t('reimbursement.policy.title')}</h3>

            <p>
              {t('reimbursement.policy.introduction')}
            </p>

            <h4>{t('reimbursement.policy.eligibility')}</h4>
            <p>
              {t('reimbursement.policy.eligibilityText')}
            </p>

            <h4>{t('reimbursement.policy.typesTitle')}</h4>
            <ul>
              <li><strong>{t('reimbursement.policy.foodLabel')}</strong> {t('reimbursement.policy.foodText')}</li>
              <li><strong>{t('reimbursement.policy.transportLabel')}</strong> {t('reimbursement.policy.transportText')}</li>
              <li><strong>{t('reimbursement.policy.accommodationLabel')}</strong> {t('reimbursement.policy.accommodationText')}</li>
              <li><strong>{t('reimbursement.policy.materialsLabel')}</strong> {t('reimbursement.policy.materialsText')}</li>
              <li><strong>{t('reimbursement.policy.otherLabel')}</strong> {t('reimbursement.policy.otherText')}</li>
            </ul>

            <h4>{t('reimbursement.policy.documentationTitle')}</h4>
            <p>
              {t('reimbursement.policy.documentationText')}
            </p>
            <ul>
              <li>{t('reimbursement.policy.docDate')}</li>
              <li>{t('reimbursement.policy.docAmount')}</li>
              <li>{t('reimbursement.policy.docDescription')}</li>
              <li>{t('reimbursement.policy.docSupplier')}</li>
            </ul>

            <h4>{t('reimbursement.policy.deadlinesTitle')}</h4>
            <p>
              {t('reimbursement.policy.deadlinesText')}
            </p>

            <h4>{t('reimbursement.policy.paymentTitle')}</h4>
            <p>
              {t('reimbursement.policy.paymentText')}
            </p>
            <ul>
              <li>{t('reimbursement.policy.paymentBank')}</li>
              <li>{t('reimbursement.policy.paymentPix')}</li>
              <li>{t('reimbursement.policy.paymentCash')}</li>
            </ul>

            <h4>{t('reimbursement.policy.restrictionsTitle')}</h4>
            <p>
              {t('reimbursement.policy.restrictionsText')}
            </p>
            <ul>
              <li>{t('reimbursement.policy.restrictionProof')}</li>
              <li>{t('reimbursement.policy.restrictionPersonal')}</li>
              <li>{t('reimbursement.policy.restrictionAuth')}</li>
              <li>{t('reimbursement.policy.restrictionPolicy')}</li>
              <li>{t('reimbursement.policy.restrictionDoc')}</li>
            </ul>

            <h4>{t('reimbursement.policy.finalTitle')}</h4>
            <p>
              {t('reimbursement.policy.finalText')}
            </p>
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="p-4 border-t flex justify-end space-x-3">
          <button
            onClick={onUnderstand}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiCheckCircle className="mr-2" />
            {t('reimbursement.policy.agreeButton')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PdfViewer;
