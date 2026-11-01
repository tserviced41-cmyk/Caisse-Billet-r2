import React, { useState, useEffect } from 'react';
import { X, Wallet } from 'lucide-react';
import { Caisse } from '../types/caisse';

interface NewCaisseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCaisse?: Caisse | null;
  onSubmit: (data: Partial<Caisse>) => void;
}

export const NewCaisseModal: React.FC<NewCaisseModalProps> = ({
  isOpen,
  onClose,
  editingCaisse,
  onSubmit,
}) => {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [soldeInitial, setSoldeInitial] = useState('');
  const [devise, setDevise] = useState('AR');
  const [color, setColor] = useState('blue');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCaisse) {
      setNom(editingCaisse.nom);
      setDescription(editingCaisse.description || '');
      setSoldeInitial(String(editingCaisse.soldeInitial || 0));
      setDevise(editingCaisse.devise || 'AR');
      setColor(editingCaisse.color || 'blue');
      setError(null);
    } else {
      setNom('');
      setDescription('');
      setSoldeInitial('0.00');
      setDevise('AR');
      setColor('blue');
      setError(null);
    }
  }, [editingCaisse, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nom.trim()) {
      setError('Le nom de la caisse est obligatoire.');
      return;
    }

    const initialAmount = parseFloat(soldeInitial.replace(/\s/g, '').replace(',', '.')) || 0;

    onSubmit({
      nom: nom.trim(),
      description: description.trim(),
      soldeInitial: initialAmount,
      devise: devise.trim() || 'AR',
      color,
      statut: 'active',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-gray-900 border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              {editingCaisse ? 'Modifier la caisse' : 'Nouvelle caisse'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Nom de la caisse*
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Fanorenana, Caisse Principale..."
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Description (optionnel)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Caisse pour dépenses de chantier"
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1.5">
                Solde initial
              </label>
              <input
                type="text"
                value={soldeInitial}
                onChange={(e) => setSoldeInitial(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1.5">
                Devise
              </label>
              <input
                type="text"
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
                placeholder="AR"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 px-4 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-xl shadow-sm transition cursor-pointer"
            >
              {editingCaisse ? 'Mettre à jour' : 'Créer la caisse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
