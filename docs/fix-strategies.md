# Fix Strategies for TypeScript Errors

**Date:** 2025-01-25  
**Project:** Painel ABZ  
**Purpose:** Detailed strategies for resolving each category of TypeScript errors

## 1. Prisma to Supabase Migration Strategy

### Overview
Convert all Prisma ORM calls to Supabase client calls while maintaining functionality.

### Pattern Conversion Examples

#### User Queries
```typescript
// OLD (Prisma)
const user = await prisma.user.findFirst({
  where: { email: email }
});

// NEW (Supabase)
const { data: user, error } = await supabase
  .from('users_unified')
  .select('*')
  .eq('email', email)
  .single();
```

#### Complex Queries with OR conditions
```typescript
// OLD (Prisma)
const user = await prisma.user.findFirst({
  where: {
    OR: [
      { email: email },
      { phoneNumber: phoneNumber }
    ]
  }
});

// NEW (Supabase)
const { data: user, error } = await supabase
  .from('users_unified')
  .select('*')
  .or(`email.eq.${email},phone_number.eq.${phoneNumber}`)
  .single();
```

#### Create Operations
```typescript
// OLD (Prisma)
const newUser = await prisma.user.create({
  data: {
    email: email,
    firstName: firstName,
    phoneNumber: phoneNumber
  }
});

// NEW (Supabase)
const { data: newUser, error } = await supabase
  .from('users_unified')
  .insert({
    email: email,
    first_name: firstName,
    phone_number: phoneNumber
  })
  .select()
  .single();
```

#### Update Operations
```typescript
// OLD (Prisma)
const updatedUser = await prisma.user.update({
  where: { id: userId },
  data: { active: true }
});

// NEW (Supabase)
const { data: updatedUser, error } = await supabase
  .from('users_unified')
  .update({ active: true })
  .eq('id', userId)
  .select()
  .single();
```

### Field Mapping (Prisma → Supabase)
```typescript
// Common field name changes
phoneNumber → phone_number
firstName → first_name
lastName → last_name
accessPermissions → access_permissions
profileData → profile_data
passwordHash → password_hash
taxId → tax_id
```

### Error Handling Pattern
```typescript
// Always include error handling
const { data, error } = await supabase.from('table').select();

if (error) {
  console.error('Database error:', error);
  // Handle error appropriately
  return null; // or throw error
}

// Use data safely
```

## 2. Type Definition Strategy

### Supabase Types Enhancement
```typescript
// Add to src/types/supabase.ts
export interface Database {
  public: {
    Tables: {
      users_unified: {
        Row: {
          id: string;
          email: string;
          phone_number?: string;
          first_name?: string;
          last_name?: string;
          role: 'admin' | 'gerente' | 'user';
          active: boolean;
          access_permissions?: string;
          profile_data?: any;
          password_hash?: string;
          tax_id?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          phone_number?: string;
          first_name?: string;
          last_name?: string;
          role?: 'admin' | 'gerente' | 'user';
          active?: boolean;
          access_permissions?: string;
          profile_data?: any;
          password_hash?: string;
          tax_id?: string;
        };
        Update: {
          email?: string;
          phone_number?: string;
          first_name?: string;
          last_name?: string;
          role?: 'admin' | 'gerente' | 'user';
          active?: boolean;
          access_permissions?: string;
          profile_data?: any;
          password_hash?: string;
          tax_id?: string;
        };
      };
    };
  };
}
```

### JWT Token Types
```typescript
// Add to src/types/auth.ts
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp: number; // Add missing expiration property
  iat: number;
}
```

### User Type Standardization
```typescript
// Use consistent User type throughout
import { Tables } from '@/types/supabase';
export type User = Tables<'users_unified'>;
```

## 3. Module Import Strategy

### esModuleInterop Configuration
```json
// tsconfig.json - Already configured correctly
{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

### Import Pattern Fixes
```typescript
// OLD (causing errors)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// NEW (correct syntax)
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// OR use require for Node.js modules
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
```

### Twilio Import Fix
```typescript
// OLD
import twilio from 'twilio';

// NEW
import * as twilio from 'twilio';
// OR
const twilio = require('twilio');
```

## 4. Translation System Strategy

### Duplicate Property Resolution
```typescript
// Identify duplicates in translation files
// src/i18n/locales/en-US.ts and pt-BR.ts

// Strategy: Keep the most recent/complete definition
// Remove older duplicate entries
// Ensure consistent key naming across languages
```

### Translation Function Fixes
```typescript
// Fix function signature mismatches
// Ensure t() function calls match expected parameters
// Update component translation usage
```

## 5. React Component Type Strategy

### Currency Component Fixes
```typescript
// Fix CurrencyInput component
interface CurrencyInputProps {
  value: number | string;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

### Toast Notification Fixes
```typescript
// Use correct toast import and methods
import toast from 'react-hot-toast';

// Correct usage
toast.success('Message');
toast.error('Error message');
toast.warning('Warning message'); // Fix: use warning, not info
```

## 6. Email System Strategy

### Nodemailer Type Fixes
```typescript
// Fix nodemailer configuration types
import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
} as nodemailer.TransportOptions);
```

### Return Type Fixes
```typescript
// Ensure functions return correct types
async function sendEmail(): Promise<boolean> {
  try {
    const result = await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
}
```

## 7. Payroll System Strategy

### Duplicate Export Resolution
```typescript
// src/lib/payroll/legal-tables.ts
// Remove duplicate export statements
// Keep only one export declaration per variable

// REMOVE duplicate exports at end of file
// KEEP only the const declarations
export const INSS_TABLE_2025 = [...];
export const IRRF_TABLE_2025 = [...];
export const FGTS_TABLE = [...];
```

## Implementation Order

### Phase 1: Critical Infrastructure (Week 1)
1. Fix core authentication files (auth.ts, authorization.ts, user-verification.ts)
2. Complete Supabase type definitions
3. Fix JWT token types
4. Test authentication flow

### Phase 2: API Routes (Week 2)
1. Update auth API routes
2. Update user management routes
3. Update reimbursement routes
4. Test API endpoints

### Phase 3: Components & UI (Week 3)
1. Fix component Prisma dependencies
2. Resolve translation duplicates
3. Fix React component types
4. Test user interface

### Phase 4: Polish & Optimization (Week 4)
1. Fix email system types
2. Resolve payroll system issues
3. Fix remaining import issues
4. Comprehensive testing

## Testing Strategy

### After Each Phase
1. Run `npx tsc --noEmit` to check for remaining errors
2. Test affected functionality manually
3. Run any existing unit tests
4. Verify no regressions introduced

### Validation Checklist
- [ ] Authentication works (login/register)
- [ ] User management functions
- [ ] Reimbursement system operates
- [ ] Translation switching works
- [ ] Email notifications send
- [ ] No TypeScript errors remain

## Risk Mitigation

### Backup Strategy
- Commit changes after each major fix
- Test in development environment first
- Keep rollback plan ready

### Error Monitoring
- Monitor console for runtime errors
- Check network requests for API issues
- Validate database operations

### User Impact Minimization
- Fix critical authentication issues first
- Maintain backward compatibility where possible
- Provide clear error messages during transition
