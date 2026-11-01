import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Check, AlertTriangle, ArrowRight, Download } from 'lucide-react';
import { parseExcelFile, ExcelImportResult } from '../utils/excelHandler';
import { DonneurOrdre, OperationVirement } from '../types/afb160';
import { formatRib } from '../utils/ribValidator';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    newOperations: OperationVirement[],
    detectedDonneur: Partial<DonneurOrdre> | null,
    replaceExisting: boolean
  ) => void;
  onDownloadTemplate: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onDownloadTemplate,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const parsed = await parseExcelFile(selectedFile);
      setResult(parsed);
      if (parsed.operations.length === 0) {
        setError('Aucune opération valide détectée dans ce fichier Excel.');
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de l'analyse du fichier Excel : " + (err.message || 'Format invalide'));
      setResult(null);
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
    if (!result || result.operations.length === 0) return;
    onImportSuccess(result.operations, result.detectedDonneur, replaceExisting);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#0b636e] border border-teal-400/40 rounded-lg shadow-2xl w-full max-w-2xl text-white max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-teal-500/40 flex items-center justify-between bg-[#08535c] shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <h3 className="font-bold text-lg text-white">Importer un fichier Excel</h3>
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

          {/* File Upload Zone */}
          {!result ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-teal-300/40 hover:border-teal-200 bg-white/5 hover:bg-white/10 rounded-lg p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="p-3 bg-emerald-500/20 rounded-full text-emerald-300">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">
                  {loading
                    ? 'Analyse du fichier en cours...'
                    : 'Glissez-déposez votre fichier Excel ici ou cliquez pour parcourir'}
                </p>
                <p className="text-xs text-teal-200 mt-1">Formats pris en charge : .xlsx, .xls, .csv</p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadTemplate();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-white underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger un modèle Excel exemple</span>
                </button>
              </div>
            </div>
          ) : (
            /* Results preview */
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-400/40 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">
                      Fichier analysé avec succès : {file?.name}
                    </p>
                    <p className="text-xs text-emerald-200">
                      {result.operations.length} opération(s) détectée(s)
                      {result.detectedDonneur ? ' • Donneur d’ordre identifié sur la 1ère ligne' : ''}
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

              {/* Detected Donneur if any */}
              {result.detectedDonneur && (
                <div className="bg-white/5 border border-teal-500/30 p-3 rounded text-xs space-y-1">
                  <span className="font-bold text-teal-200">
                    Donneur d'ordre détecté dans l'Excel :
                  </span>
                  <div className="text-white font-mono">
                    RIB : {formatRib(
                      result.detectedDonneur.banque || '',
                      result.detectedDonneur.guichet || '',
                      result.detectedDonneur.compte || '',
                      result.detectedDonneur.cle || ''
                    )}{' '}
                    {result.detectedDonneur.libelle ? `— ${result.detectedDonneur.libelle}` : ''}
                  </div>
                </div>
              )}

              {/* First 5 rows preview */}
              <div>
                <p className="text-xs font-semibold text-teal-100 mb-1.5">
                  Aperçu des premières opérations importées :
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
                      {result.operations.slice(0, 5).map((op, idx) => (
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
                {result.operations.length > 5 && (
                  <p className="text-[11px] text-teal-200 mt-1 italic">
                    ... et {result.operations.length - 5} autre(s) opération(s).
                  </p>
                )}
              </div>

              {/* Import options */}
              <div className="pt-2 border-t border-teal-500/30 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-teal-100 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={replaceExisting}
                    onChange={() => setReplaceExisting(true)}
                    className="accent-teal-400"
                  />
                  <span>Remplacer la liste actuelle des opérations</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-teal-100 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={!replaceExisting}
                    onChange={() => setReplaceExisting(false)}
                    className="accent-teal-400"
                  />
                  <span>Ajouter à la liste existante</span>
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
            disabled={!result || result.operations.length === 0}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#388e3c] hover:bg-[#2e7d32] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-sm font-semibold shadow transition-all cursor-pointer"
          >
            <span>Confirmer l'importation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
