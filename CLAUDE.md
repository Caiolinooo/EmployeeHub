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

This architecture supports rapid development while maintaining security and scalability for enterprise use.