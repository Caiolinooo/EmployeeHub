'use client';

import React, { useState } from 'react';
import { FiX, FiCalendar, FiClock, FiMapPin, FiUsers, FiMail } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { fetchWithToken } from '@/lib/tokenStorage';
import toast from 'react-hot-toast';

interface EventCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onEventCreated: (event: any) => void;
}

const EventCreator: React.FC<EventCreatorProps> = ({
  isOpen,
  onClose,
  userId,
  onEventCreated
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    attendees: '',
    sendEmail: true,
    sendNotification: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.startDate || !formData.startTime) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      // Criar evento no calendário
      const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
      const endDateTime = formData.endDate && formData.endTime 
        ? `${formData.endDate}T${formData.endTime}:00`
        : startDateTime;

      const attendeesList = formData.attendees
        .split(',')
        .map(email => email.trim())
        .filter(email => email);

      const eventData = {
        userId,
        summary: formData.title,
        description: formData.description,
        start: startDateTime,
        end: endDateTime,
        location: formData.location,
        attendees: attendeesList,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };

      // Criar evento no calendário
      const calendarResponse = await fetchWithToken('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });

      if (!calendarResponse.ok) {
        throw new Error('Erro ao criar evento no calendário');
      }

      const calendarEvent = await calendarResponse.json();

      // Criar post de evento no feed de notícias
      const newsPost = {
        title: formData.title,
        content: `📅 **Evento:** ${formData.title}\n\n${formData.description}\n\n📍 **Local:** ${formData.location || 'A definir'}\n🕐 **Data:** ${new Date(startDateTime).toLocaleString('pt-BR')}`,
        excerpt: formData.description.substring(0, 200),
        media_urls: [],
        external_links: [],
        author_id: userId,
        category_id: null,
        tags: ['evento', 'calendar'],
        visibility_settings: {
          public: true,
          roles: [],
          users: []
        },
        metadata: {
          type: 'event',
          eventId: calendarEvent.id,
          startDate: startDateTime,
          endDate: endDateTime,
          location: formData.location,
          attendees: attendeesList
        },
        status: 'published'
      };

      const newsResponse = await fetchWithToken('/api/news/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newsPost)
      });

      if (!newsResponse.ok) {
        throw new Error('Erro ao criar post de evento');
      }

      const createdPost = await newsResponse.json();

      // Enviar notificações se solicitado
      if (formData.sendEmail || formData.sendNotification) {
        await fetchWithToken('/api/notifications/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: calendarEvent.id,
            title: formData.title,
            description: formData.description,
            startDate: startDateTime,
            location: formData.location,
            attendees: attendeesList,
            sendEmail: formData.sendEmail,
            sendInternalNotification: formData.sendNotification
          })
        });
      }

      toast.success('Evento criado com sucesso!');
      onEventCreated(createdPost);
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        location: '',
        attendees: '',
        sendEmail: true,
        sendNotification: true
      });
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      toast.error('Erro ao criar evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-full">
              <FiCalendar className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Criar Evento</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título do Evento *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Ex: Reunião de equipe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Descreva o evento..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Data e Hora de Início */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Início *
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora de Início *
              </label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Data e Hora de Término */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Término
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora de Término
              </label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Localização */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <FiMapPin className="w-4 h-4 mr-2" />
              Localização
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Ex: Sala de reuniões 1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Participantes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <FiUsers className="w-4 h-4 mr-2" />
              Participantes (emails separados por vírgula)
            </label>
            <input
              type="text"
              name="attendees"
              value={formData.attendees}
              onChange={handleChange}
              placeholder="email1@example.com, email2@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Opções de Notificação */}
          <div className="space-y-2 pt-4 border-t">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="sendEmail"
                checked={formData.sendEmail}
                onChange={handleChange}
                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700 flex items-center">
                <FiMail className="w-4 h-4 mr-2" />
                Enviar convite por email
              </span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="sendNotification"
                checked={formData.sendNotification}
                onChange={handleChange}
                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                Enviar notificação interna
              </span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Criando...' : 'Criar Evento'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EventCreator;

