import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Wand2, MapPin } from 'lucide-react';
import { OperationVirement } from '../types/afb160';
import { calculateRibKey, formatRib, parseRibString, validateRib } from '../utils/ribValidator';

interface OperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (op: OperationVirement) => void;
  editingOperation: OperationVirement | null;
  nextRang: string;
  defaultLibelle: string;
}

export const OperationModal: React.FC<OperationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingOperation,
  nextRang,
  defaultLibelle,
}) => {
  const [banque, setBanque] = useState('');
  const [guichet, setGuichet] = useState('');
  const [compte, setCompte] = useState('');
  const [cle, setCle] = useState('');
  const [nom, setNom] = useState('');
  const [montant, setMontant] = useState('');
  const [libelle, setLibelle] = useState('');
  const [fullRibPaste, setFullRibPaste] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingOperation) {
      setBanque(editingOperation.banque || '');
      setGuichet(editingOperation.guichet || '');
      setCompte(editingOperation.compte || '');
      setCle(editingOperation.cle || '');
      setNom(editingOperation.nom || '');
      setMontant(editingOperation.montant ? String(editingOperation.montant) : '');
      setLibelle(editingOperation.libelle || defaultLibelle || '');
      setFullRibPaste('');
      setError(null);
    } else {
      setBanque('');
      setGuichet('');
      setCompte('');
      setCle('');
      setNom('');
      setMontant('');
      setLibelle(defaultLibelle || 'SALAIRE MOIS DE SEPTEMBRE 2026');
      setFullRibPaste('');
      setError(null);
    }
  }, [editingOperation, defaultLibelle, isOpen]);

  if (!isOpen) return null;

  const handlePasteFullRib = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullRibPaste(val);
    const parsed = parseRibString(val);
    if (parsed.isValid) {
      setBanque(parsed.banque);
      setGuichet(parsed.guichet);
      setCompte(parsed.compte);
      setCle(parsed.cle);
      setError(null);
    }
  };

  const handleAutoCalcCle = () => {
    if (!banque || !guichet || !compte) {
      setError('Veuillez remplir la banque, le guichet et le compte pour calculer la clé.');
      return;
    }
    const calculated = calculateRibKey(banque, guichet, compte);
    setCle(calculated);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nom.trim()) {
      setError('Le nom du bénéficiaire est obligatoire.');
      return;
    }

    const numericAmount = parseFloat(montant.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    if (!banque || banque.length !== 5) {
      setError('Le code banque doit comporter exactement 5 chiffres.');
      return;
    }

    if (!guichet || guichet.length !== 5) {
      setError('Le code guichet doit comporter exactement 5 chiffres.');
      return;
    }

    if (!compte || compte.length !== 11) {
      setError('Le numéro de compte doit comporter exactement 11 caractères.');
      return;
    }

    const calculatedKey = calculateRibKey(banque, guichet, compte);
    const effectiveCle = cle ? cle.padStart(2, '0') : calculatedKey;

    const op: OperationVirement = {
      id: editingOperation ? editingOperation.id : `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rang: editingOperation ? editingOperation.rang : nextRang,
      banque: banque.padStart(5, '0'),
      guichet: guichet.padStart(5, '0'),
      compte: compte.padStart(11, '0'),
      cle: effectiveCle,
      nom: nom.trim().toUpperCase(),
      libelle: libelle.trim().toUpperCase() || defaultLibelle,
      montant: numericAmount,
    };

    onSave(op);
    onClose();
  };

  const isRibOk = validateRib(banque, guichet, compte, cle);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#0b636e] border border-teal-400/40 rounded-lg shadow-2xl w-full max-w-2xl text-white overflow-hidden transform transition-all">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-teal-500/40 flex items-center justify-between bg-[#08535c]">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-200 fill-teal-200" />
            <h3 className="font-bold text-base sm:text-lg tracking-wide text-white">
              {editingOperation
                ? `Modification de l'opération (Rang: ${editingOperation.rang})`
                : "Ajout d'une opération de virement"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer"
            title="Fermer la fenêtre"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-400/50 text-red-100 text-xs px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Quick paste 23-char RIB helper */}
          <div className="bg-white/5 p-2.5 rounded border border-teal-500/20">
            <label className="block text-[11px] font-medium text-teal-200 mb-1">
              Coller un RIB complet (optionnel, 23 caractères ou format avec tirets) :
            </label>
            <input
              type="text"
              value={fullRibPaste}
              onChange={handlePasteFullRib}
              placeholder="Ex: 00008-01490-05001454533-42 ou 00008014900500145453342"
              className="w-full bg-white/10 border border-teal-400/30 text-white placeholder-teal-300/60 px-2.5 py-1 text-xs rounded font-mono focus:outline-none focus:ring-1 focus:ring-teal-300"
            />
          </div>

          {/* N° Compte (RIB 4 parts) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-teal-100">N° Compte :</label>
              <div className="flex items-center gap-2">
                {isRibOk ? (
                  <span className="text-[11px] text-emerald-300 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Clé valide
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleAutoCalcCle}
                    className="text-[11px] text-teal-200 hover:text-white underline flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" /> Auto-calculer clé
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <input
                  type="text"
                  maxLength={5}
                  value={banque}
                  onChange={(e) => setBanque(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                  placeholder="Banque"
                  className="w-full bg-white text-gray-900 px-2 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono shadow-inner"
                  required
                />
                <span className="block text-[10px] text-teal-200 text-center mt-0.5">Banque (5)</span>
              </div>

              <div className="col-span-3">
                <input
                  type="text"
                  maxLength={5}
                  value={guichet}
                  onChange={(e) => setGuichet(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                  placeholder="Guichet"
                  className="w-full bg-white text-gray-900 px-2 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono shadow-inner"
                  required
                />
                <span className="block text-[10px] text-teal-200 text-center mt-0.5">Guichet (5)</span>
              </div>

              <div className="col-span-4">
                <input
                  type="text"
                  maxLength={11}
                  value={compte}
                  onChange={(e) =>
                    setCompte(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))
                  }
                  placeholder="N° compte"
                  className="w-full bg-white text-gray-900 px-2 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono shadow-inner"
                  required
                />
                <span className="block text-[10px] text-teal-200 text-center mt-0.5">N° compte (11)</span>
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  maxLength={2}
                  value={cle}
                  onChange={(e) => setCle(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="Clé"
                  className="w-full bg-white text-gray-900 px-1 py-2 text-center text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono shadow-inner"
                  required
                />
                <span className="block text-[10px] text-teal-200 text-center mt-0.5">Clé (2)</span>
              </div>
            </div>
          </div>

          {/* Nom* */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-teal-100">Nom* :</label>
              <span className="text-[11px] text-teal-200">{nom.length}/24 max</span>
            </div>
            <input
              type="text"
              maxLength={24}
              value={nom}
              onChange={(e) => setNom(e.target.value.toUpperCase().slice(0, 24))}
              placeholder="Nom et Prénoms (24 caractères max.)"
              className="w-full bg-white text-gray-900 px-3 py-2 text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium shadow-inner placeholder-gray-400"
              required
            />
          </div>

          {/* Montant MGA* & Libellé* */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-teal-100 mb-1">
                Montant MGA* :
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="Montant en MGA..."
                  className="w-full bg-white text-gray-900 px-3 py-2 text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-semibold shadow-inner placeholder-gray-400"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-7">
              <label className="block text-xs font-semibold text-teal-100 mb-1">
                Libellé* (Motif) :
              </label>
              <input
                type="text"
                maxLength={31}
                value={libelle}
                onChange={(e) => setLibelle(e.target.value.toUpperCase().slice(0, 31))}
                placeholder="Motif..."
                className="w-full bg-white text-gray-900 px-3 py-2 text-sm rounded border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium shadow-inner placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm font-medium transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-[#2e9e44] hover:bg-[#258237] active:bg-[#1c642a] text-white rounded text-sm font-semibold shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{editingOperation ? 'Enregistrer les modifications' : 'Ajouter'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
