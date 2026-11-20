// Run after npm run build. All writes are confined to a fresh temporary directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const Database = require('better-sqlite3');
const { simulate, emptyScenario, validateScenario } = require('../lib/scenario.ts');
const { quickTotal, detailedTotal, savedQuickAid } = require('../lib/costs.ts');
const { deriveSection, emptyDesign, validateDesign, validateSimulator } = require('../lib/simulator.ts');
const { DEFAULT_RULE_SETTINGS, evaluateImarRules, locksFor, normalizeRuleSettings } = require('../lib/imarRules.ts');
const { calculateFinancial, emptyFinancialScenario, financialInventory, validateFinancialScenario } = require('../lib/financial.ts');
const { formatNumber, parseNumberInput } = require('../lib/number-format.ts');

function testSection() {
  const parcel = { arsa_alani: 1000, taks: 0.4, kaks: 2 };
  const design = {
    ...emptyDesign(),
    normalFloors: 2,
    basementFloors: 2,
    columns: 3,
    headings: ['ÖN CEPHE', 'ARKA CEPHE', 'YAN CEPHE'],
    duplex: true,
    contractorFloors: ['normal-2', 'basement-1', 'basement-2'],
    floorAreas: { 'normal-1': 450 },
    units: { 'ground:0': { title: 'Köşe Dükkan', type: 'shop', gross: 125, totalGross: 160 } },
  };
  const scenario = { ...emptyScenario(), projection: true };
  const section = deriveSection(parcel, scenario, validateDesign(design));
  const [roof, top, lower, ground, basement, service] = section.floors;
  assert.deepEqual(section.floors.map(floor => floor.id), ['roof', 'normal-2', 'normal-1', 'ground', 'basement-1', 'basement-2']);
  assert.equal(section.totalFloors, 5);
  assert.equal(section.totalUnits, 12);
  assert.equal(roof.area, 0);
  assert.equal(roof.units.length, 0);
  assert.equal(top.contractor, true);
  assert.ok(top.units.every(unit => unit.type === 'duplex' && unit.roofArrow));
  assert.equal(lower.area, 450);
  assert.deepEqual(lower.units.map(unit => unit.gross), [150, 150, 150]);
  assert.equal(ground.inset, true);
  assert.equal(basement.inset, true);
  assert.equal(basement.contractor, true);
  assert.equal(ground.units[0].gross, 125);
  assert.equal(ground.units[0].totalGross, 125);
  assert.ok(Math.abs(ground.units[1].totalGross - (400 / 3 + 400 / 11)) < 1e-9);
  const updatedService = deriveSection(parcel, scenario, { ...design, floorAreas: { ...design.floorAreas, 'basement-2': 300 } });
  assert.equal(updatedService.floors.find(floor => floor.service).area, 300);
  assert.ok(Math.abs(updatedService.floors.find(floor => floor.id === 'ground').units[1].totalGross - (400 / 3 + 300 / 11)) < 1e-9);
  const fifteen = deriveSection(parcel, scenario, { ...emptyDesign(), normalFloors: 4, basementFloors: 1, columns: 3, floorAreas: { 'basement-1': 300 } });
  assert.equal(fifteen.totalUnits, 15);
  const firstApartment = fifteen.floors.find(floor => floor.id === 'ground').units[0];
  assert.equal(firstApartment.totalGross, firstApartment.gross + 20);
  const noService = deriveSection(parcel, scenario, { ...design, serviceBasement: false });
  assert.equal(noService.floors.find(floor => floor.id === 'ground').units[0].totalGross, 125);
  assert.equal(service.service, true);
  assert.equal(service.inset, false);
  assert.equal(service.contractor, false);
  assert.equal(service.units.length, 0);
  assert.ok(Math.abs(section.totalArea - (400 * 3 + 450 + 125 + 2 * (400 / 3))) < 1e-9);
  const noProjection = deriveSection(parcel, emptyScenario(), design);
  assert.ok(noProjection.floors.every(floor => !floor.inset));
  const noGround = deriveSection(parcel, scenario, { ...design, ground: false, basementFloors: 1, duplex: false });
  assert.deepEqual(noGround.floors.map(floor => floor.id), ['normal-2', 'normal-1', 'basement-1']);
  assert.equal(noGround.totalUnits, 6);
  const noGroundWithApartmentBasement = deriveSection(parcel, scenario, { ...design, ground: false });
  assert.equal(noGroundWithApartmentBasement.floors.find(floor => floor.id === 'basement-1').inset, true);
  assert.ok(Math.abs(deriveSection({ ...parcel, taks: null }, scenario, emptyDesign()).totalArea - 2000) < 1e-9);
  assert.equal(deriveSection({ ...parcel, taks: null, kaks: null }, scenario, emptyDesign()).totalArea, null);
  assert.throws(() => validateDesign({ ...design, columns: 7 }), /Sütun sayısı/);
  assert.equal(validateDesign({ ...design, serviceTitle: 'OTOPARK / SIĞINAK / ORTAK ALAN' }).serviceTitle, 'OTOPARK / SIĞINAK / ORTAK ALAN');
  assert.equal(validateDesign(design).serviceTitle, undefined);
  assert.throws(() => validateDesign({ ...design, floorAreas: { ground: -5 } }), /Kesit alanı/);
  assert.throws(() => validateDesign({ ...design, units: { 'invalid:0': { title: 'Daire' } } }), /kimliği/);
  assert.throws(() => validateDesign({ ...design, units: { 'normal-1:0': { gross: 81, totalGross: 80 } } }), /brüt/i);
  assert.deepEqual(validateSimulator(scenario), scenario);
}

function testRuleSection() {
  const parcel = { semt: 'Avcılar', arsa_alani: 1000, taks: 0.4, kaks: 4 };
  const scenario = { ...emptyScenario(), bonus: true, narrow: true, heightLimit: true };
  const rules = {
    ...DEFAULT_RULE_SETTINGS,
    use: 'ground-commercial', order: 'attached', frontGarden: false, sideProjection: true,
    projection: 'closed', roofShape: 'mansard', mezzanine: true, portico: true,
  };
  const design = {
    ...emptyDesign(), normalFloors: 7, contractorFloors: ['ground'], rules,
    units: { 'ground:0': { isContractorShare: false }, 'normal-7:1': { isContractorShare: true }, 'basement-1:0': { isContractorShare: true } },
  };
  const section = deriveSection(parcel, scenario, design);
  const floor = id => section.floors.find(value => value.id === id);
  assert.equal(section.projection, 'open');
  assert.equal(section.roofShape, 'mansard');
  assert.equal(floor('roof').units.length, 0);
  assert.equal(floor('ground').units[0].type, 'shop');
  assert.equal(floor('ground').units[0].isContractorShare, false);
  assert.equal(floor('ground').units[1].isContractorShare, true);
  assert.equal(floor('normal-7').units[0].isContractorShare, false);
  assert.equal(floor('normal-7').units[1].isContractorShare, true);
  assert.equal(floor('basement-1').units[0].type, 'storage');
  assert.equal(floor('basement-1').units[0].isContractorShare, false);
  assert.ok(!floor('basement-1').units[0].allowedTypes.includes('apartment'));
  assert.equal(section.totalUnits, 16);
  assert.equal(section.totalFloors, 10);

  const report = evaluateImarRules(parcel, design, section, rules, scenario);
  assert.equal(report.calculations.bonusPool, 1200);
  assert.equal(report.calculations.contractor.count, 2);
  assert.equal(report.calculations.contractor.area, 400);
  assert.equal(report.calculations.owner.count, 14);
  const blockRules = { ...rules, regime: 'block', blockWidth: 10, blockDepth: 20 };
  const blockSection = deriveSection(parcel, scenario, { ...design, rules: blockRules });
  assert.equal(blockSection.floors.find(value => value.id === 'normal-1').area, 200);
  assert.ok(report.legalNotes.some(note => note.id === 'lost-emsal' && note.severity === 'critical'));
  assert.ok(report.legalNotes.some(note => note.id === 'elevator' && note.source));
  const normalized = normalizeRuleSettings(parcel, design, rules, scenario);
  assert.equal(normalized.sideGarden, false);
  assert.equal(normalized.sideProjection, false);
  assert.equal(normalized.mezzanine, false);
  assert.equal(normalized.portico, true);
  assert.equal(locksFor(parcel, design, { ...rules, use: 'mixed' }, scenario).mezzanine.disabled, true);
  assert.equal(locksFor(parcel, design, { ...rules, use: 'commercial' }, scenario).mezzanine.disabled, true);

  const residential = { ...DEFAULT_RULE_SETTINGS, subasman: 1 };
  const basementDesign = { ...emptyDesign(), serviceBasement: false, rules: residential };
  const flat = deriveSection(parcel, emptyScenario(), basementDesign);
  assert.equal(flat.floors.find(value => value.id === 'basement-1').units[0].type, 'apartment');
  assert.equal(flat.floors.find(value => value.id === 'basement-2').units[0].type, 'storage');
  const exposed = { ...emptyScenario(), slope: true };
  const withCrest = { ...residential, flood: true, floodCrest: 12, basementOpeningElevation: 13.5 };
  assert.equal(locksFor(parcel, basementDesign, withCrest, exposed).basementHabitation.disabled, false);
  const lowCrest = { ...withCrest, basementOpeningElevation: 13.49, basementParking: true, basementOpenings: true };
  const flood = deriveSection(parcel, exposed, { ...basementDesign, serviceBasement: true, rules: lowCrest });
  const basement = flood.floors.find(value => value.id === 'basement-1');
  assert.deepEqual(basement.units[0].allowedTypes, ['storage']);
  assert.equal(flood.floors.find(value => value.id === 'basement-2').serviceLabel, 'SIĞINAK / TEKNİK ALAN');
  const floodSettings = normalizeRuleSettings(parcel, basementDesign, lowCrest, exposed);
  assert.equal(floodSettings.basementParking, false);
  assert.equal(floodSettings.basementOpenings, false);

  assert.deepEqual(validateDesign(emptyDesign()), emptyDesign());
  assert.equal(validateDesign(design).units['ground:0'].isContractorShare, false);
  assert.throws(() => validateDesign({ ...design, units: { 'ground:0': { isContractorShare: 'true' } } }), /Kesit seçimleri/);
}

function testRoofUsage() {
  const parcel = { semt: 'Avcılar', arsa_alani: 1000, taks: 0.4, kaks: 1 };
  const scenario = emptyScenario();
  const design = {
    ...emptyDesign(),
    normalFloors: 1, basementFloors: 1, contractorFloors: ['roof'],
    floorAreas: { roof: 120, 'basement-1': 80 },
    units: { 'roof:0': { gross: 73, isContractorShare: false } },
  };
  const withRoof = (roofShape, roofUsage) => validateDesign({ ...design, rules: { roofShape, roofUsage } });
  const derive = draft => deriveSection(parcel, scenario, draft);
  const cold = derive(withRoof('mansard', 'cold'));
  assert.equal(cold.floors[0].area, 0);
  assert.equal(cold.floors[0].label, 'ÇATI BOŞLUĞU');
  assert.equal(cold.totalArea, 880);

  for (const roofShape of ['pitched', 'mansard']) {
    const duplex = derive(withRoof(roofShape, 'duplex'));
    assert.equal(duplex.totalUnits, cold.totalUnits);
    assert.equal(duplex.floors[1].area, 400);
    assert.deepEqual(duplex.floors[1].units.map(unit => [unit.roofArrow, unit.gross, unit.totalGross]), [[true, 260, 280], [true, 260, 280]]);
    assert.equal(duplex.totalArea, 1000);
  }
  const independentDesign = withRoof('mansard', 'independent');
  const independent = derive(independentDesign);
  assert.equal(independent.totalUnits, cold.totalUnits + design.columns);
  assert.equal(independent.totalFloors, cold.totalFloors + 1);
  assert.equal(independent.floors[0].area, 133);
  assert.equal(independent.floors[0].label, 'ÇATI KATI');
  assert.deepEqual(independent.floors[0].units.map(unit => [unit.gross, unit.isContractorShare]), [[73, false], [60, true]]);
  const report = evaluateImarRules(parcel, independentDesign, independent, independentDesign.rules, scenario);
  assert.equal(report.calculations.estimatedEmsalUse, 1013);
  assert.equal(report.calculations.emsalExcess, 13);
  assert.equal(report.calculations.contractor.area, 60);
  assert.ok(report.legalNotes.some(note => note.id === 'roof-independent' && note.severity === 'warning'));
  assert.equal(derive(withRoof('terrace', 'duplex')).roofUsage, 'none');
  const pitched = withRoof('pitched', 'independent');
  assert.match(locksFor(parcel, pitched, pitched.rules, scenario).roofIndependent.reason, /40\/7/);
  assert.equal(derive(pitched).roofUsage, 'cold');

  for (const [oldRoof, shape, usage] of [
    ['void', 'pitched', 'cold'], ['duplex', 'pitched', 'duplex'],
    ['mansard', 'mansard', 'cold'], ['terrace', 'terrace', 'none'],
  ]) {
    const migrated = validateDesign({ ...design, rules: { roof: oldRoof } });
    assert.equal(migrated.rules.roofShape, shape);
    assert.equal(migrated.rules.roofUsage, usage);
  }
  assert.equal(validateDesign({ ...design, duplex: true, rules: {} }).rules.roofUsage, 'duplex');
}

function testFinancial() {
  const design = {
    ...emptyDesign(), normalFloors: 1, basementFloors: 0,
    units: {
      'normal-1:0': { gross: 100, net: 80, isContractorShare: true },
      'ground:0': { type: 'shop', gross: 60, net: 48, isContractorShare: true },
    },
  };
  const project = {
    arsa_alani: 1000, taks: 0.4, cost_mode: 'quick', quick_cost_data: JSON.stringify({ rent: 20000 }),
    architectural_scenarios: JSON.stringify({ ...emptyScenario(), design }),
  };
  const inventory = financialInventory(project);
  const includedAid = savedQuickAid(project, 520000);
  assert.equal(includedAid, 20000);
  assert.equal(savedQuickAid({ ...project, cost_mode: 'detailed' }, 520000), null);
  assert.equal(inventory.ownerHomes, 2);
  assert.equal(inventory.ownerUnits, 2);
  const input = {
    ...emptyFinancialScenario(), residentialRate: 10000, commercialRate: 20000, ownerHomes: 1,
    monthlyRent: 4000, rentMonths: 10, movingAid: 5000, marketingRate: 2, financeRate: 10, riskRate: 5,
  };
  const result = calculateFinancial(input, inventory, 520000, includedAid);
  assert.equal(result.revenue, 2200000);
  assert.equal(result.totalCost, 670750);
  assert.equal(result.profit, 1529250);
  assert.equal(result.margin, 1529250 / 2200000 * 100);
  assert.equal(result.roi, 1529250 / 670750 * 100);
  assert.deepEqual(result.expenseLines.map(expense => expense.amount), [500000, 40000, 5000, 44000, 54500, 27250]);
  assert.deepEqual([result.grossArea, result.netArea, result.residentialArea, result.commercialArea], [160, 128, 100, 60]);
  assert.equal(calculateFinancial(emptyFinancialScenario(), inventory, 520000, includedAid).totalCost, 520000);
  assert.equal(calculateFinancial({ ...input, ownerHomes: null }, inventory, 520000, includedAid).ownerHomes, 2);
  assert.equal(calculateFinancial({ ...input, rentMonths: null }, inventory, 520000, includedAid).totalCost, null);
  const custom = calculateFinancial({ ...input, useAveragePrices: false, unitPrices: { 'normal-1:0': 0, 'roof:0': 999 } }, inventory, 520000, includedAid);
  assert.equal(custom.revenue, 1200000);
  const zero = calculateFinancial({ ...emptyFinancialScenario(), residentialRate: 0, commercialRate: 0 }, inventory, 100, null);
  assert.equal(zero.profit, -100);
  assert.equal(zero.margin, null);
  assert.equal(zero.roi, -100);
  assert.equal(calculateFinancial(input, inventory, null, null).profit, null);
  const changed = financialInventory(project, { ...emptyScenario(), design: { ...design, units: {} } });
  assert.equal(calculateFinancial(input, changed, 520000, includedAid).revenue, null);
  assert.equal(financialInventory({}).contractorUnits.length, 0);
  assert.throws(() => validateFinancialScenario({ rentMonths: 2.5 }), /adetleri/);
  assert.throws(() => validateFinancialScenario({ financeRate: 101 }), /yüzdeleri/);
  assert.throws(() => validateFinancialScenario({ unitPrices: { invalid: 1 } }), /bölüm fiyatı/);
  for (const [entered, unit, max, integer, expected] of [
    ['1.500.000 TL', 'TL', 2000000, false, 1500000],
    ['₺1.500,50', 'TL', 2000, false, 1500.5],
    ['20.000,75 TL/m²', 'TL/m²', 50000, false, 20000.75],
    ['%2,5', '%', 100, false, 2.5],
    ['65,25 m²', 'm²', 1000, false, 65.25],
    ['65.25', 'm²', 1000, false, 65.25],
    ['2,5', 'Ay', 100, true, undefined],
    ['101', '%', 100, false, undefined],
  ]) assert.equal(parseNumberInput(entered, unit, max, integer), expected);
  assert.equal(formatNumber(1500000), '1.500.000');
}

async function main() {
  testSection();
  testRuleSection();
  testRoofUsage();
  testFinancial();
  const input = { arsa_alani: 1000, taks: 0.4, kaks: 2, daire_sayisi: 31, dukkan_sayisi: 1, insaat_alani: 1600, binalar_detay: JSON.stringify([{ daire_sayisi: 31, dukkan_sayisi: 1, normal_kat: 8, bodrum_kat: 1, giriste_daire_yok: false }]) };
  const test = simulate(input, { ...emptyScenario(), bonus: true, slope: true, exposedFloors: 2, narrow: true, heightLimit: true });
  assert.equal(test.kaksArea, 2000); assert.equal(test.gross, 2600); assert.equal(test.slopeArea, 800);
  assert.equal(test.units, 32); assert.equal(test.floors, 10); assert.equal(test.constraint, 'both');
  assert.ok(test.shelter && test.elevator && test.highRise && test.caretaker);
  assert.equal(simulate(input, { ...emptyScenario(), narrow: true }).constraint, 'narrow');
  assert.equal(simulate(input, { ...emptyScenario(), heightLimit: true }).constraint, 'height');
  assert.equal(simulate({ ...input, arsa_alani: null }, emptyScenario()).gross, null);
  assert.throws(() => validateScenario({ ...emptyScenario(), exposedFloors: -1 }));
  const quick = { parking: true, parkingArea: 200, parkingRate: 100, structureRate: 200, demolition: 1000, rent: 2000, fees: 3000 };
  assert.equal(quickTotal(1000, quick), 186000); assert.equal(quickTotal(1000, { ...quick, parking: false }), 206000);
  assert.equal(quickTotal(1000, { ...quick, parkingArea: 1001 }), null);
  assert.equal(detailedTotal([{ id: 'x', name: 'Beton', quantity: 10, unit: 'm³', price: 500 }]), 5000);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kentsel-regresyon-'));
  fs.cpSync(path.join(process.cwd(), '.next'), path.join(root, '.next'), { recursive: true });
  fs.copyFileSync(path.join(process.cwd(), 'package.json'), path.join(root, 'package.json'));
  fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'), 'junction');
  fs.mkdirSync(path.join(root, 'data'));
  const db = new Database(path.join(root, 'data', 'kentsel.sqlite'));
  db.exec("CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, semt TEXT NOT NULL, ada TEXT NOT NULL, parsel TEXT NOT NULL, created_at TEXT, updated_at TEXT); INSERT INTO projects (semt, ada, parsel) VALUES ('Eski', '1', '2')");
  db.close();
  const port = await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
  const server = spawn(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; server.stdout.on('data', d => { output += d; }); server.stderr.on('data', d => { output += d; });
  const base = `http://127.0.0.1:${port}/api/projects`;
  const call = async (suffix = '', method = 'GET', body) => { const r = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return [r.status, r.status === 204 ? null : await r.json()]; };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { await fetch(base); ready = true; break; } catch { if (server.exitCode !== null) break; await new Promise(resolve => setTimeout(resolve, 100)); } }
    if (!ready) throw new Error('Test sunucusu başlatılamadı: ' + output);
    let [, existing] = await call(); assert.equal(existing[0].semt, 'Eski'); assert.equal(existing[0].architectural_scenarios, null);
    assert.equal(existing[0].financial_scenarios, null);
    const building = { ad: 'A', daire_sayisi: 2, dukkan_sayisi: 0, bodrum_kat: 0, normal_kat: 1, esit_dagilim: false, kat_daireleri: [1, 1], bodrumda_daire_yok: true, bodrum_daireleri: [], giriste_daire_yok: false };
    const floor = id => ({ id, ortak_alan: 10, daireler: [{ net: 50, brut: 60 }] });
    const measure = { binalar: [{ bina_index: 0, katlar: [floor('normal-0'), floor('normal-1')] }] };
    const project = { semt: 'Avcılar', mahalle: 'Ambarlı', ada: '12', parsel: '34', notlar: 'Test notu', arsa_alani: 1000, taks: 0.4, kaks: 2, insaat_alani: 200, bina_sayisi: 1, binalar_detay: [building], daire_metraj_detaylari: measure };
    let [status, created] = await call('', 'POST', project); assert.equal(status, 201); assert.equal(created.mahalle, 'Ambarlı');
    assert.equal(JSON.parse(created.daire_metraj_detaylari).toplam_genel_brut, 200);
    const id = created.id, rows = [{ id: '1', name: 'Beton', quantity: 10, unit: 'm³', price: 500 }];
    [status] = await call(`/${id}/cost`, 'PUT', { mode: 'quick', quick: { ...quick, parkingArea: 50 }, detailed: rows }); assert.equal(status, 200);
    [status] = await call(`/${id}/cost`, 'PUT', { mode: 'quick', quick: { ...quick, parkingArea: 201 }, detailed: rows }); assert.equal(status, 400);
    [status] = await call(`/${id}/cost`, 'PUT', { mode: 'detailed', quick, detailed: rows }); assert.equal(status, 200);
    const scenario = { ...emptyScenario(), bonus: true, slope: true, exposedFloors: 2, projection: true, projectionType: 'closed', narrow: true, heightLimit: true };
    let saved; [status, saved] = await call(`/${id}/scenario`, 'PUT', scenario); assert.equal(status, 200); assert.deepEqual(JSON.parse(saved.architectural_scenarios), scenario);
    [status] = await call(`/${id}/scenario`, 'PUT', { ...scenario, exposedFloors: -1 }); assert.equal(status, 400);
    [status, saved] = await call(`/${id}`, 'PUT', { ...project, semt: 'Güncel' }); assert.equal(status, 200); assert.equal(saved.cost_mode, 'detailed'); assert.deepEqual(JSON.parse(saved.architectural_scenarios), scenario);
    const sectionScenario = {
      ...scenario,
      design: {
        ...emptyDesign(),
        headings: ['CADDE CEPHESİ', 'AVLU CEPHESİ'],
        duplex: true,
        contractorFloors: ['normal-6', 'ground'],
        floorAreas: { ground: 350 },
        units: { 'normal-6:0': { title: 'Köşe Daire', type: 'duplex', gross: 180, totalGross: 230 } },
      },
    };
    [status, saved] = await call(`/${id}/scenario`, 'PUT', sectionScenario);
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(saved.architectural_scenarios), sectionScenario);
    assert.equal(saved.cost_mode, 'detailed');
    assert.equal(JSON.parse(saved.daire_metraj_detaylari).toplam_genel_brut, 200);
    [status] = await call(`/${id}/scenario`, 'PUT', { ...sectionScenario, design: { ...sectionScenario.design, columns: 0 } });
    assert.equal(status, 400);
    [status, saved] = await call(`/${id}/scenario`, 'PUT', scenario);
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(saved.architectural_scenarios), sectionScenario);
    [status, saved] = await call(`/${id}/cost`, 'PUT', { mode: 'quick', quick: { ...quick, parkingArea: 50 }, detailed: rows });
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(saved.architectural_scenarios), sectionScenario);
    [status, saved] = await call(`/${id}`, 'PUT', { ...project, semt: 'Yeni Ad' });
    assert.equal(status, 200);
    assert.equal(saved.cost_mode, 'quick');
    assert.deepEqual(JSON.parse(saved.architectural_scenarios), sectionScenario);
    const ruleDesign = {
      ...sectionScenario.design,
      normalFloors: 7,
      rules: { ...DEFAULT_RULE_SETTINGS, use: 'mixed', order: 'attached', projection: 'closed', roofShape: 'mansard', roofUsage: 'independent', mezzanine: true, sideProjection: true },
      units: {
        ...sectionScenario.design.units,
        'ground:0': { type: 'shop', isContractorShare: false },
        'ground:1': { isContractorShare: true },
        'roof:0': { isContractorShare: true, gross: 90, net: 75 },
      },
    };
    [status, saved] = await call(`/${id}/scenario`, 'PUT', { ...scenario, design: ruleDesign });
    assert.equal(status, 200);
    const persisted = JSON.parse(saved.architectural_scenarios);
    assert.equal(persisted.design.rules.projection, 'open');
    assert.equal(persisted.design.rules.roofShape, 'mansard');
    assert.equal(persisted.design.rules.roofUsage, 'independent');
    assert.equal(persisted.design.units['roof:0'].isContractorShare, true);
    assert.equal(persisted.design.units['roof:0'].net, 75);
    assert.equal(persisted.design.rules.mezzanine, false);
    assert.equal(persisted.design.rules.sideProjection, false);
    assert.equal(persisted.design.rules.sideGarden, false);
    assert.equal(persisted.design.units['ground:0'].isContractorShare, false);
    assert.equal(persisted.design.units['ground:1'].isContractorShare, true);
    assert.equal(saved.cost_mode, 'quick');
    assert.equal(JSON.parse(saved.daire_metraj_detaylari).toplam_genel_brut, 200);
    const financial = validateFinancialScenario({ residentialRate: 55000, rentMonths: 12, useAveragePrices: false, unitPrices: { 'roof:0': 2000000 } });
    [status, saved] = await call(`/${id}/financial`, 'PUT', financial);
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(saved.financial_scenarios), financial);
    assert.deepEqual(JSON.parse(saved.architectural_scenarios), persisted);
    assert.equal(saved.cost_mode, 'quick');
    [status] = await call(`/${id}/financial`, 'PUT', { riskRate: -1 });
    assert.equal(status, 400);
    [status] = await call('/999999/financial', 'PUT', financial);
    assert.equal(status, 404);
    [status] = await call(`/${id}/scenario`, 'PUT', { ...scenario, design: { ...ruleDesign, units: { 'ground:0': { isContractorShare: 'false' } } } });
    assert.equal(status, 400);
    [status, saved] = await call(`/${id}/scenario`, 'PUT', scenario);
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(saved.architectural_scenarios), persisted);
    [status, saved] = await call(`/${id}/cost`, 'PUT', { mode: 'detailed', quick, detailed: rows });
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(saved.architectural_scenarios), persisted);
    [status, existing] = await call();
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(existing.find(row => row.id === id).architectural_scenarios), persisted);
    assert.deepEqual(JSON.parse(existing.find(row => row.id === id).financial_scenarios), financial);
    [status] = await call('', 'POST', { bina_sayisi: 1, binalar_detay: [{ ...building, daire_sayisi: 3 }] }); assert.equal(status, 400);
    [status] = await call(`/${id}`, 'DELETE'); assert.equal(status, 204);
    console.log('Simülasyon, imar kuralları, pay dağılımı, finansal hesap ve kayıt, metraj, maliyet ve proje CRUD kontrolleri başarılı.');
  } finally { server.kill('SIGTERM'); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
