'use client';

import React, { useState, useEffect } from 'react';
import {
    PlusIcon,
    TrashIcon,
    PencilIcon,
    CheckIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithAuth } from '@/lib/authUtils';

interface Option {
    id?: string;
    option_text: string;
    is_correct: boolean;
}

interface Question {
    id: string;
    course_id: string;
    question_type: 'MULTIPLE_CHOICE' | 'TEXT';
    question_text: string;
    order_index: number;
    options: Option[];
}

export default function QuizEditor({ courseId }: { courseId: string }) {
    const { t } = useI18n();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formType, setFormType] = useState<'MULTIPLE_CHOICE' | 'TEXT'>('MULTIPLE_CHOICE');
    const [formText, setFormText] = useState('');
    const [formOptions, setFormOptions] = useState<Option[]>([
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false }
    ]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadQuestions();
    }, [courseId]);

    const loadQuestions = async () => {
        setLoading(true);
        try {
            const resp = await fetchWithAuth(`/api/academy/questions?course_id=${courseId}`);
            const data = await resp.json();
            if (data.success) {
                setQuestions(data.questions);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (q: Question) => {
        setEditingId(q.id);
        setFormType(q.question_type);
        setFormText(q.question_text);
        if (q.question_type === 'MULTIPLE_CHOICE') {
            setFormOptions(q.options || []);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('academy.temCertezaQueDesejaExcluirEsteItem'))) return;
        try {
            const resp = await fetchWithAuth(`/api/academy/questions?id=${id}`, {
                method: 'DELETE'
            });
            const data = await resp.json();
            if (data.success) {
                setQuestions(questions.filter(q => q.id !== id));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setFormType('MULTIPLE_CHOICE');
        setFormText('');
        setFormOptions([
            { option_text: '', is_correct: true },
            { option_text: '', is_correct: false }
        ]);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formText.trim()) return;

        if (formType === 'MULTIPLE_CHOICE') {
            const validOptions = formOptions.filter(o => o.option_text.trim() !== '');
            if (validOptions.length < 2) {
                alert("Cadastre pelo menos 2 opções.");
                return;
            }
            if (!validOptions.some(o => o.is_correct)) {
                alert("Pelo menos uma opção deve estar marcada como correta.");
                return;
            }
        }

        setSaving(true);
        try {
            const payload = {
                course_id: courseId,
                question_text: formText,
                question_type: formType,
                order_index: questions.length,
                options: formType === 'MULTIPLE_CHOICE' ? formOptions.filter(o => o.option_text.trim() !== '') : []
            };

            let resp;
            if (editingId) {
                resp = await fetchWithAuth('/api/academy/questions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingId, ...payload })
                });
            } else {
                resp = await fetchWithAuth('/api/academy/questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await resp.json();
            if (data.success) {
                loadQuestions();
                resetForm();
            } else {
                alert(data.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const addOption = () => {
        setFormOptions([...formOptions, { option_text: '', is_correct: false }]);
    };

    const removeOption = (index: number) => {
        setFormOptions(formOptions.filter((_, i) => i !== index));
    };

    const handleOptionChange = (idx: number, field: keyof Option, value: any) => {
        const newOptions = [...formOptions];
        if (field === 'is_correct' && value === true) {
            // make others false
            newOptions.forEach(o => o.is_correct = false);
        }
        newOptions[idx] = { ...newOptions[idx], [field]: value };
        setFormOptions(newOptions);
    };

    if (loading) return <div className="py-4 text-center">Carregando questões...</div>;

    return (
        <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {editingId ? 'Editar Questão' : 'Nova Questão'}
                </h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Questão</label>
                        <select
                            value={formType}
                            onChange={(e) => setFormType(e.target.value as 'MULTIPLE_CHOICE' | 'TEXT')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500"
                        >
                            <option value="MULTIPLE_CHOICE">Múltipla Escolha</option>
                            <option value="TEXT">Descursiva (Texto Livre)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enunciado</label>
                        <textarea
                            value={formText}
                            onChange={(e) => setFormText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500"
                            rows={3}
                            required
                        />
                    </div>

                    {formType === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">Opções (Marque a correta via rádio)</label>
                            {formOptions.map((opt, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        checked={opt.is_correct}
                                        onChange={() => handleOptionChange(idx, 'is_correct', true)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <input
                                        type="text"
                                        value={opt.option_text}
                                        onChange={(e) => handleOptionChange(idx, 'option_text', e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder={`Opção ${idx + 1}`}
                                        required
                                    />
                                    <button type="button" onClick={() => removeOption(idx)} className="text-red-500 hover:text-red-700 p-2">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addOption}
                                className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                            >
                                <PlusIcon className="w-4 h-4 mr-1" /> Adicionar Opção
                            </button>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4">
                        {editingId && (
                            <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                        >
                            {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Questão'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Questões do Curso ({questions.length})</h3>
                {questions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhuma questão cadastrada para este curso.</p>
                ) : (
                    <div className="space-y-4">
                        {questions.map((q, idx) => (
                            <div key={q.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">
                                            Q{idx + 1}
                                        </span>
                                        <span className="text-sm font-medium text-gray-500">
                                            {q.question_type === 'MULTIPLE_CHOICE' ? 'Múltipla Escolha' : 'Descursiva'}
                                        </span>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleEdit(q)} className="text-blue-600 hover:text-blue-800 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center">
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:text-red-800 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-900 font-medium mb-3">{q.question_text}</p>
                                {q.question_type === 'MULTIPLE_CHOICE' && (
                                    <ul className="space-y-1 pl-4 border-l-2 border-gray-200">
                                        {q.options?.map((opt, oIdx) => (
                                            <li key={opt.id || oIdx} className={`text-sm flex items-center ${opt.is_correct ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                                                {opt.is_correct ? <CheckIcon className="w-4 h-4 mr-1" /> : <XMarkIcon className="w-4 h-4 mr-1 text-gray-300" />}
                                                {opt.option_text}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
