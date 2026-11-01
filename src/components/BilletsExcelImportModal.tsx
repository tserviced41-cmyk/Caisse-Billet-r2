import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Download,
  Settings2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TicketItem } from './BilletsView';

export type ImportMergeMode = 'overwrite' | 'status_only' | 'skip';

interface BilletsExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTickets: TicketItem[];
  onImportConfirm: (
    importedTickets: TicketItem[],
    mode: ImportMergeMode,
    stats: {
      total: number;
      payes: number;
      impayes: number;
      distribues: number;
      nonDistribues: number;
    }
  ) => void;
}

// Helper to normalize keys (remove accents, lowercase, strip spaces and punctuation)
function normalizeKey(key: string): string {
  return String(key || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Detect if a text represents an unassigned / non-distributed beneficiary
export function isNonAttribueText(text: string): boolean {
  if (!text) return true;
  const s = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nonTokens = [
    '',
    '-',
    '--',
    '---',
    '—',
    '_',
    '/',
    'non',
    'aucun',
    'aucune',
    'nonattribue',
    'nonattribuee',
    'nondistribue',
    'nondistribuee',
    'nonattribu',
    'libre',
    'disponible',
    'vide',
    'na',
    'n/a',
    'null',
    'undefined',
    'pasetencore',
    'pasattribue',
    'pasdistribue',
    'enstock',
    'sansnom',
  ];
  return nonTokens.includes(s);
}

// Parse payment value from any format (Boolean, number, or string)
export function parsePaymentValue(val: any, prix?: number): boolean {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  if (typeof val === 'number') {
    if (prix && val >= prix) return true;
    if (val > 0) return true;
    return false;
  }
  if (!val) return false;

  const s = String(val).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Definite affirmative values
  const trueTokens = [
    'oui',
    'yes',
    'vrai',
    'true',
    'paye',
    'payee',
    'solde',
    'soldee',
    'regle',
    'reglee',
    'ok',
    'encaisse',
    'encaissee',
    '1',
    'complet',
    'valide',
    'payes',
    'payees',
    'regles',
    'encaisses',
  ];
  if (trueTokens.includes(s)) return true;

  // Definite negative values
  const falseTokens = [
    'non',
    'no',
    'faux',
    'false',
    'impaye',
    'impayee',
    'nonpaye',
    'nonpayee',
    'apayer',
    'attente',
    'enattente',
    'reste',
    '0',
    'nonregle',
    'nonsolde',
    'du',
    'nonencaisse',
    'impayes',
    'impayees',
  ];
  if (falseTokens.includes(s)) return false;

  // Substring checks
  if (s.includes('impay') || s.includes('non pay') || s.includes('a payer') || s.includes('non regle') || s.includes('non solde')) {
    return false;
  }
  if (s.includes('paye') || s.includes('regle') || s.includes('solde') || s.includes('encaisse')) {
    return true;
  }

  return false;
}

// Parse distributed / attributed status
export function parseDistributionValue(val: any): boolean | null {
  if (val === undefined || val === null || val === '') return null;
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  const s = String(val).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['oui', 'yes', 'vrai', 'true', 'distribue', 'attribue', 'donne', '1'].includes(s)) {
    return true;
  }
  if (['non', 'no', 'faux', 'false', 'nondistribue', 'nonattribue', 'libre', 'disponible', '0', 'aucun'].includes(s)) {
    return false;
  }
  return null;
}

export const BilletsExcelImportModal: React.FC<BilletsExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingTickets,
  onImportConfirm,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  
  // Column Mappings (user-adjustable)
  const [colMap, setColMap] = useState<{
    numero: string;
    campagne: string;
    session: string;
    prix: string;
    groupe: string;
    beneficiaire: string;
    distribue: string;
    paye: string;
    telephone: string;
    dateAttribution: string;
  }>({
    numero: '',
    campagne: '',
    session: '',
    prix: '',
    groupe: '',
    beneficiaire: '',
    distribue: '',
    paye: '',
    telephone: '',
    dateAttribution: '',
  });

  const [parsedTickets, setParsedTickets] = useState<TicketItem[]>([]);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [payesCount, setPayesCount] = useState(0);
  const [impayesCount, setImpayesCount] = useState(0);
  const [distribuesCount, setDistribuesCount] = useState(0);
  const [nonDistribuesCount, setNonDistribuesCount] = useState(0);
  const [mergeMode, setMergeMode] = useState<ImportMergeMode>('overwrite');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download comprehensive and well-documented template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Numéro Billet': 1,
        'Campagne': 'Opération Soupe 2026',
        'Session / Lot': 'Session 1',
        'Prix (Ar)': 10000,
        'Groupe': 'Groupe A',
        'Bénéficiaire': 'Rakoto Jean',
        'Distribué': 'OUI',
        'Téléphone': '0321234567',
        'Statut Paiement': 'Payé',
        'Date Attribution': new Date().toISOString().split('T')[0],
      },
      {
        'Numéro Billet': 2,
        'Campagne': 'Opération Soupe 2026',
        'Session / Lot': 'Session 1',
        'Prix (Ar)': 10000,
        'Groupe': 'Groupe A',
        'Bénéficiaire': 'Rasoa Marie',
        'Distribué': 'OUI',
        'Téléphone': '0339876543',
        'Statut Paiement': 'Impayé',
        'Date Attribution': new Date().toISOString().split('T')[0],
      },
      {
        'Numéro Billet': 3,
        'Campagne': 'Opération Soupe 2026',
        'Session / Lot': 'Session 1',
        'Prix (Ar)': 10000,
        'Groupe': 'Groupe B',
        'Bénéficiaire': '',
        'Distribué': 'NON',
        'Téléphone': '',
        'Statut Paiement': 'Non payé',
        'Date Attribution': '',
      },
      {
        'Numéro Billet': 4,
        'Campagne': 'Opération Soupe 2026',
        'Session / Lot': 'Session 2',
        'Prix (Ar)': 10000,
        'Groupe': 'Groupe B',
        'Bénéficiaire': 'Non attribué',
        'Distribué': 'NON',
        'Téléphone': '',
        'Statut Paiement': 'Non payé',
        'Date Attribution': '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modèle Billets');
    XLSX.writeFile(workbook, 'modele_import_billets_statuts.xlsx');
  };

  // Re-parse tickets using current colMap
  const executeParsing = (rows: any[], currentMap: typeof colMap) => {
    const existingMap = new Map<string, TicketItem>();
    existingTickets.forEach((t) => {
      existingMap.set(`${t.numero}_${t.campagne.trim().toLowerCase()}`, t);
    });

    const ticketsList: TicketItem[] = [];
    let dupes = 0;
    let fresh = 0;
    let paid = 0;
    let unpaid = 0;
    let assigned = 0;
    let unassigned = 0;

    rows.forEach((row, idx) => {
      // 1. Numero
      let numero = Number(row[currentMap.numero]);
      if (isNaN(numero) || numero <= 0) {
        // Fallback search
        numero = idx + 1;
      }

      // 2. Campagne
      const rawCampagne = currentMap.campagne ? String(row[currentMap.campagne] || '').trim() : '';
      const campagne = rawCampagne || 'Opération Soupe 2026';

      // 3. Session
      const session = currentMap.session ? String(row[currentMap.session] || '').trim() : '';

      // 4. Prix
      let prix = 10000;
      if (currentMap.prix && row[currentMap.prix] !== undefined) {
        const pNum = Number(String(row[currentMap.prix]).replace(/[^0-9.]/g, ''));
        if (!isNaN(pNum) && pNum > 0) prix = pNum;
      }

      // 5. Groupe
      const rawGroupe = currentMap.groupe ? String(row[currentMap.groupe] || '').trim() : '';
      const groupe = rawGroupe || 'Général';

      // 6. Beneficiaire & Distribution
      let rawBeneficiaire = currentMap.beneficiaire ? String(row[currentMap.beneficiaire] || '').trim() : '';
      const rawDistribue = currentMap.distribue ? row[currentMap.distribue] : undefined;
      const parsedDistribue = parseDistributionValue(rawDistribue);

      let beneficiaire = '';
      if (parsedDistribue === false) {
        // Explicitly NOT distributed
        beneficiaire = '';
      } else if (isNonAttribueText(rawBeneficiaire)) {
        // Text like "Non attribué", "-", "Aucun", empty
        beneficiaire = '';
      } else {
        beneficiaire = rawBeneficiaire;
      }

      // 7. Telephone
      const telephone = currentMap.telephone ? String(row[currentMap.telephone] || '').trim() : '';

      // 8. Paye (Paid or Not Paid)
      let paye = false;
      if (currentMap.paye && row[currentMap.paye] !== undefined) {
        paye = parsePaymentValue(row[currentMap.paye], prix);
      }

      // 9. Date Attribution
      let dateAttribution = '';
      if (currentMap.dateAttribution && row[currentMap.dateAttribution]) {
        dateAttribution = String(row[currentMap.dateAttribution]).trim();
      } else if (beneficiaire) {
        dateAttribution = new Date().toISOString().split('T')[0];
      }

      // Update counters
      if (paye) paid++;
      else unpaid++;

      if (beneficiaire) assigned++;
      else unassigned++;

      const key = `${numero}_${campagne.toLowerCase()}`;
      if (existingMap.has(key)) dupes++;
      else fresh++;

      ticketsList.push({
        id: `import_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        numero,
        campagne,
        session: session || undefined,
        prix,
        groupe,
        beneficiaire,
        telephone: beneficiaire ? telephone : '',
        paye,
        dateAttribution,
      });
    });

    setParsedTickets(ticketsList);
    setDuplicatesCount(dupes);
    setNewCount(fresh);
    setPayesCount(paid);
    setImpayesCount(unpaid);
    setDistribuesCount(assigned);
    setNonDistribuesCount(unassigned);
  };

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rows.length === 0) {
        setError('Le fichier Excel est vide ou ne contient aucune ligne valide.');
        setLoading(false);
        return;
      }

      setRawRows(rows);

      // Extract all header columns from the first row
      const sampleRow = rows[0] || {};
      const headers = Object.keys(sampleRow);
      setAvailableHeaders(headers);

      // Auto-detect mappings based on normalized keywords
      const detectedMap = {
        numero: '',
        campagne: '',
        session: '',
        prix: '',
        groupe: '',
        beneficiaire: '',
        distribue: '',
        paye: '',
        telephone: '',
        dateAttribution: '',
      };

      headers.forEach((h) => {
        const norm = normalizeKey(h);

        // Numero
        if (!detectedMap.numero && (norm.includes('numero') || norm.includes('num') || norm === 'no' || norm === 'nbillet' || norm === 'ticket' || norm === 'billet' || norm === 'id')) {
          detectedMap.numero = h;
        }
        // Campagne
        else if (!detectedMap.campagne && (norm.includes('campagne') || norm.includes('operation') || norm.includes('event') || norm.includes('projet'))) {
          detectedMap.campagne = h;
        }
        // Session
        else if (!detectedMap.session && (norm.includes('session') || norm.includes('lot') && !norm.includes('groupe') || norm.includes('serie'))) {
          detectedMap.session = h;
        }
        // Prix
        else if (!detectedMap.prix && (norm.includes('prix') || norm.includes('montant') || norm.includes('tarif') || norm.includes('valeur'))) {
          detectedMap.prix = h;
        }
        // Groupe
        else if (!detectedMap.groupe && (norm.includes('groupe') || norm.includes('group') || norm.includes('equipe') || norm.includes('section'))) {
          detectedMap.groupe = h;
        }
        // Distribué
        else if (!detectedMap.distribue && (norm.includes('distribue') || norm.includes('distribution') || (norm.includes('attribue') && !norm.includes('beneficiaire') && !norm.includes('date')))) {
          detectedMap.distribue = h;
        }
        // Payé
        else if (!detectedMap.paye && (norm.includes('paye') || norm.includes('paiement') || norm.includes('regle') || norm.includes('solde') || norm.includes('encaisse') || norm.includes('statut'))) {
          detectedMap.paye = h;
        }
        // Bénéficiaire
        else if (!detectedMap.beneficiaire && (norm.includes('beneficiaire') || norm.includes('nom') || norm.includes('client') || norm.includes('personne') || norm.includes('destinataire') || norm.includes('attribuea') || norm.includes('distribuea'))) {
          detectedMap.beneficiaire = h;
        }
        // Téléphone
        else if (!detectedMap.telephone && (norm.includes('telephone') || norm.includes('tel') || norm.includes('contact') || norm.includes('phone') || norm.includes('mobile'))) {
          detectedMap.telephone = h;
        }
        // Date attribution
        else if (!detectedMap.dateAttribution && (norm.includes('date') || norm.includes('dateattribution'))) {
          detectedMap.dateAttribution = h;
        }
      });

      setColMap(detectedMap);
      executeParsing(rows, detectedMap);
      setStep('preview');
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la lecture du fichier Excel : " + (err.message || 'Format corrompu'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMapping = (field: keyof typeof colMap, value: string) => {
    const updatedMap = { ...colMap, [field]: value };
    setColMap(updatedMap);
    executeParsing(rawRows, updatedMap);
  };

  const handleConfirmImport = () => {
    if (parsedTickets.length === 0) return;
    onImportConfirm(parsedTickets, mergeMode, {
      total: parsedTickets.length,
      payes: payesCount,
      impayes: impayesCount,
      distribues: distribuesCount,
      nonDistribues: nonDistribuesCount,
    });
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setRawRows([]);
    setAvailableHeaders([]);
    setParsedTickets([]);
    setDuplicatesCount(0);
    setNewCount(0);
    setPayesCount(0);
    setImpayesCount(0);
    setDistribuesCount(0);
    setNonDistribuesCount(0);
    setError(null);
    setStep('upload');
    setShowAdvancedMapping(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#0b636e] border border-teal-400/40 rounded-2xl shadow-2xl w-full max-w-4xl text-white max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-teal-500/40 flex items-center justify-between bg-[#08535c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Importation Excel des Billets</h3>
              <p className="text-xs text-teal-200">
                Prise en charge stricte des statuts : Payé / Impayé et Distribué / Non distribué
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="bg-red-500/20 border border-red-400/50 text-red-100 text-xs px-3.5 py-3 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' ? (
            <div className="space-y-4">
              <div className="bg-teal-900/50 border border-teal-500/30 rounded-xl p-4 text-xs text-teal-100 space-y-2.5">
                <p className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Règles d&apos;importation et détection des statuts :
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-teal-200 pt-1">
                  <div className="bg-white/5 p-3 rounded-lg border border-teal-500/20 space-y-1">
                    <p className="font-bold text-emerald-300">Statut Paiement (Payé ou Non payé) :</p>
                    <p>
                      Reconnaît automatiquement : <code>Payé</code>, <code>OUI</code>, <code>Soldé</code>, <code>1</code> (Payé)
                      ainsi que <code>Non</code>, <code>Impayé</code>, <code>Non payé</code>, <code>A payer</code>, <code>0</code> (Non payé).
                    </p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg border border-teal-500/20 space-y-1">
                    <p className="font-bold text-blue-300">Statut Distribution (Distribué ou Non) :</p>
                    <p>
                      Si le nom est renseigné, le billet est marqué <strong>Distribué</strong>.
                      Si le nom est vide ou contient <code>Non attribué</code>, <code>-</code>, <code>Aucun</code>, le billet est marqué <strong>Non distribué</strong>.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le modèle Excel type avec exemples (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-teal-300/40 hover:border-teal-200 bg-white/5 hover:bg-white/10 rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                  }}
                  className="hidden"
                />
                <div className="p-3.5 bg-emerald-500/20 rounded-full text-emerald-300">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm sm:text-base">
                    {loading ? 'Analyse du fichier...' : 'Cliquez pour sélectionner votre fichier Excel ou glissez-déposez ici'}
                  </p>
                  <p className="text-xs text-teal-200 mt-1">Formats pris en charge : .xlsx, .xls, .csv</p>
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW STEP */
            <div className="space-y-4">
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                <div className="bg-teal-950/60 p-3 rounded-xl border border-teal-500/30">
                  <p className="text-[10px] uppercase font-bold text-teal-300">Total Billets</p>
                  <p className="text-xl font-black text-white">{parsedTickets.length}</p>
                </div>

                <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-500/30">
                  <p className="text-[10px] uppercase font-bold text-emerald-300">Payés</p>
                  <p className="text-xl font-black text-emerald-300">{payesCount}</p>
                </div>

                <div className="bg-orange-950/60 p-3 rounded-xl border border-orange-500/30">
                  <p className="text-[10px] uppercase font-bold text-orange-300">Non payés (Impayés)</p>
                  <p className="text-xl font-black text-orange-300">{impayesCount}</p>
                </div>

                <div className="bg-blue-950/60 p-3 rounded-xl border border-blue-500/30">
                  <p className="text-[10px] uppercase font-bold text-blue-300">Distribués</p>
                  <p className="text-xl font-black text-blue-300">{distribuesCount}</p>
                </div>

                <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-600/30">
                  <p className="text-[10px] uppercase font-bold text-gray-300">Non distribués</p>
                  <p className="text-xl font-black text-gray-200">{nonDistribuesCount}</p>
                </div>
              </div>

              {/* Column Mapping Adjuster (Collapsible) */}
              <div className="bg-[#08535c] border border-teal-500/30 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-teal-200 hover:text-white hover:bg-teal-800/40 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-emerald-300" />
                    <span>Vérifier ou ajuster les colonnes détectées du fichier Excel</span>
                  </div>
                  {showAdvancedMapping ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedMapping && (
                  <div className="p-4 border-t border-teal-500/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-teal-950/40">
                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Numéro :</label>
                      <select
                        value={colMap.numero}
                        onChange={(e) => handleUpdateMapping('numero', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Automatique --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Bénéficiaire :</label>
                      <select
                        value={colMap.beneficiaire}
                        onChange={(e) => handleUpdateMapping('beneficiaire', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Aucune (Non distribué) --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Paiement (Payé/Impayé) :</label>
                      <select
                        value={colMap.paye}
                        onChange={(e) => handleUpdateMapping('paye', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Aucune (Tous Impayés) --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Distribué (Optionnel) :</label>
                      <select
                        value={colMap.distribue}
                        onChange={(e) => handleUpdateMapping('distribue', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Déduire du Bénéficiaire --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Groupe :</label>
                      <select
                        value={colMap.groupe}
                        onChange={(e) => handleUpdateMapping('groupe', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Défaut (Général) --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Prix :</label>
                      <select
                        value={colMap.prix}
                        onChange={(e) => handleUpdateMapping('prix', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Défaut (10 000 Ar) --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Téléphone :</label>
                      <select
                        value={colMap.telephone}
                        onChange={(e) => handleUpdateMapping('telephone', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Aucun --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-teal-300 mb-1">Colonne Campagne :</label>
                      <select
                        value={colMap.campagne}
                        onChange={(e) => handleUpdateMapping('campagne', e.target.value)}
                        className="w-full bg-[#0b636e] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="">-- Défaut --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Import Mode Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white">
                  Action à effectuer pour les billets existants ({duplicatesCount} détectés) :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMergeMode('overwrite')}
                    className={`p-3 rounded-xl text-left border text-xs transition cursor-pointer flex flex-col justify-between ${
                      mergeMode === 'overwrite'
                        ? 'bg-emerald-600/40 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400'
                        : 'bg-teal-900/40 border-teal-500/30 text-teal-200 hover:bg-teal-900/70'
                    }`}
                  >
                    <div>
                      <p className="font-black text-sm text-white">1. Mettre à jour tout (Recommandé)</p>
                      <p className="text-[11px] text-teal-100 mt-1">
                        Applique rigoureusement les statuts du fichier Excel : Payé / Non payé, Distribué / Non distribué, et bénéficiaires.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-emerald-300 font-bold uppercase tracking-wide">
                      Écrase les anciens statuts
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMergeMode('status_only')}
                    className={`p-3 rounded-xl text-left border text-xs transition cursor-pointer flex flex-col justify-between ${
                      mergeMode === 'status_only'
                        ? 'bg-emerald-600/40 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400'
                        : 'bg-teal-900/40 border-teal-500/30 text-teal-200 hover:bg-teal-900/70'
                    }`}
                  >
                    <div>
                      <p className="font-black text-sm text-white">2. Statuts & Attribution uniquement</p>
                      <p className="text-[11px] text-teal-100 mt-1">
                        Met à jour Payé / Impayé et Bénéficiaire, sans changer les groupes ni prix déjà saisis.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-blue-300 font-bold uppercase tracking-wide">
                      Préserve groupes & prix
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMergeMode('skip')}
                    className={`p-3 rounded-xl text-left border text-xs transition cursor-pointer flex flex-col justify-between ${
                      mergeMode === 'skip'
                        ? 'bg-emerald-600/40 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400'
                        : 'bg-teal-900/40 border-teal-500/30 text-teal-200 hover:bg-teal-900/70'
                    }`}
                  >
                    <div>
                      <p className="font-black text-sm text-white">3. Ignorer les doublons</p>
                      <p className="text-[11px] text-teal-100 mt-1">
                        Ne touche à aucun billet déjà existant. Ajoute uniquement les nouveaux numéros ({newCount}).
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] text-gray-300 font-bold uppercase tracking-wide">
                      Ajout nouveaux uniquement
                    </span>
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-teal-500/30 rounded-xl overflow-hidden shadow-inner">
                <div className="bg-[#08535c] px-4 py-2 border-b border-teal-500/30 flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Aperçu direct des données ({parsedTickets.length} lignes)</span>
                  <span className="text-[11px] text-teal-200">
                    {newCount} nouveaux &bull; {duplicatesCount} existants
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#064249] text-teal-200 sticky top-0 font-bold">
                      <tr>
                        <th className="p-2.5">N°</th>
                        <th className="p-2.5">Campagne</th>
                        <th className="p-2.5">Distribution</th>
                        <th className="p-2.5 text-center">Paiement</th>
                        <th className="p-2.5">Groupe</th>
                        <th className="p-2.5 text-right">Prix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-500/20 text-teal-100">
                      {parsedTickets.slice(0, 25).map((t, idx) => (
                        <tr key={idx} className="hover:bg-teal-800/30 transition">
                          <td className="p-2.5 font-mono font-bold text-white">#{t.numero}</td>
                          <td className="p-2.5 truncate max-w-[120px]">{t.campagne}</td>
                          <td className="p-2.5">
                            {t.beneficiaire ? (
                              <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                {t.beneficiaire}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-gray-500/20 text-gray-300 border border-gray-400/30 px-2 py-0.5 rounded-full text-[11px]">
                                <XCircle className="w-3 h-3 text-gray-400" />
                                Non distribué
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {t.paye ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 rounded-full text-[11px] font-black">
                                <Check className="w-3 h-3" />
                                Payé
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-orange-500/20 text-orange-200 border border-orange-400/40 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                                Impayé
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">{t.groupe || '—'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">
                            {t.prix.toLocaleString('fr-FR')} Ar
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedTickets.length > 25 && (
                <p className="text-xs text-center text-teal-300 italic">
                  Affichage des 25 premiers billets sur {parsedTickets.length} au total.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-teal-500/40 bg-[#08535c] flex items-center justify-between shrink-0">
          {step === 'preview' ? (
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="text-xs text-teal-200 hover:text-white underline cursor-pointer"
            >
              ← Charger un autre fichier
            </button>
          ) : (
            <div></div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Annuler
            </button>

            {step === 'preview' && (
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>
                  Importer et appliquer ({parsedTickets.length} billets : {payesCount} payés, {distribuesCount} distribués)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
