# Controle Financeiro Familiar 💰

Plataforma web compartilhada para casal controlar finanças em tempo real, com sincronização automática entre celulares.

## ✨ Características

- ✅ **Sincronização em tempo real** — mudanças aparecem nos dois celulares simultaneamente
- ✅ **Responsivo** — funciona perfeito no celular (iOS e Android)
- ✅ **Sem login** — usa um código de família compartilhado
- ✅ **Grátis** — hospedagem e banco de dados gratuitos
- ✅ **Privado** — apenas vocês dois acessam com o código

## 🚀 Setup Rápido (5 minutos)

### Passo 1: Criar conta no Supabase (banco de dados)

1. Vá para [supabase.com](https://supabase.com) e clique em "Start your project"
2. Crie uma conta (pode usar GitHub ou Google)
3. Crie um novo projeto (deixe as opções padrão)
4. Aguarde carregar (demora ~2 min)

### Passo 2: Criar a tabela no Supabase

1. No Supabase, vá para **SQL Editor** (ícone de código no menu esquerdo)
2. Clique em **New Query**
3. Cole isso:

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

4. Clique em **Run** (ícone de play)

### Passo 3: Copiar credenciais do Supabase

1. Clique em **Settings** (ícone de engrenagem)
2. Vá para **API**
3. Copie:
   - **Project URL** (URL do projeto)
   - **anon public** (chave anônima)

### Passo 4: Fazer o deploy no Vercel

1. Faça upload deste projeto pra um repositório GitHub:
   - Crie um repo chamado `controle-financeiro`
   - Faça upload dos arquivos

2. Vá para [vercel.com](https://vercel.com)
3. Clique em **New Project**
4. Selecione o repositório que você criou
5. Clique em **Environment Variables**
6. Adicione:
   - `VITE_SUPABASE_URL` = (URL do Supabase)
   - `VITE_SUPABASE_ANON_KEY` = (chave anônima)
7. Clique em **Deploy**

Pronto! Você ganha um link tipo `https://seu-projeto.vercel.app`

### Passo 5: Usar no celular

1. **Você:**
   - Abre o link no navegador do celular
   - Coloca um código (ex: ABC123)
   - Clica em **Entrar**
   - Preenche os ganhos, contas fixas e variáveis

2. **Sua esposa:**
   - Abre o mesmo link
   - **Usa o MESMO código**
   - Vê tudo que você preencheu
   - Pode lançar gastos em tempo real

## 📱 Usando no Celular

### Melhor experiência:
- Salve o link como atalho na tela inicial (iOS e Android)
- Abre como um app nativo

**iOS:**
1. Abra o Safari → clique em Compartilhar
2. Clique em **Adicionar à Tela Inicial**

**Android:**
1. Abra o Chrome → menu de 3 pontos
2. Clique em **Instalar app**

## 🔑 Como Compartilhar o Código

O código funciona assim:
- Ambos usam o MESMO código
- Primeiro a entrar **cria** a família
- Segundo a entrar **entra** na família existente
- Depois isso, tudo sincroniza automaticamente

**Exemplo:**
- Você entra com código `ABC123` → cria
- Esposa entra com código `ABC123` → conecta à sua
- Vocês veem os mesmos dados
- Quando um adiciona um gasto, o outro vê na hora

## 🛠️ Estrutura de Arquivos

```
.
├── package.json          # Dependências
├── vite.config.js        # Config do Vite
├── index.html            # HTML raiz
├── .env.example          # Variáveis de exemplo
└── src/
    ├── main.jsx          # Entry do React
    ├── index.css         # Estilos globais
    ├── App.jsx           # Login e setup
    ├── TelaLogin.jsx     # Tela de entrada
    └── ControleDiario.jsx # Controle principal
```

## 📝 Funcionalidades

### Seções principais:
1. **Ganhos** — salários seus e da esposa
2. **Contas Fixas** — aluguel, contas, etc
3. **Contas Variáveis** — cartão, viagem, etc
4. **Grade Diária** — lance gastos avulsos
5. **Categorias** — agrupa gastos por tipo
6. **Fechamento** — saldo final de cada mês

### Cálculos:
- **Base por dia** = (Ganhos − Contas Fixas) ÷ dias do mês
- **Saldo** = acumula entrada − saída dia a dia
- O mês inicial é escolhível (antes disso fica zerado)

## 🚨 Se Algo Der Errado

**"Erro ao conectar":**
- Verifique o código (sem espaços)
- Verifique se as variáveis de ambiente estão certas

**"Erro ao salvar no servidor":**
- Verifique internet
- Tente recarregar

**Dados não sincronizam:**
- Aguarde 1-2 segundos (debounce)
- Recarregue a página se necessário

## 🔒 Privacidade

- Código não é secreto — qualquer um com ele pode acessar
- Não compartilhe o link público em redes sociais
- Supabase é GDPR compliant
- Dados são seus — pode pedir exclusão a qualquer hora

## 💡 Dicas

- Escolha um código que vocês lembrem
- Preencha os valores fixos primeiro
- Lance gastos toda noite (mais fácil que acumular)
- Use o celular mesmo — responsivo top
- Compartilhe o link via WhatsApp ou iMessage

## 📧 Suporte

Se tiver dúvidas:
- Verifique se está com internet
- Tente recarregar a página
- Verifique console (F12 > Console) pra ver erros

---

**Feito com ❤️ para casar com harmonia financeira.**
