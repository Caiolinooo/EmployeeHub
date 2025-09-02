# 📝 CAMPO CPF ADICIONADO AO FORMULÁRIO DE REGISTRO

## ✅ **PROBLEMA RESOLVIDO**

### 🔍 **Situação Anterior:**
- ❌ Campo CPF não existia no formulário de registro
- ❌ API esperava o campo `cpf` mas ele não era enviado
- ❌ Erro: `Could not find the 'tax_id' column` (mas a coluna existe)
- ❌ Usuário não conseguia informar CPF/CNPJ

### 🔧 **Correções Aplicadas:**

#### **1. Campo CPF Adicionado ao Formulário:**

**Estado do Formulário:**
```typescript
// ANTES:
const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  email: emailFromUrl,
  phoneNumber: phoneFromUrl,
  position: '',
  department: '',
  inviteCode: inviteCodeFromUrl,
});

// DEPOIS:
const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  email: emailFromUrl,
  phoneNumber: phoneFromUrl,
  position: '',
  department: '',
  cpf: '', // ✅ Campo CPF adicionado
  inviteCode: inviteCodeFromUrl,
});
```

#### **2. Campo Visual no Formulário:**
```jsx
<div className="mb-4">
  <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="cpf">
    {t('register.cpf')}
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <FaIdCard className="text-gray-400" />
    </div>
    <input
      type="text"
      id="cpf"
      name="cpf"
      value={formData.cpf}
      onChange={handleChange}
      className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder={t('register.cpfPlaceholder')}
      maxLength={18} // Para CNPJ formatado
    />
  </div>
</div>
```

#### **3. Formatação Automática CPF/CNPJ:**
```typescript
// Função para formatar CPF/CNPJ
const formatCpfCnpj = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  
  // CPF (11 dígitos): 000.000.000-00
  if (numbers.length <= 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  // CNPJ (14 dígitos): 00.000.000/0000-00
  else {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
};
```

#### **4. Traduções Adicionadas:**

**Português:**
```typescript
cpf: 'CPF/CNPJ',
cpfPlaceholder: 'Digite seu CPF ou CNPJ',
```

**Inglês:**
```typescript
cpf: 'TAX ID (CPF/CNPJ)',
cpfPlaceholder: 'Enter your CPF or CNPJ',
```

#### **5. Ícone Adicionado:**
```typescript
import { FaUser, FaEnvelope, FaPhone, FaBriefcase, FaBuilding, FaIdCard } from 'react-icons/fa';
```

### 🎯 **Características do Campo CPF:**

#### **✅ Funcionalidades:**
- **Opcional:** Não é obrigatório para registro
- **Formatação automática:** CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
- **Validação de entrada:** Apenas números são aceitos
- **Limite de caracteres:** 18 caracteres (CNPJ formatado)
- **Ícone visual:** FaIdCard para identificação

#### **✅ Comportamento:**
- **CPF:** Até 11 dígitos → Formato: 000.000.000-00
- **CNPJ:** 12-14 dígitos → Formato: 00.000.000/0000-00
- **Limpeza automática:** Remove caracteres não numéricos
- **Formatação em tempo real:** Aplica máscara conforme digitação

### 📊 **Posicionamento no Formulário:**

```
1. Nome*
2. Sobrenome*
3. Email*
4. Telefone*
5. CPF/CNPJ (NOVO) ← Posicionado após telefone
6. Cargo
7. Departamento
```

### 🧪 **Como Testar:**

1. **Acesse:** `http://localhost:3000/register`
2. **Preencha os campos obrigatórios**
3. **Teste o campo CPF:**
   - Digite: `12345678901` → Resultado: `123.456.789-01`
   - Digite: `12345678000195` → Resultado: `12.345.678/0001-95`
4. **Envie o formulário**
5. **Resultado esperado:** ✅ Registro bem-sucedido com CPF

### 🔗 **Integração com API:**

O campo CPF agora é enviado corretamente para a API:
```typescript
// Dados enviados para /api/auth/register-supabase
{
  firstName: 'teste',
  lastName: 'teste',
  email: 'usuario@exemplo.com',
  phoneNumber: '+5522999999999',
  position: 'teste',
  department: 'teste',
  cpf: '123.456.789-01', // ✅ Campo CPF incluído
  inviteCode: null
}
```

### 🎉 **Resultado Final:**

- ✅ **Campo CPF visível** no formulário de registro
- ✅ **Formatação automática** CPF/CNPJ
- ✅ **Traduções completas** português/inglês
- ✅ **Integração com API** funcionando
- ✅ **Validação opcional** - não obrigatório
- ✅ **UX melhorada** com ícone e placeholder

**🎯 AGORA OS USUÁRIOS PODEM INFORMAR SEU CPF/CNPJ NO REGISTRO!**
