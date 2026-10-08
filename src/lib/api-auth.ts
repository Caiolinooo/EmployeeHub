import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { canEditAcademy, canModerateAcademy, canEditSocial, canModerateSocial, hasFeaturePermission } from '@/lib/permissions';
import { verifyTokenFromRequest } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  access_permissions: any;
  active: boolean;
}

/**
 * Verificar token de autorização e retornar dados do usuário
 */
export async function authenticateUser(request: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  error: NextResponse | null;
}> {
  try {
    // Usar o método verifyTokenFromRequest que já lida com todos os tipos de token
    const authResult = await verifyTokenFromRequest(request);

    if (!authResult.valid) {
      return {
        user: null,
        error: NextResponse.json({ error: 'Token inválido ou ausente' }, { status: 401 })
      };
    }

    const userData = authResult.user;

    if (!userData) {
      return {
        user: null,
        error: NextResponse.json({ error: 'Usuário não cadastrado' }, { status: 404 })
      };
    }

    if (!userData.active) {
      return {
        user: null,
        error: NextResponse.json({ error: 'Usuário inativo' }, { status: 403 })
      };
    }

    return {
      user: userData as AuthenticatedUser,
      error: null
    };

  } catch (error) {
    console.error('Erro na autenticação:', error);
    return {
      user: null,
      error: NextResponse.json({ error: 'Erro interno de autenticação' }, { status: 500 })
    };
  }
}

/**
 * Verificar se o usuário tem permissões específicas
 */
export function checkPermissions(user: AuthenticatedUser, permission: string): boolean {
  const role = (user.role || '').toUpperCase();
  switch (permission) {
    case 'academy_editor':
      return canEditAcademy(user);
    case 'academy_moderator':
      return canModerateAcademy(user);
    case 'social_editor':
      return canEditSocial(user);
    case 'social_moderator':
      return canModerateSocial(user);
    case 'admin':
      return role === 'ADMIN';
    case 'manager':
      return role === 'ADMIN' || role === 'MANAGER';
    case 'news_editor':
      return hasFeaturePermission(user, 'news_editor') || hasFeaturePermission(user, 'news_manager') || role === 'ADMIN' || role === 'MANAGER';
    case 'news_manager':
      return hasFeaturePermission(user, 'news_manager') || role === 'ADMIN' || role === 'MANAGER';
    case 'contracts_manager':
      return hasFeaturePermission(user, 'contracts.manage') || role === 'ADMIN' || role === 'MANAGER';
    default:
      return false;
  }
}

/**
 * Generic content moderation checker for API routes
 */
export function canModerateContent(user: AuthenticatedUser | null, resource: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const academyTypes = ['comment', 'rating', 'course', 'lesson', 'announcement'];
  const socialTypes = ['post', 'feed', 'social_comment'];

  if (academyTypes.includes(resource)) {
    return canModerateAcademy(user);
  }
  if (socialTypes.includes(resource)) {
    return canModerateSocial(user);
  }

  return canModerateAcademy(user) || canModerateSocial(user);
}


/**
 * Middleware para verificar autenticação
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: AuthenticatedUser;
  error?: NextResponse;
}> {
  const { user, error } = await authenticateUser(request);

  if (error || !user) {
    return { user: null as any, error: error || NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }

  return { user };
}

/**
 * Middleware para verificar permissões específicas
 */
export async function requirePermission(request: NextRequest, permission: string): Promise<{
  user: AuthenticatedUser;
  error?: NextResponse;
}> {
  const { user, error } = await requireAuth(request);

  if (error) {
    return { user, error };
  }

  if (!checkPermissions(user, permission)) {
    return {
      user,
      error: NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    };
  }

  return { user };
}

/**
 * Verificar se o usuário pode acessar recursos de outro usuário
 */
export function canAccessUserData(authenticatedUser: AuthenticatedUser, targetUserId: string): boolean {
  // Usuário pode acessar seus próprios dados
  if (authenticatedUser.id === targetUserId) {
    return true;
  }

  // Admins podem acessar dados de qualquer usuário (bypass total)
  if (authenticatedUser.role === 'ADMIN') {
    return true;
  }

  // Managers podem acessar dados de usuários normais
  if (authenticatedUser.role === 'MANAGER') {
    return true;
  }

  return false;
}

/**
 * Verificar se o usuário pode modificar um curso
 */
export async function canModifyCourse(user: AuthenticatedUser, courseId: string): Promise<boolean> {
  // Admins podem modificar qualquer curso (bypass total)
  if (user.role === 'ADMIN') {
    return true;
  }

  // Editores do Academy podem modificar cursos
  if (!canEditAcademy(user)) {
    return false;
  }

  // Verificar se é o instrutor do curso
  const { data: course, error } = await supabaseAdmin
    .from('academy_courses')
    .select('instructor_id')
    .eq('id', courseId)
    .single();

  if (error || !course) {
    return false;
  }

  return course.instructor_id === user.id;
}

/**
 * Log de ações para auditoria
 */
export function logAction(
  user: AuthenticatedUser,
  action: string,
  resource: string,
  resourceId?: string,
  details?: any
) {
  const logEntry = {
    user_id: user.id,
    user_name: `${user.first_name} ${user.last_name}`,
    action,
    resource,
    resource_id: resourceId,
    details,
    timestamp: new Date().toISOString()
  };

  console.log(`🔍 Action Log:`, logEntry);

  // Aqui você pode implementar persistência do log se necessário
  // Por exemplo, salvar em uma tabela de auditoria
}

/**
 * Wrapper para handlers que requerem autenticação
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    const { user, error } = await requireAuth(request);

    if (error) {
      return error;
    }

    return handler(request, user, ...args);
  };
}

/**
 * Wrapper para handlers que requerem permissões específicas
 */
export function withPermission<T extends any[]>(
  permission: string,
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    const { user, error } = await requirePermission(request, permission);

    if (error) {
      return error;
    }

    return handler(request, user, ...args);
  };
}

/**
 * `withPermission` + grants do catálogo vivo (feature JSONB / ACL, `src/config/module-grants.ts`).
 * O grant só soma: quem passava por `permission` continua passando.
 */
export function withPermissionOrGrant<T extends any[]>(
  permission: string,
  grants: readonly string[],
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T) => {
    const { user, error } = await requireAuth(request);
    if (error) {
      return error;
    }
    if (!checkPermissions(user, permission) && !(await canWithGrant(user.id, user.role, grants, 'none'))) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    return handler(request, user, ...args);
  };
}

/**
 * Wrappers específicos para permissões comuns
 */
export const withAcademyEditor = <T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) => withPermission('academy_editor', handler);

export const withAcademyModerator = <T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) => withPermission('academy_moderator', handler);

export const withSocialEditor = <T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) => withPermission('social_editor', handler);

export const withSocialModerator = <T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) => withPermission('social_moderator', handler);

export const withAdmin = <T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) => withPermission('admin', handler);
