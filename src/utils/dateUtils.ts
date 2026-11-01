export type DatePeriodFilter =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

/**
 * Robust date parser for transactions dates in various formats:
 * - ISO: 2026-10-23 or 2026-10-23T14:30:00
 * - French numeric: 23/10/2026, 23-10-2026
 * - French text: 23 oct. 2026, 23 octobre 2026
 */
export function parseTxDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  const clean = String(dateStr).trim();

  // Match DD/MM/YYYY or DD-MM-YYYY with optional HH:mm[:ss]
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
  }

  // Match YYYY-MM-DD or YYYY/MM/DD with optional HH:mm[:ss]
  const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
  }

  // French month names
  const monthMap: Record<string, number> = {
    'janv.': 0,
    janvier: 0,
    'févr.': 1,
    février: 1,
    mars: 2,
    'avr.': 3,
    avril: 3,
    mai: 4,
    juin: 5,
    'juil.': 6,
    juillet: 6,
    août: 7,
    'sept.': 8,
    septembre: 8,
    'oct.': 9,
    octobre: 9,
    'nov.': 10,
    novembre: 10,
    'déc.': 11,
    décembre: 11,
  };

  const m = clean.match(/(\d+)\s+([a-zéû.]+)\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = monthMap[m[2].toLowerCase()] ?? 0;
    const year = parseInt(m[3], 10);
    return new Date(year, month, day);
  }

  const isoTry = Date.parse(clean.replace(' ', 'T'));
  if (!isNaN(isoTry)) return new Date(isoTry);

  return new Date();
}

export interface PeriodInfo {
  start: Date | null;
  end: Date | null;
  label: string;
  rangeText: string;
}

export function getPeriodDateRange(
  period: DatePeriodFilter,
  customStart?: string,
  customEnd?: string
): PeriodInfo {
  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const monthName = (d: Date) =>
    d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        start,
        end,
        label: "Aujourd'hui",
        rangeText: fmt(start),
      };
    }

    case 'yesterday': {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return {
        start,
        end,
        label: 'Hier',
        rangeText: fmt(start),
      };
    }

    case 'this_week': {
      const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - dayOfWeek,
        0,
        0,
        0,
        0
      );
      const end = new Date(start.getTime() + 7 * 86400000 - 1);
      return {
        start,
        end,
        label: 'Cette semaine',
        rangeText: `Du ${fmt(start)} au ${fmt(end)}`,
      };
    }

    case 'last_week': {
      const dayOfWeek = (now.getDay() + 6) % 7;
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - dayOfWeek - 7,
        0,
        0,
        0,
        0
      );
      const end = new Date(start.getTime() + 7 * 86400000 - 1);
      return {
        start,
        end,
        label: 'Semaine dernière',
        rangeText: `Du ${fmt(start)} au ${fmt(end)}`,
      };
    }

    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const capitalMonth = monthName(now).charAt(0).toUpperCase() + monthName(now).slice(1);
      return {
        start,
        end,
        label: `Ce mois-ci (${capitalMonth})`,
        rangeText: `Du ${fmt(start)} au ${fmt(end)}`,
      };
    }

    case 'last_month': {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const start = new Date(
        lastMonthDate.getFullYear(),
        lastMonthDate.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      const end = new Date(
        lastMonthDate.getFullYear(),
        lastMonthDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      const capitalMonth =
        monthName(lastMonthDate).charAt(0).toUpperCase() + monthName(lastMonthDate).slice(1);
      return {
        start,
        end,
        label: `Mois dernier (${capitalMonth})`,
        rangeText: `Du ${fmt(start)} au ${fmt(end)}`,
      };
    }

    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return {
        start,
        end,
        label: `Cette année (${now.getFullYear()})`,
        rangeText: `Du ${fmt(start)} au ${fmt(end)}`,
      };
    }

    case 'custom': {
      let start: Date | null = null;
      let end: Date | null = null;

      if (customStart) {
        const [y, m, d] = customStart.split('-').map((v) => parseInt(v, 10));
        if (y && m && d) {
          start = new Date(y, m - 1, d, 0, 0, 0, 0);
        }
      }

      if (customEnd) {
        const [y, m, d] = customEnd.split('-').map((v) => parseInt(v, 10));
        if (y && m && d) {
          end = new Date(y, m - 1, d, 23, 59, 59, 999);
        }
      }

      let rangeText = 'Toutes les dates';
      if (start && end) {
        rangeText = `Du ${fmt(start)} au ${fmt(end)}`;
      } else if (start) {
        rangeText = `À partir du ${fmt(start)}`;
      } else if (end) {
        rangeText = `Jusqu'au ${fmt(end)}`;
      }

      return {
        start,
        end,
        label: 'Période personnalisée',
        rangeText,
      };
    }

    case 'all':
    default:
      return {
        start: null,
        end: null,
        label: 'Toutes les dates',
        rangeText: 'Toutes les opérations enregistrées',
      };
  }
}
