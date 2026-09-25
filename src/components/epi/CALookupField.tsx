'use client';

import React, { useState, useCallback } from 'react';
import { MagnifyingGlassIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import type { CALookupResult, CAValidityLevel } from '@/types/epi';
import { getCAValidityLevel, CA_VALIDITY_COLORS, CA_VALIDITY_LABELS } from '@/types/epi';
import { buildConsultaCaHref } from '@/lib/epi/consulta-ca-url';

interface CALookupFieldProps {
    value: string;
    onChange: (caNumber: string) => void;
    onLookupResult?: (result: CALookupResult | null) => void;
    onValidityChange?: (validityDate: string | null, caStatus: string | null) => void;
    showDetails?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md';
    label?: string;
    className?: string;
}

export default function CALookupField({
    value,
    onChange,
    onLookupResult,
    onValidityChange,
    showDetails = true,
    disabled = false,
    size = 'md',
    label = 'Número do CA',
    className = ''
}: CALookupFieldProps) {
    const [loading, setLoading] = useState(false);
    const [lookupResult, setLookupResult] = useState<CALookupResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const doLookup = useCallback(async (caNumber: string) => {
        if (!caNumber || caNumber.trim().length === 0) return;

        setLoading(true);
        setError(null);
        setHasSearched(true);

        try {
            const res = await fetch(`/api/epi/ca-lookup?ca=${encodeURIComponent(caNumber.trim())}`);
            const json = await res.json();

            if (json.success && json.data) {
                setLookupResult(json.data);
                onLookupResult?.(json.data);
                onValidityChange?.(json.data.validity_date, json.data.status);
            } else {
                setLookupResult(null);
                onLookupResult?.(null);
                setError(json.message || 'CA não encontrado');
            }
        } catch (err: any) {
            setError('Erro ao consultar CA. Tente novamente ou insira manualmente.');
            setLookupResult(null);
            onLookupResult?.(null);
        } finally {
            setLoading(false);
        }
    }, [onLookupResult, onValidityChange]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            doLookup(value);
        }
    };

    const validityLevel: CAValidityLevel = lookupResult
        ? getCAValidityLevel(lookupResult.validity_date, lookupResult.status)
        : 'unknown';

    const inputSizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';
    const btnSizeClass = size === 'sm' ? 'p-1' : 'p-2';
    const consultaCaHref = buildConsultaCaHref(value);

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    {label}
                </label>
            )}

            {/* Input + Search Button */}
            <div className="flex gap-1">
                <input
                    type="text"
                    value={value}
                    onChange={e => {
                        onChange(e.target.value);
                        if (hasSearched) {
                            setHasSearched(false);
                            setLookupResult(null);
                            setError(null);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ex: 12345"
                    disabled={disabled}
                    className={`flex-1 border border-gray-300 rounded-lg ${inputSizeClass} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100`}
                />
                <button
                    type="button"
                    onClick={() => doLookup(value)}
                    disabled={disabled || loading || !value?.trim()}
                    className={`${btnSizeClass} rounded-lg border border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 disabled:hover:bg-transparent transition-all`}
                    title="Consultar CA"
                >
                    {loading ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                        <MagnifyingGlassIcon className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center gap-2 text-xs text-blue-600 animate-pulse">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" />
                    Consultando CA...
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="flex flex-col gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">
                    <div className="flex items-center gap-1.5">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                    {consultaCaHref && (
                        <a
                            href={consultaCaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-5 text-blue-600 hover:underline flex items-center gap-1"
                        >
                            Verificar no ConsultaCA.com &rarr;
                        </a>
                    )}
                </div>
            )}

            {/* Success: Lookup Result */}
            {lookupResult && !loading && showDetails && (
                <div className={`rounded-lg border p-2.5 text-xs space-y-1.5 ${validityLevel === 'valid' ? 'border-green-200 bg-green-50' :
                    validityLevel === 'expiring' ? 'border-yellow-200 bg-yellow-50' :
                        validityLevel === 'expired' ? 'border-red-200 bg-red-50' :
                            'border-gray-200 bg-gray-50'
                    }`}>
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            {validityLevel === 'valid' && <CheckCircleIcon className="w-4 h-4 text-green-600" />}
                            {validityLevel === 'expiring' && <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600" />}
                            {validityLevel === 'expired' && <XCircleIcon className="w-4 h-4 text-red-600" />}
                            <span className={`font-semibold ${validityLevel === 'valid' ? 'text-green-700' :
                                validityLevel === 'expiring' ? 'text-yellow-700' :
                                    validityLevel === 'expired' ? 'text-red-700' :
                                        'text-gray-600'
                                }`}>
                                {CA_VALIDITY_LABELS[validityLevel]}
                            </span>
                        </div>
                        <span className="text-gray-400">
                            via {lookupResult.source === 'cache' ? 'cache' :
                                lookupResult.source === 'ftp' ? 'MTE' : 'consulta'}
                        </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600">
                        {lookupResult.validity_date && (
                            <>
                                <span className="text-gray-500">Validade:</span>
                                <span className="font-medium">
                                    {new Date(lookupResult.validity_date).toLocaleDateString('pt-BR')}
                                </span>
                            </>
                        )}
                        {lookupResult.status && lookupResult.status !== 'DESCONHECIDO' && (
                            <>
                                <span className="text-gray-500">Situação:</span>
                                <span className="font-medium">{lookupResult.status}</span>
                            </>
                        )}
                        {lookupResult.manufacturer && (
                            <>
                                <span className="text-gray-500">Fabricante:</span>
                                <span className="font-medium truncate" title={lookupResult.manufacturer}>
                                    {lookupResult.manufacturer}
                                </span>
                            </>
                        )}
                        {lookupResult.equipment_name && (
                            <>
                                <span className="text-gray-500">Equipamento:</span>
                                <span className="font-medium truncate" title={lookupResult.equipment_name}>
                                    {lookupResult.equipment_name}
                                </span>
                            </>
                        )}
                        {lookupResult.brand && (
                            <>
                                <span className="text-gray-500">Marca:</span>
                                <span className="font-medium">{lookupResult.brand}</span>
                            </>
                        )}
                        {lookupResult.norm && (
                            <>
                                <span className="text-gray-500">Norma:</span>
                                <span className="font-medium truncate" title={lookupResult.norm}>
                                    {lookupResult.norm}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Compact Badge (when showDetails is false but we have result) */}
            {lookupResult && !loading && !showDetails && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CA_VALIDITY_COLORS[validityLevel]}`}>
                    {validityLevel === 'valid' && <CheckCircleIcon className="w-3 h-3" />}
                    {validityLevel === 'expiring' && <ExclamationTriangleIcon className="w-3 h-3" />}
                    {validityLevel === 'expired' && <XCircleIcon className="w-3 h-3" />}
                    {CA_VALIDITY_LABELS[validityLevel]}
                </span>
            )}
        </div>
    );
}
