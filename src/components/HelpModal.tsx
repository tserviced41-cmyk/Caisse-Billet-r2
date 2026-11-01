import React from 'react';
import { X, HelpCircle, FileSpreadsheet, CheckCircle2, FileText, Download } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadTemplate: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onDownloadTemplate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#0b636e] border border-teal-400/40 rounded-lg shadow-2xl w-full max-w-3xl text-white max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-teal-500/40 flex items-center justify-between bg-[#08535c] shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-teal-200" />
            <h3 className="font-bold text-lg text-white">
              Guide d'utilisation - Fichier AFB160 & Importation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-teal-50 leading-relaxed">
          {/* Section 1: Qu'est-ce que le format AFB160 ? */}
          <div className="bg-white/5 border border-teal-400/30 p-4 rounded-lg space-y-2">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-300" />
              1. Qu'est-ce que la norme AFB160 (CFONB) ?
            </h4>
            <p>
              Le format <strong>AFB160</strong> (ou CFONB 160) est le standard bancaire officiel utilisé
              pour les remises de virements collectifs (salaires, fournisseurs, etc.). Chaque ligne
              du fichier texte comporte <strong>rigoureusement 160 caractères</strong> avec retours à la
              ligne standard (CRLF) :
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-teal-100">
              <li>
                <strong>Ligne 03 :</strong> En-tête / Donneur d'ordre (compte à débiter, montant total, date
                d'exécution, raison sociale).
              </li>
              <li>
                <strong>Lignes 06 :</strong> Lignes de détail pour chaque virement unitaire
                (bénéficiaire, RIB complet, montant individuel, libellé du virement).
              </li>
              <li>
                <strong>Ligne 08 :</strong> Totalisateur / Fin de remise (contrôle de cohérence avec le
                total des montants).
              </li>
            </ul>
          </div>

          {/* Section 2: Structure du RIB */}
          <div className="bg-white/5 border border-teal-400/30 p-4 rounded-lg space-y-2">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              2. Composition du RIB Bancaire (23 caractères)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs mt-2 font-mono">
              <div className="bg-white/10 p-2 rounded">
                <div className="font-bold text-emerald-300">Banque</div>
                <div className="text-gray-200">5 chiffres</div>
                <div className="text-[10px] text-teal-300">Ex: 00005</div>
              </div>
              <div className="bg-white/10 p-2 rounded">
                <div className="font-bold text-emerald-300">Guichet</div>
                <div className="text-gray-200">5 chiffres</div>
                <div className="text-[10px] text-teal-300">Ex: 00020</div>
              </div>
              <div className="bg-white/10 p-2 rounded">
                <div className="font-bold text-emerald-300">N° Compte</div>
                <div className="text-gray-200">11 caractères</div>
                <div className="text-[10px] text-teal-300">Ex: 56529950100</div>
              </div>
              <div className="bg-white/10 p-2 rounded">
                <div className="font-bold text-emerald-300">Clé RIB</div>
                <div className="text-gray-200">2 chiffres</div>
                <div className="text-[10px] text-teal-300">Ex: 15 (Modulo 97)</div>
              </div>
            </div>
            <p className="text-xs text-teal-200 mt-2">
              L'application intègre le calcul automatique de la clé modulo 97 en cas de doute.
            </p>
          </div>

          {/* Section 3: Importation Excel */}
          <div className="bg-white/5 border border-teal-400/30 p-4 rounded-lg space-y-3">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-300" />
              3. Structure du fichier Excel d'importation
            </h4>
            <p>
              L'application accepte le format modèle direct fourni dans vos exemples (4 colonnes) :
            </p>

            <div className="bg-black/30 p-3 rounded font-mono text-xs overflow-x-auto space-y-1">
              <div className="text-teal-300 font-bold mb-1">// Exemple conforme au modèle :</div>
              <div className="text-emerald-300">
                Ligne 1 (Donneur d'ordre) : 00005000205652995010015 | 0 | V00000 | SALAIRE MOIS DE SEPTEMBRE 2026
              </div>
              <div className="text-white">
                Ligne 2 : 00008014900500145453342 | 964500 | 000001 | OLIVIER ROLLAND
              </div>
              <div className="text-white">
                Ligne 3 : 00005000207139528000196 | 915800 | 000002 | BOTOTSARA ORLANDO
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-teal-200">
                Vous pouvez également importer un tableau avec des colonnes d'en-tête (Banque, Guichet, Compte, etc.).
              </span>
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="flex items-center gap-1.5 bg-[#388e3c] hover:bg-[#2e7d32] text-white text-xs font-semibold px-3 py-2 rounded transition-colors cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger le modèle Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-teal-500/40 bg-[#08535c] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-medium text-sm transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
