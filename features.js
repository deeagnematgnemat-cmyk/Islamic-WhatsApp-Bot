// ============ features.js : الملصقات + التنزيل + الذكاء الاصطناعي ============
import fs from 'fs';
import os from 'os';
import path from 'path';
import pino from 'pino';
import { execFile, spawn } from 'child_process';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { sendSectionWithButtons, sendPackCard } from './menu.js';

const PACK = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
const AUTHOR = 'Eren Bot';
const TMP = os.tmpdir();
const FFMPEG = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg');
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const MAX_DL = 100 * 1024 * 1024;       // أقصى حجم للتنزيل
const MAX_AS_MEDIA = 60 * 1024 * 1024;  // أكبر من هذا يُرسل كمستند

// إعدادات الذكاء الاصطناعي (اختيارية): متغيرات البيئة في Railway
//   AI_API_KEY  مفتاح خدمة متوافقة مع OpenAI (OpenAI / Groq / OpenRouter / Gemini ...)
//   AI_API_URL  الرابط الأساسي (الافتراضي https://api.openai.com/v1)
//   AI_MODEL    اسم النموذج (الافتراضي gpt-4o-mini)
// بدون مفتاح يستخدم خدمة مجانية بدون مفتاح (pollinations) وقد تكون أبطأ وأقل ثباتاً.

const norm = (s) => s.replace(/[أإآا]/g, 'ا');

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
    const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(opts.timeout || 30000),
        ...opts,
        headers: { 'User-Agent': UA, ...(opts.headers || {}) }
    });
    return res;
}
async function httpJson(url, opts) {
    const res = await http(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
}
async function httpBuffer(url, max = MAX_DL, opts = {}) {
    const res = await http(url, { timeout: 120000, ...opts });
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
async function stickerlyPacks(q) {
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
            if (title) packs.push({ title, author: '', count: cnt ? cnt[1] : null, link, thumbs: [], icon: mt['og:image'] || null });
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
async function cmdPack(c) {
    const q = c.args.trim();
    if (!q) return c.reply('📌 مثال: `.حزمة ناروتو` أو `.حزمة ايرين`');
    let packs = [];
    try { packs = await stickerlyPacks(q); } catch (e) { packs = []; }
    if (!packs.length) { try { packs = await legacyPacks(q); } catch (e) { packs = []; } }
    if (!packs.length) return c.reply(`❌ لم أعثر على حزمة ملصقات مناسبة لـ (${q}).\nجرّب اسماً آخر أو بالإنجليزية.`);
    // الأفضلية: إرسال ملصقات الحزمة الفعلية مباشرة في المحادثة
    const direct = packs.find((p) => p.urls && p.urls.length);
    if (direct) {
        if (PACK_BUSY.has(c.from)) return c.reply('⏳ توجد حزمة قيد الإرسال في هذه المحادثة، انتظر حتى تنتهي.');
        PACK_BUSY.add(c.from);
        try {
            const urls = direct.urls.slice(0, 30);
            await c.reply(`╭━━━〔 📦 〕━━━╮\n『 ${direct.title} 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n〔 ✅ 〕 تم تجهيز ${urls.length} ملصق\n〔 📤 〕 جاري إرسال الحزمة...`);
            let sent = 0;
            for (const u of urls) {
                try {
                    const { buf } = await httpBuffer(u, 2 * 1024 * 1024);
                    await c.sock.sendMessage(c.from, { sticker: buf });
                    sent++;
                    c.prog?.set(8 + 90 * sent / urls.length);
                } catch (e) { /* تجاهل الملصق الفاشل */ }
                await new Promise((r) => setTimeout(r, 700));
            }
            if (!sent) return c.reply('❌ تعذر تحميل ملصقات هذه الحزمة، جرّب اسماً آخر.');
            return c.reply(`✅ تم إرسال ${sent} ملصق من حزمة (${direct.title}).`);
        } finally { PACK_BUSY.delete(c.from); }
    }
    for (const p of packs.slice(0, 2)) {
        const text = `📦 *${p.title}*\n🎴 ${p.count ? p.count + ' ملصقاً' : 'عدد الملصقات غير معروف'}${p.author ? `\n✍️ ${p.author}` : ''}\n\n💡 اضغط «عرض مجموعة الملصقات» ثم «Add to WhatsApp» لإضافة الحزمة كاملة.`;
        let image = null;
        try { image = await packCollage(p.thumbs); } catch (e) {}
        if (!image) image = p.icon || p.thumbs?.[0] || null;
        try {
            await sendPackCard(c.sock, c.from, { image, text, url: p.link, mentionJid: c.sender });
        } catch (e) {
            const caption = `${text}\n🔗 ${p.link}`;
            try { await c.media(image ? (Buffer.isBuffer(image) ? { image, caption } : { image: { url: image }, caption }) : { text: caption }); } catch (e2) { await c.reply(caption); }
        }
    }
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
    if (n === 'انستا') return ['https://api.siputzx.my.id/api/d/igdl?url=', 'https://api.ryzendesu.vip/api/downloader/igdl?url='];
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
                const r = await httpBuffer(cnd.url, MAX_DL, { timeout: 120000 });
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
    const args = ['--no-warnings', '--newline', '--progress', '--progress-template', 'download:dlprog:%(progress._percent_str)s', '--restrict-filenames', '--max-filesize', '100M',
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
        try { await runProgress(bin, [...args, ...extra, url], 300000, onProgress); }
        catch (e) {
            clean();
            if (extra.includes('--js-runtimes') && /no such option|unrecognized arguments/i.test(e.stderr || '')) {
                try { await runProgress(bin, [...args, ...stripJs(extra), url], 300000, onProgress); return; }
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
        yuv420: /yuv420p/.test(txt)
    };
}
const badMedia = () => Object.assign(new Error('BAD_MEDIA'), { friendly: '❌ الملف الذي تم تنزيله تالف أو غير صالح، جرّب رابطاً آخر.' });
// يحوّل الفيديو إلى mp4 (H.264 + AAC) ليعمل صوته وصورته في واتساب دائماً
async function makeWhatsAppMp4(buf) {
    const id = uid();
    const inp = path.join(TMP, `mi_${id}.bin`), out = path.join(TMP, `mo_${id}.mp4`);
    try {
        fs.writeFileSync(inp, buf);
        const k = await mediaCodecs(inp);
        if (k.missing) return buf;
        if (!k.video) throw badMedia();
        const okV = k.video === 'h264' && k.yuv420, okA = !k.audio || k.audio === 'aac';
        if (okV && okA) return buf;
        const vArgs = okV ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'];
        await run(FFMPEG, ['-y', '-v', 'error', '-i', inp, '-map', '0:v:0', '-map', '0:a:0?', ...vArgs, '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', out], 240000);
        const o = fs.readFileSync(out);
        return o.length ? o : buf;
    } catch (e) { if (e.message === 'BAD_MEDIA') throw e; return buf; }
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
        if (buf.length <= MAX_AS_MEDIA) buf = await makeWhatsAppMp4(buf);
        return c.media({ video: buf, mimetype: 'video/mp4', caption });
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
        throw Object.assign(e, { friendly: e.friendly || friendlyDlError(e) });
    }
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

async function tiktokSearchVideos(q) {
    const body = new URLSearchParams({ keywords: q, count: '20', cursor: '0', web: '1', hd: '1' });
    const j = await httpJson('https://www.tikwm.com/api/feed/search', {
        method: 'POST', body, timeout: 30000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    });
    return (j?.code === 0 && Array.isArray(j?.data?.videos)) ? j.data.videos : [];
}

// احتياط: بحث عام عن روابط تيك توك ثم جلب كل رابط
async function tiktokLinksViaWeb(q) {
    const r = await http('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(`site:tiktok.com ${q}`), { timeout: 20000 });
    const html = await r.text();
    const links = [];
    for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)) {
        let href = decodeHtml(m[1]);
        const u = /uddg=([^&]+)/.exec(href);
        if (u) href = decodeURIComponent(u[1]);
        if (/tiktok\.com\/@[^/]+\/video\/\d+/.test(href) && !links.includes(href)) links.push(href);
        if (links.length >= 6) break;
    }
    return links;
}

async function cmdEdit(c) {
    const name = c.args.trim() || quotedText(c).trim();
    if (!name) return c.reply('📌 اكتب اسم الشخصية بعد الأمر، مثال: `.ايدت ايرين` أو `.ايدت غوجو`');
    const q = `${name} edit`;
    const tokens = name.toLowerCase().split(/\s+/).filter((x) => x.length >= 2);
    let videos = [];
    try { videos = await tiktokSearchVideos(q); } catch (e) { videos = []; }
    videos = videos.filter((v) => (v.hdplay || v.play) && (!v.duration || v.duration <= 120));
    // المقاطع التي يحوي عنوانها اسم الشخصية أولاً
    videos.sort((a, b) => {
        const sa = tokens.some((t) => (a.title || '').toLowerCase().includes(t)) ? 0 : 1;
        const sb = tokens.some((t) => (b.title || '').toLowerCase().includes(t)) ? 0 : 1;
        return sa - sb;
    });
    let sent = 0;
    for (const v of videos) {
        if (sent >= 3) break;
        try {
            const cap = `🎞️ ايدت ${name} (${sent + 1}/3)\n👤 ${v.author?.nickname || v.author?.unique_id || ''}`.trim();
            await sendUrlMedia(c, tikAbs(v.hdplay || v.play), cap, 'mp4');
            sent++;
        } catch (e) { /* ننتقل للمقطع التالي */ }
    }
    if (sent < 3) {
        let links = [];
        try { links = await tiktokLinksViaWeb(q); } catch (e) {}
        for (const link of links) {
            if (sent >= 3) break;
            try {
                await sleep(1200);
                const j = await httpJson('https://www.tikwm.com/api/?hd=1&url=' + encodeURIComponent(link), { timeout: 30000 });
                const d = j?.data;
                const vu = tikAbs(d?.hdplay || d?.play);
                if (j?.code === 0 && vu && !(d.images && d.images.length)) {
                    await sendUrlMedia(c, vu, `🎞️ ايدت ${name} (${sent + 1}/3)\n👤 ${d.author?.nickname || ''}`.trim(), 'mp4');
                    sent++;
                }
            } catch (e) { /* تجاهل */ }
        }
    }
    if (!sent) return c.reply(`❌ لم أجد ايديتات لـ (${name}).\nجرّب كتابة الاسم بالإنجليزية أو بشكل آخر.`);
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

