'use client';

import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';
import {
  validateName,
  generateNameSuggestions,
  extractNameFromEmail,
  formatName
} from '@/lib/nameValidation';
import { useI18n } from '@/contexts/I18nContext';

interface NameValidationInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  email?: string;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

export default function NameValidationInput({
  label,
  value,
  onChange,
  placeholder,
  email,
  required = false,
  className = '',
  id,
  name
}: NameValidationInputProps) {
  const { t } = useI18n();
  const [validation, setValidation] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focused, setFocused] = useState(false);

  // Validar em tempo real
  useEffect(() => {
    if (value.trim()) {
      const result = validateName(value);
      setValidation(result);
      setSuggestions([]);
    } else {
      setValidation(null);

      // Sugestões baseadas no email se o campo estiver vazio
      if (email && focused) {
        const extracted = extractNameFromEmail(email);
        const emailSuggestions: string[] = [];

        if (extracted?.firstName && name === 'firstName') {
          emailSuggestions.push(extracted.firstName);
        }
        if (extracted?.lastName && name === 'lastName') {
          emailSuggestions.push(extracted.lastName);
        }

        setSuggestions(emailSuggestions);
      } else {
        setSuggestions([]);
      }
    }
  }, [value, email, focused, name]);

  // Aplicar sugestão
  const applySuggestion = (suggestion: string) => {
    const formatted = formatName(suggestion);
    onChange(formatted);
    setShowSuggestions(false);
  };

  // Determinar cor da borda
  const getBorderColor = () => {
    if (!value.trim()) return 'border-gray-300 focus:border-blue-500';

    if (validation?.isValid === false) {
      return 'border-red-300 focus:border-red-500';
    } else if (validation?.isValid === true) {
      return 'border-green-300 focus:border-green-500';
    }

    return 'border-gray-300 focus:border-blue-500';
  };

  // Determinar ícone de status
  const getStatusIcon = () => {
    if (!validation) return null;

    if (validation.isValid) {
      return <FiCheckCircle className="text-green-500" />;
    } else {
      return <FiAlertTriangle className="text-red-500" />;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label className="block text-sm text-gray-700 font-medium" htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Input Container */}
      <div className="relative">
        <input
          type="text"
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            setShowSuggestions(suggestions.length > 0);
          }}
          onBlur={() => {
            // Delay para permitir clique nas sugestões
            setTimeout(() => {
              setFocused(false);
              setShowSuggestions(false);
            }, 200);
          }}
          className={`w-full rounded-md border px-3 py-2 pr-10 focus:outline-none transition-colors ${getBorderColor()}`}
          placeholder={placeholder}
          required={required}
        />

        {/* Ícone de status */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {getStatusIcon()}
        </div>

        {/* Sugestões */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="p-2">
              <div className="flex items-center space-x-1 mb-2">
                <FiInfo className="text-blue-500 text-sm" />
                <span className="text-xs text-blue-700 font-medium">{t('validation.suggestions', 'Suggestions')}:</span>
              </div>
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    className="w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feedback de validação */}
      {validation && !validation.isValid && (
        <div className="flex items-center space-x-1 text-xs text-red-600">
          <FiAlertTriangle />
          <span>{validation.message}</span>
        </div>
      )}
    </div>
  );
}
