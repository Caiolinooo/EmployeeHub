'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  PlusIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSiteConfig } from '@/contexts/SiteConfigContext';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    responseStatus: string;
  }>;
  creator: {
    email: string;
    displayName: string;
  };
  organizer: {
    email: string;
    displayName: string;
  };
}

const GoogleCalendarIntegration: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { config } = useSiteConfig();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    summary: '',
    description: '',
    start: '',
    end: '',
    location: '',
    attendees: ''
  });

  useEffect(() => {
    checkAuthStatus();
    if (user?.id) {
      loadEvents();
    }
  }, [user]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/calendar/auth?action=status');
      const data = await response.json();
      setAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Erro ao verificar status de autenticação:', error);
    }
  };

  const loadEvents = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30);

      const params = new URLSearchParams({
        userId: user.id,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: '50'
      });

      const response = await fetch(`/api/calendar/events?${params}`);
      const data = await response.json();

      if (response.ok) {
        setEvents(data.events);
        setAuthenticated(true);
      } else if (data.needsAuth) {
        setAuthenticated(false);
      } else {
        console.error('Erro ao carregar eventos:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    try {
      const response = await fetch('/api/calendar/auth?action=url');
      const data = await response.json();
      
      if (response.ok) {
        setAuthUrl(data.authUrl);
        // Abrir em nova janela
        window.open(data.authUrl, 'google-auth', 'width=500,height=600');
      }
    } catch (error) {
      console.error('Erro ao obter URL de autenticação:', error);
    }
  };

  const handleCreateEvent = async () => {
    if (!user?.id || !newEvent.summary || !newEvent.start || !newEvent.end) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const attendeesList = newEvent.attendees
        ? newEvent.attendees.split(',').map(email => email.trim()).filter(email => email)
        : [];

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          summary: newEvent.summary,
          description: newEvent.description,
          start: newEvent.start,
          end: newEvent.end,
          location: newEvent.location,
          attendees: attendeesList
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Evento criado com sucesso!');
        setShowCreateEvent(false);
        setNewEvent({
          summary: '',
          description: '',
          start: '',
          end: '',
          location: '',
          attendees: ''
        });
        loadEvents();
      } else {
        alert(data.error || 'Erro ao criar evento');
      }
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      alert('Erro ao criar evento');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h${diffMinutes > 0 ? ` ${diffMinutes}min` : ''}`;
    }
    return `${diffMinutes}min`;
  };

  const getResponseStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'tentative':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getResponseStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Confirmado';
      case 'declined':
        return 'Recusado';
      case 'tentative':
        return 'Tentativo';
      default:
        return 'Pendente';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Carregando calendário...</span>
      </div>
    );
  }

  // Verificar se as credenciais do Google estão configuradas
  const isGoogleConfigured = config.googleClientId && config.googleClientSecret;

  if (!isGoogleConfigured) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Integração com Google Calendar
          </h3>
          <p className="text-gray-600 mb-6">
            A integração com Google Calendar não está configurada. Entre em contato com o administrador do sistema.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Para administradores:</strong> Configure as credenciais do Google Calendar nas configurações do sistema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Integração com Google Calendar
          </h3>
          <p className="text-gray-600 mb-6">
            Conecte com o Google Calendar da empresa para sincronizar eventos e compromissos.
          </p>
          <button
            onClick={handleAuth}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center mx-auto"
          >
            <Cog6ToothIcon className="w-5 h-5 mr-2" />
            Conectar Google Calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendário</h2>
          <p className="text-gray-600">Seus próximos compromissos</p>
        </div>
        <button
          onClick={() => setShowCreateEvent(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Novo Evento
        </button>
      </div>

      {/* Aviso de Simulação */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2" />
          <p className="text-sm text-yellow-800">
            <strong>Modo de Demonstração:</strong> Esta é uma simulação da integração com Google Calendar. 
            Os eventos mostrados são fictícios para demonstrar a funcionalidade.
          </p>
        </div>
      </div>

      {/* Lista de Eventos */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum evento encontrado</h3>
            <p className="text-gray-600">Você não tem eventos programados para os próximos 30 dias.</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {event.summary}
                  </h3>
                  
                  {event.description && (
                    <p className="text-gray-600 mb-3">{event.description}</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <ClockIcon className="w-4 h-4 mr-2" />
                      <span>
                        {formatDate(event.start.dateTime)} - {formatTime(event.end.dateTime)}
                      </span>
                      <span className="ml-2 text-gray-400">
                        ({getEventDuration(event.start.dateTime, event.end.dateTime)})
                      </span>
                    </div>

                    {event.location && (
                      <div className="flex items-center">
                        <MapPinIcon className="w-4 h-4 mr-2" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    <div className="flex items-center">
                      <UserGroupIcon className="w-4 h-4 mr-2" />
                      <span>Organizado por {event.organizer.displayName}</span>
                    </div>

                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center">
                        <UserGroupIcon className="w-4 h-4 mr-2" />
                        <span>{event.attendees.length} participante(s)</span>
                      </div>
                    )}
                  </div>

                  {/* Status de Participação */}
                  {event.attendees && event.attendees.some(a => a.email === user?.email) && (
                    <div className="mt-3">
                      {event.attendees
                        .filter(a => a.email === user?.email)
                        .map((attendee, index) => (
                          <span
                            key={index}
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getResponseStatusColor(attendee.responseStatus)}`}
                          >
                            Sua resposta: {getResponseStatusText(attendee.responseStatus)}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criar Evento */}
      {showCreateEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Criar Novo Evento</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={newEvent.summary}
                  onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Título do evento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Descrição do evento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Início *
                  </label>
                  <input
                    type="datetime-local"
                    value={newEvent.start}
                    onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fim *
                  </label>
                  <input
                    type="datetime-local"
                    value={newEvent.end}
                    onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Local
                </label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Local do evento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Participantes
                </label>
                <input
                  type="text"
                  value={newEvent.attendees}
                  onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="E-mails separados por vírgula"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateEvent}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Criar Evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendarIntegration;
