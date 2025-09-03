import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { canEditAcademy, canModerateAcademy } from '@/lib/permissions';

export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  access_permissions: any;
  canEditAcademy: boolean;
  canModerateAcademy: boolean;
}

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  requireAcademyEditor?: boolean;
  requireAcademyModerator?: boolean;
  allowSelfAccess?: boolean; // Para endpoints onde usuários podem acessar seus próprios dados
}

/**
 * Middleware de autenticação e autorização para APIs do Academy
 */
export async function withAcademyAuth(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{ user: AuthenticatedUser | null; error: NextResponse | null }> {
  const {
    requireAuth = true,
    requireAcademyEditor = false,
    requireAcademyModerator = false,
    allowSelfAccess = false
  } = options;

  try {
    // Se não requer autenticação, retornar sem usuário
    if (!requireAuth) {
      return { user: null, error: null };
    }

    // Verificar header de autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Token de autorização necessário' },
          { status: 401 }
        )
      };
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Token inválido' },
          { status: 401 }
        )
      };
    }

    // Buscar dados completos do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Usuário não encontrado' },
          { status: 404 }
        )
      };
    }

    // Verificar se o usuário está ativo
    if (!userData.active) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Usuário inativo' },
          { status: 403 }
        )
      };
    }

    // Criar objeto de usuário autenticado
    const authenticatedUser: AuthenticatedUser = {
      id: userData.id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      access_permissions: userData.access_permissions,
      canEditAcademy: canEditAcademy(userData),
      canModerateAcademy: canModerateAcademy(userData)
    };

    // Verificar permissões específicas
    if (requireAcademyEditor && !authenticatedUser.canEditAcademy) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Permissão de editor do Academy necessária' },
          { status: 403 }
        )
      };
    }

    if (requireAcademyModerator && !authenticatedUser.canModerateAcademy) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Permissão de moderador do Academy necessária' },
          { status: 403 }
        )
      };
    }

    return { user: authenticatedUser, error: null };

  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Erro interno de autenticação' },
        { status: 500 }
      )
    };
  }
}

/**
 * Verificar se o usuário pode acessar recursos de outro usuário
 */
export function canAccessUserResource(
  authenticatedUser: AuthenticatedUser,
  targetUserId: string,
  allowSelfAccess: boolean = true
): boolean {
  // Admins podem acessar qualquer recurso
  if (authenticatedUser.role === 'ADMIN') {
    return true;
  }

  // Editores do Academy podem acessar recursos relacionados ao Academy
  if (authenticatedUser.canEditAcademy) {
    return true;
  }

  // Usuário pode acessar seus próprios recursos
  if (allowSelfAccess && authenticatedUser.id === targetUserId) {
    return true;
  }

  return false;
}

/**
 * Verificar se o usuário pode modificar um curso específico
 */
export async function canModifyCourse(
  authenticatedUser: AuthenticatedUser,
  courseId: string
): Promise<boolean> {
  // Admins podem modificar qualquer curso
  if (authenticatedUser.role === 'ADMIN') {
    return true;
  }

  // Editores do Academy podem modificar cursos
  if (authenticatedUser.canEditAcademy) {
    // Verificar se é o instrutor do curso
    const { data: course, error } = await supabaseAdmin
      .from('academy_courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();

    if (error || !course) {
      return false;
    }

    // Instrutor pode modificar seu próprio curso
    return course.instructor_id === authenticatedUser.id;
  }

  return false;
}

/**
 * Verificar se o usuário pode moderar conteúdo do Academy
 */
export function canModerateContent(
  authenticatedUser: AuthenticatedUser,
  contentType: 'comment' | 'rating' | 'course' = 'comment'
): boolean {
  // Admins podem moderar qualquer conteúdo
  if (authenticatedUser.role === 'ADMIN') {
    return true;
  }

  // Editores podem moderar qualquer conteúdo
  if (authenticatedUser.canEditAcademy) {
    return true;
  }

  // Moderadores podem moderar comentários e avaliações
  if (authenticatedUser.canModerateAcademy && contentType !== 'course') {
    return true;
  }

  return false;
}

/**
 * Extrair parâmetros de autorização da requisição
 */
export function extractAuthParams(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  return {
    userId: searchParams.get('user_id'),
    courseId: searchParams.get('course_id'),
    enrollmentId: searchParams.get('enrollment_id'),
    categoryId: searchParams.get('category_id')
  };
}

/**
 * Wrapper para APIs que requerem autenticação
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest) => {
    const { user, error } = await withAcademyAuth(request, options);
    
    if (error) {
      return error;
    }

    if (!user && options.requireAuth !== false) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    return handler(request, user!);
  };
}

/**
 * Wrapper para APIs que requerem permissões de editor
 */
export function withEditorAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return withAuth(handler, { requireAcademyEditor: true });
}

/**
 * Wrapper para APIs que requerem permissões de moderador
 */
export function withModeratorAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return withAuth(handler, { requireAcademyModerator: true });
}

/**
 * Log de ações para auditoria
 */
export async function logAcademyAction(
  user: AuthenticatedUser,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: any
) {
  try {
    const logEntry = {
      user_id: user.id,
      user_name: `${user.first_name} ${user.last_name}`,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details || {},
      timestamp: new Date().toISOString(),
      ip_address: null, // Pode ser adicionado se necessário
      user_agent: null  // Pode ser adicionado se necessário
    };

    // Inserir no log de auditoria (se a tabela existir)
    const { error } = await supabaseAdmin
      .from('academy_audit_log')
      .insert(logEntry);

    if (error && error.code !== 'PGRST116') { // Ignorar se tabela não existe
      console.error('Erro ao registrar log de auditoria:', error);
    }

    // Log no console para desenvolvimento
    console.log(`🔍 Academy Action: ${action} on ${resourceType}:${resourceId} by ${user.first_name} ${user.last_name}`);

  } catch (error) {
    console.error('Erro ao registrar ação:', error);
  }
}
