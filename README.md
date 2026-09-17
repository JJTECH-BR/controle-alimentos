# Controle de Alimentação — Prefeitura de Itaberá

Projeto React criado a partir da lista de Agricultura Familiar, Pregão 05/2026, planilha de empenhos de carnes e logo fornecidos.

## Executar
1. Instale Node.js 18+
2. No terminal: `npm install`
3. Depois: `npm run dev`

## Produção com duas usuárias
A versão entregue funciona localmente para testar o fluxo e grava os dados no navegador. Para as duas funcionárias utilizarem os mesmos dados em computadores diferentes, é necessário criar uma conta gratuita no [Supabase](https://supabase.com), criar um projeto e:

1. Execute `supabase-schema.sql` no SQL Editor.
2. Em **Authentication > Users**, crie as duas usuárias com e-mail e senha.
3. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em **Project Settings > API**.
4. Reinicie o servidor Vite para carregar as variáveis.
5. Cadastre os produtos, categorias e fornecedores no banco (ou importe-os pelo Table Editor).

O script SQL também cria a função transacional usada para registrar movimentações e o bucket privado `movement-attachments` usado para fotos e PDFs. Execute o arquivo novamente para criar o bucket, as políticas e atualizar o cache de schema da API. O frontend mantém uma compatibilidade temporária para concluir o registro caso a função ainda não tenha sido publicada.

Nunca use a `service_role key` no front-end. A chave anon é segura para o navegador somente com RLS configurado.

Quando o `.env` estiver vazio, o sistema exibe o modo local. Com as duas variáveis preenchidas, o login passa a usar o Supabase Auth e produtos/movimentações passam a ser compartilhados.

### O que já está integrado
- Login com e-mail e senha via Supabase Auth.
- Carregamento de produtos e movimentações do banco.
- Registro de entradas, saídas e atualização do estoque no banco.
- RLS para exigir usuário autenticado.

### Próximas etapas recomendadas
- Migrar o cadastro de produto e os controles semanal/mensal para tabelas do Supabase.
- Criar uma tabela `profiles` para restringir o acesso exatamente às duas funcionárias.
- Importar a lista inicial de produtos para `categories`, `suppliers` e `products`.

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
