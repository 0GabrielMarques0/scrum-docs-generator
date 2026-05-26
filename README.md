# 📋 Scrum Docs Generator

Plataforma para geração automática de documentação de requisitos a partir do Figma.

## 🚀 Funcionalidades

- ✅ Gerar requisitos de tela única
- ✅ Gerar requisitos de múltiplas telas em lote
- ✅ Salvar histórico de projetos
- ✅ Exportar como PDF
- ✅ Integração com GitHub (criar arquivos no repo)

## 🏗️ Arquitetura

```
scrum-docs-generator/
├── frontend/          # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── backend/           # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── types/
│   └── package.json
└── README.md
```

## 🔧 Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (dev) / PostgreSQL (prod) |
| APIs | Figma REST API, GitHub REST API |
| PDF | PDFKit ou Puppeteer |

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
# Figma
FIGMA_ACCESS_TOKEN=your_figma_token

# GitHub
GITHUB_TOKEN=your_github_token

# Database
DATABASE_URL=sqlite:./database.sqlite

# Server
PORT=3001
```

## 📡 API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/figma/parse` | Extrai dados de um arquivo Figma |
| POST | `/api/requirements/generate` | Gera requisitos de uma tela |
| POST | `/api/requirements/batch` | Gera requisitos de múltiplas telas |
| GET | `/api/projects` | Lista projetos salvos |
| POST | `/api/github/commit` | Cria arquivos no GitHub |
| GET | `/api/export/pdf/:id` | Exporta requisitos como PDF |

## 📄 Licença

MIT
