# AnySale Console

Console comercial do AnySale. É uma SPA React/Vite que autentica no Keycloak e consome o `anysale-lead-service`.

## Pré-requisitos

- Node.js LTS e npm;
- backend e infraestrutura Docker descritos no [guia de onboarding](../../backend/java/workspace_mm/anysale-parent/docs/onboarding.md);
- Keycloak local em `http://localhost:8180` e Lead Service em `http://localhost:8080`.

## Configuração

```powershell
Copy-Item .env.example .env.local
npm install
```

`.env.local` é local e não deve ser versionado:

| Variável | Desenvolvimento |
| --- | --- |
| `VITE_KEYCLOAK_URL` | `http://localhost:8180` |
| `VITE_KEYCLOAK_REALM` | `anysale-realm` |
| `VITE_KEYCLOAK_CLIENT_ID` | `anysale-console` |
| `VITE_LEAD_SERVICE_URL` | deixe vazia; o proxy Vite usa `http://localhost:8080` |

Não há chaves OpenAI, tokens Meta ou segredos de backend no Console.

## Executar

```powershell
npm run dev -- --host 127.0.0.1
```

Abra `http://localhost:5173`. O proxy `/api` é configurado em `vite.config.ts` e encaminha ao Lead Service local. Para uma URL externa de API, defina `VITE_LEAD_SERVICE_URL` conscientemente e configure CORS no backend.

## Verificar antes de enviar mudanças

```powershell
npm run build
npm run lint
```

## Funcionalidades

- login/logout pelo Keycloak;
- funil de leads e histórico de interações;
- atualização comercial e estágio do lead;
- envio manual de mensagem WhatsApp pelo backend;
- tela administrativa de IA para usuários com papel `ADMIN`.

As permissões são decididas pelo token Keycloak e validadas novamente pelo backend; o browser não escolhe tenant ou papel.
