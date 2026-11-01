import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Image as ImageIcon,
  Check,
  Upload,
  Trash2,
  Sliders,
  Eye,
  Layers,
  Sparkles,
  Palette,
  Maximize2,
  Minimize2,
  Columns,
  FileSpreadsheet,
} from 'lucide-react';
import { TicketItem } from './BilletsView';

interface TicketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: TicketItem[];
  selectedTicketIds: string[];
  campagnes: string[];
}

export type SizePresetKey = '10x5.5' | '14x7' | '12x6' | '9x5' | '8x4' | '18x8' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';
export type LayoutPresetKey = 'auto' | '10' | '8' | '6' | '4' | '2' | '1' | 'custom';
export type NumberPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'center';

export const TicketPrintModal: React.FC<TicketPrintModalProps> = ({
  isOpen,
  onClose,
  tickets,
  selectedTicketIds,
  campagnes,
}) => {
  if (!isOpen) return null;

  // Print Scope: 'selected' | 'all' | 'campagne'
  const [printScope, setPrintScope] = useState<'selected' | 'all' | 'campagne'>(
    selectedTicketIds.length > 0 ? 'selected' : 'all'
  );
  const [selectedCampagne, setSelectedCampagne] = useState<string>(campagnes[0] || '');

  // Orientation
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');

  // Ticket Dimensions
  const [sizePreset, setSizePreset] = useState<SizePresetKey>('10x5.5');
  const [customWidthCm, setCustomWidthCm] = useState<number>(10);
  const [customHeightCm, setCustomHeightCm] = useState<number>(5.5);

  // Layout / Grid
  const [layoutPreset, setLayoutPreset] = useState<LayoutPresetKey>('auto');
  const [customCols, setCustomCols] = useState<number>(2);
  const [customRows, setCustomRows] = useState<number>(5);

  // Background Image state
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [imageOpacity, setImageOpacity] = useState<number>(100);
  const [imageFit, setImageFit] = useState<'cover' | 'contain' | 'fill'>('cover');

  // Visual Styling
  const [borderColor, setBorderColor] = useState<string>('#2563eb'); // Bleu royal par défaut
  const [borderWidth, setBorderWidth] = useState<number>(2.5); // px
  const [numberPosition, setNumberPosition] = useState<NumberPosition>('bottom-right');
  const [showTextDetails, setShowTextDetails] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute ticket dimensions in mm
  const { ticketWidthMm, ticketHeightMm, labelSize } = useMemo(() => {
    switch (sizePreset) {
      case '10x5.5':
        return { ticketWidthMm: 100, ticketHeightMm: 55, labelSize: '10 cm × 5,5 cm (Standard)' };
      case '14x7':
        return { ticketWidthMm: 140, ticketHeightMm: 70, labelSize: '14 cm × 7 cm (Grand format)' };
      case '12x6':
        return { ticketWidthMm: 120, ticketHeightMm: 60, labelSize: '12 cm × 6 cm (Moyen / Coupon)' };
      case '9x5':
        return { ticketWidthMm: 90, ticketHeightMm: 50, labelSize: '9 cm × 5 cm (Format Carte)' };
      case '8x4':
        return { ticketWidthMm: 80, ticketHeightMm: 40, labelSize: '8 cm × 4 cm (Compact)' };
      case '18x8':
        return { ticketWidthMm: 180, ticketHeightMm: 80, labelSize: '18 cm × 8 cm (Avec souche)' };
      case 'custom':
      default: {
        const w = Math.max(30, Math.min(280, Math.round((Number(customWidthCm) || 10) * 10)));
        const h = Math.max(20, Math.min(280, Math.round((Number(customHeightCm) || 5.5) * 10)));
        return { ticketWidthMm: w, ticketHeightMm: h, labelSize: `${customWidthCm} cm × ${customHeightCm} cm (Personnalisé)` };
      }
    }
  }, [sizePreset, customWidthCm, customHeightCm]);

  // Page dimensions in mm (A4: 210 x 297 mm, usable printable area accounting for 6mm margins)
  const isPortrait = orientation === 'portrait';
  const pagePrintWidthMm = isPortrait ? 200 : 285;
  const pagePrintHeightMm = isPortrait ? 285 : 200;

  // Compute effective columns and rows
  const { effectiveCols, effectiveRows, ticketsPerPage } = useMemo(() => {
    if (layoutPreset === 'custom') {
      const c = Math.max(1, Math.min(6, customCols));
      const r = Math.max(1, Math.min(10, customRows));
      return { effectiveCols: c, effectiveRows: r, ticketsPerPage: c * r };
    }

    if (layoutPreset === '10') {
      return isPortrait
        ? { effectiveCols: 2, effectiveRows: 5, ticketsPerPage: 10 }
        : { effectiveCols: 5, effectiveRows: 2, ticketsPerPage: 10 };
    }
    if (layoutPreset === '8') {
      return isPortrait
        ? { effectiveCols: 2, effectiveRows: 4, ticketsPerPage: 8 }
        : { effectiveCols: 4, effectiveRows: 2, ticketsPerPage: 8 };
    }
    if (layoutPreset === '6') {
      return isPortrait
        ? { effectiveCols: 2, effectiveRows: 3, ticketsPerPage: 6 }
        : { effectiveCols: 3, effectiveRows: 2, ticketsPerPage: 6 };
    }
    if (layoutPreset === '4') {
      return { effectiveCols: 2, effectiveRows: 2, ticketsPerPage: 4 };
    }
    if (layoutPreset === '2') {
      return isPortrait
        ? { effectiveCols: 1, effectiveRows: 2, ticketsPerPage: 2 }
        : { effectiveCols: 2, effectiveRows: 1, ticketsPerPage: 2 };
    }
    if (layoutPreset === '1') {
      return { effectiveCols: 1, effectiveRows: 1, ticketsPerPage: 1 };
    }

    // Auto layout: fit maximum tickets given ticket dimensions and page orientation
    const fitCols = Math.max(1, Math.floor(pagePrintWidthMm / ticketWidthMm));
    const fitRows = Math.max(1, Math.floor(pagePrintHeightMm / ticketHeightMm));
    return { effectiveCols: fitCols, effectiveRows: fitRows, ticketsPerPage: fitCols * fitRows };
  }, [layoutPreset, customCols, customRows, isPortrait, pagePrintWidthMm, pagePrintHeightMm, ticketWidthMm, ticketHeightMm]);

  // Compute tickets to print
  const ticketsToPrint = useMemo(() => {
    let list: TicketItem[] = [];
    if (printScope === 'selected') {
      const idSet = new Set(selectedTicketIds);
      list = tickets.filter((t) => idSet.has(t.id));
      if (list.length === 0) list = tickets;
    } else if (printScope === 'campagne') {
      list = tickets.filter((t) => t.campagne === selectedCampagne);
    } else {
      list = tickets;
    }
    return [...list].sort((a, b) => a.numero - b.numero);
  }, [tickets, printScope, selectedTicketIds, selectedCampagne]);

  // Group tickets into page batches
  const a4Pages = useMemo(() => {
    const pages: TicketItem[][] = [];
    const perPage = Math.max(1, ticketsPerPage);
    for (let i = 0; i < ticketsToPrint.length; i += perPage) {
      pages.push(ticketsToPrint.slice(i, i + perPage));
    }
    if (pages.length === 0 && ticketsToPrint.length > 0) {
      pages.push(ticketsToPrint);
    }
    return pages;
  }, [ticketsToPrint, ticketsPerPage]);

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner un fichier image valide (PNG, JPG, WebP...).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatAr = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(val) + ' Ar';
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="ticket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn print:p-0 print:bg-white print:static print:block">
      {/* Dynamic Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 ${orientation};
            margin: 6mm 5mm !important;
          }

          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          /* Completely hide app shell, modal UI, and root */
          #root, .caisse-app-shell, .no-print, aside, nav, header {
            display: none !important;
          }

          /* Ensure modal container does not take empty page height */
          .ticket-modal-overlay {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          .tickets-print-container {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          .a4-page-sheet {
            display: grid !important;
            grid-template-columns: repeat(${effectiveCols}, ${ticketWidthMm}mm) !important;
            grid-template-rows: repeat(${effectiveRows}, ${ticketHeightMm}mm) !important;
            justify-content: center !important;
            align-content: center !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
          }

          .single-ticket-item {
            display: block !important;
            width: ${ticketWidthMm}mm !important;
            height: ${ticketHeightMm}mm !important;
            max-width: ${ticketWidthMm}mm !important;
            max-height: ${ticketHeightMm}mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            position: relative !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: ${borderWidth}px solid ${borderColor} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Modal Dialog (Hidden when printing) */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl text-gray-900 border border-gray-100 max-h-[95vh] flex flex-col overflow-hidden no-print">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 to-teal-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <span>Configuration d'Impression des Billets</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                  {labelSize} • {orientation === 'portrait' ? 'Portrait' : 'Paysage'}
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                {ticketsToPrint.length} billet{ticketsToPrint.length > 1 ? 's' : ''} à imprimer • Grille {effectiveCols}×{effectiveRows} ({ticketsPerPage}/page) • Soit {a4Pages.length} feuille{a4Pages.length > 1 ? 's' : ''} A4
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={ticketsToPrint.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Exporter PDF ({a4Pages.length} page{a4Pages.length > 1 ? 's' : ''})</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Controls & Right Live Interactive Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-gray-50/60">
          {/* LEFT COLUMN: Controls & Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Box 1: Orientation & Format Page */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Columns className="w-3.5 h-3.5 text-blue-600" />
                <span>1. Orientation & Format de la Page A4</span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition ${
                    orientation === 'portrait'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-6 h-8 border-2 border-current rounded-sm bg-current/10" />
                  <span>Portrait (Vertical)</span>
                  <span className="text-[10px] font-normal text-gray-500">210 × 297 mm</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition ${
                    orientation === 'landscape'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-6 border-2 border-current rounded-sm bg-current/10" />
                  <span>Paysage (Horizontal)</span>
                  <span className="text-[10px] font-normal text-gray-500">297 × 210 mm</span>
                </button>
              </div>
            </div>

            {/* Box 2: Ticket Dimensions */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Taille du Billet</span>
                </h3>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {ticketWidthMm / 10} × {ticketHeightMm / 10} cm
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: '10x5.5' as SizePresetKey, label: '10 cm × 5,5 cm', desc: 'Standard (10/page)' },
                  { key: '14x7' as SizePresetKey, label: '14 cm × 7 cm', desc: 'Grand format' },
                  { key: '12x6' as SizePresetKey, label: '12 cm × 6 cm', desc: 'Coupon / Moyen' },
                  { key: '9x5' as SizePresetKey, label: '9 cm × 5 cm', desc: 'Carte de visite' },
                  { key: '8x4' as SizePresetKey, label: '8 cm × 4 cm', desc: 'Mini ticket' },
                  { key: '18x8' as SizePresetKey, label: '18 cm × 8 cm', desc: 'Billet avec souche' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSizePreset(item.key)}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition ${
                      sizePreset === item.key
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold">{item.label}</div>
                    <div className="text-[10px] text-gray-500 font-normal">{item.desc}</div>
                  </button>
                ))}
              </div>

              {/* Custom Size Toggle */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSizePreset('custom')}
                  className={`w-full p-2 rounded-lg border text-xs font-bold flex items-center justify-between cursor-pointer transition ${
                    sizePreset === 'custom'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Personnaliser les dimensions</span>
                  <span className="text-[11px] font-normal text-blue-700">Saisir en cm</span>
                </button>

                {sizePreset === 'custom' && (
                  <div className="mt-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-200 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Largeur (cm) :</label>
                      <input
                        type="number"
                        step="0.5"
                        min="3"
                        max="28"
                        value={customWidthCm}
                        onChange={(e) => setCustomWidthCm(Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg p-1.5 font-bold text-gray-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-bold mb-1">Hauteur (cm) :</label>
                      <input
                        type="number"
                        step="0.5"
                        min="2"
                        max="28"
                        value={customHeightCm}
                        onChange={(e) => setCustomHeightCm(Number(e.target.value))}
                        className="w-full bg-white border border-gray-300 rounded-lg p-1.5 font-bold text-gray-900 text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Box 3: Nombre de billets par page (Grid) */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. Disposition & Billets par Page</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {effectiveCols} col × {effectiveRows} lig = {ticketsPerPage} / page
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[
                  { key: 'auto' as LayoutPresetKey, label: 'Auto' },
                  { key: '10' as LayoutPresetKey, label: '10 / p.' },
                  { key: '8' as LayoutPresetKey, label: '8 / p.' },
                  { key: '6' as LayoutPresetKey, label: '6 / p.' },
                  { key: '4' as LayoutPresetKey, label: '4 / p.' },
                  { key: '2' as LayoutPresetKey, label: '2 / p.' },
                  { key: '1' as LayoutPresetKey, label: '1 / p.' },
                  { key: 'custom' as LayoutPresetKey, label: 'Grille...' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLayoutPreset(item.key)}
                    className={`py-1.5 px-2 rounded-lg border text-center text-[11px] font-bold cursor-pointer transition ${
                      layoutPreset === item.key
                        ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {layoutPreset === 'custom' && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Colonnes :</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={customCols}
                      onChange={(e) => setCustomCols(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white border border-gray-300 rounded-lg p-1.5 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Rangées :</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={customRows}
                      onChange={(e) => setCustomRows(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white border border-gray-300 rounded-lg p-1.5 font-bold text-center"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Box 4: Background Image Upload Box */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>4. Image d'Arrière-Plan (Optionnel)</span>
                </h3>
                {backgroundImage && (
                  <button
                    onClick={() => setBackgroundImage(null)}
                    className="text-[11px] text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Retirer</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {backgroundImage ? (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 h-24 bg-gray-100 flex items-center justify-center group">
                    <img
                      src={backgroundImage}
                      alt="Arrière-plan billet"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 bg-white text-gray-800 rounded-lg text-xs font-bold shadow-xs hover:bg-gray-100 cursor-pointer"
                      >
                        Changer
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                      <span>Opacité de l'image</span>
                      <span>{imageOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={imageOpacity}
                      onChange={(e) => setImageOpacity(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-3.5 text-center cursor-pointer transition bg-gray-50/50 hover:bg-blue-50/30"
                >
                  <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-700">
                    Importer une image de fond
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    (Flyer, design officiel, motif...)
                  </p>
                </div>
              )}
            </div>

            {/* Box 5: Design & Options Visuelles */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3 text-xs">
              <h3 className="font-bold text-gray-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>5. Cadre & Emplacement du Numéro</span>
              </h3>

              {/* Border Color */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">Couleur du cadre :</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { color: '#2563eb', label: 'Bleu Royal' },
                    { color: '#1e40af', label: 'Bleu Marine' },
                    { color: '#00897b', label: 'Teal' },
                    { color: '#000000', label: 'Noir' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      onClick={() => setBorderColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className={`w-6 h-6 rounded-full cursor-pointer transition border-2 ${
                        borderColor === c.color ? 'border-gray-900 scale-110 shadow-xs' : 'border-white'
                      }`}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer p-0 overflow-hidden"
                    title="Couleur personnalisée"
                  />
                </div>
              </div>

              {/* Number Position */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-gray-600 font-medium">Position N° :</span>
                <div className="flex items-center gap-1">
                  {[
                    { key: 'bottom-right' as NumberPosition, label: 'Bas D.' },
                    { key: 'bottom-left' as NumberPosition, label: 'Bas G.' },
                    { key: 'top-right' as NumberPosition, label: 'Haut D.' },
                    { key: 'center' as NumberPosition, label: 'Centre' },
                  ].map((pos) => (
                    <button
                      key={pos.key}
                      onClick={() => setNumberPosition(pos.key)}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                        numberPosition === pos.key
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show text details toggle */}
              <label className="flex items-center gap-2 pt-2 border-t border-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTextDetails}
                  onChange={(e) => setShowTextDetails(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300"
                />
                <span className="text-gray-700 font-medium">
                  Afficher également le libellé & prix sur chaque billet
                </span>
              </label>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Interactive Previews (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Scope Selection Pills */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between text-xs">
              <span className="font-bold text-gray-700">Billets ciblés :</span>
              <div className="flex items-center gap-1.5">
                {selectedTicketIds.length > 0 && (
                  <button
                    onClick={() => setPrintScope('selected')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                      printScope === 'selected'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Sélectionnés ({selectedTicketIds.length})
                  </button>
                )}
                <button
                  onClick={() => setPrintScope('all')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                    printScope === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tous ({tickets.length})
                </button>
                {campagnes.length > 0 && (
                  <button
                    onClick={() => setPrintScope('campagne')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                      printScope === 'campagne'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Par campagne
                  </button>
                )}
              </div>
            </div>

            {/* Single Ticket Interactive Visual Preview */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Aperçu d'un billet individuel ({ticketWidthMm / 10} × {ticketHeightMm / 10} cm)</span>
                </span>
                <span className="text-[11px] text-gray-500">
                  Rendu visuel fidèle avant impression
                </span>
              </div>

              {/* Single Ticket Preview Canvas */}
              <div className="bg-gray-100/80 p-6 rounded-xl flex items-center justify-center border border-gray-200 min-h-[190px]">
                <div
                  style={{
                    width: `${Math.min(360, Math.round((ticketWidthMm / ticketHeightMm) * 160))}px`,
                    height: '160px',
                    borderColor: borderColor,
                    borderWidth: `${borderWidth}px`,
                    borderStyle: 'solid',
                    backgroundColor: '#ffffff',
                  }}
                  className="relative rounded-xs shadow-md overflow-hidden flex flex-col justify-between p-3 select-none"
                >
                  {/* Background Image if uploaded */}
                  {backgroundImage && (
                    <img
                      src={backgroundImage}
                      alt="Fond billet"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: imageFit,
                        opacity: imageOpacity / 100,
                        zIndex: 1,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Optional Campaign Title & Price */}
                  {showTextDetails ? (
                    <div className="relative z-10 space-y-1">
                      <span className="text-[11px] font-black uppercase text-gray-800 tracking-wider bg-white/90 px-1.5 py-0.5 rounded shadow-2xs">
                        {ticketsToPrint[0]?.campagne || 'BILLET OFFICIEL'}
                      </span>
                      <div className="text-xs font-bold text-blue-700 bg-white/90 px-1.5 py-0.5 rounded inline-block shadow-2xs">
                        Prix : {formatAr(ticketsToPrint[0]?.prix || 10000)}
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10">
                      {!backgroundImage && (
                        <span className="text-[10px] text-gray-400 italic">
                          (Espace libre pour design ou arrière-plan)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Number Box with dynamic position */}
                  <div
                    className={`relative z-10 ${
                      numberPosition === 'bottom-right'
                        ? 'self-end mt-auto'
                        : numberPosition === 'bottom-left'
                        ? 'self-start mt-auto'
                        : numberPosition === 'top-right'
                        ? 'self-end mb-auto'
                        : 'self-center my-auto'
                    }`}
                  >
                    <div
                      style={{
                        borderColor: borderColor,
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        backgroundColor: '#ffffff',
                      }}
                      className="px-2.5 py-1 rounded-xs shadow-xs flex items-center justify-center"
                    >
                      <span
                        style={{ color: borderColor }}
                        className="font-black font-mono text-sm tracking-widest"
                      >
                        N° {String(ticketsToPrint[0]?.numero || 1).padStart(4, '0')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* A4 Sheet Layout Visualizer */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3 text-xs flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-800">
                    Aperçu de la Feuille A4 ({orientation === 'portrait' ? 'Portrait 21×29,7 cm' : 'Paysage 29,7×21 cm'}) :
                  </span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 text-[11px]">
                    {effectiveCols} col × {effectiveRows} lig = {ticketsPerPage} billets / page
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Découpage optimisé pour le massicot ou les ciseaux. Chaque page A4 comportera exactement {ticketsPerPage} billet{ticketsPerPage > 1 ? 's' : ''}.
                </p>
              </div>

              {/* Miniature Layout Sheet Visualizer */}
              <div className="py-2 flex items-center justify-center">
                <div
                  style={{
                    width: isPortrait ? '140px' : '198px',
                    height: isPortrait ? '198px' : '140px',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
                    gridTemplateRows: `repeat(${effectiveRows}, 1fr)`,
                    gap: '2px',
                  }}
                  className="bg-white border-2 border-gray-400 rounded-sm p-1 shadow-md"
                >
                  {Array.from({ length: effectiveCols * effectiveRows }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{ borderColor: borderColor }}
                      className="border rounded-[1px] bg-blue-50/30 flex items-end justify-end p-0.5 overflow-hidden"
                    >
                      <span
                        className="text-[6px] font-mono font-bold leading-none scale-75"
                        style={{ color: borderColor }}
                      >
                        N°..
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-gray-600 text-[11px]">
                <span>Total : <strong>{ticketsToPrint.length}</strong> billets</span>
                <span>Nombre de pages A4 : <strong className="text-blue-700">{a4Pages.length}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-600 font-medium">
            Format : <strong className="text-gray-900">{labelSize}</strong> • <strong className="text-blue-700">{ticketsPerPage} billets</strong> par page {orientation} • Total : <strong className="text-gray-900">{a4Pages.length} page(s)</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer transition"
            >
              Fermer
            </button>
            <button
              onClick={handlePrint}
              disabled={ticketsToPrint.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Lancer l'impression A4 ({a4Pages.length} p.)</span>
            </button>
          </div>
        </div>
      </div>

      {/* PRINT CONTAINER: Visible ONLY during window.print() */}
      <div className="tickets-print-container hidden print:block">
        {a4Pages.map((pageTickets, pageIndex) => (
          <div key={pageIndex} className="a4-page-sheet">
            {pageTickets.map((t) => (
              <div
                key={t.id}
                className="single-ticket-item"
                style={{
                  width: `${ticketWidthMm}mm`,
                  height: `${ticketHeightMm}mm`,
                  borderColor: borderColor,
                  borderWidth: `${borderWidth}px`,
                  borderStyle: 'solid',
                  boxSizing: 'border-box',
                  position: 'relative',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                }}
              >
                {/* Physical <img> background for 100% reliable printing in Chrome/Android */}
                {backgroundImage && (
                  <img
                    src={backgroundImage}
                    alt=""
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: imageFit,
                      objectPosition: 'center',
                      opacity: imageOpacity / 100,
                      zIndex: 1,
                      pointerEvents: 'none',
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                    }}
                  />
                )}

                {/* Optional campaign title and price */}
                {showTextDetails && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '3mm',
                      left: '3mm',
                      zIndex: 3,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '8.5pt',
                        fontWeight: 'bold',
                        color: '#111827',
                        backgroundColor: 'rgba(255, 255, 255, 0.92)',
                        padding: '1mm 2mm',
                        borderRadius: '1mm',
                        display: 'inline-block',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      {t.campagne}
                    </div>
                    <div
                      style={{
                        fontSize: '7.5pt',
                        fontWeight: 'bold',
                        color: borderColor,
                        backgroundColor: 'rgba(255, 255, 255, 0.92)',
                        padding: '1mm 2mm',
                        borderRadius: '1mm',
                        marginTop: '1mm',
                        display: 'inline-block',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      Prix : {formatAr(t.prix)}
                    </div>
                  </div>
                )}

                {/* Number Box with dynamic positioning */}
                <div
                  style={{
                    position: 'absolute',
                    top: numberPosition === 'top-right' ? '3mm' : undefined,
                    bottom: numberPosition === 'bottom-right' || numberPosition === 'bottom-left' ? '3mm' : undefined,
                    right: numberPosition === 'bottom-right' || numberPosition === 'top-right' ? '3mm' : undefined,
                    left: numberPosition === 'bottom-left' ? '3mm' : numberPosition === 'center' ? '50%' : undefined,
                    transform: numberPosition === 'center' ? 'translate(-50%, -50%)' : undefined,
                    marginTop: numberPosition === 'center' ? 'auto' : undefined,
                    marginBottom: numberPosition === 'center' ? 'auto' : undefined,
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      borderColor: borderColor,
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      backgroundColor: '#ffffff',
                      padding: '1.5mm 3.5mm',
                      borderRadius: '1mm',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                    }}
                  >
                    <span
                      style={{
                        color: borderColor,
                        fontWeight: '900',
                        fontFamily: 'monospace',
                        fontSize: '11pt',
                        letterSpacing: '1px',
                        lineHeight: 1,
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      N° {String(t.numero).padStart(4, '0')}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Placeholders for remaining slots on the last page to maintain grid structure */}
            {Array.from({ length: Math.max(0, ticketsPerPage - pageTickets.length) }).map((_, emptyIdx) => (
              <div
                key={`empty-${emptyIdx}`}
                className="single-ticket-item"
                style={{
                  width: `${ticketWidthMm}mm`,
                  height: `${ticketHeightMm}mm`,
                  border: '1px dashed #e2e8f0',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
};
