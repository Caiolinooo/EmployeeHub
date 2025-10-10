'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import {
  ChartBarIcon,
  ClockIcon,
  TrophyIcon,
  BookOpenIcon,
  StarIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  PlayIcon,
  CalendarIcon,
  FireIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface DashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalWatchTime: number;
  averageProgress: number;
  certificatesEarned: number;
  currentStreak: number;
  longestStreak: number;
}

interface RecentActivity {
  id: string;
  type: 'enrollment' | 'progress' | 'completion';
  courseTitle: string;
  courseThumbnail?: string;
  progress?: number;
  timestamp: string;
}

interface Course {
  id: string;
  title: string;
  thumbnail_url?: string;
  category?: {
    name: string;
    color: string;
  };
  progress?: {
    progress_percentage: number;
    last_accessed_at: string;
  }[];
}

interface EnrollmentLite {
  id: string;
  enrolled_at: string;
  completed_at?: string | null;
  progress?: Array<{
    progress_percentage: number;
    total_watch_time: number;
    last_accessed_at: string;
  }>;
  course: {
    id: string;
    title: string;
    thumbnail_url?: string;
    category?: {
      name: string;
      color: string;
    };
  };
}


const AcademyDashboard: React.FC = () => {
  const router = useRouter();
  const { user, getToken } = useSupabaseAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setError({t('academy.tokenDeAutenticacaoNaoEncontrado')});
        return;
      }

      // Carregar matrículas com progresso
      const enrollmentsResponse = await fetch('/api/academy/enrollments', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const enrollmentsData = await enrollmentsResponse.json();

      if (enrollmentsData.success) {
        const enrollments: EnrollmentLite[] = enrollmentsData.enrollments as EnrollmentLite[];

        // Calcular estatísticas
        const totalCourses = enrollments.length;
        const completedCourses = enrollments.filter(e =>
          e.completed_at || (e.progress?.[0]?.progress_percentage || 0) >= 100
        ).length;
        const inProgressCourses = enrollments.filter(e =>
          !e.completed_at && (e.progress?.[0]?.progress_percentage || 0) > 0 && (e.progress?.[0]?.progress_percentage || 0) < 100
        ).length;

        const totalWatchTime = enrollments.reduce((total, e) =>
          total + (e.progress?.[0]?.total_watch_time || 0), 0
        );

        const averageProgress = totalCourses > 0
          ? enrollments.reduce((total, e) => total + (e.progress?.[0]?.progress_percentage || 0), 0) / totalCourses
          : 0;

        const dashboardStats: DashboardStats = {
          totalCourses,
          completedCourses,
          inProgressCourses,
          totalWatchTime: Math.floor(totalWatchTime / 60), // Converter para minutos
          averageProgress: Math.round(averageProgress),
          certificatesEarned: completedCourses, // Assumindo 1 certificado por curso concluído
          currentStreak: 0, // Implementar lógica de streak
          longestStreak: 0   // Implementar lógica de streak
        };

        setStats(dashboardStats);

        // Preparar cursos recentes (últimos acessados)
        const coursesWithProgress = enrollments
          .filter(e => e.progress?.[0]?.last_accessed_at)
          .sort((a, b) => new Date(b.progress?.[0]?.last_accessed_at || 0).getTime() - new Date(a.progress?.[0]?.last_accessed_at || 0).getTime())
          .slice(0, 6)
          .map(e => ({
            id: e.course.id,
            title: e.course.title,
            thumbnail_url: e.course.thumbnail_url,
            category: e.course.category,
            progress: e.progress
          }));

        setRecentCourses(coursesWithProgress);

        // Preparar atividade recente
        const activities: RecentActivity[] = [];

        // Adicionar matrículas recentes
        enrollments
          .sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime())
          .slice(0, 3)
          .forEach(e => {
            activities.push({
              id: `enrollment-${e.id}`,
              type: 'enrollment',
              courseTitle: e.course.title,
              courseThumbnail: e.course.thumbnail_url,
              timestamp: e.enrolled_at
            });
          });

        // Adicionar conclusões recentes
        enrollments
          .filter(e => e.completed_at)
          .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
          .slice(0, 3)
          .forEach(e => {
            activities.push({
              id: `completion-${e.id}`,
              type: 'completion',
              courseTitle: e.course.title,
              courseThumbnail: e.course.thumbnail_url,
              timestamp: e.completed_at!
            });
          });

        // Ordenar atividades por data
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivity(activities.slice(0, 10));

      } else {
        setError(enrollmentsData.error || 'Erro ao carregar dados');
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      setError('Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Hoje';
    if (diffDays === 2) return 'Ontem';
    if (diffDays <= 7) return {t('academy.diffdaysDiasAtras')};

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'enrollment':
        return <BookOpenIcon className="h-5 w-5 text-blue-600" />;
      case 'completion':
        return <TrophyIcon className="h-5 w-5 text-green-600" />;
      case 'progress':
        return <PlayIcon className="h-5 w-5 text-yellow-600" />;
      default:
        return <AcademicCapIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getActivityMessage = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'enrollment':
        return {t('academy.voceSeMatriculouEm')}${activity.courseTitle}"`;
      case 'completion':
        return {t('academy.voceConcluiu')}${activity.courseTitle}"`;
      case 'progress':
        return `Progresso atualizado em "${activity.courseTitle}" (${activity.progress}%)`;
      default:
        return `Atividade em "${activity.courseTitle}"`;
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Acesso restrito</h3>
            <p className="mt-1 text-sm text-gray-500">
              Faça login para ver seu dashboard de aprendizagem.
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
                    onClick={() => loadDashboardData()}
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
              <ChartBarIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard de Aprendizagem</h1>
                <p className="text-gray-600 mt-1">
                  Acompanhe seu progresso e conquistas
                </p>
              </div>
            </div>
          </div>
        </div>

        {stats && (
          <>
            {/* Estatísticas principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BookOpenIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Cursos Matriculados</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrophyIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Cursos Concluídos</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.completedCourses}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Tempo de Estudo</p>
                    <p className="text-2xl font-bold text-gray-900">{formatTime(stats.totalWatchTime)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Progresso Médio</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.averageProgress}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progresso geral */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Visão Geral do Progresso</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-3">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#10b981"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(stats.completedCourses / stats.totalCourses) * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">
                        {stats.totalCourses > 0 ? Math.round((stats.completedCourses / stats.totalCourses) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Taxa de Conclusão</p>
                </div>

                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-3">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#f59e0b"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(stats.inProgressCourses / stats.totalCourses) * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">
                        {stats.totalCourses > 0 ? Math.round((stats.inProgressCourses / stats.totalCourses) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Em Progresso</p>
                </div>

                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-3">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#3b82f6"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(stats.averageProgress / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">{stats.averageProgress}%</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Progresso Médio</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Cursos recentes */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Cursos Recentes</h3>
                  <button
                    onClick={() => router.push('/academy/my-courses')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Ver todos
                  </button>
                </div>

                {recentCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpenIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Nenhum curso acessado recentemente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentCourses.map((course) => (
                      <div key={course.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                           onClick={() => router.push(`/academy/course/${course.id}`)}>
                        <img
                          src={course.thumbnail_url || '/images/course-default.jpg'}
                          alt={course.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                          {course.category && (
                            <p className="text-xs text-gray-500">{course.category.name}</p>
                          )}
                          <div className="mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div
                                className="bg-blue-600 h-1 rounded-full"
                                style={{ width: `${course.progress?.[0]?.progress_percentage || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {course.progress?.[0]?.progress_percentage || 0}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Atividade recente */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Atividade Recente</h3>

                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Nenhuma atividade recente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{getActivityMessage(activity)}</p>
                          <p className="text-xs text-gray-500">{formatDate(activity.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default AcademyDashboard;
