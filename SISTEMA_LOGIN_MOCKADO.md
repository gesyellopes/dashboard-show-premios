# Sistema de Login Mockado - Guia de Teste

## 🚀 Como Testar o Sistema

O servidor está rodando em: **http://localhost:8080**

### Passo 1: Acessar a Aplicação
1. Abra o navegador
2. Acesse: `http://localhost:8080`
3. Você será automaticamente redirecionado para `/signin` (pois não está autenticado)

### Passo 2: Fazer Login
Escolha uma das credenciais abaixo e faça login:

#### Admin (todas as permissões)
- **Telefone:** `(11) 98765-4321`
- **Senha:** `admin123`

#### Gerente de Vendas (permissões de gerente)
- **Telefone:** `(11) 98765-4322`
- **Senha:** `manager123`

#### Gerente de Operações (permissões de gerente)
- **Telefone:** `(21) 98765-4323`
- **Senha:** `manager123`

### Passo 3: Após o Login
Após fazer login com sucesso, você será redirecionado para o **Dashboard**.

Você verá:
- ✅ Seu nome e avatar no canto superior direito do navbar
- ✅ Um dropdown menu com as opções:
  - "Minha Conta"
  - "Sair"

### Passo 4: Acessar "Minha Conta"
1. Clique no seu nome no navbar (canto superior direito)
2. Clique em "Minha Conta" no dropdown
3. Você será levado para a página de perfil

Na página de perfil você verá:
- ✅ Suas informações pessoais (nome, e-mail, departamento, telefone, localização)
- ✅ Seu role (função) no sistema
- ✅ Suas permissões
- ✅ Estatísticas da conta
- ✅ Tabela com todos os usuários de demonstração disponíveis
- ✅ Botão de "Sair"

### Passo 5: Testar Logout
1. Clique no botão "Sair" (vermelho) na página de perfil, OU
2. Clique no seu nome no navbar → "Sair"
3. Você será redirecionado para a página de login

### Passo 6: Testar Guard de Rotas
1. Faça logout
2. Tente acessar qualquer rota (ex: `http://localhost:8080/dashboard`)
3. Você será redirecionado automaticamente para `/signin`

## 📁 Arquivos Criados/Modificados

### Arquivos Novos:
- `src/mocks/users.js` - Dados dos usuários mockados
- `src/services/authService.js` - Serviço de autenticação
- `src/views/MyAccount.vue` - Página de perfil do usuário

### Arquivos Modificados:
- `src/router/index.js` - Adicionado guard de rotas e meta requiresAuth
- `src/views/Signin.vue` - Integrado com authService
- `src/examples/Navbars/Navbar.vue` - Dropdown de usuário logado

## 🔧 Funcionalidades Implementadas

✅ **Autenticação por Telefone:**
- Login com número de telefone formatado (XX) X XXXX-XXXX
- Máscara automática de telefone durante digitação
- Validação contra usuários pré-definidos
- Tokens gerados em Base64
- Armazenamento no localStorage

✅ **Guard de Rotas:**
- Todas as rotas (exceto /signin e /signup) requerem autenticação
- Redirecionamento automático para login se não autenticado
- Redirecionamento para dashboard se tentar acessar login já estando autenticado

✅ **Perfil do Usuário:**
- Página "Minha Conta" mostrando todas as informações do usuário
- Exibição de role e permissões
- Design seguindo o estilo Argon Dashboard

✅ **Logout:**
- Limpeza de token e dados do usuário
- Redirecionamento para login

✅ **Navbar Responsiva:**
- Mostra nome + avatar do usuário logado
- Dropdown menu com opções
- Link de acesso desaparece quando logado

✅ **Roles Simplificados:**
- Admin (acesso total)
- Manager (acesso gerente)

## 🎯 O que Testar

### Fluxo de Login
- [ ] Acessar página de login sem autenticação
- [ ] Tentar login com credenciais inválidas (deve mostrar erro)
- [ ] Login com credenciais válidas (deve redirecionar para dashboard)
- [ ] Verificar se o token foi salvo no localStorage

### Fluxo de Navegação
- [ ] Acesso a rotas protegidas sem autenticação (deve redirecionar para login)
- [ ] Acesso a rotas protegidas com autenticação (deve funcionar)
- [ ] Atualizar página sem perder autenticação (verificar localStorage)

### Página de Perfil
- [ ] Clicar em "Minha Conta" no navbar
- [ ] Verificar se os dados do usuário são exibidos
- [ ] Verificar role e permissões
- [ ] Clicar em logout da página de perfil

### Logout
- [ ] Fazer logout do dropdown
- [ ] Verificar se foi redirecionado para login
- [ ] Tentar acessar dashboard (deve redirecionar para login)
- [ ] Verificar se localStorage foi limpo

## 💡 Notas Importantes

- O sistema usa **dados mockados em memória** - não há API real
- Os tokens são gerados em Base64 e validados localmente
- Cada usuário tem um avatar gerado automaticamente via ui-avatars.com
- O sistema simula um delay de 500ms no login (para parecer mais real)
- Sem limite de sessão (você pode ficar logado indefinidamente)

## 🔐 Segurança

⚠️ **Este é um sistema de DEMONSTRAÇÃO!**

Não use para produção! Pontos importantes:
- Senhas estão em texto plano no código (não recomendado)
- Tokens não são validados por uma API real
- Sem proteção CSRF
- Sem rate limiting

Para produção, implemente:
- API real com validação de credenciais
- JWT tokens com expiração
- HTTPS obrigatório
- Rate limiting de login
- 2FA se necessário
