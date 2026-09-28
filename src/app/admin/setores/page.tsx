'use client';

import React, { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { FiPlus, FiEdit2, FiTrash2, FiGrid, FiCheck, FiX, FiSearch } from 'react-icons/fi';
import { Sector } from '@/types/index';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from 'react-hot-toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

export default function SectorsPage() {
    const { user } = useSupabaseAuth();
    const [loading, setLoading] = useState(true);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [modules, setModules] = useState<any[]>([]); // Cards/Modules from Supabase
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModulesModalOpen, setIsModulesModalOpen] = useState(false);
    const [editingSector, setEditingSector] = useState<Sector | null>(null);
    const [selectedModules, setSelectedModules] = useState<string[]>([]);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSectors();
        fetchModules();
    }, []);

    const fetchSectors = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('sectors')
                .select('*')
                .order('name');

            if (error) throw error;
            setSectors(data || []);
        } catch (error) {
            console.error('Error fetching sectors:', error);
            toast.error('Erro ao carregar setores');
        } finally {
            setLoading(false);
        }
    };

    const fetchModules = async () => {
        try {
            const { data, error } = await supabase
                .from('cards')
                .select('*')
                .eq('enabled', true)
                .order('title');

            if (error) throw error;
            setModules(data || []);
        } catch (error) {
            console.error('Error fetching modules:', error);
        }
    };

    const fetchSectorModules = async (sectorId: string) => {
        try {
            const { data, error } = await supabase
                .from('sector_modules')
                .select('module_id')
                .eq('sector_id', sectorId);

            if (error) throw error;
            setSelectedModules(data.map(m => m.module_id));
        } catch (error) {
            console.error('Error fetching sector modules:', error);
        }
    };

    const handleSaveSector = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            if (editingSector) {
                const { error } = await supabase
                    .from('sectors')
                    .update({
                        name: formData.name,
                        description: formData.description,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingSector.id);

                if (error) throw error;
                toast.success('Setor atualizado com sucesso');
            } else {
                const { error } = await supabase
                    .from('sectors')
                    .insert({
                        name: formData.name,
                        description: formData.description
                    });

                if (error) throw error;
                toast.success('Setor criado com sucesso');
            }

            setIsModalOpen(false);
            resetForm();
            fetchSectors();
        } catch (error) {
            console.error('Error saving sector:', error);
            toast.error('Erro ao salvar setor');
        }
    };

    const handleDeleteSector = async () => {
        if (!deleteId) return;
        try {
            const { error } = await supabase
                .from('sectors')
                .delete()
                .eq('id', deleteId);

            if (error) throw error;
            toast.success('Setor removido com sucesso');
            fetchSectors();
        } catch (error) {
            console.error('Error deleting sector:', error);
            toast.error('Erro ao remover setor');
        } finally {
            setDeleteId(null);
        }
    };

    const handleSaveModules = async () => {
        if (!editingSector) return;

        try {
            // First, delete all existing modules for this sector
            const { error: deleteError } = await supabase
                .from('sector_modules')
                .delete()
                .eq('sector_id', editingSector.id);

            if (deleteError) throw deleteError;

            // Then insert selected modules
            if (selectedModules.length > 0) {
                const insertData = selectedModules.map(moduleId => ({
                    sector_id: editingSector.id,
                    module_id: moduleId
                }));

                const { error: insertError } = await supabase
                    .from('sector_modules')
                    .insert(insertData);

                if (insertError) throw insertError;
            }

            toast.success('Permissões de módulos atualizadas');
            setIsModulesModalOpen(false);
        } catch (error) {
            console.error('Error saving sector modules:', error);
            toast.error('Erro ao atualizar permissões');
        }
    };

    const openEditModal = (sector: Sector) => {
        setEditingSector(sector);
        setFormData({ name: sector.name, description: sector.description || '' });
        setIsModalOpen(true);
    };

    const openModulesModal = async (sector: Sector) => {
        setEditingSector(sector);
        await fetchSectorModules(sector.id);
        setIsModulesModalOpen(true);
    };

    const resetForm = () => {
        setEditingSector(null);
        setFormData({ name: '', description: '' });
    };

    const toggleModule = (moduleId: string) => {
        setSelectedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        );
    };

    const filteredSectors = sectors.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex-1 p-6">
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Setores</h1>
                        <p className="text-gray-600">Crie setores e defina quais módulos eles podem acessar.</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors"
                    >
                        <FiPlus className="mr-2" /> Novo Setor
                    </button>
                </div>

                {/* Search */}
                <div className="mb-6 relative">
                    <input
                        type="text"
                        placeholder="Buscar setores..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-abz-blue focus:border-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <FiSearch className="absolute left-3 top-3 text-gray-400" />
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSectors.map((sector) => (
                            <div key={sector.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">{sector.name}</h3>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => openEditModal(sector)}
                                            className="text-gray-400 hover:text-abz-blue transition-colors"
                                            title="Editar"
                                        >
                                            <FiEdit2 size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            data-confirm-trigger="sector"
                                            onClick={() => setDeleteId(sector.id)}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                            title="Excluir"
                                        >
                                            <FiTrash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500 mb-6 min-h-[40px]">
                                    {sector.description || 'Sem descrição'}
                                </p>

                                <button
                                    onClick={() => openModulesModal(sector)}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-abz-blue text-abz-blue rounded-md hover:bg-abz-light-blue transition-colors"
                                >
                                    <FiGrid className="mr-2" /> Gerenciar Módulos
                                </button>
                            </div>
                        ))}

                        {filteredSectors.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                Nenhum setor encontrado.
                            </div>
                        )}
                    </div>
                )}

                {/* Modal de Criação/Edição */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                            <div className="p-6 border-b flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {editingSector ? 'Editar Setor' : 'Novo Setor'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <FiX size={24} />
                                </button>
                            </div>
                            <form onSubmit={handleSaveSector} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Setor</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border rounded-md focus:ring-abz-blue focus:border-abz-blue"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                    <textarea
                                        className="w-full px-3 py-2 border rounded-md focus:ring-abz-blue focus:border-abz-blue"
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-white bg-abz-blue rounded-md hover:bg-abz-blue-dark"
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal de Módulos */}
                {isModulesModalOpen && editingSector && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[80vh] flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800">Permissões de Módulos</h2>
                                    <p className="text-sm text-gray-500">Defina quais módulos o setor <strong>{editingSector.name}</strong> pode acessar.</p>
                                </div>
                                <button onClick={() => setIsModulesModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <FiX size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {modules.map((module) => {
                                        const isSelected = selectedModules.includes(module.id);
                                        return (
                                            <div
                                                key={module.id}
                                                onClick={() => toggleModule(module.id)}
                                                className={`
                            cursor-pointer rounded-lg border p-4 transition-all relative overflow-hidden group
                            ${isSelected
                                                        ? 'bg-white border-abz-blue ring-1 ring-abz-blue shadow-md'
                                                        : 'bg-white border-gray-200 hover:border-abz-blue hover:shadow-sm opacity-80 hover:opacity-100'}
                          `}
                                            >
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-abz-blue text-white rounded-full flex items-center justify-center shadow-sm z-10">
                                                        <FiCheck size={14} />
                                                    </div>
                                                )}
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${isSelected ? 'bg-abz-light-blue text-abz-blue' : 'bg-gray-100 text-gray-500'}`}>
                                                        <FiGrid />
                                                    </div>
                                                    <h4 className={`font-medium ${isSelected ? 'text-abz-blue-dark' : 'text-gray-700'}`}>{module.title}</h4>
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-2">{module.description || 'Sem descrição'}</p>
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {module.adminOnly && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Admin</span>}
                                                    {module.managerOnly && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Gerente</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-6 border-t bg-white rounded-b-lg flex justify-between items-center">
                                <div className="text-sm text-gray-500">
                                    {selectedModules.length} módulos selecionados
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => setIsModulesModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveModules}
                                        className="px-4 py-2 text-white bg-abz-blue rounded-md hover:bg-abz-blue-dark shadow-sm"
                                    >
                                        Salvar Permissões
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmationModal
                    isOpen={!!deleteId}
                    onClose={() => setDeleteId(null)}
                    onConfirm={handleDeleteSector}
                    title="Excluir Setor"
                    message="Tem certeza que deseja excluir este setor? Usuários vinculados perderão o vínculo e as permissões associadas."
                    confirmText="Excluir"
                    cancelText="Cancelar"
                    isDestructive={true}
                />
            </div>
        </div>
    );
}
