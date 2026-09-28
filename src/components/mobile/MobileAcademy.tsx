'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type AcademyCourse = {
  id: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  duration?: number | null;
  difficulty_level?: string | null;
  is_featured?: boolean | null;
  category?: { id?: string; name?: string; color?: string | null } | null;
};

type AcademyEnrollment = {
  id: string;
  course_id: string;
  enrolled_at?: string | null;
  completed_at?: string | null;
  is_active: boolean;
  course?: AcademyCourse | null;
  progress?: { progress_percentage?: number | null }[] | null;
};

function difficultyLabel(difficulty?: string | null): string {
  switch ((difficulty || '').toLowerCase()) {
    case 'beginner':
      return 'Iniciante';
    case 'intermediate':
      return 'Intermediário';
    case 'advanced':
      return 'Avançado';
    default:
      return difficulty || '';
  }
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
}

function enrollmentProgress(enrollment: AcademyEnrollment): number {
  return enrollment.progress?.[0]?.progress_percentage ?? 0;
}

export default function MobileAcademy() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();

  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    const params = new URLSearchParams();
    params.append('published', 'true');
    if (searchTerm.trim()) params.append('search', searchTerm.trim());

    const res = await fetch(`/api/academy/courses?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success) {
      setCourses(Array.isArray(data.courses) ? data.courses : []);
    } else {
      throw new Error(data.error || 'Erro ao carregar cursos');
    }
  }, [searchTerm]);

  const loadEnrollments = useCallback(async () => {
    if (!user?.id) return;
    const token = getToken();
    if (!token) return;
    const res = await fetch('/api/academy/enrollments', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      setEnrollments(Array.isArray(data.enrollments) ? data.enrollments : []);
    }
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadCourses();
      await loadEnrollments();
    } catch {
      setError('Não foi possível carregar os cursos.');
    } finally {
      setLoading(false);
    }
  }, [loadCourses, loadEnrollments]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const enroll = async (courseId: string) => {
    if (!user?.id) return;
    setEnrollingId(courseId);
    setSuccessMsg(null);
    try {
      const token = getToken();
      if (!token) throw new Error('Sessão expirada');
      const res = await fetch('/api/academy/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ course_id: courseId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao realizar matrícula');
      }
      setSuccessMsg('Matrícula realizada com sucesso.');
      await loadEnrollments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao realizar matrícula.');
    } finally {
      setEnrollingId(null);
    }
  };

  const activeEnrollments = enrollments.filter((e) => e.is_active);
  const enrolledCourseIds = new Set(activeEnrollments.map((e) => e.course_id));

  return (
    <MobileShell title="Academy">
      <div className="flex flex-col gap-3" data-abz-mobile-academy="">
        {successMsg ? (
          <div className="abz-m-alert-ok rounded-xl p-3 text-sm" role="status">
            {successMsg}
          </div>
        ) : null}
        {error ? (
          <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
            {error}
            <TouchButton variant="ghost" className="mt-1" onClick={load}>
              Tentar de novo
            </TouchButton>
          </div>
        ) : null}

        {isAuthenticated && activeEnrollments.length > 0 ? (
          <>
            <h2 className="text-sm font-semibold text-gray-700">Meus cursos</h2>
            {activeEnrollments.map((enrollment) => {
              const progress = enrollmentProgress(enrollment);
              const completed = Boolean(enrollment.completed_at) || progress >= 100;
              return (
                <DataCard
                  key={enrollment.id}
                  title={enrollment.course?.title || 'Curso'}
                  subtitle={enrollment.course?.category?.name || undefined}
                  meta={formatDuration(enrollment.course?.duration) || undefined}
                  onClick={() => router.push(`/academy/course/${enrollment.course_id}`)}
                >
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-1.5 rounded-full ${completed ? 'bg-emerald-500' : 'bg-[#005B96]'}`}
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                      />
                    </div>
                    <span
                      className={`mt-1 block text-xs font-semibold ${completed ? 'text-emerald-700' : 'text-gray-500'}`}
                    >
                      {completed ? 'Concluído' : progress > 0 ? `${progress}% concluído` : 'Não iniciado'}
                    </span>
                  </div>
                </DataCard>
              );
            })}
          </>
        ) : null}

        <h2 className="text-sm font-semibold text-gray-700">Catálogo</h2>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cursos..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base"
        />

        {courses.map((course) => {
          const enrolled = enrolledCourseIds.has(course.id);
          return (
            <DataCard
              key={course.id}
              title={course.title}
              subtitle={course.short_description || course.category?.name || undefined}
              meta={difficultyLabel(course.difficulty_level) || undefined}
              onClick={() => router.push(`/academy/course/${course.id}`)}
            >
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400">
                  {[formatDuration(course.duration), course.category?.name]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {isAuthenticated && !enrolled ? (
                  <TouchButton
                    variant="ghost"
                    className="px-3 text-sm"
                    disabled={enrollingId === course.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      enroll(course.id);
                    }}
                  >
                    {enrollingId === course.id ? 'Matriculando…' : 'Matricular-se'}
                  </TouchButton>
                ) : null}
                {enrolled ? (
                  <span className="text-xs font-semibold text-[#005B96]">Matriculado</span>
                ) : null}
              </div>
            </DataCard>
          );
        })}

        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
        ) : null}
        {!loading && courses.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-gray-500">Nenhum curso encontrado.</p>
        ) : null}
        {!isAuthenticated && !authLoading ? (
          <p className="py-4 text-center text-sm text-gray-500">
            Entre para se matricular e acompanhar seu progresso.
          </p>
        ) : null}
      </div>
    </MobileShell>
  );
}
