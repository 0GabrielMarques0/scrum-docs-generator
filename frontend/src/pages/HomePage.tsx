import { Link } from 'react-router-dom'
import { Sparkles, Layers, Edit3, FileType, Eye, Upload } from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: Upload,
      title: 'Upload de Prints',
      description: 'Faça upload de prints das telas do seu sistema para gerar requisitosfuncionais',
    },
    {
      icon: Sparkles,
      title: 'Análise com IA',
      description: 'Inteligência artificial analisa as imagens e gera requisitos funcionais e não funcionais',
    },
    {
      icon: Layers,
      title: 'Múltiplas Telas',
      description: 'Documente várias telas e combine tudo em um único documento estruturado',
    },
    {
      icon: Edit3,
      title: 'Editor Visual',
      description: 'Edite os requisitos gerados com um editor visual fácil de usar',
    },
    {
      icon: FileType,
      title: 'Exportar Word/PDF',
      description: 'Baixe seus documentos em formato Word (.docx) ou PDF',
    },
    {
      icon: Eye,
      title: 'Preview em Tempo Real',
      description: 'Visualize o documento formatado enquanto edita',
    },
  ]

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Hero Section */}
      <section className="text-center py-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="text-primary-500" size={28} />
          <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-3 py-1 rounded-full text-sm font-medium">
            Powered by AI
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-white mb-4">
          Transforme Telas em <span className="text-primary-600 dark:text-primary-400">Requisitos</span>
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8">
          Faça upload de prints das suas telas e deixe a inteligência artificial
          gerar documentação de requisitos profissional automaticamente.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/projects"
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Sparkles size={20} />
            Começar Agora
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white text-center mb-8">
          Funcionalidades
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-stagger">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-lg transition-all"
              >
                <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white text-center mb-8">
          Como Funciona
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="bg-primary-600 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              1
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Crie um Projeto</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Dê um nome ao seu projeto para organizar as telas
            </p>
          </div>
          <div className="text-center">
            <div className="bg-primary-600 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              2
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Upload de Prints</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Faça upload dos prints das telas e a IA analisa automaticamente
            </p>
          </div>
          <div className="text-center">
            <div className="bg-primary-600 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              3
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Edite e Salve</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Revise os requisitos gerados, edite se necessário e salve
            </p>
          </div>
          <div className="text-center">
            <div className="bg-primary-600 text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold">
              4
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Exporte</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Baixe o documento completo em Word ou PDF
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
