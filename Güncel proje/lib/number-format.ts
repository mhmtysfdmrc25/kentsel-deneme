const localizedNumber = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const editableNumber = new Intl.NumberFormat('tr-TR', { useGrouping: false, maximumFractionDigits: 2 });

export function formatNumber(value: number, grouped = true) {
  return (grouped ? localizedNumber : editableNumber).format(value);
}

export function parseNumberInput(text: string, unit: string, max: number, integer = false): number | null | undefined {
  let raw = text.trim();
  if ((unit.startsWith('TL') && raw.startsWith('₺')) || (unit === '%' && raw.startsWith('%'))) raw = raw.slice(1).trim();
  for (const suffix of unit.startsWith('TL') ? [unit, 'TL', '₺'] : [unit]) {
    if (raw.toLocaleLowerCase('tr-TR').endsWith(suffix.toLocaleLowerCase('tr-TR'))) {
      raw = raw.slice(0, -suffix.length).trim();
      break;
    }
  }
  if (!raw) return null;
  const whole = '(?:\\d+|\\d{1,3}(?:\\.\\d{3})+)';
  const localized = new RegExp(`^${whole}${integer ? '' : '(?:,\\d{0,2})?'}$`, 'u');
  let value: number;
  if (localized.test(raw)) value = Number(raw.replaceAll('.', '').replace(',', '.'));
  else if (!integer && /^\d+\.\d{0,2}$/u.test(raw)) value = Number(raw);
  else return undefined;
  return Number.isFinite(value) && value <= max ? value : undefined;
}
