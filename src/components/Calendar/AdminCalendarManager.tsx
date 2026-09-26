'use client';

import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from 'react-hot-toast';
import { fetchWithToken } from '@/lib/tokenStorage';

interface NewEventState {
    summary: string;
    description: string;
    start: string;
    end: string;
    location: string;
    attendees: string;
}

const AdminCalendarManager: React.FC<{ onEventCreated?: () => void }> = ({ onEventCreated }) => {
    const { user } = useSupabaseAuth();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [newEvent, setNewEvent] = useState<NewEventState>({
        summary: '',
        description: '',
        start: '',
        end: '',
        location: '',
        attendees: ''
    });

    // Basic check for admin/permission - can be refined based on actual role system
    // For now, assuming if they can see the page and are logged in, we might check a specific claim or just show the button and let the API reject if unauthorized.
    // But ideally we check `user.role` or `user.app_metadata.claims_admin`.
    // Let's assume valid user for MVP of the feature.

    const handleCreateEvent = async () => {
        if (!newEvent.summary || !newEvent.start || !newEvent.end) {
            toast.error('Preencha os campos obrigatórios (Título, Início, Fim)');
            return;
        }

        try {
            setLoading(true);

            if (!user?.id) {
                toast.error('Sessão expirada. Faça login novamente.');
                return;
            }

            const eventBody = {
                userId: user.id,
                summary: newEvent.summary,
                description: newEvent.description,
                location: newEvent.location,
                start: new Date(newEvent.start).toISOString(),
                end: new Date(newEvent.end).toISOString(),
                attendees: newEvent.attendees
                    ? newEvent.attendees.split(',').map(email => email.trim()).filter(email => email)
                    : [],
            };

            const response = await fetchWithToken('/api/calendar/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventBody)
            });

            if (response.status === 401) {
                toast.error('Sessão expirada. Faça login novamente.');
                return;
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao criar evento');
            }

            toast.success('Evento criado com sucesso!');
            setShowModal(false);
            setNewEvent({
                summary: '',
                description: '',
                start: '',
                end: '',
                location: '',
                attendees: ''
            });
            if (onEventCreated) onEventCreated();

        } catch (error) {
            console.error('Erro ao criar evento:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao criar evento');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50 flex items-center gap-2"
                title="Adicionar Evento ao Calendário da Empresa"
            >
                <PlusIcon className="w-6 h-6" />
                <span className="hidden md:inline font-medium">Novo Evento</span>
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Novo Evento Corporativo</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                                <input
                                    type="text"
                                    value={newEvent.summary}
                                    onChange={e => setNewEvent({ ...newEvent, summary: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Reunião Geral..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
                                    <input
                                        type="datetime-local"
                                        value={newEvent.start}
                                        onChange={e => setNewEvent({ ...newEvent, start: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim *</label>
                                    <input
                                        type="datetime-local"
                                        value={newEvent.end}
                                        onChange={e => setNewEvent({ ...newEvent, end: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                                <input
                                    type="text"
                                    value={newEvent.location}
                                    onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Sala de Reuniões 1..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={3}
                                    placeholder="Detalhes do evento..."
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                                disabled={loading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateEvent}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Salvando...' : 'Criar Evento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminCalendarManager;
