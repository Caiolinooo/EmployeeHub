import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Obter informações do request
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 
                    (host?.includes('localhost') ? 'http' : 'https');
    const userAgent = request.headers.get('user-agent');
    const forwarded = request.headers.get('x-forwarded-for');
    
    // Construir URL base
    let baseUrl = '';
    if (host) {
      baseUrl = `${protocol}://${host}`;
    }
    
    // Variáveis de ambiente
    const envVars = {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      APP_URL: process.env.APP_URL,
      URL: process.env.URL,
      DEPLOY_URL: process.env.DEPLOY_URL,
      SITE_URL: process.env.SITE_URL,
      NETLIFY_SITE_URL: process.env.NETLIFY_SITE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
      NODE_ENV: process.env.NODE_ENV
    };
    
    // Simular token
    const testToken = 'test-token-123';
    const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(testToken)}`;
    
    return NextResponse.json({
      success: true,
      data: {
        request: {
          host,
          protocol,
          userAgent,
          forwarded,
          url: request.url
        },
        urls: {
          baseUrl,
          verificationUrl
        },
        environment: envVars,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Erro no teste de URL:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}
