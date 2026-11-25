/* ============================================================
   تست‌های جامع میزینو | MIZINO
   اجرا: npm test
   ============================================================ */

import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/* ---------- راه‌اندازی محیط مرورگر ---------- */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');

const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });

const define = (k, v) => {
  try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); }
  catch { globalThis[k] = v; }
};
define('window', dom.window);
define('document', dom.window.document);
define('localStorage', dom.window.localStorage);
define('navigator', dom.window.navigator);
define('HTMLElement', dom.window.HTMLElement);
define('Node', dom.window.Node);
define('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
globalThis.__AFTAB_TEST__ = true;

/* ---------- واحدها ---------- */
let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    failures.push({ name, e });
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message.split('\n')[0]}`);
  }
}

function section(t) { console.log(`\n■ ${t}`); }

/* ============================================================ */
section('تقویم شمسی و ابزارها');

const U = await import('../js/core/utils.js');

await test('قالب‌بندی اعداد: ارقام فارسی و جداکننده سه‌رقمی', () => {
  assert.equal(U.formatNumInput(1234567), '۱٬۲۳۴٬۵۶۷');
  assert.equal(U.formatNumInput('1500'), '۱٬۵۰۰');
  assert.equal(U.formatNumInput('12.5'), '۱۲٫۵');
  assert.equal(U.formatNumInput(''), '');
  // خواندن مقادیر فارسی/جداکننده‌دار
  assert.equal(U.num('۱٬۲۳۴٬۵۶۷'), 1234567);
  assert.equal(U.num('1,234'), 1234);
  assert.equal(U.num('۱۲٫۵'), 12.5);
  assert.equal(U.num(U.formatNumInput(9876543)), 9876543);
  // نمایش
  assert.equal(U.fmtMoney(1234567), '۱٬۲۳۴٬۵۶۷');
  assert.equal(U.fmtQty(1500), '۱٬۵۰۰');
  assert.equal(U.toFa('1405-09-03'), '۱۴۰۵-۰۹-۰۳');
});

await test('میلادی → شمسی (نوروز ۱۴۰۵)', () => {
  const r = U.toJalaali(2026, 3, 21);
  assert.deepEqual([r.jy, r.jm, r.jd], [1405, 1, 1]);
});
await test('نوروز ۱۴۰۴ = ۲۰۲۵/۰۳/۲۱', () => {
  const r = U.toJalaali(2025, 3, 21);
  assert.deepEqual([r.jy, r.jm, r.jd], [1404, 1, 1]);
});
await test('نوروز ۱۴۰۳ = ۲۰۲۴/۰۳/۲۰', () => {
  const r = U.toJalaali(2024, 3, 20);
  assert.deepEqual([r.jy, r.jm, r.jd], [1403, 1, 1]);
});
await test('نوروز ۱۴۰۲ = ۲۰۲۳/۰۳/۲۱', () => {
  const r = U.toJalaali(2023, 3, 21);
  assert.deepEqual([r.jy, r.jm, r.jd], [1402, 1, 1]);
});
await test('تاریخ امروز ۲۰۲۶/۱۱/۲۴ → ۱۴۰۵/۰۹/۰۳', () => {
  const r = U.toJalaali(2026, 11, 24);
  assert.deepEqual([r.jy, r.jm, r.jd], [1405, 9, 3]);
});
await test('تبدیل وارونه شمسی → میلادی', () => {
  const g = U.toGregorian(1405, 9, 3);
  assert.deepEqual([g.gy, g.gm, g.gd], [2026, 11, 24]);
});
await test('سال کبیسه ۱۴۰۳ (اسفند ۳۰ روزه)', () => {
  assert.equal(U.daysInMonth(1403, 12), 30);
  assert.equal(U.daysInMonth(1404, 12), 29);
});
await test('پیمایش روزها', () => {
  assert.equal(U.addDaysJalali('1405-08-01', 30), '1405-09-01');
  assert.equal(U.addDaysJalali('1405-01-31', 1), '1405-02-01');
  assert.equal(U.addDaysJalali('1404-12-29', 1), '1405-01-01');
});
await test('بازه ماه جاری', () => {
  const m = U.currentJalaliMonth();
  assert.match(m.from, /^\d{4}-\d{2}-01$/);
  assert.ok(m.to >= m.from);
});
await test('ارقام و قالب مبلغ', () => {
  assert.equal(U.toFa(1234), '۱۲۳۴');
  assert.equal(U.toEn('۵۶۷'), '567');
  assert.equal(U.fmtMoney(1250000), '۱٬۲۵۰٬۰۰۰');
  assert.equal(U.normalize('  كيك '), 'کیک');
  assert.equal(U.normalize('۱۴۰۵'), '1405');
});

/* ============================================================ */
section('محاسبات مالی — میانگین موزون و سود');

const M = await import('../js/core/money.js');

await test('ورود کالا و به‌روزرسانی میانگین موزون', () => {
  // ۱۰ کیلو به قیمت کیلویی ۱۰٬۰۰۰ → میانگین ۱۰
  let s = M.wacIn({ stock: 0, wac: 0 }, 10000, 100000);
  assert.equal(s.stock, 10000);
  assert.equal(s.wac, 10);
  // ۵ کیلو به قیمت کیلویی ۲۰٬۰۰۰ → (۱۰۰٬۰۰۰+۱۰۰٬۰۰۰)/۱۵٬۰۰۰
  s = M.wacIn(s, 5000, 100000);
  assert.equal(s.stock, 15000);
  assert.ok(Math.abs(s.wac - 13.3333) < 0.001, `wac=${s.wac}`);
});
await test('خروج از انبار با ارزش میانگین', () => {
  const r = M.wacOut({ stock: 15000, wac: 13.3333 }, 3000);
  assert.equal(r.stock, 12000);
  assert.ok(Math.abs(r.value - 40000) < 1);
});
await test('بازگردانی خرید', () => {
  const r = M.wacReverse({ stock: 15000, wac: 13.3333 }, 5000, 100000);
  assert.equal(r.stock, 10000);
  assert.ok(Math.abs(r.wac - 10) < 0.01, `wac=${r.wac}`);
});
await test('بهای رسپی گردشده', () => {
  assert.equal(M.recipeCost([{ qty: 100, wac: 5.5 }, { qty: 50, wac: 40.2 }]), 2560);
});
await test('اعتبارسنجی پرداخت ترکیبی', () => {
  assert.equal(M.validatePayments(1000, { cash: 400, card: 350, credit: 250 }).ok, true);
  assert.equal(M.validatePayments(1000, { cash: 400, card: 350 }).ok, false);
  assert.equal(M.validatePayments(1000, { cash: -10, card: 1010 }).ok, false);
});
await test('سود ناخالص و خالص', () => {
  const p = M.computeProfit({ revenue: 1000000, cogs: 350000, waste: 20000, expenses: 300000 });
  assert.equal(p.gross, 650000);
  assert.equal(p.net, 330000);
  assert.ok(Math.abs(p.grossMargin - 65) < 0.01);
});

/* ============================================================ */
section('منو — دسته‌بندی نامحدود بدون داده ثابت');

const menu = await import('../js/services/menuService.js');

await test('افزودن و اعتبارسنجی دسته', async () => {
  const c = await menu.addCategory({ name: 'صبحانه' });
  assert.ok(c.id);
  await assert.rejects(() => menu.addCategory({ name: 'صبحانه' }), /وجود دارد/);
  await assert.rejects(() => menu.addCategory({ name: '  ' }), /الزامی/);
});
await test('افزودن غذا و جلوگیری از نام تکراری', async () => {
  const cats = await menu.listCategories();
  const f = await menu.addFood({ categoryId: cats[0].id, name: 'املت گوجه', price: 89000 });
  assert.equal(f.price, 89000);
  await assert.rejects(() => menu.addFood({ categoryId: cats[0].id, name: 'املت گوجه', price: 1000 }), /وجود دارد/);
});
await test('حذف دسته دارای غذا مسدود است', async () => {
  const cats = await menu.listCategories();
  await assert.rejects(() => menu.deleteCategory(cats[0].id), /غذا دارد/);
});
await test('منوی پیشنهادی به‌صورت داده اضافه می‌شود', async () => {
  const before = await menu.listCategories();
  const r = await menu.seedSuggestedMenu();
  assert.ok(r.addedCats > 0 && r.addedFoods > 0, JSON.stringify(r));
  const after = await menu.listCategories();
  assert.ok(after.length > before.length);
  // فقط موارد غیرتکراری اضافه شده‌اند
  const r2 = await menu.seedSuggestedMenu();
  assert.equal(r2.addedCats, 0);
  assert.equal(r2.addedFoods, 0);
});

await test('تصاویر منو: نقشه کامل ۷۰ قلمی، فایل‌های موجود و اعمال روی غذاها', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const entries = Object.entries(menu.MENU_IMAGES);
  assert.ok(entries.length >= 95, `نقشه تصاویر باید حداقل ۹۵ قلم باشد (${entries.length})`);
  // همه فایل‌های نقشه روی دیسک وجود دارند
  for (const [name, file] of entries) {
    const p = path.join(process.cwd(), 'img', 'menu', file);
    assert.ok(fs.existsSync(p), `فایل تصویر موجود نیست: ${name} → ${file}`);
  }
  // همه غذاهای منوی پیشنهادی در نقشه‌اند (پوشش کامل)
  const seedNames = new Set(menu.SUGGESTED_MENU.flatMap((g) => g.foods));
  assert.ok(seedNames.size >= 95, `منوی پیشنهادی باید ≥۹۵ قلم باشد (${seedNames.size})`);
  for (const n of seedNames) assert.ok(menu.MENU_IMAGES[n], `غذای پیشنهادی بدون تصویر: ${n}`);
  // غذاهای seed ساخته‌شده تصویر دارند
  const foods = await menu.listFoods();
  const seeded = foods.filter((f) => seedNames.has(f.name));
  assert.ok(seeded.length > 0);
  for (const f of seeded) assert.ok(f.image, `غذای seed بدون تصویر: ${f.name}`);
  // نام ناشناخته → بدون تصویر می‌ماند
  const cat = (await menu.listCategories())[0];
  const plain = await menu.addFood({ categoryId: cat.id, name: 'غذای تست بی‌تصویر', price: 1000 });
  assert.equal(plain.image, null);
  await menu.applyMenuImages();
  const afterPlain = (await menu.listFoods()).find((x) => x.id === plain.id);
  assert.equal(afterPlain.image, null, 'نام ناشناخته نباید تصویر بگیرد');
  await menu.deleteFood(plain.id);
  // پاک‌شدن تصویر → بازیابی خودکار + دست‌نزدن به تصویر آپلودی کاربر
  const tea = (await menu.listFoods()).find((x) => x.name === 'چای');
  assert.ok(tea?.image?.endsWith('tea.jpg'), 'چای باید عکس tea.jpg داشته باشد');
  await menu.updateFood(tea.id, { image: null });
  await menu.applyMenuImages();
  const tea2 = (await menu.listFoods()).find((x) => x.id === tea.id);
  assert.ok(tea2.image?.endsWith('tea.jpg'), 'تصویر چای بعد از پاک‌شدن بازیابی نشد');
  await menu.updateFood(tea.id, { image: 'data:image/png;base64,AAA' });
  await menu.applyMenuImages();
  const tea3 = (await menu.listFoods()).find((x) => x.id === tea.id);
  assert.equal(tea3.image, 'data:image/png;base64,AAA', 'تصویر آپلودی کاربر نباید جایگزین شود');
  await menu.updateFood(tea.id, { image: './img/menu/tea.jpg' });
  // نوشیدنی‌های جدید در منوی پیشنهادی هستند
  for (const d of ['نوشابه', 'دوغ', 'آب', 'کاپوچینو', 'نسکافه', 'دمنوش']) {
    assert.ok(seedNames.has(d), `نوشیدنی ${d} در منوی پیشنهادی نیست`);
  }
});
await test('ویرایش و حذف غذا', async () => {
  const foods = await menu.listFoods();
  const target = foods.find((f) => f.name === 'املت گوجه');
  const updated = await menu.updateFood(target.id, { price: 95000 });
  assert.equal(updated.price, 95000);
  await menu.deleteFood(target.id);
  const after = await menu.listFoods();
  assert.ok(!after.some((f) => f.id === target.id));
});

await test('گسترش منو: ۲۶ دسته و ≥۹۵ قلم با پوشش تصویر کامل', async () => {
  assert.ok(menu.SUGGESTED_MENU.length >= 26, `تعداد دسته‌ها (${menu.SUGGESTED_MENU.length})`);
  const names = menu.SUGGESTED_MENU.flatMap((g) => g.foods);
  const uniq = new Set(names);
  assert.ok(uniq.size >= 95, `تعداد اقلام یکتا (${uniq.size})`);
  for (const n of uniq) assert.ok(menu.MENU_IMAGES[n], `قلم بدون تصویر: ${n}`);
  // دسته‌های جدید کلیدی وجود دارند
  const cats = menu.SUGGESTED_MENU.map((g) => g.name);
  for (const c of ['کباب', 'پلو', 'سوپ', 'نوشیدنی گرم', 'نوشیدنی سرد', 'دسر']) {
    assert.ok(cats.includes(c), `دسته ${c} اضافه نشده`);
  }
});

await test('قیمت با ارقام فارسی در منو ذخیره می‌شود (باگ Number)', async () => {
  const cat = (await menu.listCategories())[0];
  const f = await menu.addFood({ categoryId: cat.id, name: 'غذای تست قیمت فارسی', price: '۱۲۵٬۰۰۰' });
  assert.equal(f.price, 125000, `addFood با مبلغ فارسی خراب شد: ${f.price}`);
  const u = await menu.updateFood(f.id, { price: '۲۰۰٬۵۰۰' });
  assert.equal(u.price, 200500, `updateFood با مبلغ فارسی خراب شد: ${u.price}`);
  const u2 = await menu.updateFood(f.id, { price: '350000' });
  assert.equal(u2.price, 350000, `updateFood لاتین خراب شد: ${u2.price}`);
  const u3 = await menu.updateFood(f.id, { price: 475000 });
  assert.equal(u3.price, 475000);
  await menu.deleteFood(f.id);
});

/* ============================================================ */
section('مواد اولیه و انبار');

const inv = await import('../js/services/inventoryService.js');

let ingEgg, ingCheese;

await test('تعریف ماده اولیه با واحد تبدیل', async () => {
  ingEgg = await inv.addIngredient({
    name: 'تخم‌مرغ', baseUnit: 'عدد', minStock: 60,
    units: [{ name: 'بسته ۱۲ عددی', factor: 12 }],
  });
  ingCheese = await inv.addIngredient({ name: 'پنیر', baseUnit: 'گرم', minStock: 2000 });
  assert.equal(ingEgg.stock, 0);
  assert.equal(ingEgg.wac, 0);
  const units = inv.unitsFor(ingEgg);
  assert.ok(units.some((u) => u.name === 'بسته ۱۲ عددی' && u.factor === 12));
});
await test('تبدیل واحد به واحد پایه', () => {
  assert.equal(inv.toBaseQty(ingEgg, 3, 'بسته ۱۲ عددی'), 36);
  assert.equal(inv.toBaseQty(ingCheese, 2.5, 'کیلوگرم'), 2500);
});
await test('ورود دستی با بهای خرید و محاسبه میانگین', async () => {
  await inv.manualIn({ ingredientId: ingEgg.id, qty: 100, unit: 'عدد', unitCost: 800000, note: 'خرید بازار' });
  const [egg] = await inv.listIngredients().then((l) => l.filter((i) => i.id === ingEgg.id));
  assert.equal(egg.stock, 100);
  assert.equal(egg.wac, 8000); // ۸۰۰٬۰۰۰ / ۱۰۰
});
await test('خروج دستی و ثبت گردش', async () => {
  await inv.manualOut({ ingredientId: ingEgg.id, qty: 10, note: 'مصرف آشپزخانه' });
  const movs = await inv.listMovements({ ingredientId: ingEgg.id });
  assert.ok(movs.length >= 2);
  const [egg] = await inv.listIngredients().then((l) => l.filter((i) => i.id === ingEgg.id));
  assert.equal(egg.stock, 90);
});
await test('ضایعات با ارزش‌گذاری', async () => {
  await inv.recordWaste({ ingredientId: ingEgg.id, qty: 5, reason: 'شکسته' });
  const waste = await inv.listMovements({ type: 'waste' });
  assert.ok(waste.length === 1);
  assert.equal(waste[0].value, 40000); // ۵ × ۸۰۰۰
});
await test('شمارش واقعی و اعمال اختلاف', async () => {
  await inv.applyCount({ items: [{ ingredientId: ingEgg.id, countQty: 84 }] });
  const [egg] = await inv.listIngredients().then((l) => l.filter((i) => i.id === ingEgg.id));
  assert.equal(egg.stock, 84);
});
await test('هشدار حداقل موجودی', async () => {
  const low = await inv.lowStockList();
  // پنیر موجودی ندارد و حداقل ۲۰۰۰ ثبت شده
  assert.ok(low.some((i) => i.id === ingCheese.id));
});
await test('حذف ماده دارای گردش مسدود است', async () => {
  await assert.rejects(() => inv.deleteIngredient(ingEgg.id), /گردش انبار/);
});
await test('گردش تفصیلی یک ماده (materialFlow)', async () => {
  const r = await inv.materialFlow(ingEgg.id);
  assert.equal(r.ingredient.id, ingEgg.id);
  assert.ok(r.rows.length >= 3, `rows=${r.rows.length}`);
  assert.ok(r.rows.every((m) => m.ingredientId === ingEgg.id));
});

/* ============================================================ */
section('خرید و تأمین‌کنندگان');

const pur = await import('../js/services/purchaseService.js');

let supplier;

await test('تأمین‌کننده و ثبت خرید با ورود به انبار', async () => {
  supplier = await pur.addSupplier({ name: 'عمده‌فروشی مرکزی', phone: '09120000000' });
  const p = await pur.createPurchase({
    supplierId: supplier.id,
    items: [
      { ingredientId: ingCheese.id, qty: 5, unit: 'کیلوگرم', unitPrice: 180000 }, // ۹۰۰٬۰۰۰ تومان
      { ingredientId: ingEgg.id, qty: 36, unit: 'عدد', unitPrice: 9000 }, // ۳۲۴٬۰۰۰
    ],
    paid: 500000,
  });
  assert.equal(p.total, 1224000);
  assert.equal(p.paid, 500000);
  assert.equal(p.remaining, 724000);

  const cheese = (await inv.listIngredients()).find((i) => i.id === ingCheese.id);
  assert.equal(cheese.stock, 5000); // ۵ کیلو → گرم
  assert.ok(Math.abs(cheese.wac - 180) < 0.01, `wac=${cheese.wac}`); // ۹۰۰٬۰۰۰ / ۵٬۰۰۰
});
await test('بدهی تأمین‌کننده محاسبه می‌شود', async () => {
  const sups = await pur.listSuppliers();
  const s = sups.find((x) => x.id === supplier.id);
  assert.equal(s.debt, 724000);
});
await test('پرداخت بدهی و کاهش آن', async () => {
  await pur.paySupplier({ supplierId: supplier.id, amount: 224000 });
  const s = (await pur.listSuppliers()).find((x) => x.id === supplier.id);
  assert.equal(s.debt, 500000);
});
await test('پرداخت بیش از بدهی رد می‌شود', async () => {
  await assert.rejects(() => pur.paySupplier({ supplierId: supplier.id, amount: 99999999 }), /بیشتر است/);
});
await test('حذف سند خرید انبار را بازمی‌گرداند', async () => {
  const purchases = await pur.listPurchases();
  const p = purchases[0];
  await pur.deletePurchase(p.id);
  const cheese = (await inv.listIngredients()).find((i) => i.id === ingCheese.id);
  assert.equal(cheese.stock, 0);
  assert.equal(cheese.wac, 0);
});

/* ============================================================ */
section('رسپی و فروش — کسر خودکار انبار');

const rec = await import('../js/services/recipeService.js');
const sales = await import('../js/services/salesService.js');

let foodOmelette;

await test('ذخیره رسپی و محاسبه بهای تمام‌شده', async () => {
  // دوباره پنیر می‌خریم تا موجودی داشته باشیم
  await pur.createPurchase({
    supplierId: supplier.id,
    items: [{ ingredientId: ingCheese.id, qty: 2, unit: 'کیلوگرم', unitPrice: 200000 }],
    paid: 400000,
  });
  const cats = await menu.listCategories();
  const cat = cats.find((c) => c.name === 'املت') || cats[0];
  foodOmelette = await menu.addFood({ categoryId: cat.id, name: 'املت ویژه تست', price: 120000 });
  await rec.saveRecipe(foodOmelette.id, [
    { ingredientId: ingEgg.id, qty: 3, unit: 'عدد' },
    { ingredientId: ingCheese.id, qty: 100, unit: 'گرم' },
  ]);
  const c = await rec.foodCost(foodOmelette.id);
  assert.equal(c.hasRecipe, true);
  // تخم‌مرغ: ۳ × ۸۰۰۰ = ۲۴٬۰۰۰ — پنیر: ۱۰۰ × ۲۰۰ = ۲۰٬۰۰۰ → ۴۴٬۰۰۰
  assert.equal(c.cost, 44000, `cost=${c.cost}`);
});

await test('ثبت فروش نقدی + کسر خودکار مواد', async () => {
  const eggBefore = (await inv.listIngredients()).find((i) => i.id === ingEgg.id).stock;
  const cheeseBefore = (await inv.listIngredients()).find((i) => i.id === ingCheese.id).stock;

  const { sale, warnings } = await sales.createSale({
    items: [{ foodId: foodOmelette.id, qty: 2 }],
    payments: { cash: 240000 },
  });
  assert.equal(sale.total, 240000);
  assert.equal(sale.cogs, 88000); // ۴۴٬۰۰۰ × ۲
  assert.equal(warnings.length, 0, warnings.join(' | '));

  const eggAfter = (await inv.listIngredients()).find((i) => i.id === ingEgg.id).stock;
  const cheeseAfter = (await inv.listIngredients()).find((i) => i.id === ingCheese.id).stock;
  assert.equal(eggBefore - eggAfter, 6);
  assert.equal(cheeseBefore - cheeseAfter, 200);
});

await test('فروش ترکیبی (نقدی/کارت/نسیه) و صندوق', async () => {
  const cash = await import('../js/services/cashService.js');
  const before = await cash.cashBalance();
  const { sale } = await sales.createSale({
    items: [{ foodId: foodOmelette.id, qty: 1 }],
    payments: { cash: 40000, card: 40000, credit: 40000 },
    customer: { name: 'آقای رضایی' },
  });
  assert.equal(sale.payments.credit, 40000);
  const after = await cash.cashBalance();
  assert.equal(after - before, 40000); // فقط نقدی وارد صندوق می‌شود
});

await test('فروش با تخفیف و اعتبارسنجی پرداخت', async () => {
  const { sale } = await sales.createSale({
    items: [{ foodId: foodOmelette.id, qty: 1 }],
    discount: 20000,
    payments: { cash: 100000 },
  });
  assert.equal(sale.total, 100000);
  assert.equal(sale.subtotal, 120000);
  await assert.rejects(() => sales.createSale({
    items: [{ foodId: foodOmelette.id, qty: 1 }],
    payments: { cash: 1000 },
  }), /برابر نیست/);
});

await test('حذف فروش، انبار و صندوق را بازمی‌گرداند', async () => {
  const cash = await import('../js/services/cashService.js');
  const list = await sales.listSales({});
  const target = list[0]; // آخرین فروش (نقدی ۱۰۰٬۰۰۰)
  const balanceBefore = await cash.cashBalance();
  const eggBefore = (await inv.listIngredients()).find((i) => i.id === ingEgg.id).stock;

  await sales.deleteSale(target.id);

  const eggAfter = (await inv.listIngredients()).find((i) => i.id === ingEgg.id).stock;
  assert.equal(eggAfter - eggBefore, 3);
  const balanceAfter = await cash.cashBalance();
  assert.equal(balanceBefore - balanceAfter, target.payments.cash);
  assert.ok(!(await sales.listSales({})).some((s) => s.id === target.id));
});

await test('دریافت طلب نسیه از مشتری و کاهش طلب', async () => {
  const cash = await import('../js/services/cashService.js');
  const { sale } = await sales.createSale({
    items: [{ foodId: foodOmelette.id, qty: 1 }],
    payments: { credit: 120000 },
    customer: { name: 'مشتری نسیه‌ای' },
  });
  assert.equal(sale.creditRemaining, 120000);

  const bal0 = await cash.cashBalance();
  const { sale: s2 } = await sales.receiveCredit({ saleId: sale.id, amount: 50000, note: 'بخش اول' });
  assert.equal(s2.creditRemaining, 70000);
  assert.equal(await cash.cashBalance(), bal0 + 50000);

  await assert.rejects(() => sales.receiveCredit({ saleId: sale.id, amount: 80000 }), /بیشتر است/);
  await assert.rejects(() => sales.receiveCredit({ saleId: sale.id, amount: 0 }), /بزرگ‌تر از صفر/);

  const { sale: s3 } = await sales.receiveCredit({ saleId: sale.id, amount: 70000 });
  assert.equal(s3.creditRemaining, 0);
  await assert.rejects(() => sales.receiveCredit({ saleId: sale.id, amount: 1000 }), /باقی نمانده/);

  const out = await sales.outstandingCredits();
  assert.ok(!out.sales.some((s) => s.id === sale.id));
});

await test('حذف فروش نسیه، دریافت‌های طلب را هم از صندوق برمی‌دارد', async () => {
  const cash = await import('../js/services/cashService.js');
  const { sale } = await sales.createSale({
    items: [{ foodId: foodOmelette.id, qty: 1 }],
    payments: { credit: 120000 },
    customer: { name: 'مشتری دوم' },
  });
  await sales.receiveCredit({ saleId: sale.id, amount: 40000 });
  const balWith = await cash.cashBalance();
  await sales.deleteSale(sale.id);
  const balAfter = await cash.cashBalance();
  assert.equal(balWith - balAfter, 40000);
  assert.ok(!(await sales.outstandingCredits()).sales.some((s) => s.id === sale.id));
});

await test('سرمایه اولیه صندوق از تنظیمات ایجاد و اصلاح می‌شود', async () => {
  const { saveSettings } = await import('../js/core/settings.js');
  const cash = await import('../js/services/cashService.js');
  const base = await cash.cashBalance();

  saveSettings({ initialCash: 1000000 });
  await cash.ensureInitialCash();
  assert.equal(await cash.cashBalance(), base + 1000000);

  saveSettings({ initialCash: 1500000 });
  await cash.ensureInitialCash();
  assert.equal(await cash.cashBalance(), base + 1500000);

  // صفر کردن تنظیمات، سرمایه ثبت‌شده را حذف نمی‌کند (محافظ داده)
  saveSettings({ initialCash: 0 });
  await cash.ensureInitialCash();
  assert.equal(await cash.cashBalance(), base + 1500000);

  saveSettings({ initialCash: 1000000 });
  await cash.ensureInitialCash();
  assert.equal(await cash.cashBalance(), base + 1000000);
  saveSettings({ initialCash: 0 });
});

/* ============================================================ */
section('هزینه‌ها — جلوگیری از دوباره‌شماری');

const exp = await import('../js/services/expenseService.js');

await test('ثبت هزینه و اتصال به صندوق', async () => {
  const e = await exp.addExpense({ category: 'اجاره', amount: 5000000, description: 'اجاره ماه', source: 'cash' });
  assert.ok(e.uniqueKey);
  const list = await exp.listExpenses({});
  assert.equal(list.length, 1);
});
await test('قالب دوره‌ای و عدم ایجاد تکراری', async () => {
  await exp.addTemplate({ category: 'قبوض', amount: 800000, day: 5, source: 'cash' });
  const month = '1405-08';
  const r1 = await exp.generateRecurring(month);
  assert.equal(r1.created.length, 1);
  const r2 = await exp.generateRecurring(month);
  assert.equal(r2.created.length, 0);
  assert.equal(r2.skipped, 1);
  const all = await exp.listExpenses({});
  const tplExp = all.filter((e) => e.month === month);
  assert.equal(tplExp.length, 1, 'هر قالب حداکثر یک سند در هر ماه');
});
await test('پرداخت حقوق یکتا برای هر ماه', async () => {
  const stf = await import('../js/services/personnelService.js');
  const worker = await stf.addStaff({ name: 'مریم احمدی', role: 'گارسون', salary: 12000000 });
  await stf.paySalary({ staffId: worker.id, date: '1405-08-01' });
  await assert.rejects(() => stf.paySalary({ staffId: worker.id, date: '1405-08-15' }), /قبلاً پرداخت/);
  const pays = await stf.staffPayments(worker.id);
  assert.equal(pays.length, 1);
});
await test('ویرایش و حذف هزینه', async () => {
  const list = await exp.listExpenses({});
  const rent = list.find((e) => e.category === 'اجاره');
  await exp.updateExpense(rent.id, { amount: 5500000 });
  const after = (await exp.listExpenses({})).find((e) => e.id === rent.id);
  assert.equal(after.amount, 5500000);
  await exp.deleteExpense(rent.id);
  assert.ok(!(await exp.listExpenses({})).some((e) => e.id === rent.id));
});

/* ============================================================ */
section('گزارش‌ها — داشبورد، سود و زیان، روزانه');

const rep = await import('../js/services/reportService.js');

await test('داده داشبورد', async () => {
  const d = await rep.dashboardData();
  assert.ok(d.revenueToday >= 0);
  assert.equal(d.series.length, 14);
  assert.ok(d.counts.categories > 0);
  assert.ok(Array.isArray(d.topFoods));
});
await test('گزارش سود و زیان بازه', async () => {
  const m = U.currentJalaliMonth();
  const pnl = await rep.profitLoss(m.from, m.to);
  assert.ok(pnl.revenue > 0);
  assert.equal(pnl.profit.gross, pnl.revenue - pnl.cogs);
  assert.equal(pnl.trend.length, 6);
  assert.ok(pnl.expensesByCategory.length >= 0);
});
await test('گزارش روزانه', async () => {
  const d = await rep.dailyReport(U.todayJalali());
  assert.ok(d.topFoods.length > 0);
  assert.ok(d.profit);
  assert.ok(Array.isArray(d.purchases));
});
await test('ارزش ضایعات در بازه', async () => {
  const w = await rep.wasteValueBetween('0000-01-01', '9999-12-29');
  assert.ok(w > 0);
});
await test('گزارش مقایسه‌ای — بازه فعلی در برابر بازه قبلی هم‌طول', async () => {
  const today = U.todayJalali();
  const from = U.addDaysJalali(today, -6);
  const cmp = await rep.compareWithPrevious(from, today);
  assert.equal(cmp.days, 7);
  assert.equal(cmp.prevTo, U.addDaysJalali(from, -1), 'پایان بازه قبلی باید روز قبل از شروع بازه فعلی باشد');
  assert.equal(cmp.prevFrom, U.addDaysJalali(cmp.prevTo, -6), 'بازه قبلی باید ۷ روز باشد');
  assert.ok(cmp.curr.revenue > 0, 'فروش امروز در بازه فعلی نیست');
  assert.ok(cmp.curr.gross === cmp.curr.revenue - cmp.curr.cogs, 'سود ناخالص نادرست');
  assert.ok(cmp.prev.revenue >= 0 && cmp.prev.net >= 0);
  // سازگاری با گزارش سود و زیان تک‌بازه
  const pnl = await rep.profitLoss(from, today);
  assert.equal(cmp.curr.revenue, pnl.revenue);
  assert.equal(cmp.curr.net, pnl.profit.net);
});

/* ============================================================ */
section('پشتیبان‌گیری و بازیابی');

const bk = await import('../js/services/backupService.js');
const db = await import('../js/core/db.js');

await test('ساخت و بازیابی کامل پشتیبان', async () => {
  const backup = await bk.buildBackup();
  assert.equal(backup.app, 'aftab-breakfast');
  assert.ok(backup.data.sales.length > 0);
  assert.ok(backup.data.ingredients.length > 0);

  const salesCount = backup.data.sales.length;
  const catCount = backup.data.categories.length;

  await bk.wipeAllData();
  assert.equal(await db.count('sales'), 0);
  assert.equal(await db.count('categories'), 0);

  await bk.restoreBackup(backup, 'replace');
  assert.equal(await db.count('sales'), salesCount);
  assert.equal(await db.count('categories'), catCount);
});
await test('اعتبارسنجی فایل خراب', async () => {
  await assert.rejects(() => bk.restoreBackup(null, 'replace'), /معتبر نیست/);
  await assert.rejects(() => bk.restoreBackup({ foo: 1 }, 'replace'), /این برنامه نیست/);
  await assert.rejects(() => bk.restoreBackup({ app: 'other' }, 'replace'), /این برنامه نیست/);
});
await test('ادغام پشتیبان', async () => {
  const backup = await bk.buildBackup();
  const before = await db.count('foods');
  await bk.restoreBackup(backup, 'merge');
  assert.equal(await db.count('foods'), before);
});

/* ============================================================ */
section('سلامت داده‌ها — راستی‌آزمایی و اصلاح');

const integrity = await import('../js/services/integrityService.js');

await test('داده‌های سالم از بررسی سلامت عبور می‌کنند', async () => {
  const r = await integrity.runIntegrityCheck();
  assert.equal(r.ok, true, 'مورد غیرمنتظره: ' + JSON.stringify(r.issues, null, 2));
  assert.ok(r.stats.movements > 0 && r.stats.sales > 0);
});

await test('ناهماهنگی موجودی انبار شناسایی و اصلاح می‌شود', async () => {
  // خراب کردن عمدی موجودی یک ماده
  const ing = (await inv.listIngredients()).find((i) => i.id === ingEgg.id);
  const trueStock = ing.stock;
  await db.put('ingredients', { ...ing, stock: trueStock + 17 });

  const r1 = await integrity.runIntegrityCheck();
  assert.equal(r1.ok, false);
  const issue = r1.issues.find((i) => i.fix.type === 'stock' && i.fix.ingredientId === ingEgg.id);
  assert.ok(issue, 'مورد ناهماهنگی پیدا نشد');
  assert.equal(issue.fix.value, trueStock);

  const fixed = await integrity.fixIssues(r1.issues);
  assert.ok(fixed >= 1);

  const r2 = await integrity.runIntegrityCheck();
  assert.equal(r2.ok, true, JSON.stringify(r2.issues, null, 2));
  const after = (await inv.listIngredients()).find((i) => i.id === ingEgg.id);
  assert.equal(after.stock, trueStock);
});

await test('کلید تکراری هزینه (دوباره‌شماری) شناسایی می‌شود', async () => {
  // شبیه‌سازی داده خراب: کپی یک هزینه با uniqueKey یکسان
  const exps = await db.getAll('expenses');
  const src = exps[0];
  await db.put('expenses', { ...src, id: 'dup_test_1', ts: src.ts + 1 });
  const r = await integrity.runIntegrityCheck();
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.category === 'expense' && /تکراری/.test(i.label)), JSON.stringify(r.issues));
  // پاک‌سازی
  await db.del('expenses', 'dup_test_1');
  const r2 = await integrity.runIntegrityCheck();
  assert.equal(r2.ok, true);
});

await test('طلب نسیه ناهماهنگ اصلاح می‌شود', async () => {
  const allSales = await db.getAll('sales');
  const target = allSales.find((s) => U.num(s.creditRemaining, 0) > 0) || allSales.find((s) => U.num(s.payments?.credit, 0) > 0);
  assert.ok(target, 'فروش نسیه‌ای برای تست یافت نشد');
  const before = target.creditRemaining;
  await db.put('sales', { ...target, creditRemaining: 999999 });

  const r = await integrity.runIntegrityCheck();
  assert.equal(r.ok, false);
  const issue = r.issues.find((i) => i.fix?.type === 'creditRemaining' && i.fix.saleId === target.id);
  assert.ok(issue, 'مورد طلب پیدا نشد');
  assert.equal(issue.fix.value, before);

  await integrity.fixIssues(r.issues);
  const r2 = await integrity.runIntegrityCheck();
  assert.equal(r2.ok, true, JSON.stringify(r2.issues, null, 2));
});

/* ============================================================ */
section('تاریخچه تغییرات');

await test('ایجاد/ویرایش/حذف در تاریخچه ثبت می‌شود', async () => {
  const history = await db.getHistory(500);
  assert.ok(history.length > 5, `history=${history.length}`);
  const cats = await menu.listCategories();
  const c = cats[0];
  await menu.updateCategory(c.id, { name: c.name + ' ' });
  const h2 = await db.getHistory(500);
  assert.ok(h2.some((h) => h.entity === 'categories' && h.action === 'update' && h.entityId === c.id));
  await menu.updateCategory(c.id, { name: c.name.replace(/ $/, '') });
});

/* ============================================================ */
section('راه‌اندازی برنامه و صفحات (jsdom)');

const app = await import('../js/app.js');

await test('initApp بدون خطا اجرا می‌شود و سایدبار را می‌سازد', async () => {
  await app.initApp();
  const items = document.querySelectorAll('.nav-item');
  assert.equal(items.length, 16, `nav items = ${items.length}`);
  assert.equal(document.getElementById('page-title').textContent, 'داشبورد');
  assert.ok(document.getElementById('page').innerHTML.length > 200);
});

await test('ناوبری به هر ۱۴ صفحه بدون خطا', async () => {
  for (const route of app.ROUTES.flatMap((g) => g.modules)) {
    await app.navigate(route.path);
    const page = document.getElementById('page');
    assert.ok(!page.innerHTML.includes('خطا در نمایش صفحه'), `${route.path}: ${page.textContent.slice(0, 120)}`);
    assert.ok(page.innerHTML.length > 100, `${route.path} خالی است`);
    assert.equal(document.getElementById('page-title').textContent, route.title);
  }
});

await test('تعامل کامل صفحه فروش (POS): انتخاب غذا → سبد → پرداخت → ثبت', async () => {
  await app.navigate('sales');
  const page = document.getElementById('page');

  const foodCard = page.querySelector(`[data-food="${foodOmelette.id}"]`) || page.querySelector('[data-food]');
  assert.ok(foodCard, 'کارت غذا یافت نشد');
  foodCard.click();
  assert.ok(page.querySelector('.cart-line'), 'قلم به سبد افزوده نشد');

  const payFull = page.querySelector('#pay-full');
  assert.ok(payFull, 'دکمه «پرداخت کامل نقدی» یافت نشد');
  payFull.click();
  assert.ok(page.querySelector('#pay-cash').value !== '', 'مبلغ نقدی پر نشد');

  const salesMod = await import('../js/services/salesService.js');
  const beforeCount = (await salesMod.listSales({ date: U.todayJalali() })).length;

  page.querySelector('#btn-submit-sale').click();
  await new Promise((r) => setTimeout(r, 150));

  const afterCount = (await salesMod.listSales({ date: U.todayJalali() })).length;
  assert.equal(afterCount, beforeCount + 1, 'سند فروش ثبت نشد');
  assert.equal(page.querySelector('.cart-line'), null, 'سبد خرید خالی نشد');
  assert.ok(page.querySelector('#sales-list tbody tr'), 'ردیف فروش در سوابق نمایش داده نشد');
});

await test('تغییر تم تاریک/روشن', async () => {
  document.getElementById('theme-toggle').click();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  document.getElementById('theme-toggle').click();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
});

await test('باز شدن و بسته شدن مودال', async () => {
  const { openModal, closeAllModals, confirmDialog } = await import('../js/ui/components.js');
  const m = openModal({ title: 'تست', content: '<p>محتوا</p>' });
  assert.ok(document.querySelector('.modal-backdrop'));
  m.close();
  assert.ok(!document.querySelector('.modal-backdrop'));

  const p = confirmDialog('آیا مطمئنید؟');
  document.querySelector('[data-yes]').click();
  assert.equal(await p, true);
  closeAllModals();
});

await test('پیش‌نویس سبد خرید ذخیره و بازیابی می‌شود', async () => {
  localStorage.setItem('aftab.cart.draft', JSON.stringify({
    items: [{ foodId: foodOmelette.id, name: 'املت ویژه تست', price: 120000, qty: 2 }],
    discount: 5000,
    payments: { cash: 0, card: 0, credit: 0 },
    customer: { name: 'مشتری آزمایشی', phone: '0912' },
    savedAt: Date.now(),
  }));

  await app.navigate('sales');
  const page = document.getElementById('page');
  assert.ok(page.querySelector('.cart-line'), 'پیش‌نویس سبد بازیابی نشد');
  assert.equal(page.querySelector('#cust-name')?.value, 'مشتری آزمایشی');
  assert.ok(document.getElementById('cart-fab').classList.contains('visible'), 'نوار سبد شناور فعال نشد');
  // مبالغ به‌صورت ارقام فارسی با جداکننده سه‌رقمی نمایش داده می‌شوند
  assert.equal(page.querySelector('#discount-input')?.value, '۵٬۰۰۰');

  // خالی کردن سبد → حذف پیش‌نویس و مخفی شدن نوار
  page.querySelector('#btn-clear-cart').click();
  await new Promise((r) => setTimeout(r, 60));
  const raw = localStorage.getItem('aftab.cart.draft');
  assert.ok(!raw, 'پیش‌نویس پس از خالی کردن سبد حذف نشد');
  assert.ok(!document.getElementById('cart-fab').classList.contains('visible'));
});

await test('راهنمای درون‌برنامه‌ای باز می‌شود و به بخش‌ها می‌رود', async () => {
  document.getElementById('btn-guide').click();
  const modal = document.querySelector('.modal-backdrop');
  assert.ok(modal, 'مودال راهنما باز نشد');
  assert.ok(modal.textContent.includes('مسیر پیشنهادی راه‌اندازی'));
  assert.equal(modal.querySelectorAll('[data-goto]').length, 16);

  modal.querySelector('[data-goto="warehouse"]').click();
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!document.querySelector('.modal-backdrop'), 'مودال راهنما بسته نشد');
  assert.equal(document.getElementById('page-title').textContent, 'مدیریت انبار');
});

await test('فاکتور رسمی با لوگو، تلفن/نشانی و امضا ساخته می‌شود', async () => {
  const { saveSettings } = await import('../js/core/settings.js');
  saveSettings({ restaurantPhone: '021-77550000', restaurantAddress: 'تهران، خیابان آزادی، پلاک ۱۲' });

  const receipt = await import('../js/core/receipt.js');
  const salesMod = await import('../js/services/salesService.js');
  const list = await salesMod.listSales({});
  assert.ok(list.length > 0, 'سند فروشی برای فاکتور وجود ندارد');

  const el = receipt.buildReceiptElement(list[0]);
  try {
    assert.ok(el.querySelector('img[src*="logo.png"]'), 'لوگوی مجموعه یافت نشد');
    assert.ok(el.textContent.includes('فاکتور فروش رسمی'), 'عنوان رسمی فاکتور نیست');
    assert.ok(el.textContent.includes('021-77550000'), 'تلفن از تنظیمات چاپ نشد');
    assert.ok(el.textContent.includes('خیابان آزادی'), 'نشانی از تنظیمات چاپ نشد');
    assert.ok(el.textContent.includes('امضای صندوقدار'), 'خط امضا نیست');
    assert.ok(el.textContent.includes('شماره فاکتور'), 'جدول مشخصات نیست');
    assert.ok(el.querySelectorAll('table').length >= 3, 'جدول اقلام/مشخصات/امضا کامل نیست');
    assert.ok(el.querySelectorAll('tbody tr').length >= 3, 'ردیف‌های اقلام کم است');
  } finally {
    el.remove();
    saveSettings({ restaurantPhone: '', restaurantAddress: '' });
  }
});

await test('صفحه فاکتورها: جدول، دکمه چاپ و دانلود PDF', async () => {
  await app.navigate('invoices');
  const page = document.getElementById('page');
  assert.equal(document.getElementById('page-title').textContent, 'فاکتورها');
  assert.ok(page.querySelector('#invoices-body table'), 'جدول فاکتورها نیست');
  const row = page.querySelector('#invoices-body tbody tr');
  assert.ok(row, 'ردیف فاکتوری وجود ندارد');
  assert.ok(page.querySelector('[data-print]'), 'دکمه چاپ فاکتور نیست');
  assert.ok(page.querySelector('[data-pdf]'), 'دکمه دانلود PDF نیست');
  assert.ok(page.querySelector('[data-view]'), 'دکمه جزئیات نیست');
  // فیلتر بازه «همه»
  page.querySelector('#iv-all').click();
  await new Promise((r) => setTimeout(r, 150));
  assert.ok(page.querySelector('#invoices-body table'), 'جدول پس از فیلتر همه ناپدید شد');
});

await test('صفحه مشتریان: مودال تسویه حساب برای بدهکار', async () => {
  const salesMod = await import('../js/services/salesService.js');
  // ساخت فروش نسیه‌ای برای مشتری مشخص
  const creditSale = await salesMod.createSale({
    items: [{ foodId: foodOmelette.id, qty: 2 }],
    payments: { cash: 0, card: 0, credit: 240000 },
    customer: { name: 'مشتری نسیه‌ای تست', phone: '09127778899' },
  });
  assert.equal(U.num(creditSale.sale.creditRemaining, 0), 240000);

  await app.navigate('customers');
  const page = document.getElementById('page');
  assert.equal(document.getElementById('page-title').textContent, 'مشتریان');
  assert.ok(page.querySelector('#customers-body table'), 'جدول مشتریان نیست');
  const settleBtn = page.querySelector('[data-settle]');
  assert.ok(settleBtn, 'دکمه تسویه حساب برای بدهکار نیست');
  settleBtn.click();
  const modal = document.querySelector('.modal-backdrop');
  assert.ok(modal, 'مودال تسویه باز نشد');
  assert.ok(modal.textContent.includes('طلب باقی‌مانده'), 'طلب نمایش داده نشد');
  assert.ok(modal.querySelector('[data-full]'), 'دکمه صفر کردن حساب نیست');
  modal.querySelector('[data-cancel]').click();
  assert.ok(!document.querySelector('.modal-backdrop'), 'مودال بسته نشد');
});

await test('تسویه کامل حساب مشتری → صفر شدن طلب', async () => {
  const salesMod = await import('../js/services/salesService.js');
  const before = (await salesMod.outstandingCredits()).total;
  const customers = await salesMod.listCustomers();
  const c = customers.find((x) => x.phone === '09127778899');
  assert.ok(c, 'مشتری نسیه‌ای یافت نشد');
  assert.equal(c.credit, 240000);

  // پرداخت بیشتر از طلب رد می‌شود
  await assert.rejects(() => salesMod.settleCustomer({ key: c.key, amount: 250000 }), /بیشتر است/);

  const { cashBalance } = await import('../js/services/cashService.js');
  const balBefore = await cashBalance();
  const r = await salesMod.settleCustomer({ key: c.key, amount: 240000 });
  assert.equal(r.cleared, true, 'حساب باید صفر شود');
  assert.equal(r.paid, 240000);

  const after = (await salesMod.listCustomers()).find((x) => x.key === c.key);
  assert.equal(after.credit, 0, 'طلب باقی‌مانده صفر نشد');
  const out = await salesMod.outstandingCredits();
  assert.equal(out.total, before - 240000, 'جمع طلب کل کاهش نیافت');
  assert.ok(!out.sales.some((s) => s.id === c.sales[c.sales.length - 1].id), 'سند تسویه‌شده هنوز در طلب‌هاست');
  // واریز کامل به صندوق
  assert.equal(await cashBalance(), balBefore + 240000, 'مبلغ تسویه وارد صندوق نشد');
});

await test('قالب روتین ماهانه: قانون روز + ویرایش قالب', async () => {
  const exp = await import('../js/services/expenseService.js');
  const today = U.todayJalali();
  const day = Number(today.slice(8, 10));
  const mk = U.monthKey(today);

  const tplNow = await exp.addTemplate({ category: 'تست روتین امروز', amount: 2000, day, source: 'cash' });
  const tplFuture = await exp.addTemplate({ category: 'تست روتین آینده', amount: 1000, day: day === 31 ? 31 : day + 1, source: 'cash' });

  const r = await exp.generateRecurring(mk);
  const createdNow = r.created.find((x) => x.recurringId === tplNow.id);
  assert.ok(createdNow, 'سند روتینِ روز جاری ساخته نشد');
  assert.equal(createdNow.date, today, 'تاریخ سند باید روز تعیین‌شده باشد');
  if (day !== 31) {
    assert.ok(!r.created.some((x) => x.recurringId === tplFuture.id), 'سند روز آینده نباید زودتر ثبت شود');
  }
  // اجرای دوباره بدون دوباره‌سازی (کلید یکتا)
  const r2 = await exp.generateRecurring(mk);
  assert.ok(!r2.created.some((x) => x.recurringId === tplNow.id), 'سند تکراری ساخته شد');

  // ویرایش قالب
  const up = await exp.updateTemplate(tplNow.id, { amount: 2500, category: 'تست روتین ویرایش‌شده', day });
  assert.equal(up.amount, 2500);
  const tpls = await exp.listTemplates();
  assert.equal(tpls.find((t) => t.id === tplNow.id).category, 'تست روتین ویرایش‌شده');

  // پاک‌سازی
  await exp.deleteExpense(createdNow.id);
  await exp.deleteTemplate(tplNow.id);
  await exp.deleteTemplate(tplFuture.id);
});

await test('سند گزارش PDF تمیز: صفحه سفید، متن مشکی، جدول اختصاصی', async () => {
  const { buildReportDocument } = await import('../js/core/exporters.js');
  const doc = buildReportDocument({
    title: 'گزارش آزمایشی', brand: 'صبحانه‌سرای آفتاب', range: '۱ تا ۲',
    blocks: [
      { type: 'kpis', items: [{ label: 'درآمد', value: '۱۰۰ تومان' }] },
      { type: 'table', title: 'جدول تست', columns: [{ label: 'شرح' }, { label: 'مبلغ', align: 'num' }], rows: [['ردیف ۱', '۵۰']], totals: ['جمع', '۵۰'] },
      { type: 'note', text: 'یادداشت تست' },
    ],
  });
  try {
    const cs = getComputedStyle(doc);
    assert.equal(cs.backgroundColor, 'rgb(255, 255, 255)', 'پس‌زمینه سفید نیست');
    assert.equal(cs.color, 'rgb(17, 17, 17)', 'متن مشکی نیست');
    assert.ok(doc.textContent.includes('گزارش آزمایشی'), 'عنوان گزارش نیست');
    assert.ok(doc.textContent.includes('جدول تست'), 'عنوان جدول نیست');
    assert.ok(doc.textContent.includes('ردیف ۱'), 'ردیف جدول نیست');
    assert.ok(doc.textContent.includes('یادداشت تست'), 'یادداشت نیست');
    assert.ok(doc.querySelectorAll('table').length >= 2, 'جدول kpis و جدول داده لازم است');
    const td = doc.querySelector('tbody td');
    assert.equal(getComputedStyle(td).color, 'rgb(17, 17, 17)', 'سلول‌ها مشکی نیستند');
    assert.equal(doc.querySelector('canvas'), null, 'سند نباید اسکرین‌شات/نمودار باشد');
  } finally { doc.remove(); }
});

await test('چاپ فاکتور بدون به‌جاماندن المان در صفحه', async () => {
  const { printReceipt, buildReceiptElement } = await import('../js/core/receipt.js');
  const salesMod = await import('../js/services/salesService.js');
  const list = await salesMod.listSales({});
  const origPrint = window.print;
  window.print = () => {}; // jsdom پنجره چاپ ندارد
  try {
    printReceipt(list[0]);
  } finally {
    window.print = origPrint;
  }
  assert.equal(document.getElementById('print-root'), null, 'المان چاپ بعد از print پاک نشد');
  const el = buildReceiptElement(list[0]);
  assert.ok(el.querySelector('img'), 'لوگو در فاکتور نیست');
  el.remove();
});

await test('لوگوی سفارشی از تنظیمات روی فاکتور اعمال می‌شود', async () => {
  const { saveSettings } = await import('../js/core/settings.js');
  const { buildReceiptElement } = await import('../js/core/receipt.js');
  const salesMod = await import('../js/services/salesService.js');
  saveSettings({ restaurantLogo: 'data:image/jpeg;base64,/9j/testlogo' });
  try {
    const list = await salesMod.listSales({});
    const el = buildReceiptElement(list[0]);
    assert.ok(el.querySelector('img').getAttribute('src').startsWith('data:image/jpeg'), 'لوگوی سفارشی اعمال نشد');
    el.remove();
  } finally {
    saveSettings({ restaurantLogo: null });
  }
});

await test('تب «سود هر پرس و سود خالص» در بخش هزینه‌ها', async () => {
  await app.navigate('expenses');
  const page = document.getElementById('page');
  const tabBtn = page.querySelector('[data-tab="profit"]');
  assert.ok(tabBtn, 'تب سود هر پرس نیست');
  tabBtn.click();
  await new Promise((r) => setTimeout(r, 400));
  const body = document.getElementById('tab-body');
  assert.ok(body.textContent.includes('سود خالص ماه جاری'), 'KPI سود خالص نمایش داده نشد');
  assert.ok(body.textContent.includes('سود و زیان هر پرس غذا'), 'عنوان جدول سود هر پرس نیست');
  assert.ok(body.querySelector('table'), 'جدول سود هر پرس ساخته نشد');
  assert.ok(body.querySelectorAll('tbody tr').length > 0, 'هیچ غذایی در جدول سود نیست');
  // بازگشت به تب اسناد
  page.querySelector('[data-tab="list"]').click();
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(document.getElementById('tab-body').textContent.includes('دسته'), 'بازگشت به تب اسناد ناموفق بود');
});

await test('ورودی مبلغ به‌صورت زنده فارسی و سه‌رقمی می‌شود', async () => {
  const inp = document.createElement('input');
  inp.className = 'input num';
  inp.value = '1500';
  document.body.appendChild(inp);
  try {
    inp.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(inp.value, '۱٬۵۰۰', 'قالب‌بندی زنده اعمال نشد');
    inp.value = '۱٬۵۰۰0'; // ادامه تایپ
    inp.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(inp.value, '۱۵٬۰۰۰');
    inp.value = 'abc';
    inp.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(inp.value, 'abc', 'متن غیرعددی نباید خراب شود');
  } finally { inp.remove(); }
});

await test('ورودی‌های عددی و تاریخ با ارقام فارسی ساخته می‌شوند', async () => {
  const { fieldNum, fieldDate } = await import('../js/ui/components.js');
  const n = fieldNum({ id: 't-n', label: 'مبلغ', value: '1234567' });
  assert.ok(n.includes('۱٬۲۳۴٬۵۶۷'), 'مقدار اولیه فارسی با جداکننده نیست');
  const d = fieldDate({ id: 't-d', label: 'تاریخ', value: '1405-09-03' });
  assert.ok(d.includes('data-date-picker'), 'انتخابگر سه‌ستونی نیست');
  assert.ok(d.includes('آذر'), 'ستون ماه به نام فارسی نیست');
  assert.ok(d.includes('۱۴۰۵'), 'ستون سال فارسی نیست');
  assert.ok(d.includes('value="1405-09-03"'), 'مقدار پنهان انگلیسی نیست');
  // مقدار خالی (اختیاری) → گزینه «—»
  const d2 = fieldDate({ id: 't-d2', label: 'انقضا', value: '' });
  assert.ok(d2.includes('value=""'), 'تاریخ خالی باید مقدار پنهان خالی داشته باشد');
  assert.ok(d2.includes('>—<'), 'گزینه «—» برای حالت خالی نیست');
});

await test('فرمت تقویم: «۳ آذر ۱۴۰۵» در نمایش و برچسب نمودار', () => {
  assert.equal(U.fmtDate('1405-09-03'), '۳ آذر ۱۴۰۵');
  assert.equal(U.fmtDateLong('1405-01-01'), '۱ فروردین ۱۴۰۵');
  assert.equal(U.fmtDateShort('1405-09-03'), '۳ آذر');
  assert.equal(U.fmtDate(''), '—');
  // ورودی نامعتبر → مسیر عددی
  assert.equal(U.fmtDate('1404-13-45'), '۱۴۰۴/۱۳/۴۵');
});

await test('ستون‌های تاریخ: تغییر روز/ماه/سال مقدار پنهان را می‌سازد', async () => {
  const { datePickerHTML, setDateValue } = await import('../js/ui/components.js');
  const box = document.createElement('div');
  box.innerHTML = datePickerHTML('t-pick', '1405-09-03');
  document.body.appendChild(box);
  try {
    const hidden = box.querySelector('#t-pick');
    const day = box.querySelector('.dp-day');
    const mon = box.querySelector('.dp-month');
    const yr = box.querySelector('.dp-year');
    assert.equal(hidden.value, '1405-09-03');
    assert.equal(mon.value, '9', 'ماه آذر انتخاب نشده');
    assert.equal(day.value, '3');
    assert.equal(yr.value, '1405');

    // تغییر ماه به دی (۳۱ روز) — روز حفظ می‌شود
    mon.value = '10';
    mon.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(hidden.value, '1405-10-03', 'ماه در مقدار پنهان اعمال نشد');

    // دی ۳۰ روز دارد (ماه‌های ۷ تا ۱۲) — روز ۳۰ آخرین روز است
    day.value = '30';
    day.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(hidden.value, '1405-10-30');

    // روز ۳۱ در دی وجود ندارد → انتخاب نامعتبر به آخرین روز ماه می‌چسبد
    day.value = '31'; // در دی گزینه‌ای ندارد → مقدار خالی می‌شود
    day.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(hidden.value, '', 'روز ناموجود باید مقدار خالی بدهد');

    // اسفند ۱۴۰۴ (غیرکبیسه، ۲۹ روز): مقداردهی برنامه‌ای روز ۳۰ → ۲۹ می‌نشیند
    setDateValue(box, 't-pick', '1404-12-30');
    assert.equal(hidden.value, '1404-12-29', `چسبیدن روز به آخر ماه انجام نشد: ${hidden.value}`);
    assert.equal(box.querySelector('.dp-day').value, '29');

    // فروردین ۳۱ روز دارد
    setDateValue(box, 't-pick', '1405-01-31');
    assert.equal(box.querySelector('.dp-day').value, '31');
    assert.equal(box.querySelector('.dp-month').value, '1');

    // حالت خالی با انتخاب روز پر می‌شود
    setDateValue(box, 't-pick', '');
    assert.equal(hidden.value, '');
    assert.equal(box.querySelector('.dp-day').value, '', 'بعد از خالی کردن روز باید «—» شود');
    day.value = '5';
    mon.value = '6';
    yr.value = '1405';
    day.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(hidden.value, '1405-06-05');

    // مقداردهی برنامه‌ای هم ستون‌ها را همگام می‌کند
    setDateValue(box, 't-pick', '1405-02-15');
    assert.equal(hidden.value, '1405-02-15');
    assert.equal(mon.value, '2');
    assert.equal(day.value, '15');
    assert.equal(yr.value, '1405');
  } finally { box.remove(); }
});

await test('ثبت هزینه با تاریخ و مبلغ فارسی از مودال', async () => {
  await app.navigate('expenses');
  const page = document.getElementById('page');
  page.querySelector('#btn-new').click();
  const modal = document.querySelector('.modal-backdrop');
  assert.ok(modal, 'مودال هزینه باز نشد');
  modal.querySelector('#x-date').value = U.toFa(U.todayJalali());
  modal.querySelector('#x-cat').value = 'تست فارسی';
  modal.querySelector('#x-amount').value = '۲٬۵۰۰';
  modal.querySelector('[data-save]').click();
  await new Promise((r) => setTimeout(r, 300));

  const exp = await import('../js/services/expenseService.js');
  const rows = await exp.listExpenses({ date: U.todayJalali(), category: 'تست فارسی' });
  assert.equal(rows.length, 1, 'سند با تاریخ فارسی ذخیره نشد');
  assert.equal(rows[0].amount, 2500, 'مبلغ فارسی درست خوانده نشد');
  await exp.deleteExpense(rows[0].id);
});

await test('شماره فاکتور فارسی در رسید + همگام‌سازی لوگوی نوار کناری', async () => {
  const receipt = await import('../js/core/receipt.js');
  const salesMod = await import('../js/services/salesService.js');
  const { saveSettings, syncBrandLogo } = await import('../js/core/settings.js');
  const list = await salesMod.listSales({});
  const el = receipt.buildReceiptElement(list[0]);
  try {
    assert.ok(el.textContent.includes(U.toFa(list[0].id.slice(-8))), 'شماره فاکتور در رسید فارسی نیست');
  } finally { el.remove(); }

  saveSettings({ restaurantLogo: 'data:image/jpeg;base64,abcd' });
  try {
    syncBrandLogo();
    assert.ok(document.querySelector('.brand-logo').src.startsWith('data:image/jpeg'), 'لوگوی نوار کناری همگام نشد');
  } finally {
    saveSettings({ restaurantLogo: null });
    syncBrandLogo();
    assert.ok(document.querySelector('.brand-logo').src.includes('logo.png'), 'لوگو به پیش‌فرض برنگشت');
  }
});

/* ============================================================ */
console.log('\n════════════════════════════════');
console.log(`نتیجه: ${passed} موفق | ${failed} ناموفق`);
if (failed) {
  console.log('\nجزئیات خطاها:');
  for (const f of failures) {
    console.log(`\n✗ ${f.name}`);
    console.log(f.e.stack.split('\n').slice(0, 6).join('\n'));
  }
  process.exit(1);
}
console.log('✓ همه تست‌ها با موفقیت گذشتند');
