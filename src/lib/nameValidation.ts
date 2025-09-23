/**
 * Utilitários simples para nomes de usuários
 */

/**
 * Verifica se um nome está vazio ou é muito curto
 */
export function isNameEmpty(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const cleanName = name.trim();
  return cleanName.length < 2;
}

/**
 * Extrai sugestões de nome a partir de um email
 */
export function extractNameFromEmail(email: string): { firstName?: string; lastName?: string } | null {
  if (!email || typeof email !== 'string') return null;

  try {
    const emailPart = email.split('@')[0];
    if (!emailPart) return null;

    // Remover números e caracteres especiais, substituir por espaços
    let cleanName = emailPart
      .replace(/[0-9._-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanName || cleanName.length < 2) return null;

    // Dividir em partes
    const nameParts = cleanName
      .split(/\s+/)
      .filter(part => part.length > 1);

    if (nameParts.length === 0) return null;

    // Capitalizar nomes
    const capitalizedParts = nameParts.map(part =>
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    );

    if (capitalizedParts.length === 1) {
      return { firstName: capitalizedParts[0] };
    } else if (capitalizedParts.length >= 2) {
      return {
        firstName: capitalizedParts[0],
        lastName: capitalizedParts[capitalizedParts.length - 1]
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao extrair nome do email:', error);
    return null;
  }
}

/**
 * Valida se um nome foi preenchido
 */
export function validateName(name: string): {
  isValid: boolean;
  message?: string;
} {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      message: 'Nome é obrigatório'
    };
  }

  const cleanName = name.trim();

  if (cleanName.length < 2) {
    return {
      isValid: false,
      message: 'Nome deve ter pelo menos 2 caracteres'
    };
  }

  return {
    isValid: true
  };
}

/**
 * Gera sugestões de nome baseadas no email
 */
export function generateNameSuggestions(email?: string): string[] {
  const suggestions: string[] = [];

  if (email) {
    const extracted = extractNameFromEmail(email);
    if (extracted?.firstName) {
      suggestions.push(extracted.firstName);
      if (extracted.lastName) {
        suggestions.push(`${extracted.firstName} ${extracted.lastName}`);
      }
    }
  }

  return suggestions.slice(0, 2); // Máximo 2 sugestões
}

/**
 * Formata um nome corretamente
 */
export function formatName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .trim()
    .split(/\s+/)
    .map(part => {
      if (part.length <= 2) {
        // Preposições e artigos em minúsculo
        const lowerPart = part.toLowerCase();
        if (['da', 'de', 'do', 'das', 'dos', 'e', 'o', 'a'].includes(lowerPart)) {
          return lowerPart;
        }
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Verifica se um perfil precisa de nomes
 */
export function profileNeedsCompletion(profile: any): {
  needsCompletion: boolean;
  reasons: string[];
  suggestions: { firstName?: string; lastName?: string };
} {
  const reasons: string[] = [];
  let needsCompletion = false;

  const firstName = profile?.first_name?.trim() || '';
  const lastName = profile?.last_name?.trim() || '';

  // Verificar primeiro nome
  if (isNameEmpty(firstName)) {
    reasons.push('Primeiro nome não informado');
    needsCompletion = true;
  }

  // Verificar sobrenome
  if (isNameEmpty(lastName)) {
    reasons.push('Sobrenome não informado');
    needsCompletion = true;
  }

  // Gerar sugestões
  const suggestions: { firstName?: string; lastName?: string } = {};

  if (needsCompletion && profile?.email) {
    const extracted = extractNameFromEmail(profile.email);
    if (extracted) {
      if (isNameEmpty(firstName)) {
        suggestions.firstName = extracted.firstName;
      }
      if (isNameEmpty(lastName)) {
        suggestions.lastName = extracted.lastName;
      }
    }
  }

  return {
    needsCompletion,
    reasons,
    suggestions
  };
}
