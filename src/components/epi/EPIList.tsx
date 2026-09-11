'use client';

import React from 'react';
import { FiTrash2, FiEye } from 'react-icons/fi';
import { EPIRegistration, EPI_STATUS_LABELS, EPI_STATUS_COLORS, getCAValidityLevel, CA_VALIDITY_COLORS, CA_VALIDITY_LABELS } from '@/types/epi';
import EPIStatusBadge from './EPIStatusBadge';

interface EPIListProps {
    registrations: EPIRegistration[];
    onCancel?: (id: string) => Promise<void>;
    showActions?: boolean;
    showHistory?: boolean;
}

export default function EPIList({ registrations, onCancel, showActions = true, showHistory = false }: EPIListProps) {
    if (registrations.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Nenhum registro encontrado</h3>
                <p className="mt-2 text-sm text-gray-500">
                    {showHistory
                        ? 'Não há histórico de solicitações de EPI.'
                        : 'Você ainda não possui equipamentos de proteção individual registrados.'}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Equipamento
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Quantidade
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                CA
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Validade
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Solicitado em
                            </th>
                            {showActions && (
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {registrations.map((registration: any) => (
                            <tr key={registration.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                        {registration.equipment_type}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-xs">{registration.reason}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{registration.quantity}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{registration.equipment_ca || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {registration.validity_date ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CA_VALIDITY_COLORS[getCAValidityLevel(registration.validity_date, registration.ca_status)]}`}>
                                            {new Date(registration.validity_date).toLocaleDateString('pt-BR')}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <EPIStatusBadge status={registration.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">
                                        {new Date(registration.created_at).toLocaleDateString('pt-BR')}
                                    </div>
                                </td>
                                {showActions && (
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {registration.status === 'pending' && onCancel && (
                                            <button
                                                onClick={() => onCancel(registration.id)}
                                                className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                                Cancelar
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="block md:hidden space-y-4">
                {registrations.map((registration: any) => (
                    <div key={registration.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-3">
                            <div className="pr-4">
                                <h4 className="text-sm font-bold text-gray-900">{registration.equipment_type}</h4>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{registration.reason}</p>
                            </div>
                            <div className="shrink-0">
                                <EPIStatusBadge status={registration.status} />
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3 mb-3 text-sm">
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5 font-medium uppercase tracking-wider">Qtd</p>
                                <p className="font-semibold text-gray-900">{registration.quantity}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5 font-medium uppercase tracking-wider">CA</p>
                                <p className="font-semibold text-gray-900">{registration.equipment_ca || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5 font-medium uppercase tracking-wider">Validade</p>
                                {registration.validity_date ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${CA_VALIDITY_COLORS[getCAValidityLevel(registration.validity_date, registration.ca_status)]}`}>
                                        {new Date(registration.validity_date).toLocaleDateString('pt-BR')}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 font-medium">-</span>
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5 font-medium uppercase tracking-wider">Data</p>
                                <p className="text-gray-900 font-semibold text-xs">
                                    {new Date(registration.created_at).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        </div>

                        {showActions && registration.status === 'pending' && onCancel && (
                            <div className="pt-3 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => onCancel(registration.id)}
                                    className="text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition-colors w-full justify-center"
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                    Cancelar Solicitação
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
