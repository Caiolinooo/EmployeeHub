import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const { createClient } = await import('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Seeding new ACL permissions into database...');

  const newPermissions = [
    // Permissões de férias
    { name: 'ferias.read', description: 'Visualizar férias e saldo', resource: 'ferias', action: 'read', level: 0 },
    { name: 'ferias.create', description: 'Solicitar férias', resource: 'ferias', action: 'create', level: 1 },
    { name: 'ferias.approve', description: 'Aprovar pedidos de férias', resource: 'ferias', action: 'approve', level: 2 },
    { name: 'ferias.manage', description: 'Gerenciar saldos e períodos de férias', resource: 'ferias', action: 'manage', level: 3 },
    { name: 'ferias.admin', description: 'Administrador de férias', resource: 'ferias', action: 'admin', level: 3 },

    // Permissões de contratos
    { name: 'contratos.read', description: 'Visualizar contratos atribuídos', resource: 'contratos', action: 'read', level: 0 },
    { name: 'contratos.sign', description: 'Assinar contratos atribuídos', resource: 'contratos', action: 'sign', level: 1 },
    { name: 'contratos.manage', description: 'Gerenciar uploads e assinaturas de contratos', resource: 'contratos', action: 'manage', level: 3 },

    // Permissões de lista de presença
    { name: 'lista-presenca.read', description: 'Visualizar listas de presença', resource: 'lista-presenca', action: 'read', level: 0 },
    { name: 'lista-presenca.create', description: 'Criar listas de presença', resource: 'lista-presenca', action: 'create', level: 1 },
    { name: 'lista-presenca.manage', description: 'Gerenciar e assinar listas de presença', resource: 'lista-presenca', action: 'manage', level: 3 },
  ];

  // Insert permissions
  const permissionIdsByName: Record<string, string> = {};

  for (const perm of newPermissions) {
    // Check if it exists
    const { data: existing, error: getError } = await supabase
      .from('acl_permissions')
      .select('id')
      .eq('name', perm.name)
      .maybeSingle();

    if (getError) {
      console.error(`Error querying permission ${perm.name}:`, getError);
      continue;
    }

    if (existing) {
      console.log(`Permission ${perm.name} already exists with ID: ${existing.id}`);
      permissionIdsByName[perm.name] = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('acl_permissions')
        .insert({
          ...perm,
          enabled: true,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`Error inserting permission ${perm.name}:`, insertError);
      } else if (inserted) {
        console.log(`Successfully created permission ${perm.name} with ID: ${inserted.id}`);
        permissionIdsByName[perm.name] = inserted.id;
      }
    }
  }

  // Setup default role associations
  const rolePermissions = {
    'ADMIN': newPermissions.map(p => p.name),
    'MANAGER': [
      'ferias.read', 'ferias.create', 'ferias.approve',
      'contratos.read', 'contratos.sign', 'contratos.manage',
      'lista-presenca.read', 'lista-presenca.create', 'lista-presenca.manage'
    ],
    'USER': [
      'ferias.create',
      'contratos.read', 'contratos.sign',
      'lista-presenca.read', 'lista-presenca.create'
    ]
  };

  for (const [role, permissionNames] of Object.entries(rolePermissions)) {
    console.log(`Assigning default permissions for role: ${role}`);
    for (const name of permissionNames) {
      const id = permissionIdsByName[name];
      if (!id) {
        console.warn(`Could not find ID for permission ${name}, skipping role assignment.`);
        continue;
      }

      // Check if role mapping exists
      const { data: existingMapping, error: mapGetError } = await supabase
        .from('role_acl_permissions')
        .select('id')
        .eq('role', role)
        .eq('permission_id', id)
        .maybeSingle();

      if (mapGetError) {
        console.error(`Error querying role mapping for ${role} and ${name}:`, mapGetError);
        continue;
      }

      if (existingMapping) {
        console.log(`Mapping for role ${role} and permission ${name} already exists.`);
      } else {
        const { error: mapInsertError } = await supabase
          .from('role_acl_permissions')
          .insert({
            role,
            permission_id: id,
            created_at: new Date().toISOString()
          });

        if (mapInsertError) {
          console.error(`Error mapping ${role} to ${name}:`, mapInsertError);
        } else {
          console.log(`Successfully mapped ${role} to ${name}`);
        }
      }
    }
  }

  console.log('ACL permissions seeding completed successfully!');
}

main().catch(err => {
  console.error('Fatal error in seeding script:', err);
  process.exit(1);
});
