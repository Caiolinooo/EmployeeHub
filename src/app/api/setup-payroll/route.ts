import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/setup-payroll
 * Configura automaticamente o banco de dados do módulo de folha de pagamento
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await garantirNivelPayroll(request, 'edit');
    if (!gate.ok) return gate.error;

    console.log('🚀 Iniciando configuração do banco de dados...');

    const companyId = '550e8400-e29b-41d4-a716-446655440000';
    const departmentId = '660e8400-e29b-41d4-a716-446655440000';
    const profileId = '880e8400-e29b-41d4-a716-446655440000';
    const position1Id = '990e8400-e29b-41d4-a716-446655440001';
    const position2Id = '990e8400-e29b-41d4-a716-446655440002';

    // Inserir empresa
    console.log('🏢 Criando empresa ABZ Group...');
    const { error: companyError } = await supabase
      .from('payroll_companies')
      .upsert({
        id: companyId,
        name: 'AGUAS BRASILEIRAS SERVICOS E CONSULTORIAS EM ATIVIDADES MARITIMAS LTDA',
        cnpj: '17.784.306/0001-89',
        address: 'Endereço da empresa',
        phone: '+55 22 99999-9999',
        email: 'contato@groupabz.com',
        contact_person: 'Caio Correia',
        is_active: true
      });

    if (companyError && !companyError.message?.includes('duplicate key')) {
      console.error('Erro ao criar empresa:', companyError);
    }

    // Inserir departamento
    console.log('🏬 Criando departamento...');
    const { error: deptError } = await supabase
      .from('payroll_departments')
      .upsert({
        id: departmentId,
        company_id: companyId,
        code: '33',
        name: 'ABZ - FMS - FIRST MARINE SOLUTIONS',
        description: 'Departamento de soluções marítimas',
        is_active: true
      });

    if (deptError && !deptError.message?.includes('duplicate key')) {
      console.error('Erro ao criar departamento:', deptError);
    }

    // Inserir perfil de cálculo
    console.log('⚙️ Criando perfil de cálculo...');
    const { error: profileError } = await supabase
      .from('payroll_calculation_profiles')
      .upsert({
        id: profileId,
        name: 'Perfil Padrão ABZ',
        description: 'Perfil de cálculo padrão para funcionários da ABZ Group',
        company_id: companyId,
        rules: { inss: true, irrf: true, fgts: true, vale_transporte: 6 },
        is_default: true,
        is_active: true
      });

    if (profileError && !profileError.message?.includes('duplicate key')) {
      console.error('Erro ao criar perfil:', profileError);
    }

    // Inserir cargos
    console.log('💼 Criando cargos...');
    const { error: pos1Error } = await supabase
      .from('payroll_positions')
      .upsert({
        id: position1Id,
        company_id: companyId,
        code: 'PROC_DADOS',
        name: 'Processador de Dados',
        description: 'Profissional responsável pelo processamento de dados',
        base_salary: 5466.67,
        calculation_profile_id: profileId,
        is_active: true
      });

    const { error: pos2Error } = await supabase
      .from('payroll_positions')
      .upsert({
        id: position2Id,
        company_id: companyId,
        code: 'DEV_FULL',
        name: 'Desenvolvedor Full Stack',
        description: 'Desenvolvedor de software full stack',
        base_salary: 8000.00,
        calculation_profile_id: profileId,
        is_active: true
      });

    // Inserir códigos de folha
    console.log('📋 Criando códigos de folha...');
    const codes = [
      { code: '104', type: 'desconto', name: 'INSS', description: 'Contribuição Previdenciária', calculation_type: 'legal', legal_type: 'inss', is_system: true },
      { code: '108', type: 'desconto', name: 'IRRF', description: 'Imposto de Renda Retido na Fonte', calculation_type: 'legal', legal_type: 'irrf', is_system: true },
      { code: '119', type: 'outros', name: 'FGTS 8%', description: 'Fundo de Garantia do Tempo de Serviço', calculation_type: 'legal', legal_type: 'fgts', is_system: true },
      { code: '001', type: 'provento', name: 'Dias Normais', description: 'Salário base por dias trabalhados', calculation_type: 'fixed', legal_type: null, is_system: false },
      { code: '063', type: 'provento', name: 'Adicional de Sobreaviso 20%', description: 'Adicional por sobreaviso', calculation_type: 'percentage', legal_type: null, is_system: false },
      { code: '131', type: 'provento', name: 'Adicional Noturno 20%', description: 'Adicional por trabalho noturno', calculation_type: 'percentage', legal_type: null, is_system: false },
      { code: '213', type: 'provento', name: 'Adicional de Periculosidade 30%', description: 'Adicional por atividade perigosa', calculation_type: 'percentage', legal_type: null, is_system: false }
    ];

    for (const code of codes) {
      const { error: codeError } = await supabase
        .from('payroll_codes')
        .upsert({
          ...code,
          value: 0,
          is_active: true
        });
      
      if (codeError && !codeError.message?.includes('duplicate key')) {
        console.error(`Erro ao criar código ${code.code}:`, codeError);
      }
    }

    // Inserir funcionários
    console.log('👥 Criando funcionários...');
    const employees = [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        registration_number: '579',
        name: 'BIANCA FILIPPI',
        cpf: '000.000.000-00',
        position_name: 'Processador de Dados',
        base_salary: 5466.67,
        position_id: position1Id
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        registration_number: '565',
        name: 'DANIEL ARAGAO MAGALHAES',
        cpf: '000.000.000-01',
        position_name: 'Processador de Dados',
        base_salary: 5466.67,
        position_id: position1Id
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440003',
        registration_number: '001',
        name: 'CAIO CORREIA',
        cpf: '000.000.000-02',
        position_name: 'Desenvolvedor Full Stack',
        base_salary: 8000.00,
        position_id: position2Id
      }
    ];

    for (const employee of employees) {
      const { error: empError } = await supabase
        .from('payroll_employees')
        .upsert({
          ...employee,
          company_id: companyId,
          department_id: departmentId,
          calculation_profile_id: profileId,
          admission_date: '2024-01-01',
          status: 'active',
          dependents: 0
        });
      
      if (empError && !empError.message?.includes('duplicate key')) {
        console.error(`Erro ao criar funcionário ${employee.name}:`, empError);
      }
    }

    // Verificar dados criados
    const { data: companies } = await supabase
      .from('payroll_companies')
      .select('name')
      .limit(5);

    const { data: employeesData } = await supabase
      .from('payroll_employees')
      .select('name, position_name, base_salary')
      .limit(10);

    const { data: codesData } = await supabase
      .from('payroll_codes')
      .select('code, name, type')
      .limit(10);

    return NextResponse.json({
      success: true,
      message: 'Configuração do banco de dados concluída com sucesso!',
      data: {
        companies: companies?.length || 0,
        employees: employeesData?.length || 0,
        codes: codesData?.length || 0,
        details: {
          companies,
          employees: employeesData,
          codes: codesData
        }
      }
    });

  } catch (error) {
    console.error('Erro na configuração:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao configurar banco de dados',
      details: error
    }, { status: 500 });
  }
}
