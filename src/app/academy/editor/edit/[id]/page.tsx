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
import QuizEditor from '@/components/Academy/QuizEditor';
import PendingAssessments from '@/components/Academy/PendingAssessments';
import ModuleEditor from '@/components/Academy/ModuleEditor';

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
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'modules' | 'quiz' | 'grading'>('info');

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
      setError(t('academy.erroAoCarregarDados'));
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
      const response = await fetchWithAuth('/api/academy/courses', {
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
        setError(data.error || t('academy.erroAoAtualizarCurso'));
      }
    } catch (error) {
      console.error('Erro ao atualizar curso:', error);
      setError(t('academy.erroAoAtualizarCurso'));
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('academy.acessoRestrito')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('academy.facaLoginParaAcessarOEditor')}
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('academy.permissaoNegada')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('academy.voceNaoTemPermissaoParaEditarEsteCurso')}
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
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-red-800">{t('academy.erro')}</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4 space-x-3">
                  <button
                    onClick={() => router.push('/academy/editor')}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    {t('academy.voltarAoEditor')}
                  </button>
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

  if (success) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">{t('academy.cursoAtualizadoComSucesso')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('academy.redirecionandoParaOPainel')}
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('academy.cursoNaoEncontrado')}</h3>
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
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 max-md:min-h-11"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            {t('academy.voltarAoEditor')}
          </button>

          <div className="flex items-center min-w-0">
            <PencilIcon className="w-8 h-8 text-blue-600 mr-3 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-3xl max-md:text-xl font-bold text-gray-900">{t('academy.editarCurso')}</h1>
              <p className="text-gray-600 mt-1">
                {course.title}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8 max-md:space-x-4 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={(e) => { e.preventDefault(); setActiveTab('info'); }}
              className={`
                whitespace-nowrap py-4 px-1 max-md:min-h-11 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              Informações Gerais
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setActiveTab('modules'); }}
              className={`
                whitespace-nowrap py-4 px-1 max-md:min-h-11 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'modules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              Módulos
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setActiveTab('quiz'); }}
              className={`
                whitespace-nowrap py-4 px-1 max-md:min-h-11 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'quiz'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              Criar Avaliação / Perguntas
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setActiveTab('grading'); }}
              className={`
                whitespace-nowrap py-4 px-1 max-md:min-h-11 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'grading'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              Correção Manual Pendente
            </button>
          </nav>
        </div>

        {/* Content Tabs */}
        {activeTab === 'info' && (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informações básicas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('academy.informacoesBasicas')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('academy.tituloDoCurso')}
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
                    {t('academy.descricaoCurta')}
                  </label>
                  <input
                    type="text"
                    value={course.short_description || ''}
                    onChange={(e) => handleInputChange('short_description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('academy.resumoDoCursoEmUmaLinha')}
                    maxLength={300}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('academy.descricaoCompleta')}
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
                    {course.description.length}/2000 {t('academy.caracteres')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('academy.categoria')}
                  </label>
                  <select
                    value={course.category_id}
                    onChange={(e) => handleInputChange('category_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('academy.selecioneUmaCategoria')}</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('academy.nivelDeDificuldadeAss')}
                  </label>
                  <select
                    value={course.difficulty_level}
                    onChange={(e) => handleInputChange('difficulty_level', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="beginner">{t('academy.iniciante')}</option>
                    <option value="intermediate">{t('academy.intermediario')}</option>
                    <option value="advanced">{t('academy.avancado')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('academy.duracaoEmSegundos')}
                  </label>
                  <input
                    type="number"
                    value={course.duration}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('academy.ex1Hora')}
                    min="1"
                  />
                  {course.duration > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      {t('academy.duracao')}: {formatDuration(course.duration)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mídia */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('academy.midia')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <VideoCameraIcon className="w-4 h-4 inline mr-1" />
                    {t('academy.urlDoVideoAss')}
                  </label>
                  <input
                    type="url"
                    value={course.video_url || ''}
                    onChange={(e) => handleInputChange('video_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://drive.google.com/file/d/..."
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {t('academy.urlDoGoogleDrive')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <PhotoIcon className="w-4 h-4 inline mr-1" />
                    {t('academy.urlDaThumbnail')}
                  </label>
                  <input
                    type="url"
                    value={course.thumbnail_url || ''}
                    onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://exemplo.com/thumbnail.jpg"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {t('academy.imagemDeCapaDoCurso')}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('academy.tags')}</h3>

              <div className="mb-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('academy.digiteUmaTagEPressioneEnter')}
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 max-md:min-h-11 max-md:min-w-11 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                      className="ml-2 text-blue-600 hover:text-blue-800 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center"
                    >
                      <XMarkIcon className="w-3 h-3 max-md:w-4 max-md:h-4" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Pré-requisitos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('academy.preRequisitos')}</h3>

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
                    className="px-4 py-2 max-md:min-h-11 max-md:min-w-11 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                      className="text-red-600 hover:text-red-800 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Objetivos de aprendizagem */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('academy.objetivosDeAprendizagem')}</h3>

              <div className="mb-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newObjective}
                    onChange={(e) => setNewObjective(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('academy.digiteUmObjetivoEPressioneEnter')}
                    maxLength={200}
                  />
                  <button
                    type="button"
                    onClick={addObjective}
                    className="px-4 py-2 max-md:min-h-11 max-md:min-w-11 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                      className="text-red-600 hover:text-red-800 max-md:min-h-11 max-md:min-w-11 max-md:inline-flex max-md:items-center max-md:justify-center"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Configurações de publicação */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('academy.configuracoesDePublicacao')}</h3>

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
                    {t('academy.cursoPublicadoInput')}
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
                    {t('academy.destacarCursoNaPaginaPrincipal')}
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
                {t('academy.cancelar')}
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
        )}

        {activeTab === 'modules' && (
          <ModuleEditor courseId={courseId} />
        )}

        {activeTab === 'quiz' && (
          <QuizEditor courseId={courseId} />
        )}

        {activeTab === 'grading' && (
          <PendingAssessments courseId={courseId} />
        )}
      </div>
    </MainLayout>
  );
};

export default EditCoursePage;
