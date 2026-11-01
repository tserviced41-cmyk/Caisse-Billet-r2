import React from 'react';
import { Landmark, HelpCircle, FileSpreadsheet, FileText, Download, Eye, FileDown, LogOut } from 'lucide-react';

interface HeaderProps {
  onOpenHelp: () => void;
  onOpenExcelImport: () => void;
  onOpenAfbImport: () => void;
  onGenerateAfb: () => void;
  onPreview: () => void;
  onDownloadTemplate: () => void;
  operationsCount: number;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHelp,
  onOpenExcelImport,
  onOpenAfbImport,
  onGenerateAfb,
  onPreview,
  onDownloadTemplate,
  operationsCount,
  onLogout,
}) => {
  return (
    <header className="text-white pb-3">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between border-b border-teal-600/60 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
            <Landmark className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Création de fichier de virement (AFB160)
            </h1>
            <p className="text-xs text-teal-100/80">
              Format standard CFONB / AFB 160 - Norme bancaire de télétransmission
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            title="Consulter l'aide sur le format AFB160 et l'importation"
          >
            <HelpCircle className="w-5 h-5 text-teal-200" />
            <span>Aide</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-200 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            title="Se déconnecter de la session"
          >
            <LogOut className="w-4 h-4 text-red-300" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Main Action Buttons Matching Screenshots */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Excel Import */}
        <button
          onClick={onOpenExcelImport}
          className="flex items-center gap-2 bg-[#388e3c] hover:bg-[#2e7d32] active:bg-[#1b5e20] text-white font-medium px-4 py-2.5 rounded shadow-sm hover:shadow transition-all cursor-pointer text-sm"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Importer un fichier Excel</span>
        </button>

        {/* AFB160 Import */}
        <button
          onClick={onOpenAfbImport}
          className="flex items-center gap-2 bg-[#2e9e44] hover:bg-[#258237] active:bg-[#1c642a] text-white font-medium px-4 py-2.5 rounded shadow-sm hover:shadow transition-all cursor-pointer text-sm"
        >
          <FileText className="w-4 h-4" />
          <span>Importer un fichier AFB160</span>
        </button>

        {/* Generate AFB160 */}
        <button
          onClick={onGenerateAfb}
          className="flex items-center gap-2 bg-[#d32f2f] hover:bg-[#c62828] active:bg-[#b71c1c] text-white font-semibold px-5 py-2.5 rounded shadow-sm hover:shadow-md transition-all cursor-pointer text-sm"
        >
          <Download className="w-4 h-4" />
          <span>Générer le fichier AFB160</span>
        </button>

        {/* Right side utility buttons */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onPreview}
            disabled={operationsCount === 0}
            className="flex items-center gap-1.5 bg-teal-800/80 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded transition-colors cursor-pointer"
            title="Prévisualiser le texte brut généré à 160 caractères par ligne"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Prévisualiser</span>
          </button>

          <button
            onClick={onDownloadTemplate}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-2 rounded transition-colors cursor-pointer"
            title="Télécharger un modèle Excel prêt à l'emploi"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Modèle Excel</span>
          </button>
        </div>
      </div>
    </header>
  );
};
