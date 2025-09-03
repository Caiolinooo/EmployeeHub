'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import {
  AcademicCapIcon,
  PlayIcon,
  ClockIcon,
  UserIcon,
  BookOpenIcon,
  StarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { canEditAcademy } from '@/lib/permissions';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
}

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
  category?: Category;
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
  course: Course;
  progress?: {
    progress_percentage: number;
    last_watched_position: number;
    total_watch_time: number;
    last_accessed_at: string;
  }[];
}

const AcademyPage: React.FC = () => {
  const { user, getToken } = useSupabaseAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'enrolled' | 'featured'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user, selectedCategory, selectedDifficulty, searchTerm, viewMode]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadCategories(),
        loadCourses(),
        user?.id ? loadEnrollments() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados do Academy');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/academy/categories');
      const data = await response.json();

      if (data.success) {
        setCategories(data.categories);
      } else {
        console.error('Erro ao carregar categorias:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const loadCourses = async () => {
    try {
      const params = new URLSearchParams();

      // Filtros
      if (selectedCategory !== 'all') params.append('category_id', selectedCategory);
      if (selectedDifficulty !== 'all') params.append('difficulty', selectedDifficulty);
      if (searchTerm) params.append('search', searchTerm);

      // Apenas cursos publicados para usuários normais
      params.append('published', 'true');

      // Cursos em destaque
      if (viewMode === 'featured') {
        params.append('featured', 'true');
      }

      const response = await fetch(`/api/academy/courses?${params}`);
      const data = await response.json();

      if (data.success) {
        setCourses(data.courses);
      } else {
        console.error('Erro ao carregar cursos:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar cursos:', error);
    }
  };

  const loadEnrollments = async () => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/enrollments', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setEnrollments(data.enrollments);
      } else {
        console.error('Erro ao carregar matrículas:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar matrículas:', error);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      if (!token) {
        setError('Token de autenticação não encontrado');
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
        alert('Matrícula realizada com sucesso!');
        loadEnrollments();
      } else {
        alert(data.error || 'Erro ao realizar matrícula');
      }
    } catch (error) {
      console.error('Erro ao realizar matrícula:', error);
      alert('Erro ao realizar matrícula');
    }
  };

  const isEnrolled = (courseId: string) => {
    return enrollments.some(e => e.course_id === courseId && e.is_active);
  };

  const getEnrollmentProgress = (courseId: string) => {
    const enrollment = enrollments.find(e => e.course_id === courseId && e.is_active);
    return enrollment?.progress?.[0]?.progress_percentage || 0;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'Iniciante';
      case 'intermediate':
        return 'Intermediário';
      case 'advanced':
        return 'Avançado';
      default:
        return difficulty;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
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

  // Filtrar cursos baseado no modo de visualização
  const filteredCourses = courses.filter(course => {
    if (viewMode === 'enrolled') {
      return isEnrolled(course.id);
    }
    return true;
  });

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
                <h3 className="text-sm font-medium text-red-800">Erro ao carregar Academy</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => loadData()}
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <AcademicCapIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">ABZ Academy</h1>
                <p className="text-gray-600 mt-1">
                  Centro de treinamento e desenvolvimento profissional da ABZ Group
                </p>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex space-x-3">
              {user && (
                <>
                  <button
                    onClick={() => window.location.href = '/academy/dashboard'}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => window.location.href = '/academy/my-courses'}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <BookOpenIcon className="w-5 h-5" />
                    <span>Meus Cursos ({enrollments.length})</span>
                  </button>
                  <button
                    onClick={() => window.location.href = '/academy/certificates'}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span>Certificados</span>
                  </button>
                </>
              )}

              {user && canEditAcademy(user) && (
                <button
                  onClick={() => window.location.href = '/academy/editor'}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Criar Curso</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modos de Visualização */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todos os Cursos
            </button>
            <button
              onClick={() => setViewMode('featured')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'featured'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Em Destaque
            </button>
            {user && (
              <button
                onClick={() => setViewMode('enrolled')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'enrolled'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Meus Cursos ({enrollments.length})
              </button>
            )}
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Busca */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cursos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Categoria */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas as categorias</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>

            {/* Dificuldade */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas as dificuldades</option>
              <option value="beginner">Iniciante</option>
              <option value="intermediate">Intermediário</option>
              <option value="advanced">Avançado</option>
            </select>

            {/* Estatísticas */}
            <div className="flex items-center justify-center bg-blue-50 rounded-lg p-2">
              <BookOpenIcon className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">
                {filteredCourses.length} cursos {viewMode === 'enrolled' ? 'matriculados' : 'disponíveis'}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Cursos */}
        <div className="mb-8">
          {viewMode === 'enrolled' && enrollments.length === 0 ? (
            <div className="text-center py-12">
              <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum curso matriculado</h3>
              <p className="mt-1 text-sm text-gray-500">
                Explore nossos cursos disponíveis e comece a aprender hoje mesmo.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setViewMode('all')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Ver Todos os Cursos
                </button>
              </div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum curso encontrado</h3>
              <p className="mt-1 text-sm text-gray-500">
                Tente ajustar os filtros ou termos de busca.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => {
                const enrolled = isEnrolled(course.id);
                const progress = getEnrollmentProgress(course.id);

                return (
                  <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="relative">
                      <img
                        src={course.thumbnail_url || '/images/course-default.jpg'}
                        alt={course.title}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-4 left-4">
                        {course.is_featured && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                            Destaque
                          </span>
                        )}
                      </div>
                      <div className="absolute top-4 right-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(course.difficulty_level)}`}>
                          {getDifficultyLabel(course.difficulty_level)}
                        </span>
                      </div>
                      {enrolled && (
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="bg-black bg-opacity-50 rounded-lg p-2">
                            <div className="flex justify-between text-white text-xs mb-1">
                              <span>Progresso</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-300 rounded-full h-1">
                              <div
                                className="bg-white h-1 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{course.title}</h3>
                        {course.category && (
                          <span
                            className="ml-2 px-2 py-1 text-xs font-medium rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: `${course.category.color}20`,
                              color: course.category.color
                            }}
                          >
                            {course.category.name}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {course.short_description || course.description}
                      </p>

                      {/* Estatísticas */}
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <ClockIcon className="w-4 h-4 mr-1" />
                            {formatDuration(course.duration)}
                          </div>
                          {course.instructor && (
                            <div className="flex items-center">
                              <UserIcon className="w-4 h-4 mr-1" />
                              {course.instructor.first_name} {course.instructor.last_name}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Avaliações */}
                      {course.stats && course.stats.ratings_count > 0 && (
                        <div className="flex items-center mb-3">
                          <div className="flex items-center mr-2">
                            {renderStars(course.stats.average_rating)}
                          </div>
                          <span className="text-sm text-gray-600">
                            {course.stats.average_rating.toFixed(1)} ({course.stats.ratings_count} avaliações)
                          </span>
                        </div>
                      )}

                      {/* Botão de ação */}
                      {enrolled ? (
                        <button
                          onClick={() => window.location.href = `/academy/course/${course.id}`}
                          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                        >
                          <PlayIcon className="w-4 h-4 mr-2" />
                          {progress > 0 ? 'Continuar' : 'Iniciar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEnroll(course.id)}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                        >
                          <BookOpenIcon className="w-4 h-4 mr-2" />
                          Matricular-se
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default AcademyPage;
