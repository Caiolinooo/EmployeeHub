'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import VideoPlayer from '@/components/Academy/VideoPlayer';
import Comments from '@/components/Academy/Comments';
import Ratings from '@/components/Academy/Ratings';
import { 
  PlayIcon, 
  ClockIcon, 
  UserIcon,
  BookOpenIcon,
  StarIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface Course {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration: number;
  difficulty_level: string;
  is_published: boolean;
  is_featured: boolean;
  tags: string[];
  prerequisites: string[];
  learning_objectives: string[];
  view_count: number;
  created_at: string;
  updated_at: string;
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
  stats?: {
    enrollments: number;
    ratings_count: number;
    average_rating: number;
  };
}

interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at?: string;
  is_active: boolean;
  progress?: {
    progress_percentage: number;
    last_watched_position: number;
    total_watch_time: number;
    last_accessed_at: string;
  }[];
}

const CoursePage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { user, getToken } = useSupabaseAuth();
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const courseId = (params as any)?.id as string | undefined;

  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId, user]);

  const loadCourseData = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadCourse(),
        user?.id ? loadEnrollment() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do curso:', error);
      setError('Erro ao carregar dados do curso');
    } finally {
      setLoading(false);
    }
  };

  const loadCourse = async () => {
    try {
      const response = await fetch(`/api/academy/courses?course_id=${courseId}`);
      const data = await response.json();

      if (data.success && data.courses.length > 0) {
        setCourse(data.courses[0]);
      } else {
        setError(t('academy.cursoNaoEncontrado'));
      }
    } catch (error) {
      console.error('Erro ao carregar curso:', error);
      throw error;
    }
  };

  const loadEnrollment = async () => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/academy/enrollments?course_id=${courseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();

      if (data.success && data.enrollments.length > 0) {
        setEnrollment(data.enrollments[0]);
      }
    } catch (error) {
      console.error(t('academy.erroAoCarregarMatricula'), error);
    }
  };

  const handleEnroll = async () => {
    if (!user?.id || !course) return;

    setEnrolling(true);
    try {
      const token = await getToken();
      if (!token) {
        setError(t('academy.tokenDeAutenticacaoNaoEncontrado'));
        return;
      }

      const response = await fetch('/api/academy/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          course_id: courseId
        })
      });

      const data = await response.json();

      if (data.success) {
        await loadEnrollment();
      } else {
        setError(data.error || t('academy.erroAoRealizarMatricula'));
      }
    } catch (error) {
      console.error(t('academy.erroAoRealizarMatricula'), error);
      setError(t('academy.erroAoRealizarMatricula'));
    } finally {
      setEnrolling(false);
    }
  };

  const handleProgressUpdate = async (progressData: {
    progress_percentage?: number;
    last_watched_position?: number;
    watch_time_increment?: number;
  }) => {
    if (!enrollment || !user) return;

    try {
      const token = await getToken();
      if (!token) return;

      await fetch('/api/academy/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          enrollment_id: enrollment.id,
          ...progressData
        })
      });

      // Recarregar dados da matrícula para atualizar progresso
      await loadEnrollment();
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error);
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
      case 'beginner': return t('academy.iniciante');
      case 'intermediate': return t('academy.intermediario');
      case 'advanced': return t('academy.avancado');
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarIcon
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  if (error || !course) {
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
                  <p>{error || t('academy.cursoNaoEncontrado')}</p>
                </div>
                <div className="mt-4 space-x-3">
                  <button
                    onClick={() => router.back()}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => loadCourseData()}
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

  const progress = enrollment?.progress?.[0];
  const isEnrolled = enrollment?.is_active;
  const isCompleted = enrollment?.completed_at;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com navegação */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar ao Academy
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna principal - Vídeo e conteúdo */}
          <div className="lg:col-span-2">
            {/* Player de vídeo */}
            {isEnrolled && course.video_url ? (
              <div className="mb-6">
                <VideoPlayer
                  src={course.video_url}
                  poster={course.thumbnail_url}
                  title={course.title}
                  initialPosition={progress?.last_watched_position || 0}
                  onProgress={(position, percentage) => {
                    handleProgressUpdate({
                      last_watched_position: position,
                      progress_percentage: percentage,
                      watch_time_increment: 5 // Incremento de 5 segundos
                    });
                  }}
                />
              </div>
            ) : (
              <div className="relative mb-6">
                <img
                  src={course.thumbnail_url || '/images/course-default.jpg'}
                  alt={course.title}
                  className="w-full h-64 md:h-96 object-cover rounded-lg"
                />
                {!isEnrolled && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-center text-white">
                      <PlayIcon className="h-16 w-16 mx-auto mb-4" />
                      <p className="text-lg font-medium">Matricule-se para assistir</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Informações do curso */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{course.title}</h1>
                  <p className="text-gray-600">{course.short_description || course.description}</p>
                </div>
                {course.category && (
                  <span 
                    className="ml-4 px-3 py-1 text-sm font-medium rounded-full flex-shrink-0"
                    style={{ 
                      backgroundColor: `${course.category.color}20`,
                      color: course.category.color 
                    }}
                  >
                    {course.category.name}
                  </span>
                )}
              </div>

              {/* Progresso (se matriculado) */}
              {isEnrolled && progress && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">Seu Progresso</span>
                    <span className="text-sm text-blue-700">{progress.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.progress_percentage}%` }}
                    ></div>
                  </div>
                  {isCompleted && (
                    <div className="flex items-center mt-2 text-green-600">
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium">Curso concluído!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Descrição completa */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Sobre este curso</h3>
                <p className="text-gray-700 whitespace-pre-line">{course.description}</p>
              </div>

              {/* Objetivos de aprendizagem */}
              {course.learning_objectives && course.learning_objectives.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">O que você vai aprender</h3>
                  <ul className="space-y-2">
                    {course.learning_objectives.map((objective, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{objective}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pré-requisitos */}
              {course.prerequisites && course.prerequisites.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Pré-requisitos</h3>
                  <ul className="space-y-2">
                    {course.prerequisites.map((prerequisite, index) => (
                      <li key={index} className="flex items-start">
                        <BookOpenIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{prerequisite}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tags */}
              {course.tags && course.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {course.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Informações e ações */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              {/* Botão de matrícula/acesso */}
              {!user ? (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    Faça login para se matricular neste curso
                  </p>
                </div>
              ) : !isEnrolled ? (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center mb-6 disabled:opacity-50"
                >
                  {enrolling ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <AcademicCapIcon className="h-5 w-5 mr-2" />
                  )}
                  {enrolling ? 'Matriculando...' : 'Matricular-se Gratuitamente'}
                </button>
              ) : (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center text-green-800">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">Você está matriculado</span>
                  </div>
                </div>
              )}

              {/* Informações do curso */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Duração</span>
                  <div className="flex items-center text-gray-900">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatDuration(course.duration)}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Nível</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(course.difficulty_level)}`}>
                    {getDifficultyLabel(course.difficulty_level)}
                  </span>
                </div>

                {course.instructor && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Instrutor</span>
                    <div className="flex items-center text-gray-900">
                      <UserIcon className="h-4 w-4 mr-1" />
                      {course.instructor.first_name} {course.instructor.last_name}
                    </div>
                  </div>
                )}

                {course.stats && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Alunos</span>
                      <span className="text-gray-900">{course.stats.enrollments}</span>
                    </div>

                    {course.stats.ratings_count > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Avaliação</span>
                        <div className="flex items-center">
                          <div className="flex items-center mr-2">
                            {renderStars(course.stats.average_rating)}
                          </div>
                          <span className="text-sm text-gray-600">
                            {course.stats.average_rating.toFixed(1)} ({course.stats.ratings_count})
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Visualizações</span>
                  <span className="text-gray-900">{course.view_count}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seção de avaliações */}
        {courseId && (
          <div className="mt-12">
            <Ratings courseId={courseId} isEnrolled={isEnrolled} />
          </div>
        )}

        {/* Seção de comentários */}
        {courseId && (
          <div className="mt-12">
            <Comments courseId={courseId} />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CoursePage;
