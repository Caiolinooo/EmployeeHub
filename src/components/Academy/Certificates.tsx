'use client';

import React, { useState, useEffect } from 'react';
import { 
  AcademicCapIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface Certificate {
  id: string;
  course_id: string;
  course_title: string;
  course_duration: number;
  course_difficulty: string;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  instructor?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  completed_at: string;
  enrolled_at: string;
  certificate_url: string;
}

interface CertificatesProps {
  className?: string;
}

const Certificates: React.FC<CertificatesProps> = ({ className = '' }) => {
  const { user, getToken } = useSupabaseAuth();
  const { t } = useI18n();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingCertificate, setGeneratingCertificate] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadCertificates();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadCertificates = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setError(t('components.tokenDeAutenticacaoNaoEncontrado'));
        return;
      }

      const response = await fetch('/api/academy/certificates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();

      if (data.success) {
        setCertificates(data.certificates);
      } else {
        setError(data.error || 'Erro ao carregar certificados');
      }
    } catch (error) {
      console.error('Erro ao carregar certificados:', error);
      setError('Erro ao carregar certificados');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCertificate = async (certificate: Certificate) => {
    try {
      setGeneratingCertificate(certificate.id);
      
      const token = await getToken();
      if (!token) return;

      const response = await fetch(certificate.certificate_url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const htmlContent = await response.text();
        
        // Abrir certificado em nova janela
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        }
      } else {
        alert('Erro ao gerar certificado');
      }
    } catch (error) {
      console.error('Erro ao visualizar certificado:', error);
      alert('Erro ao visualizar certificado');
    } finally {
      setGeneratingCertificate(null);
    }
  };

  const handleDownloadCertificate = async (certificate: Certificate) => {
    try {
      setGeneratingCertificate(certificate.id);
      
      const token = await getToken();
      if (!token) return;

      const response = await fetch(certificate.certificate_url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const htmlContent = await response.text();
        
        // Criar blob e download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificado-${certificate.course_title.replace(/[^a-zA-Z0-9]/g, '-')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
      } else {
        alert('Erro ao gerar certificado');
      }
    } catch (error) {
      console.error('Erro ao baixar certificado:', error);
      alert('Erro ao baixar certificado');
    } finally {
      setGeneratingCertificate(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'Iniciante';
      case 'intermediate': return t('components.intermediario');
      case 'advanced': return t('components.avancado');
      default: return difficulty;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Acesso restrito</h3>
          <p className="mt-1 text-sm text-gray-500">
            Faça login para ver seus certificados.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erro</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => loadCertificates()}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrophyIcon className="w-5 h-5 mr-2" />
          Meus Certificados ({certificates.length})
        </h3>

        {certificates.length === 0 ? (
          <div className="text-center py-12">
            <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum certificado ainda</h3>
            <p className="mt-1 text-sm text-gray-500">
              Complete cursos para ganhar certificados de conclusão.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((certificate) => (
              <div key={certificate.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                        {certificate.course_title}
                      </h4>
                      
                      {certificate.category && (
                        <span 
                          className="inline-block px-2 py-1 text-xs font-medium rounded-full mb-2"
                          style={{ 
                            backgroundColor: `${certificate.category.color}20`,
                            color: certificate.category.color 
                          }}
                        >
                          {certificate.category.name}
                        </span>
                      )}
                    </div>
                    
                    <TrophyIcon className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <ClockIcon className="w-4 h-4 mr-2" />
                      {formatDuration(certificate.course_duration)}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600">
                      <TagIcon className="w-4 h-4 mr-2" />
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(certificate.course_difficulty)}`}>
                        {getDifficultyLabel(certificate.course_difficulty)}
                      </span>
                    </div>

                    {certificate.instructor && (
                      <div className="flex items-center text-sm text-gray-600">
                        <UserIcon className="w-4 h-4 mr-2" />
                        {certificate.instructor.first_name} {certificate.instructor.last_name}
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Concluído em {formatDate(certificate.completed_at)}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewCertificate(certificate)}
                      disabled={generatingCertificate === certificate.id}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center text-sm"
                    >
                      {generatingCertificate === certificate.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <EyeIcon className="w-4 h-4 mr-2" />
                      )}
                      {generatingCertificate === certificate.id ? 'Gerando...' : 'Visualizar'}
                    </button>
                    
                    <button
                      onClick={() => handleDownloadCertificate(certificate)}
                      disabled={generatingCertificate === certificate.id}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center text-sm"
                    >
                      {generatingCertificate === certificate.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                      )}
                      {generatingCertificate === certificate.id ? 'Gerando...' : 'Baixar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Certificates;
