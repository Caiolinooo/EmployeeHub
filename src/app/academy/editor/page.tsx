'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  VideoCameraIcon,
  TagIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { canEditAcademy } from '@/lib/permissions';
import { useI18n } from '@/contexts/I18nContext';
import DeleteCourseModal from '@/components/Academy/DeleteCourseModal';

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

const AcademyEditor: React.FC = () => {
  const router = useRouter();
  const { user, getToken } = useSupabaseAuth();
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  useEffect(() => {
    if (user) {
      if (!canEditAcademy(user)) {
        router.push('/academy');
        return;
      }
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setError(t('academy.tokenDeAutenticacaoNaoEncontrado'));
        return;
      }

      // Carregar categorias
      const categoriesResponse = await fetch('/api/academy/categories');
      const categoriesData = await categoriesResponse.json();

      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      }

      // Carregar cursos (incluindo não publicados para editores)
      const coursesResponse = await fetch('/api/academy/courses?include_unpublished=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const coursesData = await coursesResponse.json();

      if (coursesData.success) {
        setCourses(coursesData.courses);
      } else {
        setError(coursesData.error || 'Erro ao carregar cursos');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const promptDeleteCourse = (course: Course) => {
    setCourseToDelete(course);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (deleteCertificates: boolean) => {
    if (!courseToDelete) return;

    setDeleteModalOpen(false);

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/academy/courses?id=${courseToDelete.id}&deleteCertificates=${deleteCertificates}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setCourses(courses.filter(c => c.id !== courseToDelete.id));
      } else {
        alert(data.error || 'Erro ao excluir curso');
      }
    } catch (error) {
      console.error('Erro ao excluir curso:', error);
      alert('Erro ao excluir curso');
    } finally {
      setCourseToDelete(null);
    }
  };

  const handleTogglePublish = async (courseId: string, currentStatus: boolean) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/courses', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: courseId,
          is_published: !currentStatus
        })
      });

      const data = await response.json();

      if (data.success) {
        setCourses(courses.map(c =>
          c.id === courseId
            ? { ...c, is_published: !currentStatus }
            : c
        ));
      } else {
        alert(data.error || 'Erro ao atualizar status do curso');
      }
    } catch (error) {
      console.error('Erro ao atualizar curso:', error);
      alert('Erro ao atualizar curso');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  // Filtrar cursos
  const filteredCourses = courses.filter(course => {
    switch (filter) {
      case 'published':
        return course.is_published;
      case 'draft':
        return !course.is_published;
      case 'all':
      default:
        return true;
    }
  });

  // Estatísticas
  const stats = {
    total: courses.length,
    published: courses.filter(c => c.is_published).length,
    draft: courses.filter(c => !c.is_published).length,
    featured: courses.filter(c => c.is_featured).length
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('academy.acessoRestrito')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('academy.facaLoginParaAcessarOEditor')}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!canEditAcademy(user)) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <XCircleIcon className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('academy.permissaoNegada')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('academy.voceNaoTemPermissaoParaEditarCursos')}
            </p>
            <div className="mt-6">
              <button
                onClick={() => router.push('/academy')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                {t('academy.voltarAoAcademy')}
              </button>
            </div>
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
                <XCircleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{t('academy.erro')}</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => loadData()}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    {t('academy.tentarNovamente')}
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
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 max-md:min-h-11"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            {t('academy.voltarAoAcademy')}
          </button>

          <div className="flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-3">
            <div className="flex items-center min-w-0">
              <PencilIcon className="w-8 h-8 text-blue-600 mr-3 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-3xl max-md:text-xl font-bold text-gray-900">{t('academy.editorDoAcademy')}</h1>
                <p className="text-gray-600 mt-1">
                  {t('academy.gerencieCursosEConteudo')}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push('/academy/editor/create')}
              className="bg-blue-600 text-white px-4 py-2 max-md:min-h-11 max-md:w-full rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span>{t('academy.novoCurso')}</span>
            </button>
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
                <p className="text-sm font-medium text-gray-600">{t('academy.totalDeCursos')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('academy.publicados')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.published}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PencilIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('academy.rascunhos')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TagIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('academy.emDestaque')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.featured}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 max-md:min-h-11 rounded-md text-sm font-medium transition-colors ${filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              {t('academy.todos')} ({stats.total})
            </button>
            <button
              onClick={() => setFilter('published')}
              className={`px-4 py-2 max-md:min-h-11 rounded-md text-sm font-medium transition-colors ${filter === 'published'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              {t('academy.publicados')} ({stats.published})
            </button>
            <button
              onClick={() => setFilter('draft')}
              className={`px-4 py-2 max-md:min-h-11 rounded-md text-sm font-medium transition-colors ${filter === 'draft'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              {t('academy.rascunhos')} ({stats.draft})
            </button>
          </div>
        </div>

        {/* Lista de cursos */}
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {filter === 'all' ? t('academy.nenhumCursoCriado') :
                filter === 'published' ? t('academy.nenhumCursoPublicado') :
                  t('academy.nenhumRascunho')}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' ? t('academy.comeceCriandoSeuPrimeiroCurso') :
                t('academy.ajusteOsFiltrosOuCrieNovos')}
            </p>
            {filter === 'all' && (
              <div className="mt-6">
                <button
                  onClick={() => router.push('/academy/editor/create')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  {t('academy.criarPrimeiroCurso')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('academy.curso')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('academy.categoria')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('academy.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('academy.estatisticas')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('academy.atualizado')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('academy.acoes')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            <img
                              className="h-12 w-12 rounded-lg object-cover"
                              src={course.thumbnail_url || '/images/course-default.svg'}
                              alt={course.title}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                              {course.title}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center space-x-4">
                              <span className="flex items-center">
                                <ClockIcon className="w-4 h-4 mr-1" />
                                {formatDuration(course.duration)}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(course.difficulty_level)}`}>
                                {getDifficultyLabel(course.difficulty_level)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {course.category ? (
                          <span
                            className="px-2 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${course.category.color}20`,
                              color: course.category.color
                            }}
                          >
                            {course.category.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">{t('academy.semCategoria')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${course.is_published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {course.is_published ? t('academy.publicado') : t('academy.rascunho')}
                          </span>
                          {course.is_featured && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                              {t('academy.destaque')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="space-y-1">
                          <div>{course.stats?.enrollments || 0} {t('academy.alunos')}</div>
                          <div>{course.view_count} {t('academy.visualizacoes')}</div>
                          {course.stats?.ratings_count && course.stats.ratings_count > 0 && (
                            <div className="flex items-center">
                              <span className="text-yellow-400">★</span>
                              <span className="ml-1">{course.stats.average_rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(course.updated_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => router.push(`/academy/course/${course.id}`)}
                            className="text-gray-600 hover:text-gray-900 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center"
                            title={t('academy.visualizar')}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/academy/editor/edit/${course.id}`)}
                            className="text-blue-600 hover:text-blue-900 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center"
                            title={t('academy.editar')}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleTogglePublish(course.id, course.is_published)}
                            className={`${course.is_published ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'} max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center`}
                            title={course.is_published ? t('academy.despublicar') : t('academy.publicar')}
                          >
                            {course.is_published ? <XCircleIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => promptDeleteCourse(course)}
                            className="text-red-600 hover:text-red-900 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center"
                            title={t('academy.excluir')}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <DeleteCourseModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCourseToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        courseTitle={courseToDelete?.title || ''}
      />
    </MainLayout>
  );
};

export default AcademyEditor;

