# Changelog - Painel ABZ

## [2.0.0] - 2025-12-01

### 🚀 Major Changes - Módulo de Avaliação de Desempenho

#### ✨ Novas Funcionalidades

**Sistema de Avaliação Completo**
- Implementado fluxo completo de avaliação com 8 status diferentes
- Novo fluxo: Gerente aprova → Funcionário comenta → Gerente finaliza
- Sistema de comentário final do funcionário antes da conclusão
- 10 critérios de avaliação do gerente (Q15-Q24)
- Sistema de notas do gerente para autoavaliação do colaborador (Q11-Q14)
- Cálculo automático de nota final considerando todas as notas
- Gráficos e analytics com todas as avaliações

**Sistema de Notificações e Emails**
- 6 tipos de notificações implementadas em todo o fluxo
- Emails automáticos em cada etapa da avaliação
- Notificações diferenciadas por contexto (aprovação vs comentário)
- Sistema de notificações push web integrado

**Interface e UX**
- Dashboard do gerente sem duplicidade de cards
- Seção destacada "Avaliações Aguardando Sua Revisão"
- Cards contextuais baseados em status
- Bloqueio visual de avaliações concluídas
- Gráficos separados: Avaliação Gerencial vs Notas para Autoavaliação
- Interface responsiva e intuitiva

#### 🔒 Segurança e Controles

**Bloqueios de Edição**
- 4 camadas de proteção para avaliações concluídas
- Validações em frontend e backend
- Controle de permissões por role e status
- Proteção contra edição não autorizada

**Controle de Acesso**
- Funcionário só edita em status permitidos
- Gerente só acessa avaliações da sua equipe
- Validações de transição de status
- Auditoria completa de ações

#### 🗄️ Banco de Dados

**Novas Colunas**
- `notas_gerente` (JSONB) - Notas do gerente para Q11-Q14
- `comentario_final_funcionario` (TEXT) - Comentário final
- `nota_final` (DECIMAL 3,2) - Nota final calculada
- `read` (BOOLEAN) - Status de leitura de notificações

**Novos Status**
- `aprovada_aguardando_comentario` - Aguardando comentário do funcionário
- `aguardando_finalizacao` - Aguardando finalização do gerente

**Correções**
- Constraint de status atualizada com novos valores
- Foreign key `aprovado_por` corrigida para `users_unified`
- Função RPC `create_notification_bypass_rls` com tipos corretos

#### 🔧 APIs

**Novas Rotas**
- `POST /api/avaliacao-desempenho/avaliacoes/[id]/final-comment` - Comentário final
- `POST /api/avaliacao-desempenho/avaliacoes/[id]/finalize` - Finalização definitiva

**Rotas Atualizadas**
- `POST /api/avaliacao-desempenho/avaliacoes/[id]/approve` - Primeira aprovação
- `PATCH /api/avaliacao/[id]` - Suporte a notas_gerente
- `GET /api/notifications` - Tipos de coluna corrigidos

#### 📊 Questionário

**Critérios de Avaliação do Gerente**
1. Prazos e Metas
2. Comprometimento
3. Autonomia e Proatividade
4. Comunicação, Colaboração e Relacionamento
5. Conhecimento das atividades
6. Resolução de problemas
7. Inteligência Emocional e Solução de conflitos
8. Inovação
9. Liderança - Delegação (apenas líderes)
10. Liderança - Feedback e Desenvolvimento (apenas líderes)

### 🐛 Bug Fixes

- Corrigido erro de coluna `read` não encontrada em notifications
- Corrigido erro de tipo na função RPC de notificações
- Corrigido erro de constraint de status
- Corrigido erro de coluna `nota_final` não encontrada
- Removida duplicidade de cards no dashboard do gerente
- Corrigido bloqueio de edição de avaliações concluídas
- Corrigidas mensagens de email por contexto

### 📝 Documentação

- Criado `VERIFICACAO_MODULO_AVALIACAO.md` com verificação completa
- Documentação de fluxo de status
- Documentação de notificações e emails
- Guia de permissões e controles

### 🔄 Migrations

- `20251201_fix_notifications_missing_columns.sql`
- `20251201_fix_notification_rpc_types.sql`
- `20251201_add_notas_gerente_column.sql`
- `20251201_add_comentario_final_funcionario.sql`
- `20251201_add_nota_final_column.sql`
- `20251201_update_status_constraint.sql`
- `20251201_fix_aprovado_por_fkey.sql`

---

## [1.2.0] - 2025-11-14

### Minor Changes
- Melhorias no sistema de reembolsos
- Otimizações de performance
- Correções de bugs menores

---

## [1.1.0] - 2025-11-10

### Minor Changes
- Sistema de avaliação básico
- Interface inicial de avaliações
- Integração com Supabase

---

## [1.0.0] - 2025-10-01

### Initial Release
- Sistema de autenticação
- Dashboard principal
- Gestão de usuários
- Sistema de reembolsos
- Módulo de documentos
