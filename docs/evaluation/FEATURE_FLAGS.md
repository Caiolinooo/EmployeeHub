# Feature Flags - Avaliação de Desempenho

Flag atual:

| Flag | Variável de Ambiente | Descrição | Default |
|------|----------------------|-----------|---------|
| avaliacao_weighted_calc | `EVALUACAO_WEIGHTED_ENABLED` | Ativa cálculo via settings (método simple/weighted com pesos por pergunta) | false |

## Uso

```ts
import { isFeatureEnabled } from '@/lib/featureFlags';

if (isFeatureEnabled('avaliacao_weighted_calc')) {
  // lógica avançada
} else {
  // fallback simples
}
```

## Ativar em desenvolvimento

Adicionar ao `.env.local`:

```bash
EVALUACAO_WEIGHTED_ENABLED=true
```

## Sem impacto

Com a flag desativada o sistema mantém cálculo de média simples existente.
