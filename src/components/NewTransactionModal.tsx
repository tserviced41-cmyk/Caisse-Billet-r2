import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Calendar, User as UserIcon } from 'lucide-react';
import { Caisse, Transaction, User } from '../types/caisse';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  caisses: Caisse[];
  currentUser: User;
  preselectedCaisseId?: string;
  editingTransaction?: Transaction | null;
  onSubmit: (tx: {
    id?: string;
    caisseId: string;
    type: 'entree' | 'sortie';
    montant: number;
    date: string;
    motif?: string;
    responsable?: string;
  }) => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  caisses,
  currentUser,
  preselectedCaisseId,
  editingTransaction,
  onSubmit,
}) => {
  const [caisseId, setCaisseId] = useState('');
  const [type, setType] = useState<'entree' | 'sortie'>('entree');
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState('');
  const [responsable, setResponsable] = useState('');
  const [motif, setMotif] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Available caisses where user has write permissions (or admin)
  const writableCaisses = caisses.filter((c) => {
    if (currentUser.role === 'admin') return true;
    return currentUser.caissePermissions?.[c.id] === 'write';
  });

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setCaisseId(editingTransaction.caisseId);
        setType(editingTransaction.type);
        setMontant(String(editingTransaction.montant));
        // Try to parse existing date to datetime-local format
        try {
          const d = new Date(editingTransaction.date);
          if (!isNaN(d.getTime())) {
            const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
            setDate(localIso);
          } else {
            const now = new Date();
            setDate(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          }
        } catch {
          const now = new Date();
          setDate(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }
        setResponsable(editingTransaction.responsable || '');
        setMotif(editingTransaction.motif || '');
        setError(null);
      } else {
        const defaultCaisse =
          preselectedCaisseId && writableCaisses.some((c) => c.id === preselectedCaisseId)
            ? preselectedCaisseId
            : writableCaisses[0]?.id || '';
        setCaisseId(defaultCaisse);
        setType('entree');
        setMontant('');
        const now = new Date();
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDate(localIso);
        setResponsable(currentUser.fullName || currentUser.username || '');
        setMotif('');
        setError(null);
      }
    }
  }, [isOpen, editingTransaction, preselectedCaisseId, writableCaisses.length]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!caisseId) {
      setError('Veuillez sélectionner une caisse.');
      return;
    }

    const numAmount = parseFloat(montant.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    // Format display date: e.g. "2026-10-17 00:00"
    let formattedDate = date.replace('T', ' ');

    onSubmit({
      id: editingTransaction ? editingTransaction.id : undefined,
      caisseId,
      type,
      montant: numAmount,
      date: formattedDate,
      motif: motif.trim(),
      responsable: responsable.trim() || currentUser.fullName || currentUser.username,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-gray-900 border border-gray-100">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              {editingTransaction ? 'Modifier la transaction' : 'Nouvelle transaction'}
            </h2>
            {editingTransaction && (
              <p className="text-[11px] text-gray-500">Modification réservée à l’administrateur</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* Caisse Selector */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Caisse
            </label>
            <select
              value={caisseId}
              onChange={(e) => setCaisseId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              required
            >
              {caisses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} — {c.devise || 'AR'}
                </option>
              ))}
            </select>
          </div>

          {/* Type Toggle: Entrée / Sortie */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('entree')}
                className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  type === 'entree'
                    ? 'bg-[#00a86b] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Entrée</span>
              </button>

              <button
                type="button"
                onClick={() => setType('sortie')}
                className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  type === 'sortie'
                    ? 'bg-[#f97316] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Sortie</span>
              </button>
            </div>
          </div>

          {/* Montant & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1.5">
                Montant
              </label>
              <input
                type="text"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-semibold"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1.5">
                Date
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                required
              />
            </div>
          </div>

          {/* Responsable */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Responsable
            </label>
            <input
              type="text"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Nom du responsable"
              className="w-full bg-white border border-emerald-400 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Motif (optionnel) */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Motif (optionnel)
            </label>
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Achat de fournitures, Vente du jour..."
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Action Buttons */}
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
              {editingTransaction ? 'Enregistrer' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
