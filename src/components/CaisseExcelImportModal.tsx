import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, Check, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Caisse } from '../types/caisse';

interface CaisseExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  caisse: Caisse | undefined;
  onImport: (caisseId: string, transactions: any[]) => Promise<void>;
}

export const CaisseExcelImportModal: React.FC<CaisseExcelImportModalProps> = ({
  isOpen,
  onClose,
  caisse,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !caisse) return null;

  const handleDownloadTemplate = () => {
    const templateData = [
      ['date', 'type', 'montant', 'motif', 'responsable'],
      ['17/10/2026', 'entree', 220000, 'R/hy Fideline', ''],
      ['17/10/2026', 'sortie', 4500, 'Colle', ''],
      ['17/10/2026', 'sortie', 18000, 'Tuyau pipe (03) colle', ''],
      ['17/10/2026', 'sortie', 8000, 'Tuyau 1m PVC', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ecritures');
    XLSX.writeFile(wb, `modele_ecritures_${caisse.nom.replace(/\s+/g, '_')}.xlsx`);
  };

  const parseExcelDate = (raw: any): string => {
    if (!raw) {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      return `${d}/${m}/${y}`;
    }

    // If Excel serial number (e.g. 46312)
    const num = Number(raw);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const utc_days = Math.floor(num - 25569);
      const utc_value = utc_days * 86400;
      const dateInfo = new Date(utc_value * 1000);
      const day = String(dateInfo.getDate()).padStart(2, '0');
      const month = String(dateInfo.getMonth() + 1).padStart(2, '0');
      const year = dateInfo.getFullYear();
      return `${day}/${month}/${year}`;
    }

    const str = String(raw).trim();
    if (str.includes('/')) {
      return str;
    }
    if (str.includes('-')) {
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        if (y.length === 4) {
          return `${d}/${m}/${y}`;
        }
      }
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return str;
  };

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (rawRows.length < 2) {
        throw new Error('Le fichier ne contient pas de données.');
      }

      const headers = rawRows[0].map((h) => String(h || '').toLowerCase().trim());
      const dateIdx = headers.findIndex((h) => h.includes('date'));
      const typeIdx = headers.findIndex((h) => h.includes('type'));
      const montantIdx = headers.findIndex((h) => h.includes('montant') || h.includes('valeur'));
      const motifIdx = headers.findIndex((h) => h.includes('motif') || h.includes('libelle') || h.includes('description'));
      const respIdx = headers.findIndex((h) => h.includes('responsable') || h.includes('agent'));

      if (typeIdx === -1 && montantIdx === -1) {
        throw new Error('Colonnes obligatoires (type, montant) non trouvées.');
      }

      const parsed: any[] = [];
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        let rawType = typeIdx >= 0 ? String(row[typeIdx]).trim().toLowerCase() : 'entree';
        const type = rawType.includes('sort') ? 'sortie' : 'entree';

        let rawMontant = montantIdx >= 0 ? String(row[montantIdx]).trim().replace(/\s/g, '').replace(',', '.') : '0';
        const montant = Math.abs(parseFloat(rawMontant) || 0);

        const rawDateVal = dateIdx >= 0 ? row[dateIdx] : '';
        const date = parseExcelDate(rawDateVal);

        const motif = motifIdx >= 0 ? String(row[motifIdx] || '').trim() : '';
        const responsable = respIdx >= 0 ? String(row[respIdx] || '').trim() : '';

        if (montant > 0) {
          parsed.push({
            date,
            type,
            montant,
            motif,
            responsable,
          });
        }
      }

      if (parsed.length === 0) {
        throw new Error('Aucune ligne valide trouvée dans le fichier.');
      }

      setParsedRows(parsed);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la lecture du fichier Excel');
      setParsedRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    try {
      await onImport(caisse.id, parsedRows);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’importation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-gray-900 border border-gray-100 max-h-[92vh] flex flex-col">
        {/* Header matching Screenshot 7 */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight leading-snug">
                Importer des écritures
              </h2>
              <p className="text-xs text-gray-500">
                Caisse : <strong className="text-teal-700">{caisse.nom}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Dropzone matching Screenshot 7 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-teal-200/80 hover:border-teal-400 bg-teal-50/20 hover:bg-teal-50/40 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
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
            <div className="p-3 bg-teal-100/60 text-teal-700 rounded-full mb-1">
              <Upload className="w-7 h-7" />
            </div>
            <p className="font-bold text-gray-800 text-sm">
              {loading
                ? 'Lecture du fichier...'
                : file
                ? `Fichier sélectionné : ${file.name}`
                : 'Glissez un fichier ici'}
            </p>
            <p className="text-gray-400 text-xs">ou cliquez pour choisir un fichier</p>
            <p className="text-[11px] text-gray-400 mt-1">Formats supportés : .xlsx, .xls, .csv</p>
          </div>

          {/* Preview if parsed */}
          {parsedRows.length > 0 && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800">
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">
                  {parsedRows.length} écriture(s) prête(s) à être importée(s)
                </span>
              </div>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading}
                className="px-4 py-1.5 bg-[#00897b] hover:bg-[#00796b] text-white font-semibold rounded-lg text-xs shadow-xs transition cursor-pointer"
              >
                Importer maintenant
              </button>
            </div>
          )}

          {/* Format attendu des colonnes matching Screenshot 7 */}
          <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
            <h4 className="font-bold text-gray-800 text-xs mb-3">
              Format attendu des colonnes
            </h4>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 text-[11px] border-b border-gray-200/60 pb-1">
                  <th className="pb-1.5">Colonne</th>
                  <th className="pb-1.5">Valeurs acceptées</th>
                  <th className="pb-1.5">Obligatoire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-1.5 font-mono font-bold text-teal-800">date</td>
                  <td className="py-1.5 text-gray-600">JJ/MM/AAAA ou AAAA-MM-JJ</td>
                  <td className="py-1.5 text-gray-500">Non (défaut: aujourd'hui)</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-mono font-bold text-teal-800">type</td>
                  <td className="py-1.5 text-gray-600">entree / sortie</td>
                  <td className="py-1.5 font-semibold text-gray-800">Oui</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-mono font-bold text-teal-800">montant</td>
                  <td className="py-1.5 text-gray-600">Nombre positif (ex: 15000)</td>
                  <td className="py-1.5 font-semibold text-gray-800">Oui</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-mono font-bold text-teal-800">motif</td>
                  <td className="py-1.5 text-gray-600">Texte libre</td>
                  <td className="py-1.5 text-gray-500">Non</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-mono font-bold text-teal-800">responsable</td>
                  <td className="py-1.5 text-gray-600">Nom ou texte libre</td>
                  <td className="py-1.5 text-gray-500">Non</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 pt-3 border-t border-gray-200/60">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-900 font-semibold text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le modèle Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Annuler matching Screenshot 7 */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition cursor-pointer text-center text-xs"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};
