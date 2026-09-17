'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithAuth } from '@/lib/authUtils';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface PendingAttempt {
    id: string;
    course_id: string;
    created_at: string;
    enrollment: {
        id: string;
        user: {
            first_name: string;
            last_name: string;
            email: string;
        };
    };
    answers: {
        id: string;
        text_answer: string;
        score_awarded: number;
        question: {
            id: string;
            question_text: string;
            question_type: string;
        };
    }[];
}

export default function PendingAssessments({ courseId }: { courseId: string }) {
    const { t } = useI18n();
    const [attempts, setAttempts] = useState<PendingAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [gradingId, setGradingId] = useState<string | null>(null);
    const [grades, setGrades] = useState<{ [key: string]: { score_awarded: number, is_correct: boolean } }>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPending();
    }, [courseId]);

    const loadPending = async () => {
        setLoading(true);
        try {
            const resp = await fetchWithAuth(`/api/academy/assessments/pending?course_id=${courseId}`);
            const data = await resp.json();
            if (data.success) {
                setAttempts(data.attempts || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const startGrading = (attempt: PendingAttempt) => {
        setGradingId(attempt.id);
        const initialGrades: any = {};
        attempt.answers.forEach(ans => {
            if (ans.question.question_type === 'TEXT') {
                initialGrades[ans.id] = { score_awarded: 0, is_correct: false };
            }
        });
        setGrades(initialGrades);
    };

    const handleGradeChange = (answerId: string, isCorrect: boolean) => {
        setGrades(prev => ({
            ...prev,
            [answerId]: {
                score_awarded: isCorrect ? 10 : 0,
                is_correct: isCorrect
            }
        }));
    };

    const submitGrades = async () => {
        if (!gradingId) return;
        setSaving(true);
        try {
            const gradesArray = Object.keys(grades).map(ansId => ({
                answer_id: ansId,
                ...grades[ansId]
            }));

            const resp = await fetchWithAuth('/api/academy/assessments/pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attempt_id: gradingId,
                    grades: gradesArray
                })
            });

            const data = await resp.json();
            if (data.success) {
                alert(data.isPassed ? 'Aprovado! Certificado gerado.' : 'Reprovado. O aluno deverá refazer o teste.');
                setGradingId(null);
                loadPending(); // refresh list
            } else {
                alert(data.error || 'Erro ao salvar avaliação.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro inesperado.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-4 text-center text-gray-500">Buscando avaliações pendentes...</div>;

    if (attempts.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Tudo limpo!</h3>
                <p className="text-gray-500 mt-2">Não há avaliações pendentes de correção para este curso.</p>
            </div>
        );
    }

    const activeAttempt = attempts.find(a => a.id === gradingId);

    return (
        <div className="space-y-6">
            {!gradingId ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="table-responsive">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aluno</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {attempts.map(attempt => (
                                <tr key={attempt.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {attempt.enrollment.user.first_name} {attempt.enrollment.user.last_name}
                                        </div>
                                        <div className="text-sm text-gray-500">{attempt.enrollment.user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(attempt.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => startGrading(attempt)}
                                            className="tap-target inline-flex items-center px-3 text-blue-600 hover:text-blue-900"
                                        >
                                            Avaliar Respostas
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            ) : (
                activeAttempt && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Avaliando: {activeAttempt.enrollment.user.first_name} {activeAttempt.enrollment.user.last_name}
                                </h3>
                                <p className="text-sm text-gray-500">Enviado em {new Date(activeAttempt.created_at).toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={() => setGradingId(null)}
                                className="tap-target inline-flex items-center justify-center px-3 text-sm text-gray-500 hover:text-gray-700 self-start sm:self-auto"
                            >
                                Voltar à Lista
                            </button>
                        </div>

                        <div className="space-y-8">
                            {activeAttempt.answers.filter(a => a.question.question_type === 'TEXT').map((ans, idx) => (
                                <div key={ans.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <p className="font-medium text-gray-900 mb-2">Q{idx + 1}. {ans.question.question_text}</p>
                                    <div className="bg-white p-3 rounded border border-gray-200 mb-4 whitespace-pre-wrap text-gray-700">
                                        {ans.text_answer || <span className="text-gray-400 italic">Nenhuma resposta em texto fornecida.</span>}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <span className="text-sm font-medium text-gray-700">Avaliação:</span>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`grade-${ans.id}`}
                                                checked={grades[ans.id]?.is_correct === true}
                                                onChange={() => handleGradeChange(ans.id, true)}
                                                className="text-green-600 focus:ring-green-500"
                                            />
                                            <span className="text-green-700 font-medium flex items-center"><CheckCircleIcon className="w-4 h-4 mr-1" /> Correto</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`grade-${ans.id}`}
                                                checked={grades[ans.id]?.is_correct === false}
                                                onChange={() => handleGradeChange(ans.id, false)}
                                                className="text-red-600 focus:ring-red-500"
                                            />
                                            <span className="text-red-700 font-medium flex items-center"><XCircleIcon className="w-4 h-4 mr-1" /> Incorreto</span>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-end pb-safe">
                            <button
                                onClick={submitGrades}
                                disabled={saving}
                                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? 'Processando...' : 'Salvar Avaliação e Concluir'}
                            </button>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
