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

## Versão local/portátil (em implementação)

A versão portátil mantém as consultas de banco no computador do usuário, que
normalmente já possui acesso à VPN corporativa. O navegador abre o sistema em
`127.0.0.1`, enquanto Firebase e os recursos administrativos continuam na API
central.

- `apps/local-agent`: API local restrita a `127.0.0.1`, sem chave administrativa
  do Firebase.
- `portable/DB Compare.cmd`: iniciador que a distribuição Windows utilizará.
- `portable/README.txt`: formato da pasta entregue aos usuários.

Para desenvolvimento do agente, copie `apps/local-agent/.env.example` para
`apps/local-agent/.env`, informe a URL HTTPS da API central e execute:

```bash
npm run build:portable
npm run start:portable
```

O empacotamento final incluirá um runtime Node próprio, de modo que o usuário
não precisará instalar Node.js nem configurar uma API local manualmente.
