import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const { supabaseAdmin } = await import('../src/lib/supabase');
  console.log('🔄 Semeando permissões ACL para Matrizes de Treinamento...');

  const perms = [
    {
      name: 'gestao-tripulantes.matrizes.view',
      description: 'Visualizar matrizes de treinamento',
      resource: 'gestao-tripulantes',
      action: 'matrizes.view',
      level: 0,
      enabled: true,
    },
    {
      name: 'gestao-tripulantes.matrizes.manage',
      description: 'Gerenciar matrizes de treinamento por cargo',
      resource: 'gestao-tripulantes',
      action: 'matrizes.manage',
      level: 2,
      enabled: true,
    },
  ];

  for (const p of perms) {
    const { data: existing } = await supabaseAdmin
      .from('acl_permissions')
      .select('id')
      .eq('name', p.name)
      .maybeSingle();

    let permId = existing?.id;
    if (!permId) {
      const { data: created, error } = await supabaseAdmin
        .from('acl_permissions')
        .insert({
          ...p,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao inserir permissão ACL:', error);
      } else {
        permId = created.id;
        console.log(`✅ Criada permissão ACL: ${p.name}`);
      }
    } else {
      console.log(`ℹ️ Permissão ACL já existe: ${p.name}`);
    }

    if (permId) {
      // Atribuir para ADMIN e MANAGER
      for (const role of ['ADMIN', 'MANAGER']) {
        const { data: existingRolePerm } = await supabaseAdmin
          .from('role_acl_permissions')
          .select('id')
          .eq('role', role)
          .eq('permission_id', permId)
          .maybeSingle();

        if (!existingRolePerm) {
          await supabaseAdmin.from('role_acl_permissions').insert({
            role,
            permission_id: permId,
            created_at: new Date().toISOString(),
          });
          console.log(`✅ Permissão ${p.name} associada ao role ${role}`);
        }
      }
    }
  }

  console.log('🎉 Seed de ACL para Matrizes concluído!');
}

run().catch(console.error);
