import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser, logAction } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET - Listar certificados do usuário ou gerar certificado específico
export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = await authenticateUser(request);

    if (authError) {
      return authError;
    }

    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = authUser as any;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');
    const enrollmentId = searchParams.get('enrollment_id');
    const generate = searchParams.get('generate') === 'true';

    // Se for para gerar um certificado específico
    if (generate && (courseId || enrollmentId)) {
      return await generateCertificate(user, courseId, enrollmentId);
    }

    // Listar certificados do usuário
    const { data: enrollments, error } = await supabaseAdmin
      .from('academy_enrollments')
      .select(`
        id,
        user_id,
        course_id,
        enrolled_at,
        completed_at,
        course:academy_courses(
          id,
          title,
          description,
          duration,
          difficulty_level,
          category:academy_categories(
            id,
            name,
            color
          ),
          instructor:users_unified(
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('completed_at', 'is', null);

    if (error) {
      console.error('Erro ao buscar certificados:', error);
      return NextResponse.json({ error: 'Erro ao buscar certificados' }, { status: 500 });
    }

    const certificates = enrollments?.map((enrollment: any) => {
      const courseData = enrollment.course?.[0] || enrollment.course;
      const category = Array.isArray(courseData?.category) ? courseData.category[0] : courseData?.category;
      const instructor = Array.isArray(courseData?.instructor) ? courseData.instructor[0] : courseData?.instructor;

      return {
        id: enrollment.id,
        course_id: enrollment.course_id,
        course_title: courseData?.title,
        course_duration: courseData?.duration,
        course_difficulty: courseData?.difficulty_level,
        category,
        instructor,
        completed_at: enrollment.completed_at,
        enrolled_at: enrollment.enrolled_at,
        certificate_url: `/api/academy/certificates?enrollment_id=${enrollment.id}&generate=true`
      };
    }) || [];

    return NextResponse.json({
      success: true,
      certificates
    });

  } catch (error) {
    console.error('Erro na API de certificados:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

async function generateCertificate(user: any, courseId?: string | null, enrollmentId?: string | null) {
  try {
    let enrollment;

    if (enrollmentId) {
      // Buscar por enrollment_id
      const { data, error } = await supabaseAdmin
        .from('academy_enrollments')
        .select(`
          *,
          course:academy_courses(
            id,
            title,
            description,
            duration,
            difficulty_level,
            category:academy_categories(
              id,
              name,
              color
            ),
            instructor:users_unified(
              id,
              first_name,
              last_name
            )
          )
        `)
        .eq('id', enrollmentId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
      }

      enrollment = data;
    } else if (courseId) {
      // Buscar por course_id
      const { data, error } = await supabaseAdmin
        .from('academy_enrollments')
        .select(`
          *,
          course:academy_courses(
            id,
            title,
            description,
            duration,
            difficulty_level,
            category:academy_categories(
              id,
              name,
              color
            ),
            instructor:users_unified(
              id,
              first_name,
              last_name
            )
          )
        `)
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
      }

      enrollment = data;
    } else {
      return NextResponse.json({ error: 'course_id ou enrollment_id é obrigatório' }, { status: 400 });
    }

    // Verificar se o curso foi concluído
    if (!enrollment.completed_at) {
      return NextResponse.json({ error: 'Curso não foi concluído' }, { status: 400 });
    }

    // Gerar certificado PDF
    const certificateData = {
      student_name: `${user.first_name} ${user.last_name}`,
      course_title: enrollment.course.title,
      course_duration: formatDuration(enrollment.course.duration),
      course_difficulty: getDifficultyLabel(enrollment.course.difficulty_level),
      category: enrollment.course.category?.name || 'Geral',
      instructor_name: `${enrollment.course.instructor.first_name} ${enrollment.course.instructor.last_name}`,
      completion_date: new Date(enrollment.completed_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
      enrollment_date: new Date(enrollment.enrolled_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
      certificate_id: `ABZ-${enrollment.id.toUpperCase().slice(0, 8)}`,
      issue_date: new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    };

    // Gerar HTML do certificado
    const certificateHTML = generateCertificateHTML(certificateData);

    // Log da ação
    logAction(user, 'GENERATE_CERTIFICATE', 'certificate', enrollment.id, {
      course_id: enrollment.course_id,
      course_title: enrollment.course.title
    });

    // Retornar HTML para conversão em PDF no frontend
    return new NextResponse(certificateHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="certificado-${certificateData.certificate_id}.html"`
      }
    });

  } catch (error) {
    console.error('Erro ao gerar certificado:', error);
    return NextResponse.json({ error: 'Erro ao gerar certificado' }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hora${hours > 1 ? 's' : ''}${remainingMinutes > 0 ? ` e ${remainingMinutes} minuto${remainingMinutes > 1 ? 's' : ''}` : ''}`;
}

function getDifficultyLabel(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'beginner': return 'Iniciante';
    case 'intermediate': return 'Intermediário';
    case 'advanced': return 'Avançado';
    default: return difficulty;
  }
}

function generateCertificateHTML(data: any): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificado de Conclusão - ${data.course_title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .certificate {
            background: white;
            width: 800px;
            max-width: 100%;
            padding: 60px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }
        
        .certificate::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8px;
            background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #f5576c);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .logo {
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 10px;
        }
        
        .subtitle {
            font-size: 16px;
            color: #666;
            font-weight: 300;
        }
        
        .title {
            font-family: 'Playfair Display', serif;
            font-size: 48px;
            font-weight: 700;
            color: #2d3748;
            text-align: center;
            margin: 40px 0;
            line-height: 1.2;
        }
        
        .content {
            text-align: center;
            margin: 40px 0;
        }
        
        .student-name {
            font-family: 'Playfair Display', serif;
            font-size: 36px;
            font-weight: 700;
            color: #667eea;
            margin: 20px 0;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            display: inline-block;
        }
        
        .course-info {
            margin: 30px 0;
            padding: 30px;
            background: #f8fafc;
            border-radius: 15px;
            border-left: 5px solid #667eea;
        }
        
        .course-title {
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 15px;
        }
        
        .course-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 20px;
        }
        
        .detail-item {
            text-align: left;
        }
        
        .detail-label {
            font-size: 12px;
            font-weight: 600;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }
        
        .detail-value {
            font-size: 16px;
            font-weight: 500;
            color: #2d3748;
        }
        
        .completion-info {
            margin: 40px 0;
            text-align: center;
        }
        
        .completion-text {
            font-size: 18px;
            color: #4a5568;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        
        .date {
            font-size: 16px;
            font-weight: 600;
            color: #667eea;
        }
        
        .footer {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            align-items: end;
        }
        
        .signature-section {
            text-align: center;
        }
        
        .signature-line {
            border-top: 2px solid #e2e8f0;
            margin-bottom: 10px;
            width: 200px;
            margin: 0 auto 10px;
        }
        
        .signature-name {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 5px;
        }
        
        .signature-title {
            font-size: 14px;
            color: #718096;
        }
        
        .certificate-id {
            text-align: right;
            align-self: end;
        }
        
        .id-label {
            font-size: 12px;
            color: #718096;
            margin-bottom: 5px;
        }
        
        .id-value {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 6px;
            display: inline-block;
        }
        
        .decorative-elements {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 100px;
            height: 100px;
            opacity: 0.1;
            background: radial-gradient(circle, #667eea, transparent);
            border-radius: 50%;
        }
        
        .decorative-elements::after {
            content: '';
            position: absolute;
            bottom: -120px;
            left: -120px;
            width: 80px;
            height: 80px;
            background: radial-gradient(circle, #764ba2, transparent);
            border-radius: 50%;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .certificate {
                box-shadow: none;
                border: 2px solid #e2e8f0;
            }
        }
        
        @media (max-width: 768px) {
            .certificate {
                padding: 40px 30px;
            }
            
            .title {
                font-size: 36px;
            }
            
            .student-name {
                font-size: 28px;
            }
            
            .course-details {
                grid-template-columns: 1fr;
            }
            
            .footer {
                grid-template-columns: 1fr;
                gap: 30px;
            }
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="decorative-elements"></div>
        
        <div class="header">
            <div class="logo">ABZ Academy</div>
            <div class="subtitle">Centro de Excelência em Educação Profissional</div>
        </div>
        
        <h1 class="title">Certificado de Conclusão</h1>
        
        <div class="content">
            <p style="font-size: 18px; color: #4a5568; margin-bottom: 10px;">
                Certificamos que
            </p>
            
            <div class="student-name">${data.student_name}</div>
            
            <p style="font-size: 18px; color: #4a5568; margin: 20px 0;">
                concluiu com êxito o curso
            </p>
            
            <div class="course-info">
                <div class="course-title">${data.course_title}</div>
                
                <div class="course-details">
                    <div class="detail-item">
                        <div class="detail-label">Categoria</div>
                        <div class="detail-value">${data.category}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Duração</div>
                        <div class="detail-value">${data.course_duration}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Nível</div>
                        <div class="detail-value">${data.course_difficulty}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Instrutor</div>
                        <div class="detail-value">${data.instructor_name}</div>
                    </div>
                </div>
            </div>
            
            <div class="completion-info">
                <p class="completion-text">
                    Curso iniciado em <strong>${data.enrollment_date}</strong><br>
                    e concluído em <strong>${data.completion_date}</strong>
                </p>
            </div>
        </div>
        
        <div class="footer">
            <div class="signature-section">
                <div class="signature-line"></div>
                <div class="signature-name">ABZ Academy</div>
                <div class="signature-title">Coordenação Acadêmica</div>
            </div>
            
            <div class="certificate-id">
                <div class="id-label">ID do Certificado</div>
                <div class="id-value">${data.certificate_id}</div>
                <div style="margin-top: 10px; font-size: 12px; color: #718096;">
                    Emitido em ${data.issue_date}
                </div>
            </div>
        </div>
    </div>
</body>
</html>
  `.trim();
}
