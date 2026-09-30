# Controle de Alimentação — Prefeitura de Itaberá

Aplicação React/Vite para controle de produtos, estoque, movimentações, contratos, anexos pequenos e auditoria. A persistência compartilhada usa **Firebase Authentication e Cloud Firestore**, sem Firebase Storage.

## Executar
1. Instale Node.js 18 ou superior.
2. Execute `npm install`.
3. Configure o Firebase conforme as instruções abaixo.
4. Execute `npm run dev`.

## Configurar o Firebase
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e registre um aplicativo Web.
2. Em **Authentication > Sign-in method**, habilite **E-mail/senha**. Desabilite a criação pública de contas; cadastre manualmente as duas usuárias em **Authentication > Users**.
3. Crie o banco em **Firestore Database**. Não é necessário criar Firebase Storage.
4. Copie `.env.example` para `.env` e preencha os cinco valores `VITE_FIREBASE_*` com as configurações do aplicativo Web em **Project settings > General > Your apps**. `VITE_FIREBASE_STORAGE_BUCKET` não é usado. Reinicie o Vite depois de alterar o `.env`.
5. Publique `firestore.rules` pelo Firebase Console ou Firebase CLI (`firebase deploy --only firestore:rules`).
6. Para cada usuária, copie o UID em Authentication e crie em Firestore o documento `allowed_users/{UID}` com o campo booleano `active: true`. As regras negam acesso a usuários sem esse documento.

As configurações do aplicativo Web (incluindo `apiKey`) identificam o projeto, mas não substituem as regras. Nunca coloque uma chave de conta de serviço/Admin SDK no navegador. Mantenha o cadastro público de usuários desabilitado e autorize somente as contas necessárias.

## Dados e migração do Supabase
O código desta versão grava novos dados no Firebase; **a troca de backend não copia automaticamente o conteúdo que já está no Supabase**. Antes de colocar em produção, faça backup/exportação das tabelas `products`, `categories`, `suppliers`, `stock_movements`, `balance_movements`, `orders`, `receipts`, `balance_contracts` e `audit_logs`. Importe e confira os documentos no Firestore antes de deixar de usar o Supabase.

As coleções Firestore usam os nomes acima e mantêm os campos em `snake_case`; documentos de produto precisam conservar um `id` numérico e usar esse número como ID do documento. PDFs e imagens pequenos são codificados em Base64 na coleção `movement_attachments`, dentro do Firestore. O limite do app é 700 KiB por arquivo para ficar abaixo do limite de 1 MiB por documento do Firestore; arquivos maiores não serão aceitos. Isso consome a cota de armazenamento e leitura/escrita do Firestore. O contador de novos produtos começa em 10001; ao importar produtos, crie também `system/product-counter` com `{ "value": maiorIdImportado }` se algum ID importado puder alcançar esse intervalo.

O arquivo `supabase-schema.sql` foi mantido apenas como referência do backend antigo; não é usado pelo app Firebase. Dados locais existentes no navegador também não são enviados automaticamente para a nuvem.

## Funcionalidades conectadas
- Login por e-mail e senha com Firebase Authentication.
- Produtos, categorias, fornecedores, contratos, movimentações e auditoria no Cloud Firestore.
- Atualização em tempo real por listeners do Firestore.
- Registro transacional de movimentação e atualização de estoque.
- Anexos pequenos guardados e protegidos no Firestore (PDF/imagem, até 700 KiB).
- Regras de acesso autenticado e lista de usuárias autorizadas.

## Funcionalidades da aplicação
- Dashboard e busca de produtos sem distinção de acentos.
- Cadastro/edição de produtos, fornecedores e estoque.
- Histórico de movimentações com observações e anexos.
- Controle de saldo e contratos.
- Layout responsivo.
