import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { getFullPermissionsForRole } from '@/config/modules';
import { mergeEffectiveFeatures } from '@/lib/effective-feature';

export const dynamic = 'force-dynamic';


/**
 * GET /api/user/effective-permissions
 * 
 * Calculates the effective permissions for the current user based on:
 * 1. Sector defaults (base layer)
 * 2. Role defaults (override layer 1 - ADMIN/MANAGER override sector)
 * 3. User individual permissions (override layer 2)
 * 4. ACL permissions (override layer 3 - from user_acl_permissions + role_acl_permissions)
 */
export async function GET(request: NextRequest) {
    try {
        // Get token from header or cookie
        const authHeader = request.headers.get('authorization');
        let token = extractTokenFromHeader(authHeader || undefined);

        if (!token) {
            const tokenCookie = request.cookies.get('abzToken') || request.cookies.get('token');
            if (tokenCookie) {
                token = tokenCookie.value;
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
        }

        const userId = payload.userId;

        // Fetch user profile with sector info
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('users_unified')
            .select('id, role, sector_id, access_permissions')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }

        // Layer 1: Sector Defaults
        let effectiveModules: Record<string, boolean> = {};
        let effectiveCards: string[] = [];
        let sectorRawModules: string[] = [];

        console.log(`🔍 [effective-permissions] Processing user: ${userId}, role: ${profile.role}, sector_id: ${profile.sector_id}`);

        if (profile.sector_id) {
            const { data: sector, error: sectorError } = await supabaseAdmin
                .from('sectors')
                .select('allowed_modules, allowed_cards')
                .eq('id', profile.sector_id)
                .single();

            console.log(`📊 [effective-permissions] Sector query result:`, {
                sector_id: profile.sector_id,
                sector_found: !!sector,
                error: sectorError?.message,
                raw_allowed_modules: sector?.allowed_modules
            });

            if (sector) {
                // Convert sector's allowed_modules array to a map
                sectorRawModules = sector.allowed_modules || [];
                (sector.allowed_modules || []).forEach((mod: string) => {
                    effectiveModules[mod] = true;
                });
                effectiveCards = sector.allowed_cards || [];
                console.log(`✅ [effective-permissions] Sector modules loaded:`, {
                    count: sectorRawModules.length,
                    modules: sectorRawModules
                });
            } else {
                console.warn(`⚠️ [effective-permissions] Sector not found for ID: ${profile.sector_id}`);
            }
        } else {
            console.log(`ℹ️ [effective-permissions] User has no sector assigned`);
        }

        // Layer 2 & 3: Role Override & Strict Sector Mode
        const userRole = (profile.role || 'USER').toUpperCase();
        const roleDefaults = {
            modules: getFullPermissionsForRole(userRole)
        };

        // Core modules that are ALWAYS enabled for everyone regardless of sector
        // dashboard is the only mandatory module.
        const coreModules = ['dashboard'];

        // Legacy/Label mapping to ID (Normalization)
        // This handles cases where DB has 'KPIs' (label) instead of 'kpi' (id)
        const normalizeModuleId = (idOrLabel: string): string => {
            const lower = idOrLabel.toLowerCase().trim();
            const map: Record<string, string> = {
                'purchase-orders': 'compras',
                'purchase orders': 'compras',
                'ordens de compra': 'compras',
                'kpis': 'kpi',
                'wk radar': 'wkradar',
                'radar': 'wkradar',
                'lista de ramais': 'contatos',
                'ramais': 'contatos',
                'emergência': 'emergencia',
                'emergencia': 'emergencia',
                'guia offshore': 'guia_offshore',
                'integração erp': 'integracao-erp',
                'integracao erp': 'integracao-erp',
                'todas as solicitações': 'ferias_admin',
                'todas ferias': 'ferias_admin',
                'todas as férias': 'ferias_admin',
                'gerenciar férias': 'ferias_admin'
            };
            return map[lower] || lower; // default to lowercase if not mapped
        };

        // ADMIN and MANAGER roles ALWAYS get their defined modules, overriding sector
        if (userRole === 'ADMIN' || userRole === 'MANAGER') {
            effectiveModules = { ...effectiveModules, ...roleDefaults.modules };
            if (userRole === 'ADMIN') {
                effectiveModules['ferias_admin'] = true;
            }
        } else {
            // USER Role Logic
            if (profile.sector_id) {
                // STRICT SECTOR MODE:
                // If user has a sector, they ONLY get:
                // 1. Modules explicitly allowed by the sector (already in effectiveModules)
                // 2. Core modules (dashboard, noticias, etc.)
                // 3. Modules explicitly granted to the user individually (Layer 3)

                // We do NOT merge sensitive role defaults (like 'compras', 'ponto') 
                // preventing them from leaking into restricted sectors.

                // Normalize keys in effectiveModules from Sector
                // We built effectiveModules from sector.allowed_modules initially. 
                // We need to ensure those keys are normalized.
                const normalizedModules: Record<string, boolean> = {};
                Object.keys(effectiveModules).forEach(key => {
                    if (effectiveModules[key]) {
                        normalizedModules[normalizeModuleId(key)] = true;
                    }
                });
                effectiveModules = normalizedModules;

                // Ensure core modules are enabled (regardless of role defaults)
                coreModules.forEach(mod => {
                    if (effectiveModules[mod] === undefined) {
                        effectiveModules[mod] = true;
                    }
                });
            } else {
                // NO SECTOR:
                // Fallback to role defaults for users without a sector (legacy behavior)
                // For USER role, merge default permissions
                for (const [mod, enabled] of Object.entries(roleDefaults.modules)) {
                    if (effectiveModules[mod] === undefined) {
                        effectiveModules[mod] = enabled;
                    }
                }
            }
        }

        // Layer 3: User Individual Override (highest priority)
        const userPermissions = profile.access_permissions as {
            modules?: Record<string, boolean>;
            features?: Record<string, boolean | undefined>;
        } | null;
        if (userPermissions?.modules) {
            effectiveModules = { ...effectiveModules, ...userPermissions.modules };
        }

        // Layer 4: ACL Permissions (from user_acl_permissions + role_acl_permissions)
        // If user has ANY ACL permission for a resource (e.g. ferias.read), enable that module
        let aclModulesApplied: string[] = [];
        let aclPermissionNames: string[] = [];
        try {
            const userAclPromise = supabaseAdmin
                .from('user_acl_permissions')
                .select('permission_id')
                .eq('user_id', userId);

            const roleAclPromise = supabaseAdmin
                .from('role_acl_permissions')
                .select('permission_id')
                .eq('role', userRole);

            const [userAclResult, roleAclResult] = await Promise.all([
                userAclPromise,
                roleAclPromise
            ]);

            const userAclPermIds = (userAclResult.data || []).map(p => p.permission_id);
            const roleAclPermIds = (roleAclResult.data || []).map(p => p.permission_id);
            const allAclPermIds = [...new Set([...userAclPermIds, ...roleAclPermIds])];

            if (allAclPermIds.length > 0) {
                const { data: aclPerms } = await supabaseAdmin
                    .from('acl_permissions')
                    .select('resource, name, action')
                    .in('id', allAclPermIds)
                    .eq('enabled', true);

                if (aclPerms) {
                    aclPermissionNames = [...new Set(aclPerms.map((perm) => perm.name).filter(Boolean))];
                    const uniqueResources = [...new Set(aclPerms.map(p => p.resource))];
                    uniqueResources.forEach(resource => {
                        if (!effectiveModules[resource]) {
                            effectiveModules[resource] = true;
                            aclModulesApplied.push(resource);
                        }
                    });

                    // Mapeamento especial de ACLs de férias para ferias_admin
                    aclPerms.forEach(perm => {
                        if (perm.resource === 'ferias' && (perm.action === 'admin' || perm.action === 'manage')) {
                            if (!effectiveModules['ferias_admin']) {
                                effectiveModules['ferias_admin'] = true;
                                aclModulesApplied.push('ferias_admin');
                            }
                        }
                    });
                }
            }
        } catch (aclError) {
            // ACL tables may not exist (migration not run) - non-fatal
            console.warn('[effective-permissions] ACL tables not available, skipping Layer 4:', aclError);
        }

        const effectiveFeatures = mergeEffectiveFeatures(userPermissions?.features, aclPermissionNames);

        // Build final response
        const response = {
            user_id: userId,
            role: profile.role,
            sector_id: profile.sector_id,
            effective_modules: effectiveModules,
            effective_features: effectiveFeatures,
            acl_permission_names: aclPermissionNames,
            effective_cards: effectiveCards,
            // Source info for debugging
            _debug: {
                source: {
                    sector: profile.sector_id ? 'applied' : 'none',
                    role: userRole,
                    user_override: userPermissions ? 'applied' : 'none',
                    acl: aclModulesApplied.length > 0 ? 'applied' : 'none'
                },
                role_defaults_applied: Object.keys(roleDefaults.modules),
                sector_modules_raw: sectorRawModules,
                sector_modules_count: Object.keys(effectiveModules).length,
                effective_modules_keys: Object.keys(effectiveModules),
                acl_modules_applied: aclModulesApplied,
                acl_permission_names: aclPermissionNames,
                effective_features_keys: Object.keys(effectiveFeatures)
            }
        };

        console.log(`✅ [effective-permissions] Final response:`, {
            user_id: userId,
            role: profile.role,
            sector_id: profile.sector_id,
            effective_modules_count: Object.keys(effectiveModules).length,
            effective_modules: effectiveModules,
            has_academy: !!effectiveModules['academy'],
            has_biblioteca: !!effectiveModules['biblioteca'],
            has_avaliacao: !!effectiveModules['avaliacao'],
            has_ajuda: !!effectiveModules['ajuda']
        });

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });

    } catch (error: any) {
        console.error('Error calculating effective permissions:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
