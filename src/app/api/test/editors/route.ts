import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Testando páginas de editores...');

    const editorsToTest = [
      '/manual',
      '/procedimentos-logistica', 
      '/politicas-empresa',
      '/academy',
      '/social'
    ];

    const results = [];

    for (const path of editorsToTest) {
      try {
        console.log(`🔍 Testando ${path}...`);
        
        const response = await fetch(`http://localhost:3000${path}`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Test-Bot/1.0'
          }
        });

        const status = response.status;
        const statusText = response.statusText;
        
        let hasError = false;
        let errorDetails = null;

        if (status >= 400) {
          hasError = true;
          try {
            const errorText = await response.text();
            errorDetails = errorText.substring(0, 500); // Limitar tamanho
          } catch (e) {
            errorDetails = 'Erro ao ler resposta';
          }
        }

        results.push({
          path,
          status,
          statusText,
          hasError,
          errorDetails,
          message: hasError ? `❌ Erro ${status}` : `✅ OK ${status}`
        });

        console.log(`${hasError ? '❌' : '✅'} ${path}: ${status} ${statusText}`);

      } catch (error) {
        results.push({
          path,
          status: 'ERROR',
          statusText: 'Network Error',
          hasError: true,
          errorDetails: error instanceof Error ? error.message : 'Erro desconhecido',
          message: '❌ Erro de rede'
        });

        console.log(`❌ ${path}: Erro de rede`);
      }
    }

    // Resumo
    const summary = {
      total_tested: results.length,
      successful: results.filter(r => !r.hasError).length,
      failed: results.filter(r => r.hasError).length,
      success_rate: `${Math.round((results.filter(r => !r.hasError).length / results.length) * 100)}%`
    };

    console.log('📊 Resumo dos testes:', summary);

    return NextResponse.json({
      success: true,
      message: 'Teste de editores concluído',
      summary,
      results
    });

  } catch (error) {
    console.error('❌ Erro no teste de editores:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno no teste',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
