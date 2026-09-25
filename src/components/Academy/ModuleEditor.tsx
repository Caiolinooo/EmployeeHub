'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/authUtils';
import {
    PlusIcon,
    TrashIcon,
    PencilIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    VideoCameraIcon,
    CheckIcon,
    XMarkIcon,
    BookOpenIcon
} from '@heroicons/react/24/outline';

interface Module {
    id: string;
    course_id: string;
    title: string;
    description?: string;
    video_url?: string;
    thumbnail_url?: string;
    duration: number;
    sort_order: number;
    is_published: boolean;
}

interface ModuleEditorProps {
    courseId: string;
}

const ModuleEditor: React.FC<ModuleEditorProps> = ({ courseId }) => {
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        video_url: '',
        thumbnail_url: '',
        duration: 0
    });

    useEffect(() => {
        loadModules();
    }, [courseId]);

    const loadModules = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/academy/modules?course_id=${courseId}`);
            const data = await response.json();

            if (data.success) {
                setModules(data.modules);
            }
        } catch (err) {
            console.error('Error loading modules:', err);
            setError('Erro ao carregar módulos');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ title: '', description: '', video_url: '', thumbnail_url: '', duration: 0 });
        setEditingId(null);
        setShowAddForm(false);
    };

    const handleCreate = async () => {
        if (!formData.title.trim()) {
            setError('Título do módulo é obrigatório');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetchWithAuth('/api/academy/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    course_id: courseId,
                    ...formData
                })
            });

            const data = await response.json();
            if (data.success) {
                resetForm();
                await loadModules();
            } else {
                setError(data.error || 'Erro ao criar módulo');
            }
        } catch (err) {
            setError('Erro ao criar módulo');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingId || !formData.title.trim()) return;

        setSaving(true);
        setError(null);

        try {
            const response = await fetchWithAuth('/api/academy/modules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    ...formData
                })
            });

            const data = await response.json();
            if (data.success) {
                resetForm();
                await loadModules();
            } else {
                setError(data.error || 'Erro ao atualizar módulo');
            }
        } catch (err) {
            setError('Erro ao atualizar módulo');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (moduleId: string) => {
        if (!confirm('Tem certeza que deseja excluir este módulo? Esta ação não pode ser desfeita.')) return;

        try {
            const response = await fetchWithAuth(`/api/academy/modules?id=${moduleId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                await loadModules();
            } else {
                setError(data.error || 'Erro ao excluir módulo');
            }
        } catch (err) {
            setError('Erro ao excluir módulo');
        }
    };

    const handleReorder = async (moduleId: string, direction: 'up' | 'down') => {
        const idx = modules.findIndex(m => m.id === moduleId);
        if (
            (direction === 'up' && idx === 0) ||
            (direction === 'down' && idx === modules.length - 1)
        ) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const currentOrder = modules[idx].sort_order;
        const swapOrder = modules[swapIdx].sort_order;

        try {
            await Promise.all([
                fetchWithAuth('/api/academy/modules', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: modules[idx].id, sort_order: swapOrder })
                }),
                fetchWithAuth('/api/academy/modules', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: modules[swapIdx].id, sort_order: currentOrder })
                })
            ]);
            await loadModules();
        } catch (err) {
            setError('Erro ao reordenar módulo');
        }
    };

    const startEdit = (mod: Module) => {
        setEditingId(mod.id);
        setShowAddForm(false);
        setFormData({
            title: mod.title,
            description: mod.description || '',
            video_url: mod.video_url || '',
            thumbnail_url: mod.thumbnail_url || '',
            duration: mod.duration
        });
    };

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}min`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <BookOpenIcon className="w-6 h-6 text-blue-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Módulos do Curso</h3>
                        <span className="ml-2 text-sm text-gray-500">({modules.length} módulos)</span>
                    </div>
                    {!showAddForm && !editingId && (
                        <button
                            onClick={() => { setShowAddForm(true); setEditingId(null); setFormData({ title: '', description: '', video_url: '', thumbnail_url: '', duration: 0 }); }}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4 mr-1" />
                            Adicionar Módulo
                        </button>
                    )}
                </div>

                <p className="text-sm text-gray-500">
                    Organize o conteúdo do curso em módulos sequenciais. Cada módulo pode ter seu próprio vídeo.
                    O aluno só avança ao próximo módulo após completar o anterior.
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{error}</p>
                    <button onClick={() => setError(null)} className="text-sm text-red-600 underline mt-1 max-md:min-h-11">Fechar</button>
                </div>
            )}

            {/* Add/Edit form */}
            {(showAddForm || editingId) && (
                <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">
                        {editingId ? 'Editar Módulo' : 'Novo Módulo'}
                    </h4>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: Módulo 1 - Introdução à NR-1"
                                maxLength={200}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={3}
                                placeholder="Descrição breve do conteúdo deste módulo"
                                maxLength={500}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <VideoCameraIcon className="w-4 h-4 inline mr-1" />
                                    URL do Vídeo
                                </label>
                                <input
                                    type="url"
                                    value={formData.video_url}
                                    onChange={(e) => setFormData(p => ({ ...p, video_url: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="https://drive.google.com/file/d/..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duração (segundos)</label>
                                <input
                                    type="number"
                                    value={formData.duration}
                                    onChange={(e) => setFormData(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Ex: 1800 (30 min)"
                                    min="0"
                                />
                                {formData.duration > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">= {formatDuration(formData.duration)}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 max-md:min-h-11 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                <XMarkIcon className="w-4 h-4 inline mr-1" />
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={editingId ? handleUpdate : handleCreate}
                                disabled={saving || !formData.title.trim()}
                                className="px-4 py-2 max-md:min-h-11 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                            >
                                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                                <CheckIcon className="w-4 h-4 mr-1" />
                                {editingId ? 'Salvar' : 'Criar Módulo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modules list */}
            {modules.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <BookOpenIcon className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">
                        Nenhum módulo criado ainda. Adicione módulos para estruturar o conteúdo do curso.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Cursos sem módulos funcionam com o vídeo único configurado nas informações gerais.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {modules.map((mod, index) => (
                        <div
                            key={mod.id}
                            className={`bg-white rounded-lg shadow-sm border ${editingId === mod.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'
                                } p-4 transition-all`}
                        >
                            <div className="flex items-center gap-4">
                                {/* Order number */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                                    {index + 1}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate">{mod.title}</h4>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                        {mod.duration > 0 && (
                                            <span className="flex items-center">
                                                <VideoCameraIcon className="w-3 h-3 mr-1" />
                                                {formatDuration(mod.duration)}
                                            </span>
                                        )}
                                        {mod.video_url && (
                                            <span className="text-green-600">✓ Vídeo configurado</span>
                                        )}
                                        {!mod.video_url && (
                                            <span className="text-orange-500">⚠ Sem vídeo</span>
                                        )}
                                    </div>
                                </div>

                                {/* Reorder buttons */}
                                <div className="flex-shrink-0 flex items-center gap-1">
                                    <button
                                        onClick={() => handleReorder(mod.id, 'up')}
                                        disabled={index === 0}
                                        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Mover para cima"
                                    >
                                        <ArrowUpIcon className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <button
                                        onClick={() => handleReorder(mod.id, 'down')}
                                        disabled={index === modules.length - 1}
                                        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Mover para baixo"
                                    >
                                        <ArrowDownIcon className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>

                                {/* Action buttons */}
                                <div className="flex-shrink-0 flex items-center gap-1">
                                    <button
                                        onClick={() => startEdit(mod)}
                                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                                        title="Editar módulo"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(mod.id)}
                                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                        title="Excluir módulo"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ModuleEditor;
