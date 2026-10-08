import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { loadEffectivePermissions } from '@/lib/effective-permissions-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/effective-permissions
 *
 * Sector -> role -> individual (explicit true/false wins) -> ACL (user + role).
 * Composition lives in `composeEffectiveModules` (src/lib/effective-feature.ts) and is
 * shared with the server gates (`userHasModule` / `userHasGrant`).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
      if (tokenCookie) token = tokenCookie.value;
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    const snapshot = await loadEffectivePermissions(payload.userId);
    if (!snapshot) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        user_id: snapshot.userId,
        role: snapshot.role,
        sector_id: snapshot.sectorId,
        effective_modules: snapshot.modules,
        effective_features: snapshot.features,
        acl_permission_names: snapshot.aclNames,
        effective_cards: snapshot.cards,
        _debug: {
          source: {
            sector: snapshot.sectorId ? 'applied' : 'none',
            role: snapshot.role.toUpperCase(),
            user_override: snapshot.hasUserOverride ? 'applied' : 'none',
            acl: snapshot.aclModulesApplied.length > 0 ? 'applied' : 'none',
          },
          sector_modules_raw: snapshot.sectorModulesRaw,
          effective_modules_keys: Object.keys(snapshot.modules),
          acl_modules_applied: snapshot.aclModulesApplied,
          acl_permission_names: snapshot.aclNames,
          effective_features_keys: Object.keys(snapshot.features),
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error: any) {
    console.error('Error calculating effective permissions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
