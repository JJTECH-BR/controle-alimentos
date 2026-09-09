# Controle de Alimentação — Prefeitura de Itaberá

Projeto React criado a partir da lista de Agricultura Familiar, Pregão 05/2026, planilha de empenhos de carnes e logo fornecidos.

## Executar
1. Instale Node.js 18+
2. No terminal: `npm install`
3. Depois: `npm run dev`

## Produção com duas usuárias
A versão entregue já funciona localmente para testar o fluxo e grava os dados no navegador. Para as duas funcionárias utilizarem os mesmos dados em computadores diferentes, configure um projeto Supabase:

1. Crie um projeto no Supabase.
2. Execute `supabase-schema.sql` no SQL Editor.
3. Copie `.env.example` para `.env`.
4. Preencha URL e ANON KEY.
5. Conecte as operações do front-end aos serviços do Supabase e habilite Auth/RLS para as duas usuárias.

## Funcionalidades já implementadas
- Login visual
- Dashboard
- Produtos em ordem alfabética
- Busca sem depender de acentos
- Categorias e fornecedores
- Entrada e saída de estoque
- Bloqueio de saída maior que o estoque
- Histórico com usuário/data/hora/observação
- Controle mensal
- Controle de empenhos de carnes baseado na planilha enviada
- Cadastro de novos produtos
- Layout responsivo

## Observação
Os dados de entrada podem ser ampliados a partir dos arquivos originais. A estrutura foi pensada para não criar uma nova coluna por semana: cada recebimento é um registro separado, permitindo consultas futuras por semana e mês.
