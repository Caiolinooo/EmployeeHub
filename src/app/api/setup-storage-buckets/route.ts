import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API para configurar buckets de armazenamento no Supabase
 * Esta API cria os buckets necessários para o funcionamento do sistema
 * e configura as políticas de acesso
 */
export async function POST(request: Request) {
  try {
    // Verificar se o usuário é administrador
    const { isAdmin } = await isAdminFromRequest(request);
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem executar esta operação.' },
        { status: 403 }
      );
    }
    
    // Lista de buckets a serem criados
    const buckets = [
      {
        name: 'profile-images',
        public: true,
        description: 'Imagens de perfil dos usuários'
      },
      {
        name: 'comprovantes',
        public: false,
        description: 'Comprovantes de reembolso'
      }
    ];
    
    const results = [];
    
    // Criar cada bucket
    for (const bucket of buckets) {
      try {
        // Verificar se o bucket já existe
        const { data: existingBucket, error: checkError } = await (supabaseAdmin as any)
          .storage
          .getBucket(bucket.name);

        if (checkError && checkError.message !== 'The resource was not found') {
          results.push({
            bucket: bucket.name,
            status: 'error',
            message: `Erro ao verificar bucket: ${checkError.message}`
          });
          continue;
        }
        
        // Se o bucket já existe, pular para o próximo
        if (existingBucket) {
          results.push({
            bucket: bucket.name,
            status: 'skipped',
            message: 'Bucket já existe'
          });
          
          // Atualizar as configurações do bucket
          const { error: updateError } = await (supabaseAdmin as any)
            .storage
            .updateBucket(bucket.name, {
              public: bucket.public
            });

          if (updateError) {
            results.push({
              bucket: bucket.name,
              status: 'error',
              message: `Erro ao atualizar bucket: ${updateError.message}`
            });
          } else {
            results.push({
              bucket: bucket.name,
              status: 'updated',
              message: 'Configurações do bucket atualizadas'
            });
          }
          
          continue;
        }
        
        // Criar o bucket
        const { error: createError } = await (supabaseAdmin as any)
          .storage
          .createBucket(bucket.name, {
            public: bucket.public
          });

        if (createError) {
          results.push({
            bucket: bucket.name,
            status: 'error',
            message: `Erro ao criar bucket: ${createError.message}`
          });
          continue;
        }
        
        results.push({
          bucket: bucket.name,
          status: 'created',
          message: 'Bucket criado com sucesso'
        });
        
        // Configurar políticas de acesso para o bucket profile-images
        if (bucket.name === 'profile-images') {
          // Política para permitir que usuários leiam suas próprias imagens
          const { error: policyError } = await (supabaseAdmin as any).rpc('create_storage_policy', {
            bucket_name: 'profile-images',
            policy_name: 'User Profile Images Policy',
            definition: `(bucket_id = 'profile-images'::text) AND (auth.uid() = SPLIT_PART(name, '/', 1)::uuid OR auth.role() = 'service_role'::text)`,
            operation: 'SELECT'
          });
          
          if (policyError) {
            results.push({
              bucket: bucket.name,
              status: 'error',
              message: `Erro ao criar política de leitura: ${policyError.message}`
            });
          } else {
            results.push({
              bucket: bucket.name,
              status: 'policy_created',
              message: 'Política de leitura criada com sucesso'
            });
          }
          
          // Política para permitir que usuários façam upload/insert de suas próprias imagens
          const { error: updatePolicyError } = await (supabaseAdmin as any).rpc('create_storage_policy', {
            bucket_name: 'profile-images',
            policy_name: 'User Profile Images Update Policy',
            definition: `(bucket_id = 'profile-images'::text) AND (auth.uid() = SPLIT_PART(name, '/', 1)::uuid OR auth.role() = 'service_role'::text)`,
            operation: 'INSERT'
          });
          
          if (updatePolicyError) {
            results.push({
              bucket: bucket.name,
              status: 'error',
              message: `Erro ao criar política de atualização: ${updatePolicyError.message}`
            });
          } else {
            results.push({
              bucket: bucket.name,
              status: 'policy_created',
              message: 'Política de atualização criada com sucesso'
            });
          }

          // Política para permitir UPDATE (substituições/metadados) nas próprias imagens
          const { error: updateObjPolicyError } = await (supabaseAdmin as any).rpc('create_storage_policy', {
            bucket_name: 'profile-images',
            policy_name: 'User Profile Images Modify Policy',
            definition: `(bucket_id = 'profile-images'::text) AND (auth.uid() = SPLIT_PART(name, '/', 1)::uuid OR auth.role() = 'service_role'::text)`,
            operation: 'UPDATE'
          });

          if (updateObjPolicyError) {
            results.push({
              bucket: bucket.name,
              status: 'error',
              message: `Erro ao criar política de UPDATE: ${updateObjPolicyError.message}`
            });
          } else {
            results.push({
              bucket: bucket.name,
              status: 'policy_created',
              message: 'Política de UPDATE criada com sucesso'
            });
          }

          // Política para permitir DELETE das próprias imagens
          const { error: deletePolicyError } = await (supabaseAdmin as any).rpc('create_storage_policy', {
            bucket_name: 'profile-images',
            policy_name: 'User Profile Images Delete Policy',
            definition: `(bucket_id = 'profile-images'::text) AND (auth.uid() = SPLIT_PART(name, '/', 1)::uuid OR auth.role() = 'service_role'::text)`,
            operation: 'DELETE'
          });

          if (deletePolicyError) {
            results.push({
              bucket: bucket.name,
              status: 'error',
              message: `Erro ao criar política de DELETE: ${deletePolicyError.message}`
            });
          } else {
            results.push({
              bucket: bucket.name,
              status: 'policy_created',
              message: 'Política de DELETE criada com sucesso'
            });
          }
        }
      } catch (error) {
        results.push({
          bucket: bucket.name,
          status: 'error',
          message: `Erro inesperado: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Operação concluída',
      results
    });
  } catch (error) {
    console.error('Erro ao configurar buckets:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
