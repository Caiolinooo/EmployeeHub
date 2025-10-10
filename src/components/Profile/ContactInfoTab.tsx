'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/hooks/useToast';
import { FiPlus, FiTrash2, FiCheck, FiX, FiLoader, FiMail, FiPhone } from 'react-icons/fi';

interface ContactInfoTabProps {
  user: any;
}

interface Email {
  id: string;
  email: string;
  label: string;
  is_verified: boolean;
  is_primary: boolean;
}

interface Phone {
  id: string;
  phone_number: string;
  label: string;
  is_verified: boolean;
  is_primary: boolean;
}

export function ContactInfoTab({ user }: ContactInfoTabProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [newEmail, setNewEmail] = useState({ email: '', label: '' });
  const [newPhone, setNewPhone] = useState({ phone_number: '', label: '' });
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);

  // Carregar e-mails e telefones do usuário
  useEffect(() => {
    const fetchContactInfo = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      console.log('Fetching contact info for user:', user?.id);
      
      try {
        const token = localStorage.getItem('token');
        console.log('Token found:', !!token);
        
        if (!token) {
          toast.error(t('common.notAuthorized', 'Não autorizado'));
          setIsLoading(false);
          return;
        }

        // Buscar e-mails
        console.log('Fetching emails...');
        const emailsResponse = await fetch(`/api/users-unified/${user.id}/emails`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Emails response status:', emailsResponse.status);

        // Buscar telefones
        console.log('Fetching phones...');
        const phonesResponse = await fetch(`/api/users-unified/${user.id}/phones`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Phones response status:', phonesResponse.status);

        if (emailsResponse.ok) {
          const emailsData = await emailsResponse.json();
          console.log('Emails data received:', emailsData);
          setEmails(emailsData.data || []);
        } else {
           const errorData = await emailsResponse.json();
           console.error('Error fetching emails:', errorData);
           toast.error(errorData.error || t('profile.loadError', 'Erro ao carregar e-mails'));
        }

        if (phonesResponse.ok) {
          const phonesData = await phonesResponse.json();
          console.log('Phones data received:', phonesData);
          setPhones(phonesData.data || []);
        } else {
           const errorData = await phonesResponse.json();
           console.error('Error fetching phones:', errorData);
           toast.error(errorData.error || t('profile.loadError', 'Erro ao carregar telefones'));
        }
      } catch (error) {
        console.error(t('components.erroGeralAoCarregarInformacoesDeContato'), error);
        toast.error(t('profile.loadError', 'Erro ao carregar informações'));
      } finally {
        setIsLoading(false);
        console.log('Finished fetching contact info');
      }
    };

    fetchContactInfo();
  }, [user?.id, toast, t]);

  // Adicionar novo e-mail
  const handleAddEmail = async () => {
    if (!newEmail.email) {
      console.log('New email is empty, not adding');
      return;
    }
    
    setIsSubmittingEmail(true);
    console.log('Adding new email:', newEmail);
    
    try {
      const token = localStorage.getItem('token');
      console.log('Token found for add email:', !!token);
      
      if (!token) {
        toast.error(t('common.notAuthorized', 'Não autorizado'));
        setIsSubmittingEmail(false);
        return;
      }

      console.log('Sending POST request to add email...');
      const response = await fetch(`/api/users-unified/${user.id}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newEmail)
      });
      console.log('Add email response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Email added successfully:', data);
        setEmails(prev => [...prev, data.data]);
        setNewEmail({ email: '', label: '' });
        setIsAddingEmail(false);
        toast.success(t('profile.emailAdded', 'E-mail adicionado com sucesso'));
      } else {
        const error = await response.json();
        console.error('Error adding email:', error);
        toast.error(error.error || t('profile.emailAddError', 'Erro ao adicionar e-mail'));
      }
    } catch (error) {
      console.error('Erro geral ao adicionar e-mail:', error);
      toast.error(t('profile.emailAddError', 'Erro ao adicionar e-mail'));
    } finally {
      setIsSubmittingEmail(false);
      console.log('Finished adding email');
    }
  };

  // Adicionar novo telefone
  const handleAddPhone = async () => {
    if (!newPhone.phone_number) {
      console.log('New phone number is empty, not adding');
      return;
    }
    
    setIsSubmittingPhone(true);
    console.log('Adding new phone:', newPhone);
    
    try {
      const token = localStorage.getItem('token');
      console.log('Token found for add phone:', !!token);
      
      if (!token) {
        toast.error(t('common.notAuthorized', 'Não autorizado'));
        setIsSubmittingPhone(false);
        return;
      }

      console.log('Sending POST request to add phone...');
      const response = await fetch(`/api/users-unified/${user.id}/phones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPhone)
      });
      console.log('Add phone response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Phone added successfully:', data);
        setPhones(prev => [...prev, data.data]);
        setNewPhone({ phone_number: '', label: '' });
        setIsAddingPhone(false);
        toast.success(t('profile.phoneAdded', 'Telefone adicionado com sucesso'));
      } else {
        const error = await response.json();
        console.error('Error adding phone:', error);
        toast.error(error.error || t('profile.phoneAddError', 'Erro ao adicionar telefone'));
      }
    } catch (error) {
      console.error('Erro geral ao adicionar telefone:', error);
      toast.error(t('profile.phoneAddError', 'Erro ao adicionar telefone'));
    } finally {
      setIsSubmittingPhone(false);
      console.log('Finished adding phone');
    }
  };

  // Remover e-mail
  const handleRemoveEmail = async (id: string) => {
    console.log('Removing email with ID:', id);
    try {
      const token = localStorage.getItem('token');
      console.log('Token found for remove email:', !!token);
      
      if (!token) {
        toast.error(t('common.notAuthorized', 'Não autorizado'));
        return;
      }

      console.log(`Sending DELETE request to remove email ID ${id}...`);
      const response = await fetch(`/api/users-unified/${user.id}/emails/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Remove email response status:', response.status);

      if (response.ok) {
        console.log('Email removed successfully');
        setEmails(prev => prev.filter(email => email.id !== id));
        toast.success(t('profile.emailRemoved', 'E-mail removido com sucesso'));
      } else {
        const error = await response.json();
        console.error('Error removing email:', error);
        toast.error(error.error || t('profile.emailRemoveError', 'Erro ao remover e-mail'));
      }
    } catch (error) {
      console.error('Erro geral ao remover e-mail:', error);
      toast.error(t('profile.emailRemoveError', 'Erro ao remover e-mail'));
    } finally {
      console.log('Finished removing email');
    }
  };

  // Remover telefone
  const handleRemovePhone = async (id: string) => {
    console.log('Removing phone with ID:', id);
    try {
      const token = localStorage.getItem('token');
      console.log('Token found for remove phone:', !!token);
      
      if (!token) {
        toast.error(t('common.notAuthorized', 'Não autorizado'));
        return;
      }

      console.log(`Sending DELETE request to remove phone ID ${id}...`);
      const response = await fetch(`/api/users-unified/${user.id}/phones/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Remove phone response status:', response.status);

      if (response.ok) {
        console.log('Phone removed successfully');
        setPhones(prev => prev.filter(phone => phone.id !== id));
        toast.success(t('profile.phoneRemoved', 'Telefone removido com sucesso'));
      } else {
        const error = await response.json();
        console.error('Error removing phone:', error);
        toast.error(error.error || t('profile.phoneRemoveError', 'Erro ao remover telefone'));
      }
    } catch (error) {
      console.error('Erro geral ao remover telefone:', error);
      toast.error(t('profile.phoneRemoveError', 'Erro ao remover telefone'));
    } finally {
      console.log('Finished removing phone');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <FiLoader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* E-mails */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            {t('profile.emails', 'E-mails')}
          </h2>
          <button
            onClick={() => setIsAddingEmail(true)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <FiPlus className="h-4 w-4 mr-1" />
            {t('profile.addEmail', 'Adicionar e-mail')}
          </button>
        </div>

        <div className="space-y-3">
          {/* E-mail principal */}
          <div className="flex items-center p-3 bg-gray-50 rounded-md">
            <FiMail className="h-5 w-5 text-gray-500 mr-3" />
            <div className="flex-1">
              <div className="font-medium">{user.email}</div>
              <div className="text-sm text-gray-500">{t('profile.primaryEmail', 'E-mail principal')}</div>
            </div>
            <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              {t('profile.verified', 'Verificado')}
            </div>
          </div>

          {/* E-mails adicionais */}
          {emails.map(email => (
            <div key={email.id} className="flex items-center p-3 bg-white border border-gray-200 rounded-md">
              <FiMail className="h-5 w-5 text-gray-500 mr-3" />
              <div className="flex-1">
                <div className="font-medium">{email.email}</div>
                {email.label && <div className="text-sm text-gray-500">{email.label}</div>}
              </div>
              {email.is_verified ? (
                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mr-2">
                  {t('profile.verified', 'Verificado')}
                </div>
              ) : (
                <button className="text-blue-600 hover:text-blue-800 text-sm mr-2">
                  {t('profile.verify', 'Verificar')}
                </button>
              )}
              <button
                onClick={() => handleRemoveEmail(email.id)}
                className="text-red-600 hover:text-red-800"
                aria-label={t('profile.removeEmail', 'Remover e-mail')}
              >
                <FiTrash2 className="h-5 w-5" />
              </button>
            </div>
          ))}

          {/* Formulário para adicionar novo e-mail */}
          {isAddingEmail && (
            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <div className="flex items-center mb-2">
                <FiMail className="h-5 w-5 text-gray-500 mr-3" />
                <div className="text-sm font-medium">
                  {t('profile.newEmail', 'Novo e-mail')}
                </div>
              </div>
              <div className="space-y-3">
                <input
                  type="email"
                  value={newEmail.email}
                  onChange={(e) => setNewEmail(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t('profile.emailPlaceholder', 'Digite o e-mail')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="text"
                  value={newEmail.label}
                  onChange={(e) => setNewEmail(prev => ({ ...prev, label: e.target.value }))}
                  placeholder={t('profile.labelPlaceholder', 'Rótulo (opcional)')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setIsAddingEmail(false)}
                    className="flex items-center px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <FiX className="h-4 w-4 mr-1" />
                    {t('common.cancel', 'Cancelar')}
                  </button>
                  <button
                    onClick={handleAddEmail}
                    disabled={isSubmittingEmail || !newEmail.email}
                    className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmittingEmail ? (
                      <FiLoader className="animate-spin h-4 w-4 mr-1" />
                    ) : (
                      <FiCheck className="h-4 w-4 mr-1" />
                    )}
                    {t('common.add', 'Adicionar')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Telefones */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            {t('profile.phones', 'Telefones')}
          </h2>
          <button
            onClick={() => setIsAddingPhone(true)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <FiPlus className="h-4 w-4 mr-1" />
            {t('profile.addPhone', 'Adicionar telefone')}
          </button>
        </div>

        <div className="space-y-3">
          {/* Telefone principal */}
          {user.phone_number && (
            <div className="flex items-center p-3 bg-gray-50 rounded-md">
              <FiPhone className="h-5 w-5 text-gray-500 mr-3" />
              <div className="flex-1">
                <div className="font-medium">{user.phone_number}</div>
                <div className="text-sm text-gray-500">{t('profile.primaryPhone', 'Telefone principal')}</div>
              </div>
              <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                {t('profile.verified', 'Verificado')}
              </div>
            </div>
          )}

          {/* Telefones adicionais */}
          {phones.map(phone => (
            <div key={phone.id} className="flex items-center p-3 bg-white border border-gray-200 rounded-md">
              <FiPhone className="h-5 w-5 text-gray-500 mr-3" />
              <div className="flex-1">
                <div className="font-medium">{phone.phone_number}</div>
                {phone.label && <div className="text-sm text-gray-500">{phone.label}</div>}
              </div>
              {phone.is_verified ? (
                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mr-2">
                  {t('profile.verified', 'Verificado')}
                </div>
              ) : (
                <button className="text-blue-600 hover:text-blue-800 text-sm mr-2">
                  {t('profile.verify', 'Verificar')}
                </button>
              )}
              <button
                onClick={() => handleRemovePhone(phone.id)}
                className="text-red-600 hover:text-red-800"
                aria-label={t('profile.removePhone', 'Remover telefone')}
              >
                <FiTrash2 className="h-5 w-5" />
              </button>
            </div>
          ))}

          {/* Formulário para adicionar novo telefone */}
          {isAddingPhone && (
            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <div className="flex items-center mb-2">
                <FiPhone className="h-5 w-5 text-gray-500 mr-3" />
                <div className="text-sm font-medium">
                  {t('profile.newPhone', 'Novo telefone')}
                </div>
              </div>
              <div className="space-y-3">
                <input
                  type="tel"
                  value={newPhone.phone_number}
                  onChange={(e) => setNewPhone(prev => ({ ...prev, phone_number: e.target.value }))}
                  placeholder={t('profile.phonePlaceholder', 'Digite o telefone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="text"
                  value={newPhone.label}
                  onChange={(e) => setNewPhone(prev => ({ ...prev, label: e.target.value }))}
                  placeholder={t('profile.labelPlaceholder', 'Rótulo (opcional)')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setIsAddingPhone(false)}
                    className="flex items-center px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <FiX className="h-4 w-4 mr-1" />
                    {t('common.cancel', 'Cancelar')}
                  </button>
                  <button
                    onClick={handleAddPhone}
                    disabled={isSubmittingPhone || !newPhone.phone_number}
                    className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmittingPhone ? (
                      <FiLoader className="animate-spin h-4 w-4 mr-1" />
                    ) : (
                      <FiCheck className="h-4 w-4 mr-1" />
                    )}
                    {t('common.add', 'Adicionar')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
