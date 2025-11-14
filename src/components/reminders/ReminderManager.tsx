'use client';

import React, { useState, useEffect } from 'react';
import { FiClock, FiPlus, FiEdit, FiTrash2, FiCalendar, FiUsers, FiUser, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface Reminder {
  id: string;
  title: string;
  message: string;
  remind_at: string;
  target_roles: string[];
  target_users: string[];
  status: 'pending' | 'sent' | 'cancelled';
  created_at: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  post?: {
    id: string;
    title: string;
    status: string;
  };
}

interface ReminderManagerProps {
  userId: string;
  postId?: string;
}

const ReminderManager: React.FC<ReminderManagerProps> = ({ userId, postId }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    remind_at: '',
    target_roles: [] as string[],
    target_users: [] as string[]
  });

  // Carregar lembretes
  const loadReminders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        user_id: userId,
        status: 'all'
      });

      const response = await fetch(`/api/reminders?${params}`);
      const data = await response.json();

      if (response.ok) {
        setReminders(data.reminders);
      } else {
        setError(data.error || 'Erro ao carregar lembretes');
      }
    } catch (err) {
      setError('Erro ao carregar lembretes');
    } finally {
      setLoading(false);
    }
  };

  // Criar ou atualizar lembrete
  const saveReminder = async () => {
    try {
      const reminderData = {
        ...formData,
        user_id: userId,
        post_id: postId || null
      };

      const url = editingReminder 
        ? `/api/reminders/${editingReminder.id}`
        : '/api/reminders';
      
      const method = editingReminder ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderData)
      });

      if (response.ok) {
        await loadReminders();
        resetForm();
      } else {
        const data = await response.json();
        setError(data.error || 'Erro ao salvar lembrete');
      }
    } catch (err) {
      setError('Erro ao salvar lembrete');
    }
  };

  // Excluir lembrete
  const deleteReminder = async (reminderId: string) => {
    if (!confirm('Tem certeza que deseja excluir este lembrete?')) return;

    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadReminders();
      } else {
        const data = await response.json();
        setError(data.error || 'Erro ao excluir lembrete');
      }
    } catch (err) {
      setError('Erro ao excluir lembrete');
    }
  };

  // Resetar formulário
  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      remind_at: '',
      target_roles: [],
      target_users: []
    });
    setEditingReminder(null);
    setShowForm(false);
  };

  // Editar lembrete
  const editReminder = (reminder: Reminder) => {
    setFormData({
      title: reminder.title,
      message: reminder.message,
      remind_at: reminder.remind_at,
      target_roles: reminder.target_roles,
      target_users: reminder.target_users
    });
    setEditingReminder(reminder);
    setShowForm(true);
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Obter status badge
  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: FiClock, text: 'Pendente' },
      sent: { color: 'bg-green-100 text-green-800', icon: FiCheck, text: 'Enviado' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: FiX, text: 'Cancelado' }
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  useEffect(() => {
    loadReminders();
  }, [userId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FiClock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Lembretes</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          <span>Novo Lembrete</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <FiAlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingReminder ? 'Editar Lembrete' : 'Novo Lembrete'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('components.tituloDoLembrete')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Mensagem do lembrete"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora
                </label>
                <input
                  type="datetime-local"
                  value={formData.remind_at}
                  onChange={(e) => setFormData({ ...formData, remind_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roles Alvo (opcional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {['ADMIN', 'MANAGER', 'USER'].map(role => (
                    <label key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.target_roles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              target_roles: [...formData.target_roles, role]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              target_roles: formData.target_roles.filter(r => r !== role)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={saveReminder}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingReminder ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminders List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <div className="text-gray-500 mt-2">Carregando lembretes...</div>
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FiClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum lembrete</h3>
          <p className="text-gray-500">Crie seu primeiro lembrete para começar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-medium text-gray-900">{reminder.title}</h3>
                    {getStatusBadge(reminder.status)}
                  </div>
                  
                  {reminder.message && (
                    <p className="text-gray-600 text-sm mb-2">{reminder.message}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <FiCalendar className="w-4 h-4 mr-1" />
                      <span>{formatDate(reminder.remind_at)}</span>
                    </div>
                    
                    {reminder.target_roles.length > 0 && (
                      <div className="flex items-center">
                        <FiUsers className="w-4 h-4 mr-1" />
                        <span>{reminder.target_roles.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {reminder.status === 'pending' && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => editReminder(reminder)}
                      className="p-2 text-gray-400 hover:text-blue-600 rounded"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReminderManager;
