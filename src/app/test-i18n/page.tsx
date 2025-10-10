'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

export default function TestI18nPage() {
  const { t, locale, setLocale, availableLocales } = useI18n();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Test I18n</h1>
      
      <div className="mb-4">
        <p>Current locale: {locale}</p>
        <p>Available locales: {availableLocales.join(', ')}</p>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Common translations:</h2>
        <ul className="list-disc pl-5">
          <li>common.loading: t('common.loading')</li>
          <li>common.error: t('common.error')</li>
          <li>common.success: t('common.success')</li>
        </ul>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Register translations:</h2>
        <ul className="list-disc pl-5">
          <li>register.title: t('register.title')</li>
          <li>register.subtitle: t('register.subtitle')</li>
          <li>register.firstName: t('register.firstName')</li>
        </ul>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Switch locale:</h2>
        <div className="flex gap-2">
          {availableLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocale(loc)}
              className={`px-4 py-2 rounded ${
                locale === loc ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
