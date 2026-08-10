# DB Compare

Aplicação web para comparar parâmetros entre Oracle, SQL Server e PostgreSQL.

## Estrutura

- `apps/web`: interface React/React Native Web com Firebase Authentication e Firestore.
- `apps/api`: API Node que testa conexões e executa as consultas. Os drivers de banco e as senhas ficam somente aqui.

## Primeiro uso

1. Copie `apps/api/.env.example` para `apps/api/.env` e informe a chave de serviço do Firebase e a URL permitida do web.
2. Copie `apps/web/.env.example` para `apps/web/.env` e informe a configuração pública do Firebase e a URL da API.
3. Instale as dependências com `npm install`.
4. Inicie em dois terminais: `npm run dev:api` e `npm run dev`.
5. Crie no Firebase Authentication o usuário `SPCARLA` (use um e-mail técnico, por exemplo `spcarla@dbcompare.local`) e execute a criação do perfil administrativo pelo endpoint documentado em `apps/api/src/seed-admin.ts`.

> A senha inicial solicitada não é versionada nem exibida pelo sistema. Defina-a no Firebase Authentication durante o provisionamento e altere-a no primeiro acesso.

## Segurança

- Nunca exponha portas, hosts ou senhas de banco ao bundle web.
- Em produção, proteja a API com HTTPS, um proxy reverso, rate limiting e allowlist de redes/hosts de banco.
- Configure as regras do Firestore em `firebase/firestore.rules` antes de publicar.
