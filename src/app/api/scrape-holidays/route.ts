import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Interface para os feriados
interface Holiday {
  date: string; // Format: YYYY-MM-DD
  name: string;
  type: string;
  description?: string;
}

// Lista de feriados nacionais brasileiros por ano
const BRAZILIAN_HOLIDAYS: Record<number, Omit<Holiday, 'date'>[]> = {
  2024: [
    { name: 'Confraternização Universal', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Carnaval', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Sexta-feira Santa', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Tiradentes', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Dia do Trabalho', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Corpus Christi', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Independência do Brasil', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Nossa Senhora Aparecida', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Finados', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Proclamação da República', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Natal', type: 'NATIONAL', description: 'Feriado Nacional' }
  ],
  2025: [
    { name: 'Confraternização Universal', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Carnaval', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Sexta-feira Santa', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Tiradentes', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Dia do Trabalho', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Corpus Christi', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Independência do Brasil', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Nossa Senhora Aparecida', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Finados', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Proclamação da República', type: 'NATIONAL', description: 'Feriado Nacional' },
    { name: 'Natal', type: 'NATIONAL', description: 'Feriado Nacional' }
  ]
};

// Datas dos feriados nacionais brasileiros por ano
const BRAZILIAN_HOLIDAY_DATES: Record<number, Record<string, string>> = {
  2024: {
    'Confraternização Universal': '2024-01-01',
    'Carnaval': '2024-02-13',
    'Sexta-feira Santa': '2024-03-29',
    'Tiradentes': '2024-04-21',
    'Dia do Trabalho': '2024-05-01',
    'Corpus Christi': '2024-05-30',
    'Independência do Brasil': '2024-09-07',
    'Nossa Senhora Aparecida': '2024-10-12',
    'Finados': '2024-11-02',
    'Proclamação da República': '2024-11-15',
    'Natal': '2024-12-25'
  },
  2025: {
    'Confraternização Universal': '2025-01-01',
    'Carnaval': '2025-03-04',
    'Sexta-feira Santa': '2025-04-18',
    'Tiradentes': '2025-04-21',
    'Dia do Trabalho': '2025-05-01',
    'Corpus Christi': '2025-06-19',
    'Independência do Brasil': '2025-09-07',
    'Nossa Senhora Aparecida': '2025-10-12',
    'Finados': '2025-11-02',
    'Proclamação da República': '2025-11-15',
    'Natal': '2025-12-25'
  }
};

// Função para obter os feriados brasileiros para um determinado ano
function getBrazilianHolidays(year: number): Holiday[] {
  // Verificar se temos dados para o ano solicitado
  if (!BRAZILIAN_HOLIDAYS[year]) {
    // Se não tivermos dados para o ano específico, usar o ano mais próximo
    const availableYears = Object.keys(BRAZILIAN_HOLIDAYS).map(Number);
    const closestYear = availableYears.reduce((prev, curr) => 
      Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
    );
    
    console.log(`Dados não disponíveis para ${year}, usando ${closestYear} como referência`);
    
    // Ajustar as datas para o ano solicitado
    return BRAZILIAN_HOLIDAYS[closestYear].map(holiday => {
      // Obter a data do feriado no ano de referência
      const referenceDate = BRAZILIAN_HOLIDAY_DATES[closestYear][holiday.name];
      
      if (!referenceDate) {
        console.warn(`Data não encontrada para ${holiday.name} no ano ${closestYear}`);
        return null;
      }
      
      // Extrair o mês e o dia
      const [_, month, day] = referenceDate.split('-');
      
      // Criar a nova data para o ano solicitado
      const newDate = `${year}-${month}-${day}`;
      
      return {
        ...holiday,
        date: newDate
      };
    }).filter((h): h is Holiday => h !== null);
  }
  
  // Se tivermos dados para o ano solicitado, usá-los diretamente
  return BRAZILIAN_HOLIDAYS[year].map(holiday => {
    const date = BRAZILIAN_HOLIDAY_DATES[year][holiday.name];
    
    if (!date) {
      console.warn(`Data não encontrada para ${holiday.name} no ano ${year}`);
      return null;
    }
    
    return {
      ...holiday,
      date
    };
  }).filter((h): h is Holiday => h !== null);
}

export async function GET(request: NextRequest) {
  try {
    // Obter o ano da query string
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    
    if (!yearParam) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Parâmetro "year" é obrigatório' 
        }, 
        { status: 400 }
      );
    }
    
    const year = parseInt(yearParam, 10);
    
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Ano inválido. Deve ser um número entre 2000 e 2100' 
        }, 
        { status: 400 }
      );
    }
    
    // Obter os feriados brasileiros para o ano solicitado
    const holidays = getBrazilianHolidays(year);
    
    return NextResponse.json({
      success: true,
      data: holidays
    });
  } catch (error) {
    console.error('Erro ao obter feriados:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      }, 
      { status: 500 }
    );
  }
}
