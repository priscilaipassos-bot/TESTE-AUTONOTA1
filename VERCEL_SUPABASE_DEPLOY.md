# Guia de Hospedagem na Vercel & Armazenamento no Supabase

Este sistema **AutoNFS-e Federal** está 100% preparado e configurado para hospedagem na **Vercel** com persistência total de metadados no **Supabase**.

---

## 1. O que foi preparado no sistema

1. **`vercel.json`**: Configurado na raiz do projeto com direcionamento de rotas e rewrites do Vite SPA (`/*`) e de Serverless Functions (`/api/*`).
2. **`api/index.ts`**: Ponto de entrada nativo para **Vercel Serverless Functions**, processando geração de DANFSE em PDF, envio de e-mails com anexos via SMTP e transmissão oficial para o Notaas.
3. **`src/services/supabaseService.ts`**: Cliente Supabase nativo integrado, com suporte a:
   - Sincronização automática em tempo real (Auto-Save de notas, agendamentos, clientes e prestador).
   - Teste de conexão em tempo real diretamente pela interface.
   - Sincronização bidirecional (Envio em massa e Restauração da nuvem).
   - Fallback de cache local seguro via localStorage.
4. **Interface de Gerenciamento na Nuvem**: Uma aba exclusiva **"Vercel & Supabase"** no modal de Configurações (ícone de engrenagem) com diagnóstico, teste de ping, status e cópia de scripts.

---

## 2. Informações de Conexão do Supabase

As credenciais fornecidas já foram configuradas como padrão no sistema:

- **Supabase URL**: `https://gcpvceeaeyeufofntmwc.supabase.co` (ou `https://gcpvceeaeyeufofntmwc.supabase.co/rest/v1/`)
- **Supabase Anon / Publishable Key**: `sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3`
- **Tabela de Metadados**: `autonfse_metadata` (tabela exclusiva e isolada no seu banco Supabase)
- **Chave de Registro**: `autonfse_system_metadata`

---

## 3. Passo a Passo: Publicando na Vercel

### Opção A: Pelo painel web da Vercel (Recomendado)
1. Acesse [vercel.com](https://vercel.com) e faça login.
2. Clique em **Add New... > Project**.
3. Importe o repositório Git do projeto.
4. Na tela de configuração do projeto (**Configure Project**):
   - **Framework Preset**: Selecione `Vite` (ou deixe o padrão detectado).
   - **Build Command**: `vite build` (ou `npm run build`).
   - **Output Directory**: `dist`.
5. Em **Environment Variables**, adicione as seguintes variáveis:
   ```env
   VITE_SUPABASE_URL=https://gcpvceeaeyeufofntmwc.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3
   ```
6. Clique em **Deploy**.
7. Pronto! Em menos de 1 minuto seu sistema estará no ar com URL `https://seu-projeto.vercel.app`.

### Opção B: Pelo Vercel CLI (Terminal)
```bash
# 1. Instale o Vercel CLI (se ainda não tiver)
npm i -g vercel

# 2. Faça o login e o deploy
vercel
```

---

## 4. Variáveis de Ambiente Recomendadas

| Variável | Valor Padrão | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://gcpvceeaeyeufofntmwc.supabase.co` | URL da instância do Supabase |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3` | Chave de API de publicação |

---

## 5. Schema SQL Oficial para o Supabase (Tabela Exclusiva)

O sistema opera de forma 100% isolada na tabela exclusiva `autonfse_metadata` no seu Supabase:

```sql
-- Criar tabela dedicada para o AutoNFS-e
create table if not exists public.autonfse_metadata (
  user_id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Habilitar Row Level Security (RLS)
alter table public.autonfse_metadata enable row level security;

-- Criar políticas de acesso com a chave anon/publishable
create policy "Permitir leitura anon"
  on public.autonfse_metadata for select
  using (true);

create policy "Permitir insercao anon"
  on public.autonfse_metadata for insert
  with check (true);

create policy "Permitir atualizacao anon"
  on public.autonfse_metadata for update
  using (true);

create policy "Permitir exclusao anon"
  on public.autonfse_metadata for delete
  using (true);
```

---

## 6. Correções de Build & Vercel Aplicadas

1. **Resolução de Dependências (`ERESOLVE`)**:
   - Criado `.npmrc` com `legacy-peer-deps=true`.
   - Removido conflito de versão do `esbuild` em `devDependencies`.
   - Gerado `package-lock.json` oficial e consistente, eliminando falhas no passo `npm install` da Vercel.

2. **Compilação das Serverless Functions (`api/index.js` e `api/[...path].js`)**:
   - As funções de backend agora são pré-compiladas via `esbuild` durante o `npm run build` em um arquivo ESM nativo (`api/index.js`), eliminando erros de importação de módulos TypeScript (`ERR_MODULE_NOT_FOUND`) em ambiente Serverless.
   - Criado `api/[...path].js` com suporte nativo a *catch-all*, garantindo que qualquer rota (`/api/health`, `/api/danfse/pdf`, `/api/supabase/status`, `/api/send-email` e `/api/notaas/*`) seja processada diretamente pela Vercel sem erros 500.

3. **CORS e Cabeçalhos Notaas**:
   - Ajustados os cabeçalhos das requisições para a API Notaas para `Content-Type: application/json` e `x-api-key`, respeitando a política CORS oficial (`*`) e evitando o bloqueio *Failed to fetch* no navegador.

4. **Compatibilidade com Vite**:
   - Atualizado `vite.config.ts` com `import.meta.dirname` para compatibilidade total com o Vite em ambientes de CI/CD da Vercel.

