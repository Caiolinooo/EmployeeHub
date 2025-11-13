# INSTRUÇÕES PARA APLICAR MIGRATIONS MANUALMENTE

**⚠️ Execute estes SQLs no Supabase SQL Editor**

Acesse: https://supabase.com/dashboard/project/arzvingdtnttiejcvucs/sql/new

---

## 1️⃣ Criar tabela de notificações

```sql
-- Criar tabela de notificações gerais do sistema
-- Esta tabela é separada de social_notifications (que é específica para redes sociais)

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Comentário explicativo
COMMENT ON TABLE notifications IS 'Notificações gerais do sistema (avaliações, reembolsos, etc). Separada de social_notifications que é para redes sociais.';
COMMENT ON COLUMN notifications.type IS 'Tipo da notificação: avaliacao_criada, reembolso_aprovado, etc';
COMMENT ON COLUMN notifications.data IS 'Dados adicionais da notificação em formato JSON';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas suas próprias notificações
CREATE POLICY notifications_select_own 
  ON notifications 
  FOR SELECT 
  USING (auth.uid()::text = user_id::text);

-- Política: Usuários podem atualizar apenas suas próprias notificações (marcar como lida)
CREATE POLICY notifications_update_own 
  ON notifications 
  FOR UPDATE 
  USING (auth.uid()::text = user_id::text);

-- Política: Service role pode inserir notificações para qualquer usuário
CREATE POLICY notifications_insert_service 
  ON notifications 
  FOR INSERT 
  WITH CHECK (true);
```

---

## 2️⃣ Adicionar campo data_liberacao na tabela periodos_avaliacao

```sql
-- Adicionar campo data_liberacao para controlar quando os usuários serão notificados
ALTER TABLE periodos_avaliacao 
  ADD COLUMN IF NOT EXISTS data_liberacao DATE;

-- Comentário explicativo
COMMENT ON COLUMN periodos_avaliacao.data_liberacao IS 'Data em que os usuários serão notificados para preencher a avaliação. Se NULL, notifica imediatamente na data_inicio.';

-- Índice para queries eficientes
CREATE INDEX IF NOT EXISTS idx_periodos_avaliacao_data_liberacao 
  ON periodos_avaliacao (data_liberacao) 
  WHERE ativo = TRUE;

-- Atualizar períodos existentes para usar data_inicio como data_liberacao
UPDATE periodos_avaliacao 
SET data_liberacao = data_inicio 
WHERE data_liberacao IS NULL;
```

---

## ✅ Verificação

Após executar os SQLs acima, verifique se as tabelas foram criadas:

```sql
-- Verificar tabela notifications
SELECT * FROM notifications LIMIT 1;

-- Verificar campo data_liberacao
SELECT nome, data_inicio, data_liberacao 
FROM periodos_avaliacao 
WHERE ativo = TRUE;
```

---

## 🔄 Próximos passos

Depois de aplicar as migrations:
1. Reinicie o servidor de desenvolvimento
2. Teste criar uma nova avaliação
3. Verifique se as notificações são criadas corretamente
