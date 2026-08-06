# 🚀 Guia Completo de Setup

## O que você vai precisar

- Uma conta de e-mail (pode ser a do Gmail mesmo)
- 5 minutos
- Um computador para fazer o setup (depois usa no celular)

---

## ✅ Etapa 1: Criar Banco de Dados no Supabase

### 1.1 Criar conta

1. Abra [supabase.com](https://supabase.com)
2. Clique em **Start your project** (botão grande verde)
3. Clique em **Continue with GitHub** ou **Continue with Google**
4. Siga o fluxo de criar conta

### 1.2 Criar projeto

1. Clique em **New Project**
2. Escolha um nome (ex: `controle-financeiro`)
3. Crie uma senha (vai usar depois)
4. Escolha região mais próxima
5. Clique em **Create new project**
6. **Aguarde 2-3 minutos** enquanto cria o projeto

### 1.3 Criar tabela

Quando carregar:

1. No menu esquerdo, vá em **SQL Editor** (ícone de código)
2. Clique em **New query**
3. **Copie e cole** isso no editor:

```sql
create table families (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  data jsonb default '{}',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table families enable row level security;

create policy "Anyone can read families" on families for select using (true);
create policy "Anyone can create families" on families for insert with check (true);
create policy "Anyone can update families" on families for update using (true);
```

4. Clique em **Run** (botão com ícone de play)
5. Pronto! ✅

### 1.4 Copiar credenciais

1. No menu esquerdo, vá em **Settings** (ícone de engrenagem, lá na base)
2. Clique em **API**
3. Você vai ver duas coisas. **Salve em um arquivo de texto:**
   - **Project URL** (algo como `https://xxxxx.supabase.co`) → copie
   - **anon public** (uma string bem longa) → copie

**Guarde esses dois valores — você vai precisar em seguida.**

---

## ✅ Etapa 2: Fazer Upload Pra GitHub

GitHub é onde você guarda o código. Vercel vai ler de lá.

### 2.1 Criar repositório no GitHub

1. Abra [github.com](https://github.com)
2. Faça login (ou crie conta)
3. Clique no **+** (canto superior direito) → **New repository**
4. Nome: `controle-financeiro`
5. **NÃO marque** "Add a README"
6. Clique em **Create repository**

### 2.2 Adicionar os arquivos

Depois que criar, GitHub mostra um comando. **Ignore aquilo.**

Em vez disso:

1. Clique no botão **<> Code** (verde)
2. Clique em **HTTPS**
3. Copie o link (tipo `https://github.com/seu-user/controle-financeiro.git`)
4. Abra um terminal no seu computador
5. Rode isso (substitua o link):

```bash
git clone https://github.com/seu-user/controle-financeiro.git
cd controle-financeiro
```

### 2.3 Copiar arquivos do projeto

1. Você recebeu estes arquivos:
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - `.env.example`
   - `.gitignore`
   - `vercel.json`
   - `README.md`
   - `SETUP.md`
   - `src/` (pasta com 5 arquivos JSX)

2. **Copie tudo** pra dentro da pasta `controle-financeiro` que você clonou

3. No terminal, na pasta, rode:

```bash
git add .
git commit -m "primeiro commit"
git push
```

Pronto! GitHub tá atualizado. ✅

---

## ✅ Etapa 3: Deploy no Vercel

Vercel vai ler seu código do GitHub e hospedar na internet.

### 3.1 Conectar Vercel

1. Abra [vercel.com](https://vercel.com)
2. Clique em **Sign Up** (ou login se tiver)
3. Escolha **Continue with GitHub**
4. Autorize Vercel a acessar GitHub

### 3.2 Criar novo projeto

1. No Vercel, clique em **Add New** → **Project**
2. Selecione o repositório `controle-financeiro`
3. Clique em **Import**

### 3.3 Adicionar variáveis de ambiente

Antes de fazer deploy, precisa adicionar aquelas credenciais do Supabase:

1. Você vai ver uma seção **Environment Variables**
2. Clique em **Add** e adicione:

| Nome | Valor |
|------|-------|
| `VITE_SUPABASE_URL` | (aquele Project URL que você copiou) |
| `VITE_SUPABASE_ANON_KEY` | (aquela chave anônima bem longa) |

3. Clique em **Deploy**

### 3.4 Aguardar

Vercel vai:
1. Baixar seu código do GitHub
2. Instalar dependências
3. Fazer build
4. Hospedar

Demora uns 2-3 minutos. Quando terminar, aparece um link tipo:
```
https://seu-projeto.vercel.app
```

**Pronto! 🎉 Seu site tá ao vivo!**

---

## ✅ Etapa 4: Usar

### 4.1 Primeira vez (você)

1. Abra aquele link no navegador (no celular ou computador)
2. Coloca um código de família (ex: `ABC123`)
3. Clica em **Entrar**
4. Preencha:
   - Ganhos (seu salário + salário da esposa)
   - Contas fixas
   - Contas variáveis
5. Clique em **"Começar a valer em"** e escolha o mês certo

### 4.2 Sua esposa entra

1. Ela abre o **MESMO link**
2. Coloca o **MESMO código**
3. Clica em **Entrar**
4. Vê tudo que você preencheu
5. Agora tudo sincroniza em tempo real

### 4.3 Lance gastos

Toda vez que um gasta algo:
1. Na tabela diária, coloca o valor na coluna "Gasto avulso"
2. Escolhe a categoria
3. O outro vê na hora (sincroniza automaticamente)

---

## 🎯 Pronto!

Seu controle financeiro tá rodando. Daqui pra frente:

- Acessam via link do Vercel
- Usam o código de família pra conectar
- Tudo sincroniza em tempo real
- Sem arquivo pra enviar, sem perder dados

## 📱 Opcional: Salvar Como App

Se quiser, pode deixar como "app" no celular:

**iPhone (Safari):**
1. Abra o link
2. Clique no botão de Compartilhar (canto inferior)
3. Clique em **Adicionar à Tela Inicial**

**Android (Chrome):**
1. Abra o link
2. Menu (3 pontos) → **Instalar app**

Pronto! Ícone fica na tela inicial como um app de verdade.

---

## 🆘 Se der erro

### "Invalid API key"
→ Verifique se copiou a chave certo no `.env`

### "Cannot find families table"
→ Verifique se criou a tabela SQL no Supabase

### "Erro ao conectar"
→ Código tá certo? (sem espaços, maiúscula/minúscula)

### Deploy falhou no Vercel
→ Verifique se todos os arquivos foram fazer upload no GitHub

---

**Pronto! Qualquer dúvida, me chama. 💬**
