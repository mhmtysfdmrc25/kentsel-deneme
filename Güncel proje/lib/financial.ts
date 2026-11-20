import type { Project } from './projects';
import { deriveSection, isShareableUnit, readSimulator, type SimulatorScenario } from './simulator.ts';

const amountFields = ['residentialRate', 'commercialRate', 'monthlyRent', 'movingAid'] as const;
const countFields = ['ownerHomes', 'rentMonths'] as const;
const percentageFields = ['marketingRate', 'financeRate', 'riskRate'] as const;
export const MAX_FINANCIAL_VALUE = 1_000_000_000_000;

export type FinancialScenario = Record<(typeof amountFields | typeof countFields | typeof percentageFields)[number], number | null> & {
  useAveragePrices: boolean;
  unitPrices: Record<string, number>;
};

export const emptyFinancialScenario = (): FinancialScenario => ({
  residentialRate: null, commercialRate: null, monthlyRent: null, movingAid: null,
  ownerHomes: null, rentMonths: null, marketingRate: null, financeRate: null, riskRate: null,
  useAveragePrices: true, unitPrices: {},
});

function validNumber(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
}

export function validateFinancialScenario(value: unknown): FinancialScenario {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Geçersiz finansal senaryo.');
  const input = value as Record<string, unknown>;
  const scenario = emptyFinancialScenario();
  for (const field of [...amountFields, ...countFields, ...percentageFields]) {
    const entry = input[field];
    if (entry == null) continue;
    const percentage = (percentageFields as readonly string[]).includes(field);
    const integer = (countFields as readonly string[]).includes(field);
    if (!validNumber(entry, percentage ? 100 : MAX_FINANCIAL_VALUE) || (integer && !Number.isInteger(entry))) {
      throw new Error('Tutar ve adetleri sıfır veya daha büyük, yüzdeleri 0–100 arasında girin.');
    }
    scenario[field] = entry;
  }
  if (input.useAveragePrices !== undefined) {
    if (typeof input.useAveragePrices !== 'boolean') throw new Error('Geçersiz satış fiyatı seçimi.');
    scenario.useAveragePrices = input.useAveragePrices;
  }
  if (input.unitPrices !== undefined) {
    if (!input.unitPrices || typeof input.unitPrices !== 'object' || Array.isArray(input.unitPrices)) throw new Error('Geçersiz bölüm fiyatları.');
    for (const [id, price] of Object.entries(input.unitPrices)) {
      if (!/^(?:roof|ground|(?:normal|basement)-(?:[1-9]\d?|100)):[0-5]$/u.test(id) || !validNumber(price, MAX_FINANCIAL_VALUE)) {
        throw new Error('Bağımsız bölüm fiyatı geçersiz.');
      }
      scenario.unitPrices[id] = price;
    }
  }
  return scenario;
}

export function readFinancialScenario(json: string | null): FinancialScenario {
  if (json) {
    try { return validateFinancialScenario(JSON.parse(json)); }
    catch { /* A new draft can be opened when the saved data is invalid. */ }
  }
  return emptyFinancialScenario();
}

export function financialInventory(project: Project, draft?: SimulatorScenario) {
  const scenario = draft ?? readSimulator(project);
  const units = scenario?.design ? deriveSection(project, scenario, scenario.design).floors.flatMap(floor =>
    floor.units.filter(unit => isShareableUnit(unit.type)).map(unit => ({ ...unit, floor: floor.label })),
  ) : [];
  const ownerUnits = units.filter(unit => !unit.isContractorShare);
  return {
    ownerUnits: ownerUnits.length,
    ownerHomes: ownerUnits.filter(unit => unit.type !== 'shop').length,
    contractorUnits: units.filter(unit => unit.isContractorShare),
  };
}

type Inventory = ReturnType<typeof financialInventory>;
type Expense = { id: string; label: string; amount: number | null };

function sum(values: (number | null)[]) {
  if (values.some(value => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function ratio(numerator: number | null, denominator: number | null) {
  return numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator * 100;
}

function percentOf(base: number | null, rate: number | null) {
  return rate ? (base === null ? null : base * rate / 100) : 0;
}

export function calculateFinancial(scenario: FinancialScenario, inventory: Inventory, costTotal: number | null, includedAid: number | null) {
  const homes = inventory.contractorUnits.filter(unit => unit.type !== 'shop');
  const shops = inventory.contractorUnits.filter(unit => unit.type === 'shop');
  const sales = inventory.contractorUnits.map(unit => {
    const rate = unit.type === 'shop' ? scenario.commercialRate : scenario.residentialRate;
    const manual = scenario.useAveragePrices ? undefined : scenario.unitPrices[unit.id];
    return { ...unit, sale: manual ?? (unit.gross === null || rate === null ? null : unit.gross * rate) };
  });
  const revenue = sales.length ? sum(sales.map(unit => unit.sale)) : null;
  const ownerHomes = scenario.ownerHomes ?? inventory.ownerHomes;
  const aidConfigured = scenario.monthlyRent !== null || scenario.rentMonths !== null || scenario.movingAid !== null;
  const construction = costTotal === null ? null : costTotal - (includedAid ?? 0);
  const rentIncomplete = ownerHomes > 0 && (
    (Boolean(scenario.monthlyRent) && scenario.rentMonths === null) ||
    (Boolean(scenario.rentMonths) && scenario.monthlyRent === null)
  );
  const rent = rentIncomplete ? null : ownerHomes * (scenario.monthlyRent ?? 0) * (scenario.rentMonths ?? 0);
  const moving = ownerHomes * (scenario.movingAid ?? 0);
  const expenseLines: Expense[] = [{ id: 'construction', label: 'İnşaat maliyeti', amount: construction }];
  if (!aidConfigured && includedAid) {
    expenseLines.push({ id: 'saved-aid', label: 'Kira ve taşınma (Maliyet Analizi)', amount: includedAid });
  } else {
    expenseLines.push(
      { id: 'rent', label: 'Kira yardımı', amount: rent },
      { id: 'moving', label: 'Taşınma yardımı', amount: moving },
    );
  }
  const base = sum(expenseLines.map(expense => expense.amount));
  expenseLines.push(
    { id: 'marketing', label: 'Pazarlama ve komisyon', amount: percentOf(revenue, scenario.marketingRate) },
    { id: 'finance', label: 'Finansman', amount: percentOf(base, scenario.financeRate) },
    { id: 'risk', label: 'Beklenmeyen giderler', amount: percentOf(base, scenario.riskRate) },
  );
  const totalCost = sum(expenseLines.map(expense => expense.amount));
  const profit = revenue === null || totalCost === null ? null : revenue - totalCost;
  return {
    sales, revenue, totalCost, profit, expenseLines, ownerHomes, rentIncomplete,
    margin: ratio(profit, revenue), roi: ratio(profit, totalCost),
    grossArea: sales.length ? sum(sales.map(unit => unit.gross)) : null,
    netArea: sales.length ? sum(sales.map(unit => unit.net)) : null,
    residentialArea: sum(homes.map(unit => unit.gross)),
    commercialArea: sum(shops.map(unit => unit.gross)),
  };
}
