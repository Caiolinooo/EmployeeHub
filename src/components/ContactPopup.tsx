"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FiX, FiMail, FiPhone, FiMessageSquare } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface ContactPopupProps {
  onClose: () => void;
}

const ContactPopup: React.FC<ContactPopupProps> = ({ onClose }) => {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">{t('contact.needHelp')}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          {t('contact.helpMessage')}
        </p>

        <div className="space-y-4">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <FiMail className="text-blue-600 w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{t('common.email')}</h3>
              <a href="mailto:logistica@groupabz.com" className="text-blue-600 hover:underline">
                logistica@groupabz.com
              </a>
            </div>
          </div>

          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <FiPhone className="text-green-600 w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{t('common.phone')}</h3>
              <a href="tel:+5522992074646" className="text-blue-600 hover:underline">
                (22) 99207-4646
              </a>
              <p className="text-sm text-gray-500 mt-1">
                {t('contact.businessHoursTime')}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <FiMessageSquare className="text-purple-600 w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{t('contact.businessHours')}</h3>
              <p className="text-gray-600">
                {t('contact.businessHoursTime')}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('common.close')}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default ContactPopup;