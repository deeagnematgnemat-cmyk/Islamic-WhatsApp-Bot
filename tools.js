// ============ tools.js : قسم الأدوات (17) ============
// مواقيت الصلاة لجميع دول العالم (الأردن بطريقة وزارة الأوقاف الأردنية) • حاسبة • تاريخ هجري/ميلادي • عملات • طقس
// عمري • زخرفة • QR • اختصار روابط • باسورد • قرعة • تصويت • تذكير
import crypto from 'crypto';
import axios from 'axios';
import QRCode from 'qrcode';
import { sendSectionWithButtons } from './menu.js';

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- أدوات نصية عامة
const stripMarks = (s) => s.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
export const nz = (s) => stripMarks(String(s || '').toLowerCase())
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
// مفتاح المقارنة للكلمة: تطبيع + حذف «ال» التعريف
const keyOf = (w) => { const k = nz(w).replace(/\s/g, ''); return k.length > 3 && k.startsWith('ال') ? k.slice(2) : k; };
const toEnDigits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const pad2 = (n) => String(n).padStart(2, '0');
const friendly = (msg) => Object.assign(new Error('FRIENDLY'), { friendly: msg });

async function http(url, opts = {}) {
    let err;
    for (let i = 0; i < 2; i++) {
        try { return await axios.get(url, { timeout: 12000, headers: { 'User-Agent': UA, Accept: 'application/json' }, ...opts }); }
        catch (e) { err = e; await sleep(700); }
    }
    throw err;
}

// ---------------------------------------------------------------- المناطق الزمنية (بدون مكتبات)
// الأردن وسوريا على توقيت +03 ثابت منذ أكتوبر 2022؛ نثبّته حتى لا يتأثر البوت بنسخة tzdata قديمة على السيرفر
const FIXED_TZ = { 'Asia/Amman': 180, 'Asia/Damascus': 180 };
function tzOffsetMs(epoch, tz) {
    if (FIXED_TZ[tz] !== undefined && epoch >= Date.UTC(2022, 9, 29)) return FIXED_TZ[tz] * 60000;
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date(epoch)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(epoch / 1000) * 1000;
}
function zonedToEpoch(y, m, d, hh, mm, tz) {
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    let t = guess - tzOffsetMs(guess, tz);
    t = guess - tzOffsetMs(t, tz);
    return t;
}
function nowParts(tz, dayOffset = 0) {
    const e = Date.now();
    const local = new Date(e + tzOffsetMs(e, tz) + dayOffset * 86400000);
    return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), wd: local.getUTCDay() };
}

const AR_WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_M_STD = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const AR_M_LEV = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const LEVANT = new Set(['JO', 'PS', 'SY', 'LB', 'IQ']);
const monthName = (m, iso) => (LEVANT.has(iso) ? AR_M_LEV : AR_M_STD)[m - 1];
const t12 = (h, m) => `${h % 12 || 12}:${pad2(m)} ${h >= 12 ? 'م' : 'ص'}`;

// ---------------------------------------------------------------- جميع دول العالم: الاسم|رمز الدولة|العاصمة
const COUNTRIES_RAW = [
    // الدول العربية
    'الأردن,المملكة الأردنية الهاشمية|JO|Amman', 'السعودية,المملكة العربية السعودية|SA|Riyadh', 'الإمارات,الإمارات العربية المتحدة|AE|Abu Dhabi',
    'الكويت|KW|Kuwait City', 'قطر|QA|Doha', 'البحرين|BH|Manama', 'سلطنة عمان,مسقط|OM|Muscat', 'اليمن|YE|Sanaa',
    'مصر|EG|Cairo', 'السودان|SD|Khartoum', 'ليبيا|LY|Tripoli', 'تونس|TN|Tunis', 'الجزائر|DZ|Algiers', 'المغرب|MA|Rabat',
    'موريتانيا|MR|Nouakchott', 'الصومال|SO|Mogadishu', 'جيبوتي|DJ|Djibouti', 'جزر القمر|KM|Moroni',
    'فلسطين|PS|Jerusalem', 'سوريا|SY|Damascus', 'لبنان|LB|Beirut', 'العراق|IQ|Baghdad',
    // آسيا
    'تركيا|TR|Ankara', 'إيران|IR|Tehran', 'باكستان|PK|Islamabad', 'أفغانستان|AF|Kabul', 'الهند|IN|New Delhi', 'بنغلاديش|BD|Dhaka',
    'سريلانكا|LK|Colombo', 'نيبال|NP|Kathmandu', 'بوتان|BT|Thimphu', 'جزر المالديف,المالديف|MV|Male', 'إندونيسيا,اندونيسيا|ID|Jakarta',
    'ماليزيا|MY|Kuala Lumpur', 'سنغافورة|SG|Singapore', 'بروناي|BN|Bandar Seri Begawan', 'الفلبين|PH|Manila', 'تايلاند|TH|Bangkok',
    'فيتنام|VN|Hanoi', 'كمبوديا|KH|Phnom Penh', 'لاوس|LA|Vientiane', 'ميانمار,بورما|MM|Naypyidaw', 'الصين|CN|Beijing', 'اليابان|JP|Tokyo',
    'كوريا الجنوبية,كوريا|KR|Seoul', 'كوريا الشمالية|KP|Pyongyang', 'منغوليا|MN|Ulaanbaatar', 'تايوان|TW|Taipei', 'تيمور الشرقية|TL|Dili',
    'كازاخستان|KZ|Astana', 'أوزبكستان|UZ|Tashkent', 'تركمانستان|TM|Ashgabat', 'طاجيكستان|TJ|Dushanbe', 'قيرغيزستان|KG|Bishkek',
    'أذربيجان|AZ|Baku', 'أرمينيا|AM|Yerevan', 'جورجيا|GE|Tbilisi', 'قبرص|CY|Nicosia', 'روسيا|RU|Moscow',
    // أوروبا
    'بريطانيا,المملكة المتحدة,إنجلترا,انجلترا|GB|London', 'أيرلندا,ايرلندا|IE|Dublin', 'فرنسا|FR|Paris', 'ألمانيا|DE|Berlin', 'إيطاليا|IT|Rome',
    'إسبانيا,اسبانيا|ES|Madrid', 'البرتغال|PT|Lisbon', 'هولندا|NL|Amsterdam', 'بلجيكا|BE|Brussels', 'لوكسمبورغ|LU|Luxembourg',
    'سويسرا|CH|Bern', 'النمسا|AT|Vienna', 'السويد|SE|Stockholm', 'النرويج|NO|Oslo', 'الدنمارك|DK|Copenhagen', 'فنلندا|FI|Helsinki',
    'أيسلندا,ايسلندا|IS|Reykjavik', 'بولندا|PL|Warsaw', 'التشيك|CZ|Prague', 'سلوفاكيا|SK|Bratislava', 'المجر|HU|Budapest',
    'رومانيا|RO|Bucharest', 'بلغاريا|BG|Sofia', 'اليونان|GR|Athens', 'صربيا|RS|Belgrade', 'كرواتيا|HR|Zagreb', 'سلوفينيا|SI|Ljubljana',
    'البوسنة والهرسك,البوسنة|BA|Sarajevo', 'الجبل الأسود|ME|Podgorica', 'مقدونيا الشمالية,مقدونيا|MK|Skopje', 'ألبانيا,البانيا|AL|Tirana',
    'كوسوفو|XK|Pristina', 'مولدوفا|MD|Chisinau', 'أوكرانيا,اوكرانيا|UA|Kyiv', 'بيلاروسيا|BY|Minsk', 'ليتوانيا|LT|Vilnius', 'لاتفيا|LV|Riga',
    'إستونيا,استونيا|EE|Tallinn', 'مالطا|MT|Valletta', 'أندورا,اندورا|AD|Andorra la Vella', 'موناكو|MC|Monaco', 'سان مارينو|SM|San Marino',
    'ليختنشتاين|LI|Vaduz', 'الفاتيكان|VA|Vatican City',
    // الأمريكتان
    'أمريكا,الولايات المتحدة,الولايات المتحدة الأمريكية,امريكا|US|Washington', 'كندا|CA|Ottawa', 'المكسيك|MX|Mexico City', 'كوبا|CU|Havana',
    'جامايكا|JM|Kingston', 'هايتي|HT|Port-au-Prince', 'جمهورية الدومينيكان,الدومينيكان|DO|Santo Domingo', 'غواتيمالا|GT|Guatemala City',
    'هندوراس|HN|Tegucigalpa', 'السلفادور|SV|San Salvador', 'نيكاراغوا|NI|Managua', 'كوستاريكا|CR|San Jose', 'بنما|PA|Panama City',
    'بيليز|BZ|Belmopan', 'كولومبيا|CO|Bogota', 'فنزويلا|VE|Caracas', 'الإكوادور,الاكوادور|EC|Quito', 'بيرو|PE|Lima', 'بوليفيا|BO|La Paz',
    'تشيلي|CL|Santiago', 'الأرجنتين,الارجنتين|AR|Buenos Aires', 'أوروغواي,اوروغواي|UY|Montevideo', 'باراغواي|PY|Asuncion', 'البرازيل|BR|Brasilia',
    'غيانا|GY|Georgetown', 'سورينام|SR|Paramaribo', 'ترينيداد وتوباغو,ترينيداد|TT|Port of Spain', 'جزر البهاما,الباهاما|BS|Nassau',
    'بربادوس|BB|Bridgetown', 'غرينادا|GD|Saint George', 'سانت لوسيا|LC|Castries', 'دومينيكا|DM|Roseau', 'أنتيغوا وبربودا,انتيغوا|AG|Saint John',
    'سانت كيتس ونيفيس|KN|Basseterre', 'سانت فنسنت والغرينادين,سانت فنسنت|VC|Kingstown',
    // أفريقيا
    'نيجيريا|NG|Abuja', 'غانا|GH|Accra', 'السنغال|SN|Dakar', 'مالي|ML|Bamako', 'النيجر|NE|Niamey', 'تشاد|TD|N\'Djamena', 'بوركينا فاسو|BF|Ouagadougou',
    'ساحل العاج,كوت ديفوار|CI|Abidjan', 'غينيا|GN|Conakry', 'سيراليون|SL|Freetown', 'ليبيريا|LR|Monrovia', 'غامبيا|GM|Banjul',
    'غينيا بيساو|GW|Bissau', 'الرأس الأخضر,الراس الاخضر,كابو فيردي|CV|Praia', 'توغو|TG|Lome', 'بنين|BJ|Porto-Novo', 'الكاميرون|CM|Yaounde',
    'الغابون|GA|Libreville', 'الكونغو,جمهورية الكونغو|CG|Brazzaville', 'الكونغو الديمقراطية,جمهورية الكونغو الديمقراطية|CD|Kinshasa',
    'أفريقيا الوسطى,افريقيا الوسطى|CF|Bangui', 'غينيا الاستوائية|GQ|Malabo', 'ساو تومي وبرينسيب,ساو تومي|ST|Sao Tome', 'إثيوبيا,اثيوبيا|ET|Addis Ababa',
    'إريتريا,اريتريا|ER|Asmara', 'كينيا|KE|Nairobi', 'تنزانيا|TZ|Dodoma', 'أوغندا,اوغندا|UG|Kampala', 'رواندا|RW|Kigali', 'بوروندي|BI|Gitega',
    'جنوب السودان|SS|Juba', 'زامبيا|ZM|Lusaka', 'زيمبابوي|ZW|Harare', 'مالاوي|MW|Lilongwe', 'موزمبيق|MZ|Maputo', 'مدغشقر|MG|Antananarivo',
    'موريشيوس|MU|Port Louis', 'سيشل|SC|Victoria', 'أنغولا,انغولا|AO|Luanda', 'ناميبيا|NA|Windhoek', 'بوتسوانا|BW|Gaborone',
    'جنوب أفريقيا,جنوب افريقيا|ZA|Pretoria', 'ليسوتو|LS|Maseru', 'إسواتيني,سوازيلاند|SZ|Mbabane',
    // أوقيانوسيا
    'أستراليا,استراليا|AU|Canberra', 'نيوزيلندا|NZ|Wellington', 'فيجي|FJ|Suva', 'بابوا غينيا الجديدة|PG|Port Moresby', 'ساموا|WS|Apia',
    'تونغا|TO|Nuku\'alofa', 'فانواتو|VU|Port Vila', 'جزر سليمان|SB|Honiara', 'كيريباتي|KI|Tarawa', 'ميكرونيزيا|FM|Palikir', 'بالاو|PW|Ngerulmud',
    'جزر مارشال|MH|Majuro', 'ناورو|NR|Yaren', 'توفالو|TV|Funafuti'
];

const COUNTRIES = COUNTRIES_RAW.map((line) => {
    const [names, iso, capital] = line.split('|');
    const list = names.split(',');
    return { iso, capital, label: list[0], nameKeys: list.map((n) => n.trim().split(/\s+/).map(keyOf)) };
});
const BY_ISO = Object.fromEntries(COUNTRIES.map((c) => [c.iso, c]));

// طريقة حساب المواقيت المعتمدة لكل دولة (تعريف aladhan.com). الباقي: رابطة العالم الإسلامي (3)
const METHOD_BY_ISO = {
    JO: 23, PS: 23,                       // وزارة الأوقاف والشؤون والمقدسات الإسلامية - الأردن
    SA: 4, YE: 4,                         // أم القرى
    KW: 9, QA: 10, AE: 16, BH: 8, OM: 8,  // الخليج
    EG: 5, SD: 5, LY: 5,                  // الهيئة المصرية العامة للمساحة
    TN: 18, DZ: 19, MA: 21,
    TR: 13, IR: 7, RU: 14, FR: 12, PT: 22,
    PK: 1, BD: 1, IN: 1, AF: 1,           // كراتشي
    MY: 17, BN: 17, SG: 11, ID: 20,
    US: 2, CA: 2                          // أمريكا الشمالية (ISNA)
};
const METHOD_NAME = {
    1: 'جامعة العلوم الإسلامية - كراتشي', 2: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)', 3: 'رابطة العالم الإسلامي',
    4: 'أم القرى - مكة المكرمة', 5: 'الهيئة المصرية العامة للمساحة', 7: 'معهد الجيوفيزياء - جامعة طهران', 8: 'منطقة الخليج العربي',
    9: 'الكويت', 10: 'قطر', 11: 'المجلس الإسلامي - سنغافورة', 12: 'اتحاد المنظمات الإسلامية - فرنسا', 13: 'رئاسة الشؤون الدينية - تركيا',
    14: 'الإدارة الروحية لمسلمي روسيا', 16: 'دبي', 17: 'ماليزيا (JAKIM)', 18: 'تونس', 19: 'الجزائر', 20: 'وزارة الشؤون الدينية - إندونيسيا',
    21: 'المغرب', 22: 'لشبونة - البرتغال', 23: 'وزارة الأوقاف والشؤون والمقدسات الإسلامية - الأردن'
};
const HANAFI = new Set(['PK', 'IN', 'BD', 'AF']);      // العصر بمذهب الأحناف في هذه الدول
const methodOf = (iso) => METHOD_BY_ISO[iso] || 3;

// مدن الأردن وفلسطين بإحداثيات مثبّتة (لا تعتمد على أي بحث خارجي) — اسم المدينة,بدائلها|الدولة|المنطقة الزمنية|خط العرض|خط الطول
const PLACES_RAW = [
    'عمان,Amman,عمّان|JO|Asia/Amman|31.9539|35.9106', 'إربد,اربد,Irbid|JO|Asia/Amman|32.5556|35.8479', 'الزرقاء,Zarqa|JO|Asia/Amman|32.0728|36.0876',
    'العقبة,Aqaba|JO|Asia/Amman|29.5267|35.0078', 'السلط,Salt|JO|Asia/Amman|32.0392|35.7272', 'مادبا,Madaba|JO|Asia/Amman|31.7160|35.7939',
    'الكرك,Karak|JO|Asia/Amman|31.1853|35.7048', 'معان,Maan|JO|Asia/Amman|30.1963|35.7340', 'الطفيلة,Tafilah|JO|Asia/Amman|30.8375|35.6044',
    'جرش,Jerash|JO|Asia/Amman|32.2808|35.8993', 'عجلون,Ajloun|JO|Asia/Amman|32.3326|35.7517', 'المفرق,Mafraq|JO|Asia/Amman|32.3406|36.2080',
    'الرمثا,Ramtha|JO|Asia/Amman|32.5662|36.0058', 'الرصيفة,Russeifa|JO|Asia/Amman|32.0167|36.0500', 'وادي موسى,البتراء,Petra|JO|Asia/Amman|30.3222|35.4750',
    'وادي رم,Wadi Rum|JO|Asia/Amman|29.5766|35.4200', 'الأزرق,الازرق,Azraq|JO|Asia/Amman|31.8833|36.8167', 'الشوبك,Shobak|JO|Asia/Amman|30.4911|35.5603',
    'أم قيس,ام قيس,Umm Qais|JO|Asia/Amman|32.6522|35.6806',
    'القدس,الأقصى,الاقصى,Jerusalem|PS|Asia/Jerusalem|31.7683|35.2137', 'غزة,Gaza|PS|Asia/Gaza|31.5017|34.4668', 'رام الله,Ramallah|PS|Asia/Hebron|31.9038|35.2034',
    'نابلس,Nablus|PS|Asia/Hebron|32.2211|35.2544', 'الخليل,Hebron|PS|Asia/Hebron|31.5326|35.0998', 'بيت لحم,Bethlehem|PS|Asia/Hebron|31.7054|35.2024',
    'جنين,Jenin|PS|Asia/Hebron|32.4610|35.3000', 'طولكرم,Tulkarm|PS|Asia/Hebron|32.3104|35.0286', 'قلقيلية,Qalqilya|PS|Asia/Hebron|32.1893|34.9707',
    'أريحا,اريحا,Jericho|PS|Asia/Hebron|31.8611|35.4619', 'رفح,Rafah|PS|Asia/Gaza|31.2969|34.2435', 'خان يونس,Khan Younis|PS|Asia/Gaza|31.3462|34.3063'
];
const PLACES = PLACES_RAW.map((line) => {
    const [names, iso, tz, lat, lng] = line.split('|');
    const list = names.split(',');
    return { iso, tz, lat: +lat, lng: +lng, label: list[0], nameKeys: list.map((n) => n.trim().split(/\s+/).map(keyOf)) };
});

// ---------------------------------------------------------------- تحديد الموقع (دولة + مدينة)
function findSub(keys, nk) {   // موضع المتتالية nk داخل keys
    for (let i = 0; i + nk.length <= keys.length; i++) if (nk.every((w, j) => keys[i + j] === w)) return i;
    return -1;
}
function matchCountry(keys) {
    let best = null;
    for (const c of COUNTRIES) {
        for (const nk of c.nameKeys) {
            const n = nk.length;
            if (n > keys.length) continue;
            let start = -1;
            if (nk.every((w, i) => keys[i] === w)) start = 0;
            else if (nk.every((w, i) => keys[keys.length - n + i] === w)) start = keys.length - n;
            if (start >= 0 && (!best || n > best.n)) best = { c, n, start };
        }
    }
    return best;
}
function findPlace(keys, iso = null) {
    let best = null;
    for (const p of PLACES) {
        if (iso && p.iso !== iso) continue;
        for (const nk of p.nameKeys) {
            if (findSub(keys, nk) >= 0 && (!best || nk.length > best.n)) best = { p, n: nk.length };
        }
    }
    return best ? best.p : null;
}
async function geocode(name, iso) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=ar&format=json${iso ? `&countryCode=${iso}` : ''}`;
    const { data } = await http(url);
    let r = data?.results || [];
    if (iso) r = r.filter((x) => x.country_code === iso);
    return r[0] || null;
}
const placeToLoc = (p) => ({ iso: p.iso, country: BY_ISO[p.iso]?.label || '', city: p.label, lat: p.lat, lng: p.lng, tz: p.tz });
async function geoToLoc(g, iso, countryLabel) {
    const isoFinal = iso || g.country_code;
    return { iso: isoFinal, country: countryLabel || BY_ISO[isoFinal]?.label || g.country || '', city: g.name, lat: g.latitude, lng: g.longitude, tz: g.timezone || 'UTC' };
}
const NOT_FOUND = '❌ لم أجد هذا المكان.\n💡 اكتب الدولة ثم المدينة، مثال: `.مواقيت مصر الاسكندرية` أو `.مواقيت اربد` أو `.مواقيت السعودية جدة`.\n🌍 لعرض الدول المتاحة اكتب `.دول`';

async function resolveLocation(args) {
    const rawWords = String(args || '').split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, '')).filter(Boolean);
    const keys = rawWords.map(keyOf);
    const pairs = rawWords.map((w, i) => [w, keys[i]]).filter(([, k]) => k);
    const rw = pairs.map((p) => p[0]); const ks = pairs.map((p) => p[1]);
    const amman = PLACES[0];
    if (!ks.length) return placeToLoc(amman);

    const m = matchCountry(ks);
    if (m) {
        const { c } = m;
        const restRaw = [...rw.slice(0, m.start), ...rw.slice(m.start + m.n)];
        const restKeys = [...ks.slice(0, m.start), ...ks.slice(m.start + m.n)];
        if (!restKeys.length) {
            const p = c.iso === 'JO' ? PLACES[0] : (c.iso === 'PS' ? PLACES.find((x) => x.label === 'القدس') : null);
            if (p) return placeToLoc(p);
            const g = await geocode(c.capital, c.iso);
            if (!g) throw friendly(NOT_FOUND);
            return geoToLoc(g, c.iso, c.label);
        }
        const p = findPlace(restKeys, c.iso);
        if (p) return placeToLoc(p);
        const g = await geocode(restRaw.join(' '), c.iso);
        if (!g) throw friendly(NOT_FOUND);
        return geoToLoc(g, c.iso, c.label);
    }
    const p = findPlace(ks);
    if (p) return placeToLoc(p);
    const g = await geocode(rw.join(' '), null);
    if (!g) throw friendly(NOT_FOUND);
    return geoToLoc(g, null, null);
}

// ---------------------------------------------------------------- مواقيت الصلاة
const prayerCache = new Map();
const hm = (s) => { const m = /(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? { h: +m[1], m: +m[2] } : null; };

async function getPrayer(loc, dayOffset = 0) {
    const dp = nowParts(loc.tz, dayOffset);
    const dateStr = `${pad2(dp.d)}-${pad2(dp.m)}-${dp.y}`;
    const method = methodOf(loc.iso);
    const school = HANAFI.has(loc.iso) ? 1 : 0;
    const key = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)},${method},${school},${dateStr}`;
    if (prayerCache.has(key)) return prayerCache.get(key);

    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${loc.lat}&longitude=${loc.lng}&method=${method}&school=${school}&timezonestring=${encodeURIComponent(loc.tz)}`;
    let data;
    try { data = (await http(url)).data; } catch (e) { throw friendly('❌ تعذر جلب المواقيت الآن (الخدمة لا تستجيب). حاول مرة أخرى بعد قليل.'); }
    const t = data?.data?.timings;
    if (data?.code !== 200 || !t) throw friendly('❌ وصلت استجابة غير صالحة من خدمة المواقيت. حاول مرة أخرى بعد قليل.');

    const times = {};
    for (const k of ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Lastthird']) times[k] = hm(t[k]);
    if (!times.Fajr || !times.Dhuhr || !times.Asr || !times.Maghrib || !times.Isha) throw friendly('❌ بيانات المواقيت غير مكتملة. حاول مرة أخرى بعد قليل.');
    const hj = data.data.date?.hijri;
    const out = {
        times, dp, tz: loc.tz, method,
        hijri: hj ? `${+hj.day} ${stripMarks(hj.month?.ar || '')} ${hj.year} هـ` : ''
    };
    if (prayerCache.size > 800) prayerCache.clear();
    prayerCache.set(key, out);
    return out;
}

const EVENTS = [['🌙', 'الفجر', 'Fajr'], ['🌅', 'الشروق', 'Sunrise'], ['☀️', 'الظهر', 'Dhuhr'], ['🌤️', 'العصر', 'Asr'], ['🌇', 'المغرب', 'Maghrib'], ['🌃', 'العشاء', 'Isha']];
const fmtRemain = (ms) => {
    const mins = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(mins / 60); const m = mins % 60;
    if (h && m) return `${h} ساعة و ${m} دقيقة`;
    if (h) return `${h} ساعة`;
    return `${m} دقيقة`;
};

async function cmdPrayer(c) {
    const loc = await resolveLocation(c.args);
    const day = await getPrayer(loc);
    const now = Date.now();
    let next = null;
    for (const [, name, k] of EVENTS) {
        const tm = day.times[k]; if (!tm) continue;
        const e = zonedToEpoch(day.dp.y, day.dp.m, day.dp.d, tm.h, tm.m, day.tz);
        if (e > now) { next = { name, e }; break; }
    }
    if (!next) {
        try {
            const tom = await getPrayer(loc, 1);
            next = { name: 'الفجر (غداً)', e: zonedToEpoch(tom.dp.y, tom.dp.m, tom.dp.d, tom.times.Fajr.h, tom.times.Fajr.m, tom.tz) };
        } catch (e) {}
    }
    const lines = EVENTS.filter(([, , k]) => day.times[k]).map(([ic, name, k]) => `> ${ic} ${name} ↞ *${t12(day.times[k].h, day.times[k].m)}*`);
    const place = loc.country && loc.city && nz(loc.country) !== nz(loc.city) ? `${loc.city} — ${loc.country}` : (loc.city || loc.country);
    const greg = `${AR_WD[day.dp.wd]} ${day.dp.d} ${monthName(day.dp.m, loc.iso)} ${day.dp.y}`;
    let text = `🕌 *مواقيت الصلاة*\n\n📍 ${place}\n📅 ${greg}${day.hijri ? `\n🌙 ${day.hijri}` : ''}\n\n${lines.join('\n')}`;
    if (day.times.Lastthird) text += `\n> 🌌 الثلث الأخير من الليل ↞ *${t12(day.times.Lastthird.h, day.times.Lastthird.m)}*`;
    if (next) text += `\n\n⏭️ *الصلاة القادمة:* ${next.name} بعد ${fmtRemain(next.e - now)}`;
    text += `\n\n🧭 الطريقة: ${METHOD_NAME[day.method] || 'رابطة العالم الإسلامي'}${HANAFI.has(loc.iso) ? ' (العصر حنفي)' : ''}\n🕰️ التوقيت المحلي: ${loc.tz}`;
    await c.reply(text);
}

function cmdCountries(c) {
    const names = COUNTRIES.map((x) => x.label);
    return c.reply(`🌍 *الدول المتاحة (${names.length}):*\n\n${names.join(' • ')}\n\n💡 مثال: \`.مواقيت مصر القاهرة\` • \`.مواقيت السعودية جدة\` • \`.مواقيت سلطنة عمان\`\n🇯🇴 للأردن: \`.مواقيت اربد\` أو \`.مواقيت العقبة\``);
}

// ---------------------------------------------------------------- الحاسبة (محلّل آمن بدون eval)
function evalMath(input) {
    let s = toEnDigits(input).toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/٫/g, '.').replace(/[،]/g, ',')
        .replace(/(?<=\d),(?=\d{3}(\D|$))/g, '').replace(/(?<=[\d)\s])x(?=[\d(\s.])/g, '*').replace(/جذر/g, 'sqrt').replace(/مطلق/g, 'abs').replace(/تقريب/g, 'round');
    if (s.length > 200) throw friendly('❌ العملية طويلة جداً.');
    const re = /\s*(\d+(?:\.\d+)?|\.\d+|[a-z]+|[-+*/^%()])/gy;
    const toks = []; let m; let last = 0;
    while ((m = re.exec(s)) !== null) { toks.push(m[1]); last = re.lastIndex; }
    if (s.slice(last).trim()) throw friendly('❌ العملية تحتوي رموزاً غير مدعومة.');
    if (!toks.length) throw friendly('❌ اكتب عملية حسابية.');
    let i = 0;
    const peek = () => toks[i]; const next = () => toks[i++];
    const FN = { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil };
    const CONST = { pi: Math.PI, e: Math.E };
    const bad = () => friendly('❌ صيغة العملية غير صحيحة.');
    function primary() {
        const t = next();
        if (t === undefined) throw bad();
        if (/^[\d.]/.test(t)) return { v: parseFloat(t) };
        if (t === '(') { const r = expr(); if (next() !== ')') throw bad(); return { v: r.v }; }
        if (/^[a-z]+$/.test(t)) {
            if (t in CONST && peek() !== '(') return { v: CONST[t] };
            if (t in FN && next() === '(') { const r = expr(); if (next() !== ')') throw bad(); return { v: FN[t](r.v) }; }
        }
        throw bad();
    }
    function postfix() { let p = primary(); let pct = false; while (peek() === '%') { next(); p = { v: p.v / 100 }; pct = true; } return { v: p.v, pct }; }
    function power() { const b = postfix(); if (peek() === '^') { next(); const e = unary(); return { v: Math.pow(b.v, e.v), pct: false }; } return b; }
    function unary() { if (peek() === '-') { next(); return { v: -unary().v, pct: false }; } if (peek() === '+') { next(); return unary(); } return power(); }
    function term() { let l = unary(); while (peek() === '*' || peek() === '/') { const op = next(); const r = unary(); l = { v: op === '*' ? l.v * r.v : l.v / r.v, pct: false }; } return l; }
    function expr() { let l = term(); while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); const rv = r.pct ? l.v * r.v : r.v; l = { v: op === '+' ? l.v + rv : l.v - rv, pct: false }; } return l; }
    const res = expr();
    if (i < toks.length) throw bad();
    if (!Number.isFinite(res.v)) throw friendly('❌ الناتج غير معرّف (قسمة على صفر أو رقم كبير جداً).');
    return res.v;
}
const fmtNum = (v) => {
    if (Math.abs(v) >= 1e15 || (v !== 0 && Math.abs(v) < 1e-9)) return v.toExponential(6);
    return Number(v.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 10 });
};
async function cmdCalc(c) {
    if (!c.args) return c.reply('🧮 *الحاسبة*\n\nمثال: `.حاسبة 25*4+10` • `.حاسبة (100+50)/3` • `.حاسبة 200+10%` • `.حاسبة جذر(144)` • `.حاسبة 2^10`');
    const v = evalMath(c.args);
    await c.reply(`🧮 *الحاسبة*\n\n📝 ${c.args}\n✅ النتيجة: *${fmtNum(v)}*`);
}

// ---------------------------------------------------------------- التاريخ هجري/ميلادي
const HIJRI_NUM = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
const HIJRI_LONG = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const noonUTC = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));
function hijriParts(date) { const p = Object.fromEntries(HIJRI_NUM.formatToParts(date).map((x) => [x.type, x.value])); return { y: +p.year, m: +p.month, d: +p.day }; }
const hijriText = (date) => HIJRI_LONG.format(date).replace(/\u200f/g, '');
function hijriToGregorian(y, m, d) {
    const approx = Math.floor(y * 0.970224 + 621.5744);
    let day = Date.UTC(approx - 1, 0, 1, 12);
    const end = Date.UTC(approx + 2, 0, 1, 12);
    for (; day <= end; day += 86400000) { const h = hijriParts(new Date(day)); if (h.y === y && h.m === m && h.d === d) return new Date(day); }
    return null;
}
function parseGregorian(s) {
    const t = toEnDigits(s).trim();
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
    if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
    if (m) return { y: +m[3], m: +m[2], d: +m[1] };
    return null;
}
const validYMD = (o) => o && o.m >= 1 && o.m <= 12 && o.d >= 1 && o.d <= new Date(Date.UTC(o.y, o.m, 0)).getUTCDate() && o.y >= 1900 && o.y <= 2200;

async function cmdDate(c) {
    const a = nz(toEnDigits(c.args || ''));
    const isH = /^(هجري|هجريه|hijri|h)(\s|$)/.test(a);
    if (isH) {
        const rest = toEnDigits(c.args).replace(/^\S+\s*/, '');
        const m = /^(\d{3,4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(rest.trim());
        if (!m) return c.reply('❌ الصيغة: `.تاريخ هجري 1448/5/22`');
        const g = hijriToGregorian(+m[1], +m[2], +m[3]);
        if (!g) return c.reply('❌ تاريخ هجري غير صالح (المدى المدعوم 1300–1600 هـ).');
        return c.reply(`📅 *تحويل التاريخ*\n\n🌙 هجري: ${hijriText(g)}\n📆 ميلادي: *${AR_WD[g.getUTCDay()]} ${g.getUTCDate()} ${AR_M_LEV[g.getUTCMonth()]} (${AR_M_STD[g.getUTCMonth()]}) ${g.getUTCFullYear()}*\n\nℹ️ التقويم: أم القرى (قد يختلف يوماً عن إعلان دار الإفتاء بحسب رؤية الهلال).`);
    }
    let dp;
    if (!c.args) dp = nowParts('Asia/Amman');
    else { dp = parseGregorian(c.args); if (!validYMD(dp)) return c.reply('❌ الصيغة: `.تاريخ` أو `.تاريخ 2026/11/2` أو `.تاريخ هجري 1448/5/22`'); }
    const g = noonUTC(dp.y, dp.m, dp.d);
    await c.reply(`📅 *${c.args ? 'تحويل التاريخ' : 'تاريخ اليوم (توقيت الأردن)'}*\n\n📆 ميلادي: *${AR_WD[g.getUTCDay()]} ${dp.d} ${AR_M_LEV[dp.m - 1]} (${AR_M_STD[dp.m - 1]}) ${dp.y}*\n🌙 هجري: *${hijriText(g)}*\n\nℹ️ التقويم الهجري: أم القرى (قد يختلف يوماً عن إعلان دار الإفتاء بحسب رؤية الهلال).`);
}

// ---------------------------------------------------------------- العملات
const CUR_RAW = {
    USD: 'دولار,دولار أمريكي,دولار امريكي,usd', EUR: 'يورو,eur', GBP: 'جنيه إسترليني,جنيه استرليني,استرليني,باوند,gbp',
    JOD: 'دينار أردني,دينار اردني,دينار,أردني,اردني,jod', KWD: 'دينار كويتي,كويتي,kwd', BHD: 'دينار بحريني,بحريني,bhd', IQD: 'دينار عراقي,عراقي,iqd',
    LYD: 'دينار ليبي,ليبي,lyd', TND: 'دينار تونسي,تونسي,tnd', DZD: 'دينار جزائري,جزائري,dzd', SAR: 'ريال سعودي,ريال,سعودي,sar', QAR: 'ريال قطري,قطري,qar',
    OMR: 'ريال عماني,عماني,omr', YER: 'ريال يمني,يمني,yer', AED: 'درهم إماراتي,درهم اماراتي,درهم,إماراتي,اماراتي,aed', MAD: 'درهم مغربي,مغربي,mad',
    EGP: 'جنيه مصري,جنيه,مصري,egp', SDG: 'جنيه سوداني,سوداني,sdg', TRY: 'ليرة تركية,تركي,try', SYP: 'ليرة سورية,سوري,syp', LBP: 'ليرة لبنانية,لبناني,lbp',
    ILS: 'شيكل,ils', JPY: 'ين,ين ياباني,jpy', CNY: 'يوان,يوان صيني,cny', INR: 'روبية هندية,روبية,inr', PKR: 'روبية باكستانية,pkr',
    CHF: 'فرنك سويسري,فرنك,chf', CAD: 'دولار كندي,كندي,cad', AUD: 'دولار أسترالي,دولار استرالي,aud', RUB: 'روبل,روبل روسي,rub',
    SEK: 'كرونة سويدية,sek', NOK: 'كرونة نرويجية,nok', DKK: 'كرونة دنماركية,dkk', MYR: 'رينغيت,رينغيت ماليزي,myr', IDR: 'روبية إندونيسية,روبية اندونيسية,idr',
    KRW: 'وون,وون كوري,krw', BRL: 'ريال برازيلي,برازيلي,brl', ZAR: 'راند,راند جنوب أفريقي,zar', SGD: 'دولار سنغافوري,سنغافوري,sgd', MXN: 'بيزو مكسيكي,بيزو,mxn'
};
const CUR_ALIAS = new Map();
for (const [code, names] of Object.entries(CUR_RAW)) for (const n of names.split(',')) CUR_ALIAS.set(n.trim().split(/\s+/).map(keyOf).join(' '), code);
const CUR_FLAG = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JOD: '🇯🇴', KWD: '🇰🇼', BHD: '🇧🇭', SAR: '🇸🇦', AED: '🇦🇪', QAR: '🇶🇦', OMR: '🇴🇲', EGP: '🇪🇬', TRY: '🇹🇷', ILS: '🇮🇱', IQD: '🇮🇶', LBP: '🇱🇧', SYP: '🇸🇾' };
let ratesCache = { at: 0, rates: null, upd: '' };
async function getRates() {
    if (ratesCache.rates && Date.now() - ratesCache.at < 3600000) return ratesCache;
    const sources = ['https://open.er-api.com/v6/latest/USD', 'https://api.exchangerate-api.com/v4/latest/USD'];
    for (const u of sources) {
        try {
            const { data } = await http(u);
            const rates = data?.rates;
            if (rates && rates.USD) { ratesCache = { at: Date.now(), rates, upd: data.time_last_update_utc || data.date || '' }; return ratesCache; }
        } catch (e) {}
    }
    if (ratesCache.rates) return ratesCache;
    throw friendly('❌ تعذر جلب أسعار العملات الآن. حاول مرة أخرى بعد قليل.');
}
async function cmdCurrency(c) {
    const usage = '💱 *تحويل العملات*\n\nمثال: `.عملة 100 دولار دينار` • `.عملة 50 JOD USD` • `.عملة 1000 ريال سعودي دينار اردني`\nإذا لم تحدد العملة الهدف يحوّل إلى الدينار الأردني.';
    if (!c.args) return c.reply(usage);
    const words = toEnDigits(c.args).split(/\s+/).filter(Boolean);
    let amount = null; const rest = [];
    for (const w of words) {
        const n = w.replace(/,/g, '');
        if (amount === null && /^\d+(\.\d+)?$/.test(n)) amount = parseFloat(n);
        else if (!['الي', 'الى', 'إلى', 'to', 'في', 'in', '->', '=>'].includes(nz(w)) && !['to', 'in', '->', '=>'].includes(w.toLowerCase())) rest.push(w);
    }
    if (amount === null) amount = 1;
    const ks = rest.map(keyOf).filter(Boolean);
    const found = [];
    for (let i = 0; i < ks.length;) {
        let hit = null;
        for (let n = Math.min(3, ks.length - i); n >= 1; n--) {
            const phrase = ks.slice(i, i + n).join(' ');
            if (CUR_ALIAS.has(phrase)) { hit = { code: CUR_ALIAS.get(phrase), n }; break; }
            if (n === 1 && /^[a-z]{3}$/.test(phrase)) { hit = { code: phrase.toUpperCase(), n: 1 }; break; }
        }
        if (hit) { found.push(hit.code); i += hit.n; } else i++;
    }
    if (!found.length) return c.reply(`❌ لم أتعرف على العملة.\n\n${usage}`);
    const from = found[0]; const to = found[1] || (from === 'JOD' ? 'USD' : 'JOD');
    const { rates, upd } = await getRates();
    if (!rates[from] || !rates[to]) return c.reply('❌ إحدى العملات غير مدعومة.');
    const rate = rates[to] / rates[from];
    const out = amount * rate;
    const dec = (v) => v >= 100 ? 2 : (v >= 1 ? 3 : 5);
    const f = (v) => v.toLocaleString('en-US', { maximumFractionDigits: dec(Math.abs(v)) });
    await c.reply(`💱 *تحويل العملات*\n\n${CUR_FLAG[from] || ''} ${f(amount)} ${from}\n⬇️\n${CUR_FLAG[to] || ''} *${f(out)} ${to}*\n\n📊 السعر: 1 ${from} = ${f(rate)} ${to}\n🕒 آخر تحديث: ${upd ? upd.replace(/\s\+0000$/, ' UTC') : 'غير متوفر'}\nℹ️ أسعار السوق المتوسطة وليست أسعار البنوك أو الصرافة.`);
}

// ---------------------------------------------------------------- الطقس
const WMO = { 0: '☀️ صافٍ', 1: '🌤️ غالباً صافٍ', 2: '⛅ غائم جزئياً', 3: '☁️ غائم', 45: '🌫️ ضباب', 48: '🌫️ ضباب كثيف', 51: '🌦️ رذاذ خفيف', 53: '🌦️ رذاذ', 55: '🌦️ رذاذ كثيف', 56: '🌧️ رذاذ متجمد', 57: '🌧️ رذاذ متجمد كثيف', 61: '🌧️ مطر خفيف', 63: '🌧️ مطر', 65: '🌧️ مطر غزير', 66: '🌧️ مطر متجمد', 67: '🌧️ مطر متجمد غزير', 71: '🌨️ ثلج خفيف', 73: '❄️ ثلج', 75: '❄️ ثلج كثيف', 77: '❄️ حبيبات ثلج', 80: '🌦️ زخات مطر خفيفة', 81: '🌧️ زخات مطر', 82: '⛈️ زخات مطر غزيرة', 85: '🌨️ زخات ثلج', 86: '❄️ زخات ثلج كثيفة', 95: '⛈️ عاصفة رعدية', 96: '⛈️ عاصفة رعدية مع برد', 99: '⛈️ عاصفة رعدية مع برد كثيف' };
async function cmdWeather(c) {
    const loc = await resolveLocation(c.args);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
    let d;
    try { d = (await http(url)).data; } catch (e) { throw friendly('❌ تعذر جلب الطقس الآن. حاول مرة أخرى بعد قليل.'); }
    const cur = d?.current; const day = d?.daily;
    if (!cur) throw friendly('❌ تعذر جلب الطقس الآن.');
    const place = loc.country && nz(loc.country) !== nz(loc.city) ? `${loc.city} — ${loc.country}` : loc.city;
    const r = (v) => Math.round(v);
    let t = `🌤️ *الطقس*\n\n📍 ${place}\n\n${WMO[cur.weather_code] || '🌡️'}\n🌡️ الحرارة: *${r(cur.temperature_2m)}°م* (تُحسّ كأنها ${r(cur.apparent_temperature)}°)\n💧 الرطوبة: ${r(cur.relative_humidity_2m)}%\n💨 الرياح: ${r(cur.wind_speed_10m)} كم/س`;
    if (day?.temperature_2m_max?.length) t += `\n\n📈 العظمى اليوم: ${r(day.temperature_2m_max[0])}° • 📉 الصغرى: ${r(day.temperature_2m_min[0])}°\n☔ احتمال المطر: ${day.precipitation_probability_max?.[0] ?? 0}%`;
    await c.reply(t);
}

// ---------------------------------------------------------------- العمر
async function cmdAge(c) {
    const b = parseGregorian(c.args || '');
    if (!validYMD(b)) return c.reply('🎂 *حساب العمر*\n\nمثال: `.عمري 2000/5/20` أو `.عمري 20-05-2000`');
    const t = nowParts('Asia/Amman');
    let y = t.y - b.y; let m = t.m - b.m; let d = t.d - b.d;
    if (d < 0) { m--; d += new Date(Date.UTC(t.y, t.m - 1, 0)).getUTCDate(); }
    if (m < 0) { y--; m += 12; }
    if (y < 0) return c.reply('❌ تاريخ الميلاد في المستقبل!');
    const days = Math.floor((Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
    let nb = Date.UTC(t.y, b.m - 1, b.d); if (nb < Date.UTC(t.y, t.m - 1, t.d)) nb = Date.UTC(t.y + 1, b.m - 1, b.d);
    const left = Math.round((nb - Date.UTC(t.y, t.m - 1, t.d)) / 86400000);
    await c.reply(`🎂 *عمرك*\n\n📅 ${y} سنة و ${m} شهر و ${d} يوم\n🗓️ مجموع الأيام: ${days.toLocaleString('en-US')} يوم\n⏳ باقي على عيد ميلادك: ${left === 0 ? 'اليوم! 🎉' : `${left} يوم`}`);
}

// ---------------------------------------------------------------- الزخرفة
function mapLatin(str, up, low, ex = {}) {
    return [...str].map((ch) => {
        if (ex[ch]) return ex[ch];
        const cp = ch.codePointAt(0);
        if (cp >= 65 && cp <= 90) return String.fromCodePoint(up + cp - 65);
        if (cp >= 97 && cp <= 122) return String.fromCodePoint(low + cp - 97);
        return ch;
    }).join('');
}
const SMALL_CAPS = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
const DS_EX = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };
const IT_EX = { h: 'ℎ' };
const AR_LETTER = /[\u0621-\u064A]/;
const AR_NOCONNECT = new Set('اأإآدذرزوؤءةى'.split(''));
function kashida(s, rep = 1) {
    const ch = [...s]; let out = '';
    for (let i = 0; i < ch.length; i++) {
        out += ch[i];
        if (AR_LETTER.test(ch[i]) && ch[i + 1] && AR_LETTER.test(ch[i + 1]) && !AR_NOCONNECT.has(ch[i])) out += 'ـ'.repeat(rep);
    }
    return out;
}
async function cmdFont(c) {
    const text = (c.args || '').trim();
    if (!text) return c.reply('✨ *الزخرفة*\n\nمثال: `.زخرفة Eren` أو `.زخرفة أبو خالد`');
    if (text.length > 60) return c.reply('❌ النص طويل، الحد الأقصى 60 حرفاً.');
    const hasAr = AR_LETTER.test(text);
    const hasEn = /[a-z]/i.test(text);
    const out = [];
    if (hasAr) {
        out.push(kashida(text, 1), kashida(text, 2), `『✦ ${kashida(text, 1)} ✦』`, `꧁༺ ${text} ༻꧂`, `★彡 ${text} 彡★`, `𓆩 ${text} 𓆪`, `⌯ ${text} ⌯`, `✧･ﾟ: *✧･ﾟ:* ${text} *:･ﾟ✧*:･ﾟ✧`, `❖ ${kashida(text, 1)} ❖`, `ﮩ٨ـﮩﮩ ${kashida(text, 1)} ﮩ٨ـﮩﮩ`);
    }
    if (hasEn) {
        out.push(mapLatin(text, 0x1D400, 0x1D41A), mapLatin(text, 0x1D434, 0x1D44E, IT_EX), mapLatin(text, 0x1D468, 0x1D482), mapLatin(text, 0x1D4D0, 0x1D4EA),
            mapLatin(text, 0x1D56C, 0x1D586), mapLatin(text, 0x1D538, 0x1D552, DS_EX), mapLatin(text, 0x1D670, 0x1D68A), mapLatin(text, 0x1D5D4, 0x1D5EE),
            mapLatin(text, 0x24B6, 0x24D0), mapLatin(text, 0xFF21, 0xFF41),
            [...text].map((ch) => SMALL_CAPS[ch.toLowerCase()] || ch).join(''), `꧁༺ ${text} ༻꧂`, `★彡 ${text} 彡★`);
    }
    if (!out.length) out.push(`『✦ ${text} ✦』`, `꧁༺ ${text} ༻꧂`, `★彡 ${text} 彡★`);
    await c.reply(`✨ *الزخرفة*\n\n${out.map((x, i) => `${i + 1}) ${x}`).join('\n\n')}`);
}

// ---------------------------------------------------------------- QR + اختصار الروابط
const quotedTextOf = (msg) => {
    const q = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    return q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || q?.videoMessage?.caption || '';
};
async function cmdQR(c) {
    const text = (c.args || quotedTextOf(c.msg) || '').trim();
    if (!text) return c.reply('📱 *إنشاء QR*\n\nمثال: `.qr https://example.com` أو `.qr نص أي شيء` (أو بالرد على رسالة).');
    if (text.length > 1000) return c.reply('❌ النص طويل جداً (الحد 1000 حرف).');
    const buf = await QRCode.toBuffer(text, { width: 700, margin: 2, errorCorrectionLevel: 'M' });
    await c.media({ image: buf, caption: '📱 رمز QR جاهز للمسح' });
}
async function cmdShorten(c) {
    const raw = (c.args || quotedTextOf(c.msg) || '').trim().split(/\s+/)[0] || '';
    if (!/^https?:\/\/\S+\.\S+/i.test(raw)) return c.reply('🔗 *اختصار الروابط*\n\nمثال: `.اختصار https://example.com/very/long/link`');
    let short = null;
    try { const { data } = await http(`https://is.gd/create.php?format=json&url=${encodeURIComponent(raw)}`); short = data?.shorturl || null; } catch (e) {}
    if (!short) { try { const { data } = await http(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(raw)}`, { responseType: 'text' }); if (/^https?:\/\//.test(String(data))) short = String(data).trim(); } catch (e) {} }
    if (!short) throw friendly('❌ تعذر اختصار الرابط الآن. حاول لاحقاً.');
    await c.reply(`🔗 *الرابط المختصر:*\n${short}`);
}

// ---------------------------------------------------------------- باسورد / قرعة / تصويت / تذكير
async function cmdPassword(c) {
    let n = parseInt(toEnDigits(c.args || ''), 10);
    if (!Number.isFinite(n)) n = 14;
    n = Math.min(64, Math.max(6, n));
    const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?-_'];
    const all = sets.join('');
    const chars = sets.map((s) => s[crypto.randomInt(s.length)]);
    while (chars.length < n) chars.push(all[crypto.randomInt(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    await c.reply(`🔐 *كلمة مرور قوية (${n} خانة):*\n\n\`${chars.join('')}\`\n\n⚠️ المجموعة ترى الرسالة، فاستخدمها كمثال ولا تعتمدها لحساب مهم.`);
}
async function cmdPick(c) {
    const items = (c.args || '').split(/[|\n,،]+/).map((x) => x.trim()).filter(Boolean);
    if (items.length >= 2) {
        const w = items[crypto.randomInt(items.length)];
        return c.reply(`🎲 *القرعة*\n\nالخيارات: ${items.length}\n🏆 الفائز: *${w}*`);
    }
    const meta = await c.sock.groupMetadata(c.from);
    const botNum = (c.sock.user?.id || '').split(':')[0].split('@')[0];
    const pool = meta.participants.map((p) => p.id).filter((id) => id.split(':')[0].split('@')[0] !== botNum);
    if (!pool.length) return c.reply('❌ لا يوجد أعضاء للقرعة.');
    const w = pool[crypto.randomInt(pool.length)];
    await c.reply(`🎲 *القرعة*\n\n🏆 وقعت القرعة على @${w.split('@')[0]} 🎉`, [w]);
}
async function cmdPoll(c) {
    const parts = (c.args || '').split('|').map((x) => x.trim()).filter(Boolean);
    if (parts.length < 3) return c.reply('📊 *تصويت*\n\nالصيغة: `.تصويت السؤال | خيار1 | خيار2 | خيار3`\n(من خيارين إلى 12 خياراً)');
    const [name, ...values] = parts;
    if (values.length > 12) return c.reply('❌ الحد الأقصى 12 خياراً.');
    await c.sock.sendMessage(c.from, { poll: { name: name.slice(0, 250), values: values.map((v) => v.slice(0, 100)), selectableCount: 1 } });
}
const reminders = new Map();   // المرسل -> عدد التذكيرات النشطة
const UNITS = [[/^(ث|ثانيه|ثانية|ثواني|ثوان|s|sec)$/, 1000], [/^(د|دقيقه|دقيقة|دقائق|دقايق|m|min)$/, 60000], [/^(س|ساعه|ساعة|ساعات|h|hr)$/, 3600000]];
async function cmdRemind(c) {
    const usage = '⏰ *تذكير*\n\nمثال: `.تذكير 30د اشتري خبز` • `.تذكير 2س موعد الاجتماع` • `.تذكير 45ث الشاي`\nالوحدات: ث (ثواني) • د (دقائق) • س (ساعات) — بحد أقصى 24 ساعة.';
    const a = toEnDigits(c.args || '').trim();
    const m = /^(\d+(?:\.\d+)?)\s*(\S*)\s*([\s\S]*)$/.exec(a);
    if (!m) return c.reply(usage);
    let [, num, unitTok, text] = m;
    let mult = null;
    const tryUnit = (tok) => { const k = nz(tok).replace(/\s/g, ''); const u = UNITS.find(([re]) => re.test(k)); return u ? u[1] : null; };
    mult = tryUnit(unitTok);
    if (mult === null) { text = `${unitTok} ${text}`.trim(); mult = 60000; }   // بدون وحدة = دقائق
    const ms = parseFloat(num) * mult;
    if (!Number.isFinite(ms) || ms < 1000) return c.reply(usage);
    if (ms > 24 * 3600000) return c.reply('❌ الحد الأقصى للتذكير 24 ساعة.');
    if ((reminders.get(c.sender) || 0) >= 5) return c.reply('❌ لديك 5 تذكيرات نشطة، انتظر حتى ينتهي أحدها.');
    reminders.set(c.sender, (reminders.get(c.sender) || 0) + 1);
    const note = text.trim() || 'حان الوقت!';
    setTimeout(async () => {
        reminders.set(c.sender, Math.max(0, (reminders.get(c.sender) || 1) - 1));
        try { await c.sock.sendMessage(c.from, { text: `⏰ *تذكير* @${c.sender.split('@')[0]}\n\n📝 ${note}`, mentions: [c.sender] }, { quoted: c.msg }); }
        catch (e) { try { await c.sock.sendMessage(c.from, { text: `⏰ *تذكير* @${c.sender.split('@')[0]}\n\n📝 ${note}`, mentions: [c.sender] }); } catch (e2) {} }
    }, ms);
    await c.reply(`✅ تم ضبط التذكير بعد *${fmtRemain(ms)}*\n📝 ${note}\n\nℹ️ التذكيرات تُلغى إذا أُعيد تشغيل البوت.`);
}

// ---------------------------------------------------------------- نص القسم
export const TOOLS_SECTION = `🧰 *قِـسْـمُ الأَدَوَاتِ:*

🕌 *مواقيت الصلاة (كل دول العالم):*
> 🕌 .مواقيت ↞ مواقيت عمّان (الأردن) بطريقة وزارة الأوقاف
> 🇯🇴 .مواقيت اربد ↞ أي مدينة أردنية: عمان • اربد • الزرقاء • العقبة • السلط • مادبا • الكرك • معان • جرش • عجلون • المفرق...
> 🌍 .مواقيت مصر القاهرة ↞ أي دولة وأي مدينة
> 🗺️ .دول ↞ قائمة الدول المتاحة

📅 *التاريخ والعمر:*
> 📅 .تاريخ ↞ تاريخ اليوم هجري وميلادي
> 🔄 .تاريخ 2026/11/2 ↞ تحويل ميلادي ← هجري
> 🔄 .تاريخ هجري 1448/5/22 ↞ تحويل هجري ← ميلادي
> 🎂 .عمري 2000/5/20 ↞ عمرك بالتفصيل وباقي لعيد ميلادك

🧮 *حسابات وأسعار:*
> 🧮 .حاسبة 25*4+10 ↞ حاسبة (جذر • ^ • % • أقواس)
> 💱 .عملة 100 دولار دينار ↞ تحويل العملات
> 🌤️ .طقس [دولة] [مدينة] ↞ حالة الطقس والحرارة

🛠️ *أدوات متنوعة:*
> ✨ .زخرفة <نص> ↞ زخرفة الأسماء بعدة أشكال
> 📱 .qr <نص أو رابط> ↞ إنشاء باركود QR
> 🔗 .اختصار <رابط> ↞ اختصار الروابط الطويلة
> 🔐 .باسورد [الطول] ↞ كلمة مرور قوية

👥 *للمجموعات:*
> 🎲 .قرعة ↞ اختيار عضو عشوائي (أو .قرعة أ | ب | ج)
> 📊 .تصويت السؤال | خيار1 | خيار2 ↞ استفتاء
> ⏰ .تذكير 30د <نص> ↞ تذكير بعد مدة (حتى 24 ساعة)

💡 للدول: اكتب الدولة ثم المدينة، ولعُمان اكتب \`سلطنة عمان\` (لأن «عمان» وحدها تعني عمّان الأردن).`;

// ---------------------------------------------------------------- تسجيل الأوامر
const norm = (s) => s.replace(/[أإآا]/g, 'ا');
const COMMANDS = {
    'الادوات': ['17', 'ادوات', 'tools'],
    'مواقيت': ['مواقيت_الصلاة', 'اوقات_الصلاة', 'صلاة', 'prayer', 'salah'],
    'دول': ['countries'],
    'حاسبة': ['calc'], 'تاريخ': ['date', 'هجري'], 'عملة': ['currency', 'عملات'], 'طقس': ['weather'], 'عمري': ['age'],
    'زخرفة': ['زخرفه', 'font'], 'qr': ['باركود'], 'اختصار': ['short'], 'باسورد': ['pass', 'password'],
    'قرعة': ['pick', 'قرعه'], 'تصويت': ['poll', 'استفتاء'], 'تذكير': ['remind', 'ذكرني']
};
const CANON = {};
for (const [name, aliases] of Object.entries(COMMANDS)) {
    CANON[norm(name)] = name;
    for (const a of aliases) CANON[norm(a.toLowerCase())] = name;
}
export const toolsCommandNames = Object.keys(CANON);

const LINK_COMMANDS = new Set(['qr', 'اختصار']);   // تقبل رابطاً: لا تحذفها حماية الروابط
export function isToolsLinkCommand(body) {
    const t = String(body || '').trim();
    if (!t.startsWith('.')) return false;
    const first = norm(t.slice(1).trim().split(/\s+/)[0].toLowerCase());
    const canon = CANON[first];
    return !!canon && LINK_COMMANDS.has(canon);
}

async function sendSection(c, text) {
    let pp;
    try { pp = await c.getUserProfilePic(c.sock, c.sender); } catch (e) {}
    if (await sendSectionWithButtons(c.sock, c.from, text, pp, c.sender)) return;
    try { await c.sock.sendMessage(c.from, { image: { url: pp }, caption: text, mentions: [c.sender] }); }
    catch (e) { await c.sock.sendMessage(c.from, { text, mentions: [c.sender] }); }
}

const HANDLERS = {
    'الادوات': (c) => sendSection(c, TOOLS_SECTION),
    'مواقيت': cmdPrayer, 'دول': cmdCountries, 'حاسبة': cmdCalc, 'تاريخ': cmdDate, 'عملة': cmdCurrency, 'طقس': cmdWeather, 'عمري': cmdAge,
    'زخرفة': cmdFont, 'qr': cmdQR, 'اختصار': cmdShorten, 'باسورد': cmdPassword, 'قرعة': cmdPick, 'تصويت': cmdPoll, 'تذكير': cmdRemind
};
const NET_CMDS = new Set(['مواقيت', 'عملة', 'طقس', 'اختصار', 'qr']);
const COOLDOWN = new Map();

export async function handleToolsCommand(ctx) {
    const name = CANON[ctx.cmdBase];
    if (!name) return false;
    const handler = HANDLERS[name];
    if (!handler) return false;
    const { sock, msg, from } = ctx;
    // «.هجري 1448/5/22» = تاريخ هجري
    let args = ctx.trimmedBody.replace(/^\.\S+\s*/, '').trim();
    if (name === 'تاريخ' && norm(ctx.cmdBase) === 'هجري') args = `هجري ${args}`;
    const c = {
        ...ctx, args,
        reply: (text, mentions) => sock.sendMessage(from, { text, ...(mentions ? { mentions } : {}) }, { quoted: msg }),
        media: (content) => sock.sendMessage(from, content, { quoted: msg })
    };
    if (NET_CMDS.has(name)) {
        const last = COOLDOWN.get(ctx.sender) || 0;
        if (Date.now() - last < 3000) { await c.reply('⏳ انتظر بضع ثوانٍ قبل الأمر التالي.'); return true; }
        COOLDOWN.set(ctx.sender, Date.now());
    }
    try {
        await handler(c);
    } catch (e) {
        if (!e?.friendly) console.error(`خطأ في أمر الأدوات ${name}:`, e?.message || e);
        try { await c.reply(e?.friendly || '❌ تعذر تنفيذ الأمر. تأكد من المدخلات وحاول مرة أخرى.'); } catch (e2) {}
    }
    return true;
}
