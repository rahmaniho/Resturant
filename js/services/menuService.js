/* ============================================================
   سرویس مدیریت منو — دسته‌بندی و غذا (بدون هیچ دسته ثابت در کد)
   ============================================================ */

import * as db from '../core/db.js';
import { uid, normalize, num } from '../core/utils.js';

/* ---------- دسته‌بندی‌ها ---------- */

export async function listCategories() {
  const cats = await db.getAll('categories');
  return cats.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'fa'));
}

export async function addCategory({ name, note = '' }) {
  const n = String(name || '').trim();
  if (!n) throw new Error('نام دسته‌بندی الزامی است');
  const all = await db.getAll('categories');
  if (all.some((c) => normalize(c.name) === normalize(n))) throw new Error('دسته‌بندی با این نام از قبل وجود دارد');
  const maxSort = all.reduce((m, c) => Math.max(m, c.sort ?? 0), 0);
  const cat = { id: uid('cat'), name: n, note: String(note || '').trim(), sort: maxSort + 1, createdAt: Date.now() };
  await db.put('categories', cat);
  await db.logHistory({ entity: 'categories', entityId: cat.id, action: 'create', after: cat });
  return cat;
}

export async function updateCategory(id, patch) {
  const before = await db.get('categories', id);
  if (!before) throw new Error('دسته‌بندی یافت نشد');
  const name = String(patch.name ?? before.name).trim();
  if (!name) throw new Error('نام دسته‌بندی الزامی است');
  const all = await db.getAll('categories');
  if (all.some((c) => c.id !== id && normalize(c.name) === normalize(name))) throw new Error('دسته‌بندی با این نام از قبل وجود دارد');
  const after = { ...before, name, note: patch.note ?? before.note, sort: patch.sort ?? before.sort, updatedAt: Date.now() };
  await db.put('categories', after);
  await db.logHistory({ entity: 'categories', entityId: id, action: 'update', before, after });
  return after;
}

export async function deleteCategory(id) {
  const before = await db.get('categories', id);
  if (!before) throw new Error('دسته‌بندی یافت نشد');
  const foods = await db.getByIndex('foods', 'categoryId', id);
  if (foods.length) throw new Error(`این دسته ${foods.length} غذا دارد؛ ابتدا غذاها را منتقل یا حذف کنید`);
  await db.del('categories', id);
  await db.logHistory({ entity: 'categories', entityId: id, action: 'delete', before });
  return true;
}

/* ---------- غذاها ---------- */

export async function listFoods({ includeInactive = true } = {}) {
  const foods = await db.getAll('foods');
  const out = includeInactive ? foods : foods.filter((f) => f.active !== false);
  return out.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

export async function addFood({ categoryId, name, price, description = '', image = null, active = true }) {
  const n = String(name || '').trim();
  if (!n) throw new Error('نام غذا الزامی است');
  if (!categoryId) throw new Error('دسته‌بندی را انتخاب کنید');
  const cat = await db.get('categories', categoryId);
  if (!cat) throw new Error('دسته‌بندی یافت نشد');
  const priceN = Math.round(num(price, 0)); // ارقام فارسی و جداکننده هزارگان
  if (priceN < 0) throw new Error('قیمت نمی‌تواند منفی باشد');
  const all = await db.getAll('foods');
  if (all.some((f) => f.categoryId === categoryId && normalize(f.name) === normalize(n))) {
    throw new Error('غذایی با این نام در این دسته وجود دارد');
  }
  const food = {
    id: uid('food'), categoryId, name: n, price: priceN,
    description: String(description || '').trim(), image: image || null,
    active: active !== false, createdAt: Date.now(), updatedAt: Date.now(),
  };
  await db.put('foods', food);
  await db.logHistory({ entity: 'foods', entityId: food.id, action: 'create', after: food });
  return food;
}

export async function updateFood(id, patch) {
  const before = await db.get('foods', id);
  if (!before) throw new Error('غذا یافت نشد');
  const name = String(patch.name ?? before.name).trim();
  if (!name) throw new Error('نام غذا الزامی است');
  const categoryId = patch.categoryId ?? before.categoryId;
  const cat = await db.get('categories', categoryId);
  if (!cat) throw new Error('دسته‌بندی یافت نشد');
  const all = await db.getAll('foods');
  if (all.some((f) => f.id !== id && f.categoryId === categoryId && normalize(f.name) === normalize(name))) {
    throw new Error('غذایی با این نام در این دسته وجود دارد');
  }
  const after = {
    ...before,
    name, categoryId,
    price: patch.price != null ? Math.round(num(patch.price, 0)) : before.price, // ارقام فارسی
    description: patch.description ?? before.description,
    image: patch.image !== undefined ? patch.image : before.image,
    active: patch.active !== undefined ? patch.active : before.active,
    updatedAt: Date.now(),
  };
  await db.put('foods', after);
  await db.logHistory({ entity: 'foods', entityId: id, action: 'update', before, after });
  return after;
}

export async function deleteFood(id) {
  const before = await db.get('foods', id);
  if (!before) throw new Error('غذا یافت نشد');
  const sales = (await db.getAll('sales')).some((s) => (s.items || []).some((i) => i.foodId === id));
  if (sales) throw new Error('این غذا در فروش‌ها ثبت شده است؛ برای حفظ سوابق مالی غیرفعالش کنید');
  await db.del('foods', id);
  await db.del('recipes', id); // کلید رسپی = foodId
  await db.logHistory({ entity: 'foods', entityId: id, action: 'delete', before });
  return true;
}

/* ---------- داده پیشنهادی (فازهای ۱ تا ۳ — به‌صورت داده، نه کد ثابت) ---------- */

export const SUGGESTED_MENU = [
  { name: 'صبحانه', foods: ['املت گوجه', 'املت گوجه و پنیر', 'نیمرو ساده', 'نیمرو زرده', 'پنیر و سبزی', 'گردو و پنیر', 'مربا و کره', 'عسل و خامه', 'کره و پنیر', 'فرنی', 'خاچاپوری'] },
  { name: 'املت', foods: ['املت گوجه', 'املت پنیر', 'املت گردو', 'املت سبزیجات', 'املت قارچ'] },
  { name: 'نیمرو', foods: ['نیمرو ساده', 'نیمرو زرده', 'نیمرو با پنیر', 'نیمرو با گردو'] },
  { name: 'عدسی', foods: ['عدسی ساده', 'عدسی با ترشی', 'عدسی و نان تازه'] },
  { name: 'لوبیا', foods: ['لوبیا ساده', 'لوبیا با ترشی', 'لوبیا و نان'] },
  { name: 'نان', foods: ['نان تازه', 'نان سنگک', 'نان لواش', 'نان بربری', 'نان تست'] },
  { name: 'پنیر', foods: ['پنیر سفید', 'پنیر صبحانه', 'پنیر و گردو'] },
  { name: 'گردو', foods: ['گردو تازه', 'مغز گردو'] },
  { name: 'نوشیدنی', foods: ['چای', 'چای شیرین', 'قهوه', 'کاپوچینو', 'نسکافه', 'دمنوش', 'نوشابه', 'دوغ', 'آب', 'دلستر', 'آب پرتقال', 'شیر'] },
  { name: 'جگر', foods: ['جگر سرخ‌کرده', 'جگر با پیاز'] },
  { name: 'قلوه', foods: ['قلوه سرخ‌کرده'] },
  { name: 'دل', foods: ['دل سرخ‌کرده'] },
  { name: 'آش رشته', foods: ['آش رشته'] },
  { name: 'حلیم', foods: ['حلیم'] },
  { name: 'عصرانه', foods: ['کیک', 'شیرینی', 'بستنی', 'میوه فصل'] },
  { name: 'پیتزا', foods: ['پیتزا مخصوص', 'پیتزا پنیر', 'پیتزا قارچ و گوشت', 'پیتزا سبزیجات', 'پیتزا پپرونی'] },
  { name: 'ساندویچ', foods: ['ساندویچ کالباس', 'ساندویچ مرغ', 'ساندویچ گوشت', 'ساندویچ مخصوص', 'هات‌داگ'] },
  { name: 'برگر', foods: ['برگر گوشت', 'برگر مرغ', 'چیز برگر'] },
  { name: 'سیب‌زمینی', foods: ['سیب‌زمینی سرخ‌کرده', 'سیب‌زمینی با پنیر'] },
  { name: 'غذای شام', foods: ['کباب', 'جوجه‌کباب', 'خورش قیمه', 'خورش قورمه‌سبزی', 'پلو مخلوط', 'خورش کرفس', 'خورش بامیه'] },
  { name: 'کباب', foods: ['کباب برگ', 'کباب چنجه', 'چلوکباب'] },
  { name: 'پلو', foods: ['زرشک پلو', 'باقالی پلو', 'ته‌چین', 'چلو ساده'] },
  { name: 'سوپ', foods: ['سوپ جو', 'سوپ مرغ', 'سوپ سبزیجات'] },
  { name: 'نوشیدنی گرم', foods: ['هات چاکلت', 'شیر گرم', 'ماسالا چای', 'اسپرسو'] },
  { name: 'نوشیدنی سرد', foods: ['لیموناد', 'آب انار', 'شربت به', 'شیر کاکائو'] },
  { name: 'دسر', foods: ['باقلوا', 'کوکی شکلاتی', 'دونات', 'کرم کارامل'] },
];

/* ---------- تصاویر منو: نام غذا → فایل تصویر ----------
   هر ۹۹ قلم منو عکس واقعی (jpg فشرده‌شده) دارد.
   مسیرهای نسبی‌اند تا آفلاین و در GitHub Pages هم کار کنند. */
export const MENU_IMAGES = {
  "چای": "tea.jpg",
  "چای شیرین": "tea-sweet.jpg",
  "قهوه": "coffee.jpg",
  "کاپوچینو": "cappuccino.jpg",
  "نسکافه": "nescafe.jpg",
  "دمنوش": "herbal-tea.jpg",
  "نوشابه": "soda.jpg",
  "دوغ": "doogh.jpg",
  "آب": "water.jpg",
  "آب پرتقال": "orange-juice.jpg",
  "شیر": "milk.jpg",
  "دلستر": "malt-drink.jpg",
  "املت گوجه": "omelette-tomato.jpg",
  "املت گوجه و پنیر": "omelette-tomato-cheese.jpg",
  "املت پنیر": "omelette-cheese.jpg",
  "املت گردو": "omelette-walnut.jpg",
  "املت سبزیجات": "omelette-veggie.jpg",
  "املت قارچ": "omelette-mushroom.jpg",
  "نیمرو ساده": "sunny-egg-plain.jpg",
  "نیمرو زرده": "sunny-egg-yolk.jpg",
  "نیمرو با پنیر": "sunny-egg-cheese.jpg",
  "نیمرو با گردو": "sunny-egg-walnut.jpg",
  "پنیر و سبزی": "cheese-herbs.jpg",
  "گردو و پنیر": "walnut-cheese.jpg",
  "مربا و کره": "jam-butter.jpg",
  "عسل و خامه": "honey-cream.jpg",
  "کره و پنیر": "butter-cheese.jpg",
  "عدسی ساده": "adasi.jpg",
  "عدسی با ترشی": "adasi-pickles.jpg",
  "عدسی و نان تازه": "adasi-nan.jpg",
  "لوبیا ساده": "lobio.jpg",
  "لوبیا با ترشی": "lobio-pickles.jpg",
  "لوبیا و نان": "lobio-nan.jpg",
  "نان تازه": "nan-fresh.jpg",
  "نان سنگک": "nan-sangak.jpg",
  "نان لواش": "nan-lavash.jpg",
  "نان بربری": "nan-barbari.jpg",
  "نان تست": "bread-toast.jpg",
  "پنیر سفید": "cheese-white.jpg",
  "پنیر صبحانه": "cheese-breakfast.jpg",
  "پنیر و گردو": "cheese-walnut.jpg",
  "گردو تازه": "walnut-fresh.jpg",
  "مغز گردو": "walnut-kernel.jpg",
  "جگر سرخ‌کرده": "liver-fried.jpg",
  "جگر با پیاز": "liver-onion.jpg",
  "قلوه سرخ‌کرده": "kidney-fried.jpg",
  "دل سرخ‌کرده": "heart-fried.jpg",
  "آش رشته": "ash-reshteh.jpg",
  "حلیم": "haleem.jpg",
  "کیک": "cake.jpg",
  "شیرینی": "pastry.jpg",
  "بستنی": "ice-cream.jpg",
  "میوه فصل": "seasonal-fruit.jpg",
  "پیتزا مخصوص": "pizza-special.jpg",
  "پیتزا پنیر": "pizza-cheese.jpg",
  "پیتزا قارچ و گوشت": "pizza-mushroom-meat.jpg",
  "ساندویچ کالباس": "sandwich-salami.jpg",
  "ساندویچ مرغ": "sandwich-chicken.jpg",
  "ساندویچ گوشت": "sandwich-beef.jpg",
  "ساندویچ مخصوص": "sandwich-special.jpg",
  "برگر گوشت": "burger-beef.jpg",
  "برگر مرغ": "burger-chicken.jpg",
  "چیز برگر": "cheeseburger.jpg",
  "سیب‌زمینی سرخ‌کرده": "fries.jpg",
  "سیب‌زمینی با پنیر": "fries-cheese.jpg",
  "کباب": "kebab.jpg",
  "جوجه‌کباب": "jujeh-kebab.jpg",
  "خورش قیمه": "gheimeh.jpg",
  "خورش قورمه‌سبزی": "ghormeh-sabzi.jpg",
  "پلو مخلوط": "polo-mix.jpg",
  "هات چاکلت": "hot-chocolate.jpg",
  "شیر گرم": "warm-milk.jpg",
  "ماسالا چای": "masala-tea.jpg",
  "اسپرسو": "espresso.jpg",
  "لیموناد": "lemonade.jpg",
  "آب انار": "pomegranate-juice.jpg",
  "شربت به": "sharbat-be.jpg",
  "شیر کاکائو": "chocolate-milk.jpg",
  "سوپ جو": "soup-jow.jpg",
  "سوپ مرغ": "soup-chicken.jpg",
  "سوپ سبزیجات": "soup-vegetable.jpg",
  "کباب برگ": "kebab-barg.jpg",
  "کباب چنجه": "kebab-chenje.jpg",
  "چلوکباب": "chelow-kebab.jpg",
  "زرشک پلو": "zereshk-polo.jpg",
  "باقالی پلو": "baghali-polo.jpg",
  "ته‌چین": "tahchin.jpg",
  "چلو ساده": "chelow-sade.jpg",
  "باقلوا": "baklava.jpg",
  "کوکی شکلاتی": "choc-cookie.jpg",
  "دونات": "donut.jpg",
  "کرم کارامل": "creme-caramel.jpg",
  "فرنی": "fereni.jpg",
  "خاچاپوری": "khachapuri.jpg",
  "پیتزا سبزیجات": "pizza-veggie.jpg",
  "پیتزا پپرونی": "pizza-pepperoni.jpg",
  "هات‌داگ": "hotdog.jpg",
  "خورش کرفس": "khorsh-karafs.jpg",
  "خورش بامیه": "khorsh-bamieh.jpg",
};

/** مسیر تصویر پیشنهادی برای یک نام غذا (در صورت نبود، null) */
export function imageForFood(name) {
  const key = String(name || '').trim();
  if (MENU_IMAGES[key]) return `./img/menu/${MENU_IMAGES[key]}`;
  // تطبیق بدون حروف اضافه: «آب معدنی» ← «آب»
  const aliases = { 'آب معدنی': 'آب', 'چای سبز': 'دمنوش', 'اسپرسو': 'قهوه', 'پیتزا': 'پیتزا مخصوص', 'کباب کوبیده': 'کباب' };
  const alias = aliases[key];
  if (alias && MENU_IMAGES[alias]) return `./img/menu/${MENU_IMAGES[alias]}`;
  return null;
}

/**
 * اعمال تصاویر پیشنهادی روی غذاهای بدون تصویر (و به‌روزرسانی مسیرهای مدیریت‌شده قدیمی).
 * تصاویر آپلودی کاربر (dataURL) هرگز دست نمی‌خورند. ایدمپوتنت.
 */
export async function applyMenuImages() {
  const foods = await listFoods();
  let updated = 0;
  for (const food of foods) {
    const img = imageForFood(food.name);
    if (!img) continue;
    const managed = !food.image || String(food.image).startsWith('./img/menu/');
    if (managed && food.image !== img) {
      await db.put('foods', { ...food, image: img, updatedAt: Date.now() });
      updated += 1;
    }
  }
  return updated;
}

/**
 * ساخت دسته‌ها و غذاهای پیشنهادی — فقط مواردی که وجود ندارند اضافه می‌شوند.
 * این داده‌ها قابل حذف و ویرایش‌اند و هیچ دسته‌ای در کد ثابت نیست.
 */
export async function seedSuggestedMenu({ withPrices = false } = {}) {
  const cats = await listCategories();
  const foods = await listFoods();
  let addedCats = 0;
  let addedFoods = 0;
  let sort = cats.reduce((m, c) => Math.max(m, c.sort ?? 0), 0);

  for (const group of SUGGESTED_MENU) {
    let cat = cats.find((c) => normalize(c.name) === normalize(group.name));
    if (!cat) {
      sort += 1;
      cat = { id: uid('cat'), name: group.name, note: '', sort, createdAt: Date.now() };
      await db.put('categories', cat);
      cats.push(cat);
      addedCats += 1;
    }
    for (const fname of group.foods) {
      if (foods.some((f) => f.categoryId === cat.id && normalize(f.name) === normalize(fname))) continue;
      const food = {
        id: uid('food'), categoryId: cat.id, name: fname,
        price: withPrices ? 0 : 0, description: '', image: imageForFood(fname),
        active: true, createdAt: Date.now(), updatedAt: Date.now(),
      };
      await db.put('foods', food);
      foods.push(food);
      addedFoods += 1;
    }
  }
  await applyMenuImages();
  await db.logHistory({
    entity: 'menu', entityId: 'seed', action: 'create',
    note: `ساخت منوی پیشنهادی: ${addedCats} دسته، ${addedFoods} غذا`,
  });
  return { addedCats, addedFoods };
}
