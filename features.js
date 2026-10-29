// ============ features.js : الملصقات + التنزيل + الذكاء الاصطناعي ============
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import pino from 'pino';
import { execFile, spawn } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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

// إعدادات الذكاء الاصطناعي (اختيارية): متغيرات البيئة في Railway
//   AI_API_KEY  مفتاح خدمة متوافقة مع OpenAI (OpenAI / Groq / OpenRouter / Gemini ...)
//   AI_API_URL  الرابط الأساسي (الافتراضي https://api.openai.com/v1)
//   AI_MODEL    اسم النموذج (الافتراضي gpt-4o-mini)
// بدون مفتاح يستخدم خدمة مجانية بدون مفتاح (pollinations) وقد تكون أبطأ وأقل ثباتاً.

const norm = (s) => s.replace(/[أإآا]/g, 'ا');

// ---------------------------------------------------------------- الأوامر والاختصارات
const COMMANDS = {
    // الملصقات
    'ملصق': ['s', 'ستكر'], 'دائري': ['round'], 'سرقة': ['steal'], 'لصورة': ['toimage', 'img'], 'ايموجي': ['emoji'],
    'كتابة': ['ttp'], 'باك': ['stickerpack'], 'لفيديو': ['tovideo'], 'ملصقات': [],
    // التنزيل (القسم فارغ: لا توجد فيه أوامر)
    'تحميل': [],
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
const LINK_COMMANDS = new Set(['تلخيص']);
export function isFeatureLinkCommand(body) {
    const t = String(body || '').trim();
    if (!t.startsWith('.')) return false;
    const first = norm(t.slice(1).trim().split(/\s+/)[0].toLowerCase());
    const canon = CANON[first];
    return !!canon && LINK_COMMANDS.has(canon);
}

// ---------------------------------------------------------------- نصوص الأقسام
export const STICKER_SECTION = `🏷️ *قِـسْـمُ الـمَـلْـصَـقَـاتِ:*

> 🖼️ .ملصق | .s ↞ صورة أو فيديو إلى ملصق
> 🥷 .سرقة [اسم] ↞ إعادة نشر ملصق باسمك
> 😀 .ايموجي 😎 ↞ إيموجي إلى ملصق
> ✍️ .كتابة <نص> ↞ ملصق نصي
> 🖼️ .لصورة ↞ ملصق إلى صورة
> ⭕ .دائري ↞ ملصق دائري
> 🎥 .لفيديو ↞ ملصق متحرك إلى فيديو
> 🗂️ .باك [اسم] ↞ صور كثيرة (3 إلى 30) إلى حزمة ملصقات جاهزة

💡 أرسل الأمر مع الصورة أو رد على صورة/فيديو/ملصق.`;

export const DOWNLOAD_SECTION = `📥 *قِـسْـمُ الـتَّـنْـزِيـلِ مِـنَ الـرَّابِـطِ:*

> 🚧 لا توجد أوامر في هذا القسم حالياً.`;

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
const ANY_KINDS = ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage'];
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
    const isVideo = t.kind === 'videoMessage' || (t.kind === 'documentMessage' && /^video\//.test(t.node.mimetype || ''));
    if (isVideo && (t.node.seconds || 0) > 10) return c.reply('⚠️ الفيديو أطول من 10 ثوانٍ. اقصّه ثم أعد المحاولة.');
    const buf = await download(c, t);
    const type = kind === 'دائري' ? StickerTypes.CIRCLE : StickerTypes.DEFAULT;
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
    const id = uid();
    const rawFile = path.join(TMP, `sv_${id}.raw`), imgFile = path.join(TMP, `sv_${id}.png`), out = path.join(TMP, `sv_${id}.mp4`);
    // ترميز H.264 متوافق مع واتساب (أبعاد زوجية + yuv420p + faststart)
    const even = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
    const encOut = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'main', '-movflags', '+faststart', '-an', out];
    try {
        const meta = await sharp(buf, { animated: true }).metadata();
        if ((meta.pages || 1) > 1) {
            // ملصق متحرك: نفكّ إطاراته الحقيقية (على خلفية سوداء بدل الشفافية) ونركّبها فيديو بنفس سرعة الملصق
            const W = meta.width, H = meta.pageHeight || Math.round(meta.height / meta.pages);
            const delays = (meta.delay || []).filter((d) => d > 0);
            const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 100;
            const fps = Math.min(30, Math.max(5, Math.round(1000 / Math.max(avg, 20))));
            let data, ch;
            try {
                const r = await sharp(buf, { animated: true }).flatten({ background: '#000000' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
                data = r.data; ch = r.info.channels || 3;
            } catch (e) {
                const r = await sharp(buf, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                data = r.data; ch = r.info.channels || 4;
            }
            const frames = Math.floor(data.length / (W * H * ch));
            if (!frames) throw new Error('NO_FRAMES');
            fs.writeFileSync(rawFile, data.subarray(0, frames * W * H * ch));
            const input = ['-f', 'rawvideo', '-pix_fmt', ch === 4 ? 'rgba' : 'rgb24', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', rawFile];
            if (ch === 4) await run(FFMPEG, ['-y', '-v', 'error', ...input, '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${fps}`, '-filter_complex', `[1:v][0:v]overlay=shortest=1,${even},format=yuv420p`, ...encOut], 120000);
            else await run(FFMPEG, ['-y', '-v', 'error', ...input, '-vf', even, '-pix_fmt', 'yuv420p', ...encOut], 120000);
        } else {
            // ملصق ثابت: نحوّله إلى فيديو قصير (3 ثوانٍ)
            fs.writeFileSync(imgFile, await sharp(buf).flatten({ background: '#000000' }).png().toBuffer());
            await run(FFMPEG, ['-y', '-v', 'error', '-loop', '1', '-framerate', '25', '-i', imgFile, '-t', '3', '-vf', even, '-pix_fmt', 'yuv420p', ...encOut], 120000);
        }
        const video = fs.readFileSync(out);
        if (video.length < 1000) throw new Error('EMPTY_VIDEO');
        await c.media({ video, mimetype: 'video/mp4', caption: '🎥 تم تحويل الملصق إلى فيديو.' });
    } finally { rm(rawFile, imgFile, out); }
}

async function cmdToVideo(c) {
    const t = getTarget(c, ['stickerMessage']);
    if (!t) return c.reply('📌 رد على ملصق بالأمر `.لفيديو`');
    await stickerToVideo(c, t);
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

// ----- حزمة ملصقات واتساب الأصلية (بطاقة «عرض مجموعة الملصقات»)
const PACK_BUSY = new Set();

// هل نسخة Baileys المثبّتة تعرف رسالة حزمة الملصقات (stickerPackMessage) في بروتوكول واتساب؟
function nativePackSupported() {
    try {
        const proto = BaileysNs.proto || BaileysNs.default?.proto;
        return !!proto?.Message?.prototype && ('stickerPackMessage' in proto.Message.prototype);
    } catch (e) { return false; }
}

// --- أدوات بناء الحزمة (ملف ZIP بدون ضغط + تشفير واتساب) بدون أي مكتبة إضافية
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) {
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
        const name = Buffer.from(f.name, 'utf8');
        const crc = crc32(f.data), len = f.data.length;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(len, 18); local.writeUInt32LE(len, 22);
        local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
        parts.push(local, name, f.data);
        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
        cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14);
        cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(len, 20); cen.writeUInt32LE(len, 24);
        cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
        central.push(cen, name);
        offset += 30 + name.length + len;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, cd, end]);
}

// تشفير وسائط واتساب: AES-256-CBC + HMAC (المفاتيح من HKDF حسب نوع الوسائط)
function waEncrypt(plain, mediaKey, info) {
    const exp = Buffer.from(crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(0), Buffer.from(info), 112));
    const iv = exp.subarray(0, 16), key = exp.subarray(16, 48), macKey = exp.subarray(48, 80);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const mac = crypto.createHmac('sha256', macKey).update(iv).update(enc).digest().subarray(0, 10);
    return Buffer.concat([enc, mac]);
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();

// Baileys لا يعرّف نوعَي الرفع الخاصين بالحزمة، فنسجّلهما مرة واحدة
function registerPackMedia() {
    for (const ns of [BaileysNs, BaileysNs.default]) {
        try {
            if (ns?.MEDIA_PATH_MAP) {
                ns.MEDIA_PATH_MAP['sticker-pack'] ??= '/mms/sticker-pack';
                ns.MEDIA_PATH_MAP['thumbnail-sticker-pack'] ??= '/mms/thumbnail-sticker-pack';
            }
            if (ns?.MEDIA_HKDF_KEY_MAPPING) {
                ns.MEDIA_HKDF_KEY_MAPPING['sticker-pack'] ??= 'Sticker Pack';
                ns.MEDIA_HKDF_KEY_MAPPING['thumbnail-sticker-pack'] ??= 'Sticker Pack Thumbnail';
            }
        } catch (e) { /* تجاهل */ }
    }
}

// رفع ملف مشفّر إلى خوادم واتساب ويعيد { directPath }
async function uploadPackBlob(sock, encBuf, mediaType, mmsPath) {
    const encSha = sha256(encBuf);
    const file = path.join(TMP, `pk_${uid()}.enc`);
    fs.writeFileSync(file, encBuf);
    try {
        registerPackMedia();
        try {
            const r = await sock.waUploadToServer(file, { fileEncSha256B64: encSha.toString('base64'), mediaType, timeoutMs: 180000 });
            if (r?.directPath) return { directPath: r.directPath, encSha };
        } catch (e) { logErr('رفع-حزمة', e); }
        // احتياط: رفع مباشر بنفس طريقة Baileys
        if (typeof sock.refreshMediaConn === 'function') {
            const conn = await sock.refreshMediaConn(false);
            const token = encSha.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            for (const { hostname } of (conn?.hosts || [])) {
                try {
                    const res = await fetch(`https://${hostname}${mmsPath}/${token}?auth=${encodeURIComponent(conn.auth)}&token=${token}`, {
                        method: 'POST', body: encBuf, signal: AbortSignal.timeout(180000),
                        headers: { 'Content-Type': 'application/octet-stream', Origin: 'https://web.whatsapp.com' }
                    });
                    const j = await res.json();
                    if (j?.direct_path) return { directPath: j.direct_path, encSha };
                } catch (e) { logErr('رفع-حزمة-مباشر', e); }
            }
        }
        throw new Error('PACK_UPLOAD_FAILED');
    } finally { rm(file); }
}

// صورة مصغّرة 2×2 لأول 4 ملصقات (هي التي تظهر في بطاقة الحزمة)
async function packThumb(stickers) {
    const sharp = await getSharp();
    if (!sharp) return null;
    const S = 252, G = 6, T = (S - 3 * G) / 2;
    const pos = [[G, G], [2 * G + T, G], [G, 2 * G + T], [2 * G + T, 2 * G + T]];
    const tiles = [];
    for (const b of stickers.slice(0, 4)) {
        try { tiles.push(await sharp(b).resize(T, T, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: '#ffffff' }).png().toBuffer()); } catch (e) { /* تجاهل */ }
    }
    if (!tiles.length) return null;
    return await sharp({ create: { width: S, height: S, channels: 3, background: '#ffffff' } })
        .composite(tiles.map((input, i) => ({ input, left: pos[i][0], top: pos[i][1] })))
        .jpeg({ quality: 85 }).toBuffer();
}

// يبني رسالة الحزمة: ZIP فيه كل الملصقات + أيقونة الحزمة، مشفّراً ومرفوعاً، ثم بياناته
async function buildPackMessage(sock, { title, author, stickers }) {
    const sharp = await getSharp();
    const packId = crypto.randomUUID();
    const entries = stickers.map((b, i) => ({ buf: b, fileName: `${String(i).padStart(2, '0')}_${sha256(b).toString('base64url')}.webp` }));
    const trayName = `${packId}.png`;
    const tray = sharp
        ? await sharp(stickers[0]).resize(252, 252, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
        : stickers[0];
    const zip = zipStore([...entries.map((e) => ({ name: e.fileName, data: e.buf })), { name: trayName, data: tray }]);
    const mediaKey = crypto.randomBytes(32);

    const up = await uploadPackBlob(sock, waEncrypt(zip, mediaKey, 'WhatsApp Sticker Pack Keys'), 'sticker-pack', '/mms/sticker-pack');
    const msg = {
        stickerPackId: packId,
        name: title,
        publisher: author || AUTHOR,
        packDescription: `${title} • ${AUTHOR}`,
        stickers: entries.map((e) => ({ fileName: e.fileName, isAnimated: false, isLottie: false, emojis: ['🍷'], accessibilityLabel: '', mimetype: 'image/webp' })),
        fileLength: zip.length,
        fileSha256: sha256(zip),
        fileEncSha256: up.encSha,
        mediaKey,
        directPath: up.directPath,
        mediaKeyTimestamp: Math.floor(Date.now() / 1000),
        trayIconFileName: trayName,
        stickerPackSize: entries.reduce((n, e) => n + e.buf.length, 0),
        stickerPackOrigin: 1   // THIRD_PARTY
    };

    // الصورة المصغّرة (لا نوقف الإرسال إن فشلت)
    try {
        const thumb = await packThumb(stickers);
        if (thumb) {
            const tUp = await uploadPackBlob(sock, waEncrypt(thumb, mediaKey, 'WhatsApp Sticker Pack Thumbnail Keys'), 'thumbnail-sticker-pack', '/mms/thumbnail-sticker-pack');
            Object.assign(msg, { thumbnailDirectPath: tUp.directPath, thumbnailSha256: sha256(thumb), thumbnailEncSha256: tUp.encSha, thumbnailHeight: 252, thumbnailWidth: 252 });
        }
    } catch (e) { logErr('حزمة-مصغرة', e); }
    return msg;
}

// يرسل حزمة واتساب الأصلية (بطاقة «عرض مجموعة الملصقات»)؛ يعيد false إذا لم يمكن ذلك فتُرسل الملصقات واحداً واحداً
async function sendNativePack(c, { title, author, stickers }) {
    if (!nativePackSupported()) { console.error('[حزمة-أصلية] نسخة Baileys المثبّتة لا تدعم stickerPackMessage، حدّث المكتبة في package.json'); return false; }
    try {
        const msg = await buildPackMessage(c.sock, { title, author, stickers });
        const gen = BaileysNs.generateWAMessageFromContent || BaileysNs.default?.generateWAMessageFromContent;
        let full;
        try { full = gen(c.from, { stickerPackMessage: msg }, { userJid: c.sock.user?.id, quoted: c.msg }); }
        catch (e) { full = gen(c.from, { stickerPackMessage: msg }, { userJid: c.sock.user?.id }); }
        await c.sock.relayMessage(c.from, full.message, { messageId: full.key.id });
        return true;
    } catch (e) { logErr('حزمة-أصلية', e); }
    // احتياط: إن كانت نسخة Baileys تدعم stickerPack مباشرة
    try {
        await c.sock.sendMessage(c.from, {
            stickerPack: {
                name: title, publisher: author || AUTHOR, description: `${title} • ${AUTHOR}`, cover: stickers[0],
                stickers: stickers.map((b) => ({ sticker: b, data: b, emojis: ['🍷'], isAnimated: false }))
            }
        }, { quoted: c.msg });
        return true;
    } catch (e) { logErr('حزمة-أصلية-احتياط', e); return false; }
}

// ----- .باك : تحويل صور كثيرة دفعة واحدة إلى حزمة ملصقات واتساب جاهزة
const PACK_MIN = 3, PACK_MAX = 30;                 // حدود واتساب للحزمة الواحدة
const PACK_SESSIONS = new Map();                   // محادثة|مرسل -> جلسة جمع الصور
const PACK_IDLE = 10 * 60 * 1000;                  // تنتهي الجلسة المفتوحة بعد 10 دقائق بلا صور
const PACK_ALBUM_WAIT = 12 * 1000;                 // وضع الألبوم: التجهيز تلقائياً بعد آخر صورة
const packKey = (from, sender) => `${from}|${sender}`;
const packSenderOf = (sock, msg) => (msg.key.fromMe ? ((sock.user?.id || '').split(':')[0] + '@s.whatsapp.net') : (msg.key.participant || msg.key.remoteJid));

function packTouch(s) {
    clearTimeout(s.idleTimer); clearTimeout(s.albumTimer);
    s.idleTimer = setTimeout(() => { if (!s.done) { s.done = true; PACK_SESSIONS.delete(s.key); } }, PACK_IDLE);
    if (s.album && s.count >= PACK_MIN) s.albumTimer = setTimeout(() => { finishPack(s, s.c).catch(() => {}); }, PACK_ALBUM_WAIT);
}
function packQueue(s, sock, msg, container) {
    if (s.done || s.count >= PACK_MAX) return false;
    s.count++;
    packTouch(s);
    s.chain = s.chain.then(async () => {
        try {
            const buf = await downloadMediaMessage({ key: msg.key, message: container }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
            s.stickers.push(await makeSticker(buf, StickerTypes.FULL, { pack: s.name, author: AUTHOR, quality: 70 }));
            try { await sock.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } }); } catch (e) {}
        } catch (e) { s.count--; logErr('باك-صورة', e); }
    });
    if (s.count >= PACK_MAX) s.chain.then(() => finishPack(s, s.c)).catch(() => {});
    return true;
}
// يُستدعى لكل رسالة واردة: يجمع الصور المرسلة أثناء وجود جلسة «.باك» مفتوحة
export function collectPackImages(sock, messages) {
    if (!PACK_SESSIONS.size) return;
    for (const msg of messages || []) {
        try {
            if (!msg?.message || !msg.key?.remoteJid) continue;
            const id = String(msg.key.id || '');
            if (msg.key.fromMe && (id.startsWith('BAE5') || id.startsWith('3EB0'))) continue;   // رسائل البوت نفسه
            const own = unwrap(msg.message);
            if (!own?.imageMessage) continue;
            if (String(own.imageMessage.caption || '').trim().startsWith('.')) continue;          // الصورة المرفقة بأمر يعالجها الأمر نفسه
            const s = PACK_SESSIONS.get(packKey(msg.key.remoteJid, packSenderOf(sock, msg)));
            if (!s || s.seen.has(id)) continue;
            s.seen.add(id);
            packQueue(s, sock, msg, own);
        } catch (e) { /* تجاهل */ }
    }
}
async function finishPack(s, c) {
    if (s.done || s.finishing) return;
    s.finishing = true;
    clearTimeout(s.albumTimer);
    try {
        await s.chain;
        if (s.stickers.length < PACK_MIN) {
            return await c.reply(`⚠️ الحزمة تحتاج ${PACK_MIN} صور على الأقل (وصلني ${s.stickers.length}). أرسل المزيد ثم اكتب \`.باك تم\``);
        }
        if (PACK_BUSY.has(c.from)) return await c.reply('⏳ توجد حزمة قيد الإرسال في هذه المحادثة، انتظر حتى تنتهي.');
        s.done = true; clearTimeout(s.idleTimer); PACK_SESSIONS.delete(s.key);
        PACK_BUSY.add(c.from);
        try {
            const stickers = s.stickers;
            await c.reply(`╭━━━〔 📦 〕━━━╮\n『 ${s.name} 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n〔 ✅ 〕 تم تجهيز ${stickers.length} ملصق\n〔 📤 〕 جاري إرسال الحزمة...`);
            if (await sendNativePack(c, { title: s.name, author: AUTHOR, animated: false, stickers })) return;
            let sent = 0;
            for (const st of stickers) {
                try { await c.sock.sendMessage(c.from, { sticker: st }); sent++; } catch (e) { logErr('إرسال-ملصق', e); }
                await sleep(700);
            }
            if (!sent) return await c.reply('❌ تعذر إرسال الحزمة، حاول مرة أخرى.');
            await c.reply(`✅ تم إرسال ${sent} ملصق من حزمة (${s.name}).`);
        } finally { PACK_BUSY.delete(c.from); }
    } finally { s.finishing = false; }
}
async function cmdPackImages(c) {
    const key = packKey(c.from, c.sender);
    const arg = c.args.trim();
    const w = norm(arg.toLowerCase());
    let s = PACK_SESSIONS.get(key);
    if (['تم', 'انهاء', 'ارسال', 'done', 'finish'].includes(w)) {
        if (!s) return c.reply('📌 لا توجد جلسة حزمة مفتوحة. ابدأ بـ `.باك اسم_الحزمة` ثم أرسل صورك.');
        return finishPack(s, c);
    }
    if (['الغاء', 'cancel'].includes(w)) {
        if (!s) return c.reply('📌 لا توجد جلسة حزمة مفتوحة.');
        s.done = true; clearTimeout(s.idleTimer); clearTimeout(s.albumTimer); PACK_SESSIONS.delete(key);
        return c.reply('🗑️ تم إلغاء الحزمة.');
    }
    const t = getTarget(c, ['imageMessage']);                       // صورة مرفقة بالأمر أو رد على صورة
    const attached = !!unwrap(c.msg.message)?.imageMessage;          // صورة مرفقة بالأمر نفسه = وضع الألبوم
    if (!s) {
        s = { key, name: (arg || PACK).slice(0, 60), stickers: [], seen: new Set(), count: 0, chain: Promise.resolve(), done: false, finishing: false, album: attached, c };
        PACK_SESSIONS.set(key, s);
        packTouch(s);
        if (attached) await c.reply(`📥 جاري استلام الصور لحزمة (${s.name})...\nسأجهّز الحزمة تلقائياً بعد وصول آخر صورة، أو اكتب \`.باك تم\` (الحد الأقصى ${PACK_MAX} صورة).`);
        else await c.reply(`╭━━━〔 📦 〕━━━╮\n『 ${s.name} 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n〔 📥 〕 أرسل الآن صورك (من ${PACK_MIN} إلى ${PACK_MAX} صورة)\n〔 ✅ 〕 ثم اكتب \`.باك تم\` لإنشاء الحزمة\n〔 ❌ 〕 للإلغاء: \`.باك الغاء\``);
    } else if (!t) {
        return c.reply(`📥 جلسة الحزمة (${s.name}) مفتوحة: وصلني ${s.count} صورة.\nأرسل المزيد (حتى ${PACK_MAX}) ثم اكتب \`.باك تم\` أو \`.باك الغاء\`.`);
    }
    if (t) {
        const id = String(c.msg.key.id || '');
        if (!s.seen.has(id)) { s.seen.add(id); if (!packQueue(s, c.sock, c.msg, t.container)) await c.reply(`⚠️ وصلت الحد الأقصى ${PACK_MAX} صورة.`); }
    }
}

// ---------------------------------------------------------------- أدوات مساعدة عامة
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logErr = (tag, e) => console.error(`[${tag}]`, String(e?.message || e).slice(0, 160));

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
const HEAVY = new Set(['اسأل', 'تخيل', 'تلخيص', 'ترجمة', 'صحح', 'شرح', 'اكتب', 'كود']);
let running = 0;
// أوامر فيها تحميل/تحضير: يظهر لها عدّاد تقدم حي حتى يجهز الطلب
const PROGRESS = new Set(['تخيل']);

async function sendSection(c, text) {
    let pp;
    try { pp = await c.getUserProfilePic(c.sock, c.sender); } catch (e) {}
    if (await sendSectionWithButtons(c.sock, c.from, text, pp, c.sender)) return;
    try { await c.sock.sendMessage(c.from, { image: { url: pp }, caption: text, mentions: [c.sender] }); }
    catch (e) { await c.sock.sendMessage(c.from, { text, mentions: [c.sender] }); }
}

const HANDLERS = {
    'ملصقات': (c) => sendSection(c, STICKER_SECTION), 'تحميل': (c) => sendSection(c, DOWNLOAD_SECTION), 'ذكاء': (c) => sendSection(c, AI_SECTION),
    'ملصق': (c) => cmdSticker(c, 'ملصق'), 'دائري': (c) => cmdSticker(c, 'دائري'),
    'سرقة': cmdSteal, 'لصورة': cmdToImage, 'ايموجي': cmdEmoji, 'كتابة': cmdText, 'باك': cmdPackImages, 'لفيديو': cmdToVideo,
    'اسأل': cmdAsk, 'تخيل': cmdImagine, 'تلخيص': cmdSummarize, 'ترجمة': cmdTranslate,
    'صحح': (c) => cmdSimpleAI(c, SYSTEM + ' صحّح الإملاء والنحو في النص التالي وأعد النص المصحّح فقط ثم سطراً قصيراً بأهم التعديلات.', '📌 اكتب النص المراد تصحيحه بعد الأمر.'),
    'شرح': (c) => cmdSimpleAI(c, SYSTEM + ' اشرح الموضوع التالي بأسلوب مبسّط مع مثال قصير.', '📌 مثال: `.شرح الذكاء الاصطناعي`'),
    'اكتب': (c) => cmdSimpleAI(c, SYSTEM + ' اكتب النص المطلوب (منشور/رسالة/قصيدة/إعلان...) بأسلوب جميل جاهز للنشر.', '📌 مثال: `.اكتب منشور ترحيب بأعضاء الجروب`'),
    'كود': (c) => cmdSimpleAI(c, SYSTEM + ' أنت مبرمج خبير. أجب بكود صحيح داخل كتل مع شرح مختصر.', '📌 مثال: `.كود دالة جافاسكربت لعكس نص`'),
    'نسيان': async (c) => { memory.delete(c.sender); await c.reply('🧹 تم مسح ذاكرة محادثتك مع الذكاء الاصطناعي.'); }
};

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

