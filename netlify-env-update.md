# Configuração da Chave Supabase no Netlify

## Problema Identificado
A variável `SUPABASE_SERVICE_KEY` no Netlify está truncada (39 caracteres) em vez da chave completa (219 caracteres).

## Chave Correta Encontrada no Projeto
```
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenZpbmdkdG50dGllamN2dWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDk0NjcyOSwiZXhwIjoyMDYwNTIyNzI5fQ.Rfo5jOH3iFxFBPyV7mNtG7Ja29AFskUQYYA4fgG2HAk
```

## Como Aplicar no Netlify

### Opção 1: Via Interface Web (Recomendado)
1. Acesse: https://app.netlify.com/sites/painelabz/settings/deploys
2. Clique em "Environment variables"
3. Encontre `SUPABASE_SERVICE_KEY`
4. Clique em "Edit" ou "Add new variable" se não existir
5. Cole a chave completa acima
6. Salve e faça um novo deploy

### Opção 2: Via Netlify CLI
```bash
# Instalar Netlify CLI se não tiver
npm install -g netlify-cli

# Login no Netlify
netlify login

# Definir a variável
netlify env:set SUPABASE_SERVICE_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenZpbmdkdG50dGllamN2dWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDk0NjcyOSwiZXhwIjoyMDYwNTIyNzI5fQ.Rfo5jOH3iFxFBPyV7mNtG7Ja29AFskUQYYA4fgG2HAk"

# Fazer novo deploy
netlify deploy --prod
```

## Verificação
Após aplicar a chave, o próximo build do Netlify deve:
- ✅ Não mostrar mais o erro "Comprimento da chave: 39"
- ✅ Não mostrar mais "Invalid API key" 
- ✅ Conectar com sucesso ao Supabase
- ✅ Build completar sem erros

## Outras Variáveis Importantes
Certifique-se de que estas também estão configuradas no Netlify:

```
NEXT_PUBLIC_SUPABASE_URL=https://arzvingdtnttiejcvucs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenZpbmdkdG50dGllamN2dWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NDY3MjksImV4cCI6MjA2MDUyMjcyOX0.8OYE8Dg3haAxQ7p3MUiLJE_wiy2rCKsWiszMVwwo1LI
DATABASE_URL=postgresql://postgres.arzvingdtnttiejcvucs:Caio%402122%40@aws-0-us-east-2.pooler.supabase.com:6543/postgres
JWT_SECRET=f033ca87f66377b65a90b4b510ff899fdb4c9bd1c5bc2b32731d97759c3815a8
ADMIN_EMAIL=caio.correia@groupabz.com
ADMIN_PHONE_NUMBER=+5522997847289
ADMIN_PASSWORD=Caio@2122@
ADMIN_FIRST_NAME=Caio
ADMIN_LAST_NAME=Correia
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=apiabzgroup@gmail.com
EMAIL_PASSWORD=zbli vdst fmco dtfc
EMAIL_FROM=apiabzgroup@gmail.com
NEXT_PUBLIC_APP_URL=https://painelabzgroup.netlify.app
NEXT_PUBLIC_API_URL=https://painelabzgroup.netlify.app/api
```
