import React from 'react';
import { User, Calendar, Check, AlertCircle, Wand2 } from 'lucide-react';
import { DonneurOrdre } from '../types/afb160';
import { calculateRibKey, validateRib } from '../utils/ribValidator';

interface DonneurOrdreCardProps {
  donneur: DonneurOrdre;
  onChange: (updated: DonneurOrdre) => void;
  totalAmount: number;
}

export const DonneurOrdreCard: React.FC<DonneurOrdreCardProps> = ({
  donneur,
  onChange,
  totalAmount,
}) => {
  const isRibValid = validateRib(donneur.banque, donneur.guichet, donneur.compte, donneur.cle);

  const handleFieldChange = (field: keyof DonneurOrdre, val: string) => {
    onChange({
      ...donneur,
      [field]: val,
    });
  };

  const handleAutoCalcCle = () => {
    const calculated = calculateRibKey(donneur.banque, donneur.guichet, donneur.compte);
    onChange({
      ...donneur,
      cle: calculated,
    });
  };

  const formattedTotal = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalAmount);

  return (
    <div className="bg-white/10 backdrop-blur-xs border border-teal-500/30 rounded-lg p-4 sm:p-5 text-white shadow-md">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-teal-600/50">
        <User className="w-5 h-5 text-teal-200" />
        <h2 className="font-bold text-base sm:text-lg tracking-wide text-white">
          Identité et RIB Donneur d'ordre à débiter
        </h2>
      </div>

      {/* Grid of Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        {/* Nom / Raison Sociale */}
        <div className="lg:col-span-3">
          <label className="block text-xs font-semibold text-teal-100 mb-1">
            Nom / Raison sociale* :
          </label>
          <input
            type="text"
            maxLength={24}
            value={donneur.nom}
            onChange={(e) => handleFieldChange('nom', e.target.value.toUpperCase())}
            placeholder="24 caractères max."
            className="w-full bg-white text-gray-900 px-3 py-2 text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium placeholder-gray-400 shadow-inner"
          />
          <div className="flex justify-between items-center mt-1 text-[11px] text-teal-200">
            <span>Donneur d'ordre</span>
            <span>{donneur.nom.length}/24</span>
          </div>
        </div>

        {/* N° Compte (RIB 4 parts) */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-teal-100">N° Compte (RIB) :</label>
            <div className="flex items-center gap-1.5">
              {isRibValid ? (
                <span className="text-[11px] text-emerald-300 flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> RIB Valide
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleAutoCalcCle}
                  title="Calculer automatiquement la clé RIB"
                  className="text-[11px] text-teal-200 hover:text-white underline flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" /> Calculer clé
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-1.5">
            {/* Banque */}
            <div className="col-span-3">
              <input
                type="text"
                maxLength={5}
                value={donneur.banque}
                onChange={(e) =>
                  handleFieldChange('banque', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))
                }
                placeholder="Banque"
                className="w-full bg-white text-gray-900 px-2 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono font-medium shadow-inner"
                title="Code Banque (5 chiffres)"
              />
              <span className="block text-[10px] text-teal-200 text-center mt-0.5">Banque</span>
            </div>

            {/* Guichet */}
            <div className="col-span-3">
              <input
                type="text"
                maxLength={5}
                value={donneur.guichet}
                onChange={(e) =>
                  handleFieldChange('guichet', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))
                }
                placeholder="Guichet"
                className="w-full bg-white text-gray-900 px-2 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono font-medium shadow-inner"
                title="Code Guichet (5 chiffres)"
              />
              <span className="block text-[10px] text-teal-200 text-center mt-0.5">Guichet</span>
            </div>

            {/* N° compte */}
            <div className="col-span-4">
              <input
                type="text"
                maxLength={11}
                value={donneur.compte}
                onChange={(e) =>
                  handleFieldChange(
                    'compte',
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)
                  )
                }
                placeholder="N° compte"
                className="w-full bg-white text-gray-900 px-2 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono font-medium shadow-inner"
                title="Numéro de Compte (11 caractères)"
              />
              <span className="block text-[10px] text-teal-200 text-center mt-0.5">N° compte</span>
            </div>

            {/* Clé */}
            <div className="col-span-2">
              <input
                type="text"
                maxLength={2}
                value={donneur.cle}
                onChange={(e) =>
                  handleFieldChange('cle', e.target.value.replace(/[^0-9]/g, '').slice(0, 2))
                }
                placeholder="Clé"
                className="w-full bg-white text-gray-900 px-1 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono font-medium shadow-inner"
                title="Clé RIB (2 chiffres)"
              />
              <span className="block text-[10px] text-teal-200 text-center mt-0.5">Clé</span>
            </div>
          </div>
        </div>

        {/* Date d'exécution & Motif par défaut */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-semibold text-teal-100 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-teal-300" />
            <span>Date d'exécution :</span>
          </label>
          <input
            type="date"
            value={donneur.dateExecution}
            onChange={(e) => handleFieldChange('dateExecution', e.target.value)}
            className="w-full bg-white text-gray-900 px-2 py-2 text-xs rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium shadow-inner"
          />
          <span className="block text-[11px] text-teal-200 mt-1">Date valeur bancaire</span>
        </div>

        {/* Total Transaction Badge */}
        <div className="lg:col-span-3">
          <label className="block text-xs font-semibold text-teal-100 mb-1">
            Total transaction :
          </label>
          <div className="w-full bg-white px-3 py-2 rounded border border-teal-200 flex items-center justify-end shadow-inner min-h-[38px]">
            <span className="text-base sm:text-lg font-bold text-teal-900 tracking-tight">
              {formattedTotal} <span className="text-xs font-semibold text-teal-700">MGA</span>
            </span>
          </div>
          <span className="block text-[11px] text-teal-200 text-right mt-1">
            Calculé automatiquement
          </span>
        </div>
      </div>
    </div>
  );
};
