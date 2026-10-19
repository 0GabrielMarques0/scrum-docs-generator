import { Link } from 'react-router-dom'
import { Sparkles, Layers, Edit3, FileType, Upload, ArrowRight, CheckCircle, Moon, Sun, Github, MessagesSquare, Image } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function LandingPage() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const features = [
    {
      icon: Upload,
      title: 'Envio de Prints',
      description: 'Arraste, cole ou envie os prints das telas do seu sistema',
    },
    {
      icon: Sparkles,
      title: 'Análise com IA',
      description: 'A IA analisa as telas e gera requisitos funcionais, não funcionais e regras de negócio',
    },
    {
      icon: Layers,
      title: 'Múltiplas Telas',
      description: 'Organize várias telas em projetos estruturados',
    },
    {
      icon: Edit3,
      title: 'Editor Rico',
      description: 'Edite requisitos com suporte completo a tabelas',
    },
    {
      icon: FileType,
      title: 'Exportar Word e PDF',
      description: 'Baixe a documentação formatada em Word, PDF ou HTML',
    },
    {
      icon: MessagesSquare,
      title: 'Dúvidas Antes de Escrever',
      description: 'A IA pergunta o que o print não mostra e usa suas respostas nos requisitos',
    },
  ]

  const benefits = [
    'Economize horas de trabalho manual',
    'Documentação padronizada e profissional',
    'Requisitos completos com regras de negócio',
    'Dúvidas levantadas antes de escrever os requisitos',
    'Histórico de projetos organizado',
    'Colaboração facilitada com a equipe',
  ]

  const steps = [
    { number: '1', title: 'Crie um projeto', description: 'Organize suas telas em projetos' },
    { number: '2', title: 'Envie os prints', description: 'Adicione as imagens de cada tela' },
    { number: '3', title: 'Responda as dúvidas', description: 'A IA pergunta e depois gera os requisitos' },
    { number: '4', title: 'Exporte', description: 'Baixe em Word, PDF ou HTML' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src="/specai_icon_transparent.svg" 
                alt="SpecAI" 
                className="w-9 h-9" 
              />
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">SpecAI</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <Link
                to="/login"
                className="text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
              >
                Entrar
              </Link>
              <Link
                to="/register"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-500 transition-colors"
              >
                Criar Conta
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Image className="text-primary-500" size={24} />
            <ArrowRight className="text-slate-400" size={20} />
            <Sparkles className="text-primary-500" size={24} />
            <ArrowRight className="text-slate-400" size={20} />
            <FileType className="text-primary-500" size={24} />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 dark:text-white mb-6">
            Transforme Prints de Telas em{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-purple-500">
              Documentação de Requisitos
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-10">
            Envie os prints das suas telas, responda as dúvidas que a IA levantar
            e receba requisitos funcionais, não funcionais e regras de negócio
            prontos para o time. Economize horas de trabalho manual.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-500 transition-all shadow-lg shadow-primary-600/25 hover:shadow-primary-500/40 flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Começar Gratuitamente
            </Link>
            <Link
              to="/login"
              className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-8 py-4 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all flex items-center justify-center gap-2"
            >
              Já tenho conta
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 px-4 bg-white dark:bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white text-center mb-12">
            Como Funciona
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center relative">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary-500 to-transparent" />
                )}
                <div className="bg-primary-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg shadow-primary-600/30">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white text-center mb-4">
            Funcionalidades
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Tudo que você precisa para gerar documentação de requisitos profissional
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-lg transition-all group"
                >
                  <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
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
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-12">
            Por que usar o SpecAI?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg px-5 py-4 text-left"
              >
                <CheckCircle className="text-green-300 flex-shrink-0" size={22} />
                <span className="text-white font-medium">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Crie sua conta gratuitamente e comece a gerar documentação de requisitos em minutos.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-500 transition-all shadow-lg shadow-primary-600/25"
          >
            <Sparkles size={20} />
            Criar Conta Grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/specai_icon_transparent.svg" alt="SpecAI" className="w-6 h-6" />
            <span className="text-slate-600 dark:text-slate-400 text-sm">
              SpecAI © {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a 
              href="https://github.com/0GabrielMarques0/scrum-docs-generator" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-2"
            >
              <Github size={18} />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
