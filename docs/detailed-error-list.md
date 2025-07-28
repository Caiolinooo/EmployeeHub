# Detailed TypeScript Error List

**Generated:** 2025-01-25  
**Command:** `npx tsc --noEmit`  
**Total:** 435 errors in 130 files

## Error Summary by File

### Core Library Files

#### src/lib/auth.ts (6 errors)
```
Line 11: Module '"jsonwebtoken"' has no default export
Line 12: Module '"crypto"' has no default export  
Line 15: Cannot find module '@/types/supabase'
Line 19: Module '"bcryptjs"' can only be default-imported using 'esModuleInterop'
Line 295: Property 'exp' does not exist on type 'TokenPayload'
Line 295: Property 'exp' does not exist on type 'TokenPayload'
```

#### src/lib/authorization.ts (21 errors)
```
Line 30: Cannot find name 'prisma'
Line 54: Cannot find name 'prisma'
Line 77: Cannot find name 'prisma'
Line 96: Cannot find name 'prisma'
Line 108: Cannot find name 'prisma'
Line 116: Type '"expired"' is not assignable to type '"pending" | "active" | "rejected"'
Line 126: Type '"expired"' is not assignable to type '"pending" | "active" | "rejected"'
Line 132: Cannot find name 'prisma'
Line 139: Cannot find name 'prisma'
Line 155: Cannot find name 'prisma'
Line 203: Cannot find name 'prisma'
Line 228: Cannot find name 'prisma'
Line 244: Cannot find name 'prisma'
Line 314: Cannot find name 'prisma'
Line 346: Cannot find name 'prisma'
Line 394: Cannot find name 'prisma'
Line 409: Cannot find name 'prisma'
Line 425: Cannot find name 'prisma'
Line 470: Cannot find name 'prisma'
Line 490: Cannot find name 'prisma'
Line 506: Cannot find name 'prisma'
```

#### src/lib/user-verification.ts (6 errors)
```
Line 21: Cannot find name 'prisma'
Line 44: Cannot find name 'prisma'
Line 76: Cannot find name 'prisma'
Line 140: Cannot find name 'prisma'
Line 160: Cannot find name 'prisma'
Line 203: Cannot find name 'prisma'
```

### API Routes

#### src/app/api/auth/register/route.ts (2 errors)
```
Line 21: Various Prisma-related errors
```

#### src/app/api/auth/set-password/route.ts (2 errors)
```
Line 26: Various Prisma-related errors
```

### Translation Files

#### src/i18n/locales/en-US.ts (8 errors)
```
Line 84: Object literal cannot have multiple properties with the same name 'accessDenied'
Line 86: Object literal cannot have multiple properties with the same name 'refresh'
Line 144: Object literal cannot have multiple properties with the same name 'backToStart'
Line 361: Object literal cannot have multiple properties with the same name 'viewer'
Line 395: Object literal cannot have multiple properties with the same name 'reimbursement'
Line 578: Object literal cannot have multiple properties with the same name 'description'
Line 606: Object literal cannot have multiple properties with the same name 'order'
Line 784: Object literal cannot have multiple properties with the same name 'observacoes'
```

#### src/i18n/locales/pt-BR.ts (9 errors)
```
Line 136: Object literal cannot have multiple properties with the same name 'observacoes'
Line 211: Object literal cannot have multiple properties with the same name 'all'
Line 526: Object literal cannot have multiple properties with the same name 'viewer'
Line 553: Object literal cannot have multiple properties with the same name 'reimbursement'
Line 700: Object literal cannot have multiple properties with the same name 'description'
Line 728: Object literal cannot have multiple properties with the same name 'order'
Line 766: Object literal cannot have multiple properties with the same name 'common'
Line 836: Object literal cannot have multiple properties with the same name 'all'
Line 841: Object literal cannot have multiple properties with the same name 'tryAgain'
```

### Component Files

#### src/components/ReimbursementApproval.tsx (6 errors)
```
Line 54: Property 'accessPermissions' does not exist on type 'User'
Line 55: Property 'access_permissions' does not exist on type 'User'
Line 75: Property 'accessPermissions' does not exist on type 'User'
Line 76: Property 'access_permissions' does not exist on type 'User'
Line 84: Property 'accessPermissions' does not exist on type 'User'
Line 85: Property 'access_permissions' does not exist on type 'User'
```

#### src/components/ReimbursementDashboard.tsx (4 errors)
```
Line 115: Parameter 'item' implicitly has an 'any' type
Line 428: Property 'info' does not exist on toast type
Line 468: Property 'title' does not exist in ReactElement type
Line 680: Comparison appears to be unintentional
```

### Email System Files

#### src/lib/email-exchange.ts (5 errors)
```
Line 71: No overload matches this call for nodemailer.createTransport
Line 195: Argument type mismatch for sendMail
Line 196: Property 'messageId' does not exist
Line 201: Argument type mismatch for getTestMessageUrl
Line 212: Property 'messageId' does not exist
```

#### src/lib/sms.ts (5 errors)
```
Line 177: Type 'string | false | undefined' is not assignable to type 'string | undefined'
Line 200: Argument type 'string | undefined' is not assignable to parameter type 'string'
Line 203: Cannot find name 'phoneNumber'
Line 210: Type 'boolean' is not assignable to return type
Line 213: Type 'boolean' is not assignable to return type
```

### Payroll System Files

#### src/lib/payroll/legal-tables.ts (9 errors)
```
Line 7: Cannot redeclare exported variable 'INSS_TABLE_2025'
Line 48: Cannot redeclare exported variable 'IRRF_TABLE_2025'
Line 98: Cannot redeclare exported variable 'FGTS_TABLE'
Line 271: Cannot redeclare exported variable 'INSS_TABLE_2025' (export statement)
Line 271: Export declaration conflicts with exported declaration
Line 271: Cannot redeclare exported variable 'IRRF_TABLE_2025' (export statement)
Line 271: Export declaration conflicts with exported declaration
Line 271: Cannot redeclare exported variable 'FGTS_TABLE' (export statement)
Line 271: Export declaration conflicts with exported declaration
```

### Hooks and Services

#### src/hooks/useSupabase.ts (5 errors)
```
Line 254: Type '"users_unified"' does not satisfy constraint
Line 274: Type '"users_unified"' does not satisfy constraint
Line 282: Type '"users_unified"' does not satisfy constraint
Line 295: Type '"users_unified"' does not satisfy constraint
Line 354: Element implicitly has an 'any' type
```

#### src/services/userService.ts (7 errors)
```
Line 40: Type '"users_unified"' does not satisfy constraint
Line 60: Type '"users_unified"' does not satisfy constraint
Line 80: Type '"users_unified"' does not satisfy constraint
Line 100: Type '"users_unified"' does not satisfy constraint
Line 157: Type '"users_unified"' does not satisfy constraint
Line 178: Type '"users_unified"' does not satisfy constraint
Line 264: Element implicitly has an 'any' type
```

## Twilio Module Errors (159 errors)

All Twilio-related files have esModuleInterop issues:
- node_modules/twilio/lib/rest/*.d.ts files
- Pattern: "can only be default-imported using the 'esModuleInterop' flag"

## Fix Priority Matrix

### Immediate (Blocking)
1. Core authentication files (auth.ts, authorization.ts, user-verification.ts)
2. Supabase type definitions
3. JWT token types

### High Priority
1. API routes with Prisma calls
2. Component Prisma dependencies
3. Translation duplicate properties

### Medium Priority
1. React component type issues
2. Email system types
3. Module import issues

### Low Priority
1. Payroll system duplicate exports
2. Twilio esModuleInterop issues (if not using Twilio features)
3. Minor type mismatches

## Resolution Strategy

1. **Phase 1:** Fix core authentication system
2. **Phase 2:** Update API routes systematically
3. **Phase 3:** Fix component and UI issues
4. **Phase 4:** Polish and optimization

Each phase should be tested before moving to the next to ensure stability.
