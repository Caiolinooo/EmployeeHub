import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { storeSession, mergeCookies } from '@/lib/poliweb-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLIWEB_BASE = 'https://poliweb.policlinicamacae.com.br';

/**
 * POST /api/poliweb/login
 * Performs auto-login to Poliweb using stored credentials
 * Stores session cookies for the proxy to use
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

        // Get credentials for this user (prefer new fields, fallback to old)
        const client = await supabaseAdmin;
        const { data: credentials, error: credError } = await client
            .from('poliweb_credentials')
            .select('username, username_novo, password, password_novo')
            .eq('user_id', authResult.userId)
            .single();

        if (credError && credError.code !== 'PGRST116') {
            console.error('[Poliweb Login] Erro ao buscar credenciais para userId:', authResult.userId, 'Error:', credError);
            return NextResponse.json(
                { success: false, error: 'Erro ao buscar credenciais do Poliweb.' },
                { status: 500 }
            );
        }

        const email = credentials?.username_novo || credentials?.username;
        const password = credentials?.password_novo || credentials?.password;

        if (!email || !password) {
            console.log('[Poliweb Login] Credenciais do Novo Poliweb não configuradas para userId:', authResult.userId);
            return NextResponse.json(
                { 
                    success: false, 
                    error: 'Credenciais do Poliweb Novo não configuradas.', 
                    needsCredentialUpdate: true,
                    missingType: 'novo'
                },
                { status: 404 }
            );
        }

        console.log('[Poliweb Login] Iniciando auto-login para userId:', authResult.userId, 'com email:', email);

        // Step 1: GET login page to get CSRF token and initial cookies
        const loginPageResponse = await fetch(`${POLIWEB_BASE}/Identity/Account/Login`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'manual',
        });

        console.log('[Poliweb Login] Login page status:', loginPageResponse.status);

        const loginPageHtml = await loginPageResponse.text();
        const initialCookies = loginPageResponse.headers.getSetCookie?.() || [];

        console.log('[Poliweb Login] Initial cookies received:', initialCookies.length);

        // Extract CSRF token from the HTML
        const csrfMatch = loginPageHtml.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/);
        if (!csrfMatch) {
            console.error('[Poliweb Login] Não foi possível encontrar CSRF token na página de login');
            return NextResponse.json(
                { success: false, error: 'Erro ao obter token de segurança do Poliweb' },
                { status: 500 }
            );
        }

        const csrfToken = csrfMatch[1];

        // Step 2: POST login form to the Identity endpoint
        const formBody = new URLSearchParams();
        formBody.append('Input.Email', email);
        formBody.append('Input.Password', password);
        formBody.append('Input.RememberMe', 'true');
        formBody.append('__RequestVerificationToken', csrfToken);

        console.log('[Poliweb Login] Enviando formulário de login...');

        const loginResponse = await fetch(`${POLIWEB_BASE}/Identity/Account/Login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cookie': initialCookies.join('; '),
            },
            body: formBody.toString(),
            redirect: 'manual',
        });

        const sessionCookies = loginResponse.headers.getSetCookie?.() || [];
        const location = loginResponse.headers.get('location');

        console.log('[Poliweb Login] Login response status:', loginResponse.status, 'Location:', location);
        console.log('[Poliweb Login] Session cookies received:', sessionCookies.length);

        // Check if login succeeded
        const isLoggedIn = loginResponse.status === 302 && location &&
            !location.includes('Login') &&
            !location.includes('Account');

        // Merge all cookies
        const allCookies = mergeCookies(initialCookies, sessionCookies);

        if (isLoggedIn || loginResponse.status === 200) {
            // If status 200, check if the response contains dashboard content
            if (loginResponse.status === 200) {
                const bodyText = await loginResponse.text();
                if (bodyText.includes('Input_Password') && bodyText.includes('Input_Email')) {
                    console.error('[Poliweb Login] Credenciais inválidas - página de login retornada');
                    return NextResponse.json({
                        success: false,
                        error: 'Credenciais inválidas. Verifique seu email e senha no Poliweb.'
                    }, { status: 401 });
                }
            }

            // Get the dashboard page to extract a fresh CSRF token
            const dashboardPath = isLoggedIn && location ? location : '/PainelEmpresa';
            const dashboardUrl = `${POLIWEB_BASE}${dashboardPath}`;

            console.log('[Poliweb Login] Buscando dashboard:', dashboardUrl);

            const dashboardResponse = await fetch(dashboardUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                    'Cookie': allCookies.join('; '),
                },
                redirect: 'manual',
            });

            const dashboardHtml = await dashboardResponse.text();
            const dashboardCookies = dashboardResponse.headers.getSetCookie?.() || [];

            console.log('[Poliweb Login] Dashboard status:', dashboardResponse.status, 'Cookies:', dashboardCookies.length);

            // Extract fresh CSRF token from dashboard
            const dashboardCsrfMatch = dashboardHtml.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/);
            const freshCsrfToken = dashboardCsrfMatch ? dashboardCsrfMatch[1] : csrfToken;

            // Merge all cookies
            const finalCookies = mergeCookies(allCookies, dashboardCookies);

            // Store session in memory for the proxy to use
            storeSession(authResult.userId, finalCookies, freshCsrfToken);

            console.log('[Poliweb Login] Sessão armazenada com sucesso para userId:', authResult.userId, 'Cookies totais:', finalCookies.length);

            return NextResponse.json({
                success: true,
                cookies: finalCookies,
                csrfToken: freshCsrfToken,
                dashboardUrl: `${POLIWEB_BASE}/PainelEmpresa`,
            });
        }

        console.error('[Poliweb Login] Falha no login - status:', loginResponse.status);
        return NextResponse.json({
            success: false,
            error: 'Falha no login. Verifique suas credenciais do Poliweb.'
        }, { status: 401 });

    } catch (error) {
        console.error('Erro no auto-login Poliweb:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao realizar login automático no Poliweb' },
            { status: 500 }
        );
    }
}
