# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
**Painel ABZ** is a comprehensive enterprise management platform built with Next.js 15, TypeScript, and Supabase. The system serves as a centralized dashboard for ABZ Group employees, featuring modules for reimbursements, performance evaluations, user management, corporate academy, internal social networking, and calendar systems.

## Technology Stack

### Core Technologies
- **Frontend**: Next.js 15 with App Router, React 19, TypeScript 5
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth + custom JWT-based system
- **Styling**: Tailwind CSS with custom color palette

### Key Dependencies
- **UI**: Radix UI, Framer Motion, React Icons, Heroicons
- **Forms**: React Hook Form, Zod validation
- **PDF**: jsPDF, PDFKit, React PDF
- **Charts**: Chart.js, React Chart.js 2
- **Email**: Nodemailer, SendGrid
- **File Processing**: XLSX, PapaParse, Formidable
- **Authentication**: bcryptjs, jsonwebtoken
- **Notifications**: Web Push API, React Hot Toast

## Development Commands

### Core Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Clean build cache and rebuild
npm run rebuild

# Start production server
npm run start:prod

# Lint code
npm run lint
```

### Database Setup
```bash
# Initial database setup (creates all tables and functions)
npm run db:setup

# Check table structure
npm run db:check

# Create SQL functions
npm run db:create-sql-functions

# Add access history to all users
npm run db:add-access-history

# Fix evaluation tables
npm run db:fix-avaliacoes
```

### Email Testing
```bash
# Test email configuration
npm run test:email

# Test email directly
npm run test:email:direct
```

### Google Drive Setup
```bash
# Setup Google Drive integration
npm run setup:drive
npm run setup:drive:api
```

## Architecture

### Authentication System
- **Hybrid Authentication**: Combines Supabase Auth with custom JWT tokens
- **Role-Based Access Control (RBAC)**: Admin, Manager, User roles
- **Authorization Workflow**: Users require approval before accessing the system
- **Banned User System**: Complete user management with ban history

### Database Schema
- **users_unified**: Central user table with permissions, access history
- **app_secrets**: Secure storage for API keys and credentials
- **Module-specific tables**: reimbursements, evaluations, academy, news, calendar
- **RLS Policies**: Row Level Security for data access control

### API Structure
```
/api/auth/          # Authentication endpoints
/api/admin/         # Administrative functions
/api/users/         # User management
/api/reimbursement/ # Expense reimbursement
/api/academy/       # Corporate academy
/api/calendar/      # Calendar system
/api/social/        # Internal social network
/api/notifications/ # Push notifications
/api/avaliacao-desempenho/ # Performance evaluation module
/api/avaliacao-workflow/ # Evaluation workflow management
```

### Key Libraries and Utilities

#### Authentication (`src/lib/auth.ts`, `src/lib/supabase.ts`)
- Custom JWT implementation with bcrypt password hashing
- Supabase client singleton pattern
- Module and feature-level permission checking
- Access history tracking

#### Email Services (`src/lib/email*.ts`)
- Multiple providers: Gmail, Exchange, SendGrid
- Template-based email system
- Verification and notification workflows

#### File Management
- Google Drive API integration for profile photos
- Formidable for file uploads
- PDF generation with jsPDF and PDFKit

#### PDF Generation (`src/lib/pdf-generator.ts`, `src/lib/advanced-pdf-generator.ts`)
- Multiple PDF engines for different use cases
- Certificate generation for academy
- Receipt generation for reimbursements

### Component Architecture
- **Context Providers**: AuthContext, I18nContext, SiteConfigContext
- **Reusable Components**: Located in `src/components/`
- **Layout System**: Dynamic sidebar, responsive design
- **Internationalization**: PT-BR, EN, ES support

## Key Features

### Modules
1. **Dashboard**: Real-time metrics, customizable cards
2. **Reimbursements**: Complete expense management with PDF receipts
3. **Performance Evaluations**: 360-degree evaluation system
4. **Corporate Academy**: Courses, certificates, progress tracking
5. **User Management**: Import/export, role management, access control
6. **Calendar**: Corporate events with ICS integration
7. **Social Network**: Posts, likes, comments, internal feed
8. **Document Repository**: Secure file management with permissions
9. **Notifications**: Web push notifications with service worker

### Security Features
- JWT-based authentication with refresh tokens
- Row Level Security (RLS) on all tables
- Encrypted credential storage
- CORS and security headers
- Input validation and sanitization

## Environment Configuration

### Required Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Authentication
JWT_SECRET=your_jwt_secret

# Email (choose one)
EMAIL_SERVER=smtp://user:pass@server:port
EMAIL_FROM=company@domain.com

# Google Drive (optional)
GOOGLE_API_KEY=your_google_api_key
```

### Database Connection
The system uses PostgreSQL via Supabase with automatic connection handling and retry logic.

## Development Guidelines

### Code Organization
- API routes in `src/app/api/`
- Shared libraries in `src/lib/`
- Components in `src/components/`
- Page components in `src/app/[module]/page.tsx`
- Types in `src/types/`

### Database Operations
- Use Supabase client for all database operations
- Implement proper error handling with try-catch
- Follow RLS policies for data access
- Use transactions for multi-table operations

### Authentication Flow
1. User registers or is imported
2. Admin approves access
3. User receives verification code
4. Login creates JWT token
5. Token refreshed automatically
6. Access logged for audit

### File Uploads
- Use Formidable for multipart data
- Validate file types and sizes
- Store sensitive files in Google Drive
- Implement proper permissions

### Error Handling
- Consistent error responses from API routes
- Client-side error boundaries
- Logging for debugging
- User-friendly error messages

## Testing and Debugging

### Debug Routes
- `/api/debug/codes` - Test verification codes
- `/api/debug/test-verification` - Test verification flow
- `/api/test-email` - Test email configuration

### Monitoring
- Access history tracking
- Performance monitoring
- Error logging
- User activity logs

## Common Tasks

### Adding New Module
1. Create table in Supabase with RLS
2. Add API routes in `/api/[module]/`
3. Create pages in `/app/[module]/`
4. Add permissions to user roles
5. Update navigation menu

### User Import
1. Prepare Excel/CSV with user data
2. Use admin import interface
3. Users created with `pending` status
4. Approve via admin panel
5. Send verification codes

### Email Configuration
1. Set up SMTP credentials in environment
2. Test with `npm run test:email`
3. Configure templates in `src/lib/emailTemplates.ts`
4. Update sender information

## Evaluation Module Implementation (2025-11-11)

### Overview
The performance evaluation module has been completely implemented and tested. It provides a comprehensive 360-degree evaluation system with proper database schema, API endpoints, and user interface.

### Key Components
- **Database Schema**: `avaliacoes_desempenho` table with proper foreign keys to `users_unified`
- **Views**: `vw_avaliacoes_desempenho` with JOINs for user information
- **API Endpoints**: Complete CRUD operations for evaluations
- **User Interface**: Full evaluation management interface
- **Notifications**: Automated notifications for evaluation events
- **Workflow**: Complete evaluation lifecycle management

### Database Schema
```sql
-- Main evaluation table
avaliacoes_desempenho (
  id UUID PRIMARY KEY,
  funcionario_id UUID REFERENCES users_unified(id),
  avaliador_id UUID REFERENCES users_unified(id),
  periodo TEXT,
  periodo_id UUID REFERENCES periodos_avaliacao(id),
  data_inicio DATE,
  data_fim DATE,
  status TEXT,
  pontuacao_total DOUBLE PRECISION,
  observacoes TEXT,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  comentario_avaliador TEXT,
  status_aprovacao TEXT,
  data_autoavaliacao TIMESTAMP,
  data_aprovacao TIMESTAMP,
  aprovado_por UUID,
  dados_colaborador JSONB,
  dados_gerente JSONB
);

-- Periods table
periodos_avaliacao (
  id UUID PRIMARY KEY,
  nome TEXT,
  descricao TEXT,
  ano INTEGER,
  data_inicio DATE,
  data_fim DATE,
  status TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Evaluation criteria table
criterios (
  id UUID PRIMARY KEY,
  nome TEXT,
  descricao TEXT,
  peso INTEGER,
  categoria TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Evaluation scores table
pontuacoes_avaliacao (
  id UUID PRIMARY KEY,
  avaliacao_id UUID REFERENCES avaliacoes_desempenho(id),
  criterio_id UUID REFERENCES criterios(id),
  pontuacao INTEGER,
  comentario TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### API Endpoints
- `GET /api/avaliacao-desempenho/avaliacoes` - List evaluations
- `POST /api/avaliacao-desempenho/avaliacoes` - Create evaluation
- `GET /api/avaliacao-desempenho/avaliacoes/[id]` - Get evaluation by ID
- `PUT /api/avaliacao-desempenho/avaliacoes/[id]` - Update evaluation
- `DELETE /api/avaliacao-desempenho/avaliacoes/[id]` - Delete evaluation
- `GET /api/avaliacao-desempenho/criterios` - List criteria
- `POST /api/avaliacao-desempenho/criterios` - Create criteria
- `GET /api/avaliacao-desempenho/funcionarios` - List employees
- `POST /api/avaliacao-desempenho/funcionarios` - Create employee
- `GET /api/avaliacao-workflow/ciclos` - List evaluation cycles
- `POST /api/avaliacao/create` - Legacy create evaluation

### Testing Scripts
The following scripts are available for testing and maintenance:
- `scripts/test-evaluation-end-to-end-complete.js` - Comprehensive testing
- `scripts/test-evaluation-creation-complete.js` - Creation testing
- `scripts/test-avaliacao-notifications.js` - Notification testing
- `scripts/run-fix-direct.js` - Apply database fixes
- `scripts/verify-final.js` - Verify implementation

### Known Issues and Resolutions
1. **Foreign Key Relationships**: Resolved by updating all relationships to use `users_unified` table
2. **View JOINs**: Fixed by implementing proper JOINs in `vw_avaliacoes_desempenho`
3. **API Compatibility**: Resolved by aligning database schema with API expectations
4. **Notifications**: Implemented comprehensive notification system for evaluation events
5. **Frontend Integration**: Updated all frontend components to use correct table references

### Maintenance
- Use `scripts/run-fix-direct.js` to apply database fixes if needed
- Use `scripts/verify-final.js` to verify system status
- Use testing scripts to validate functionality after changes
- Monitor notification delivery and user feedback

## Automatic Evaluation Creation System (2025-11-12)

### Overview
The system now supports fully automatic evaluation creation based on evaluation period dates. When a period's `data_inicio` arrives, the cron job automatically creates evaluations for all eligible users.

### Key Components

#### 1. Database Tables
- **avaliacao_usuarios_elegiveis**: Stores users eligible for evaluations (global or per-period)
- **avaliacao_colaborador_gerente**: Maps employees to their managers (global or per-period)
- **avaliacao_cron_log**: Logs all automatic evaluation creation executions
- **periodos_avaliacao**: Extended with automation fields:
  - `criacao_automatica_executada`: Boolean flag tracking if auto-creation ran
  - `data_criacao_automatica`: Timestamp of execution
  - `total_avaliacoes_criadas`: Counter of created evaluations
  - `data_limite_autoavaliacao`: Deadline for employee self-evaluation
  - `data_limite_aprovacao`: Deadline for manager approval

#### 2. Database Views
- **vw_usuarios_elegiveis_completo**: Complete view with user and manager information
- **vw_mapeamento_gerentes_completo**: Complete view of employee-manager mappings
- **vw_cron_execucoes_resumo**: Summary of cron executions with statistics

#### 3. Database Functions
- **get_manager_for_user(colaborador_id, periodo_id)**: Returns manager for a user (period-specific or global)
- **is_user_eligible_for_period(usuario_id, periodo_id)**: Checks if user is eligible
- **get_eligible_users_for_period(periodo_id)**: Returns all eligible users with their managers

#### 4. API Endpoints

**Manager Mappings**
- `GET /api/avaliacao/mapeamento-gerentes` - List mappings with filters
- `POST /api/avaliacao/mapeamento-gerentes` - Create mapping or batch import
- `PUT /api/avaliacao/mapeamento-gerentes/[id]` - Update mapping
- `DELETE /api/avaliacao/mapeamento-gerentes/[id]` - Delete mapping

**Eligible Users**
- `GET /api/avaliacao/usuarios-elegiveis` - List eligible users with filters
- `POST /api/avaliacao/usuarios-elegiveis` - Add user(s) or batch import

**Cron Job**
- `POST /api/avaliacao/cron/criar-avaliacoes` - Execute automatic evaluation creation

#### 5. Cron Configuration
The system supports two cron implementations:

**Vercel Cron** (configured in `vercel.json`):
```json
{
  "crons": [{
    "path": "/api/avaliacao/cron/criar-avaliacoes",
    "schedule": "0 9 * * *"
  }]
}
```

**Supabase pg_cron** (SQL function):
- Daily execution at 9 AM BRT
- PostgreSQL function: `criar_avaliacoes_automaticamente()`
- Includes notification function: `enviar_notificacao_avaliacao()`

#### 6. Workflow

**Setup Phase** (Admin):
1. Configure eligible users (global or per-period)
2. Configure employee-manager mappings (global or per-period)
3. Create evaluation period with:
   - `data_inicio`: 14 days before evaluation deadline
   - `data_fim`: End of evaluation period
   - `data_limite_autoavaliacao`: Deadline for employee responses
   - `data_limite_aprovacao`: Deadline for manager approval

**Automatic Creation** (Cron):
1. Cron runs daily at 9 AM BRT
2. Finds periods where `data_inicio = TODAY` and `criacao_automatica_executada = FALSE`
3. For each eligible period:
   - Queries eligible users (period-specific or global)
   - For each user:
     - Finds their manager
     - Creates evaluation record with status `pendente_autoavaliacao`
     - Sends notifications to employee and manager
   - Marks period as executed
   - Logs execution details to `avaliacao_cron_log`

**Employee Phase** (7-10 days):
1. Employee receives notification
2. Completes self-evaluation (Questions 11-14)
3. Submits evaluation
4. Status changes to `aguardando_aprovacao`
5. Manager receives notification

**Manager Phase** (3-5 days):
1. Manager receives notification
2. Reviews employee's self-evaluation
3. Completes manager evaluation (Questions 1-10, 15-17)
4. Approves or returns for revision
5. Status changes to `aprovado`
6. Employee receives final notification

#### 7. Testing and Verification

**Migration**:
```bash
node scripts/execute-evaluation-automation-migration.js
# Or manually via Supabase Dashboard SQL Editor:
# scripts/migrations/001-create-evaluation-automation-tables.sql
```

**Verification**:
```bash
node scripts/execute-migration-via-supabase-api.js
```

**End-to-End Test**:
```bash
node scripts/test-automatic-evaluation-creation.js
```

**Manual Trigger** (for testing):
```bash
curl -X POST http://localhost:3000/api/avaliacao/cron/criar-avaliacoes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### 8. Monitoring

**Check Cron Logs**:
```sql
SELECT * FROM vw_cron_execucoes_resumo ORDER BY executado_em DESC;
```

**Check Created Evaluations**:
```sql
SELECT COUNT(*), periodo_id, status
FROM avaliacoes_desempenho
WHERE created_at >= CURRENT_DATE
GROUP BY periodo_id, status;
```

**View Execution Details**:
```sql
SELECT * FROM avaliacao_cron_log WHERE status = 'error';
```

#### 9. Configuration Options

**Global vs. Period-Specific**:
- **Global** (`periodo_id = NULL`): Applies to all future periods
- **Period-Specific**: Overrides global settings for a specific period

**Batch Operations**:
- Import manager mappings from CSV/Excel
- Import eligible users from CSV/Excel
- Bulk update via API endpoints

#### 10. Important Notes

**Supabase Cache**:
- After running migrations, Supabase PostgREST may need 1-2 minutes to refresh its schema cache
- If you see "column not found" errors, wait briefly or restart the PostgREST server
- Alternatively, run `NOTIFY pgrst, 'reload schema'` in Supabase SQL Editor

**Environment Variables**:
- `CRON_SECRET`: Required for Vercel Cron authentication
- `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`: Required for cron job execution

**RLS Policies**:
- All automation tables have RLS enabled
- Only admins can view/modify eligible users and manager mappings
- Cron job uses service role key to bypass RLS

This architecture supports rapid development while maintaining security and scalability for enterprise use.
- Ultima movimentação no projeto 12-11-25 17hrs