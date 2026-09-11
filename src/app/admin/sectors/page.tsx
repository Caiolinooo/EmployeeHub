'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiShield, FiSave, FiCheck, FiX, FiSettings, FiPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { SYSTEM_MODULES, MODULE_CATEGORIES, SystemModule } from '@/constants/modules';

interface Sector {
    id: string;
    name: string;
    description?: string;
    allowed_modules: string[];
    allowed_cards: string[];
}

// Group modules helper
const groupedModules = SYSTEM_MODULES.reduce((acc, module) => {
    const cat = module.category || 'core';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(module);
    return acc;
}, {} as Record<string, SystemModule[]>);

export default function AdminSectorsPage() {
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingSector, setEditingSector] = useState<Sector | null>(null);

    // New sector modal state
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [creatingSector, setCreatingSector] = useState(false);
    const [newSectorName, setNewSectorName] = useState('');
    const [newSectorDesc, setNewSectorDesc] = useState('');
    const [newSectorModules, setNewSectorModules] = useState<string[]>([
        'dashboard', 'noticias', 'calendario', 'ponto', 'contracheque', 'reembolso'
    ]);

    const fetchSectors = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/sectors');
            if (res.ok) {
                const data = await res.json();
                setSectors(data);
            } else {
                toast.error('Falha ao carregar setores');
            }
        } catch (error) {
            console.error('Error fetching sectors:', error);
            toast.error('Erro ao carregar setores');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSectors();
    }, [fetchSectors]);

    const handleModuleToggle = (moduleId: string) => {
        if (!editingSector) return;

        const currentModules = editingSector.allowed_modules || [];
        const newModules = currentModules.includes(moduleId)
            ? currentModules.filter(m => m !== moduleId)
            : [...currentModules, moduleId];

        setEditingSector({ ...editingSector, allowed_modules: newModules });
    };

    const handleNewModuleToggle = (moduleId: string) => {
        setNewSectorModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(m => m !== moduleId)
                : [...prev, moduleId]
        );
    };

    const handleSelectAllNew = () => {
        setNewSectorModules(SYSTEM_MODULES.map(m => m.id));
    };

    const handleClearAllNew = () => {
        setNewSectorModules([]);
    };

    const handleCreateSector = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newSectorName.trim();
        if (!trimmedName) {
            toast.error('Informe o nome do setor');
            return;
        }

        try {
            setCreatingSector(true);
            const res = await fetch('/api/sectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    description: newSectorDesc.trim(),
                    allowed_modules: newSectorModules,
                    allowed_cards: []
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Erro ao criar setor');
            }

            const created = await res.json();
            toast.success(`Setor "${created.name}" criado com sucesso! Disponível no gerenciamento de usuários.`);
            setSectors(prev => [...prev, created]);
            setIsNewModalOpen(false);
            setNewSectorName('');
            setNewSectorDesc('');
            setNewSectorModules(['dashboard', 'noticias', 'calendario', 'ponto', 'contracheque', 'reembolso']);

            // Invalidate permission and sector caches
            if (typeof window !== 'undefined') {
                Object.keys(sessionStorage).forEach(key => {
                    if (key.startsWith('permissions-')) {
                        sessionStorage.removeItem(key);
                    }
                });
                window.dispatchEvent(new Event('permissions-updated'));
                window.dispatchEvent(new Event('sectors-updated'));
            }
        } catch (err: any) {
            console.error('Error creating sector:', err);
            toast.error(err.message || 'Erro ao criar setor');
        } finally {
            setCreatingSector(false);
        }
    };

    const handleSave = async () => {
        if (!editingSector) return;

        try {
            setSaving(editingSector.id);

            const res = await fetch(`/api/sectors/${editingSector.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    allowed_modules: editingSector.allowed_modules,
                    allowed_cards: editingSector.allowed_cards
                })
            });

            if (res.ok) {
                toast.success('Permissões salvas com sucesso! Os usuários verão as mudanças instantaneamente.');
                setSectors(prev => prev.map(s => s.id === editingSector.id ? editingSector : s));
                setEditingSector(null);

                // Dispatch events to force cache invalidation across the app
                if (typeof window !== 'undefined') {
                    console.log('🔄 Dispatching permission update events...');
                    // Clear all permission caches in sessionStorage
                    Object.keys(sessionStorage).forEach(key => {
                        if (key.startsWith('permissions-')) {
                            sessionStorage.removeItem(key);
                            console.log('🗑️ Cleared cache:', key);
                        }
                    });
                    window.dispatchEvent(new Event('permissions-updated'));
                    window.dispatchEvent(new Event('cards-cache-invalidated'));
                    window.dispatchEvent(new Event('sectors-updated'));
                }
            } else {
                toast.error('Falha ao salvar permissões');
            }
        } catch (error) {
            console.error('Error saving sector:', error);
            toast.error('Erro ao salvar');
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <FiShield className="w-8 h-8 text-blue-600 shrink-0" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Permissões por Setor</h1>
                        <p className="text-gray-500 text-sm">Configure quais módulos cada setor pode acessar por padrão.</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setNewSectorName('');
                        setNewSectorDesc('');
                        setNewSectorModules(['dashboard', 'noticias', 'calendario', 'ponto', 'contracheque', 'reembolso']);
                        setIsNewModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold text-sm shadow-sm hover:shadow active:scale-[0.99]"
                >
                    <FiPlus className="w-4 h-4" /> Novo Setor
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Setor</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Módulos Permitidos</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sectors.map(sector => (
                                <tr key={sector.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-800 align-top">
                                        <div className="font-semibold text-gray-900">{sector.name}</div>
                                        {sector.description && (
                                            <div className="text-xs text-gray-400 mt-0.5">{sector.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {editingSector?.id === sector.id ? (
                                            <div className="space-y-4">
                                                {Object.entries(groupedModules).map(([catKey, modules]) => (
                                                    <div key={catKey}>
                                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                            {(MODULE_CATEGORIES as any)[catKey] || catKey}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {modules.map(mod => {
                                                                const isEnabled = editingSector.allowed_modules?.includes(mod.id);
                                                                return (
                                                                    <button
                                                                        key={mod.id}
                                                                        type="button"
                                                                        onClick={() => handleModuleToggle(mod.id)}
                                                                        className={`px-2.5 py-1 text-xs rounded-full border transition-all flex items-center gap-1 ${isEnabled
                                                                            ? 'bg-blue-100 border-blue-300 text-blue-800 font-semibold shadow-xs'
                                                                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                                                            }`}
                                                                        title={mod.description}
                                                                    >
                                                                        {isEnabled ? <FiCheck className="w-3 h-3 text-blue-600 stroke-[3]" /> : <FiX className="w-3 h-3 text-gray-400" />}
                                                                        {mod.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {(sector.allowed_modules || []).length > 0 ? (
                                                    sector.allowed_modules.map(modId => {
                                                        const mod = SYSTEM_MODULES.find(m => m.id === modId);
                                                        return (
                                                            <span key={modId} className="px-2.5 py-0.5 text-xs bg-blue-50 text-blue-700 font-medium rounded-full border border-blue-100" title={mod?.description}>
                                                                {mod?.label || modId}
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-gray-400 text-sm italic">Nenhum (herda do Role)</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                        {editingSector?.id === sector.id ? (
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => setEditingSector(null)}
                                                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving === sector.id}
                                                    className="px-3.5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-semibold shadow-sm"
                                                >
                                                    <FiSave className="w-4 h-4" />
                                                    {saving === sector.id ? 'Salvando...' : 'Salvar'}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setEditingSector({ ...sector, allowed_modules: sector.allowed_modules || [], allowed_cards: sector.allowed_cards || [] })}
                                                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 font-medium ml-auto"
                                            >
                                                <FiSettings className="w-4 h-4" />
                                                Configurar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Criação de Novo Setor */}
            {isNewModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                                    <FiPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Novo Setor</h2>
                                    <p className="text-xs text-gray-500">Cadastre um setor e defina seus módulos padrão.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsNewModalOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSector} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 space-y-5 overflow-y-auto flex-1">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                        Nome do Setor <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Operações Offshore, Jurídico, Comercial..."
                                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        value={newSectorName}
                                        onChange={(e) => setNewSectorName(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                        Descrição (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Setor responsável por operações marítimas e escala"
                                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        value={newSectorDesc}
                                        onChange={(e) => setNewSectorDesc(e.target.value)}
                                    />
                                </div>

                                <div className="border-t border-gray-100 pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                Módulos Permitidos ({newSectorModules.length} selecionados)
                                            </h3>
                                            <p className="text-xs text-gray-400">Escolha quais módulos os colaboradores deste setor poderão acessar.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllNew}
                                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 hover:bg-blue-50 rounded"
                                            >
                                                Selecionar Todos
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearAllNew}
                                                className="text-xs text-gray-500 hover:text-gray-700 font-semibold px-2 py-1 hover:bg-gray-100 rounded"
                                            >
                                                Limpar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                        {Object.entries(groupedModules).map(([catKey, modules]) => (
                                            <div key={catKey}>
                                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                    {(MODULE_CATEGORIES as any)[catKey] || catKey}
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {modules.map(mod => {
                                                        const isEnabled = newSectorModules.includes(mod.id);
                                                        return (
                                                            <button
                                                                key={mod.id}
                                                                type="button"
                                                                onClick={() => handleNewModuleToggle(mod.id)}
                                                                className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1.5 ${isEnabled
                                                                    ? 'bg-blue-100 border-blue-300 text-blue-800 font-semibold shadow-xs'
                                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                                                    }`}
                                                                title={mod.description}
                                                            >
                                                                {isEnabled ? <FiCheck className="w-3 h-3 text-blue-600 stroke-[3]" /> : <FiX className="w-3 h-3 text-gray-400" />}
                                                                {mod.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-gray-50/70 flex justify-end items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsNewModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingSector}
                                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm transition-all flex items-center gap-2"
                                >
                                    {creatingSector ? 'Criando...' : 'Criar Setor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-2">Como funciona a hierarquia de permissões?</h3>
                <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                    <li><strong>Setor (Base)</strong>: Define os módulos padrão para todos os usuários pertencentes àquele setor.</li>
                    <li><strong>Role (Override 1)</strong>: ADMIN e MANAGER possuem permissões administrativas e de gestão ampliadas.</li>
                    <li><strong>Usuário (Override 2)</strong>: Permissões individuais configuradas diretamente no cadastro do usuário sobrepõem o setor e a role.</li>
                </ol>
            </div>
        </div>
    );
}
