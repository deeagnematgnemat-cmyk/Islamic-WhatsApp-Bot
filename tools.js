// ============ tools.js : قسم الأدوات (17) ============
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';

const TMP = os.tmpdir();
const FFMPEG = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg');
const TZ = 'Asia/Amman';

// ---------------------------------------------------------------- الأوامر والاختصارات
export const TOOLS_COMMANDS = {
    'ادوات': ['الادوات'],
    'تحويل_عملة': [], 'حاسبة': [], 'ترجمة_نص': [], 'رابط_مختصر': [], 'باركود': ['qr'], 'طقس': [],
    'زخرفة': [], 'تشكيل': [], 'عد_كلمات': [], 'نص_لصوت': [],
    'تاريخ_هجري': [], 'اوقات_الصلاة': [], 'تذكير': [],
    'معلومات_القروب': []
};
// أوامر تقبل رابطاً بعدها: لا تحذفها حماية الروابط
export const TOOLS_LINK_COMMANDS = ['رابط_مختصر', 'باركود'];
// أوامر تعتمد على خدمات خارجية: يطبّق عليها فاصل الانتظار
export const TOOLS_HEAVY = ['ترجمة_نص', 'تحويل_عملة', 'رابط_مختصر', 'طقس', 'تشكيل', 'نص_لصوت', 'اوقات_الصلاة'];

export const TOOLS_SECTION = `🛠️ *قِـسْـمُ الأَدَوَاتِ:*

🧰 *أدوات عامة:*
> 💱 .تحويل_عملة <مبلغ> <من> <إلى> ↞ تحويل بين العملات
> 🧮 .حاسبة <عملية> ↞ عمليات حسابية سريعة
> 🌐 .ترجمة_نص [لغة] <نص> ↞ ترجمة نص
> 🔗 .رابط_مختصر <رابط> ↞ اختصار الروابط
> 🔳 .باركود <نص أو رابط> ↞ توليد رمز QR (أو .qr)
> ⛅ .طقس <مدينة> ↞ حالة الطقس

📝 *أدوات نصية:*
> ✨ .زخرفة <نص> ↞ زخرفة الأسماء والنصوص
> 🔤 .تشكيل <نص> ↞ إضافة التشكيل لنص عربي
> 🔢 .عد_كلمات <نص> ↞ عدّ الكلمات والأحرف
> 🔊 .نص_لصوت <نص> ↞ تحويل نص إلى مقطع صوتي

🕌 *أدوات إسلامية:*
> 📅 .تاريخ_هجري ↞ التاريخ الهجري اليوم أو تحويل تاريخ
> 🕋 .اوقات_الصلاة <مدينة> ↞ أوقات الصلاة
> ⏰ .تذكير <المدة> <النص> ↞ تذكير بعد مدة

👥 *أدوات المجموعات:*
> ℹ️ .معلومات_القروب ↞ معلومات المجموعة

💡 أمثلة: \`.تحويل_عملة 100 دولار جنيه\` • \`.حاسبة 25*4+10\` • \`.تذكير 30د ورد القرآن\`
📌 يمكنك الرد على رسالة بالأمر بدل كتابة النص.`;

// ---------------------------------------------------------------- مساعدات
const norm = (s) => String(s || '').replace(/[أإآا]/g, 'ا');
const AR_DIG = '٠١٢٣٤٥٦٧٨٩';
const FA_DIG = '۰۱۲۳۴۵۶۷۸۹';
const toLatinDigits = (s) => String(s || '')
    .replace(/[٠-٩]/g, (d) => String(AR_DIG.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIG.indexOf(d)));
const URL_RE = /https?:\/\/[^\s<>"'،]+/i;
const fmtNum = (n, max = 6) => {
    if (!Number.isFinite(n)) return String(n);
    const s = Number(n.toFixed(max)).toString();
    if (/e/i.test(s)) return s;
    const [i, d] = s.split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
};
const run = (file, args, timeout = 60000) => new Promise((resolve, reject) => {
    execFile(file, args, { timeout, maxBuffer: 64 * 1024 * 1024 }, (err) => (err ? reject(err) : resolve()));
});

// ---------------------------------------------------------------- الحاسبة
function safeCalc(raw) {
    let e = toLatinDigits(raw)
        .replace(/٫/g, '.').replace(/[×✖]/g, '*').replace(/[÷]/g, '/').replace(/٪/g, '%')
        .replace(/[–—−]/g, '-').replace(/\^/g, '**')
        .replace(/،/g, '').replace(/(?<=\d),(?=\d{3}\b)/g, '')
        .replace(/\s+/g, '');
    e = e.replace(/(\d+(?:\.\d+)?)%(?![\d(])/g, '($1/100)');
    if (!e || !/^[\d+\-*/%().]+$/.test(e)) return null;
    if (/\/[/*]|\*\/|\.\./.test(e)) return null;
    if (e.length > 200) return null;
    let v;
    try { v = Function('"use strict";return (' + e + ')')(); } catch (err) { return null; }
    return typeof v === 'number' ? v : null;
}

// ---------------------------------------------------------------- العملات
const CUR = {
    'دولار': 'USD', 'دولار_امريكي': 'USD', 'دولار_أمريكي': 'USD', 'يورو': 'EUR',
    'جنيه': 'EGP', 'جنيه_مصري': 'EGP', 'جنيه_استرليني': 'GBP', 'جنيه_إسترليني': 'GBP', 'استرليني': 'GBP', 'إسترليني': 'GBP',
    'ريال': 'SAR', 'ريال_سعودي': 'SAR', 'ريال_قطري': 'QAR', 'ريال_عماني': 'OMR', 'ريال_يمني': 'YER',
    'درهم': 'AED', 'درهم_اماراتي': 'AED', 'درهم_إماراتي': 'AED', 'درهم_مغربي': 'MAD',
    'دينار_كويتي': 'KWD', 'دينار_اردني': 'JOD', 'دينار_أردني': 'JOD', 'دينار_بحريني': 'BHD', 'دينار_عراقي': 'IQD',
    'دينار_ليبي': 'LYD', 'دينار_تونسي': 'TND', 'دينار_جزائري': 'DZD', 'دينار': 'JOD',
    'ليرة_تركية': 'TRY', 'ليرة_سورية': 'SYP', 'ليرة_لبنانية': 'LBP', 'ليرة': 'TRY',
    'ين': 'JPY', 'يوان': 'CNY', 'روبية': 'INR', 'فرنك_سويسري': 'CHF', 'فرنك': 'CHF',
    'دولار_كندي': 'CAD', 'دولار_استرالي': 'AUD', 'دولار_أسترالي': 'AUD', 'روبل': 'RUB', 'ذهب': 'XAU'
};
const CUR_NORM = {};
for (const [k, v] of Object.entries(CUR)) CUR_NORM[norm(k)] = v;
function resolveCur(tokens) {
    const joined = tokens.join('_');
    if (/^[A-Za-z]{3}$/.test(joined)) return joined.toUpperCase();
    let k = norm(joined);
    if (CUR_NORM[k]) return CUR_NORM[k];
    if (k.startsWith('ال') && CUR_NORM[k.slice(2)]) return CUR_NORM[k.slice(2)];
    return null;
}

// ---------------------------------------------------------------- الزخرفة
const mathMap = (up, low) => (ch) => {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(up + (c - 65));
    if (c >= 97 && c <= 122) return String.fromCodePoint(low + (c - 97));
    return ch;
};
const smallCaps = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
const LATIN_STYLES = [
    mathMap(0x1D4D0, 0x1D4EA),   // 𝓗𝓮𝓵𝓵𝓸
    mathMap(0x1D56C, 0x1D586),   // 𝕳𝖊𝖑𝖑𝖔
    mathMap(0x1D400, 0x1D41A),   // 𝐇𝐞𝐥𝐥𝐨
    mathMap(0x1D468, 0x1D482),   // 𝑯𝒆𝒍𝒍𝒐
    mathMap(0x1D5D4, 0x1D5EE),   // 𝗛𝗲𝗹𝗹𝗼
    mathMap(0x1D670, 0x1D68A),   // 𝙷𝚎𝚕𝚕𝚘
    mathMap(0xFF21, 0xFF41),     // Ｈｅｌｌｏ
    (ch) => { const c = ch.charCodeAt(0); if (c >= 65 && c <= 90) return String.fromCodePoint(0x24B6 + c - 65); if (c >= 97 && c <= 122) return String.fromCodePoint(0x24D0 + c - 97); return ch; },
    (ch) => { const c = ch.toLowerCase().charCodeAt(0); return (c >= 97 && c <= 122 && ch.length === 1) ? smallCaps[c - 97] : ch; }
];
const FWD = new Set('بتثجحخسشصضطظعغفقكلمنهيئ'.split(''));
const isArLetter = (ch) => !!ch && /[\u0621-\u064A]/.test(ch);
const tatweel = (text) => {
    const a = [...text];
    return a.map((ch, i) => (FWD.has(ch) && isArLetter(a[i + 1]) ? ch + 'ـ' : ch)).join('');
};
const AR_STYLES = [
    (t) => tatweel(t),
    (t) => `『 ${tatweel(t)} 』`,
    (t) => `✦ ${tatweel(t)} ✦`,
    (t) => `꧁ ${t} ꧂`,
    (t) => `❖ ${tatweel(t)} ❖`,
    (t) => `•°•.✿ ${t} ✿.•°•`
];

// ---------------------------------------------------------------- التاريخ الهجري (بدون إنترنت عبر Intl)
const H_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const G_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
function toHijri(date) {
    const p = {};
    for (const x of hijriFmt.formatToParts(date)) p[x.type] = x.value;
    return { d: Number(p.day), m: Number(p.month), y: parseInt(p.year, 10) };
}
const utcDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));
function hijriToGregorian(hy, hm, hd) {
    const days = (hy - 1) * 354.367 + (hm - 1) * 29.5306 + (hd - 1);
    const est = new Date(Date.UTC(622, 6, 16, 12) + days * 86400000);
    for (let i = -60; i <= 60; i++) {
        const t = new Date(est.getTime() + i * 86400000);
        const h = toHijri(t);
        if (h.y === hy && h.m === hm && h.d === hd) return t;
    }
    return null;
}
const hijriText = (h) => `${h.d} ${H_MONTHS[h.m - 1]} ${h.y} هـ`;
const gregText = (d) => `${d.getUTCDate()} ${G_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} م`;

// ---------------------------------------------------------------- التذكيرات (في الذاكرة)
const REMINDERS = new Map();   // id -> { timer, sender, at }
let reminderSeq = 0;
function parseDuration(tok) {
    const t = toLatinDigits(tok).toLowerCase();
    const m = /^(\d+(?:\.\d+)?)(ث|ثانية|ثواني|s|د|دقيقة|دقائق|دقيقه|m|min|س|ساعة|ساعه|ساعات|h|hr|ي|يوم|ايام|أيام|d)?$/.exec(t);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2] || 'د';
    let mult = 60000;
    if (/^(ث|ثانية|ثواني|s)$/.test(u)) mult = 1000;
    else if (/^(س|ساعة|ساعه|ساعات|h|hr)$/.test(u)) mult = 3600000;
    else if (/^(ي|يوم|ايام|أيام|d)$/.test(u)) mult = 86400000;
    return Math.round(n * mult);
}
const fmtMs = (ms) => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} ثانية`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} دقيقة`;
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return `${h} ساعة` + (mm ? ` و${mm} دقيقة` : '');
    const d = Math.floor(h / 24), hh = h % 24;
    return `${d} يوم` + (hh ? ` و${hh} ساعة` : '');
};

// ---------------------------------------------------------------- المعالجات
export function buildToolsHandlers({ quotedText, askAI, SYSTEM, clip, http, httpJson, httpBuffer, cmdTranslate, sendSection }) {
    const argOrQuoted = (c) => c.args || quotedText(c);

    // ---- تحويل_عملة
    async function cmdCurrency(c) {
        const usage = '📌 مثال: `.تحويل_عملة 100 دولار جنيه` أو `.تحويل_عملة 50 USD SAR`';
        const toks = toLatinDigits(c.args).replace(/[,،]/g, '').split(/\s+/).filter(Boolean);
        if (!toks.length) return c.reply(usage);
        let amount = 1;
        const nIdx = toks.findIndex((t) => /^\d+(\.\d+)?$/.test(t));
        if (nIdx >= 0) { amount = parseFloat(toks[nIdx]); toks.splice(nIdx, 1); }
        const rest = toks.filter((t) => !/^(الى|إلى|الي|to|in|في|->|=|الي)$/i.test(norm(t)) && !/^(الى|إلى|الي|to|in|في|->|=)$/i.test(t));
        let from = null, to = null;
        for (let i = 1; i < rest.length && !(from && to); i++) {
            const f = resolveCur(rest.slice(0, i)), t = resolveCur(rest.slice(i));
            if (f && t) { from = f; to = t; }
        }
        if (!from || !to) return c.reply('⚠️ لم أتعرف على العملتين.\n' + usage);
        if (from === to) return c.reply(`💱 ${fmtNum(amount)} ${from} = ${fmtNum(amount)} ${to}`);
        let j;
        try { j = await httpJson(`https://open.er-api.com/v6/latest/${from}`, { timeout: 20000 }); }
        catch (e) { return c.reply('❌ خدمة أسعار العملات لا تستجيب الآن. حاول لاحقاً.'); }
        const rate = j?.rates?.[to];
        if (j?.result !== 'success' || !rate) return c.reply('❌ تعذر جلب سعر هذه العملة.');
        await c.reply(`💱 *تحويل العملات:*\n\n> 💰 ${fmtNum(amount)} ${from} = *${fmtNum(amount * rate, 4)} ${to}*\n> 📊 السعر: 1 ${from} = ${fmtNum(rate, 6)} ${to}`);
    }

    // ---- حاسبة
    async function cmdCalc(c) {
        const expr = argOrQuoted(c);
        if (!expr) return c.reply('📌 مثال: `.حاسبة 25*4+10` أو `.حاسبة (100+50)/3` أو `.حاسبة 15%`');
        const v = safeCalc(expr);
        if (v === null || !Number.isFinite(v)) return c.reply('⚠️ العملية غير صحيحة. استخدم الأرقام و + - × ÷ ^ % والأقواس فقط.');
        await c.reply(`🧮 *الحاسبة:*\n\n> ${toLatinDigits(expr).trim()}\n> = *${fmtNum(v, 10)}*`);
    }

    // ---- ترجمة_نص (نفس ترجمة البوت الحالية باسم جديد)
    async function cmdTranslateText(c) {
        if (!c.args && !quotedText(c)) return c.reply('📌 مثال: `.ترجمة_نص انجليزي مرحبا بك` أو رد على رسالة بـ `.ترجمة_نص`');
        await cmdTranslate(c);
    }

    // ---- رابط_مختصر
    async function cmdShorten(c) {
        const m = URL_RE.exec(argOrQuoted(c) || '');
        if (!m) return c.reply('📌 مثال: `.رابط_مختصر https://example.com/صفحة/طويلة`');
        const url = m[0];
        const services = [
            `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
            `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
        ];
        for (const s of services) {
            try {
                const res = await http(s, { timeout: 20000 });
                const t = (await res.text()).trim();
                if (res.ok && /^https?:\/\//i.test(t)) return c.reply(`🔗 *الرابط المختصر:*\n\n${t}`);
            } catch (e) {}
        }
        await c.reply('❌ تعذر اختصار الرابط الآن. حاول لاحقاً.');
    }

    // ---- باركود / qr
    async function cmdQR(c) {
        const text = argOrQuoted(c);
        if (!text) return c.reply('📌 مثال: `.باركود https://example.com` أو `.باركود نص أي شيء`');
        if (text.length > 1000) return c.reply('⚠️ النص طويل (الحد 1000 حرف).');
        const QR = (await import('qrcode')).default;
        const buf = await QR.toBuffer(text, { width: 600, margin: 2 });
        await c.media({ image: buf, caption: '🔳 *رمز QR جاهز*' });
    }

    // ---- طقس
    async function cmdWeather(c) {
        const city = argOrQuoted(c).trim();
        if (!city) return c.reply('📌 مثال: `.طقس عمّان` أو `.طقس Cairo`');
        let j;
        try { j = await httpJson(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=ar`, { timeout: 25000 }); }
        catch (e) { return c.reply('❌ تعذر جلب الطقس الآن. تأكد من اسم المدينة وحاول لاحقاً.'); }
        const cur = j?.current_condition?.[0];
        if (!cur) return c.reply('❌ لم أجد هذه المدينة.');
        const area = j?.nearest_area?.[0];
        const place = [area?.areaName?.[0]?.value, area?.country?.[0]?.value].filter(Boolean).join('، ') || city;
        const desc = cur.lang_ar?.[0]?.value || cur.weatherDesc?.[0]?.value || '';
        const days = (j.weather || []).slice(0, 3).map((d, i) => `> ${['اليوم', 'غداً', 'بعد غد'][i]}: ${d.mintempC}° ← ${d.maxtempC}°`).join('\n');
        await c.reply(`⛅ *الطقس في ${place}:*\n\n> 🌡️ الحرارة: ${cur.temp_C}° (تحس بها ${cur.FeelsLikeC}°)\n> ☁️ الحالة: ${desc}\n> 💧 الرطوبة: ${cur.humidity}%\n> 💨 الرياح: ${cur.windspeedKmph} كم/س\n> 👁️ الرؤية: ${cur.visibility} كم\n\n📅 *الأيام القادمة:*\n${days}`);
    }

    // ---- زخرفة
    async function cmdDecorate(c) {
        const text = argOrQuoted(c).trim();
        if (!text) return c.reply('📌 مثال: `.زخرفة محمد` أو `.زخرفة Ahmed`');
        if (text.length > 50) return c.reply('⚠️ النص طويل (الحد 50 حرفاً).');
        const out = [];
        if (/[\u0621-\u064A]/.test(text)) for (const f of AR_STYLES) out.push(f(text));
        if (/[A-Za-z]/.test(text)) for (const f of LATIN_STYLES) out.push([...text].map(f).join(''));
        if (!out.length) return c.reply('⚠️ اكتب نصاً عربياً أو إنجليزياً للزخرفة.');
        await c.reply(`✨ *الزخرفة:*\n\n${out.map((x) => `> ${x}`).join('\n')}`);
    }

    // ---- تشكيل (عبر الذكاء الاصطناعي الموجود في البوت)
    async function cmdTashkeel(c) {
        const text = argOrQuoted(c).trim();
        if (!text) return c.reply('📌 مثال: `.تشكيل الحمد لله رب العالمين` أو رد على رسالة بـ `.تشكيل`');
        if (text.length > 1500) return c.reply('⚠️ النص طويل (الحد 1500 حرف).');
        const out = await askAI(c, 'أنت خبير في اللغة العربية. أضف التشكيل الكامل والصحيح (الفتحة والضمة والكسرة والسكون والشدة والتنوين) للنص العربي التالي دون تغيير أي حرف أو كلمة. أعد النص المشكول فقط بلا أي شرح أو مقدمة أو علامات تنسيق.', text);
        await c.reply(clip(`🔤 *النص بعد التشكيل:*\n\n${out}`));
    }

    // ---- عد_كلمات
    async function cmdWordCount(c) {
        const text = argOrQuoted(c);
        if (!text) return c.reply('📌 مثال: `.عد_كلمات نصك هنا` أو رد على رسالة بـ `.عد_كلمات`');
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const lines = text.split(/\r?\n/).length;
        const sentences = text.split(/[.!?؟۔\n]+/).filter((s) => s.trim()).length;
        await c.reply(`🔢 *إحصائيات النص:*\n\n> 📝 الكلمات: ${words}\n> 🔠 الأحرف (بالمسافات): ${[...text].length}\n> 🔡 الأحرف (بدون مسافات): ${[...text.replace(/\s/g, '')].length}\n> 📄 الأسطر: ${lines}\n> 💬 الجمل: ${sentences}`);
    }

    // ---- نص_لصوت
    const TTS_LANGS = { 'عربي': 'ar', 'انجليزي': 'en', 'إنجليزي': 'en', 'فرنسي': 'fr', 'تركي': 'tr', 'اسباني': 'es', 'إسباني': 'es', 'الماني': 'de', 'ألماني': 'de' };
    async function cmdTTS(c) {
        let text = argOrQuoted(c).trim();
        let lang = null;
        const first = text.split(/\s+/)[0];
        const key = Object.keys(TTS_LANGS).find((k) => norm(k) === norm(first));
        if (key && c.args) { lang = TTS_LANGS[key]; text = text.split(/\s+/).slice(1).join(' ').trim(); }
        if (!text) return c.reply('📌 مثال: `.نص_لصوت السلام عليكم ورحمة الله` أو `.نص_لصوت انجليزي Hello`');
        if (text.length > 600) return c.reply('⚠️ النص طويل (الحد 600 حرف).');
        if (!lang) lang = /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
        const chunks = [];
        let cur = '';
        for (const part of text.split(/(?<=[.!?؟،,\n])\s*/)) {
            if ((cur + ' ' + part).trim().length > 180) { if (cur) chunks.push(cur.trim()); cur = part; } else cur = (cur + ' ' + part).trim();
            while (cur.length > 180) { chunks.push(cur.slice(0, 180)); cur = cur.slice(180); }
        }
        if (cur.trim()) chunks.push(cur.trim());
        const bufs = [];
        try {
            for (const ch of chunks) {
                const r = await httpBuffer(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(ch)}`, 5 * 1024 * 1024, { timeout: 25000 });
                bufs.push(r.buf);
            }
        } catch (e) { return c.reply('❌ تعذر تحويل النص إلى صوت الآن. حاول لاحقاً.'); }
        const mp3 = Buffer.concat(bufs);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const inF = path.join(TMP, `tts_${id}.mp3`), outF = path.join(TMP, `tts_${id}.ogg`);
        try {
            fs.writeFileSync(inF, mp3);
            await run(FFMPEG, ['-y', '-i', inF, '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', outF], 60000);
            await c.media({ audio: fs.readFileSync(outF), mimetype: 'audio/ogg; codecs=opus', ptt: true });
        } catch (e) {
            await c.media({ audio: mp3, mimetype: 'audio/mpeg', ptt: false });
        } finally {
            for (const f of [inF, outF]) { try { fs.rmSync(f, { force: true }); } catch (e) {} }
        }
    }

    // ---- تاريخ_هجري
    async function cmdHijri(c) {
        const args = toLatinDigits(c.args).trim();
        if (!args) {
            const now = new Date();
            const local = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
            const day = utcDate(local.getFullYear(), local.getMonth() + 1, local.getDate());
            const h = toHijri(day);
            return c.reply(`📅 *التاريخ اليوم:*\n\n> 🌙 هجري: ${DAYS[day.getUTCDay()]} ${hijriText(h)}\n> 🗓️ ميلادي: ${gregText(day)}`);
        }
        const isH = /^(هجري|هجرى|h|hijri)\s+/i.test(args);
        const m = /(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/.exec(args);
        if (!m) return c.reply('📌 أمثلة:\n> `.تاريخ_هجري` ↞ تاريخ اليوم\n> `.تاريخ_هجري 25/12/2026` ↞ من ميلادي إلى هجري (يوم/شهر/سنة)\n> `.تاريخ_هجري هجري 1/9/1448` ↞ من هجري إلى ميلادي');
        let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
        if (a > 31) { y = a; a = Number(m[3]); }   // سنة/شهر/يوم
        if (b < 1 || b > 12 || a < 1 || a > 31) return c.reply('⚠️ تاريخ غير صحيح. الصيغة: يوم/شهر/سنة');
        if (isH || y < 1700) {
            const g = hijriToGregorian(y, b, a);
            if (!g) return c.reply('⚠️ تعذر تحويل هذا التاريخ الهجري.');
            return c.reply(`📅 *تحويل التاريخ:*\n\n> 🌙 هجري: ${hijriText({ d: a, m: b, y })}\n> 🗓️ ميلادي: ${DAYS[g.getUTCDay()]} ${gregText(g)}`);
        }
        const g = utcDate(y, b, a);
        if (g.getUTCMonth() !== b - 1) return c.reply('⚠️ تاريخ غير صحيح.');
        const h = toHijri(g);
        await c.reply(`📅 *تحويل التاريخ:*\n\n> 🗓️ ميلادي: ${DAYS[g.getUTCDay()]} ${gregText(g)}\n> 🌙 هجري: ${hijriText(h)}`);
    }

    // ---- اوقات_الصلاة
    async function cmdPrayer(c) {
        const city = argOrQuoted(c).trim();
        if (!city) return c.reply('📌 مثال: `.اوقات_الصلاة عمّان` أو `.اوقات_الصلاة القاهرة`');
        let j;
        try { j = await httpJson(`https://api.aladhan.com/v1/timingsByAddress?address=${encodeURIComponent(city)}`, { timeout: 25000 }); }
        catch (e) { return c.reply('❌ تعذر جلب أوقات الصلاة الآن. تأكد من اسم المدينة وحاول لاحقاً.'); }
        const t = j?.data?.timings;
        if (!t) return c.reply('❌ لم أجد هذه المدينة.');
        const to12 = (s) => {
            const [h, m] = String(s).split(' ')[0].split(':').map(Number);
            const ap = h >= 12 ? 'م' : 'ص';
            return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
        };
        const hj = j?.data?.date?.hijri;
        const head = hj ? `\n> 🌙 ${hj.day} ${hj.month?.ar || ''} ${hj.year} هـ` : '';
        await c.reply(`🕋 *أوقات الصلاة في ${city}:*${head}\n\n> 🌌 الفجر: ${to12(t.Fajr)}\n> 🌅 الشروق: ${to12(t.Sunrise)}\n> ☀️ الظهر: ${to12(t.Dhuhr)}\n> 🌤️ العصر: ${to12(t.Asr)}\n> 🌇 المغرب: ${to12(t.Maghrib)}\n> 🌙 العشاء: ${to12(t.Isha)}`);
    }

    // ---- تذكير
    async function cmdReminder(c) {
        const usage = '📌 أمثلة:\n> `.تذكير 30د ورد القرآن`\n> `.تذكير 2س صلاة العصر`\n> `.تذكير 1ي صيام الاثنين`\n\nالوحدات: ث (ثواني) • د (دقائق) • س (ساعات) • ي (أيام) — الحد الأقصى 7 أيام.';
        const parts = c.args.split(/\s+/).filter(Boolean);
        if (!parts.length) return c.reply(usage);
        if (/^(الغاء|إلغاء|الغي|ألغي)$/.test(parts[0])) {
            let n = 0;
            for (const [id, r] of REMINDERS) if (r.sender === c.sender) { clearTimeout(r.timer); REMINDERS.delete(id); n++; }
            return c.reply(n ? `🗑️ تم إلغاء ${n} تذكير.` : 'ℹ️ ليس لديك تذكيرات نشطة.');
        }
        let ms = parseDuration(parts[0]);
        let rest = parts.slice(1);
        if (ms === null && parts[1]) {   // مثال: «30 دقيقة نص»
            const two = parseDuration(parts[0] + parts[1]);
            if (two !== null) { ms = two; rest = parts.slice(2); }
        }
        if (ms === null || ms <= 0) return c.reply('⚠️ مدة غير صحيحة.\n\n' + usage);
        if (ms > 7 * 86400000) return c.reply('⚠️ الحد الأقصى للتذكير 7 أيام.');
        const note = rest.join(' ').trim() || quotedText(c) || 'حان موعد التذكير';
        const mine = [...REMINDERS.values()].filter((r) => r.sender === c.sender).length;
        if (mine >= 5) return c.reply('⚠️ لديك 5 تذكيرات نشطة. انتظر انتهاء أحدها أو اكتب `.تذكير الغاء`.');
        const id = ++reminderSeq;
        const { sock, from, sender, msg } = c;
        const timer = setTimeout(async () => {
            REMINDERS.delete(id);
            try { await sock.sendMessage(from, { text: `⏰ *تذكير:*\n\n@${sender.split('@')[0]}\n${note}`, mentions: [sender] }, { quoted: msg }); }
            catch (e) { try { await sock.sendMessage(from, { text: `⏰ *تذكير:*\n\n${note}` }); } catch (e2) {} }
        }, ms);
        timer.unref?.();
        REMINDERS.set(id, { timer, sender, at: Date.now() + ms });
        await c.reply(`✅ تم ضبط التذكير بعد ${fmtMs(ms)}.\n> 📝 ${note}\n\n⚠️ التذكيرات تُلغى إذا أُعيد تشغيل البوت.`);
    }

    // ---- معلومات_القروب
    async function cmdGroupInfo(c) {
        if (!c.from.endsWith('@g.us')) return c.reply('⚠️ هذا الأمر يعمل داخل المجموعات فقط.');
        const md = await c.sock.groupMetadata(c.from);
        const ps = md.participants || [];
        const admins = ps.filter((p) => p.admin).length;
        const created = md.creation ? new Date(md.creation * 1000) : null;
        const cd = created ? new Date(created.toLocaleString('en-US', { timeZone: TZ })) : null;
        const cdText = cd ? gregText(utcDate(cd.getFullYear(), cd.getMonth() + 1, cd.getDate())) : 'غير معروف';
        const owner = md.owner || md.ownerPn || '';
        const ownerLine = owner ? `\n> 👑 المنشئ: @${owner.split('@')[0].split(':')[0]}` : '';
        await c.reply(`ℹ️ *معلومات المجموعة:*\n\n> 🏷️ الاسم: ${md.subject}\n> 👥 الأعضاء: ${ps.length}\n> 🛡️ المشرفون: ${admins}\n> 📅 تاريخ الإنشاء: ${cdText}${ownerLine}\n> 📝 الوصف: ${md.desc ? String(md.desc).slice(0, 500) : 'لا يوجد'}`, owner ? [owner] : undefined);
    }

    return {
        'ادوات': (c) => sendSection(c, TOOLS_SECTION),
        'تحويل_عملة': cmdCurrency, 'حاسبة': cmdCalc, 'ترجمة_نص': cmdTranslateText, 'رابط_مختصر': cmdShorten, 'باركود': cmdQR, 'طقس': cmdWeather,
        'زخرفة': cmdDecorate, 'تشكيل': cmdTashkeel, 'عد_كلمات': cmdWordCount, 'نص_لصوت': cmdTTS,
        'تاريخ_هجري': cmdHijri, 'اوقات_الصلاة': cmdPrayer, 'تذكير': cmdReminder,
        'معلومات_القروب': cmdGroupInfo
    };
}
