import React, { useState } from 'react';
import { X, Copy, Check, Download, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: string[];
  totalAmount: number;
  onDownload: () => void;
  fileName: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  lines,
  totalAmount,
  onDownload,
  fileName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(lines.join('\r\n') + '\r\n');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const allLinesValidLength = lines.every((l) => l.length === 160);

  const formattedTotal = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#0b636e] border border-teal-400/40 rounded-lg shadow-2xl w-full max-w-5xl text-white max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-teal-500/40 flex items-center justify-between bg-[#08535c] shrink-0">
          <div>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <span>Prévisualisation du fichier AFB160</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono font-normal">
                {lines.length} lignes ({lines.length * 160} octets)
              </span>
            </h3>
            <p className="text-xs text-teal-200">
              Total contrôlé : <strong className="text-white">{formattedTotal} MGA</strong> | Fichier :{' '}
              <span className="font-mono">{fileName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Status Banner */}
        <div className="px-5 py-2.5 bg-black/20 border-b border-teal-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {allLinesValidLength ? (
              <span className="text-emerald-300 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Conformité validée : 100% des lignes comportent exactement 160 caractères (norme CFONB).
              </span>
            ) : (
              <span className="text-amber-300 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Certaines lignes diffèrent de 160 caractères.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-300">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le texte</span>
                </>
              )}
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1 bg-[#d32f2f] hover:bg-[#c62828] text-white px-3 py-1 rounded font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger</span>
            </button>
          </div>
        </div>

        {/* Monospace Code Preview */}
        <div className="p-4 overflow-auto flex-1 bg-[#051e22] font-mono text-xs text-gray-200 leading-relaxed select-all">
          {lines.map((line, idx) => {
            const code = line.slice(0, 2);
            let codeBadgeClass = 'bg-blue-900/60 text-blue-300';
            if (code === '03') codeBadgeClass = 'bg-amber-900/60 text-amber-300';
            if (code === '08') codeBadgeClass = 'bg-purple-900/60 text-purple-300';

            return (
              <div
                key={idx}
                className="flex items-start hover:bg-white/5 py-0.5 px-1 rounded transition-colors whitespace-pre"
              >
                <span className="text-gray-500 w-10 text-right pr-3 select-none">
                  {idx + 1}
                </span>
                <span className={`px-1 rounded text-[10px] mr-2 font-bold select-none ${codeBadgeClass}`}>
                  {code}
                </span>
                <span className="text-teal-200/90 tracking-wider">
                  {line}
                </span>
                <span className="text-gray-500 text-[10px] pl-3 select-none">
                  ({line.length}c)
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-teal-500/40 bg-[#08535c] flex justify-between items-center shrink-0">
          <span className="text-xs text-teal-200">
            Encodage : ASCII / ANSI bancaire standard • Sauts de ligne : CRLF (\r\n)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm font-medium transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
