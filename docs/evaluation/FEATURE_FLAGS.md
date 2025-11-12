# Feature Flags - Avaliação de Desempenho

Flag atual:

| Flag | Variável de Ambiente | Descrição | Default |
|------|----------------------|-----------|---------|
| avaliacao_weighted_calc | `EVALUACAO_WEIGHTED_ENABLED` | Permite usar método definido em UI (simple_average ou weighted). Se `weighted` escolhido no admin e env=true aplica pesos. | false |

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

## Precedência

Para aplicar cálculo ponderado são necessários dois fatores:

1. `EVALUACAO_WEIGHTED_ENABLED=true` no ambiente
2. Método na UI configurado para `weighted` (PATCH /api/avaliacao/settings)

Se qualquer um estiver ausente, usa média simples.

## Fallback

Flag desativada => ignoramos método `weighted` salvo e usamos média simples.
