import { z } from 'zod';
import { UploadedFile } from '@/components/FileUploader';
import { Currency } from '@/lib/currencyConverter';

// Define a type for files with previews
export interface FileWithPreview extends File {
  preview?: string;
}

// CPF validation
export const validateCPF = (value: string): boolean => {
  // Remove non-digit characters
  const cleanCPF = value.replace(/\D/g, '');

  // Check if it has 11 digits
  if (cleanCPF.length !== 11) return false;

  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cleanCPF)) return false;

  // Validate check digits
  let sum = 0;
  let remainder;

  // First check digit
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  // Second check digit
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
};

// Validação de email extremamente permissiva
export const validateEmail = (value: string): boolean => {
  if (!value) return false;

  // Remover espaços em branco no início e fim
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) return false;

  // Verificação super básica: contém @ e não é o primeiro nem o último caractere
  const hasAtSymbol = trimmedValue.includes('@');
  const atSymbolNotAtEnds = trimmedValue[0] !== '@' && trimmedValue[trimmedValue.length - 1] !== '@';

  // Verificação extremamente permissiva
  return hasAtSymbol && atSymbolNotAtEnds;
};

// Validação de telefone
export const validatePhone = (value: string): boolean => {
  // Remove non-digit characters
  const cleanPhone = value.replace(/\D/g, '');

  // Check if it has between 10 and 15 digits (para suportar números internacionais)
  // Números brasileiros: 10-11 dígitos
  // Números internacionais: até 15 dígitos incluindo código do país
  return cleanPhone.length >= 10 && cleanPhone.length <= 15;
};

// Validação de valor monetário
export const validateCurrency = (value: string): boolean => {
  // Remove currency symbol, spaces, and convert comma to dot
  const cleanValue = value.replace(/[R$\s€£$]/g, '').replace(',', '.');

  // Check if it's a valid number and greater than zero
  const numValue = parseFloat(cleanValue);
  return !isNaN(numValue) && numValue > 0;
};

// Validation for PIX keys
export const validatePixKey = (pixTipo: string, value: string): boolean => {
  if (!value) return false;

  switch (pixTipo) {
    case 'cpf':
      return validateCPF(value);
    case 'email':
      return validateEmail(value);
    case 'telefone':
      // Aceita formatos (xx) xxxxx-xxxx ou telefone limpo
      return /^\(\d{2}\)\s\d{5}-\d{4}$/.test(value) || validatePhone(value);
    case 'aleatoria':
      // Chave aleatória deve ter entre 32 e 36 caracteres
      return value.length >= 8 && value.length <= 36;
    default:
      return false;
  }
};

// Schema para uma despesa individual
export const expenseSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substr(2, 9)),
  tipoReembolso: z.string().min(1, { message: 'Tipo de reembolso é obrigatório' }),
  descricao: z.string().min(5, { message: 'Descrição é obrigatória (mínimo 5 caracteres)' })
    .max(500, { message: 'Descrição muito longa (máximo 500 caracteres)' }),
  valor: z.string().min(1, { message: 'Valor é obrigatório' })
    .refine(validateCurrency, {
      message: 'Valor inválido'
    }),
  comprovantes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    file: z.any().optional(),
    url: z.string().optional(),
    uploading: z.boolean().optional(),
    uploadError: z.string().optional(),
    buffer: z.any().optional(),
    isLocalFile: z.boolean().optional()
  })).min(1, { message: 'É necessário anexar pelo menos um comprovante' })
});

// Base form schema
export const formSchema = z.object({
  nome: z.string().min(3, { message: 'Nome completo é obrigatório' })
    .refine(value => value.trim().includes(' '), {
      message: 'Por favor, informe o nome completo'
    }),
  email: z.string().email({ message: 'Email inválido' })
    .refine(validateEmail, {
      message: 'Formato de email inválido'
    }),
  telefone: z.string().min(10, { message: 'Telefone inválido' })
    .refine(validatePhone, {
      message: 'Formato de telefone inválido. Use um número válido com DDD.'
    }),
  data: z.string().min(1, { message: 'Data é obrigatória' })
    .refine(value => {
      const date = new Date(value);
      return !isNaN(date.getTime()) && date <= new Date();
    }, {
      message: 'Data inválida ou futura'
    }),
  // Múltiplas despesas
  expenses: z.array(expenseSchema).min(1, { message: 'Pelo menos uma despesa é obrigatória' })
    .max(10, { message: 'Máximo de 10 despesas permitidas' }),

  // Campos mantidos para compatibilidade (serão calculados automaticamente)
  tipoReembolso: z.string().optional(),
  descricao: z.string().optional(),
  valorTotal: z.string().optional(),
  moeda: z.enum(['BRL', 'USD', 'EUR', 'GBP']).default('BRL'),
  metodoPagamento: z.string().min(1, { message: 'Método de pagamento é obrigatório' }),

  // Campos condicionais para dados bancários
  banco: z.string().nullable().optional(),
  agencia: z.string().nullable().optional(),
  conta: z.string().nullable().optional(),

  // Campos condicionais para PIX
  pixTipo: z.string().nullable().optional(),
  pixChave: z.string().nullable().optional(),

  // Comprovantes agora estão dentro de cada despesa individual

  // Campo opcional
  observacoes: z.string().nullable().optional()
    .transform(val => val === '' ? null : val)
    .refine(val => val === null || val!.length <= 1000, {
      message: 'Observações muito longas (máximo 1000 caracteres)'
    }),

  // Campos adicionais
  cargo: z.string().min(1, { message: 'Cargo é obrigatório' }),
  centroCusto: z.string().min(1, { message: 'Centro de custo é obrigatório' }),
  cpf: z.string().min(11, { message: 'CPF inválido' })
    .refine(validateCPF, {
      message: 'CPF inválido' // This will be translated through the i18n system
    })
});

// Refined schema with conditional validation
export const refinedFormSchema = formSchema.superRefine(
  (data, ctx) => {
    // Se o método de pagamento for 'deposito', os campos bancários são obrigatórios
    if (data.metodoPagamento === 'deposito') {
      if (!data.banco) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Banco é obrigatório para depósito bancário',
          path: ['banco']
        });
      }

      if (!data.agencia) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Agência é obrigatória para depósito bancário',
          path: ['agencia']
        });
      }

      if (!data.conta) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conta é obrigatória para depósito bancário',
          path: ['conta']
        });
      }
    }

    // Se o método de pagamento for 'pix', os campos de PIX são obrigatórios
    if (data.metodoPagamento === 'pix') {
      if (!data.pixTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tipo de chave PIX é obrigatório',
          path: ['pixTipo']
        });
      }

      if (!data.pixChave) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Chave PIX é obrigatória',
          path: ['pixChave']
        });
      } else if (data.pixTipo && !validatePixKey(data.pixTipo, data.pixChave)) {
        // This error message will be overridden by the custom validation in the form component
        // which uses the i18n system to provide localized error messages
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Chave PIX inválida para o tipo ${data.pixTipo}`,
          path: ['pixChave']
        });
      }
    }

    // Validar tamanho dos comprovantes (máximo 10MB cada)
    if ((data as any).comprovantes && (data as any).comprovantes.length > 0) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      (data as any).comprovantes.forEach((file: any, index: number) => {
        if (file.size > maxSize) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `O arquivo ${file.name} excede o tamanho máximo de 10MB`,
            path: ['comprovantes']
          });
        }
      });
    }
  }
);

// Tipo para os valores do formulário
export type FormValues = z.infer<typeof formSchema>;
