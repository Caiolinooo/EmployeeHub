'use client';

import React, { useState, useEffect } from 'react';
import { 
  StarIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  UserCircleIcon,
  HandThumbUpIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { canModerateContent } from '@/lib/permissions';
import { useI18n } from '@/contexts/I18nContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  profile_data?: any;
}

interface Rating {
  id: string;
  course_id: string;
  user_id: string;
  rating: number;
  review?: string;
  is_active: boolean;
  is_edited: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  user: User;
}

interface RatingStats {
  total_ratings: number;
  average_rating: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface RatingsProps {
  courseId: string;
  isEnrolled?: boolean;
  className?: string;
}

const Ratings: React.FC<RatingsProps> = ({ courseId, isEnrolled = false, className = '' }) => {
  const { user, getToken } = useSupabaseAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [editingRating, setEditingRating] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editReview, setEditReview] = useState('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'created_at' | 'rating' | 'helpful_count'>('created_at');

  useEffect(() => {
    loadRatings();
  }, [courseId, sortBy]);

  const loadRatings = async () => {
    try {
      const response = await fetch(`/api/academy/ratings?course_id=${courseId}&sort_by=${sortBy}&sort_order=desc`);
      const data = await response.json();

      if (data.success) {
        setRatings(data.ratings);
        setStats(data.stats);
      } else {
        console.error(t('components.erroAoCarregarAvaliacoes'), data.error);
      }
    } catch (error) {
      console.error(t('components.erroAoCarregarAvaliacoes'), error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !userRating) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          course_id: courseId,
          rating: userRating,
          review: userReview.trim() || null
        })
      });

      const data = await response.json();

      if (data.success) {
        setUserRating(0);
        setUserReview('');
        setShowRatingForm(false);
        await loadRatings();
      } else {
        alert(data.error || 'Erro ao enviar avaliação');
      }
    } catch (error) {
      console.error(t('components.erroAoEnviarAvaliacao'), error);
      alert('Erro ao enviar avaliação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRating = async (ratingId: string) => {
    if (!user || !editRating) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/ratings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating_id: ratingId,
          rating: editRating,
          review: editReview.trim() || null
        })
      });

      const data = await response.json();

      if (data.success) {
        setEditRating(0);
        setEditReview('');
        setEditingRating(null);
        await loadRatings();
      } else {
        alert(data.error || 'Erro ao editar avaliação');
      }
    } catch (error) {
      console.error(t('components.erroAoEditarAvaliacao'), error);
      alert('Erro ao editar avaliação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRating = async (ratingId: string) => {
    if (!confirm({t('components.temCertezaQueDesejaExcluirEstaAvaliacao')})) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/academy/ratings?rating_id=${ratingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        await loadRatings();
      } else {
        alert(data.error || 'Erro ao excluir avaliação');
      }
    } catch (error) {
      console.error(t('components.erroAoExcluirAvaliacao'), error);
      alert('Erro ao excluir avaliação');
    }
  };

  const renderStars = (rating: number, interactive = false, onStarClick?: (star: number) => void) => {
    return Array.from({ length: 5 }, (_, i) => {
      const starNumber = i + 1;
      const isFilled = starNumber <= rating;
      
      return (
        <button
          key={i}
          type="button"
          onClick={() => interactive && onStarClick && onStarClick(starNumber)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          disabled={!interactive}
        >
          {isFilled ? (
            <StarIconSolid className="h-5 w-5 text-yellow-400" />
          ) : (
            <StarIcon className="h-5 w-5 text-gray-300" />
          )}
        </button>
      );
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Hoje';
    if (diffDays === 2) return 'Ontem';
    if (diffDays <= 7) return {t('components.diffdaysDiasAtras')};
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getUserAvatar = (user: User) => {
    if (user.profile_data?.avatar_url) {
      return user.profile_data.avatar_url;
    }
    return null;
  };

  const canEditRating = (rating: Rating) => {
    return user && rating.user_id === user.id;
  };

  const canDeleteRating = (rating: Rating) => {
    return user && (rating.user_id === user.id || canModerateContent(user, 'rating'));
  };

  const hasUserRated = ratings.some(r => r.user_id === user?.id);

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <StarIcon className="w-5 h-5 mr-2" />
          Avaliações ({stats?.total_ratings || 0})
        </h3>

        {/* Estatísticas de avaliação */}
        {stats && stats.total_ratings > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Média geral */}
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {stats.average_rating.toFixed(1)}
                </div>
                <div className="flex items-center justify-center mb-2">
                  {renderStars(Math.round(stats.average_rating))}
                </div>
                <p className="text-sm text-gray-600">
                  Baseado em {stats.total_ratings} avaliação{stats.total_ratings > 1 ? {t('components.oes')} : ''}
                </p>
              </div>

              {/* Distribuição por estrelas */}
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = stats.rating_distribution[star as keyof typeof stats.rating_distribution];
                  const percentage = stats.total_ratings > 0 ? (count / stats.total_ratings) * 100 : 0;
                  
                  return (
                    <div key={star} className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 w-8">{star}★</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-8">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Formulário de avaliação */}
        {user && isEnrolled && !hasUserRated && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            {!showRatingForm ? (
              <div className="text-center">
                <p className="text-gray-600 mb-4">Compartilhe sua experiência com este curso</p>
                <button
                  onClick={() => setShowRatingForm(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Avaliar Curso
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitRating}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sua avaliação
                  </label>
                  <div className="flex items-center space-x-1">
                    {renderStars(userRating, true, setUserRating)}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comentário (opcional)
                  </label>
                  <textarea
                    value={userReview}
                    onChange={(e) => setUserReview(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    maxLength={2000}
                    placeholder={t('components.conteSobreSuaExperienciaComEsteCurso')}
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {userReview.length}/2000 caracteres
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRatingForm(false);
                      setUserRating(0);
                      setUserReview('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || userRating === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : null}
                    {submitting ? 'Enviando...' : {t('components.enviarAvaliacao')}}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {!user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-gray-600">Faça login e matricule-se no curso para avaliar.</p>
          </div>
        )}

        {user && !isEnrolled && (
          <div className="bg-yellow-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-yellow-800">Matricule-se no curso para poder avaliá-lo.</p>
          </div>
        )}

        {user && isEnrolled && hasUserRated && (
          <div className="bg-green-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-green-800">Obrigado por avaliar este curso!</p>
          </div>
        )}

        {/* Filtros e ordenação */}
        {ratings.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="created_at">Mais recentes</option>
                <option value="rating">Maior avaliação</option>
                <option value="helpful_count">Mais úteis</option>
              </select>
            </div>
          </div>
        )}

        {/* Lista de avaliações */}
        {ratings.length === 0 ? (
          <div className="text-center py-8">
            <StarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma avaliação ainda</h3>
            <p className="mt-1 text-sm text-gray-500">
              Seja o primeiro a avaliar este curso.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ratings.map(rating => (
              <div key={rating.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      {getUserAvatar(rating.user) ? (
                        <img
                          src={getUserAvatar(rating.user)}
                          alt={`${rating.user.first_name} ${rating.user.last_name}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <UserCircleIcon className="w-10 h-10 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-gray-900">
                          {rating.user.first_name} {rating.user.last_name}
                        </span>
                        <div className="flex items-center">
                          {renderStars(rating.rating)}
                        </div>
                        <span className="text-sm text-gray-500">{formatDate(rating.created_at)}</span>
                        {rating.is_edited && (
                          <span className="text-xs text-gray-400">(editado)</span>
                        )}
                      </div>
                      
                      {editingRating === rating.id ? (
                        <div className="mt-3">
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Avaliação
                            </label>
                            <div className="flex items-center space-x-1">
                              {renderStars(editRating, true, setEditRating)}
                            </div>
                          </div>
                          
                          <textarea
                            value={editReview}
                            onChange={(e) => setEditReview(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            maxLength={2000}
                            placeholder={t('components.editeSeuComentario')}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {editReview.length}/2000 caracteres
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setEditingRating(null);
                                  setEditRating(0);
                                  setEditReview('');
                                }}
                                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleEditRating(rating.id)}
                                disabled={submitting || editRating === 0}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {submitting ? 'Salvando...' : 'Salvar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {rating.review && (
                            <p className="text-gray-700 mt-2 whitespace-pre-wrap">{rating.review}</p>
                          )}
                          
                          <div className="flex items-center space-x-4 mt-3">
                            <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center">
                              <HandThumbUpIcon className="w-4 h-4 mr-1" />
                              Útil ({rating.helpful_count})
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Menu de ações */}
                  {user && (canEditRating(rating) || canDeleteRating(rating)) && (
                    <div className="relative">
                      <button
                        onClick={() => setShowDropdown(showDropdown === rating.id ? null : rating.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                      </button>
                      
                      {showDropdown === rating.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            {canEditRating(rating) && (
                              <button
                                onClick={() => {
                                  setEditingRating(rating.id);
                                  setEditRating(rating.rating);
                                  setEditReview(rating.review || '');
                                  setShowDropdown(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <PencilIcon className="w-4 h-4 mr-2" />
                                Editar
                              </button>
                            )}
                            
                            {canDeleteRating(rating) && (
                              <button
                                onClick={() => {
                                  handleDeleteRating(rating.id);
                                  setShowDropdown(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                              >
                                <TrashIcon className="w-4 h-4 mr-2" />
                                Excluir
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ratings;
