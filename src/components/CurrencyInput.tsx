'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Currency,
  getExchangeRates,
  convertCurrency,
  currencySymbols
} from '@/lib/currencyConverter';

interface CurrencyInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCurrencyChange?: (currency: Currency) => void;
  currency?: Currency;
  error?: string;
  required?: boolean;
  className?: string;
}

export default function CurrencyInput({
  id,
  label,
  value,
  onChange,
  onCurrencyChange,
  currency,
  error,
  required = false,
  className = ''
}: CurrencyInputProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currency || 'BRL');
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [convertedValues, setConvertedValues] = useState<Record<Currency, string>>({
    BRL: '',
    USD: '',
    EUR: '',
    GBP: ''
  });
  const [isConverting, setIsConverting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update selected currency when currency prop changes (only on initial load)
  useEffect(() => {
    if (currency && currency !== selectedCurrency) {
      console.log('Sincronizando moeda inicial:', currency);
      setSelectedCurrency(currency);
    }
  }, [currency]); // Removido selectedCurrency da dependência para evitar loops

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Adicionar um pequeno delay para permitir que o onClick seja processado primeiro
      setTimeout(() => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node)
        ) {
          setShowCurrencySelector(false);
        }
      }, 0);
    }

    // Usar 'click' ao invés de 'mousedown' para evitar conflito com onClick
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Atualizar valores convertidos quando o valor ou a moeda mudar
  useEffect(() => {
    const updateConversions = async () => {
      if (!value || value === '0,00') {
        setConvertedValues({
          BRL: '',
          USD: '',
          EUR: '',
          GBP: ''
        });
        return;
      }

      setIsConverting(true);
      try {
        // Extrair valor numérico da string formatada (ex: "1.234,56" -> 1234.56)
        const numericValue = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;

        if (numericValue === 0) {
          setConvertedValues({
            BRL: '',
            USD: '',
            EUR: '',
            GBP: ''
          });
          return;
        }

        // Obter taxas de câmbio
        const rates = await getExchangeRates(selectedCurrency);

        // Calcular valores convertidos para todas as moedas
        const converted: Record<Currency, string> = {
          BRL: formatCurrency(convertCurrency(numericValue, selectedCurrency, 'BRL', rates), 'BRL'),
          USD: formatCurrency(convertCurrency(numericValue, selectedCurrency, 'USD', rates), 'USD'),
          EUR: formatCurrency(convertCurrency(numericValue, selectedCurrency, 'EUR', rates), 'EUR'),
          GBP: formatCurrency(convertCurrency(numericValue, selectedCurrency, 'GBP', rates), 'GBP')
        };

        setConvertedValues(converted);
      } catch (error) {
        console.error('Erro ao converter moedas:', error);
        setConvertedValues({
          BRL: '',
          USD: '',
          EUR: '',
          GBP: ''
        });
      } finally {
        setIsConverting(false);
      }
    };

    updateConversions();
  }, [value, selectedCurrency]);

  // Referência para o input
  const inputRef = useRef<HTMLInputElement>(null);

  // Função para manipular a entrada de valores no estilo de aplicativos bancários
  const handleBankingStyleInput = (inputValue: string, isBackspace: boolean = false): string => {
    // Se for backspace e o valor atual não estiver vazio
    if (isBackspace && value) {
      // Remover formatação para obter apenas os dígitos
      const digitsOnly = value.replace(/[^\d]/g, '');

      if (digitsOnly.length <= 1) {
        return '0,00';
      }

      // Remover o último dígito
      const newDigits = digitsOnly.slice(0, -1);
      return formatBankingValue(newDigits);
    }

    // Para entrada normal, extrair apenas os dígitos do input
    const newDigits = inputValue.replace(/[^\d]/g, '');

    if (!newDigits) {
      return '0,00';
    }

    return formatBankingValue(newDigits);
  };

  // Função para formatar valor no estilo bancário
  const formatBankingValue = (digits: string): string => {
    if (!digits || digits === '0') {
      return '0,00';
    }

    // Garantir que temos pelo menos 3 dígitos (para ter centavos)
    const paddedDigits = digits.padStart(3, '0');

    // Separar centavos (últimos 2 dígitos) da parte inteira
    const centavos = paddedDigits.slice(-2);
    const reais = paddedDigits.slice(0, -2);

    // Formatar a parte dos reais com separadores de milhar
    const formattedReais = parseInt(reais || '0').toLocaleString('pt-BR');

    return `${formattedReais},${centavos}`;
  };

  // Manipular a entrada do usuário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e || !e.target) {
      console.warn('Event or event.target is undefined in handleInputChange');
      return;
    }

    const inputValue = e.target.value || '';

    // Processar o valor no estilo de aplicativos bancários
    const processedValue = handleBankingStyleInput(inputValue);

    // Atualizar o valor
    onChange(processedValue);

    // Posicionar cursor no final após formatação
    setTimeout(() => {
      if (inputRef.current) {
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  };

  // Manipular teclas especiais (backspace, delete)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const processedValue = handleBankingStyleInput('', true);
      onChange(processedValue);

      // Posicionar cursor no final
      setTimeout(() => {
        if (inputRef.current) {
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 0);
    }
  };

  // Função para formatar valor monetário
  const formatCurrency = (amount: number, currency: Currency): string => {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return formatter.format(amount);
  };

  // Mudar a moeda selecionada
  const handleCurrencyChange = (currency: Currency) => {
    console.log('Mudando moeda para:', currency, 'Moeda atual:', selectedCurrency);

    // Verificar se a moeda é válida
    if (!currency || !['BRL', 'USD', 'EUR', 'GBP'].includes(currency)) {
      console.warn('CurrencyInput: invalid currency in handleCurrencyChange', currency);
      currency = 'BRL';
    }

    // Forçar atualização do estado
    setSelectedCurrency(currency);
    setShowCurrencySelector(false);

    // Forçar re-render usando um timeout
    setTimeout(() => {
      console.log('Estado após mudança:', currency);
      if (onCurrencyChange) {
        try {
          onCurrencyChange(currency);
        } catch (error) {
          console.error('Error in onCurrencyChange callback:', error);
        }
      }
    }, 0);

    console.log('Moeda alterada para:', currency);
  };

  return (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative" style={{ zIndex: 30 }}>
        <div className="flex">
          <button
            type="button"
            ref={buttonRef}
            onClick={() => setShowCurrencySelector(!showCurrencySelector)}
            className="px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 relative"
            aria-label="Selecionar moeda"
            aria-expanded={showCurrencySelector}
          >
            <span className="flex items-center">
              {currencySymbols[selectedCurrency]}
            </span>
          </button>

          <input
            id={id}
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            className={`flex-1 px-3 py-2 border-y border-r rounded-r-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={`0,00`}
          />
        </div>

        {showCurrencySelector && (
          <div
            ref={dropdownRef}
            className="absolute z-[60] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-xl"
            style={{
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
            onMouseDown={(e) => {
              // Prevenir que o mousedown feche o dropdown
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Selecione a moeda:</div>
              <div className="space-y-1">
                {(['BRL', 'USD', 'EUR', 'GBP'] as Currency[]).map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => {
                      console.log('Clicou na moeda:', currency);
                      handleCurrencyChange(currency);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                      selectedCurrency === currency
                        ? 'bg-blue-100 text-blue-800 font-medium'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">{currencySymbols[currency]}</span> {currency}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {/* Mostrar valores convertidos */}
      {value && value !== '0,00' && !error && (
        <div className="mt-2 text-xs text-gray-500">
          {isConverting ? (
            <p>Convertendo valores...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* Mostrar valor atual */}
              <div className="flex items-center">
                <span className="font-medium mr-1 text-blue-600">{selectedCurrency}:</span>
                <span className="text-blue-600 font-medium">{currencySymbols[selectedCurrency]} {value}</span>
              </div>

              {/* Mostrar conversões para outras moedas */}
              {Object.entries(convertedValues)
                .filter(([curr]) => curr !== selectedCurrency)
                .map(([curr, convertedValue]) => (
                  <div key={curr} className="flex items-center">
                    <span className="font-medium mr-1">{curr}:</span> {convertedValue}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
