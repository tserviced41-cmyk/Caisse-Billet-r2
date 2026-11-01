import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertTriangle, ArrowRight } from 'lucide-react';
import { parseAFB160Text } from '../utils/afb160Parser';
import { DonneurOrdre, OperationVirement } from '../types/afb160';
import { formatRib } from '../utils/ribValidator';

interface AfbImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    newOperations: OperationVirement[],
    newDonneur: DonneurOrdre | null,
    replaceExisting: boolean
  ) => void;
}

export const AfbImportModal: React.FC<AfbImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<{
    donneur: DonneurOrdre | null;
    operations: OperationVirement[];
    errors: string[];
  } | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const text = await selectedFile.text();
      const res = parseAFB160Text(text);
      setParsedData(res);
      if (res.operations.length === 0) {
        setError('Aucun enregistrement de virement (code 06) détecté dans ce fichier texte.');
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la lecture du fichier : " + (err.message || 'Format invalide'));
      setParsedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = () => {
    if (!parsedData || parsedData.operations.length === 0) return;
    onImportSuccess(parsedData.operations, parsedData.donneur, replaceExisting);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalCalculated = parsedData?.operations.reduce((s, op) => s + op.montant, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#0b636e] border border-teal-400/40 rounded-lg shadow-2xl w-full max-w-2xl text-white max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-teal-500/40 flex items-center justify-between bg-[#08535c] shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-200" />
            <h3 className="font-bold text-lg text-white">Importer un fichier AFB160 (.txt)</h3>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-400/50 text-red-100 text-xs px-3 py-2.5 rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!parsedData ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-teal-300/40 hover:border-teal-200 bg-white/5 hover:bg-white/10 rounded-lg p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt, .afb160, .rem, text/plain"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="p-3 bg-teal-500/20 rounded-full text-teal-200">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">
                  {loading
                    ? 'Lecture du fichier...'
                    : 'Glissez-déposez votre fichier texte AFB160 ou cliquez pour parcourir'}
                </p>
                <p className="text-xs text-teal-200 mt-1">
                  Format texte 160 caractères par ligne (.txt, .afb160, .rem)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-400/40 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">
                      Fichier AFB160 analysé : {file?.name}
                    </p>
                    <p className="text-xs text-emerald-200">
                      {parsedData.operations.length} virement(s) • Total :{' '}
                      {new Intl.NumberFormat('fr-FR').format(totalCalculated)} MGA
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-teal-200 hover:text-white underline cursor-pointer"
                >
                  Changer de fichier
                </button>
              </div>

              {/* Parsed Donneur */}
              {parsedData.donneur && (
                <div className="bg-white/5 border border-teal-500/30 p-3 rounded text-xs space-y-1">
                  <span className="font-bold text-teal-200">
                    Donneur d'ordre extrait (En-tête 03) :
                  </span>
                  <div className="text-white">
                    <strong>{parsedData.donneur.nom}</strong> — Compte :{' '}
                    <span className="font-mono">
                      {formatRib(
                        parsedData.donneur.banque,
                        parsedData.donneur.guichet,
                        parsedData.donneur.compte,
                        parsedData.donneur.cle
                      )}
                    </span>
                  </div>
                  {parsedData.donneur.libelle && (
                    <div className="text-teal-200">Motif : {parsedData.donneur.libelle}</div>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div>
                <p className="text-xs font-semibold text-teal-100 mb-1.5">
                  Aperçu des opérations détectées :
                </p>
                <div className="max-h-48 overflow-y-auto border border-teal-500/30 rounded bg-white text-gray-800 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-teal-700 text-white sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2">Rang</th>
                        <th className="py-1.5 px-2">RIB</th>
                        <th className="py-1.5 px-2">Nom</th>
                        <th className="py-1.5 px-2 text-right">Montant (MGA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedData.operations.slice(0, 5).map((op, idx) => (
                        <tr key={idx} className="hover:bg-teal-50">
                          <td className="py-1 px-2 font-mono">{op.rang}</td>
                          <td className="py-1 px-2 font-mono">
                            {formatRib(op.banque, op.guichet, op.compte, op.cle)}
                          </td>
                          <td className="py-1 px-2 font-medium">{op.nom}</td>
                          <td className="py-1 px-2 text-right font-mono font-semibold">
                            {new Intl.NumberFormat('fr-FR').format(op.montant)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import options */}
              <div className="pt-2 border-t border-teal-500/30 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-teal-100 cursor-pointer">
                  <input
                    type="radio"
                    name="importAfbMode"
                    checked={replaceExisting}
                    onChange={() => setReplaceExisting(true)}
                    className="accent-teal-400"
                  />
                  <span>Remplacer la liste actuelle et mettre à jour le donneur d'ordre</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-teal-100 cursor-pointer">
                  <input
                    type="radio"
                    name="importAfbMode"
                    checked={!replaceExisting}
                    onChange={() => setReplaceExisting(false)}
                    className="accent-teal-400"
                  />
                  <span>Ajouter les opérations à la liste sans modifier le donneur d'ordre</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-teal-500/40 bg-[#08535c] flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm font-medium transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!parsedData || parsedData.operations.length === 0}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#2e9e44] hover:bg-[#258237] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-sm font-semibold shadow transition-all cursor-pointer"
          >
            <span>Importer le fichier</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
