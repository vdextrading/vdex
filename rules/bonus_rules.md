# BÔNUS QUALIFICADOR

## Objetivo
O Bônus Qualificador é um incentivo por metas de comissões geradas a partir de indicados diretos (nível 1). Ele é exibido como uma barra de progresso por nível de qualificação e, quando a meta é atingida, um bônus fixo é creditado.

## Fonte do progresso
- Conta somente comissões no nível 1:
  - `wallet_ledger.kind in ('unilevel','residual')`
  - `wallet_ledger.meta.level = 1`
  - `wallet_ledger.asset in ('usdt','usdc')`
- O progresso é calculado em USD (USDT + USDC), somando os valores das comissões.
- O valor investido do indicado não entra diretamente no progresso; o progresso cresce pela comissão gerada a partir desse investimento e dos lucros diários (residual) quando aplicável.

## Níveis e metas
O progresso é sequencial por nível. Ao atingir um nível, ele é considerado concluído e o progresso do próximo nível passa a contar a partir do zero (conceitualmente). No banco, como o histórico de comissões é cumulativo, isso é representado por metas cumulativas.

| Nível | Meta do nível | Bônus (crédito) |
|------|---------------:|----------------:|
| Bronze | 1.000 USD | 100 USD |
| Prata | 10.000 USD | 200 USD |
| Ouro | 20.000 USD | 300 USD |
| Diamante | 50.000 USD | 500 USD |

Regras:
- O progresso exibido em cada nível é limitado entre 0 e a meta do nível.
- Níveis já pagos/concluídos são tratados como “consumidos” para o cálculo do progresso do próximo nível.

## Pagamento e idempotência
- Ao atingir a meta de um nível, é gerado um crédito em `wallet_ledger`:
  - `kind = 'qualifier_bonus'`
  - `asset = 'usdt'`
  - `amount = valor do bônus do nível`
  - `meta.tier` indica o nível (`bronze`, `prata`, `ouro`, `diamante`)
- Para evitar pagamento duplicado, o sistema mantém `qualifier_bonus_payouts(user_id, tier)` como registro idempotente.
- Se o usuário ultrapassar metas múltiplas de uma vez, o sistema pode liberar mais de um nível na sequência.

## Exemplo (cadaster → zuomi)
Cenário:
- O usuário `cadaster` indicou o usuário `zuomi` (nível 1).
- `zuomi` aplicou 800 USD em planos.

Efeito no Bônus Qualificador do `cadaster`:
- A barra NÃO soma 800 USD diretamente.
- Ela soma a comissão de nível 1 gerada por essa aplicação.
  - Exemplo típico de Unilevel nível 1: 5% sobre o investimento.
  - Se for 5%: 800 × 5% = 40 USD de comissão.
- Portanto, o progresso do Bronze seria alimentado em aproximadamente **40 USD**, e poderá aumentar com **Residual nível 1** quando o BOT gerar lucro diário e o residual for pago.
