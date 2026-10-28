// ============ features.js : الملصقات + التنزيل + الذكاء الاصطناعي ============
import fs from 'fs';
import os from 'os';
import path from 'path';
import pino from 'pino';
import { execFile, spawn } from 'child_process';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import * as BaileysNs from '@whiskeysockets/baileys';
import { sendSectionWithButtons, sendPackCard } from './menu.js';

const PACK = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
const AUTHOR = 'Eren Bot';
const TMP = os.tmpdir();
const FFMPEG = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg');
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const MAX_DL = Infinity;                 // التنزيل غير محدود الحجم
const MAX_AS_MEDIA = 60 * 1024 * 1024;  // أكبر من هذا يُرسل كمستند

// إعدادات الذكاء الاصطناعي (اختيارية): متغيرات البيئة في Railway
//   AI_API_KEY  مفتاح خدمة متوافقة مع OpenAI (OpenAI / Groq / OpenRouter / Gemini ...)
//   AI_API_URL  الرابط الأساسي (الافتراضي https://api.openai.com/v1)
//   AI_MODEL    اسم النموذج (الافتراضي gpt-4o-mini)
// بدون مفتاح يستخدم خدمة مجانية بدون مفتاح (pollinations) وقد تكون أبطأ وأقل ثباتاً.

const norm = (s) => s.replace(/[أإآا]/g, 'ا');

// ---------------------------------------------------------------- تحويل اسم الشخصية من العربية إلى الإنجليزية (للبحث)
// المنصات (تيك توك / ستيكرلي) تبحث بالإنجليزية أفضل بكثير، لذلك نحوّل الاسم أولاً
const arNorm = (s) => String(s || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
const AR_EN_RAW = {
    'ايرين': 'eren yeager', 'اورين': 'eren yeager', 'ايرن': 'eren yeager', 'ايرين يغر': 'eren yeager', 'ايرين ييغر': 'eren yeager', 'ايرين يجر': 'eren yeager', 'ايرين ييجر': 'eren yeager', 'ايرين يايغر': 'eren yeager', 'ايرين ييغير': 'eren yeager', 'ايرين جيجر': 'eren yeager',
    'ميكاسا': 'mikasa ackerman', 'ارمين': 'armin arlert', 'ليفاي': 'levi ackerman', 'ليفي': 'levi ackerman', 'زيك': 'zeke yeager', 'راينر': 'reiner braun', 'ريانر': 'reiner braun',
    'هانجي': 'hange zoe', 'ارفين': 'erwin smith', 'ايروين': 'erwin smith', 'ايرفين': 'erwin smith', 'اني': 'annie leonhart', 'جان': 'jean kirstein', 'غابي': 'gabi braun',
    'غوجو': 'gojo satoru', 'جوجو': 'gojo satoru', 'قوجو': 'gojo satoru', 'غوجو ساتورو': 'gojo satoru', 'جوجو ساتورو': 'gojo satoru', 'ساتورو': 'gojo satoru', 'ساتورو غوجو': 'gojo satoru',
    'سوكونا': 'sukuna', 'ايتادوري': 'itadori yuji', 'يوجي': 'itadori yuji', 'ميغومي': 'megumi fushiguro', 'ميجومي': 'megumi fushiguro', 'نوبارا': 'nobara kugisaki', 'توجي': 'toji fushiguro', 'نانامي': 'nanami kento', 'جيتو': 'geto suguru',
    'ناروتو': 'naruto uzumaki', 'ساسكي': 'sasuke uchiha', 'ساسوكي': 'sasuke uchiha', 'ايتاشي': 'itachi uchiha', 'ايتاتشي': 'itachi uchiha', 'كاكاشي': 'kakashi hatake', 'مادارا': 'madara uchiha', 'اوبيتو': 'obito uchiha', 'ميناتو': 'minato namikaze',
    'جيرايا': 'jiraiya', 'نيجي': 'neji hyuga', 'هيناتا': 'hinata hyuga', 'ساكورا': 'sakura haruno', 'غارا': 'gaara', 'جارا': 'gaara', 'شيكامارو': 'shikamaru nara', 'روك لي': 'rock lee', 'بين': 'pain akatsuki', 'ناجاتو': 'nagato',
    'لوفي': 'luffy', 'زورو': 'zoro', 'سانجي': 'sanji', 'ايس': 'portgas d ace', 'سابو': 'sabo', 'شانكس': 'shanks', 'ترافالغار لو': 'trafalgar law', 'لو': 'trafalgar law', 'دوفلامنغو': 'doflamingo', 'ميهوك': 'mihawk',
    'غوكو': 'goku', 'جوكو': 'goku', 'فيجيتا': 'vegeta', 'غوهان': 'gohan', 'فريزا': 'frieza', 'تورانكس': 'trunks', 'بيكولو': 'piccolo',
    'تانجيرو': 'tanjiro kamado', 'نيزوكو': 'nezuko kamado', 'زينيتسو': 'zenitsu', 'اينوسكي': 'inosuke', 'رينغوكو': 'rengoku kyojuro', 'شينوبو': 'shinobu kocho', 'جيو': 'giyu tomioka', 'موزان': 'muzan kibutsuji', 'اكازا': 'akaza',
    'ديكو': 'deku midoriya', 'باكوغو': 'bakugo katsuki', 'تودوروكي': 'todoroki shoto', 'اول مايت': 'all might',
    'لايت': 'light yagami', 'ال': 'l lawliet', 'ريوك': 'ryuk',
    'سونغ جين وو': 'sung jinwoo', 'سونج جين وو': 'sung jinwoo', 'جين وو': 'sung jinwoo', 'سونغ جينوو': 'sung jinwoo', 'جينوو': 'sung jinwoo',
    'غون': 'gon freecss', 'كيلوا': 'killua zoldyck', 'هيسوكا': 'hisoka', 'دازاي': 'dazai osamu', 'تشويا': 'chuuya nakahara', 'ماكيما': 'makima', 'دينجي': 'denji', 'باور': 'power chainsaw man',
    'ريم': 'rem rezero', 'سوبارو': 'subaru natsuki', 'سايتاما': 'saitama', 'جينوس': 'genos', 'ثورفين': 'thorfinn', 'شينجي': 'shinji ikari', 'ايدن': 'eden',
    'جوكر': 'joker', 'باتمان': 'batman', 'سبايدرمان': 'spiderman', 'سبايدر مان': 'spiderman', 'ايرون مان': 'iron man', 'ثانوس': 'thanos', 'توماس شيلبي': 'thomas shelby', 'شيلبي': 'thomas shelby',
    'رونالدو': 'cristiano ronaldo', 'ميسي': 'messi', 'نيمار': 'neymar', 'مبابي': 'mbappe'
};
const AR_EN = new Map(Object.entries(AR_EN_RAW).map(([k, v]) => [arNorm(k), v]));
const EN_CACHE = new Map();
const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);

async function translateToEnglish(text) {
    try {
        const j = await httpJson('https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=' + encodeURIComponent(text), { timeout: 15000 });
        const t = (j?.[0] || []).map((x) => x?.[0] || '').join('').trim();
        if (t && !hasArabic(t)) return t;
    } catch (e) { /* التالي */ }
    try {
        const j = await httpJson('https://api.mymemory.translated.net/get?langpair=ar%7Cen&q=' + encodeURIComponent(text), { timeout: 15000 });
        const t = String(j?.responseData?.translatedText || '').trim();
        if (t && !hasArabic(t) && !/MYMEMORY|INVALID/i.test(t)) return t;
    } catch (e) { /* لا شيء */ }
    return null;
}

async function toEnglishName(name) {
    const raw = String(name || '').trim();
    if (!raw || !hasArabic(raw)) return raw;
    const key = arNorm(raw);
    if (EN_CACHE.has(key)) return EN_CACHE.get(key);
    let out = null;
    if (AR_EN.has(key)) out = AR_EN.get(key);
    else {
        // مطابقة أطول تتابع كلمات في القاموس، والكلمات المجهولة تُترجم
        const words = key.split(' ');
        const parts = [];
        for (let i = 0; i < words.length;) {
            let hit = null, len = 0;
            for (let n = Math.min(3, words.length - i); n >= 1; n--) {
                const k = words.slice(i, i + n).join(' ');
                if (AR_EN.has(k)) { hit = AR_EN.get(k); len = n; break; }
            }
            if (hit) { parts.push(hit); i += len; continue; }
            const tr = await translateToEnglish(words[i]);
            parts.push(tr || words[i]);
            i++;
        }
        out = [...new Set(parts.join(' ').split(' '))].join(' ').trim();
    }
    if (!out || hasArabic(out)) out = (await translateToEnglish(raw)) || out || raw;
    if (out && !hasArabic(out)) EN_CACHE.set(key, out);
    return out;
}
const nameTokens = (...names) => [...new Set(names.join(' ').toLowerCase().split(/[\s,]+/).filter((x) => x.length >= 3))];

// ---------------------------------------------------------------- الأوامر والاختصارات
const COMMANDS = {
    // الملصقات
    'ملصق': ['s', 'ستكر'], 'متحرك': ['sg', 'حركي'], 'دائري': ['round'], 'طويل': ['full'],
    'سرقة': ['steal'], 'لصورة': ['toimage', 'img'], 'لرابط': ['tourl', 'url'], 'ايموجي': ['emoji'],
    'كتابة': ['ttp'], 'إطار': ['frame'], 'حزمة': ['pack'], 'قص': ['crop'], 'عكس': ['flip'],
    'لفيديو': ['tovideo'], 'تدوير': ['rotate'], 'رمادي': ['gray'], 'ملصقات': [],
    // التنزيل
    'تيك': ['tt', 'tiktok'], 'انستا': ['ig', 'insta'], 'فيس': ['fb'], 'يوتيوب': ['yt'], 'صوت': ['mp3'],
    'فيديو': ['vid'], 'صورة': ['pic'], 'بنترست': ['pin'], 'تويتر': ['tw', 'x'], 'سناب': ['snap'],
    'ثريدز': ['threads'], 'تلي': ['tg'], 'بحث': ['search'], 'ميديا': ['media', 'dl'], 'رابط': ['link'], 'تحميل': [],
    'ايدت': ['edit'], 'فويس': ['voice'],
    // الذكاء الاصطناعي
    'اسأل': ['ai'], 'تخيل': ['imagine'], 'تلخيص': ['sum'], 'ترجمة': ['tr'],
    'صحح': ['fix'], 'شرح': ['explain'], 'اكتب': ['write'], 'كود': ['code'], 'نسيان': ['reset'], 'ذكاء': []
};
const CANON = {};   // الاسم (أو الاختصار) المُطبَّع -> الاسم الأساسي
for (const [name, aliases] of Object.entries(COMMANDS)) {
    CANON[norm(name)] = name;
    for (const a of aliases) CANON[norm(a)] = name;
}
CANON['11'] = 'ملصقات'; CANON['13'] = 'تحميل'; CANON['14'] = 'ذكاء';
export const featureCommandNames = Object.keys(CANON);

// أوامر تقبل رابطاً بعدها: لا تحذفها حماية الروابط (وإلا لا يستطيع الأعضاء استخدام التنزيل)
const LINK_COMMANDS = new Set(['تيك', 'انستا', 'فيس', 'يوتيوب', 'صوت', 'فيديو', 'صورة', 'بنترست', 'تويتر', 'سناب', 'ثريدز', 'تلي', 'ميديا', 'رابط', 'تحميل', 'تلخيص', 'فويس']);
export function isFeatureLinkCommand(body) {
    const t = String(body || '').trim();
    if (!t.startsWith('.')) return false;
    const first = norm(t.slice(1).trim().split(/\s+/)[0].toLowerCase());
    const canon = CANON[first];
    return !!canon && LINK_COMMANDS.has(canon);
}

// ---------------------------------------------------------------- نصوص الأقسام
export const STICKER_SECTION = `🏷️ *قِـسْـمُ الـمَـلْـصَـقَـاتِ:*

> 🖼️ .ملصق | .s ↞ صورة/فيديو إلى ملصق
> 🎞️ .متحرك | .sg ↞ فيديو/GIF إلى ملصق متحرك
> ⭕ .دائري ↞ ملصق دائري
> 📏 .طويل ↞ ملصق من صورة طويلة بلا تشويه
> 🥷 .سرقة [اسم] ↞ إعادة نشر ملصق باسمك
> 🖼️ .لصورة ↞ ملصق إلى صورة PNG
> 🔗 .لرابط ↞ رابط مباشر للوسائط
> 😀 .ايموجي 😎 ↞ إيموجي إلى ملصق
> ✍️ .كتابة <نص> ↞ ملصق نصي
> 🧿 .إطار [لون] ↞ إطار حول الصورة
> 📦 .حزمة <اسم> ↞ البحث عن حزمة ملصقات
> ✂️ .قص [16:9] ↞ قص الصورة
> 🔁 .عكس ↞ قلب أفقي
> 🎥 .لفيديو ↞ ملصق متحرك إلى فيديو
> 🔄 .تدوير ↞ تدوير 90 درجة
> ⚫ .رمادي ↞ أبيض وأسود
> 📋 .ملصقات ↞ هذه القائمة

💡 أرسل الأمر مع الصورة أو رد على صورة/فيديو/ملصق.`;

export const DOWNLOAD_SECTION = `📥 *قِـسْـمُ الـتَّـنْـزِيـلِ مِـنَ الـرَّابِـطِ:*

> 🎵 .تيك | .tt ↞ فيديو تيك توك بدون علامة
> 📸 .انستا | .ig ↞ صور وفيديوهات إنستغرام
> 📘 .فيس | .fb ↞ فيديو فيسبوك
> ▶️ .يوتيوب | .yt ↞ فيديو يوتيوب (+ صوت)
> 🎧 .صوت | .mp3 ↞ استخراج الصوت من رابط
> 🎬 .فيديو ↞ فيديو من رابط، أو رد على ملصق متحرك
> 🖼️ .صورة ↞ صورة من رابط
> 📌 .بنترست | .pin ↞ بنترست
> 🐦 .تويتر | .x ↞ منشورات X
> 👻 .سناب ↞ سناب شات
> 🧵 .ثريدز ↞ ثريدز
> ✈️ .تلي ↞ منشورات تيليجرام العامة
> 🔎 .بحث <كلمات> ↞ بحث عن مقاطع
> 🎞️ .ايدت <اسم الشخصية> ↞ 3 ايديتات من تيك توك
> 🎙️ .فويس <اسم الاغنية أو الصوت> ↞ فويس حسب الطلب
> 🧲 .ميديا | .dl ↞ تنزيل تلقائي من أي رابط
> 🔗 .رابط ↞ فحص الرابط ومعرفة منصته

💡 اكتب الأمر ثم الرابط، أو رد على رسالة فيها رابط.
⚠️ المحتوى العام فقط، والحد الأقصى 100MB.`;

export const AI_SECTION = `🤖 *قِـسْـمُ الـذَّكَـاءِ الاصْـطِـنَـاعِـيِّ:*

> 💬 .اسأل <سؤال> ↞ إجابة ذكية (يتذكر محادثتك)
> 🎨 .تخيل <وصف> ↞ توليد صورة بالذكاء الاصطناعي
> 📝 .تلخيص <نص أو رابط> ↞ تلخيص سريع
> 🌐 .ترجمة [لغة] <نص> ↞ ترجمة فورية
> ✅ .صحح <نص> ↞ تصحيح الإملاء والنحو
> 💡 .شرح <موضوع> ↞ شرح مبسّط
> ✍️ .اكتب <طلب> ↞ كتابة منشور/رسالة/قصيدة
> 💻 .كود <طلب> ↞ مساعدة في البرمجة
> 🧹 .نسيان ↞ مسح ذاكرة محادثتك

💡 يمكنك الرد على رسالة بالأمر بدل كتابة النص.
🌐 اللغات: عربي، انجليزي، فرنسي، تركي، اسباني، الماني، روسي، ياباني، كوري...`;

// ---------------------------------------------------------------- أدوات عامة
const run = (file, args, timeout = 60000) => new Promise((resolve, reject) => {
    execFile(file, args, { timeout, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) { err.stderr = String(stderr || ''); return reject(err); }
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
});
const rm = (...files) => { for (const f of files) { try { fs.rmSync(f, { force: true }); } catch (e) {} } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const URL_RE = /https?:\/\/[^\s<>"'،]+/i;
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };

async function http(url, opts = {}) {
    const tmo = opts.timeout || 30000;
    const attempts = tmo <= 30000 ? 3 : 1;   // طلبات البحث/API القصيرة تُعاد تلقائياً، أما التنزيلات الكبيرة فمرة واحدة
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(url, {
                redirect: 'follow',
                signal: AbortSignal.timeout(tmo),
                ...opts,
                // من المحاولة الثانية: اتصال جديد (يتجاوز اتصالاً قديماً ميتاً كان يسبب فشل الطلب الثاني)
                headers: { 'User-Agent': UA, ...(opts.headers || {}), ...(i ? { Connection: 'close' } : {}) }
            });
            if (i < attempts - 1 && (res.status === 429 || (res.status >= 502 && res.status <= 504))) {
                await new Promise((r) => setTimeout(r, 900 * (i + 1)));
                continue;
            }
            return res;
        } catch (e) {
            lastErr = e;
            if (e?.name === 'TimeoutError' || i === attempts - 1) break;
            await new Promise((r) => setTimeout(r, 700 * (i + 1)));
        }
    }
    throw lastErr;
}
async function httpJson(url, opts) {
    const res = await http(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
}
async function httpBuffer(url, max = MAX_DL, opts = {}) {
    const res = await http(url, { timeout: 60 * 60 * 1000, ...opts });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const len = Number(res.headers.get('content-length') || 0);
    if (len && len > max) throw new Error('TOO_BIG');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > max) throw new Error('TOO_BIG');
    return { buf, type: (res.headers.get('content-type') || '').split(';')[0].trim() };
}
function metaTags(html) {
    const out = {};
    const re = /<meta\s+[^>]*>/gi;
    let m;
    while ((m = re.exec(html))) {
        const tag = m[0];
        const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag);
        const val = /content\s*=\s*["']([^"']*)["']/i.exec(tag);
        if (key && val && !(key[1] in out)) out[key[1].toLowerCase()] = val[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    }
    return out;
}

// ---------------------------------------------------------------- وسائط الرسائل
function unwrap(m) {
    while (m && (m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.documentWithCaptionMessage)) {
        m = (m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.documentWithCaptionMessage).message;
    }
    return m;
}
function getTarget(c, kinds) {
    const own = unwrap(c.msg.message);
    const quoted = unwrap(own?.extendedTextMessage?.contextInfo?.quotedMessage);
    for (const m of [own, quoted]) {
        if (!m) continue;
        for (const k of kinds) {
            if (!m[k]) continue;
            if (k === 'documentMessage' && !/^(image|video)\//.test(m[k].mimetype || '')) continue;
            return { kind: k, node: m[k], container: m };
        }
    }
    return null;
}
const download = (c, t) => downloadMediaMessage(
    { key: c.msg.key, message: t.container }, 'buffer', {},
    { logger: pino({ level: 'silent' }), reuploadRequest: c.sock.updateMediaMessage }
);
const quotedText = (c) => {
    const q = unwrap(unwrap(c.msg.message)?.extendedTextMessage?.contextInfo?.quotedMessage);
    return q?.conversation || q?.extendedTextMessage?.text || q?.imageMessage?.caption || q?.videoMessage?.caption || '';
};
const IMG_KINDS = ['imageMessage', 'stickerMessage', 'documentMessage'];
const ANY_KINDS = ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage'];
const NEED_IMG = '📌 أرسل صورة مع الأمر أو رد على صورة/ملصق به.';
const NEED_ANY = '📌 أرسل صورة أو فيديو مع الأمر، أو رد على صورة/فيديو/ملصق به.';

// ---------------------------------------------------------------- الملصقات
async function makeSticker(buffer, type, extra = {}) {
    const st = new Sticker(buffer, { pack: PACK, author: AUTHOR, type, quality: 60, ...extra });
    return await st.toBuffer();
}

async function getSharp() {
    try { return (await import('sharp')).default; } catch (e) { return null; }
}

async function ffImage(buf, filter) {
    const id = uid();
    const inp = path.join(TMP, `in_${id}.bin`), out = path.join(TMP, `out_${id}.png`);
    fs.writeFileSync(inp, buf);
    try {
        await run(FFMPEG, ['-y', '-v', 'error', '-i', inp, '-frames:v', '1', '-vf', filter, out], 60000);
        return fs.readFileSync(out);
    } finally { rm(inp, out); }
}

async function cmdSticker(c, kind) {
    const t = getTarget(c, ANY_KINDS);
    if (!t) return c.reply(NEED_ANY);
    const animatedOnly = kind === 'متحرك';
    const isVideo = t.kind === 'videoMessage' || (t.kind === 'documentMessage' && /^video\//.test(t.node.mimetype || ''));
    const isAnimSticker = t.kind === 'stickerMessage' && t.node.isAnimated;
    if (animatedOnly && !isVideo && !isAnimSticker) return c.reply('📌 أرسل فيديو قصير أو GIF مع الأمر، أو رد عليه.');
    if (isVideo && (t.node.seconds || 0) > 10) return c.reply('⚠️ الفيديو أطول من 10 ثوانٍ. اقصّه ثم أعد المحاولة.');
    const buf = await download(c, t);
    const type = kind === 'دائري' ? StickerTypes.CIRCLE : kind === 'طويل' ? StickerTypes.FULL : StickerTypes.DEFAULT;
    await c.media({ sticker: await makeSticker(buf, type) });
}

async function cmdSteal(c) {
    const t = getTarget(c, ['stickerMessage']);
    if (!t) return c.reply('📌 رد على ملصق بالأمر `.سرقة` أو `.سرقة اسم_الحزمة`');
    const buf = await download(c, t);
    const rights = c.args || c.msg.pushName || String(c.sender || '').split('@')[0].split(':')[0];
    await c.media({ sticker: await makeSticker(buf, StickerTypes.DEFAULT, { pack: rights, author: rights, quality: 80 }) });
}

async function cmdToImage(c) {
    const t = getTarget(c, ['stickerMessage']);
    if (!t) return c.reply('📌 رد على ملصق بالأمر `.لصورة`');
    const buf = await download(c, t);
    const sharp = await getSharp();
    let png;
    if (sharp) png = await sharp(buf).png().toBuffer();
    else png = await ffImage(buf, 'null');
    await c.media({ image: png, caption: t.node.isAnimated ? '🖼️ تم أخذ أول إطار من الملصق المتحرك.' : '🖼️ تم التحويل إلى صورة.' });
}

async function stickerToVideo(c, t) {
    const buf = await download(c, t);
    const sharp = await getSharp();
    if (!sharp) return c.reply('❌ هذه الميزة تحتاج مكتبة sharp. أضفها في package.json ثم أعد النشر.');
    const animated = !!t.node.isAnimated;
    const id = uid();
    const inp = path.join(TMP, `g_${id}.${animated ? 'gif' : 'png'}`), out = path.join(TMP, `v_${id}.mp4`);
    fs.writeFileSync(inp, animated ? await sharp(buf, { animated: true }).gif().toBuffer() : await sharp(buf).png().toBuffer());
    try {
        const pre = animated ? ['-y', '-v', 'error', '-i', inp] : ['-y', '-v', 'error', '-loop', '1', '-i', inp, '-t', '3'];
        await run(FFMPEG, [...pre, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', out], 90000);
        await c.media({ video: fs.readFileSync(out), mimetype: 'video/mp4', caption: '🎥 تم التحويل إلى فيديو.' });
    } finally { rm(inp, out); }
}

async function cmdToVideo(c) {
    const t = getTarget(c, ['stickerMessage']);
    if (!t) return c.reply('📌 رد على ملصق بالأمر `.لفيديو`');
    await stickerToVideo(c, t);
}

// ----- رفع إلى مواقع استضافة للحصول على رابط
async function uploadForLink(buf, filename, mime) {
    const errors = [];
    try {   // catbox.moe
        const fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('fileToUpload', new Blob([buf], { type: mime }), filename);
        const r = await http('https://catbox.moe/user/api.php', { method: 'POST', body: fd, timeout: 90000 });
        const txt = (await r.text()).trim();
        if (r.ok && /^https?:\/\//.test(txt)) return txt;
        errors.push('catbox');
    } catch (e) { errors.push('catbox'); }
    try {   // uguu.se
        const fd = new FormData();
        fd.append('files[]', new Blob([buf], { type: mime }), filename);
        const r = await http('https://uguu.se/upload', { method: 'POST', body: fd, timeout: 90000 });
        const j = await r.json();
        const u = j?.files?.[0]?.url;
        if (u) return u;
        errors.push('uguu');
    } catch (e) { errors.push('uguu'); }
    try {   // tmpfiles.org
        const fd = new FormData();
        fd.append('file', new Blob([buf], { type: mime }), filename);
        const r = await http('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd, timeout: 90000 });
        const j = await r.json();
        const u = j?.data?.url;
        if (u) return u.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        errors.push('tmpfiles');
    } catch (e) { errors.push('tmpfiles'); }
    throw new Error('UPLOAD_FAILED:' + errors.join(','));
}

async function cmdToLink(c) {
    const t = getTarget(c, [...ANY_KINDS, 'audioMessage']);
    if (!t) return c.reply('📌 أرسل ملفاً مع الأمر أو رد على صورة/فيديو/ملصق/صوت.');
    const buf = await download(c, t);
    if (buf.length > 90 * 1024 * 1024) return c.reply('⚠️ الملف كبير جداً للرفع.');
    const mime = t.node.mimetype || 'application/octet-stream';
    const ext = (mime.split('/')[1] || 'bin').split(';')[0].replace('jpeg', 'jpg');
    try {
        const link = await uploadForLink(buf, `file_${uid()}.${ext}`, mime);
        await c.reply(`🔗 *الرابط المباشر:*\n${link}\n\n⚠️ الملف على استضافة خارجية مؤقتة، لا ترفع محتوى خاصاً.`);
    } catch (e) {
        await c.reply('❌ تعذر الرفع حالياً: خدمات الاستضافة لا تستجيب. حاول لاحقاً.');
    }
}

// ----- إيموجي
function firstEmoji(s) {
    const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
    for (const { segment } of seg.segment(s)) {
        if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3/u.test(segment)) return segment;
    }
    return null;
}
async function cmdEmoji(c) {
    const e = firstEmoji(c.args || '');
    if (!e) return c.reply('📌 اكتب إيموجي بعد الأمر، مثال: `.ايموجي 😎`');
    const cps = Array.from(e).map((ch) => ch.codePointAt(0).toString(16));
    const noFe0f = cps.filter((x) => x !== 'fe0f');
    const twe = (cps.includes('200d') ? cps : noFe0f).join('-');
    const urls = [
        `https://fonts.gstatic.com/s/e/notoemoji/latest/${cps.join('_')}/512.png`,
        `https://fonts.gstatic.com/s/e/notoemoji/latest/${noFe0f.join('_')}/512.png`,
        `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${twe}.png`
    ];
    for (const u of urls) {
        try {
            const { buf, type } = await httpBuffer(u, 5 * 1024 * 1024);
            if (!type.startsWith('image/')) continue;
            return await c.media({ sticker: await makeSticker(buf, StickerTypes.FULL) });
        } catch (err) { /* جرّب المصدر التالي */ }
    }
    await c.reply('❌ لم أجد صورة لهذا الإيموجي.');
}

// ----- ملصق نصي
const TEXT_COLORS = {
    'احمر': '#ff3b3b', 'ازرق': '#3b82ff', 'اخضر': '#22c55e', 'اصفر': '#facc15', 'وردي': '#ff6ec7',
    'بنفسجي': '#a855f7', 'برتقالي': '#fb923c', 'اسود': '#000000', 'ابيض': '#ffffff', 'ذهبي': '#ffd700'
};
const FRAME_COLORS = {
    'ذهبي': 'gold', 'احمر': 'red', 'ازرق': 'blue', 'اخضر': 'green', 'اسود': 'black',
    'ابيض': 'white', 'وردي': 'pink', 'بنفسجي': 'purple', 'برتقالي': 'orange', 'اصفر': 'yellow'
};
let fontPromise = null;
function ensureFont() {
    if (fontPromise) return fontPromise;
    fontPromise = (async () => {
        const dest = path.resolve('./bin/Cairo.ttf');
        if (fs.existsSync(dest)) return dest;
        const name = 'Cairo%5Bslnt%2Cwght%5D.ttf';
        for (const u of [
            `https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/${name}`,
            `https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/${name}`
        ]) {
            try {
                const { buf } = await httpBuffer(u, 10 * 1024 * 1024);
                if (buf.length > 10000) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf); return dest; }
            } catch (e) {}
        }
        return null;
    })();
    return fontPromise;
}
const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function renderTextPng(text, color = '#ffffff') {
    const sharp = await getSharp();
    if (!sharp) throw new Error('NO_SHARP');
    const fontfile = await ensureFont();
    const mk = (clr) => sharp({
        text: {
            text: `<span foreground="${clr}">${escXml(text)}</span>`,
            rgba: true, width: 480, height: 480, align: 'centre',
            ...(fontfile ? { fontfile, font: 'Cairo' } : { font: 'sans' })
        }
    }).png().toBuffer();
    const shadowClr = color.toLowerCase() === '#000000' ? '#ffffff' : '#000000';
    const [main, shadow] = await Promise.all([mk(color), mk(shadowClr)]);
    const meta = await sharp(main).metadata();
    const left = Math.max(0, Math.min(506 - meta.width, Math.round((512 - meta.width) / 2)));
    const top = Math.max(0, Math.min(506 - meta.height, Math.round((512 - meta.height) / 2)));
    return await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: shadow, left: left + 3, top: top + 3 }, { input: main, left, top }])
        .png().toBuffer();
}

async function cmdText(c) {
    let txt = c.args;
    if (!txt) txt = quotedText(c);
    if (!txt) return c.reply('📌 اكتب النص بعد الأمر، مثال: `.كتابة اهلا` أو `.كتابة احمر اهلا`');
    let color = '#ffffff';
    const first = norm(txt.split(/\s+/)[0]);
    const colorKey = Object.keys(TEXT_COLORS).find((k) => norm(k) === first);
    if (colorKey && txt.split(/\s+/).length > 1) { color = TEXT_COLORS[colorKey]; txt = txt.split(/\s+/).slice(1).join(' '); }
    if (txt.length > 120) return c.reply('⚠️ النص طويل (الحد 120 حرفاً).');
    let png;
    try { png = await renderTextPng(txt, color); } catch (e) {
        return c.reply('❌ تعذر رسم النص: مكتبة sharp غير متوفرة. أضفها في package.json ثم أعد النشر.');
    }
    await c.media({ sticker: await makeSticker(png, StickerTypes.FULL) });
}

// ----- تعديلات الصور (إطار / قص / عكس / تدوير / رمادي)
async function cmdImageEdit(c, op) {
    const t = getTarget(c, IMG_KINDS);
    if (!t) return c.reply(NEED_IMG);
    const buf = await download(c, t);
    let filter, type = StickerTypes.FULL;
    if (op === 'عكس') { filter = 'hflip'; }
    else if (op === 'تدوير') { filter = 'transpose=1'; }
    else if (op === 'رمادي') { filter = 'hue=s=0'; }
    else if (op === 'قص') {
        const m = /^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/.exec(c.args.trim());
        const a = m ? Number(m[1]) : 1, b = m ? Number(m[2]) : 1;
        if (!a || !b) return c.reply('📌 مثال: `.قص` أو `.قص 16:9`');
        filter = `crop=w='min(iw,ih*${a}/${b})':h='min(ih,iw*${b}/${a})'`;
        type = StickerTypes.DEFAULT;
    } else if (op === 'إطار') {
        const w = c.args.trim().toLowerCase();
        const key = Object.keys(FRAME_COLORS).find((k) => norm(k) === norm(w));
        let color = key ? FRAME_COLORS[key] : (/^#?[0-9a-f]{6}$/.test(w) ? '0x' + w.replace('#', '') : (/^[a-z]+$/.test(w) ? w : 'gold'));
        filter = `pad=w=iw+max(iw\\,ih)/12:h=ih+max(iw\\,ih)/12:x=(ow-iw)/2:y=(oh-ih)/2:color=${color}`;
    }
    let png;
    try { png = await ffImage(buf, filter); } catch (e) {
        if (op === 'إطار') return c.reply('❌ لون الإطار غير صالح. جرّب: ذهبي، احمر، ازرق، اخضر، اسود، ابيض.');
        throw e;
    }
    await c.media({ sticker: await makeSticker(png, type) });
}

// ----- حزمة ملصقات
const decodeHtml = (s) => (s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// البحث في Sticker.ly مباشرة (يعطي الاسم والعدد وصور الملصقات)
const PACK_SEARCH_CACHE = new Map();
async function stickerlyPacks(q) {
    let r = [];
    for (let i = 0; i < 2 && !r.length; i++) {
        if (i) await sleep(1500);
        try { r = await stickerlyPacksRaw(q); } catch (e) { logErr('ستيكرلي-بحث', e); }
    }
    if (r.length) { PACK_SEARCH_CACHE.set(q, r); return r; }
    return PACK_SEARCH_CACHE.get(q) || [];   // فشل الخادم الآن: نستخدم آخر نتيجة ناجحة لنفس البحث
}
async function stickerlyPacksRaw(q) {
    const j = await httpJson('https://api.sticker.ly/v4/stickerPack/smartSearch', {
        method: 'POST', timeout: 20000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'androidapp.stickerly/1.17.0 (Pixel 7; U; Android 33; en-US; US)' },
        body: JSON.stringify({ keyword: q, enabledKeywordSearch: true, filter: { extendSearchResult: false, onlyAnimatedPack: false } })
    });
    const packs = j?.result?.packs || [];
    const out = packs.map((p) => {
        const files = p.resourceFiles || (p.stickers || []).map((x) => x.fileName).filter(Boolean);
        const prefix = p.resourceUrlPrefix || '';
        return {
            id: p.packId || null,
            title: p.name, author: p.authorName || '', animated: !!p.isAnimated,
            count: files.length || p.stickerCount || null,
            link: p.packId ? `https://sticker.ly/s/${p.packId}` : null,
            thumbs: files.slice(0, 4).map((f) => prefix + f),
            urls: files.map((f) => prefix + f)
        };
    }).filter((p) => p.title && p.link);
    out.sort((a, b) => Number(a.animated) - Number(b.animated));   // الثابتة أولاً
    return out;
}

// الطريقة القديمة كاحتياط (بحث عام ثم قراءة صفحة الحزمة)
async function legacyPacks(q) {
    const r = await http('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(`site:sticker.ly ${q} sticker pack`), { timeout: 20000 });
    const html = await r.text();
    const links = [];
    for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)) {
        let href = decodeHtml(m[1]);
        const u = /uddg=([^&]+)/.exec(href);
        if (u) href = decodeURIComponent(u[1]);
        if (/sticker\.ly\/s\//.test(href) && !links.includes(href)) links.push(href);
        if (links.length >= 3) break;
    }
    const packs = [];
    for (const link of links) {
        try {
            const rr = await http(link, { timeout: 15000 });
            const mt = metaTags(await rr.text());
            const title = decodeHtml(mt['og:title'] || '').replace(/\s*[|\-–].*Sticker\.ly.*$/i, '').trim();
            const desc = decodeHtml(mt['og:description'] || mt['description'] || '');
            const cnt = /(\d+)\s*(?:stickers?|ملصق)/i.exec(desc) || /(\d+)\s*(?:stickers?|ملصق)/i.exec(mt['og:title'] || '');
            if (title) packs.push({ id: (/sticker\.ly\/s\/([^/?#]+)/.exec(link) || [])[1] || null, title, author: '', count: cnt ? cnt[1] : null, link, thumbs: [], icon: mt['og:image'] || null });
        } catch (e) { /* تجاهل */ }
    }
    return packs;
}

// صورة مجمّعة 2×2 لأول 4 ملصقات (مثل بطاقة الحزمة في واتساب)
async function packCollage(urls) {
    const sharp = await getSharp();
    if (!sharp || !urls?.length) return null;
    const tiles = [];
    for (const u of urls.slice(0, 4)) {
        try {
            const { buf } = await httpBuffer(u, 3 * 1024 * 1024);
            tiles.push(await sharp(buf).resize(240, 240, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: '#ffffff' }).png().toBuffer());
        } catch (e) { /* تجاهل */ }
    }
    if (!tiles.length) return null;
    const pos = [[12, 12], [260, 12], [12, 260], [260, 260]];
    return await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffffff' } })
        .composite(tiles.map((input, i) => ({ input, left: pos[i][0], top: pos[i][1] })))
        .jpeg({ quality: 88 }).toBuffer();
}

const PACK_BUSY = new Set();
const STICKERLY_HEADERS = { 'Content-Type': 'application/json', 'User-Agent': 'androidapp.stickerly/1.17.0 (Pixel 7; U; Android 33; en-US; US)' };

// القائمة الكاملة لملصقات الحزمة (نتيجة البحث تعطي أول بضعة ملصقات فقط)
async function stickerlyPackFiles(p) {
    if (p.id) {
        try {
            const j = await httpJson(`https://api.sticker.ly/v4/stickerPack/${p.id}?needRelation=true`, { timeout: 20000, headers: STICKERLY_HEADERS });
            const r = j?.result || {};
            const prefix = r.resourceUrlPrefix || '';
            const files = (r.stickers || []).map((x) => x.fileName).filter(Boolean);
            const list = files.length ? files : (r.resourceFiles || []);
            if (list.length) return list.map((f) => (/^https?:/.test(f) ? f : prefix + f));
        } catch (e) { logErr('ستيكرلي-تفاصيل', e); }
    }
    if (p.link) {   // احتياط: قراءة صفحة الحزمة نفسها
        try {
            const html = await (await http(p.link, { timeout: 20000 })).text();
            const prefix = (/"resourceUrlPrefix"\s*:\s*"([^"]+)"/.exec(html) || [])[1];
            const files = [...new Set([...html.matchAll(/"fileName"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))];
            if (prefix && files.length) return files.map((f) => prefix.replace(/\\\//g, '/') + f);
            const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
            if (nd) {
                const jd = JSON.parse(nd[1]); let pre = '', names = [];
                (function walk(o, d) {
                    if (!o || typeof o !== 'object' || d > 9) return;
                    if (typeof o.resourceUrlPrefix === 'string' && !pre) pre = o.resourceUrlPrefix;
                    if (typeof o.fileName === 'string') names.push(o.fileName);
                    for (const v of Object.values(o)) walk(v, d + 1);
                })(jd, 0);
                names = [...new Set(names)];
                if (pre && names.length) return names.map((f) => (/^https?:/.test(f) ? f : pre + f));
            }
        } catch (e) { logErr('ستيكرلي-صفحة', e); }
    }
    return p.urls || [];
}

// يحمّل ملصقات الحزمة ويحوّلها لملصقات واتساب سليمة (512×512 + اسم الحزمة)
async function buildPackStickers(urls, packName, onStep) {
    const out = [];
    for (const u of urls.slice(0, 30)) {
        try {
            const { buf, type } = await httpBuffer(u, 3 * 1024 * 1024);
            if (/^(text\/|application\/json)/.test(type) || buf.length < 200) continue;
            out.push(await makeSticker(buf, StickerTypes.FULL, { pack: packName, author: AUTHOR, quality: 70 }));
        } catch (e) { /* تجاهل الملصق الفاشل */ }
        onStep?.(out.length, urls.length);
    }
    return out;
}

// حزمة واتساب الأصلية (بطاقة «عرض مجموعة الملصقات» + «إضافة إلى ملصقاتك»)
// تعمل فقط إذا كانت نسخة Baileys المثبّتة تدعمها، وإلا نرجع false فتُرسل الملصقات واحداً واحداً
function nativePackSupported() {
    try {
        const proto = BaileysNs.proto || BaileysNs.default?.proto;
        return !!proto?.Message?.prototype && ('stickerPackMessage' in proto.Message.prototype);
    } catch (e) { return false; }
}
async function sendNativePack(c, { title, author, animated, stickers }) {
    if (!nativePackSupported()) { console.error('[حزمة-أصلية] نسخة Baileys المثبّتة لا تدعم stickerPack، حدّث المكتبة في package.json'); return false; }
    try {
        await c.sock.sendMessage(c.from, {
            stickerPack: {
                name: title, publisher: author || AUTHOR, description: `${title} • ${AUTHOR}`, cover: stickers[0],
                stickers: stickers.map((b) => ({ sticker: b, data: b, emojis: ['🍷'], isAnimated: !!animated }))
            }
        }, { quoted: c.msg });
        return true;
    } catch (e) { logErr('حزمة-أصلية', e); return false; }
}

async function cmdPack(c) {
    const q = c.args.trim();
    if (!q) return c.reply('📌 مثال: `.حزمة ناروتو` أو `.حزمة ايرين`');
    const en = (await toEnglishName(q)).trim();
    const tokens = nameTokens(en, q);

    // 1) البحث (بالإنجليزية أولاً لأنها أدق) ودمج النتائج بلا تكرار؛ جولتان قبل الاستسلام
    let packs = [];
    const seen = new Set();
    for (let round = 0; round < 2 && !packs.length; round++) {
        if (round) await sleep(2500);
        for (const query of [...new Set([en, `${en} sticker`, q])]) {
            let r = [];
            try { r = await stickerlyPacks(query); } catch (e) { logErr('ستيكرلي-بحث', e); }
            for (const p of r) { const k = p.id || p.link; if (!seen.has(k)) { seen.add(k); packs.push(p); } }
            if (packs.length >= 8) break;
        }
        if (!packs.length) { try { packs = await legacyPacks(en); } catch (e) { packs = []; } }
    }
    if (!packs.length) return c.reply(`❌ لم أعثر على حزمة ملصقات مناسبة لـ (${q}).\nجرّب اسماً آخر أو بالإنجليزية.`);
    const rel = (p) => (tokens.some((x) => `${p.title} ${p.author}`.toLowerCase().includes(x)) ? 0 : 1);
    packs = packs.map((p, i) => ({ p, i })).sort((a, b) => rel(a.p) - rel(b.p) || Number(a.p.animated) - Number(b.p.animated) || a.i - b.i).map((x) => x.p);

    if (PACK_BUSY.has(c.from)) return c.reply('⏳ توجد حزمة قيد الإرسال في هذه المحادثة، انتظر حتى تنتهي.');
    PACK_BUSY.add(c.from);
    try {
        // 2) نجهّز أول حزمة تعطينا ملصقات صالحة
        let chosen = null, stickers = [];
        for (const p of packs.slice(0, 4)) {
            const files = await stickerlyPackFiles(p);
            if (files.length < 3) continue;
            stickers = await buildPackStickers(files, p.title, (n) => c.prog?.set(5 + 60 * Math.min(1, n / Math.min(30, files.length))));
            if (stickers.length >= 3) { chosen = p; break; }
        }

        if (chosen) {
            await c.reply(`╭━━━〔 📦 〕━━━╮\n『 ${chosen.title} 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n〔 ✅ 〕 تم تجهيز ${stickers.length} ملصق\n〔 📤 〕 جاري إرسال الحزمة...`);
            if (await sendNativePack(c, { title: chosen.title, author: chosen.author, animated: chosen.animated, stickers })) return;
            let sent = 0;
            for (const st of stickers) {
                try { await c.sock.sendMessage(c.from, { sticker: st }); sent++; } catch (e) { logErr('إرسال-ملصق', e); }
                c.prog?.set(70 + 28 * sent / stickers.length);
                await sleep(700);
            }
            if (!sent) return c.reply('❌ تعذر إرسال ملصقات هذه الحزمة، جرّب اسماً آخر.');
            return c.reply(`✅ تم إرسال ${sent} ملصق من حزمة (${chosen.title}).${chosen.link ? `\n\n💡 لإضافة الحزمة كاملة دفعة واحدة:\n${chosen.link}` : ''}`);
        }

        // 3) لم نستطع تجهيز ملصقات أي حزمة: لا نرسل رابطاً، فقط نخبر المستخدم
        return c.reply(`❌ تعذر تجهيز ملصقات حزمة (${q}) الآن.\nجرّب اسماً آخر أو أعد المحاولة بعد قليل.`);
    } finally { PACK_BUSY.delete(c.from); }
}

// ---------------------------------------------------------------- التنزيل
let ytdlpPromise = null;
function getYtDlp() {
    if (ytdlpPromise) return ytdlpPromise;
    ytdlpPromise = (async () => {
        const local = path.resolve('./bin/yt-dlp');
        for (const p of [process.env.YTDLP_PATH, local, 'yt-dlp'].filter(Boolean)) {
            try { await run(p, ['--version'], 20000); return p; } catch (e) {}
        }
        const asset = process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
        const res = await http(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`, { timeout: 240000 });
        if (!res.ok) throw new Error('YTDLP_DOWNLOAD_FAILED');
        fs.mkdirSync(path.dirname(local), { recursive: true });
        fs.writeFileSync(local, Buffer.from(await res.arrayBuffer()));
        fs.chmodSync(local, 0o755);
        await run(local, ['--version'], 30000);
        return local;
    })().catch((e) => { ytdlpPromise = null; throw e; });
    return ytdlpPromise;
}

// ---------------------------------------------------------------- أدوات مساعدة للتنزيل (تقدّم حي + بدائل)
// تشغيل أمر مع قراءة نسبة التقدم الحقيقية (yt-dlp)
const runProgress = (file, args, timeout, onPct) => new Promise((resolve, reject) => {
    const cp = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', buf = '';
    const timer = setTimeout(() => { try { cp.kill('SIGKILL'); } catch (e) {} }, timeout);
    cp.stdout.on('data', (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.search(/[\r\n]/)) >= 0) {
            const line = buf.slice(0, i); buf = buf.slice(i + 1);
            const m = /dlprog:\s*([\d.]+)%/.exec(line);
            if (m) { if (onPct) { try { onPct(Number(m[1])); } catch (e) {} } }
            else if (out.length < 200000) out += line + '\n';
        }
    });
    cp.stderr.on('data', (d) => { err += d.toString(); if (err.length > 200000) err = err.slice(-100000); });
    cp.on('error', (e) => { clearTimeout(timer); e.stderr = err; reject(e); });
    cp.on('close', (code, sig) => {
        clearTimeout(timer);
        if (code === 0) return resolve({ stdout: out, stderr: err });
        const e = new Error('exit ' + (code ?? sig)); e.stderr = err; reject(e);
    });
});

// عدّاد تقدم حي: رسالة تُعدَّل كل بضع ثوانٍ من 0% إلى 100% حتى يجهز الطلب
function makeProgress(c, label) {
    const bar = (p) => '▰'.repeat(Math.round(p / 10)) + '▱'.repeat(10 - Math.round(p / 10));
    const render = (p, state) => `${state === 'ok' ? '✅' : state === 'fail' ? '❌' : '⏳'} *${label}*\n\n${bar(p)}  *${p}%*\n${state === 'ok' ? '🎉 الطلب جاهز!' : state === 'fail' ? 'تعذر إكمال الطلب.' : '🔄 جاري التحضير...'}`;
    let pct = 0, shown = -1, key = null, closed = false, timer = null, chain = Promise.resolve();
    const edit = (p, state) => {
        chain = chain.then(async () => {
            if (!key) return;
            try { await c.sock.sendMessage(c.from, { text: render(p, state), edit: key }); shown = p; } catch (e) {}
        });
        return chain;
    };
    const obj = {
        set(p) { if (!closed && p > pct) pct = Math.min(99, Math.floor(p)); },
        async start() {
            try { const sent = await c.sock.sendMessage(c.from, { text: render(0) }, { quoted: c.msg }); key = sent?.key || null; shown = 0; } catch (e) { key = null; }
            timer = setInterval(() => {
                if (closed) return;
                if (pct < 90) pct = Math.min(90, pct + 1 + Math.floor(Math.random() * 4));   // تقدم تقديري إلى أن تصل نسبة حقيقية
                if (pct !== shown) edit(pct);
            }, 2500);
            return obj;
        },
        async finish(ok = true) {
            if (closed) return;
            closed = true; clearInterval(timer);
            await edit(ok ? 100 : pct, ok ? 'ok' : 'fail');
        }
    };
    return obj;
}

// بدائل عبر واجهات عامة عندما تفشل أداة yt-dlp (مثلاً حظر يوتيوب لخوادم الاستضافة)
function collectUrls(o, out = [], key = '') {
    if (!o) return out;
    if (typeof o === 'string') { if (/^https?:\/\//.test(o) && !/thumb|cover|avatar|poster|preview|icon/i.test(key)) out.push({ url: o, key }); return out; }
    if (Array.isArray(o)) { o.forEach((x) => collectUrls(x, out, key)); return out; }
    if (typeof o === 'object') for (const [k, v] of Object.entries(o)) collectUrls(v, out, k);
    return out;
}
const keyScore = (k) => (/^(dl|download|downloadurl|download_url|video|hd|nowm|audio|mp3|mp4|url|link)$/i.test(k) ? 0 : 1);
function apiEndpoints(url, kind) {
    const pf = platformOf(url);
    const n = pf ? pf[2] : '';
    if (n === 'يوتيوب') {
        const t = kind === 'audio' ? 'ytmp3' : 'ytmp4';
        return [`https://api.siputzx.my.id/api/d/${t}?url=`, `https://api.ryzendesu.vip/api/downloader/${t}?url=`];
    }
    if (n === 'انستا') return ['https://api.siputzx.my.id/api/d/igdl?url=', 'https://api.ryzendesu.vip/api/downloader/igdl?url=', 'https://api.vreden.my.id/api/igdl?url=', 'https://api.agatz.xyz/api/instagram?url='];
    if (n === 'فيس') return ['https://api.siputzx.my.id/api/d/facebook?url=', 'https://api.ryzendesu.vip/api/downloader/fbdl?url='];
    if (n === 'تيك') return ['https://api.siputzx.my.id/api/d/tiktok?url='];
    return ['https://api.siputzx.my.id/api/d/savefrom?url='];
}
async function apiFetchMedia(url, kind) {
    for (const ep of apiEndpoints(url, kind)) {
        let j;
        try { j = await httpJson(ep + encodeURIComponent(url), { timeout: 30000 }); } catch (e) { continue; }
        const cands = collectUrls(j).sort((a, b) => keyScore(a.key) - keyScore(b.key));
        for (const cnd of cands.slice(0, 4)) {
            try {
                const r = await httpBuffer(cnd.url, MAX_DL, { timeout: 60 * 60 * 1000 });
                if (/^(text\/|application\/json)/.test(r.type) || r.buf.length < 2000) continue;
                return { ...r, from: cnd.url };
            } catch (e) { /* التالي */ }
        }
    }
    return null;
}

// بحث يوتيوب بدون yt-dlp (قراءة صفحة النتائج)
async function searchYoutube(q) {
    const r = await http('https://www.youtube.com/results?hl=en&search_query=' + encodeURIComponent(q), { timeout: 20000, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    const html = await r.text();
    const m = /var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
    if (!m) return [];
    let data; try { data = JSON.parse(m[1]); } catch (e) { return []; }
    const out = [];
    (function walk(o) {
        if (!o || typeof o !== 'object' || out.length >= 10) return;
        if (o.videoRenderer && o.videoRenderer.videoId) {
            const v = o.videoRenderer;
            const dur = (v.lengthText?.simpleText || '').split(':').map(Number).reduce((a, x) => a * 60 + (x || 0), 0);
            out.push({ id: v.videoId, title: v.title?.runs?.[0]?.text || '', duration: dur || 0, channel: v.ownerText?.runs?.[0]?.text || '' });
            return;
        }
        for (const k of Object.keys(o)) walk(o[k]);
    })(data);
    return out;
}

function friendlyDlError(e) {
    const s = (e.stderr || e.message || '') + '';
    if (/larger than max|max-filesize|TOO_BIG/i.test(s)) return '⚠️ الملف أكبر من الحد المسموح (100MB).';
    if (/not a bot/i.test(s)) return '🔒 يوتيوب يمنع هذا الخادم مؤقتاً (تحقق الروبوت). جرّب منصة أخرى أو أضف كوكيز YTDLP_COOKIES.';
    if (/private video|private account|login required|log in|sign in|cookies|authenticat|age[- ]restrict|confirm your age|members-only|rate-limit|not a bot/i.test(s)) return '🔒 المحتوى خاص أو يتطلب تسجيل دخول، ولا أستطيع تنزيله.';
    if (/unsupported url/i.test(s)) return '❌ هذا الرابط غير مدعوم.';
    if (/not available|removed|deleted|unavailable|404/i.test(s)) return '❌ المحتوى غير متاح أو حُذف.';
    if (/YTDLP_DOWNLOAD_FAILED|ENOENT/i.test(s)) return '❌ أداة التنزيل غير متوفرة على هذا الخادم.';
    return '❌ تعذر تنزيل المحتوى من هذا الرابط.';
}

let lastYtdlpUpdate = 0;
async function updateYtDlp(bin) {
    if (Date.now() - lastYtdlpUpdate < 6 * 3600 * 1000) return false;
    lastYtdlpUpdate = Date.now();
    try { await run(bin, ['-U'], 120000); return true; } catch (e) { return false; }
}
// كوكيز اختيارية لتجاوز حظر المنصات: YTDLP_COOKIES_FILE (مسار) أو YTDLP_COOKIES (نص Netscape)
function cookiesArgs() {
    try {
        const f = process.env.YTDLP_COOKIES_FILE;
        if (f && fs.existsSync(f)) return ['--cookies', f];
        if (process.env.YTDLP_COOKIES) {
            const cp = path.resolve('./bin/cookies.txt');
            fs.mkdirSync(path.dirname(cp), { recursive: true });
            fs.writeFileSync(cp, process.env.YTDLP_COOKIES.replace(/\\n/g, '\n'));
            return ['--cookies', cp];
        }
    } catch (e) {}
    return [];
}

async function ytdlpDownload(url, { audio = false, many = false, onProgress } = {}) {
    const bin = await getYtDlp();
    const id = uid();
    const prefix = `dl_${id}`;
    const isYt = /(^|\.)(youtube\.com|youtu\.be)$/.test(hostOf(url));
    const args = ['--no-warnings', '--newline', '--progress', '--progress-template', 'download:dlprog:%(progress._percent_str)s', '--restrict-filenames',
        '--socket-timeout', '20', '--user-agent', UA, '-o', path.join(TMP, `${prefix}_%(autonumber)s.%(ext)s`)];
    if (FFMPEG !== 'ffmpeg') args.push('--ffmpeg-location', FFMPEG);
    args.push(...cookiesArgs());
    if (many) args.push('--playlist-end', '10'); else args.push('--no-playlist');
    if (audio) args.push('-x', '--audio-format', 'mp3', '--audio-quality', '5');
    else args.push('-f', 'bv*[vcodec^=avc1][height<=720]+ba[acodec^=mp4a]/bv*[vcodec^=avc1][height<=720]+ba/bv*[height<=720]+ba/b[height<=720]/b', '--merge-output-format', 'mp4');
    const clean = () => { for (const f of fs.readdirSync(TMP)) if (f.startsWith(prefix)) rm(path.join(TMP, f)); };
    const stripJs = (a) => { const o = []; for (let i = 0; i < a.length; i++) { if (a[i] === '--js-runtimes') { i++; continue; } o.push(a[i]); } return o; };
    // يوتيوب يحتاج بيئة جافاسكربت (node) ومحاولات بعملاء مختلفين
    const attempts = isYt
        ? [['--js-runtimes', 'node'], ['--js-runtimes', 'node', '--extractor-args', 'youtube:player_client=tv,mweb,web_safari'], ['--js-runtimes', 'node', '--extractor-args', 'youtube:player_client=android_vr,ios']]
        : [[]];
    const tryRun = async (extra) => {
        try { await runProgress(bin, [...args, ...extra, url], 3 * 3600 * 1000, onProgress); }
        catch (e) {
            clean();
            if (extra.includes('--js-runtimes') && /no such option|unrecognized arguments/i.test(e.stderr || '')) {
                try { await runProgress(bin, [...args, ...stripJs(extra), url], 3 * 3600 * 1000, onProgress); return; }
                catch (e2) { clean(); throw e2; }
            }
            throw e;
        }
    };
    let lastErr = null;
    for (const extra of attempts) {
        try { await tryRun(extra); lastErr = null; break; } catch (e) { lastErr = e; if (/private|not available|unsupported url|too_big|larger than/i.test(e.stderr || '')) break; }
    }
    if (lastErr && /unable to extract|nsig|signature|failed to parse|unable to download webpage|unsupported url/i.test((lastErr.stderr || '') + '') && await updateYtDlp(bin)) {
        try { await tryRun(attempts[0]); lastErr = null; } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    const files = fs.readdirSync(TMP).filter((f) => f.startsWith(prefix) && !f.endsWith('.part')).sort().map((f) => path.join(TMP, f));
    if (!files.length) throw new Error('NO_FILE');
    return files;
}

const EXT_KIND = {
    mp4: 'video', mov: 'video', m4v: 'video', webm: 'doc', mkv: 'doc',
    jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
    mp3: 'audio', m4a: 'audio', ogg: 'audio', opus: 'audio', wav: 'audio'
};
const MIME = { mp4: 'video/mp4', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav',
    webm: 'video/webm', mkv: 'video/x-matroska', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mov: 'video/quicktime' };

async function mediaCodecs(file) {
    let txt = '';
    try { txt = (await run(FFMPEG, ['-hide_banner', '-i', file], 30000)).stderr; }
    catch (e) { if (e.code === 'ENOENT') return { missing: true }; txt = e.stderr || ''; }
    return {
        video: (/Video:\s*([a-z0-9_]+)/i.exec(txt) || [])[1] || null,
        audio: (/Audio:\s*([a-z0-9_]+)/i.exec(txt) || [])[1] || null,
        yuv420: /yuv420p(?![0-9a-z])/i.test(txt)
    };
}
const badMedia = () => Object.assign(new Error('BAD_MEDIA'), { friendly: '❌ الملف الذي تم تنزيله تالف أو غير صالح، جرّب رابطاً آخر.' });
// يتأكد أن الملف يُفكّ ترميزه فعلاً (هذا ما يمنع رسالة «الفيديو غير متوفر لوجود خلل في الملف المرئي»)
async function decodesOk(file, lenient = false) {
    try {
        const r = await run(FFMPEG, ['-v', 'error', '-i', file, '-t', '6', '-f', 'null', '-'], 120000);
        return lenient ? true : !String(r.stderr || '').trim();
    } catch (e) { return false; }
}
// صورة مصغّرة من أول ثانية (بدونها تظهر الشاشة سوداء في واتساب)
async function videoThumb(file) {
    const out = path.join(TMP, `th_${uid()}.jpg`);
    try {
        for (const ss of ['0.5', '0']) {
            try {
                await run(FFMPEG, ['-y', '-v', 'error', '-ss', ss, '-i', file, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '6', out], 40000);
                const b = fs.readFileSync(out);
                if (b.length > 500) return b;
            } catch (e) { /* جرّب الثانية الأولى */ }
        }
        return null;
    } finally { rm(out); }
}
// يعيد بناء أي فيديو كملف mp4 قياسي (H.264 + AAC + faststart) ثم يتحقق منه قبل الإرسال
// يرجع: { buf, thumb } عند النجاح، { unchecked: true } إن لم يوجد ffmpeg، أو null إن تعذر إصلاحه
async function makeWhatsAppMp4(buf) {
    const id = uid();
    const inp = path.join(TMP, `mi_${id}.bin`), out = path.join(TMP, `mo_${id}.mp4`);
    try {
        fs.writeFileSync(inp, buf);
        const k = await mediaCodecs(inp);
        if (k.missing) return { unchecked: true };
        if (!k.video) throw badMedia();
        const okV = k.video === 'h264' && k.yuv420, okA = !k.audio || k.audio === 'aac';
        const audio = ['-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100'];
        const encV = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-profile:v', 'main', '-level', '4.0', '-pix_fmt', 'yuv420p', '-vf', "scale='trunc(min(1280,iw)/2)*2':-2"];
        const attempts = [];
        if (okV && okA) attempts.push(['-c:v', 'copy', '-c:a', 'copy']);
        if (okV) attempts.push(['-c:v', 'copy', ...audio]);
        attempts.push([...encV, ...audio]);
        for (let i = 0; i < attempts.length; i++) {
            rm(out);
            try {
                await run(FFMPEG, ['-y', '-v', 'error', '-fflags', '+genpts', '-i', inp, '-map', '0:v:0', '-map', '0:a:0?', ...attempts[i], '-movflags', '+faststart', '-f', 'mp4', out], 3 * 3600 * 1000);
                const o = fs.readFileSync(out);
                if (o.length < 1000) continue;
                if (await decodesOk(out, i === attempts.length - 1)) return { buf: o, thumb: await videoThumb(out) };
            } catch (e) { /* المحاولة التالية */ }
        }
        return null;
    } catch (e) { if (e.message === 'BAD_MEDIA') throw e; return { unchecked: true }; }
    finally { rm(inp, out); }
}
// يحوّل أي صوت إلى mp3 سليم (يمنع رسالة «المقطع الصوتي غير متوفر لوجود خلل»)
async function makeWhatsAppAudio(buf) {
    const id = uid();
    const inp = path.join(TMP, `ai_${id}.bin`), out = path.join(TMP, `ao_${id}.mp3`);
    try {
        fs.writeFileSync(inp, buf);
        const k = await mediaCodecs(inp);
        if (k.missing) return buf;
        if (!k.audio) throw badMedia();
        if (k.audio === 'mp3' && !k.video) return buf;
        await run(FFMPEG, ['-y', '-v', 'error', '-i', inp, '-vn', '-c:a', 'libmp3lame', '-q:a', '4', '-ar', '44100', out], 180000);
        const o = fs.readFileSync(out);
        return o.length ? o : buf;
    } catch (e) { if (e.message === 'BAD_MEDIA') throw e; return buf; }
    finally { rm(inp, out); }
}

async function sendBuffer(c, buf, ext, caption = '') {
    ext = (ext || 'bin').toLowerCase();
    let kind = EXT_KIND[ext] || 'doc';
    if (buf.length > MAX_AS_MEDIA) kind = 'doc';
    const mimetype = MIME[ext] || 'application/octet-stream';
    c.prog?.set(90);
    if (kind === 'video') {
        const r = await makeWhatsAppMp4(buf);
        if (!r) return c.media({ document: buf, mimetype: 'video/mp4', fileName: `Eren_Bot_${uid()}.mp4`, caption });   // تعذر إصلاحه: يُرسل كملف بدل فيديو تالف
        if (r.unchecked) return c.media({ video: buf, mimetype: 'video/mp4', caption });
        return c.media({ video: r.buf, mimetype: 'video/mp4', caption, ...(r.thumb ? { jpegThumbnail: r.thumb } : {}) });
    }
    if (kind === 'image') return c.media({ image: buf, caption });
    if (kind === 'audio') {
        const fixed = await makeWhatsAppAudio(buf);
        return c.media({ audio: fixed, mimetype: fixed === buf ? mimetype : 'audio/mpeg', ptt: false });
    }
    return c.media({ document: buf, mimetype, fileName: `Eren_Bot_${uid()}.${ext}`, caption });
}
async function sendFiles(c, files, caption = '') {
    try {
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            await sendBuffer(c, fs.readFileSync(f), path.extname(f).slice(1), i === 0 ? caption : '');
        }
    } finally { rm(...files); }
}
async function sendUrlMedia(c, url, caption = '', forceExt) {
    const { buf, type } = await httpBuffer(url, MAX_DL);
    if (/^(text\/|application\/json)/.test(type) || buf.length < 500) throw badMedia();
    let ext = forceExt || (Object.keys(MIME).find((k) => MIME[k] === type)) || (/\.(\w{2,4})(?:\?|$)/.exec(url) || [])[1] || 'mp4';
    await sendBuffer(c, buf, ext, caption);
}

function getUrl(c) {
    const m = URL_RE.exec(c.args) || URL_RE.exec(quotedText(c));
    return m ? m[0] : null;
}
const NEED_URL = '📌 اكتب الرابط بعد الأمر، أو رد على رسالة فيها رابط.\nمثال: `.تيك https://...`';

async function viaYtdlp(c, url, opts) {
    const kind = opts?.audio ? 'audio' : 'video';
    try { return await sendFiles(c, await ytdlpDownload(url, { ...opts, onProgress: (p) => c.prog?.set(8 + p * 0.72) }), opts?.caption || ''); }
    catch (e) {
        console.error('yt-dlp فشل:', url, '|', String(e.stderr || e.message || e).split('\n').slice(-3).join(' ').slice(0, 300));
        let alt = null;
        try { alt = await apiFetchMedia(url, kind); } catch (e2) {}
        if (alt) {
            c.prog?.set(85);
            if (kind === 'audio') return sendBuffer(c, alt.buf, 'mp3', '');
            const ext = Object.keys(MIME).find((k) => MIME[k] === alt.type) || (/\.(\w{2,4})(?:\?|$)/.exec(alt.from) || [])[1] || 'mp4';
            return sendBuffer(c, alt.buf, ext, opts?.caption || '');
        }
        if (/(^|\.)instagram\.com$/.test(hostOf(url)) && kind === 'video') {
            try { return await igMirrorDownload(c, url, opts?.caption || ''); } catch (e3) {}
        }
        throw Object.assign(e, { friendly: e.friendly || friendlyDlError(e) });
    }
}
// بدائل إنستغرام: مواقع مرآة تعرض الفيديو مباشرة في وسوم og:video
async function igMirrorDownload(c, url, caption = '') {
    let u; try { u = new URL(url); } catch (e) { throw new Error('NO_MEDIA'); }
    for (const host of ['www.kkinstagram.com', 'www.instagramez.com', 'www.vxinstagram.com']) {
        try {
            const m = new URL(u.href); m.hostname = host; m.search = '';
            const r = await http(m.href, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' } });
            const mt = metaTags(await r.text());
            const v = mt['og:video:secure_url'] || mt['og:video:url'] || mt['og:video'];
            if (!v) continue;
            return await sendUrlMedia(c, new URL(decodeHtml(v), m.href).href, caption, 'mp4');
        } catch (e) { /* المرآة التالية */ }
    }
    throw new Error('NO_MEDIA');
}
async function ogDownload(c, url) {
    const r = await http(url, { timeout: 20000 });
    const mt = metaTags(await r.text());
    const video = mt['og:video:secure_url'] || mt['og:video:url'] || mt['og:video'];
    const image = mt['og:image'];
    const cap = decodeHtml(mt['og:title'] || '');
    if (video) return sendUrlMedia(c, video, cap, 'mp4');
    if (image) return sendUrlMedia(c, image, cap);
    throw new Error('NO_MEDIA');
}

async function cmdTikTok(c, url) {
    try {
        const j = await httpJson('https://www.tikwm.com/api/?hd=1&url=' + encodeURIComponent(url), { timeout: 30000 });
        if (j.code === 0 && j.data) {
            const d = j.data;
            const abs = (u) => (u && u.startsWith('/') ? 'https://www.tikwm.com' + u : u);
            const cap = `🎵 ${d.title || ''}\n👤 ${d.author?.nickname || ''}`.trim();
            if (Array.isArray(d.images) && d.images.length) {
                for (const img of d.images.slice(0, 10)) await sendUrlMedia(c, img, '', 'jpg');
                return;
            }
            const v = abs(d.hdplay || d.play);
            if (v) return await sendUrlMedia(c, v, cap, 'mp4');
        }
    } catch (e) { /* ننتقل للبديل */ }
    await viaYtdlp(c, url, {});
}

async function cmdTwitter(c, url) {
    const m = /(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/i.exec(url);
    if (m) {
        try {
            const j = await httpJson(`https://api.fxtwitter.com/${m[1]}/status/${m[2]}`, { timeout: 20000 });
            const media = j?.tweet?.media;
            const cap = `🐦 ${j?.tweet?.author?.name || ''}\n${j?.tweet?.text || ''}`.trim().slice(0, 900);
            if (media?.videos?.length) return await sendUrlMedia(c, media.videos[0].url, cap, 'mp4');
            if (media?.photos?.length) {
                for (let i = 0; i < Math.min(media.photos.length, 10); i++) await sendUrlMedia(c, media.photos[i].url, i === 0 ? cap : '');
                return;
            }
        } catch (e) { /* ننتقل للبديل */ }
    }
    await viaYtdlp(c, url, {});
}

async function cmdTelegram(c, url) {
    const m = /t\.me\/(?:s\/)?([A-Za-z0-9_]+)\/(\d+)/.exec(url);
    if (!m) return c.reply('❌ رابط تيليجرام غير صحيح. مثال: https://t.me/channel/123');
    const r = await http(`https://t.me/${m[1]}/${m[2]}?embed=1&mode=tme`, { timeout: 20000 });
    const html = await r.text();
    const v = /<video[^>]+src="([^"]+)"/.exec(html);
    const p = /tgme_widget_message_photo_wrap[^>]+background-image:url\('([^']+)'\)/.exec(html);
    const t = /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/.exec(html);
    const cap = t ? decodeHtml(t[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 900) : '';
    if (v) return await sendUrlMedia(c, decodeHtml(v[1]), cap, 'mp4');
    if (p) return await sendUrlMedia(c, decodeHtml(p[1]), cap);
    await c.reply('❌ لا توجد وسائط يمكن تنزيلها في هذا المنشور (قد تكون القناة خاصة).');
}

async function probe(url) {
    let res;
    try { res = await http(url, { method: 'HEAD', timeout: 15000 }); } catch (e) { res = null; }
    if (!res || !res.ok) { try { res = await http(url, { method: 'GET', timeout: 15000, headers: { Range: 'bytes=0-0' } }); } catch (e) { return null; } }
    return { status: res.status, type: (res.headers.get('content-type') || '').split(';')[0], size: Number(res.headers.get('content-length') || 0), finalUrl: res.url };
}

const PLATFORMS = [
    [/tiktok\.com$/, 'تيك توك', 'تيك'], [/instagram\.com$/, 'إنستغرام', 'انستا'], [/(facebook\.com|fb\.watch)$/, 'فيسبوك', 'فيس'],
    [/(youtube\.com|youtu\.be)$/, 'يوتيوب', 'يوتيوب'], [/(pinterest\.|pin\.it)/, 'بنترست', 'بنترست'], [/(twitter\.com|x\.com)$/, 'X (تويتر)', 'تويتر'],
    [/snapchat\.com$/, 'سناب شات', 'سناب'], [/threads\.(net|com)$/, 'ثريدز', 'ثريدز'], [/(t\.me|telegram\.me)$/, 'تيليجرام', 'تلي']
];
const platformOf = (url) => { const h = hostOf(url); return PLATFORMS.find(([re]) => re.test(h)) || null; };
const fmtSize = (n) => (n ? (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB') : 'غير معروف');

async function cmdLinkInfo(c) {
    const url = getUrl(c);
    if (!url) return c.reply(NEED_URL);
    const pf = platformOf(url);
    const info = await probe(url);
    if (!info) return c.reply('❌ الرابط لا يعمل أو لا يمكن الوصول إليه.');
    const kind = info.type.startsWith('video/') ? 'فيديو 🎬' : info.type.startsWith('image/') ? 'صورة 🖼️' : info.type.startsWith('audio/') ? 'صوت 🎧' : info.type.includes('html') ? 'صفحة ويب 🌐' : (info.type || 'غير معروف');
    await c.reply(`🔗 *فحص الرابط:*\n\n> 🌍 المنصة: ${pf ? pf[1] : hostOf(url)}\n> 📄 النوع: ${kind}\n> 📦 الحجم: ${fmtSize(info.size)}\n> ✅ الحالة: ${info.status}\n${pf ? `\n💡 للتنزيل: \`.${pf[2]} <الرابط>\`` : '\n💡 للتنزيل: `.ميديا <الرابط>`'}`);
}

async function cmdMedia(c, url) {
    const pf = platformOf(url);
    if (pf) {
        const map = { 'تيك': cmdTikTok, 'تويتر': cmdTwitter, 'تلي': cmdTelegram };
        if (map[pf[2]]) return map[pf[2]](c, url);
        return viaYtdlp(c, url, { many: pf[2] === 'انستا' || pf[2] === 'ثريدز' });
    }
    const info = await probe(url);
    if (info && /^(video|image|audio)\//.test(info.type)) return sendUrlMedia(c, url);
    try { await viaYtdlp(c, url, {}); } catch (e) {
        try { await ogDownload(c, url); } catch (e2) { throw e; }
    }
}

async function cmdSearch(c) {
    const q = c.args.trim();
    if (!q) return c.reply('📌 مثال: `.بحث اغنية حماسية`');
    let entries = [];
    try {
        const bin = await getYtDlp();
        const out = await run(bin, ['--no-warnings', '--flat-playlist', '-J', ...cookiesArgs(), `ytsearch5:${q}`], 60000);
        entries = JSON.parse(out.stdout).entries || [];
    } catch (e) { entries = []; }
    if (!entries.length) { try { entries = await searchYoutube(q); } catch (e) { entries = []; } }
    entries = entries.slice(0, 5);
    c.prog?.set(60);
    if (!entries.length) return c.reply('❌ لا توجد نتائج لهذا البحث.');
    const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
    const lines = entries.map((e, i) => `*${i + 1}.* ${e.title}\n> ⏱️ ${dur(e.duration)} | 👤 ${e.channel || e.uploader || ''}\n> 🔗 ${e.url || 'https://youtu.be/' + e.id}`);
    await c.reply(`🔎 *نتائج البحث عن (${q}):*\n\n${lines.join('\n\n')}\n\n💡 للتنزيل: \`.يوتيوب <الرابط>\` أو \`.صوت <الرابط>\``);
}

// ---- ايدت: 3 مقاطع (ايديتات) من تيك توك للشخصية
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tikAbs = (u) => (u && u.startsWith('/') ? 'https://www.tikwm.com' + u : u);
const TIK_PAGE_RE = /tiktok\.com\/@([\w.\-]+)\/video\/(\d{15,22})/i;
const logErr = (tag, e) => console.error(`[${tag}]`, String(e?.message || e).slice(0, 160));

// يحوّل أي رد JSON من واجهات البحث المختلفة إلى قائمة موحّدة {id, title, author, duration, plays[], page}
function normalizeTikItems(json) {
    const out = [];
    const PLAY_KEYS = ['hdplay', 'play', 'nowm', 'no_watermark', 'nowatermark', 'video', 'video_url', 'videoUrl', 'download', 'dl', 'url'];
    (function walk(o, depth) {
        if (!o || typeof o !== 'object' || depth > 7 || out.length >= 60) return;
        if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
        const plays = [];
        let page = null;
        for (const k of PLAY_KEYS) {
            const v = o[k];
            if (typeof v !== 'string') continue;
            if (TIK_PAGE_RE.test(v)) { page = page || v; continue; }
            const u = tikAbs(v);
            if (/^https?:\/\//.test(u) && /(\.mp4|tikwm|tiktokcdn|tiktokv|byteoversea|musical|video)/i.test(u)) plays.push(u);
        }
        for (const v of Object.values(o)) if (!page && typeof v === 'string' && TIK_PAGE_RE.test(v)) page = TIK_PAGE_RE.exec(v)[0].replace(/^/, 'https://www.');
        if (plays.length || page) {
            const author = o.author && typeof o.author === 'object' ? (o.author.nickname || o.author.unique_id || '') : (o.author || o.nickname || o.username || '');
            out.push({
                id: String(o.video_id || o.aweme_id || o.id || (page && TIK_PAGE_RE.exec(page)?.[2]) || plays[0]),
                title: String(o.title || o.desc || o.description || ''), author: String(author || ''),
                duration: Number(o.duration) || 0, plays: [...new Set(plays)], page, plays_count: Number(o.play_count || o.digg_count || 0) || 0
            });
            return;
        }
        for (const v of Object.values(o)) walk(v, depth + 1);
    })(json, 0);
    return out;
}

// طابور عام لطلبات tikwm: لا يتجاوز طلباً كل 1.3 ثانية (حدّ الخدمة المجانية) حتى لا يتعطل البحث في المرة الثانية
let tikwmChain = Promise.resolve();
let tikwmLast = 0;
function tikwmSlot() {
    const p = tikwmChain.then(async () => {
        const w = tikwmLast + 1300 - Date.now();
        if (w > 0) await sleep(w);
        tikwmLast = Date.now();
    });
    tikwmChain = p.catch(() => {});
    return p;
}

async function tikwmSearch(host, q) {
    const body = new URLSearchParams({ keywords: q, count: '20', cursor: '0', web: '1', hd: '1' });
    for (let i = 0; i < 4; i++) {
        await tikwmSlot();
        let j = null;
        try {
            const res = await http(`https://${host}/api/feed/search`, {
                method: 'POST', body, timeout: 15000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Referer': `https://${host}/` }
            });
            j = await res.json().catch(() => null);
        } catch (e) { logErr('tikwm', e); await sleep(800); continue; }
        if (j?.code === 0 && Array.isArray(j?.data?.videos)) return normalizeTikItems(j.data.videos);
        if (/limit/i.test(String(j?.msg || ''))) { await sleep(700 * (i + 1)); continue; }   // حد الطلبات: ننتظر ونعيد
        break;
    }
    return [];
}

// روابط تيك توك عبر محركات البحث العامة (احتياط)
async function tiktokLinksViaWeb(q) {
    const links = [];
    const add = (u) => { const m = TIK_PAGE_RE.exec(u || ''); if (m) { const l = `https://www.tiktok.com/@${m[1]}/video/${m[2]}`; if (!links.includes(l)) links.push(l); } };
    try {
        const r = await http('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(`site:tiktok.com ${q}`), { timeout: 20000 });
        const html = await r.text();
        for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)) {
            let href = decodeHtml(m[1]);
            const u = /uddg=([^&]+)/.exec(href);
            if (u) href = decodeURIComponent(u[1]);
            add(href);
        }
    } catch (e) { logErr('ddg', e); }
    if (links.length < 4) {
        try {
            const r = await http('https://www.bing.com/search?setlang=en&q=' + encodeURIComponent(`site:tiktok.com/@ "${q}" video`), { timeout: 20000, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
            const html = (await r.text()).replace(/&#8250;|&rsaquo;|›/g, '/').replace(/\s+/g, '');
            for (const m of html.matchAll(/tiktok\.com\/@([\w.\-]+)\/video\/(\d{15,22})/g)) add(m[0]);
            const raw = await (await http('https://www.bing.com/search?setlang=en&q=' + encodeURIComponent(`site:tiktok.com/@ "${q}" video`), { timeout: 20000 })).text();
            for (const m of raw.matchAll(/[?&]u=a1([A-Za-z0-9_\-]+)/g)) {
                try { add(Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) {}
            }
        } catch (e) { logErr('bing', e); }
    }
    return links.slice(0, 10).map((page) => ({ id: TIK_PAGE_RE.exec(page)[2], title: '', author: TIK_PAGE_RE.exec(page)[1], duration: 0, plays: [], page, plays_count: 0 }));
}

// بحث تيك توك: يجرّب عدة خدمات بالترتيب حتى تعطي نتائج
const TIK_SEARCH_CACHE = new Map();
async function tiktokSearchAny(q, fresh) {
    const hit = TIK_SEARCH_CACHE.get(q);
    if (!fresh && hit && Date.now() - hit.t < 30 * 60 * 1000) return hit.r;
    const r = await tiktokSearchRaw(q);
    if (r.length) TIK_SEARCH_CACHE.set(q, { t: Date.now(), r });
    return r;
}
async function tiktokSearchRaw(q) {
    const backends = [
        ['tikwm', () => tikwmSearch('www.tikwm.com', q)],
        ['tikwm2', () => tikwmSearch('tikwm.com', q)],
        ...[
            `https://api.siputzx.my.id/api/s/tiktok?query=${encodeURIComponent(q)}`,
            `https://api.ryzendesu.vip/api/search/tiktok?query=${encodeURIComponent(q)}`,
            `https://api.vreden.my.id/api/ttsearch?query=${encodeURIComponent(q)}`,
            `https://api.agatz.xyz/api/tiktoksearch?message=${encodeURIComponent(q)}`
        ].map((u) => [hostOf(u), async () => normalizeTikItems(await httpJson(u, { timeout: 15000 }))])
    ];
    for (const [name, fn] of backends) {
        try { const r = await fn(); if (r.length) return r; } catch (e) { logErr('بحث تيك:' + name, e); }
    }
    return [];
}

// يجهّز مقطعاً واحداً (بدون إرساله): روابط التشغيل المباشرة أولاً ثم صفحة المقطع (tikwm ثم yt-dlp)
// يرجع محتوى رسالة فيديو جاهزاً {video, mimetype, caption, jpegThumbnail} أو null
async function prepareTikVideo(c, buf, cap) {
    if (!buf || buf.length < 500) return null;
    let r;
    try { r = await makeWhatsAppMp4(buf); } catch (e) { return null; }
    if (!r) return null;
    if (r.unchecked) return { video: buf, mimetype: 'video/mp4', caption: cap };
    return { video: r.buf, mimetype: 'video/mp4', caption: cap, ...(r.thumb ? { jpegThumbnail: r.thumb } : {}) };
}
async function prepareTikCandidate(c, cand, cap) {
    for (const u of cand.plays) {
        try {
            const { buf, type } = await httpBuffer(u, MAX_DL);
            if (/^(text\/|application\/json)/.test(type)) continue;
            const it = await prepareTikVideo(c, buf, cap);
            if (it) return it;
        } catch (e) { logErr('ايدت-تشغيل', e); }
    }
    if (cand.page) {
        try {
            await tikwmSlot();
            const j = await httpJson('https://www.tikwm.com/api/?hd=1&url=' + encodeURIComponent(cand.page), { timeout: 30000 });
            const d = j?.data; const vu = tikAbs(d?.hdplay || d?.play);
            if (j?.code === 0 && vu && !(d.images && d.images.length)) {
                const { buf, type } = await httpBuffer(vu, MAX_DL);
                if (!/^(text\/|application\/json)/.test(type)) { const it = await prepareTikVideo(c, buf, cap); if (it) return it; }
            }
        } catch (e) { logErr('ايدت-tikwm', e); }
        let files = [];
        try {
            files = await ytdlpDownload(cand.page, {});
            const it = await prepareTikVideo(c, fs.readFileSync(files[0]), cap);
            if (it) return it;
        } catch (e) { logErr('ايدت-ytdlp', e); }
        finally { rm(...files); }
    }
    return null;
}

// يرسل عدة فيديوهات كألبوم واحد متجاور (مثل بوت صديقك): رسالة ألبوم ثم كل فيديو مرتبط بها
async function sendVideoAlbum(c, items) {
    const B = BaileysNs.default?.generateWAMessage ? BaileysNs.default : BaileysNs;
    const sock = c.sock, jid = c.from;
    try {
        const album = B.generateWAMessageFromContent(jid, { albumMessage: { expectedImageCount: 0, expectedVideoCount: items.length } }, { userJid: sock.user.id, quoted: c.msg });
        await sock.relayMessage(jid, album.message, { messageId: album.key.id });
        for (const it of items) {
            const m = await B.generateWAMessage(jid, it, { upload: sock.waUploadToServer, userJid: sock.user.id });
            m.message.messageContextInfo = { ...(m.message.messageContextInfo || {}), messageAssociation: { associationType: 1, parentMessageKey: album.key } };
            await sock.relayMessage(jid, m.message, { messageId: m.key.id });
        }
        return true;
    } catch (e) { logErr('ايدت-ألبوم', e); return false; }
}

async function cmdEdit(c) {
    const name = c.args.trim() || quotedText(c).trim();
    if (!name) return c.reply('📌 اكتب اسم الشخصية بعد الأمر، مثال: `.ايدت ايرين` أو `.ايدت غوجو`');
    const en = (await toEnglishName(name)).trim();
    const tokens = nameTokens(en, name);
    const queries = [...new Set([`${en} edit`, `${en} edit tiktok`, `${en} amv edit`, `${en} edits 4k`, `${en} capcut edit`, hasArabic(name) ? `${name} ايدت` : ''].filter(Boolean))];

    const rel = (v) => {
        const t = `${v.title} ${v.author}`.toLowerCase();
        let sc = tokens.some((x) => t.includes(x)) ? 0 : 2;
        if (v.duration && (v.duration > 120 || v.duration < 4)) sc += 3;
        return sc;
    };
    const tried = new Set();
    const ready = [];   // الفيديوهات الجاهزة للإرسال دفعة واحدة

    // جولتان على الأكثر: إذا تعطّلت الأولى (حد طلبات/خدمة بطيئة) ننتظر قليلاً ونعيد بدون كاش
    for (let round = 0; round < 2 && ready.length < 3; round++) {
        if (round) await sleep(3000);

        // 1) نجمع مرشّحين من البحث
        let cands = [];
        const seen = new Set(tried);
        let misses = 0;
        for (let i = 0; i < queries.length && cands.length < 14 && misses < 3; i++) {
            const found = await tiktokSearchAny(queries[i], round > 0);
            if (!found.length) misses++;
            for (const v of found) {
                const key = v.id || v.page || v.plays[0];
                if (seen.has(key)) continue;
                seen.add(key); cands.push(v);
            }
        }
        if (cands.length < 3) {
            try { for (const v of await tiktokLinksViaWeb(`${en} edit`)) { const k = v.id; if (!seen.has(k)) { seen.add(k); cands.push(v); } } } catch (e) { logErr('ويب', e); }
        }
        // 2) الأنسب أولاً: العنوان يحوي اسم الشخصية + مدة معقولة
        cands = cands.map((v, i) => ({ v, i })).sort((a, b) => rel(a.v) - rel(b.v) || a.i - b.i).map((x) => x.v);

        // 3) نرسل 3 مقاطع، ونتجاوز أي مقطع يفشل
        for (const v of cands) {
            if (ready.length >= 3) break;
            tried.add(v.id || v.page || v.plays[0]);
            const cap = `🎞️ ايدت ${name} (${ready.length + 1}/3)\n👤 ${v.author || ''}`.trim();
            const item = await prepareTikCandidate(c, v, cap);
            if (item) ready.push(item);
            c.prog?.set(10 + ready.length * 25);
        }
    }
    if (ready.length) {
        c.prog?.set(90);
        if (ready.length >= 2 && await sendVideoAlbum(c, ready)) return;
        for (const it of ready) await c.media(it);   // احتياط: إن تعذر الألبوم أو وُجد مقطع واحد فقط
        return;
    }
    {
        console.error(`ايدت: لا نتائج لـ (${name}) | الإنجليزي: ${en} | جرّبنا: ${tried.size}`);
        return c.reply(`❌ لم أجد ايديتات لـ (${name}).\nجرّب كتابة الاسم بالإنجليزية أو بشكل آخر.`);
    }
}

// ---- فويس: يجلب الصوت حسب الاسم (يوتيوب ثم ساوند كلاود) ويرسله كرسالة صوتية
async function searchAudioEntries(bin, prefix, q) {
    const out = await run(bin, ['--no-warnings', '--flat-playlist', '-J', ...cookiesArgs(), `${prefix}6:${q}`], 60000);
    return (JSON.parse(out.stdout).entries || []).filter((e) => e && (e.url || e.id) && (!e.duration || e.duration <= 900));
}
const entryUrl = (e, prefix) => {
    if (e.webpage_url) return e.webpage_url;
    if (/^https?:\/\//.test(e.url || '')) return e.url;
    return prefix === 'ytsearch' ? 'https://www.youtube.com/watch?v=' + (e.id || e.url) : (e.url || '');
};
async function toVoiceOgg(file) {
    const out = path.join(TMP, `vo_${uid()}.ogg`);
    try {
        await run(FFMPEG, ['-y', '-v', 'error', '-i', file, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', '-ar', '48000', '-f', 'ogg', out], 120000);
        return fs.readFileSync(out);
    } finally { rm(out); }
}

async function cmdVoice(c) {
    const q = c.args.trim() || quotedText(c).trim();
    if (!q) return c.reply('📌 اكتب اسم الأغنية أو الصوت بعد الأمر، مثال: `.فويس اغنية حماسية` أو `.فويس <رابط>`');
    let files = null, apiBuf = null, title = '';
    const pp = (p) => c.prog?.set(8 + p * 0.6);
    const direct = URL_RE.exec(q);
    if (direct) {
        try { files = await ytdlpDownload(direct[0], { audio: true, onProgress: pp }); }
        catch (e) {
            try { const a = await apiFetchMedia(direct[0], 'audio'); if (a) apiBuf = a.buf; } catch (e2) {}
            if (!apiBuf) return c.reply(friendlyDlError(e));
        }
    } else {
        let bin = null;
        try { bin = await getYtDlp(); } catch (e) { bin = null; }
        if (bin) {
            for (const prefix of ['ytsearch', 'scsearch']) {
                try {
                    const entries = await searchAudioEntries(bin, prefix, q);
                    for (const e of entries.slice(0, 3)) {
                        const u = entryUrl(e, prefix);
                        if (!u) continue;
                        try { files = await ytdlpDownload(u, { audio: true, onProgress: pp }); title = e.title || ''; break; } catch (err) { /* التالي */ }
                    }
                } catch (err) { /* المصدر التالي */ }
                if (files) break;
            }
        }
        if (!files) {
            let entries = [];
            try { entries = (await searchYoutube(q)).filter((e) => !e.duration || e.duration <= 900); } catch (e) {}
            for (const e of entries.slice(0, 3)) {
                try { const a = await apiFetchMedia('https://www.youtube.com/watch?v=' + e.id, 'audio'); if (a) { apiBuf = a.buf; title = e.title || ''; break; } } catch (err) {}
            }
        }
    }
    if (!(files && files.length) && !apiBuf) return c.reply('❌ لم أستطع جلب فويس لهذا الطلب. جرّب اسماً أدق أو اسم الفنان مع الأغنية.');
    c.prog?.set(85);
    const src = files && files.length ? files[0] : path.join(TMP, `vi_${uid()}.bin`);
    try {
        if (!(files && files.length)) fs.writeFileSync(src, apiBuf);
        let ogg = null;
        try { ogg = await toVoiceOgg(src); } catch (e) { ogg = null; }
        if (title) await c.reply(`🎙️ ${title}`);
        if (ogg && ogg.length > 1000) await c.media({ audio: ogg, mimetype: 'audio/ogg; codecs=opus', ptt: true });
        else await sendBuffer(c, fs.readFileSync(src), 'mp3');
    } finally { rm(src, ...(files || [])); }
}

// ---------------------------------------------------------------- الذكاء الاصطناعي
const SYSTEM = 'أنت مساعد ذكي ودود داخل بوت واتساب اسمه Eren Bot. أجب بلغة المستخدم (العربية غالباً) بوضوح واختصار ودقة، ولا تخترع معلومات. استخدم تنسيق واتساب البسيط عند الحاجة.';
const memory = new Map();   // المرسل -> { t, msgs }
const MEM_TTL = 20 * 60 * 1000;

function aiEndpoint() {
    const base = (process.env.AI_API_URL || '').replace(/\/+$/, '');
    if (process.env.AI_API_KEY) return { url: (base || 'https://api.openai.com/v1') + '/chat/completions', key: process.env.AI_API_KEY, model: process.env.AI_MODEL || 'gpt-4o-mini' };
    return { url: base ? base + '/chat/completions' : 'https://text.pollinations.ai/openai', key: '', model: process.env.AI_MODEL || 'openai' };
}
async function aiChat(messages) {
    const ep = aiEndpoint();
    const res = await http(ep.url, {
        method: 'POST', timeout: 90000,
        headers: { 'Content-Type': 'application/json', ...(ep.key ? { Authorization: 'Bearer ' + ep.key } : {}) },
        body: JSON.stringify({ model: ep.model, messages, temperature: 0.7 })
    });
    if (!res.ok) throw new Error('AI_HTTP_' + res.status);
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content;
    if (!out) throw new Error('AI_EMPTY');
    return String(out).trim();
}
const AI_FAIL = '❌ خدمة الذكاء الاصطناعي لا تستجيب الآن. حاول لاحقاً.\n💡 للمطور: أضف AI_API_KEY في متغيرات الخادم لثبات أفضل.';
const clip = (s, n = 6000) => (s.length > n ? s.slice(0, n) + '\n…(تم اختصار الرد)' : s);

async function askAI(c, system, userText, { remember = false } = {}) {
    const key = c.sender;
    let hist = [];
    if (remember) {
        const m = memory.get(key);
        if (m && Date.now() - m.t < MEM_TTL) hist = m.msgs;
    }
    const messages = [{ role: 'system', content: system }, ...hist, { role: 'user', content: userText }];
    const answer = await aiChat(messages);
    if (remember) memory.set(key, { t: Date.now(), msgs: [...hist, { role: 'user', content: userText }, { role: 'assistant', content: answer }].slice(-8) });
    return answer;
}
const argOrQuoted = (c) => c.args || quotedText(c);

async function cmdAsk(c) {
    const q = argOrQuoted(c);
    if (!q) return c.reply('📌 اكتب سؤالك بعد الأمر، مثال: `.اسأل ما هي عاصمة اليابان؟`');
    await c.reply(clip(await askAI(c, SYSTEM, q, { remember: true })));
}
async function cmdSimpleAI(c, system, usage) {
    const q = argOrQuoted(c);
    if (!q) return c.reply(usage);
    await c.reply(clip(await askAI(c, system, q)));
}

const LANGS = {
    'عربي': 'ar', 'العربية': 'ar', 'انجليزي': 'en', 'إنجليزي': 'en', 'انكليزي': 'en', 'فرنسي': 'fr', 'تركي': 'tr', 'اسباني': 'es', 'إسباني': 'es',
    'الماني': 'de', 'ألماني': 'de', 'روسي': 'ru', 'ياباني': 'ja', 'كوري': 'ko', 'صيني': 'zh-CN', 'ايطالي': 'it', 'إيطالي': 'it', 'هندي': 'hi',
    'فارسي': 'fa', 'اردو': 'ur', 'أردو': 'ur', 'برتغالي': 'pt', 'هولندي': 'nl', 'عبري': 'iw', 'اندونيسي': 'id'
};
async function gtranslate(text, tl) {
    const j = await httpJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`, { timeout: 20000 });
    return { text: (j[0] || []).map((x) => x[0]).join(''), from: j[2] };
}
async function cmdTranslate(c) {
    let text = c.args;
    let tl = null;
    const words = text.split(/\s+/);
    const first = (words[0] || '').toLowerCase();
    const langKey = Object.keys(LANGS).find((k) => norm(k) === norm(first));
    if (langKey) { tl = LANGS[langKey]; text = words.slice(1).join(' '); }
    else if (/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(first) && words.length > 1) { tl = first; text = words.slice(1).join(' '); }
    if (!text) text = quotedText(c);
    if (!text) return c.reply('📌 مثال: `.ترجمة انجليزي مرحبا بك` أو رد على رسالة بـ `.ترجمة`');
    if (text.length > 3000) return c.reply('⚠️ النص طويل (الحد 3000 حرف).');
    let r;
    try {
        r = await gtranslate(text, tl || 'ar');
        if (!tl && (r.from || '').startsWith('ar')) r = await gtranslate(text, 'en');
    } catch (e) { return c.reply('❌ خدمة الترجمة لا تستجيب الآن. حاول لاحقاً.'); }
    await c.reply(`🌐 *الترجمة:*\n\n${r.text}`);
}

async function cmdImagine(c) {
    let prompt = argOrQuoted(c);
    if (!prompt) return c.reply('📌 اكتب وصف الصورة، مثال: `.تخيل قلعة على جبل وقت الغروب`');
    if (/[\u0600-\u06FF]/.test(prompt)) { try { prompt = (await gtranslate(prompt, 'en')).text || prompt; } catch (e) {} }
    await c.reply('🎨 جاري توليد الصورة، انتظر قليلاً...');
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
    let out;
    try { out = await httpBuffer(url, 15 * 1024 * 1024, { timeout: 120000 }); } catch (e) { return c.reply('❌ تعذر توليد الصورة الآن. جرّب وصفاً آخر أو حاول لاحقاً.'); }
    if (!out.type.startsWith('image/')) return c.reply('❌ تعذر توليد الصورة الآن.');
    await c.media({ image: out.buf, caption: `🎨 *${prompt.slice(0, 200)}*` });
}

async function cmdSummarize(c) {
    let src = c.args || quotedText(c);
    if (!src) return c.reply('📌 ضع النص بعد الأمر أو رد على رسالة طويلة، أو اكتب رابط مقال.');
    const m = URL_RE.exec(src);
    if (m && src.trim().length < m[0].length + 20) {
        try {
            const r = await http(m[0], { timeout: 25000 });
            const html = await r.text();
            src = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        } catch (e) { return c.reply('❌ تعذر قراءة الرابط.'); }
    }
    if (src.length < 80) return c.reply('📌 النص قصير جداً للتلخيص.');
    const out = await askAI(c, SYSTEM + ' لخّص النص التالي بنقاط واضحة ومختصرة مع أهم الأفكار فقط.', src.slice(0, 12000));
    await c.reply(clip(`📝 *الملخص:*\n\n${out}`));
}

// ---------------------------------------------------------------- الموزّع
const COOLDOWN = new Map();
const HEAVY = new Set(['تيك', 'انستا', 'فيس', 'يوتيوب', 'صوت', 'فيديو', 'صورة', 'بنترست', 'تويتر', 'سناب', 'ثريدز', 'تلي', 'بحث', 'ميديا',
    'اسأل', 'تخيل', 'تلخيص', 'ترجمة', 'صحح', 'شرح', 'اكتب', 'كود', 'حزمة', 'لرابط', 'ايدت', 'فويس']);
let running = 0;
// أوامر فيها تحميل/تحضير: يظهر لها عدّاد تقدم حي حتى يجهز الطلب
const PROGRESS = new Set(['تيك', 'انستا', 'فيس', 'يوتيوب', 'صوت', 'فيديو', 'صورة', 'بنترست', 'تويتر', 'سناب', 'ثريدز', 'تلي', 'بحث', 'ميديا', 'ايدت', 'فويس', 'حزمة', 'تخيل']);

async function sendSection(c, text) {
    let pp;
    try { pp = await c.getUserProfilePic(c.sock, c.sender); } catch (e) {}
    if (await sendSectionWithButtons(c.sock, c.from, text, pp, c.sender)) return;
    try { await c.sock.sendMessage(c.from, { image: { url: pp }, caption: text, mentions: [c.sender] }); }
    catch (e) { await c.sock.sendMessage(c.from, { text, mentions: [c.sender] }); }
}

const DL_SIMPLE = { 'تيك': cmdTikTok, 'تويتر': cmdTwitter, 'تلي': cmdTelegram };
const HANDLERS = {
    'ملصقات': (c) => sendSection(c, STICKER_SECTION), 'تحميل': (c) => sendSection(c, DOWNLOAD_SECTION), 'ذكاء': (c) => sendSection(c, AI_SECTION),
    'ملصق': (c) => cmdSticker(c, 'ملصق'), 'متحرك': (c) => cmdSticker(c, 'متحرك'), 'دائري': (c) => cmdSticker(c, 'دائري'), 'طويل': (c) => cmdSticker(c, 'طويل'),
    'سرقة': cmdSteal, 'لصورة': cmdToImage, 'لرابط': cmdToLink, 'ايموجي': cmdEmoji, 'كتابة': cmdText, 'حزمة': cmdPack, 'لفيديو': cmdToVideo,
    'إطار': (c) => cmdImageEdit(c, 'إطار'), 'قص': (c) => cmdImageEdit(c, 'قص'), 'عكس': (c) => cmdImageEdit(c, 'عكس'),
    'تدوير': (c) => cmdImageEdit(c, 'تدوير'), 'رمادي': (c) => cmdImageEdit(c, 'رمادي'),
    'رابط': cmdLinkInfo, 'بحث': cmdSearch, 'ايدت': cmdEdit, 'فويس': cmdVoice,
    'اسأل': cmdAsk, 'تخيل': cmdImagine, 'تلخيص': cmdSummarize, 'ترجمة': cmdTranslate,
    'صحح': (c) => cmdSimpleAI(c, SYSTEM + ' صحّح الإملاء والنحو في النص التالي وأعد النص المصحّح فقط ثم سطراً قصيراً بأهم التعديلات.', '📌 اكتب النص المراد تصحيحه بعد الأمر.'),
    'شرح': (c) => cmdSimpleAI(c, SYSTEM + ' اشرح الموضوع التالي بأسلوب مبسّط مع مثال قصير.', '📌 مثال: `.شرح الذكاء الاصطناعي`'),
    'اكتب': (c) => cmdSimpleAI(c, SYSTEM + ' اكتب النص المطلوب (منشور/رسالة/قصيدة/إعلان...) بأسلوب جميل جاهز للنشر.', '📌 مثال: `.اكتب منشور ترحيب بأعضاء الجروب`'),
    'كود': (c) => cmdSimpleAI(c, SYSTEM + ' أنت مبرمج خبير. أجب بكود صحيح داخل كتل مع شرح مختصر.', '📌 مثال: `.كود دالة جافاسكربت لعكس نص`'),
    'نسيان': async (c) => { memory.delete(c.sender); await c.reply('🧹 تم مسح ذاكرة محادثتك مع الذكاء الاصطناعي.'); }
};
for (const n of ['تيك', 'تويتر', 'تلي']) HANDLERS[n] = async (c) => { const u = getUrl(c); if (!u) return c.reply(NEED_URL); await DL_SIMPLE[n](c, u); };
const YTDLP_CMDS = { 'انستا': { many: true }, 'فيس': {}, 'بنترست': {}, 'سناب': {}, 'ثريدز': { many: true }, 'يوتيوب': {} };
for (const [n, o] of Object.entries(YTDLP_CMDS)) {
    HANDLERS[n] = async (c) => {
        const u = getUrl(c); if (!u) return c.reply(NEED_URL);
        const wantAudio = n === 'يوتيوب' && /(^|\s)(صوت|mp3|audio)(\s|$)/i.test(c.args);
        try { await viaYtdlp(c, u, { ...o, audio: wantAudio }); }
        catch (e) {
            if (['بنترست', 'سناب', 'ثريدز', 'انستا'].includes(n)) { try { return await ogDownload(c, u); } catch (e2) {} }
            throw e;
        }
    };
}
HANDLERS['صوت'] = async (c) => { const u = getUrl(c); if (!u) return c.reply(NEED_URL); await viaYtdlp(c, u, { audio: true }); };
HANDLERS['فيديو'] = async (c) => {
    const u = getUrl(c);
    if (!u) {
        const t = getTarget(c, ['stickerMessage']);
        if (t) return stickerToVideo(c, t);
        return c.reply(NEED_URL + '\n🎞️ أو رد على ملصق بالأمر `.فيديو` لتحويله إلى فيديو.');
    }
    const info = await probe(u);
    if (info && info.type.startsWith('video/')) return sendUrlMedia(c, u, '', 'mp4');
    await cmdMedia(c, u);
};
HANDLERS['صورة'] = async (c) => {
    const u = getUrl(c); if (!u) return c.reply(NEED_URL);
    const info = await probe(u);
    if (info && info.type.startsWith('image/')) return sendUrlMedia(c, u);
    await ogDownload(c, u);
};
HANDLERS['ميديا'] = async (c) => { const u = getUrl(c); if (!u) return c.reply(NEED_URL); await cmdMedia(c, u); };

export async function handleFeatureCommand(ctx) {
    const name = CANON[ctx.cmdBase];
    if (!name) return false;
    const args = ctx.trimmedBody.replace(/^\.\S+\s*/, '').trim();
    // «.كتابة» وحدها = لعبة سرعة الكتابة الأصلية، ومعها نص = ملصق نصي
    if (name === 'كتابة' && ctx.cmdBase === 'كتابة' && !args) return false;

    const { sock, msg, from } = ctx;
    const c = {
        ...ctx, args,
        reply: (text, mentions) => sock.sendMessage(from, { text, ...(mentions ? { mentions } : {}) }, { quoted: msg }),
        media: (content) => sock.sendMessage(from, content, { quoted: msg })
    };

    if (HEAVY.has(name)) {
        const last = COOLDOWN.get(ctx.sender) || 0;
        if (Date.now() - last < 4000) { await c.reply('⏳ انتظر بضع ثوانٍ قبل الأمر التالي.'); return true; }
        COOLDOWN.set(ctx.sender, Date.now());
    }

    const handler = HANDLERS[name];
    if (!handler) return false;
    running++;
    try {
        if (PROGRESS.has(name) && (args || URL_RE.test(quotedText(c)))) {
            try { c.prog = await makeProgress(c, 'جاري تجهيز طلبك').start(); } catch (e) { c.prog = null; }
        }
        await handler(c);
        if (c.prog) await c.prog.finish(true);
    } catch (e) {
        if (c.prog) { try { await c.prog.finish(false); } catch (e3) {} }
        console.error(`خطأ في الأمر ${name}:`, e?.message || e);
        let text = e?.friendly || '❌ تعذر تنفيذ الأمر. تأكد من المدخلات وحاول مرة أخرى.';
        if (/^AI_/.test(e?.message || '')) text = AI_FAIL;
        try { await c.reply(text); } catch (e2) {}
    } finally { running--; }
    return true;
}

