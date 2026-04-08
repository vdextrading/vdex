# BOT Rules (VDexTrading)
Este documento descreve as regras e o fluxo de funcionamento do BOT como está implementado no sistema, servindo como guia de leitura e análise.

## Objetivo diário (dia útil)
- Meta diária do BOT: aproximadamente 3,33% ao dia útil sobre o capital aplicado.
- O capital considerado é agregado: soma do valor de todos os contratos ativos do usuário.
- O BOT encerra o dia (pausa) quando a sequência diária do dia útil termina.

## Conceitos
- Contrato: plano contratado (ex.: 30 ou 90 dias úteis) com capital, regras e estado diário.
- Dia útil: segunda a sexta.
- Ciclo: janela de 10 minutos (600s).
- Rodada: agrupamento de ciclos que persegue um alvo parcial (ex.: ~1%).
- Pausa (analysis): ciclo sem trades, usado para simular “analisando a melhor entrada”.

## Estrutura do dia (rodadas e pausas)
- O dia é dividido em 3 ou 4 rodadas.
- Rodadas 1–3:
  - 4 a 6 ciclos de 10 minutos por rodada.
  - alvo típico por rodada: ~1%.
- Pausas entre rodadas:
  - 1 a 3 ciclos de 10 minutos em modo analysis (10 a 30 minutos).
- Rodada 4 (quando existir):
  - 2 a 3 ciclos de 10 minutos.
  - alvo típico: ~0,33% (para completar 3,33% no dia).

## Ciclo de 10 minutos
- Cada ciclo tem duração de 600 segundos.
- Modos:
  - trade: executa simulação de operações e aplica lucro/prejuízo planejado para o ciclo.
  - analysis: não executa operações; o ciclo roda e finaliza com lucro 0, avançando o estado.
- Ao finalizar um ciclo, o BOT registra:
  - evento de pausa/retomada (quando há transição analysis ↔ trade)
  - evento de lucro do ciclo (quando houver trade)

## Multi-contratos (30/90 dias úteis)
- Cada contrato tem seu próprio alvo diário, derivado do plano:
  - dailyTargetPct = roiTotal / duration
  - dailyTargetProfit = principal * (dailyTargetPct / 100)
- O BOT distribui o resultado do ciclo por contrato usando um breakdown por contrato.
- O registro dos ciclos no banco é por contrato (contract_id + day_key + cycle_index).

## Condições de parada
- Fim do dia útil:
  - quando a sequência diária do contrato termina, o contrato fica com status do dia = done.
  - ao atingir o fim do dia, o BOT para e só volta no próximo dia útil.
- Fim de semana:
  - sábado e domingo: status do dia = weekend e não há execução de ciclos de trade.

## Fonte do “dia” (banco)
- O dia usado pelo BOT vem do Postgres via função:
  - public.server_day_status()
- O dia retornado é o day_key do banco, não do relógio do navegador.

## Simulação de “próximo dia” (server-side)
- O botão “Simular Próximo Dia” incrementa um offset no banco (por usuário) e faz o server_day_status refletir o novo day_key.
- Funções envolvidas:
  - public.server_day_advance(step int)
  - public.server_day_reset()

## Persistência no banco (o que é gravado)
- plan_contracts: contratos do usuário (capital, status, progresso, etc.).
- bot_cycles: ciclo de 10min por contrato e por dia (trade/analysis, lucro alvo/aplicado, contagem de operações, timestamps).
- wallet_ledger: extrato de eventos financeiros e do BOT.

## Observações operacionais
- Se o usuário atualizar a página, o BOT deve continuar respeitando o day_key do banco e o estado do contrato.
- A UI pode mostrar “ANALISANDO” durante o modo analysis, mas não deve expor “rodada 1/3” ao cliente.
