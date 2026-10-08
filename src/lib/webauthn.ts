import {
    verifyAuthenticationResponse,
    type AuthenticationResponseJSON,
    type AuthenticatorTransportFuture,
    type WebAuthnCredential,
} from '@simplewebauthn/server';
import { supabaseAdmin } from './db';

const rpName = 'ABZ Group';

export function getWebAuthnConfig(requestHost?: string | null) {
    // Definimos o RP ID como o hostname da requisição sem a porta, se tiver
    let rpID = 'localhost';
    let expectedOrigin = 'http://localhost:3000';

    if (requestHost) {
        if (requestHost.includes('localhost') || requestHost.includes('127.0.0.1')) {
            rpID = requestHost.split(':')[0];
            expectedOrigin = `http://${requestHost}`;
        } else {
            rpID = requestHost.split(':')[0];
            expectedOrigin = `https://${requestHost}`;
        }
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
        try {
            const url = new URL(process.env.NEXT_PUBLIC_SITE_URL);
            rpID = url.hostname;
            expectedOrigin = url.origin;
        } catch (e) {
            // ignore
        }
    }

    return {
        rpName,
        rpID,
        expectedOrigin
    };
}

export async function getUserPasskeys(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('user_passkeys')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user passkeys:', error);
        return [];
    }

    return data || [];
}

export async function saveUserPasskey(passkey: any) {
    const { error } = await supabaseAdmin
        .from('user_passkeys')
        .insert([
            {
                user_id: passkey.user_id,
                credential_id: passkey.credential_id,
                public_key: passkey.public_key,
                counter: passkey.counter,
                device_type: passkey.device_type,
                backed_up: passkey.backed_up,
                transports: passkey.transports
            }
        ]);

    if (error) {
        console.error('Error saving user passkey:', error);
        throw error;
    }
}

export async function updatePasskeyCounter(credentialId: string, newCounter: number) {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
        .from('user_passkeys')
        .update({ counter: newCounter, last_used_at: now })
        .eq('credential_id', credentialId);

    if (error) {
        console.error('Error updating passkey counter:', error);
    }
}

export async function saveChallenge(userId: string, challenge: string) {
    const { error } = await supabaseAdmin
        .from('users_unified')
        .update({ webauthn_challenge: challenge })
        .eq('id', userId);

    if (error) {
        console.error('Error saving challenge:', error);
        throw error;
    }
}

export async function getAndClearChallenge(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('users_unified')
        .select('webauthn_challenge')
        .eq('id', userId)
        .single();

    if (error || !data) {
        return null;
    }

    // Clear challenge
    await supabaseAdmin
        .from('users_unified')
        .update({ webauthn_challenge: null })
        .eq('id', userId);

    return data.webauthn_challenge;
}

const TRANSPORTES: readonly AuthenticatorTransportFuture[] = [
    'ble',
    'cable',
    'hybrid',
    'internal',
    'nfc',
    'smart-card',
    'usb',
];

function isTransporte(value: string): value is AuthenticatorTransportFuture {
    return (TRANSPORTES as readonly string[]).includes(value);
}

export class BiometricGateError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'BiometricGateError';
        this.status = status;
    }
}

export interface ProvaBiometrica {
    method: 'webauthn';
    credentialId: string;
    userVerified: true;
    origin: string;
    deviceType: 'singleDevice' | 'multiDevice';
}

export function isAuthenticationResponse(value: unknown): value is AuthenticationResponseJSON {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    if (row.type !== 'public-key' || typeof row.id !== 'string' || row.id.length === 0) return false;
    if (typeof row.rawId !== 'string' || row.rawId !== row.id) return false;
    if (!row.response || typeof row.response !== 'object') return false;
    const response = row.response as Record<string, unknown>;
    return (
        typeof response.clientDataJSON === 'string'
        && typeof response.authenticatorData === 'string'
        && typeof response.signature === 'string'
        && (response.userHandle === undefined || typeof response.userHandle === 'string')
    );
}

/**
 * Exige asserção WebAuthn com UV antes da batida.
 * Guarda só o id da credencial. Não persiste template nem a asserção.
 */
export async function verificarAssercaoPonto(
    userId: string,
    requestHost: string | null,
    body: unknown,
): Promise<ProvaBiometrica> {
    if (!isAuthenticationResponse(body)) {
        throw new BiometricGateError('Biometria obrigatória para registrar o ponto.', 400);
    }

    const expectedChallenge = await getAndClearChallenge(userId);
    if (!expectedChallenge) {
        throw new BiometricGateError('A confirmação biométrica expirou. Tente de novo.', 400);
    }

    const { data: passkey, error } = await supabaseAdmin
        .from('user_passkeys')
        .select('credential_id, public_key, counter, transports')
        .eq('credential_id', body.id)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('[webauthn/punch] falha ao ler passkey:', error.message);
        throw new BiometricGateError('Não foi possível validar a biometria.', 500);
    }
    if (!passkey?.credential_id || !passkey.public_key) {
        throw new BiometricGateError(
            'Nenhuma biometria cadastrada para este usuário. Cadastre em Perfil → Biometria (Passkeys).',
            400,
        );
    }

    const { rpID, expectedOrigin } = getWebAuthnConfig(requestHost);
    const transports = typeof passkey.transports === 'string'
        ? passkey.transports.split(',').map((item: string) => item.trim()).filter(isTransporte)
        : undefined;
    const credential: WebAuthnCredential = {
        id: String(passkey.credential_id),
        publicKey: new Uint8Array(Buffer.from(String(passkey.public_key), 'base64url')),
        counter: Number(passkey.counter) || 0,
        ...(transports && transports.length > 0 ? { transports } : {}),
    };

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpID,
            credential,
            requireUserVerification: true,
        });
    } catch (err) {
        console.error('[webauthn/punch] verificação falhou:', err instanceof Error ? err.message : err);
        throw new BiometricGateError('Biometria não confirmada. O ponto não foi registrado.', 401);
    }

    const info = verification.authenticationInfo;
    if (!verification.verified || !info?.userVerified) {
        throw new BiometricGateError('Biometria não confirmada. O ponto não foi registrado.', 401);
    }

    await updatePasskeyCounter(String(passkey.credential_id), info.newCounter);

    switch (info.credentialDeviceType) {
        case 'singleDevice':
        case 'multiDevice':
            return {
                method: 'webauthn',
                credentialId: info.credentialID,
                userVerified: true,
                origin: info.origin,
                deviceType: info.credentialDeviceType,
            };
        default: {
            const _nunca: never = info.credentialDeviceType;
            console.error('[webauthn/punch] device type inesperado:', _nunca);
            throw new BiometricGateError('Biometria não confirmada. O ponto não foi registrado.', 401);
        }
    }
}
