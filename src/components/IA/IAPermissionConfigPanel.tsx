'use client';

import React, { useEffect, useState } from 'react';
import {
  getAllModuleConfigs,
  updateModuleConfig,
  getMicrosoftWritePermissions,
  updateMicrosoftWritePermissions
} from '@/lib/ia/config/manager';
import { MS_GRAPH_CATEGORIES, getCategoriesWithStatus } from '@/lib/ia/microsoft/permissions-registry';
import type { IAModuleConfig, IAWritePermissions } from '@/types/ia-global';

interface ConfigPanelProps {
  token: string;
}

export default function IAPermissionConfigPanel({ token }: ConfigPanelProps) {
  const [modules, setModules] = useState<IAModuleConfig[]>([]);
  const [msPermissions, setMsPermissions] = useState<IAWritePermissions['microsoft']>({
    mail: false, calendar: false, contacts: false, users: false,
    groups: false, directory: false, teams: false, chat: false,
    calls: false, files: false, notes: false, tasks: false,
    security: false, audit: false, identity: false, applications: false,
    devices: false, compliance: false, bookings: false, notifications: false,
    synchronization: false, copilot: false, backup: false, network: false,
    management_apis: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    try {
      const configs = await getAllModuleConfigs();
      setModules(Array.isArray(configs) ? configs : []);
      const msPerms = await getMicrosoftWritePermissions();
      setMsPermissions(msPerms);
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleToggle = async (moduleKey: string, field: 'allowWrite' | 'allowRead', value: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const moduleDef = modules.find(m => m.key === moduleKey);
      if (!moduleDef) return;

      await updateModuleConfig(moduleKey, {
        ...moduleDef,
        [field]: value,
      });

      await loadConfigs();
      setMessage({ type: 'success', text: 'Configuração salva!' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = async (moduleKey: string, role: string, checked: boolean) => {
    setSaving(true);
    setMessage(null);

    try {
      const moduleDef = modules.find(m => m.key === moduleKey);
      if (!moduleDef) return;

      let newRoles = [...moduleDef.writeRoles];
      if (checked) {
        if (!newRoles.includes(role as any)) newRoles.push(role as any);
      } else {
        newRoles = newRoles.filter(r => r !== role);
      }

      await updateModuleConfig(moduleKey, {
        writeRoles: newRoles,
      });

      await loadConfigs();
      setMessage({ type: 'success', text: 'Roles atualizados!' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleMsPermissionToggle = async (catKey: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const key = catKey as keyof typeof msPermissions;
      const newPerms = { ...msPermissions, [key]: !msPermissions[key] };
      await updateMicrosoftWritePermissions(newPerms);
      setMsPermissions(newPerms);
      setMessage({ type: 'success', text: 'Permissão Microsoft atualizada!' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const categories = getCategoriesWithStatus();
  const totalGranted = categories.reduce((a, c) => a + c.grantedCount, 0);
  const totalScopes = categories.reduce((a, c) => a + c.totalScopes, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚡</span> Permissões do Agente IA
          </h2>
          <p className="text-purple-100 text-sm mt-1">
            Configure quais ações o assistente pode executar em cada módulo
          </p>
        </div>

        <div className="p-6 space-y-8">
          {message && (
            <div className={`text-sm px-4 py-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}

          {/* Módulos Internos */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Permissões por Módulo</h3>
            <div className="grid gap-4">
              {modules.filter(m => m.key !== 'admin' && m.key !== 'microsoft').map(module => (
                <div key={module.key} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{module.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{module.name}</h4>
                        <p className="text-sm text-gray-500">{module.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-sm text-gray-600">Leitura</span>
                        <input
                          type="checkbox"
                          checked={module.allowRead}
                          onChange={(e) => handleModuleToggle(module.key, 'allowRead', e.target.checked)}
                          disabled={saving}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-sm text-gray-600">Escrita</span>
                        <input
                          type="checkbox"
                          checked={module.allowWrite}
                          onChange={(e) => handleModuleToggle(module.key, 'allowWrite', e.target.checked)}
                          disabled={saving}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                      </label>
                    </div>
                  </div>

                  {module.allowWrite && (
                    <div className="pl-12 flex items-center gap-4">
                      <span className="text-sm text-gray-500">Roles com acesso:</span>
                      {['ADMIN', 'GERENTE', 'USER'].map(role => (
                        <label key={role} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={module.writeRoles.includes(role as any)}
                            onChange={(e) => handleRoleToggle(module.key, role, e.target.checked)}
                            disabled={saving}
                            className="w-3 h-3 text-purple-600 rounded"
                          />
                          <span className="text-sm text-gray-600">{role}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Microsoft Graph - 25 Categorias */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Microsoft Graph API — Permissões por Categoria</h3>
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full border border-blue-200">
                  {totalGranted} / {totalScopes} escopos concedidos
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {categories.map(cat => {
                const isExpanded = expandedCategory === cat.key;
                const permKey = cat.key as keyof typeof msPermissions;
                const isEnabled = msPermissions[permKey] ?? false;
                return (
                  <div key={cat.key} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl">{cat.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{cat.name}</h4>
                            {cat.hasAnyGranted ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">{cat.fullyGranted ? '✅ Totalmente concedido' : `${cat.grantedCount}/${cat.totalScopes} concedidos`}</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">⏳ Pendente consent</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{cat.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Toggle Escrita */}
                        <label
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs text-gray-500">Escrita IA</span>
                          <div
                            onClick={() => handleMsPermissionToggle(cat.key)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              isEnabled ? 'bg-purple-600' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                          </div>
                        </label>
                        {/* Chevron */}
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {/* Expanded: lista de escopos */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-200">
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1">
                          {cat.grantedScopes.map(scope => (
                            <div key={scope} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-green-50">
                              <span className="text-green-500">✓</span>
                              <span className="text-gray-700 font-mono text-xs">{scope}</span>
                            </div>
                          ))}
                          {cat.pendingScopes.map(scope => (
                            <div key={scope} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-orange-50">
                              <span className="text-orange-400">○</span>
                              <span className="text-gray-500 font-mono text-xs">{scope}</span>
                            </div>
                          ))}
                        </div>
                        {cat.pendingScopes.length > 0 && (
                          <p className="text-xs text-gray-400 mt-2 italic">Escopos com ○ precisam de consentimento de administrador no Azure AD para funcionar.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <span className="text-sm text-gray-400">{saving ? 'Salvando...' : 'Alterações aplicadas automaticamente'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
