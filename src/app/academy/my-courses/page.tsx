'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import { 
  PlayIcon, 
  ClockIcon, 
  UserIcon,
  BookOpenIcon,
  StarIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  AcademicCapIcon,
  CalendarIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface Course {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration: number;
  difficulty_level: string;
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
  instructor?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at?: string;
  is_active: boolean;
  course: Course;
  progress?: {
    progress_percentage: number;
    last_watched_position: number;
    total_watch_time: number;
    last_accessed_at: string;
  }[];
}

const MyCoursesPage: React.FC = () => {
  const router = useRouter();
  const { user, getToken } = useSupabaseAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    if (user?.id) {
      loadEnrollments();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadEnrollments = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setError('Token de autenticação não encontrado');
        return;
      }

      const response = await fetch('/api/academy/enrollments', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();

      if (data.success) {
        setEnrollments(data.enrollments);
      } else {
        setError(data.error || 'Erro ao carregar cursos');
      }
    } catch (error) {
      console.error('Erro ao carregar matrículas:', error);
      setError('Erro ao carregar cursos');
    } finally {
      setLoading(false);
    }
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
      case 'intermediate': return 'Intermediário';
      case 'advanced': return 'Avançado';
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Filtrar matrículas
  const filteredEnrollments = enrollments.filter(enrollment => {
    const progress = enrollment.progress?.[0]?.progress_percentage || 0;
    
    switch (filter) {
      case 'completed':
        return enrollment.completed_at || progress >= 100;
      case 'in_progress':
        return !enrollment.completed_at && progress > 0 && progress < 100;
      case 'all':
      default:
        return true;
    }
  });

  // Estatísticas
  const stats = {
    total: enrollments.length,
    completed: enrollments.filter(e => e.completed_at || (e.progress?.[0]?.progress_percentage || 0) >= 100).length,
    inProgress: enrollments.filter(e => !e.completed_at && (e.progress?.[0]?.progress_percentage || 0) > 0 && (e.progress?.[0]?.progress_percentage || 0) < 100).length,
    notStarted: enrollments.filter(e => !e.completed_at && (e.progress?.[0]?.progress_percentage || 0) === 0).length
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Acesso restrito</h3>
            <p className="mt-1 text-sm text-gray-500">
              Faça login para ver seus cursos matriculados.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                    onClick={() => loadEnrollments()}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Tentar novamente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/academy')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar ao Academy
          </button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BookOpenIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Meus Cursos</h1>
                <p className="text-gray-600 mt-1">
                  Acompanhe seu progresso e continue aprendendo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpenIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Cursos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrophyIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Concluídos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PlayIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Em Progresso</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Não Iniciados</p>
                <p className="text-2xl font-bold text-gray-900">{stats.notStarted}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'in_progress'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Em Progresso ({stats.inProgress})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === 'completed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Concluídos ({stats.completed})
            </button>
          </div>
        </div>

        {/* Lista de cursos */}
        {filteredEnrollments.length === 0 ? (
          <div className="text-center py-12">
            <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {filter === 'all' ? 'Nenhum curso matriculado' : 
               filter === 'completed' ? 'Nenhum curso concluído' :
               'Nenhum curso em progresso'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' ? 'Explore nossos cursos disponíveis e comece a aprender.' :
               'Continue estudando para completar seus cursos.'}
            </p>
            {filter === 'all' && (
              <div className="mt-6">
                <button
                  onClick={() => router.push('/academy')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Explorar Cursos
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEnrollments.map((enrollment) => {
              const progress = enrollment.progress?.[0];
              const progressPercentage = progress?.progress_percentage || 0;
              const isCompleted = enrollment.completed_at || progressPercentage >= 100;
              
              return (
                <div key={enrollment.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative">
                    <img
                      src={enrollment.course.thumbnail_url || '/images/course-default.jpg'}
                      alt={enrollment.course.title}
                      className="w-full h-48 object-cover"
                    />
                    
                    {/* Status badge */}
                    <div className="absolute top-4 left-4">
                      {isCompleted ? (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                          <CheckCircleIcon className="w-3 h-3 mr-1" />
                          Concluído
                        </span>
                      ) : progressPercentage > 0 ? (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                          Em progresso
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded-full">
                          Não iniciado
                        </span>
                      )}
                    </div>

                    <div className="absolute top-4 right-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(enrollment.course.difficulty_level)}`}>
                        {getDifficultyLabel(enrollment.course.difficulty_level)}
                      </span>
                    </div>

                    {/* Progress bar overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
                      <div className="flex justify-between text-white text-xs mb-1">
                        <span>Progresso</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-1">
                        <div 
                          className="bg-white h-1 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{enrollment.course.title}</h3>
                      {enrollment.course.category && (
                        <span 
                          className="ml-2 px-2 py-1 text-xs font-medium rounded-full flex-shrink-0"
                          style={{ 
                            backgroundColor: `${enrollment.course.category.color}20`,
                            color: enrollment.course.category.color 
                          }}
                        >
                          {enrollment.course.category.name}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {enrollment.course.short_description || enrollment.course.description}
                    </p>
                    
                    {/* Informações do curso */}
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <ClockIcon className="w-4 h-4 mr-1" />
                          {formatDuration(enrollment.course.duration)}
                        </div>
                        {enrollment.course.instructor && (
                          <div className="flex items-center">
                            <UserIcon className="w-4 h-4 mr-1" />
                            {enrollment.course.instructor.first_name} {enrollment.course.instructor.last_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Data de matrícula */}
                    <div className="flex items-center text-xs text-gray-500 mb-4">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      Matriculado em {formatDate(enrollment.enrolled_at)}
                    </div>

                    {/* Botão de ação */}
                    <button 
                      onClick={() => router.push(`/academy/course/${enrollment.course.id}`)}
                      className={`w-full py-2 px-4 rounded-lg transition-colors flex items-center justify-center ${
                        isCompleted 
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : progressPercentage > 0
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      <PlayIcon className="w-4 h-4 mr-2" />
                      {isCompleted ? 'Revisar' : progressPercentage > 0 ? 'Continuar' : 'Iniciar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MyCoursesPage;
