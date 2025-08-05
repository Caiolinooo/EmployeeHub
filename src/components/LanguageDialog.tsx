'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiGlobe, FiCheck } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { Locale } from '@/i18n';

export default function LanguageDialog() {
  const { locale, setLocale, t, availableLocales } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Check if the dialog has been shown before
    const hasShownDialog = localStorage.getItem('languageDialogShown');
    
    if (!hasShownDialog) {
      // Show dialog after a short delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      setHasShown(true);
    }
  }, []);

  const handleSelectLanguage = (localeCode: Locale) => {
    setLocale(localeCode);
    setIsOpen(false);
    localStorage.setItem('languageDialogShown', 'true');
    setHasShown(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('languageDialogShown', 'true');
    setHasShown(true);
  };

  const getLanguageName = (localeCode: Locale) => {
    switch (localeCode) {
      case 'pt-BR':
        return t('common.portuguese');
      case 'en-US':
        return t('common.english');
      default:
        return localeCode;
    }
  };

  const getLanguageFlag = (localeCode: Locale) => {
    switch (localeCode) {
      case 'pt-BR':
        return '🇧🇷';
      case 'en-US':
        return '🇺🇸';
      default:
        return '🌐';
    }
  };

  if (hasShown && !isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="bg-blue-100 p-3 rounded-full">
                <FiGlobe className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-semibold text-center mb-2">Choose Your Language</h2>
            <p className="text-gray-600 text-center mb-6">Escolha seu idioma</p>
            
            <div className="space-y-3">
              {availableLocales.map((localeCode) => (
                <button
                  key={localeCode}
                  onClick={() => handleSelectLanguage(localeCode)}
                  className="w-full text-left px-4 py-3 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center justify-between"
                >
                  <span className="flex items-center">
                    <span className="text-2xl mr-3">{getLanguageFlag(localeCode)}</span>
                    <span className="font-medium">{getLanguageName(localeCode)}</span>
                  </span>
                  {locale === localeCode && <FiCheck className="h-5 w-5 text-blue-500" />}
                </button>
              ))}
            </div>
            
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
