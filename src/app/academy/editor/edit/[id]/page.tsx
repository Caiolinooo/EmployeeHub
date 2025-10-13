'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import { fetchWithAuth } from '@/lib/authUtils';
import { 
  ArrowLeftIcon,
  PhotoIcon,
  VideoCameraIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { canEditAcademy } from '@/lib/permissions';
import { useI18n } from '@/contexts/I18nContext';

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
  category_id: string;
  difficulty_level: string;
  duration: number;
  video_url?: string;
  thumbnail_url?: string;
  tags: string[];
  prerequisites: string[];
  learning_objectives: string[];
  is_published: boolean;
  is_featured: boolean;
  instructor_id: string;
}

const EditCoursePage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { user, hasFeature } = useSupabaseAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const courseId = (params as any)?.id as string;

  const [newTag, setNewTag] = useState('');
  const [newPrerequisite, setNewPrerequisite] = useState('');
  const [newObjective, setNewObjective] = useState('');

  useEffect(() => {
    if (user && courseId) {
      if (!canEditAcademy(user)) {
        router.push('/academy');
        return;
      }
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, courseId, router]);

  const loadData = async () => {
    try {
      // Carregar categorias
      const categoriesResponse = await fetch('/api/academy/categories');
      const categoriesData = await categoriesResponse.json();
      
      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      }

      // Carregar curso
      const courseResponse = await fetch(`/api/academy/courses?course_id=${courseId}`);
      
      const courseData = await courseResponse.json();

      if (courseData.success && courseData.courses.length > 0) {
        const courseInfo = courseData.courses[0];
        
        // Verificar se o usuário pode editar este curso
        const canEdit = !!user && (hasFeature('academy_editor') || user.role === 'ADMIN');
        if (!canEdit) {
          setError(t('academy.voceNaoTemPermissaoParaEditarEsteCurso'));
          return;
        }

        setCourse(courseInfo);
      } else {
        setError(t('academy.cursoNaoEncontrado'));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Course, value: any) => {
    if (!course) return;
    
    setCourse(prev => ({
      ...prev!,
      [field]: value
    }));
  };

  const addTag = () => {
    if (!course || !newTag.trim() || course.tags.includes(newTag.trim())) return;
    
    setCourse(prev => ({
      ...prev!,
      tags: [...prev!.tags, newTag.trim()]
    }));
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    if (!course) return;
    
    setCourse(prev => ({
      ...prev!,
      tags: prev!.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addPrerequisite = () => {
    if (!course || !newPrerequisite.trim() || course.prerequisites.includes(newPrerequisite.trim())) return;
    
    setCourse(prev => ({
      ...prev!,
      prerequisites: [...prev!.prerequisites, newPrerequisite.trim()]
    }));
    setNewPrerequisite('');
  };

  const removePrerequisite = (prereqToRemove: string) => {
    if (!course) return;
    
    setCourse(prev => ({
      ...prev!,
      prerequisites: prev!.prerequisites.filter(prereq => prereq !== prereqToRemove)
    }));
  };

  const addObjective = () => {
    if (!course || !newObjective.trim() || course.learning_objectives.includes(newObjective.trim())) return;
    
    setCourse(prev => ({
      ...prev!,
      learning_objectives: [...prev!.learning_objectives, newObjective.trim()]
    }));
    setNewObjective('');
  };

  const removeObjective = (objToRemove: string) => {
    if (!course) return;
    
    setCourse(prev => ({
      ...prev!,
      learning_objectives: prev!.learning_objectives.filter(obj => obj !== objToRemove)
    }));
  };

  const validateForm = (): string | null => {
    if (!course) return t('academy.dadosDoCursoNaoCarregados');
    if (!course.title.trim()) return t('academy.tituloEObrigatorio');
    if (!course.description.trim()) return t('academy.descricaoEObrigatoria');
    if (!course.category_id) return t('academy.categoriaEObrigatoria');
    if (!course.difficulty_level) return t('academy.nivelDeDificuldadeEObrigatorio');
    if (course.duration <= 0) return t('academy.duracaoDeveSerMaiorQueZero');
    if (!course.video_url?.trim()) return t('academy.urlDoVideoEObrigatoria');

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`/api/academy/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(course)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/academy/editor');
        }, 2000);
      } else {
        setError(data.error || 'Erro ao atualizar curso');
      }
    } catch (error) {
      console.error('Erro ao atualizar curso:', error);
      setError('Erro ao atualizar curso');
    } finally {
      setSubmitting(false);
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

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Acesso restrito</h3>
            <p className="mt-1 text-sm text-gray-500">
              Faça login para acessar o editor do Academy.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!hasFeature('academy_editor')) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Permissão negada</h3>
            <p className="mt-1 text-sm text-gray-500">
              Você não tem permissão para editar cursos do Academy.
            </p>
            <div className="mt-6">
              <button
                onClick={() => router.push('/academy')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Voltar ao Academy
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
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erro</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4 space-x-3">
                  <button
                    onClick={() => router.push('/academy/editor')}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Voltar ao Editor
                  </button>
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

  if (success) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">Curso atualizado com sucesso!</h3>
            <p className="mt-1 text-sm text-gray-500">
              Redirecionando para o painel de editor...
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!course) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Curso não encontrado</h3>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/academy/editor')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar ao Editor
          </button>
          
          <div className="flex items-center">
            <PencilIcon className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Editar Curso</h1>
              <p className="text-gray-600 mt-1">
                {course.title}
              </p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Informações básicas */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título do Curso *
                </label>
                <input
                  type="text"
                  value={course.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('academy.exIntroducaoAoReactjs')}
                  maxLength={200}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição Curta
                </label>
                <input
                  type="text"
                  value={course.short_description || ''}
                  onChange={(e) => handleInputChange('short_description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Resumo do curso em uma linha"
                  maxLength={300}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição Completa *
                </label>
                <textarea
                  value={course.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                  placeholder={t('academy.descricaoDetalhadaDoCursoConteudoAbordadoEtc')}
                  maxLength={2000}
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {course.description.length}/2000 caracteres
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria *
                </label>
                <select
                  value={course.category_id}
                  onChange={(e) => handleInputChange('category_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nível de Dificuldade *
                </label>
                <select
                  value={course.difficulty_level}
                  onChange={(e) => handleInputChange('difficulty_level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Iniciante</option>
                  <option value="intermediate">Intermediário</option>
                  <option value="advanced">Avançado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duração (em segundos) *
                </label>
                <input
                  type="number"
                  value={course.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 3600 (1 hora)"
                  min="1"
                />
                {course.duration > 0 && (
                  <div className="text-sm text-gray-500 mt-1">
                    Duração: {formatDuration(course.duration)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mídia */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mídia</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <VideoCameraIcon className="w-4 h-4 inline mr-1" />
                  URL do Vídeo *
                </label>
                <input
                  type="url"
                  value={course.video_url || ''}
                  onChange={(e) => handleInputChange('video_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://drive.google.com/file/d/..."
                />
                <div className="text-xs text-gray-500 mt-1">
                  URL do Google Drive ou outro serviço de vídeo
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <PhotoIcon className="w-4 h-4 inline mr-1" />
                  URL da Thumbnail
                </label>
                <input
                  type="url"
                  value={course.thumbnail_url || ''}
                  onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://exemplo.com/thumbnail.jpg"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Imagem de capa do curso (opcional)
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
            
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite uma tag e pressione Enter"
                  maxLength={50}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {course.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Pré-requisitos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pré-requisitos</h3>
            
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newPrerequisite}
                  onChange={(e) => setNewPrerequisite(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPrerequisite())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('academy.digiteUmPrerequisitoEPressioneEnter')}
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={addPrerequisite}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {course.prerequisites.map((prereq, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-700">{prereq}</span>
                  <button
                    type="button"
                    onClick={() => removePrerequisite(prereq)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Objetivos de aprendizagem */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Objetivos de Aprendizagem</h3>
            
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite um objetivo e pressione Enter"
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={addObjective}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {course.learning_objectives.map((objective, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-700">{objective}</span>
                  <button
                    type="button"
                    onClick={() => removeObjective(objective)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Configurações de publicação */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações de Publicação</h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_published"
                  checked={course.is_published}
                  onChange={(e) => handleInputChange('is_published', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_published" className="ml-2 block text-sm text-gray-900">
                  Curso publicado
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={course.is_featured}
                  onChange={(e) => handleInputChange('is_featured', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_featured" className="ml-2 block text-sm text-gray-900">
                  Destacar curso na página principal
                </label>
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push('/academy/editor')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : null}
              {submitting ? t('academy.salvando') : t('academy.salvarAlteracoes')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

export default EditCoursePage;
