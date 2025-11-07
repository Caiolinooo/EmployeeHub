import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Obter todas as permissões ACL
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 API ACL Permissions - Buscando permissões...');

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format'); // 'tree' ou 'flat'
    const resource = searchParams.get('resource'); // Filtrar por recurso

    // Buscar todas as permissões
    let query = supabaseAdmin
      .from('acl_permissions')
      .select('*')
      .eq('enabled', true)
      .order('resource')
      .order('level')
      .order('name');

    if (resource) {
      query = query.eq('resource', resource);
    }

    const { data: permissions, error } = await query;

    if (error) {
      console.error('Erro ao buscar permissões ACL:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar permissões ACL' },
        { status: 500 }
      );
    }

    console.log(`✅ ${permissions.length} permissões ACL carregadas`);

    // Se formato for 'tree', organizar em árvore hierárquica
    if (format === 'tree') {
      const tree = buildPermissionTree(permissions);
      return NextResponse.json(tree);
    }

    // Retornar formato flat por padrão
    return NextResponse.json(permissions);

  } catch (error) {
    console.error('Erro ao buscar permissões ACL:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova permissão ACL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, resource, action, parent_id, level } = body;

    if (!name || !resource || !action) {
      return NextResponse.json(
        { error: 'Nome, recurso e ação são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔄 API ACL Permissions - Criando permissão: ${name}`);

    const permissionData = {
      name,
      description: description || '',
      resource,
      action,
      parent_id: parent_id || null,
      level: level || 0,
      enabled: true,
      created_at: new Date().toISOString()
    };

    const { data: newPermission, error } = await supabaseAdmin
      .from('acl_permissions')
      .insert(permissionData)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar permissão ACL:', error);
      return NextResponse.json(
        { error: 'Erro ao criar permissão ACL' },
        { status: 500 }
      );
    }

    console.log(`✅ Permissão ACL criada: ${newPermission.name}`);
    return NextResponse.json(newPermission);

  } catch (error) {
    console.error('Erro ao criar permissão ACL:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função para construir árvore hierárquica de permissões
function buildPermissionTree(permissions: any[]) {
  const tree: any = {};
  
  // Agrupar por recurso
  permissions.forEach(permission => {
    if (!tree[permission.resource]) {
      tree[permission.resource] = {
        resource: permission.resource,
        label: getResourceLabel(permission.resource),
        permissions: []
      };
    }
    
    tree[permission.resource].permissions.push({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      action: permission.action,
      level: permission.level,
      parent_id: permission.parent_id,
      enabled: permission.enabled
    });
  });

  // Organizar permissões em hierarquia dentro de cada recurso
  Object.keys(tree).forEach(resourceKey => {
    tree[resourceKey].permissions = organizeHierarchy(tree[resourceKey].permissions);
  });

  return tree;
}

// Função para organizar permissões em hierarquia
function organizeHierarchy(permissions: any[]) {
  const permissionMap = new Map();
  const rootPermissions: any[] = [];

  // Criar mapa de permissões
  permissions.forEach(permission => {
    permission.children = [];
    permissionMap.set(permission.id, permission);
  });

  // Organizar hierarquia
  permissions.forEach(permission => {
    if (permission.parent_id) {
      const parent = permissionMap.get(permission.parent_id);
      if (parent) {
        parent.children.push(permission);
      } else {
        rootPermissions.push(permission);
      }
    } else {
      rootPermissions.push(permission);
    }
  });

  return rootPermissions;
}

// Função para obter label amigável do recurso
function getResourceLabel(resource: string) {
  const labels: { [key: string]: string } = {
    'news': 'Notícias',
    'comments': 'Comentários',
    'notifications': 'Notificações',
    'reminders': 'Lembretes',
    'admin': 'Administração',
    'users': 'Usuários',
    'reports': 'Relatórios'
  };
  
  return labels[resource] || resource.charAt(0).toUpperCase() + resource.slice(1);
}
