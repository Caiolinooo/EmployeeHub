import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Obter configurações de aprovação de usuários
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/admin/user-approval-settings - Iniciando busca de configurações');

    // Valores padrão para retornar em caso de erro
    const defaultSettings = {
      bypassApproval: false,
      autoActivateOnEmailVerification: false
    };

    try {
      // Buscar configuração na tabela settings
      const { data, error } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('key', 'user_approval_settings')
        .single();

      if (error) {
        console.log('Configuração não encontrada, retornando valores padrão:', error.message);
        return NextResponse.json({
          success: true,
          data: defaultSettings
        });
      }

      if (!data) {
        console.log('Configuração não encontrada, retornando valores padrão');
        return NextResponse.json({
          success: true,
          data: defaultSettings
        });
      }

      console.log('Configuração encontrada:', data.value);
      return NextResponse.json({
        success: true,
        data: data.value
      });

    } catch (dbError) {
      console.error('Erro ao acessar banco de dados:', dbError);
      return NextResponse.json({
        success: true,
        data: defaultSettings
      });
    }

  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Atualizar configurações de aprovação de usuários
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/admin/user-approval-settings - Iniciando atualização de configurações');

    const body = await request.json();
    const { bypassApproval, autoActivateOnEmailVerification } = body;

    // Validar os dados de entrada
    if (typeof bypassApproval !== 'boolean' || typeof autoActivateOnEmailVerification !== 'boolean') {
      return NextResponse.json(
        { error: 'Dados inválidos. bypassApproval e autoActivateOnEmailVerification devem ser booleanos.' },
        { status: 400 }
      );
    }

    console.log('Dados recebidos:', { bypassApproval, autoActivateOnEmailVerification });

    try {
      // Verificar se a configuração já existe
      const { data: existingConfig, error: checkError } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('key', 'user_approval_settings')
        .single();

      let result;

      if (existingConfig) {
        console.log('Atualizando configuração existente');
        // Atualizar configuração existente
        const { data, error: updateError } = await supabaseAdmin
          .from('settings')
          .update({
            value: { bypassApproval, autoActivateOnEmailVerification },
            updated_at: new Date().toISOString()
          })
          .eq('key', 'user_approval_settings')
          .select()
          .single();

        if (updateError) {
          console.error('Erro ao atualizar configurações:', updateError);
          return NextResponse.json(
            { error: `Erro ao atualizar configurações: ${updateError.message}` },
            { status: 500 }
          );
        }

        result = data;
      } else {
        console.log('Criando nova configuração');
        // Criar novo registro
        const { data, error: insertError } = await supabaseAdmin
          .from('settings')
          .insert({
            key: 'user_approval_settings',
            value: { bypassApproval, autoActivateOnEmailVerification },
            description: 'Configurações de aprovação de usuários'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao criar configurações:', insertError);
          return NextResponse.json(
            { error: `Erro ao criar configurações: ${insertError.message}` },
            { status: 500 }
          );
        }

        result = data;
      }

      console.log('Configuração salva com sucesso:', result);

      // Retornar resultado
      return NextResponse.json({
        success: true,
        data: result
      });

    } catch (dbError) {
      console.error('Erro ao acessar banco de dados:', dbError);
      return NextResponse.json(
        { error: 'Erro ao acessar banco de dados' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
