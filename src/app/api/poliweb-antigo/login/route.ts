import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { storeSession, mergeCookies } from '@/lib/poliweb-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLIWEB_ANTIGO_BASE = 'https://www.policlinicaweb.com.br';

/**
 * POST /api/poliweb-antigo/login
 * Performs auto-login to old Poliweb (ASP.NET Web Forms)
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Token não fornecido' },
                { status: 401 }
            );
        }

        const authResult = verifyToken(token);
        if (!authResult) {
            return NextResponse.json(
                { success: false, error: 'Token inválido' },
                { status: 401 }
            );
        }

        // Get credentials for this user (prefer Antigo fields, fallback to old)
        const client = await supabaseAdmin;
        const { data: credentials, error: credError } = await client
            .from('poliweb_credentials')
            .select('username, username_antigo, password, password_antigo')
            .eq('user_id', authResult.userId)
            .single();

        if (credError && credError.code !== 'PGRST116') {
            console.error('[Poliweb Antigo Login] Erro ao buscar credenciais para userId:', authResult.userId, 'Error:', credError);
            return NextResponse.json(
                { success: false, error: 'Erro ao buscar credenciais do Poliweb.' },
                { status: 500 }
            );
        }

        const username = credentials?.username_antigo || credentials?.username;
        const password = credentials?.password_antigo || credentials?.password;

        if (!username || !password) {
            console.log('[Poliweb Antigo Login] Credenciais do Poliweb Antigo não configuradas para userId:', authResult.userId);
            return NextResponse.json(
                { 
                    success: false, 
                    error: 'Credenciais do Poliweb Antigo não configuradas.', 
                    needsCredentialUpdate: true,
                    missingType: 'antigo'
                },
                { status: 404 }
            );
        }

        // Step 1: GET login page to get session cookie and hidden fields
        console.log('[Poliweb Antigo Login] Buscando página de login:', `${POLIWEB_ANTIGO_BASE}/Login.aspx`);
        
        const loginPageResponse = await fetch(`${POLIWEB_ANTIGO_BASE}/Login.aspx`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'manual',
        });

        const loginPageHtml = await loginPageResponse.text();
        const initialCookies = loginPageResponse.headers.getSetCookie?.() || [];
        
        console.log('[Poliweb Antigo Login] Status da página:', loginPageResponse.status);
        console.log('[Poliweb Antigo Login] Cookies recebidos:', initialCookies.length);

        // Extract ViewState and EventValidation hidden fields (tentar múltiplos padrões)
        let viewStateMatch = loginPageHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
        let eventValidationMatch = loginPageHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);
        let viewStateGeneratorMatch = loginPageHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);
        
        // Alternativas de regex
        if (!viewStateMatch) viewStateMatch = loginPageHtml.match(/__VIEWSTATE"[^>]*value="([^"]+)"/);
        if (!eventValidationMatch) eventValidationMatch = loginPageHtml.match(/__EVENTVALIDATION"[^>]*value="([^"]+)"/);
        if (!viewStateGeneratorMatch) viewStateGeneratorMatch = loginPageHtml.match(/__VIEWSTATEGENERATOR"[^>]*value="([^"]+)"/);

        console.log('[Poliweb Antigo Login] ViewState encontrado:', !!viewStateMatch);
        console.log('[Poliweb Antigo Login] EventValidation encontrado:', !!eventValidationMatch);

        // Step 2: POST login form (tentar mesmo sem ViewState)
        const formBody = new URLSearchParams();
        formBody.append('username', username);
        formBody.append('password', password);
        
        if (viewStateMatch && viewStateMatch[1]) {
            formBody.append('__VIEWSTATE', viewStateMatch[1]);
        }
        if (eventValidationMatch && eventValidationMatch[1]) {
            formBody.append('__EVENTVALIDATION', eventValidationMatch[1]);
        }
        if (viewStateGeneratorMatch && viewStateGeneratorMatch[1]) {
            formBody.append('__VIEWSTATEGENERATOR', viewStateGeneratorMatch[1]);
        }

        console.log('[Poliweb Antigo Login] Enviando formulário de login...');

        const loginResponse = await fetch(`${POLIWEB_ANTIGO_BASE}/Login.aspx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cookie': initialCookies.join('; '),
                'Origin': POLIWEB_ANTIGO_BASE,
                'Referer': `${POLIWEB_ANTIGO_BASE}/Login.aspx`,
            },
            body: formBody.toString(),
            redirect: 'manual',
        });

        const sessionCookies = loginResponse.headers.getSetCookie?.() || [];
        
        console.log('[Poliweb Antigo Login] Resposta status:', loginResponse.status);
        console.log('[Poliweb Antigo Login] Cookies de sessão:', sessionCookies.length);

        // Check if login succeeded
        let isLoggedIn = false;
        let errorMessage = null;
        const location = loginResponse.headers.get('location');

        if (loginResponse.status === 302) {
            console.log('[Poliweb Antigo Login] Location:', location);
            isLoggedIn = !!(location && !location.includes('Login') && !location.includes('Erro') && !location.includes('erro'));
        } else if (loginResponse.status === 200) {
            const bodyText = await loginResponse.text();
            const lowerBody = bodyText.toLowerCase();
            const hasLoginForm = bodyText.includes('name="username"') || bodyText.includes('name="password"');
            const hasErrorIndicator =
                lowerBody.includes('class="error"') ||
                lowerBody.includes('class="erro"') ||
                lowerBody.includes('alert') ||
                lowerBody.includes('inval');

            console.log('[Poliweb Antigo Login] Resposta 200, contém username:', bodyText.includes('username'));
            console.log('[Poliweb Antigo Login] Possui form de login:', hasLoginForm, 'Possui indicador de erro:', hasErrorIndicator);

            // Se houver indicador claro de erro, tratamos como credenciais inválidas
            if (hasErrorIndicator) {
                errorMessage = 'Credenciais inválidas. Verifique seu email e senha no Poliweb Antigo.';
                console.log('[Poliweb Antigo Login] Erro: credenciais inválidas (indicador de erro encontrado na página)');
            } else if (!hasLoginForm) {
                // 200 sem form de login costuma indicar que já estamos autenticados
                isLoggedIn = true;
                console.log('[Poliweb Antigo Login] Login pareceu ter sucesso (200 sem form de login)');
            } else {
                // Há form, mas sem mensagem explícita de erro: em muitos portais isso é apenas um loader/template.
                // Deixamos a decisão final para a combinação de cookies/logo abaixo.
                console.log('[Poliweb Antigo Login] Página com form de login mas sem erro explícito - decisão dependerá dos cookies/redirects');
            }
        }

        console.log('[Poliweb Antigo Login] isLoggedIn:', isLoggedIn);

        // Merge all cookies
        const allCookies = mergeCookies(initialCookies, sessionCookies);

        // Aceitar login se tiver cookies ou se for redirecionamento bem-sucedido
        const hasSessionCookies = sessionCookies.length > 0;
        const hasAnyCookies = allCookies.length > 0;
        const shouldAcceptLogin = isLoggedIn || hasSessionCookies || hasAnyCookies || (loginResponse.status === 302 && location);
        
        console.log('[Poliweb Antigo Login] Tem cookies de sessão:', hasSessionCookies);
        console.log('[Poliweb Antigo Login] Total de cookies após merge:', allCookies.length);
        console.log('[Poliweb Antigo Login] Aceitar login:', shouldAcceptLogin);

        if (shouldAcceptLogin) {
            // Store session in memory for the proxy to use
            storeSession(authResult.userId, allCookies, '', 'antigo');

            console.log('[Poliweb Antigo Login] Sessão armazenada sucesso!');

            return NextResponse.json({
                success: true,
                cookies: allCookies,
                dashboardUrl: `${POLIWEB_ANTIGO_BASE}/`,
            });
        }

        return NextResponse.json({
            success: false,
            error: errorMessage || 'Falha no login. Verifique suas credenciais do Poliweb Antigo.'
        }, { status: 401 });
    } catch (error) {
        console.error('Erro no auto-login Poliweb Antigo:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao realizar login automático no Poliweb Antigo' },
            { status: 500 }
        );
    }
}
