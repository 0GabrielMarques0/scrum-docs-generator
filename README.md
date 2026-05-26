# 📋 SpecAI - Gerador de Documentação Scrum

Plataforma para geração automática de documentação de requisitos a partir do Figma usando IA.

## 🌐 Demo

- **Frontend:** https://scrum-docs-generator.vercel.app
- **Backend:** https://scrum-docs-generator-production.up.railway.app

## 🚀 Funcionalidades

- ✅ Autenticação completa (login, cadastro, recuperação de senha)
- ✅ Gerar requisitos de tela única com IA (GPT-4o)
- ✅ Gerar requisitos de múltiplas telas em lote
- ✅ Editor rico com suporte a tabelas (TinyMCE)
- ✅ Salvar histórico de projetos
- ✅ Exportar como DOCX
- ✅ Integração com GitHub (criar arquivos no repo)
- ✅ Envio de email para recuperação de senha (Resend)

## 🏗️ Arquitetura

```
scrum-docs-generator/
├── frontend/          # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── backend/           # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── database/
│   │   ├── services/
│   │   ├── routes/
│   │   └── types/
│   └── package.json
└── README.md
```

## 🔧 Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, TinyMCE |
| Backend | Node.js, Express, TypeScript |
| Database | MySQL (Railway) |
| IA | GitHub Models API (GPT-4o) |
| Email | Resend |
| Deploy | Vercel (frontend) + Railway (backend) |

## 🚀 Quick Start

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔑 Configuração

Crie um arquivo `.env` no backend:

```env
# Server
PORT=3001
NODE_ENV=development

# Database (MySQL)
DATABASE_URL=mysql://user:pass@host:3306/database

# JWT
JWT_SECRET=your-secret-key

# GitHub Models API (para IA)
GITHUB_TOKEN=your_github_token

# Email (Resend - opcional)
RESEND_API_KEY=re_xxxxxxxxx
```

## 📡 API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Cadastro |
| POST | `/api/auth/forgot-password` | Recuperar senha |
| POST | `/api/auth/change-password` | Alterar senha |
| GET | `/api/auth/me` | Dados do usuário |

### Projetos e Requisitos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/projects` | Lista projetos |
| POST | `/api/projects` | Criar projeto |
| GET | `/api/projects/:id` | Detalhes do projeto |
| DELETE | `/api/projects/:id` | Excluir projeto |
| POST | `/api/screens` | Adicionar tela |
| PUT | `/api/screens/:id` | Atualizar tela |
| DELETE | `/api/screens/:id` | Excluir tela |
| POST | `/api/requirements/generate` | Gerar requisitos (IA) |

### Exportação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/export/docx/:id` | Exportar como DOCX |
| POST | `/api/github/commit` | Criar arquivos no GitHub |

## 🚀 Deploy

### Vercel (Frontend)
1. Conecte o repositório
2. Configure:
   - Build Command: `cd frontend && npm run build`
   - Output Directory: `frontend/dist`
   - Root Directory: `/`
3. Adicione variável: `VITE_API_URL=https://seu-backend.railway.app`

### Railway (Backend)
1. Conecte o repositório
2. Configure Root Directory: `backend`
3. Adicione as variáveis de ambiente do `.env`
4. Crie um banco MySQL e copie a `DATABASE_URL`

## 📄 Licença

MIT
