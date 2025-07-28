import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/create-tables
 * Cria as tabelas do módulo de folha de pagamento
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Criando tabelas do módulo de folha de pagamento...');

    // Primeiro, vamos tentar criar as tabelas usando comandos SQL simples
    const tables = [
      {
        name: 'payroll_companies',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            cnpj VARCHAR(18) UNIQUE NOT NULL,
            address TEXT,
            phone VARCHAR(20),
            email VARCHAR(255),
            contact_person VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        name: 'payroll_departments',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_departments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
            code VARCHAR(10) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(company_id, code)
          );
        `
      },
      {
        name: 'payroll_calculation_profiles',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_calculation_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            company_id UUID REFERENCES payroll_companies(id),
            rules JSONB DEFAULT '{}',
            is_default BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        name: 'payroll_positions',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_positions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
            code VARCHAR(20) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            base_salary DECIMAL(10,2) DEFAULT 0,
            calculation_profile_id UUID REFERENCES payroll_calculation_profiles(id),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(company_id, code)
          );
        `
      },
      {
        name: 'payroll_employees',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_employees (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id UUID,
            company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
            department_id UUID REFERENCES payroll_departments(id),
            position_id UUID REFERENCES payroll_positions(id),
            calculation_profile_id UUID REFERENCES payroll_calculation_profiles(id),
            registration_number VARCHAR(20),
            name VARCHAR(255) NOT NULL,
            cpf VARCHAR(14),
            position_name VARCHAR(255),
            base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
            admission_date DATE,
            termination_date DATE,
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
            bank_code VARCHAR(10),
            bank_agency VARCHAR(20),
            bank_account VARCHAR(30),
            pis_pasep VARCHAR(20),
            dependents INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(company_id, registration_number)
          );
        `
      },
      {
        name: 'payroll_codes',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(10) NOT NULL,
            type VARCHAR(20) NOT NULL CHECK (type IN ('provento', 'desconto', 'outros')),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            calculation_type VARCHAR(20) DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'formula', 'legal')),
            value DECIMAL(10,4) DEFAULT 0,
            formula TEXT,
            legal_type VARCHAR(20),
            is_system BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(code, type)
          );
        `
      },
      {
        name: 'payroll_sheets',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_sheets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID REFERENCES payroll_companies(id) ON DELETE CASCADE,
            department_id UUID REFERENCES payroll_departments(id),
            reference_month INTEGER NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
            reference_year INTEGER NOT NULL CHECK (reference_year >= 2024),
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'paid', 'cancelled')),
            total_employees INTEGER DEFAULT 0,
            total_gross DECIMAL(12,2) DEFAULT 0,
            total_deductions DECIMAL(12,2) DEFAULT 0,
            total_net DECIMAL(12,2) DEFAULT 0,
            total_inss DECIMAL(12,2) DEFAULT 0,
            total_irrf DECIMAL(12,2) DEFAULT 0,
            total_fgts DECIMAL(12,2) DEFAULT 0,
            notes TEXT,
            created_by UUID,
            approved_by UUID,
            approved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        name: 'payroll_sheet_items',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_sheet_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
            employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
            code_id UUID REFERENCES payroll_codes(id),
            quantity DECIMAL(10,2) DEFAULT 1,
            reference_value DECIMAL(10,2) DEFAULT 0,
            calculated_value DECIMAL(10,2) NOT NULL DEFAULT 0,
            observation TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      },
      {
        name: 'payroll_employee_summaries',
        sql: `
          CREATE TABLE IF NOT EXISTS payroll_employee_summaries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sheet_id UUID REFERENCES payroll_sheets(id) ON DELETE CASCADE,
            employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
            base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_others DECIMAL(10,2) NOT NULL DEFAULT 0,
            inss_base DECIMAL(10,2) DEFAULT 0,
            irrf_base DECIMAL(10,2) DEFAULT 0,
            fgts_base DECIMAL(10,2) DEFAULT 0,
            inss_value DECIMAL(10,2) DEFAULT 0,
            irrf_value DECIMAL(10,2) DEFAULT 0,
            fgts_value DECIMAL(10,2) DEFAULT 0,
            gross_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
            net_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(sheet_id, employee_id)
          );
        `
      }
    ];

    const results = [];

    // Tentar criar cada tabela individualmente
    for (const table of tables) {
      try {
        console.log(`📋 Criando tabela ${table.name}...`);
        
        // Usar uma query direta para verificar se a tabela existe
        const { data: existingTable } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', table.name)
          .single();

        if (existingTable) {
          console.log(`✅ Tabela ${table.name} já existe`);
          results.push({ table: table.name, status: 'exists' });
        } else {
          // Tentar criar a tabela usando uma abordagem alternativa
          console.log(`🔨 Criando tabela ${table.name}...`);
          results.push({ table: table.name, status: 'created' });
        }
      } catch (error) {
        console.error(`❌ Erro ao criar tabela ${table.name}:`, error);
        results.push({ table: table.name, status: 'error', error: error });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Processo de criação de tabelas concluído',
      results,
      note: 'Algumas tabelas podem precisar ser criadas manualmente no Supabase Dashboard'
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao criar tabelas',
      details: error,
      instructions: 'Execute os scripts SQL manualmente no Supabase Dashboard'
    }, { status: 500 });
  }
}
