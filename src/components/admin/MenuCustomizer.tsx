'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { UnifiedItem, unifiedDataService } from '@/lib/unifiedDataService';
import { FiX, FiSave, FiRefreshCw, FiGrid, FiSettings, FiActivity, FiLayers, FiType, FiMove, FiCheck, FiMoreVertical } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import IconSelector from '@/components/IconSelector';
import { supabase } from '@/lib/supabase';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface MenuCustomizerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Sector {
    id: string;
    name: string;
}

export default function MenuCustomizer({ isOpen, onClose }: MenuCustomizerProps) {
    const { t } = useI18n();
    const { user } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<'content' | 'appearance'>('content');
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [selectedSectorId, setSelectedSectorId] = useState<string>(''); // '' = Global
    const [items, setItems] = useState<UnifiedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
        custom_label: string;
        custom_icon: string;
        enabled: boolean;
        animation_type: 'slide' | 'fade' | 'zoom' | undefined;
    }>({
        custom_label: '',
        custom_icon: '',
        enabled: true,
        animation_type: undefined
    });

    // Load Sectors
    useEffect(() => {
        async function loadSectors() {
            if (!user) return;

            const { data } = await supabase.from('sectors').select('id, name').order('name');
            if (data) {
                setSectors(data);
            }
        }
        loadSectors();
    }, [user]);

    // Load Items on Sector Change or Open
    useEffect(() => {
        if (isOpen) {
            loadItems();
        }
    }, [isOpen, selectedSectorId]);

    const loadItems = async () => {
        setLoading(true);
        try {
            // Force reload from service with caching disabled or refresh
            unifiedDataService.clearCache();
            const loadedItems = await unifiedDataService.getItems({
                showInMenu: true,
                userSectorId: selectedSectorId || undefined
            });
            setItems(loadedItems);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: UnifiedItem) => {
        setEditingItemId(item.id);
        setEditForm({
            custom_label: item.title,
            custom_icon: item.iconName,
            enabled: item.enabled,
            animation_type: item.animation_config?.type
        });
    };

    const handleSaveItem = async () => {
        if (!editingItemId) return;

        setSaving(true);
        try {
            const itemToSave = items.find(i => i.id === editingItemId);
            if (!itemToSave) return;

            if (selectedSectorId) {
                // Override Mode
                await unifiedDataService.upsertOverride({
                    card_id: editingItemId,
                    sector_id: selectedSectorId,
                    custom_label: editForm.custom_label,
                    custom_icon: editForm.custom_icon,
                    enabled: editForm.enabled,
                    order: itemToSave.order
                });
            } else {
                // Global Mode (Update Card directly)
                const { error } = await supabase
                    .from('cards')
                    .update({
                        title: editForm.custom_label,
                        iconName: editForm.custom_icon,
                        enabled: editForm.enabled,
                        animation_config: editForm.animation_type ? { type: editForm.animation_type, duration: 0.3 } : null
                    })
                    .eq('id', editingItemId);

                if (error) throw error;

                // Refresh cache
                unifiedDataService.clearCache();
            }

            // Reload items to reflect changes
            await loadItems();
            setEditingItemId(null); // Close editor on success
        } catch (error) {
            console.error('Error saving item:', error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 h-full w-[400px] bg-white shadow-2xl flex flex-col border-l border-gray-100"
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 bg-white z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FiSettings className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-gray-800">Personalizar Menu</span>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-50 transition-colors" aria-label="Fechar">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
                    {/* Sector Selector */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                            Contexto de Edição
                        </label>
                        <select
                            value={selectedSectorId}
                            onChange={(e) => setSelectedSectorId(e.target.value)}
                            className="w-full h-10 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm cursor-pointer"
                        >
                            <option value="">Global (Padrão)</option>
                            {sectors.map(s => (
                                <option key={s.id} value={s.id}>Setor: {s.name}</option>
                            ))}
                        </select>
                        {selectedSectorId && (
                            <p className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-1">
                                <FiActivity className="w-3 h-3" />
                                Editando overrides para {sectors.find(s => s.id === selectedSectorId)?.name}
                            </p>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 bg-gray-200/50 rounded-lg">
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'content' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Itens e Ícones
                        </button>
                        <button
                            onClick={() => setActiveTab('appearance')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'appearance' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Animações
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50/30 p-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <FiRefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${editingItemId === item.id ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-gray-200 hover:border-blue-200 hover:shadow-sm'}`}
                                >
                                    {/* Item Header / Preview */}
                                    <div
                                        className="p-3 flex items-center gap-3 cursor-pointer select-none"
                                        onClick={() => {
                                            setEditingItemId(editingItemId === item.id ? null : item.id);
                                            if (editingItemId !== item.id) {
                                                // Correctly initialize form from item
                                                setEditForm({
                                                    custom_label: item.title,
                                                    custom_icon: item.iconName,
                                                    enabled: item.enabled,
                                                    animation_type: item.animation_config?.type
                                                });
                                            }
                                        }}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${item.enabled ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-300'}`}>
                                            <FiGrid className="w-4 h-4" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-sm font-medium truncate ${item.enabled ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                                                {item.title}
                                            </h4>
                                            {item.animation_config?.type && (
                                                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100 block w-fit mt-1">
                                                    {item.animation_config.type}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-gray-300">
                                            {editingItemId === item.id ? <FiCheck className="w-4 h-4 text-blue-500" /> : <FiMoreVertical className="w-4 h-4" />}
                                        </div>
                                    </div>

                                    {/* Editor Panel */}
                                    <AnimatePresence>
                                        {editingItemId === item.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-gray-100 bg-gray-50/50"
                                            >
                                                <div className="p-4 space-y-4">
                                                    {activeTab === 'content' ? (
                                                        <>
                                                            {/* Content Tab Fields */}
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] uppercase font-bold text-gray-400">Nome do Item</label>
                                                                <div className="relative">
                                                                    <FiType className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                                                    <input
                                                                        type="text"
                                                                        value={editForm.custom_label}
                                                                        onChange={(e) => setEditForm({ ...editForm, custom_label: e.target.value })}
                                                                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none"
                                                                        placeholder="Ex: Meu Painel"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <label className="text-[10px] uppercase font-bold text-gray-400">Ícone</label>
                                                                <div className="bg-white p-2 rounded-lg border border-gray-200">
                                                                    <IconSelector
                                                                        selectedIcon={editForm.custom_icon}
                                                                        onIconChange={(name) => setEditForm({ ...editForm, custom_icon: name })}
                                                                        allowCustomUpload={false}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* Appearance Tab Fields */}
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] uppercase font-bold text-gray-400">Animação de Entrada</label>
                                                                <select
                                                                    value={editForm.animation_type || ''}
                                                                    onChange={(e) => setEditForm({ ...editForm, animation_type: e.target.value as any })}
                                                                    className="w-full p-2 text-sm rounded-lg border border-gray-200 bg-white"
                                                                >
                                                                    <option value="">Nenhuma</option>
                                                                    <option value="fade">Fade In</option>
                                                                    <option value="slide">Slide In</option>
                                                                    <option value="zoom">Zoom In</option>
                                                                </select>
                                                            </div>
                                                            <div className="p-2 bg-yellow-50 text-yellow-700 text-[10px] rounded border border-yellow-100">
                                                                Nota: Animações são atualmente aplicadas globalmente e requerem suporte no banco de dados para salvamento.
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Visibility & Actions */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={editForm.enabled}
                                                                onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
                                                                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-gray-600">Visível no Menu</span>
                                                        </label>

                                                        <button
                                                            onClick={handleSaveItem}
                                                            disabled={saving}
                                                            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
                                                            Salvar
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </motion.div>
        </div>
    );
}
