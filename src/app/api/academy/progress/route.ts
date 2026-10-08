import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAcademyAuth } from '@/lib/middleware/academy-auth';
import { canWithGrant } from '@/lib/permission-gate';
import { generateAndStoreCertificate } from '@/lib/certificates';
import { baseTemplate, academyCertificateTemplate } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

// GET - Obter progresso do usuário
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await withAcademyAuth(request, { requireAuth: true });

    if (authError || !user) {
      return authError || NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollment_id');
    const courseId = searchParams.get('course_id');
    const userId = searchParams.get('user_id') || user.id;

    // Verificar se o usuário pode ver progresso de outros usuários
    if (userId !== user.id) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users_unified')
        .select('role, access_permissions')
        .eq('id', user.id)
        .single();

      if (
        userError ||
        !userData ||
        !(await canWithGrant(user.id, userData.role, ['academy.progress.view_all'], 'admin'))
      ) {
        return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
      }
    }

    let query = supabaseAdmin
      .from('academy_progress')
      .select(`
        *,
        enrollment:academy_enrollments(
          id,
          user_id,
          course_id,
          enrolled_at,
          completed_at,
          course:academy_courses(
            id,
            title,
            duration,
            thumbnail_url
          )
        )
      `);

    if (enrollmentId) {
      query = query.eq('enrollment_id', enrollmentId);
    } else if (courseId) {
      // Buscar progresso por curso e usuário
      const { data: enrollments, error: enrollmentError } = await supabaseAdmin
        .from('academy_enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false })
        .limit(1);

      if (enrollmentError || !enrollments || enrollments.length === 0) {
        return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
      }

      query = query.eq('enrollment_id', enrollments[0].id);
    } else {
      // Buscar todos os progressos do usuário
      const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
        .from('academy_enrollments')
        .select('id')
        .eq('user_id', userId);

      if (enrollmentsError) {
        return NextResponse.json({ error: 'Erro ao buscar matrículas' }, { status: 500 });
      }

      const enrollmentIds = enrollments?.map(e => e.id) || [];
      if (enrollmentIds.length === 0) {
        return NextResponse.json({
          success: true,
          progress: []
        });
      }

      query = query.in('enrollment_id', enrollmentIds);
    }

    const { data: progress, error } = await query;

    if (error) {
      console.error('Erro ao buscar progresso:', error);
      return NextResponse.json({ error: 'Erro ao buscar progresso' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      progress: progress || []
    });

  } catch (error) {
    console.error('Erro na API de progresso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Atualizar progresso
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await withAcademyAuth(request, { requireAuth: true });

    if (authError || !user) {
      return authError || NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      enrollment_id,
      course_id,
      module_id,
      progress_percentage,
      last_watched_position,
      watch_time_increment
    } = body;

    if (!enrollment_id && !course_id) {
      return NextResponse.json({ error: 'enrollment_id ou course_id é obrigatório' }, { status: 400 });
    }

    let targetEnrollmentId = enrollment_id;

    // Se course_id foi fornecido, buscar enrollment_id
    if (!targetEnrollmentId && course_id) {
      const { data: enrollments, error: enrollmentError } = await supabaseAdmin
        .from('academy_enrollments')
        .select('id, user_id')
        .eq('user_id', user.id)
        .eq('course_id', course_id)
        .order('enrolled_at', { ascending: false })
        .limit(1);

      if (enrollmentError || !enrollments || enrollments.length === 0) {
        return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
      }

      targetEnrollmentId = enrollments[0].id;
    }

    // Verificar se o usuário é dono da matrícula
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from('academy_enrollments')
      .select('user_id, course_id')
      .eq('id', targetEnrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
    }

    if (enrollment.user_id !== user.id) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    // ── Module-level progress ──
    if (module_id) {
      // Upsert module progress
      const { data: existingModProg } = await supabaseAdmin
        .from('academy_module_progress')
        .select('*')
        .eq('enrollment_id', targetEnrollmentId)
        .eq('module_id', module_id)
        .single();

      const modUpdateData: any = {
        last_accessed_at: new Date().toISOString()
      };

      if (progress_percentage !== undefined) {
        modUpdateData.progress_percentage = existingModProg
          ? Math.max(existingModProg.progress_percentage || 0, Math.min(100, Math.round(progress_percentage)))
          : Math.min(100, Math.max(0, Math.round(progress_percentage)));
      }
      if (last_watched_position !== undefined) {
        modUpdateData.last_watched_position = Math.floor(Math.max(0, last_watched_position));
      }
      if (watch_time_increment !== undefined && existingModProg) {
        modUpdateData.total_watch_time = Math.floor((existingModProg.total_watch_time || 0) + Math.max(0, watch_time_increment));
      }
      if (modUpdateData.progress_percentage >= 100) {
        modUpdateData.completed_at = existingModProg?.completed_at || new Date().toISOString();
      }

      if (existingModProg) {
        const { error: updateError } = await supabaseAdmin
          .from('academy_module_progress')
          .update(modUpdateData)
          .eq('enrollment_id', targetEnrollmentId)
          .eq('module_id', module_id);

        if (updateError) console.error('Error updating module progress:', updateError);
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('academy_module_progress')
          .insert({
            enrollment_id: targetEnrollmentId,
            module_id,
            progress_percentage: modUpdateData.progress_percentage || 0,
            last_watched_position: modUpdateData.last_watched_position || 0,
            total_watch_time: Math.floor(watch_time_increment || 0),
            completed_at: modUpdateData.completed_at || null,
            last_accessed_at: modUpdateData.last_accessed_at
          });

        if (insertError) console.error('Error inserting module progress:', insertError);
      }

      // Recalculate overall progress from modules
      const { data: allModules } = await supabaseAdmin
        .from('academy_modules')
        .select('id')
        .eq('course_id', enrollment.course_id)
        .eq('is_published', true);

      const totalModules = allModules?.length || 0;

      if (totalModules > 0) {
        const { data: allModuleProgress } = await supabaseAdmin
          .from('academy_module_progress')
          .select('progress_percentage')
          .eq('enrollment_id', targetEnrollmentId);

        const totalProgressSum = (allModuleProgress || []).reduce(
          (sum: number, mp: any) => sum + (mp.progress_percentage || 0), 0
        );
        const overallPercentage = Math.round(totalProgressSum / totalModules);

        // Update or create overall progress
        const { data: existingOverall } = await supabaseAdmin
          .from('academy_progress')
          .select('id')
          .eq('enrollment_id', targetEnrollmentId)
          .single();

        const nowIso = new Date().toISOString();
        if (existingOverall) {
          await supabaseAdmin
            .from('academy_progress')
            .update({
              progress_percentage: overallPercentage,
              last_accessed_at: nowIso,
              updated_at: nowIso
            })
            .eq('enrollment_id', targetEnrollmentId);
        } else {
          await supabaseAdmin
            .from('academy_progress')
            .insert({
              enrollment_id: targetEnrollmentId,
              progress_percentage: overallPercentage,
              last_watched_position: 0,
              total_watch_time: 0,
              last_accessed_at: nowIso,
              updated_at: nowIso
            });
        }

        // Fetch final progress
        const { data: finalProgress } = await supabaseAdmin
          .from('academy_progress')
          .select('*')
          .eq('enrollment_id', targetEnrollmentId)
          .single();

        return NextResponse.json({
          success: true,
          message: 'Progresso do módulo atualizado',
          progress: finalProgress
        });
      }
    }

    // ── Course-level progress (no modules / legacy) ──
    // Buscar progresso atual
    const { data: currentProgress, error: progressError } = await supabaseAdmin
      .from('academy_progress')
      .select('*')
      .eq('enrollment_id', targetEnrollmentId)
      .single();

    if (progressError && progressError.code !== 'PGRST116') {
      console.error('Erro ao buscar progresso atual:', progressError);
      return NextResponse.json({ error: 'Erro ao buscar progresso atual' }, { status: 500 });
    }

    // Preparar dados de atualização
    const updateData: any = {
      last_accessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (progress_percentage !== undefined && currentProgress) {
      updateData.progress_percentage = Math.max(currentProgress.progress_percentage || 0, Math.min(100, Math.max(0, progress_percentage)));
    } else if (progress_percentage !== undefined) {
      updateData.progress_percentage = Math.min(100, Math.max(0, progress_percentage));
    }

    if (last_watched_position !== undefined) {
      updateData.last_watched_position = Math.floor(Math.max(0, last_watched_position));
    }

    if (watch_time_increment !== undefined && currentProgress) {
      updateData.total_watch_time = Math.floor((currentProgress.total_watch_time || 0) + Math.max(0, watch_time_increment));
    }

    let updatedProgress;

    if (currentProgress) {
      // Atualizar progresso existente
      const { data, error: updateError } = await supabaseAdmin
        .from('academy_progress')
        .update(updateData)
        .eq('enrollment_id', targetEnrollmentId)
        .select()
        .single();

      if (updateError) {
        console.error('Erro ao atualizar progresso:', updateError);
        return NextResponse.json({ error: 'Erro ao atualizar progresso' }, { status: 500 });
      }

      updatedProgress = data;
    } else {
      // Criar novo progresso
      const { data, error: createError } = await supabaseAdmin
        .from('academy_progress')
        .insert({
          enrollment_id: targetEnrollmentId,
          progress_percentage: updateData.progress_percentage || 0,
          last_watched_position: updateData.last_watched_position || 0,
          total_watch_time: updateData.total_watch_time || 0,
          last_accessed_at: updateData.last_accessed_at,
          updated_at: updateData.updated_at
        })
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar progresso:', createError);
        return NextResponse.json({ error: 'Erro ao criar progresso' }, { status: 500 });
      }

      updatedProgress = data;
    }

    // Se o progresso chegou a 100%, marcar curso como concluído
    if (updatedProgress.progress_percentage >= 100) {
      const nowIso = new Date().toISOString();
      const { error: completeError } = await supabaseAdmin
        .from('academy_enrollments')
        .update({
          completed_at: nowIso
        })
        .eq('id', targetEnrollmentId)
        .is('completed_at', null);

      if (completeError) {
        console.error('Erro ao marcar curso como concluído:', completeError);
        // Não falhar a atualização do progresso por causa disso
      } else {
        try {
          // Buscar dados do enrollment + usuário + curso
          const { data: enr, error: enrErr } = await supabaseAdmin
            .from('academy_enrollments')
            .select('id, user_id, course_id, completed_at, user:users_unified(id, email, first_name, last_name), course:academy_courses(id, title)')
            .eq('id', targetEnrollmentId)
            .single();

          if (!enrErr && enr) {
            const userObj = (Array.isArray(enr.user) ? enr.user[0] : enr.user) as any;
            const gen = await generateAndStoreCertificate(targetEnrollmentId);
            if (!gen) return;
            const downloadUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/academy/certificates/download?issue_id=${gen.issueId}`;

            // Notificação in-app
            const notification = {
              user_id: enr.user_id,
              type: 'certificate',
              title: 'Certificado disponível',
              message: `Seu certificado do curso "${(enr.course as any)?.title || ''}" está pronto`,
              action_url: downloadUrl,
              priority: 'normal',
              created_at: nowIso
            } as any;
            await supabaseAdmin.from('notifications').insert(notification);

            // E-mail com link e anexo do PDF
            try {
              const { sendEmail } = await import('@/lib/email-sendgrid');
              const subject = `🎓 Certificado disponível - ${(enr.course as any)?.title || 'Curso'}`;
              const html = academyCertificateTemplate(
                userObj?.first_name || '',
                (enr.course as any)?.title || '',
                downloadUrl
              );

              if (userObj?.email) {
                await sendEmail(userObj.email, subject, subject, html, {
                  attachments: [
                    { filename: `certificado-${gen.issueId}.pdf`, content: Buffer.from(gen.pdfBytes), contentType: 'application/pdf' }
                  ]
                });
              }
            } catch (e) {
              console.warn('Falha ao enviar e-mail de certificado:', e);
            }
          }
        } catch (e) {
          console.warn('Falha no pós-processamento de conclusão:', e);
        }
      }
    }

    console.log(`✅ Progresso atualizado: ${updatedProgress.progress_percentage}% para enrollment ${targetEnrollmentId}`);

    return NextResponse.json({
      success: true,
      message: 'Progresso atualizado com sucesso',
      progress: updatedProgress
    });

  } catch (error) {
    console.error('Erro ao atualizar progresso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Resetar progresso
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await withAcademyAuth(request, { requireAuth: true });

    if (authError || !user) {
      return authError || NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { enrollment_id } = body;

    if (!enrollment_id) {
      return NextResponse.json({ error: 'enrollment_id é obrigatório' }, { status: 400 });
    }

    // Verificar se o usuário é dono da matrícula
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from('academy_enrollments')
      .select('user_id')
      .eq('id', enrollment_id)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
    }

    if (enrollment.user_id !== user.id) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    // Resetar progresso
    const { data: progress, error: updateError } = await supabaseAdmin
      .from('academy_progress')
      .update({
        progress_percentage: 0,
        last_watched_position: 0,
        total_watch_time: 0,
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('enrollment_id', enrollment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao resetar progresso:', updateError);
      return NextResponse.json({ error: 'Erro ao resetar progresso' }, { status: 500 });
    }

    // Remover data de conclusão da matrícula
    const { error: enrollmentUpdateError } = await supabaseAdmin
      .from('academy_enrollments')
      .update({
        completed_at: null
      })
      .eq('id', enrollment_id);

    if (enrollmentUpdateError) {
      console.error('Erro ao atualizar matrícula:', enrollmentUpdateError);
      // Não falhar o reset do progresso por causa disso
    }

    console.log(`✅ Progresso resetado para enrollment ${enrollment_id}`);

    return NextResponse.json({
      success: true,
      message: 'Progresso resetado com sucesso',
      progress
    });

  } catch (error) {
    console.error('Erro ao resetar progresso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
