import { useState } from 'react'
import { X, Check, Download, FileType, File, Code } from 'lucide-react'

export type ExportFormat = 'docx' | 'pdf' | 'html'

interface ExportModalProps {
  onClose: () => void
  onExport: (format: ExportFormat) => void
}

const FORMATS: { value: ExportFormat; label: string; hint: string; icon: typeof File; color: string }[] = [
  { value: 'docx', label: 'Word (.docx)', hint: 'Documento editável', icon: FileType, color: 'blue' },
  { value: 'pdf', label: 'PDF', hint: 'Pronto para compartilhar', icon: File, color: 'red' },
  { value: 'html', label: 'HTML', hint: 'Página web', icon: Code, color: 'orange' },
]

const ICON_STYLES: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
}

export default function ExportModal({ onClose, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('docx')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 modal-content"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 id="export-title" className="text-lg font-semibold text-slate-800 dark:text-white">Exportar Documento</h3>
          <button onClick={onClose} aria-label="Fechar" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <fieldset className="p-4">
          <legend className="text-sm text-slate-600 dark:text-slate-400 mb-4">Escolha o formato de exportação:</legend>
          <div className="space-y-2">
            {FORMATS.map(({ value, label, hint, icon: Icon, color }) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${
                  format === value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={value}
                  checked={format === value}
                  onChange={() => setFormat(value)}
                  className="sr-only"
                />
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ICON_STYLES[color]}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800 dark:text-white">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
                </div>
                {format === value && <Check size={20} className="text-primary-600" />}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => onExport(format)}
            className="flex-1 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Exportar
          </button>
        </div>
      </div>
    </div>
  )
}
