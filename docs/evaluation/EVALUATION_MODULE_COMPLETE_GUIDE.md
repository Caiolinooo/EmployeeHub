# Evaluation Module Complete Implementation Guide

## Date: 2025-11-11

This document provides a comprehensive guide to the evaluation module implementation, including architecture, database schema, API endpoints, user interface, and maintenance procedures.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [User Interface](#user-interface)
6. [Notification System](#notification-system)
7. [Testing and Validation](#testing-and-validation)
8. [Maintenance and Troubleshooting](#maintenance-and-troubleshooting)
9. [Known Issues and Resolutions](#known-issues-and-resolutions)
10. [Future Enhancements](#future-enhancements)

## Overview

The evaluation module provides a comprehensive 360-degree performance evaluation system for ABZ Group employees. It supports the complete evaluation lifecycle from creation to completion, with proper user management, notifications, and reporting capabilities.

### Key Features
- **360-Degree Evaluations**: Employees can be evaluated by managers, peers, and through self-assessment
- **Workflow Management**: Complete evaluation lifecycle with status tracking
- **Automated Notifications**: Real-time notifications for all evaluation events
- **User Management**: Integration with the unified user system
- **Reporting**: Comprehensive evaluation metrics and reports
- **Period Management**: Flexible evaluation periods with automatic scheduling
- **Criteria Management**: Customizable evaluation criteria with weighted scoring

### System Requirements
- Next.js 15 with TypeScript
- Supabase (PostgreSQL) database
- Node.js 18+ for development
- Modern web browser with JavaScript enabled

## Architecture

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Next.js)     │◄──►│   (Supabase)    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Evaluation  │ │    │ │   API       │ │    │ │   Tables    │ │
│ │ Dashboard   │ │    │ │ Endpoints   │ │    │ │ & Views     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Evaluation  │ │    │ │ Business    │ │    │ │   RLS       │ │
│ │ Forms       │ │    │ │ Logic       │ │    │ │ Policies    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Reports &   │ │    │ │ Validation  │ │    │ │   Triggers  │ │
│ │ Metrics     │ │    │ │ & Security  │ │    │ │ & Functions │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────┐
                    │ Notifications   │
                    │ System          │
                    │ (Web Push)      │
                    └─────────────────┘
```

### Data Flow
1. **User Authentication**: Users authenticate through the main system
2. **Authorization**: Role-based access control determines available actions
3. **Evaluation Creation**: Managers create evaluations for team members
4. **Notification System**: Automated notifications sent to involved parties
5. **Evaluation Completion**: Users complete evaluations with criteria scoring
6. **Status Updates**: Evaluation status tracked through workflow
7. **Reporting**: Evaluation data aggregated for metrics and reports

## Database Schema

### Core Tables

#### avaliacoes_desempenho (Performance Evaluations)
Main table storing all evaluation records.

```sql
CREATE TABLE avaliacoes_desempenho (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID REFERENCES users_unified(id) NOT NULL,
    avaliador_id UUID REFERENCES users_unified(id) NOT NULL,
    periodo TEXT NOT NULL,
    periodo_id UUID REFERENCES periodos_avaliacao(id),
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    pontuacao_total DOUBLE PRECISION DEFAULT 0,
    observacoes TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    comentario_avaliador TEXT,
    status_aprovacao TEXT DEFAULT 'pendente',
    data_autoavaliacao TIMESTAMP WITH TIME ZONE,
    data_aprovacao TIMESTAMP WITH TIME ZONE,
    aprovado_por UUID REFERENCES users_unified(id),
    dados_colaborador JSONB,
    dados_gerente JSONB
);
```

#### periodos_avaliacao (Evaluation Periods)
Manages evaluation periods and cycles.

```sql
CREATE TABLE periodos_avaliacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    ano INTEGER NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    data_limite_autoavaliacao DATE,
    data_limite_aprovacao DATE,
    status TEXT DEFAULT 'ativo',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### criterios (Evaluation Criteria)
Defines evaluation criteria and scoring weights.

```sql
CREATE TABLE criterios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    peso INTEGER DEFAULT 1,
    categoria TEXT DEFAULT 'geral',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### pontuacoes_avaliacao (Evaluation Scores)
Stores individual scores for each evaluation criterion.

```sql
CREATE TABLE pontuacoes_avaliacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avaliacao_id UUID REFERENCES avaliacoes_desempenho(id) NOT NULL,
    criterio_id UUID REFERENCES criterios(id) NOT NULL,
    pontuacao INTEGER NOT NULL CHECK (pontuacao >= 0 AND pontuacao <= 10),
    comentario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(avaliacao_id, criterio_id)
);
```

### Views

#### vw_avaliacoes_desempenho (Performance Evaluations View)
Main view for accessing evaluation data with user information.

```sql
CREATE OR REPLACE VIEW vw_avaliacoes_desempenho AS
SELECT 
    ad.id,
    ad.funcionario_id,
    ad.avaliador_id,
    ad.periodo,
    ad.periodo_id,
    ad.data_inicio,
    ad.data_fim,
    ad.status,
    ad.pontuacao_total,
    ad.observacoes,
    ad.created_at,
    ad.updated_at,
    ad.deleted_at,
    ad.comentario_avaliador,
    ad.status_aprovacao,
    ad.data_autoavaliacao,
    ad.data_aprovacao,
    ad.aprovado_por,
    ad.dados_colaborador,
    ad.dados_gerente,
    -- User information from users_unified
    uu_func.first_name || ' ' || uu_func.last_name AS funcionario_nome,
    uu_func.position AS funcionario_cargo,
    uu_func.department AS funcionario_departamento,
    uu_aval.first_name || ' ' || uu_aval.last_name AS avaliador_nome,
    uu_aval.position AS avaliador_cargo,
    -- Period information
    pa.nome AS periodo_nome,
    pa.ano AS periodo_ano,
    pa.descricao AS periodo_descricao
FROM 
    avaliacoes_desempenho ad
    LEFT JOIN users_unified uu_func ON ad.funcionario_id = uu_func.id
    LEFT JOIN users_unified uu_aval ON ad.avaliador_id = uu_aval.id
    LEFT JOIN periodos_avaliacao pa ON ad.periodo_id = pa.id
WHERE 
    ad.deleted_at IS NULL;
```

### Indexes
```sql
-- Performance indexes
CREATE INDEX idx_avaliacoes_funcionario_id ON avaliacoes_desempenho(funcionario_id);
CREATE INDEX idx_avaliacoes_avaliador_id ON avaliacoes_desempenho(avaliador_id);
CREATE INDEX idx_avaliacoes_periodo_id ON avaliacoes_desempenho(periodo_id);
CREATE INDEX idx_avaliacoes_status ON avaliacoes_desempenho(status);
CREATE INDEX idx_avaliacoes_created_at ON avaliacoes_desempenho(created_at);

-- Periods indexes
CREATE INDEX idx_periodos_avaliacao_ano ON periodos_avaliacao(ano);
CREATE INDEX idx_periodos_avaliacao_status ON periodos_avaliacao(status);
CREATE INDEX idx_periodos_avaliacao_ativo ON periodos_avaliacao(ativo);

-- Scores indexes
CREATE INDEX idx_pontuacoes_avaliacao_id ON pontuacoes_avaliacao(avaliacao_id);
CREATE INDEX idx_pontuacoes_criterio_id ON pontuacoes_avaliacao(criterio_id);
```

### Triggers
```sql
-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_avaliacoes_desempenho_updated_at 
    BEFORE UPDATE ON avaliacoes_desempenho 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_periodos_avaliacao_updated_at 
    BEFORE UPDATE ON periodos_avaliacao 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_criterios_updated_at 
    BEFORE UPDATE ON criterios 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pontuacoes_avaliacao_updated_at 
    BEFORE UPDATE ON pontuacoes_avaliacao 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate total score
CREATE OR REPLACE FUNCTION calcular_pontuacao_total()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Calculate total score for the evaluation
        UPDATE avaliacoes_desempenho
        SET pontuacao_total = (
            SELECT COALESCE(SUM(p.pontuacao * c.peso), 0) / COALESCE(SUM(c.peso), 1)
            FROM pontuacoes_avaliacao p
            JOIN criterios c ON p.criterio_id = c.id
            WHERE p.avaliacao_id = NEW.avaliacao_id
        )
        WHERE id = NEW.avaliacao_id;
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_calcular_pontuacao_total
    AFTER INSERT OR UPDATE ON pontuacoes_avaliacao
    FOR EACH ROW EXECUTE FUNCTION calcular_pontuacao_total();
```

## API Endpoints

### Evaluation Management

#### GET /api/avaliacao-desempenho/avaliacoes
List all evaluations with filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by status (pendente, em_andamento, concluida, cancelada)
- `funcionario_id` (optional): Filter by employee ID
- `avaliador_id` (optional): Filter by evaluator ID
- `periodo_id` (optional): Filter by period ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "funcionario_id": "uuid",
      "avaliador_id": "uuid",
      "periodo": "text",
      "periodo_id": "uuid",
      "data_inicio": "date",
      "data_fim": "date",
      "status": "pendente",
      "pontuacao_total": 8.5,
      "observacoes": "text",
      "funcionario_nome": "John Doe",
      "funcionario_cargo": "Developer",
      "funcionario_departamento": "IT",
      "avaliador_nome": "Jane Smith",
      "avaliador_cargo": "Manager",
      "periodo_nome": "Annual 2025",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### POST /api/avaliacao-desempenho/avaliacoes
Create a new evaluation.

**Request Body:**
```json
{
  "funcionario_id": "uuid",
  "avaliador_id": "uuid",
  "periodo": "text",
  "periodo_id": "uuid",
  "data_inicio": "date",
  "data_fim": "date",
  "observacoes": "text"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "funcionario_id": "uuid",
    "avaliador_id": "uuid",
    "periodo": "text",
    "periodo_id": "uuid",
    "data_inicio": "date",
    "data_fim": "date",
    "status": "pendente",
    "pontuacao_total": 0,
    "observacoes": "text",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "message": "Evaluation created successfully"
}
```

#### GET /api/avaliacao-desempenho/avaliacoes/[id]
Get evaluation by ID with detailed information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "funcionario_id": "uuid",
    "avaliador_id": "uuid",
    "periodo": "text",
    "periodo_id": "uuid",
    "data_inicio": "date",
    "data_fim": "date",
    "status": "pendente",
    "pontuacao_total": 8.5,
    "observacoes": "text",
    "funcionario_nome": "John Doe",
    "funcionario_cargo": "Developer",
    "funcionario_departamento": "IT",
    "avaliador_nome": "Jane Smith",
    "avaliador_cargo": "Manager",
    "periodo_nome": "Annual 2025",
    "criterios": [
      {
        "id": "uuid",
        "nome": "Technical Skills",
        "descricao": "Technical proficiency",
        "peso": 2,
        "pontuacao": 8,
        "comentario": "Good technical knowledge"
      }
    ],
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

#### PUT /api/avaliacao-desempenho/avaliacoes/[id]
Update an evaluation.

**Request Body:**
```json
{
  "status": "em_andamento",
  "observacoes": "Updated observations",
  "criterios": [
    {
      "criterio_id": "uuid",
      "pontuacao": 8,
      "comentario": "Good performance"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "em_andamento",
    "pontuacao_total": 8.0,
    "observacoes": "Updated observations",
    "updated_at": "timestamp"
  },
  "message": "Evaluation updated successfully"
}
```

#### DELETE /api/avaliacao-desempenho/avaliacoes/[id]
Delete an evaluation (soft delete).

**Response:**
```json
{
  "success": true,
  "message": "Evaluation deleted successfully"
}
```

### Criteria Management

#### GET /api/avaliacao-desempenho/criterios
List all evaluation criteria.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nome": "Technical Skills",
      "descricao": "Technical proficiency",
      "peso": 2,
      "categoria": "technical",
      "ativo": true,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

#### POST /api/avaliacao-desempenho/criterios
Create a new evaluation criterion.

**Request Body:**
```json
{
  "nome": "Communication Skills",
  "descricao": "Verbal and written communication",
  "peso": 1,
  "categoria": "soft"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nome": "Communication Skills",
    "descricao": "Verbal and written communication",
    "peso": 1,
    "categoria": "soft",
    "ativo": true,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "message": "Criterion created successfully"
}
```

### Employee Management

#### GET /api/avaliacao-desempenho/funcionarios
List all employees available for evaluation.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@company.com",
      "position": "Developer",
      "department": "IT",
      "active": true
    }
  ]
}
```

### Workflow Management

#### GET /api/avaliacao-workflow/ciclos
List evaluation cycles/periods.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nome": "Annual 2025",
      "descricao": "Annual performance evaluation 2025",
      "ano": 2025,
      "data_inicio": "2025-01-01",
      "data_fim": "2025-12-31",
      "status": "ativo",
      "ativo": true,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

#### GET /api/avaliacao-workflow/relatorios
Generate evaluation reports and metrics.

**Query Parameters:**
- `periodo_id` (optional): Filter by period
- `departamento` (optional): Filter by department
- `tipo` (required): Report type (resumo, detalhado, comparativo)

**Response:**
```json
{
  "success": true,
  "data": {
    "total_avaliacoes": 150,
    "avaliacoes_concluidas": 120,
    "avaliacoes_pendentes": 30,
    "pontuacao_media": 8.2,
    "por_departamento": [
      {
        "departamento": "IT",
        "total_avaliacoes": 50,
        "pontuacao_media": 8.5
      }
    ],
    "por_periodo": [
      {
        "periodo": "Annual 2025",
        "total_avaliacoes": 150,
        "pontuacao_media": 8.2
      }
    ]
  }
}
```

## User Interface

### Evaluation Dashboard
**Location**: `/avaliacao`

The main dashboard provides an overview of all evaluations with filtering, sorting, and search capabilities.

**Features:**
- List of evaluations with status indicators
- Filter by status, employee, evaluator, and period
- Search functionality
- Pagination
- Quick actions (create, view, edit)
- Export to CSV/Excel

**Components:**
- `EvaluationDashboard`: Main dashboard component
- `EvaluationList`: List of evaluations
- `EvaluationFilters`: Filter controls
- `EvaluationSearch`: Search functionality
- `EvaluationActions`: Action buttons

### Evaluation Form
**Location**: `/avaliacao/nova` (create) or `/avaliacao/[id]/editar` (edit)

Comprehensive form for creating and editing evaluations.

**Features:**
- Employee selection with search
- Evaluator assignment
- Period selection
- Date range picker
- Criteria scoring with weighted calculation
- Comments and observations
- Real-time score calculation
- Validation and error handling

**Components:**
- `EvaluationForm`: Main form component
- `EmployeeSelector`: Employee selection
- `PeriodSelector`: Period selection
- `CriteriaScoring`: Criteria scoring interface
- `ScoreCalculator`: Real-time score calculation
- `FormValidation`: Validation handling

### Evaluation Details
**Location**: `/avaliacao/[id]`

Detailed view of a single evaluation with all information and actions.

**Features:**
- Complete evaluation information
- Employee and evaluator details
- Criteria scores and comments
- Status tracking
- Approval workflow
- Print/export functionality
- History tracking

**Components:**
- `EvaluationDetails`: Main details component
- `EvaluationStatus`: Status display
- `EvaluationScores`: Scores display
- `EvaluationApprovals`: Approval workflow
- `EvaluationHistory`: History tracking
- `EvaluationExport`: Export functionality

### Reports and Metrics
**Location**: `/avaliacao/relatorios`

Comprehensive reporting interface with charts and metrics.

**Features:**
- Summary reports
- Detailed reports
- Comparative reports
- Chart visualization
- Export to PDF/Excel
- Filter by various parameters

**Components:**
- `ReportsDashboard`: Reports dashboard
- `ReportFilters`: Filter controls
- `ReportCharts`: Chart visualization
- `ReportExport`: Export functionality
- `ReportMetrics`: Metrics display

## Notification System

### Overview
The evaluation module includes a comprehensive notification system that alerts users about important evaluation events.

### Notification Types

#### Evaluation Created
Sent to both the employee and evaluator when a new evaluation is created.

**Trigger**: New evaluation created
**Recipients**: Employee and evaluator
**Content**: Evaluation details, deadlines, and action items

#### Evaluation Status Updated
Sent when evaluation status changes.

**Trigger**: Status change (pendente → em_andamento → concluida)
**Recipients**: Employee and evaluator
**Content**: New status, next steps, deadlines

#### Evaluation Completed
Sent when evaluation is completed and ready for approval.

**Trigger**: Evaluation marked as completed
**Recipients**: Employee, evaluator, and manager
**Content**: Completion summary, score, next steps

#### Evaluation Approved
Sent when evaluation is approved by manager.

**Trigger**: Evaluation approved
**Recipients**: Employee and evaluator
**Content**: Approval confirmation, final score

#### Evaluation Reminders
Automated reminders for pending evaluations.

**Trigger**: Scheduled (daily/weekly)
**Recipients**: Users with pending evaluations
**Content**: Reminder, deadline information, action items

### Notification Delivery

#### In-App Notifications
Real-time notifications displayed within the application.

**Features:**
- Real-time updates
- Notification center
- Read/unread status
- Notification history
- Action buttons

#### Email Notifications
Email notifications for important events.

**Features:**
- HTML email templates
- Personalized content
- Attachment support
- Bounce handling

#### Push Notifications
Browser push notifications for immediate alerts.

**Features:**
- Desktop notifications
- Mobile support
- Permission management
- Notification scheduling

### Notification Configuration

**File**: `src/lib/services/notificacoes-avaliacao.ts`

```typescript
interface NotificationConfig {
  enabled: boolean;
  types: NotificationType[];
  recipients: NotificationRecipient[];
  delivery: NotificationDelivery[];
  templates: NotificationTemplate[];
}

interface NotificationType {
  id: string;
  name: string;
  description: string;
  trigger: NotificationTrigger;
}

interface NotificationRecipient {
  userId: string;
  type: 'employee' | 'evaluator' | 'manager' | 'admin';
}

interface NotificationDelivery {
  method: 'in-app' | 'email' | 'push';
  enabled: boolean;
  template: string;
}
```

## Testing and Validation

### Test Scripts

#### End-to-End Testing
**Script**: `scripts/test-evaluation-end-to-end-complete.js`

Comprehensive testing of the entire evaluation workflow.

**Tests:**
- Database view functionality
- API endpoints
- Notification system
- Frontend-backend integration
- Complete evaluation lifecycle

**Usage:**
```bash
node scripts/test-evaluation-end-to-end-complete.js
```

#### Creation Testing
**Script**: `scripts/test-evaluation-creation-complete.js`

Testing evaluation creation and management.

**Tests:**
- Evaluation creation
- Criteria scoring
- Status updates
- Data validation

**Usage:**
```bash
node scripts/test-evaluation-creation-complete.js
```

#### Notification Testing
**Script**: `scripts/test-avaliacao-notifications.js`

Testing notification system functionality.

**Tests:**
- Notification creation
- Notification delivery
- Notification content
- Notification history

**Usage:**
```bash
node scripts/test-avaliacao-notifications.js
```

### Database Verification

#### Schema Verification
**Script**: `scripts/verify-final.js`

Verify database schema and relationships.

**Checks:**
- Table existence
- Foreign key relationships
- View functionality
- Data integrity

**Usage:**
```bash
node scripts/verify-final.js
```

#### API Testing
Manual API testing using tools like Postman or curl.

**Example Requests:**
```bash
# List evaluations
curl -X GET "http://localhost:3000/api/avaliacao-desempenho/avaliacoes" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create evaluation
curl -X POST "http://localhost:3000/api/avaliacao-desempenho/avaliacoes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "funcionario_id": "employee-uuid",
    "avaliador_id": "evaluator-uuid",
    "periodo": "Annual 2025",
    "data_inicio": "2025-01-01",
    "data_fim": "2025-12-31",
    "observacoes": "Annual performance evaluation"
  }'
```

## Maintenance and Troubleshooting

### Database Maintenance

#### Schema Updates
When updating the database schema, use the provided scripts:

```bash
# Apply database fixes
node scripts/run-fix-direct.js

# Verify schema integrity
node scripts/verify-final.js
```

#### Data Cleanup
Regular cleanup of old or temporary data:

```sql
-- Soft delete old evaluations
UPDATE avaliacoes_desempenho 
SET deleted_at = NOW() 
WHERE created_at < NOW() - INTERVAL '2 years' 
AND status = 'concluida';

-- Clean up old notifications
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '1 year';
```

#### Performance Optimization
Monitor and optimize query performance:

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM vw_avaliacoes_desempenho 
WHERE funcionario_id = 'user-uuid';

-- Update statistics
ANALYZE avaliacoes_desempenho;
ANALYZE pontuacoes_avaliacao;
ANALYZE criterios;
```

### Common Issues and Solutions

#### Foreign Key Errors
**Issue**: Foreign key constraint failures
**Solution**: Ensure all referenced records exist before creating relationships

```sql
-- Check if user exists
SELECT id FROM users_unified WHERE id = 'user-uuid';

-- Check if period exists
SELECT id FROM periodos_avaliacao WHERE id = 'period-uuid';
```

#### View Errors
**Issue**: View not returning expected data
**Solution**: Verify view definition and relationships

```sql
-- Check view definition
SELECT view_definition 
FROM information_schema.views 
WHERE table_name = 'vw_avaliacoes_desempenho';

-- Test view directly
SELECT * FROM vw_avaliacoes_desempenho LIMIT 5;
```

#### Notification Issues
**Issue**: Notifications not being sent
**Solution**: Check notification configuration and delivery

```typescript
// Check notification service
import { sendEvaluationNotification } from '@/lib/services/notificacoes-avaliacao';

// Test notification
await sendEvaluationNotification({
  type: 'evaluation_created',
  evaluationId: 'eval-uuid',
  recipientId: 'user-uuid'
});
```

#### Permission Issues
**Issue**: Users unable to access evaluations
**Solution**: Verify RLS policies and user permissions

```sql
-- Check RLS policies
SELECT policyname, cmd, permissive, roles 
FROM pg_policies 
WHERE tablename = 'avaliacoes_desempenho';

-- Check user permissions
SELECT role, permissions 
FROM users_unified 
WHERE id = 'user-uuid';
```

### Backup and Recovery

#### Database Backup
Regular backups of evaluation data:

```sql
-- Backup evaluation data
CREATE TABLE avaliacoes_desempenho_backup_YYYYMMDD AS 
SELECT * FROM avaliacoes_desempenho 
WHERE deleted_at IS NULL;

-- Backup related data
CREATE TABLE pontuacoes_avaliacao_backup_YYYYMMDD AS 
SELECT p.* FROM pontuacoes_avaliacao p
JOIN avaliacoes_desempenho a ON p.avaliacao_id = a.id
WHERE a.deleted_at IS NULL;
```

#### Data Recovery
Restore data from backups if needed:

```sql
-- Restore evaluation data
INSERT INTO avaliacoes_desempenho 
SELECT * FROM avaliacoes_desempenho_backup_YYYYMMDD
WHERE id NOT IN (SELECT id FROM avaliacoes_desempenho);

-- Restore related data
INSERT INTO pontuacoes_avaliacao 
SELECT p.* FROM pontuacoes_avaliacao_backup_YYYYMMDD p
WHERE p.avaliacao_id IN (SELECT id FROM avaliacoes_desempenho);
```

## Known Issues and Resolutions

### Resolved Issues

#### 1. Foreign Key Relationship Conflicts
**Issue**: Conflicts between `funcionarios` and `users_unified` tables
**Resolution**: Updated all foreign keys to reference `users_unified` table
**Files Modified**: 
- Database schema files
- Frontend query components
- API endpoints

#### 2. View JOIN Problems
**Issue**: Missing JOINs in evaluation views
**Resolution**: Implemented proper JOINs in `vw_avaliacoes_desempenho`
**Files Modified**:
- `scripts/fix-view-joins.sql`
- View definitions

#### 3. API-Database Compatibility
**Issue**: API expectations not matching database schema
**Resolution**: Aligned database schema with API requirements
**Files Modified**:
- Database schema files
- API response handlers
- Documentation

#### 4. Notification System
**Issue**: Incomplete notification system
**Resolution**: Implemented comprehensive notification system
**Files Modified**:
- `src/lib/services/notificacoes-avaliacao.ts`
- Notification templates
- API integration

#### 5. Frontend Integration
**Issue**: Frontend not properly integrated with database
**Resolution**: Updated frontend components to use correct table references
**Files Modified**:
- `src/app/avaliacao/page.tsx`
- `src/app/avaliacao/nova/page.tsx`
- Related components

### Current Status
All major issues have been resolved. The evaluation module is fully functional with:
- ✅ Proper database schema
- ✅ Working API endpoints
- ✅ Functional user interface
- ✅ Complete notification system
- ✅ Comprehensive testing
- ✅ Proper documentation

## Future Enhancements

### Planned Features

#### 1. Advanced Analytics
- Machine learning-based evaluation insights
- Trend analysis and predictions
- Performance improvement recommendations

#### 2. Mobile App
- Native mobile application
- Offline evaluation support
- Push notifications

#### 3. Integration Enhancements
- HR system integration
- Learning management system integration
- Performance management integration

#### 4. User Experience Improvements
- Advanced filtering and search
- Bulk operations
- Customizable evaluation templates

#### 5. Reporting Enhancements
- Advanced report builder
- Real-time dashboards
- Export to multiple formats

### Technical Improvements

#### 1. Performance Optimization
- Query optimization
- Caching implementation
- Database indexing

#### 2. Security Enhancements
- Advanced permission system
- Audit logging
- Data encryption

#### 3. Scalability Improvements
- Horizontal scaling
- Load balancing
- Database sharding

#### 4. Monitoring and Alerting
- Performance monitoring
- Error tracking
- Automated alerts

### Implementation Timeline

#### Phase 1 (Q1 2026)
- Advanced analytics
- Mobile app development
- Performance optimization

#### Phase 2 (Q2 2026)
- Integration enhancements
- Security improvements
- Monitoring implementation

#### Phase 3 (Q3 2026)
- User experience improvements
- Scalability enhancements
- Advanced reporting

#### Phase 4 (Q4 2026)
- Machine learning features
- Advanced integrations
- Enterprise features

## Conclusion

The evaluation module implementation provides a comprehensive, robust, and scalable solution for performance evaluations within the ABZ Group platform. With proper database design, API architecture, user interface, and notification system, the module meets all current requirements and is positioned for future enhancements.

The implementation follows best practices for:
- Database design and normalization
- API development and security
- User interface and experience
- Testing and quality assurance
- Documentation and maintenance

The module is ready for production use and will continue to evolve with the organization's needs.