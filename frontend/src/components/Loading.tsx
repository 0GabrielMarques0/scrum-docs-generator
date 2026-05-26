interface LoadingProps {
  message?: string
}

export default function Loading({ message = 'Carregando...' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
      <img 
        src="/specai_icon_transparent_128x128.png" 
        alt="Loading" 
        className="w-16 h-16 animate-pulse-scale"
      />
      <p className="mt-4 text-slate-500 dark:text-slate-400 animate-pulse">{message}</p>
    </div>
  )
}
