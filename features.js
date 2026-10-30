// ============ features.js : الملصقات + التنزيل + الذكاء الاصطناعي ============
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import pino from 'pino';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import * as BaileysNs from '@whiskeysockets/baileys';
import { sendSectionWithButtons, sendPackCard, sendImageCarousel, sendVideoCarousel } from './menu.js';
import { DlError, warmupYtdlp } from './lib/dl.js';
import { buildMoreDownloadHandlers, MORE_COMMANDS, MORE_LINK_COMMANDS, MORE_HEAVY } from './moredl.js';
import { cmdYtSearch } from './ytsearch.js';

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
    'كتابة': ['ttp'], 'باك': ['stickerpack'], 'حزمة': ['pack'], 'لفيديو': ['tovideo'], 'متحرك': ['animated'], 'ملصقات': [],
    // الصور
    'صور': [], 'صورة': ['image'], 'خلفية': ['wallpaper'], 'بنتريست': ['pinterest'], 'بروفايل': ['pfp'], 'انمي': ['anime'],
    'بدون_خلفية': ['removebg', 'ازالة_الخلفية', 'ازالة_خلفية', 'ازالة', 'حذف_الخلفية'], 'تحسين': ['enhance', 'تحسين_الصورة', 'جودة'], 'تغبيش': ['blur'], 'ابيض_اسود': ['bw'], 'ضغط': ['compress'], 'صيغة': ['convert'],
    'قراءة': ['ocr'], 'ترجمة_صورة': ['trimg'], 'صورتي': ['myavatar'], 'صورته': ['avatar'],
    // التنزيل: أمر واحد فقط (.بحث_يوت) والباقي أزرار تفاعلية
    'تحميل': [], 'بحث_يوت': [],
    // الذكاء الاصطناعي
    'اسأل': ['ai'], 'تخيل': ['imagine'], 'تلخيص': ['sum'], 'ترجمة': ['tr'],
    'صحح': ['fix'], 'شرح': ['explain'], 'اكتب': ['write'], 'كود': ['code'], 'نسيان': ['reset'], 'ذكاء': []
};
Object.assign(COMMANDS, MORE_COMMANDS);   // أوامر قسم التنزيل الإضافية (moredl.js)
const CANON = {};   // الاسم (أو الاختصار) المُطبَّع -> الاسم الأساسي
for (const [name, aliases] of Object.entries(COMMANDS)) {
    CANON[norm(name)] = name;
    for (const a of aliases) CANON[norm(a)] = name;
}
CANON['11'] = 'ملصقات'; CANON['13'] = 'تحميل'; CANON['14'] = 'ذكاء'; CANON['15'] = 'صور';
export const featureCommandNames = Object.keys(CANON);

// أوامر تقبل رابطاً بعدها: لا تحذفها حماية الروابط (وإلا لا يستطيع الأعضاء استخدام التنزيل)
const LINK_COMMANDS = new Set(['تلخيص', 'بحث_يوت', ...MORE_LINK_COMMANDS]);
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
> 🎞️ .متحرك ↞ فيديو إلى ملصق متحرك
> 🗂️ .باك [اسم] ↞ صور كثيرة (3 إلى 30) إلى حزمة ملصقات جاهزة
> 📦 .حزمة <اسم الشخصية> ↞ حزمة ملصقات كاملة (30 ملصق) للشخصية

💡 أرسل الأمر مع الصورة أو رد على صورة/فيديو/ملصق.`;

export const IMAGE_SECTION = `🖼️ *قِـسْـمُ الـصُّـوَرِ:*

> 🔎 .صورة [عدد] <بحث> ↞ صورة من الإنترنت
> 📌 .بنتريست [عدد] <بحث> ↞ مجموعة صور من بنتريست
> 📱 .خلفية [عدد] <بحث> ↞ خلفيات جوال عالية الجودة
> 🧑‍🎤 .بروفايل [عدد] <اسم> ↞ صور شخصية (pfp)
> 🎌 .انمي [اسم] ↞ صورة أنمي عشوائية أو باسم
> ✂️ .ازالة_الخلفية ↞ إزالة خلفية الصورة (PNG شفاف)
> ✨ .تحسين ↞ رفع وضوح الصورة وجودتها
> 🌫️ .تغبيش [1-60] ↞ تغبيش الصورة
> ⚫ .ابيض_اسود ↞ تحويل الصورة لأبيض وأسود
> 🗜️ .ضغط [5-90] ↞ تصغير حجم الصورة
> 🔄 .صيغة png|jpg|webp ↞ تغيير صيغة الصورة
> 📖 .قراءة [لغة] ↞ استخراج النص من الصورة
> 🌐 .ترجمة_صورة [لغة] ↞ ترجمة النص داخل الصورة
> 👤 .صورتي ↞ صورة حسابك
> 👥 .صورته @عضو ↞ صورة حساب عضو

💡 أوامر التعديل: أرسل الصورة مع الأمر أو رد على صورة به.`;

export const DOWNLOAD_SECTION = `📥 *قِـسْـمُ الـتَّـنْـزِيـلِ:*

> 🔍 .بحث_يوت <اسم الفيديو> ↞ بحث في يوتيوب ثم اختيار الفيديو والجودة
> 🔗 .بحث_يوت <رابط> ↞ تنزيل مباشر من رابط يوتيوب
> 🎥 الجودات ↞ 360p • 480p • 720p • 1080p (مقطع جاهز في واتساب)
> 🎧 صوت MP3 ↞ تحميل الصوت فقط

🌐 *مواقع التواصل:*
> 🎵 .تيك <رابط> ↞ تيك توك بدون علامة مائية
> 📸 .انستا <رابط> ↞ ريلز وفيديوهات إنستغرام
> 📘 .فيس <رابط> ↞ فيديوهات فيسبوك
> 🐦 .تويتر <رابط> ↞ فيديوهات تويتر (X)
> 👻 .سناب <رابط> ↞ سبوتلايت سناب شات
> 📌 .بنتريست_تنزيل <رابط> ↞ فيديو أو صورة من بنتريست
> 🎶 .ساوند <رابط> ↞ صوت من ساوند كلاود
> 📁 .ميديافاير <رابط> ↞ تحميل ملف من ميديافاير
> 🔗 .حمل <رابط> ↞ يكتشف الموقع تلقائياً

🎧 *الصوتيات:*
> 🎵 .اغنية <اسم> ↞ بحث وإرسال الأغنية MP3 مباشرة
> 🎙️ .محاضرة <اسم> ↞ محاضرة أو خطبة (صوت)
> 📖 .سورة <اسم أو رقم> [القارئ] ↞ تلاوة سورة كاملة
> 🎙️ .قارئ ↞ قائمة القرّاء المتاحين
> 🕌 .اذان [مكة|المدينة|الأقصى|مصر] ↞ صوت الأذان

🛠️ *أدوات:*
> 🖼️ .غلاف <رابط> ↞ صورة غلاف فيديو يوتيوب
> 📋 .معلومات_فيديو <رابط> ↞ العنوان والمدة والمشاهدات

💡 مثال: \`.بحث_يوت إيرين ييغر\` • \`.تيك https://...\` • \`.سورة الكهف ماهر\`
📌 يمكنك أيضاً الرد على رسالة فيها رابط بالأمر.
🎧 أضف كلمة \`صوت\` بعد الرابط لتحميل الصوت فقط من أي موقع.`;

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

// ---- ترميز mp4 متوافق مع واتساب (H.264)، مع بدائل إن لم يتوفر libx264 في ffmpeg
const MP4_ENCODERS = [
    ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'main'],
    ['-c:v', 'libopenh264'],
    ['-c:v', 'mpeg4', '-q:v', '3']
];
async function encodeMp4(inputArgs, vf, out, complex = false) {
    let lastErr;
    for (const enc of MP4_ENCODERS) {
        try {
            rm(out);
            await run(FFMPEG, ['-y', '-v', 'error', ...inputArgs, complex ? '-filter_complex' : '-vf', vf, '-pix_fmt', 'yuv420p', ...enc, '-movflags', '+faststart', '-an', out], 180000);
            if (fs.existsSync(out) && fs.statSync(out).size > 1000) return;
        } catch (e) { lastErr = e; console.error('[لفيديو] فشل المرمّز', enc[1], String(e?.stderr || e?.message || e).slice(-200)); }
    }
    throw lastErr || new Error('ENCODE_FAILED');
}

// ---- قراءة ملف WebP متحرك يدوياً (RIFF/ANMF) دون الاعتماد على فك sharp للملصقات المتحركة
function parseAnimWebp(buf) {
    if (buf.length < 20 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
    let pos = 12, canvas = null;
    const frames = [];
    while (pos + 8 <= buf.length) {
        const id = buf.toString('ascii', pos, pos + 4), size = buf.readUInt32LE(pos + 4), body = pos + 8;
        if (id === 'VP8X') canvas = { w: buf.readUIntLE(body + 4, 3) + 1, h: buf.readUIntLE(body + 7, 3) + 1 };
        else if (id === 'ANMF') frames.push({
            x: buf.readUIntLE(body, 3) * 2, y: buf.readUIntLE(body + 3, 3) * 2,
            w: buf.readUIntLE(body + 6, 3) + 1, h: buf.readUIntLE(body + 9, 3) + 1,
            delay: buf.readUIntLE(body + 12, 3), flags: buf[body + 15], data: buf.subarray(body + 16, body + size)
        });
        pos = body + size + (size & 1);
    }
    return canvas && frames.length ? { canvas, frames } : null;
}
function frameToWebp(f) {
    const vp8x = Buffer.alloc(18);
    vp8x.write('VP8X', 0, 'ascii'); vp8x.writeUInt32LE(10, 4); vp8x[8] = 0x10;
    vp8x.writeUIntLE(f.w - 1, 12, 3); vp8x.writeUIntLE(f.h - 1, 15, 3);
    const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), vp8x, f.data]);
    const head = Buffer.alloc(8); head.write('RIFF', 0, 'ascii'); head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
}
// يحوّل الملصق المتحرك إلى إطارات RGB خام (على خلفية سوداء) في rawFile. يعيد { W, H, fps } أو null إن لم يكن متحركاً.
async function animatedStickerToRaw(buf, sharp, rawFile) {
    const MAX_FRAMES = 400;
    const fpsOf = (delays) => {
        const d = delays.filter((x) => x > 0);
        const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 100;
        return Math.min(30, Math.max(5, Math.round(1000 / Math.max(avg, 20))));
    };
    // الطريقة 1: sharp مباشرة
    try {
        const meta = await sharp(buf, { animated: true, failOn: 'none' }).metadata();
        if ((meta.pages || 1) > 1) {
            const W = meta.width, H = meta.pageHeight || Math.round(meta.height / meta.pages);
            const r = await sharp(buf, { animated: true, failOn: 'none' }).flatten({ background: '#000000' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
            const ch = r.info.channels || 3;
            const frames = Math.floor(r.data.length / (W * H * ch));
            if (ch === 3 && frames > 1) {
                fs.writeFileSync(rawFile, r.data.subarray(0, Math.min(frames, MAX_FRAMES) * W * H * ch));
                return { W, H, fps: fpsOf(meta.delay || []) };
            }
        }
    } catch (e) { logErr('لفيديو-sharp', e); }
    // الطريقة 2: تفكيك الإطارات يدوياً ثم تركيبها على لوحة (يدعم الإزاحة والدمج والمسح)
    const anim = parseAnimWebp(buf);
    if (!anim || anim.frames.length < 2) return null;
    const { w: W, h: H } = anim.canvas;
    let prev = Buffer.alloc(W * H * 4);                                  // لوحة شفافة
    const fd = fs.openSync(rawFile, 'w');
    try {
        const list = anim.frames.slice(0, MAX_FRAMES);
        for (const f of list) {
            const fr = await sharp(frameToWebp(f), { failOn: 'none' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const noBlend = !!(f.flags & 2), dispose = !!(f.flags & 1);
            const cur = await sharp(prev, { raw: { width: W, height: H, channels: 4 } })
                .composite([{ input: fr.data, raw: { width: fr.info.width, height: fr.info.height, channels: 4 }, left: f.x, top: f.y, blend: noBlend ? 'source' : 'over' }])
                .raw().toBuffer();
            const rgb = await sharp(cur, { raw: { width: W, height: H, channels: 4 } }).flatten({ background: '#000000' }).removeAlpha().raw().toBuffer();
            fs.writeSync(fd, rgb);
            if (dispose) {
                const clear = await sharp({ create: { width: f.w, height: f.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).raw().toBuffer();
                prev = await sharp(cur, { raw: { width: W, height: H, channels: 4 } })
                    .composite([{ input: clear, raw: { width: f.w, height: f.h, channels: 4 }, left: f.x, top: f.y, blend: 'source' }]).raw().toBuffer();
            } else prev = cur;
        }
        return { W, H, fps: fpsOf(list.map((f) => f.delay)) };
    } finally { fs.closeSync(fd); }
}

// الطريقة الأساسية: فك كل إطار بـ ffmpeg ثم تركيب الإطارات برمجياً (بدون sharp) على خلفية سوداء
async function animatedStickerToRawFF(buf, rawFile) {
    const anim = parseAnimWebp(buf);
    if (!anim || anim.frames.length < 2) return null;
    const { w: W, h: H } = anim.canvas;
    const list = anim.frames.slice(0, 400);
    const dir = fs.mkdtempSync(path.join(TMP, 'svf_'));
    const fd = fs.openSync(rawFile, 'w');
    try {
        const canvas = Buffer.alloc(W * H * 3);
        const inF = path.join(dir, 'f.webp'), outF = path.join(dir, 'f.raw');
        for (const f of list) {
            fs.writeFileSync(inF, frameToWebp(f));
            await run(FFMPEG, ['-y', '-v', 'error', '-i', inF, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', outF], 30000);
            const px = fs.readFileSync(outF);
            if (px.length < f.w * f.h * 4) throw new Error('BAD_FRAME_DECODE');
            const noBlend = !!(f.flags & 2), dispose = !!(f.flags & 1);
            for (let y = 0; y < f.h; y++) {
                const cy = y + f.y; if (cy >= H) break;
                for (let x = 0; x < f.w; x++) {
                    const cx = x + f.x; if (cx >= W) break;
                    const s = (y * f.w + x) * 4, d = (cy * W + cx) * 3, a = px[s + 3];
                    if (a === 255) { canvas[d] = px[s]; canvas[d + 1] = px[s + 1]; canvas[d + 2] = px[s + 2]; }
                    else if (noBlend) { canvas[d] = (px[s] * a / 255) | 0; canvas[d + 1] = (px[s + 1] * a / 255) | 0; canvas[d + 2] = (px[s + 2] * a / 255) | 0; }
                    else if (a > 0) { const k = a / 255; canvas[d] = (px[s] * k + canvas[d] * (1 - k)) | 0; canvas[d + 1] = (px[s + 1] * k + canvas[d + 1] * (1 - k)) | 0; canvas[d + 2] = (px[s + 2] * k + canvas[d + 2] * (1 - k)) | 0; }
                }
            }
            fs.writeSync(fd, canvas);
            if (dispose) {
                for (let y = 0; y < f.h; y++) { const cy = y + f.y; if (cy >= H) break; const from = (cy * W + f.x) * 3; canvas.fill(0, from, Math.min(from + f.w * 3, (cy + 1) * W * 3)); }
            }
        }
        const d = list.map((f) => f.delay).filter((x) => x > 0);
        const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 100;
        return { W, H, fps: Math.min(30, Math.max(5, Math.round(1000 / Math.max(avg, 20)))) };
    } finally { fs.closeSync(fd); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* تجاهل */ } }
}

async function stickerToVideo(c, t) {
    const buf = await download(c, t);
    const id = uid();
    const rawFile = path.join(TMP, `sv_${id}.raw`), inFile = path.join(TMP, `sv_${id}.webp`), out = path.join(TMP, `sv_${id}.mp4`);
    const even = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';                     // أبعاد زوجية مطلوبة لـ H.264
    const errs = [];
    try {
        let anim = null;
        try { anim = await animatedStickerToRawFF(buf, rawFile); } catch (e) { errs.push('ffmpeg: ' + String(e?.stderr || e?.message || e).slice(-200)); logErr('لفيديو-ffmpeg', e); anim = null; }
        if (!anim) {
            const sharp = await getSharp();
            if (sharp) { try { anim = await animatedStickerToRaw(buf, sharp, rawFile); } catch (e) { errs.push('sharp: ' + String(e?.message || e).slice(0, 200)); logErr('لفيديو-إطارات', e); } }
        }
        if (anim) {
            await encodeMp4(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${anim.W}x${anim.H}`, '-framerate', String(anim.fps), '-i', rawFile], even, out);
        } else {
            // ملصق ثابت: صورة على خلفية سوداء لمدة 3 ثوانٍ
            fs.writeFileSync(inFile, buf);
            await encodeMp4(['-loop', '1', '-framerate', '25', '-t', '3', '-i', inFile], 'format=rgba,split[a][b];[b]drawbox=c=black:t=fill[k];[k][a]overlay=format=auto,' + even, out, true);
        }
        const video = fs.readFileSync(out);
        if (video.length < 1000) throw new Error('EMPTY_VIDEO');
        await c.media({ video, mimetype: 'video/mp4', caption: '🎥 تم تحويل الملصق إلى فيديو.' });
    } catch (e) {
        const err = new Error('STICKER2VIDEO_FAILED');
        err.friendly = '❌ تعذر تحويل الملصق إلى فيديو.' + (c.isSenderDev ? `\n\n🔧 للمطور:\n${[...errs, String(e?.stderr || e?.message || e).slice(-300)].join('\n')}` : '');
        throw err;
    } finally { rm(rawFile, inFile, out); }
}

async function cmdToVideo(c) {
    const t = getTarget(c, ['stickerMessage']);
    if (!t) return c.reply('📌 رد على ملصق بالأمر `.لفيديو`');
    await stickerToVideo(c, t);
}

// ----- .متحرك : فيديو -> ملصق متحرك حقيقي (WebP متحرك) بدون الاعتماد على libwebp في ffmpeg
const wChunk = (id, data) => {
    const h = Buffer.alloc(8); h.write(id, 0, 'ascii'); h.writeUInt32LE(data.length, 4);
    return Buffer.concat([h, data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
};
function webpChunkMap(buf) {
    const map = {}; let pos = 12;
    while (pos + 8 <= buf.length) {
        const id = buf.toString('ascii', pos, pos + 4), size = buf.readUInt32LE(pos + 4);
        if (!map[id]) map[id] = buf.subarray(pos + 8, pos + 8 + size);
        pos += 8 + size + (size & 1);
    }
    return map;
}
function waStickerExif(pack, author) {
    const json = { 'sticker-pack-id': crypto.randomBytes(16).toString('hex'), 'sticker-pack-name': pack, 'sticker-pack-publisher': author, emojis: [''] };
    const attr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jb = Buffer.from(JSON.stringify(json), 'utf8');
    const exif = Buffer.concat([attr, jb]); exif.writeUInt32LE(jb.length, 14);
    return exif;
}
// frameWebps: مصفوفة صور WebP ثابتة بنفس الأبعاد W×H
function buildAnimatedWebp(frameWebps, W, H, delayMs, exif) {
    const anmf = frameWebps.map((b) => {
        const m = webpChunkMap(b), parts = [];
        if (m['ALPH']) parts.push(wChunk('ALPH', m['ALPH']));
        if (m['VP8 ']) parts.push(wChunk('VP8 ', m['VP8 ']));
        else if (m['VP8L']) parts.push(wChunk('VP8L', m['VP8L']));
        else throw new Error('BAD_FRAME');
        const h = Buffer.alloc(16);
        h.writeUIntLE(0, 0, 3); h.writeUIntLE(0, 3, 3); h.writeUIntLE(W - 1, 6, 3); h.writeUIntLE(H - 1, 9, 3); h.writeUIntLE(delayMs, 12, 3);
        h[15] = 0x03;                                                    // كل إطار يستبدل اللوحة بالكامل (بلا دمج ولا بقايا)
        return wChunk('ANMF', Buffer.concat([h, ...parts]));
    });
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x02 | 0x10 | (exif ? 0x08 : 0);                           // متحرك + شفافية + exif
    vp8x.writeUIntLE(W - 1, 4, 3); vp8x.writeUIntLE(H - 1, 7, 3);
    const anim = Buffer.alloc(6);                                        // لون الخلفية شفاف + تكرار لا نهائي
    const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), wChunk('VP8X', vp8x), wChunk('ANIM', anim), ...anmf, ...(exif ? [wChunk('EXIF', exif)] : [])]);
    const head = Buffer.alloc(8); head.write('RIFF', 0, 'ascii'); head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
}

async function cmdAnimSticker(c) {
    let t = getTarget(c, ['videoMessage', 'documentMessage']);
    if (t && t.kind === 'documentMessage' && !/^video\//.test(t.node.mimetype || '')) t = null;
    if (!t) return c.reply('📌 أرسل فيديو مع الأمر `.متحرك` أو رد على فيديو به لتحويله إلى ملصق متحرك.');
    if ((t.node.seconds || 0) > 10) return c.reply('⚠️ الفيديو أطول من 10 ثوانٍ. اقصّه ثم أعد المحاولة.');
    await c.reply('🎞️ جاري تحويل الفيديو إلى ملصق متحرك...');
    const video = await download(c, t);
    const dir = fs.mkdtempSync(path.join(TMP, 'anim_'));
    const errs = [];
    const isF = (f) => /^f_\d+\.png$/.test(f), isW = (f) => /^w_\d+\.webp$/.test(f);
    // ترميز الإطارات: ffmpeg (libwebp) أولاً، ثم sharp إن لم يتوفر
    const encodeFrames = async (q) => {
        const pngs = fs.readdirSync(dir).filter(isF).sort();
        try {
            for (const f of fs.readdirSync(dir).filter(isW)) rm(path.join(dir, f));
            await run(FFMPEG, ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(dir, 'f_%04d.png'), '-c:v', 'libwebp', '-q:v', String(q), '-compression_level', '3', '-f', 'image2', path.join(dir, 'w_%04d.webp')], 180000);
            const ws = fs.readdirSync(dir).filter(isW).sort();
            if (ws.length === pngs.length && ws.length) return ws.map((w) => fs.readFileSync(path.join(dir, w)));
            errs.push('ffmpeg-libwebp: عدد الإطارات غير مطابق');
        } catch (e) { errs.push('ffmpeg-libwebp: ' + String(e?.stderr || e?.message || e).slice(-200)); }
        const sharp = await getSharp();
        if (!sharp) throw new Error('NO_WEBP_ENCODER');
        const out = [];
        for (const f of pngs) out.push(await sharp(path.join(dir, f), { failOn: 'none' }).webp({ quality: q, effort: 3, alphaQuality: 70 }).toBuffer());
        return out;
    };
    try {
        const inFile = path.join(dir, 'in.bin');
        fs.writeFileSync(inFile, video);
        let best = null;
        try {
            const LIMIT = 900 * 1024;                                    // حد آمن لحجم الملصق المتحرك في واتساب
            const tries = [{ fps: 15, q: 55 }, { fps: 12, q: 45 }, { fps: 10, q: 38 }, { fps: 8, q: 30 }, { fps: 6, q: 24 }];
            const exif = waStickerExif(PACK, AUTHOR);
            for (const tr of tries) {
                for (const f of fs.readdirSync(dir).filter(isF)) rm(path.join(dir, f));
                const vf = `fps=${tr.fps},scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0`;
                await run(FFMPEG, ['-y', '-v', 'error', '-i', inFile, '-t', '10', '-vf', vf, '-an', path.join(dir, 'f_%04d.png')], 180000);
                if (!fs.readdirSync(dir).some(isF)) throw new Error('NO_FRAMES');
                const frames = await encodeFrames(tr.q);
                const webp = buildAnimatedWebp(frames, 512, 512, Math.round(1000 / tr.fps), exif);
                best = webp;
                if (webp.length <= LIMIT) break;
            }
        } catch (e) { best = null; errs.push('بناء الملصق: ' + String(e?.stderr || e?.message || e).slice(-250)); logErr('متحرك', e); }
        if (best) return await c.media({ sticker: best });
        // احتياط أخير: الطريقة العامة (wa-sticker-formatter)
        try { return await c.media({ sticker: await makeSticker(video, StickerTypes.FULL) }); }
        catch (e) { errs.push('wa-sticker-formatter: ' + String(e?.message || e).slice(0, 200)); }
        const err = new Error('ANIM_STICKER_FAILED');
        err.friendly = '❌ تعذر تحويل الفيديو إلى ملصق متحرك.' + (c.isSenderDev ? `\n\n🔧 للمطور:\n${errs.join('\n')}` : '');
        throw err;
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* تجاهل */ } }
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

// ----- .حزمة <اسم الشخصية> : يجلب حزمة ملصقات جاهزة (حتى 30) من الإنترنت ويرسلها كحزمة واتساب أصلية
const CHAR_PACK_SIZE = 30;
const STICKERLY_UA = 'androidapp.stickerly/1.17.0 (Pixel 7; U; Android 33; ar-SA; SA;)';

// المصدر الأول: Sticker.ly (حزم ملصقات جاهزة بصيغة واتساب webp)
async function stickerlySearch(keyword) {
    const res = await http('https://api.sticker.ly/v4/stickerPack/smartSearch', {
        method: 'POST', timeout: 25000,
        headers: { 'User-Agent': STICKERLY_UA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, enabledKeywordSearch: true, filter: { extendSearchResult: false, onlyAnimated: false, onlyStatic: true } })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    return (j?.result?.stickerPacks || []).filter((p) => p && !p.isAnimated && p.resourceUrlPrefix && Array.isArray(p.resourceFiles) && p.resourceFiles.length);
}
const isWebp = (b) => b && b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';

// تنزيل مجموعة روابط بالتوازي (بحد أقصى 6 معاً) مع تجاهل الفاشل
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = null; } }
    }));
    return out;
}

async function charPackFromStickerly(keywords) {
    const seenPacks = new Set(), packs = [];
    for (const kw of keywords) {
        try {
            for (const p of await stickerlySearch(kw)) { if (!seenPacks.has(p.packId)) { seenPacks.add(p.packId); packs.push(p); } }
        } catch (e) { logErr('حزمة-stickerly', e); }
        if (packs.length >= 6) break;
    }
    // نبقي الحزم المطابقة لاسم الشخصية فقط، وإن لم توجد حزمة مطابقة نترك المصدر التالي يتولى الأمر
    const toks = keywords.flatMap((k) => k.toLowerCase().split(/\s+/)).filter((t) => t.length >= 3 && !/[\u0600-\u06FF]/.test(t));
    if (toks.length) {
        const rel = packs.filter((p) => { const hay = `${p.name || ''} ${p.authorName || ''} ${(p.tags || []).join(' ')}`.toLowerCase(); return toks.some((t) => hay.includes(t)); });
        packs.length = 0; packs.push(...rel);
    }
    if (!packs.length) return [];
    // الأفضل أولاً: الحزم الكاملة (30) ثم الأكثر مشاهدة/تصديراً
    packs.sort((a, b) => (Math.min(b.resourceFiles.length, CHAR_PACK_SIZE) - Math.min(a.resourceFiles.length, CHAR_PACK_SIZE)) || ((b.exportCount || b.viewCount || 0) - (a.exportCount || a.viewCount || 0)));
    const urls = [], seen = new Set();
    for (const p of packs.slice(0, 4)) {
        for (const f of p.resourceFiles) {
            const u = p.resourceUrlPrefix + f;
            if (!seen.has(u)) { seen.add(u); urls.push(u); }
        }
        if (urls.length >= CHAR_PACK_SIZE + 6) break;     // زيادة بسيطة تعوّض الملفات التالفة
    }
    const got = await mapLimit(urls.slice(0, CHAR_PACK_SIZE + 6), 6, async (u) => {
        const { buf } = await httpBuffer(u, 400 * 1024, { timeout: 30000 });
        return isWebp(buf) ? buf : null;
    });
    return got.filter(Boolean).slice(0, CHAR_PACK_SIZE);
}

// ---- مصادر الصور (Pinterest ثم Bing): تنقية الجودة ثم تحويلها إلى ملصقات مربعة
const hashOf = async (sharp, buf) => {   // بصمة صغيرة لتجاهل الصور المكررة
    const px = await sharp(buf).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
    const avg = px.reduce((a, b) => a + b, 0) / px.length;
    return Array.from(px, (v) => (v >= avg ? 1 : 0));
};
async function imagesToStickers(urls, title, { minSide = 300 } = {}) {
    const sharp = await getSharp();
    if (!sharp) return [];
    const out = [], hashes = [];
    for (let i = 0; i < urls.length && out.length < CHAR_PACK_SIZE; i += 8) {
        const got = await mapLimit(urls.slice(i, i + 8), 8, async (u) => {
            const { buf, type } = await httpBuffer(u, 8 * 1024 * 1024, { timeout: 15000, headers: { Referer: new URL(u).origin + '/' } });
            if (type && !/^image\//.test(type)) return null;
            const meta = await sharp(buf).metadata();                       // يفشل مع الصور التالفة فتُتجاهل
            if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < minSide) return null;   // صغيرة/ضعيفة
            const ratio = meta.width / meta.height;
            if (ratio > 2.2 || ratio < 0.45) return null;                   // بانر أو شريط طويل
            const square = await sharp(buf).rotate().resize(512, 512, { fit: 'cover', position: 'attention' }).png().toBuffer();
            return { square, h: await hashOf(sharp, square) };
        });
        for (const g of got) {
            if (!g || out.length >= CHAR_PACK_SIZE) continue;
            if (hashes.some((h) => h.reduce((n, v, k) => n + (v !== g.h[k] ? 1 : 0), 0) <= 5)) continue;   // مكررة
            try { out.push(await makeSticker(g.square, StickerTypes.FULL, { pack: title, author: AUTHOR, quality: 80 })); hashes.push(g.h); } catch (e) { /* تجاهل */ }
        }
    }
    return out;
}
const IMG_QUERIES = (kw) => [`${kw} pfp`, `${kw} aesthetic`, `${kw} icons`, kw];   // صور واضحة ومربعة غالباً

// المصدر الاحتياطي: صور Pinterest عالية الجودة
async function charPackFromPinterest(keywords, title) {
    const urls = [], seen = new Set();
    const add = (u) => { if (u && !seen.has(u)) { seen.add(u); urls.push(u); } };
    for (const kw of keywords) {
        for (const q of IMG_QUERIES(kw)) {
            try {
                const data = JSON.stringify({ options: { isPrefetch: false, query: q, scope: 'pins', no_fetch_context_on_resource: false }, context: {} });
                const src = `/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;
                const j = await httpJson(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(src)}&data=${encodeURIComponent(data)}`, {
                    timeout: 25000,
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-Source-Url': src, 'X-Pinterest-AppState': 'active' }
                });
                for (const r of (j?.resource_response?.data?.results || [])) add(r?.images?.orig?.url || r?.images?.['736x']?.url);
            } catch (e) {
                logErr('حزمة-pinterest', e);
                // بديل: قراءة روابط الصور من صفحة البحث نفسها
                try {
                    const html = await (await http(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`, { timeout: 25000, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })).text();
                    for (const m of html.matchAll(/https:\/\/i\.pinimg\.com\/(?:236x|474x|564x|736x|originals)\/[0-9a-f/]+\.(?:jpg|png|webp)/g)) add(m[0].replace(/\/(236x|474x|564x)\//, '/736x/'));
                } catch (e2) { logErr('حزمة-pinterest-صفحة', e2); }
            }
            if (urls.length >= CHAR_PACK_SIZE * 3) break;
        }
        if (urls.length >= CHAR_PACK_SIZE * 3) break;
    }
    return urls.length ? await imagesToStickers(urls, title) : [];
}

// المصدر الأخير: صور Bing بجودة كبيرة فقط
async function charPackFromBing(keywords, title) {
    const urls = [], seen = new Set();
    for (const kw of keywords) {
        for (const q of IMG_QUERIES(kw)) {
            try {
                const res = await http(`https://www.bing.com/images/async?q=${encodeURIComponent(q)}&first=0&count=50&mmasync=1&adlt=off&qft=${encodeURIComponent('+filterui:imagesize-large+filterui:photo-photo')}`, { timeout: 25000, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const html = await res.text();
                for (const m of html.matchAll(/murl&quot;:&quot;(https?:[^&]+?)&quot;/g)) {
                    const u = m[1].replace(/&amp;/g, '&');
                    if (/\.(jpe?g|png|webp)(\?|$)/i.test(u) && !seen.has(u)) { seen.add(u); urls.push(u); }
                }
            } catch (e) { logErr('حزمة-bing', e); }
            if (urls.length >= CHAR_PACK_SIZE * 3) break;
        }
        if (urls.length >= CHAR_PACK_SIZE * 3) break;
    }
    return urls.length ? await imagesToStickers(urls, title) : [];
}

// المصدر الاختياري: حزم تليجرام (يحتاج متغير TELEGRAM_BOT_TOKEN من @BotFather وهو مجاني)
async function charPackFromTelegram(keywords, title) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return [];
    const names = [];
    for (const kw of keywords) {
        for (const u of [`https://www.bing.com/search?q=${encodeURIComponent(kw + ' telegram stickers addstickers')}`, `https://html.duckduckgo.com/html/?q=${encodeURIComponent(kw + ' telegram stickers t.me/addstickers')}`]) {
            try {
                const res = await http(u, { timeout: 25000 });
                let html = await res.text();
                try { html += ' ' + decodeURIComponent(html); } catch (e) { /* تجاهل */ }
                for (const m of html.matchAll(/t\.me\/addstickers\/([A-Za-z0-9_]{3,64})/g)) if (!names.includes(m[1])) names.push(m[1]);
            } catch (e) { logErr('حزمة-تليجرام-بحث', e); }
        }
    }
    const api = (m, q) => httpJson(`https://api.telegram.org/bot${token}/${m}?${q}`, { timeout: 25000 });
    const files = [];
    for (const n of names.slice(0, 6)) {
        try {
            const set = (await api('getStickerSet', 'name=' + encodeURIComponent(n))).result;
            for (const s of (set?.stickers || [])) if (!s.is_animated && !s.is_video) files.push(s.file_id);
        } catch (e) { logErr('حزمة-تليجرام-حزمة', e); }
        if (files.length >= CHAR_PACK_SIZE + 6) break;
    }
    if (!files.length) return [];
    const got = await mapLimit(files.slice(0, CHAR_PACK_SIZE + 6), 4, async (id) => {
        const fp = (await api('getFile', 'file_id=' + encodeURIComponent(id))).result?.file_path;
        const { buf } = await httpBuffer(`https://api.telegram.org/file/bot${token}/${fp}`, 2 * 1024 * 1024, { timeout: 30000 });
        return await makeSticker(buf, StickerTypes.FULL, { pack: title, author: AUTHOR, quality: 70 });
    });
    return got.filter(Boolean).slice(0, CHAR_PACK_SIZE);
}

async function cmdCharPack(c) {
    const name = c.args.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) return c.reply('📌 اكتب اسم الشخصية بعد الأمر.\nمثال: `.حزمة ايرين` أو `.حزمة Eren Yeager`');
    if (PACK_BUSY.has(c.from)) return c.reply('⏳ توجد حزمة قيد الإرسال في هذه المحادثة، انتظر حتى تنتهي.');
    PACK_BUSY.add(c.from);
    try {
        await c.reply(`╭━━━〔 📦 〕━━━╮\n『 ${name} 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n〔 🔎 〕 جاري البحث عن ملصقات الشخصية وتجهيز الحزمة...`);
        // الأسماء العربية تُترجم للإنجليزية لأن مواقع الملصقات تبحث بالإنجليزية غالباً
        const keywords = [name];
        if (/[\u0600-\u06FF]/.test(name)) {
            try { const en = (await gtranslate(name, 'en')).text.trim(); if (en && en.toLowerCase() !== name.toLowerCase()) keywords.unshift(en); } catch (e) { /* نكمل بالاسم الأصلي */ }
        }
        const title = (keywords[0] || name).slice(0, 60);
        // نجرب المصادر بالترتيب: أول مصدر يعطي 20 ملصقاً أو أكثر نعتمده، وإلا نحتفظ بأفضل نتيجة
        const SOURCES = [
            ['Sticker.ly', () => charPackFromStickerly(keywords)],
            ['Telegram', () => charPackFromTelegram(keywords, title)],
            ['Pinterest', () => charPackFromPinterest(keywords, title)],
            ['Bing', () => charPackFromBing(keywords, title)]
        ];
        let stickers = [];
        for (const [label, fn] of SOURCES) {
            let r = [];
            try { r = await fn(); } catch (e) { logErr('حزمة-' + label, e); }
            console.error(`[حزمة] المصدر ${label}: ${r.length} ملصق للبحث (${keywords.join(' | ')})`);
            if (r.length > stickers.length) stickers = r;
            if (stickers.length >= 20) break;
        }
        if (stickers.length < PACK_MIN) return await c.reply(`❌ لم أجد ملصقات كافية للشخصية (${name}). جرّب كتابة الاسم بالإنجليزية أو اسماً آخر.`);
        await c.reply(`〔 ✅ 〕 تم تجهيز ${stickers.length} ملصق\n〔 📤 〕 جاري إرسال الحزمة...`);
        if (await sendNativePack(c, { title, author: AUTHOR, animated: false, stickers })) return;
        let sent = 0;
        for (const st of stickers) {
            try { await c.sock.sendMessage(c.from, { sticker: st }); sent++; } catch (e) { logErr('إرسال-ملصق', e); }
            await sleep(700);
        }
        if (!sent) return await c.reply('❌ تعذر إرسال الحزمة، حاول مرة أخرى.');
        await c.reply(`✅ تم إرسال ${sent} ملصق من حزمة (${title}).`);
    } finally { PACK_BUSY.delete(c.from); }
}

// ================================================================ قسم الصور
const IMG_MAX = 8;                                     // أقصى عدد صور في أمر واحد
const NEED_IMG = '📌 أرسل صورة مع الأمر، أو رد على صورة بالأمر.';

async function sharpOrFail() {
    const sharp = await getSharp();
    if (!sharp) { const e = new Error('NO_SHARP'); e.friendly = '❌ مكتبة معالجة الصور (sharp) غير مثبّتة على السيرفر.'; throw e; }
    return sharp;
}
const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

// أي صورة (png/webp/gif/avif...) -> jpeg مناسب للإرسال (الشفافية تصبح خلفية بيضاء)
async function toJpeg(buf, { maxSide = 2048, quality = 90 } = {}) {
    const sharp = await sharpOrFail();
    return await sharp(buf, { failOn: 'none' }).rotate().resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality }).toBuffer();
}

// ---- البحث عن روابط صور: Pinterest أولاً ثم Bing
async function pinterestUrls(q) {
    const urls = [];
    const add = (u) => { if (u && !urls.includes(u)) urls.push(u); };
    try {
        const data = JSON.stringify({ options: { isPrefetch: false, query: q, scope: 'pins', no_fetch_context_on_resource: false }, context: {} });
        const src = `/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;
        const j = await httpJson(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(src)}&data=${encodeURIComponent(data)}`, {
            timeout: 25000,
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-Source-Url': src, 'X-Pinterest-AppState': 'active' }
        });
        for (const r of (j?.resource_response?.data?.results || [])) add(r?.images?.orig?.url || r?.images?.['736x']?.url);
    } catch (e) { logErr('صور-pinterest', e); }
    if (!urls.length) {
        try {   // بديل: روابط الصور من صفحة البحث نفسها
            const html = await (await http(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`, { timeout: 25000, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })).text();
            for (const m of html.matchAll(/https:\/\/i\.pinimg\.com\/(?:236x|474x|564x|736x|originals)\/[0-9a-f/]+\.(?:jpg|png|webp)/g)) add(m[0].replace(/\/(236x|474x|564x)\//, '/736x/'));
        } catch (e) { logErr('صور-pinterest-صفحة', e); }
    }
    return urls;
}
async function bingUrls(q, aspect) {
    const urls = [];
    try {
        const qft = '+filterui:imagesize-large' + (aspect ? `+filterui:aspect-${aspect}` : '');
        const res = await http(`https://www.bing.com/images/async?q=${encodeURIComponent(q)}&first=0&count=50&mmasync=1&adlt=strict&qft=${encodeURIComponent(qft)}`, { timeout: 25000, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        for (const m of html.matchAll(/murl&quot;:&quot;(https?:.+?)&quot;/g)) {
            const u = m[1].replace(/&amp;/g, '&');
            if (/\.(jpe?g|png|webp)(\?|$)/i.test(u) && !urls.includes(u)) urls.push(u);
        }
    } catch (e) { logErr('صور-bing', e); }
    return urls;
}
async function findImageUrls(queries, want, aspect) {
    const urls = [], seen = new Set();
    const add = (list) => { for (const u of list) if (!seen.has(u)) { seen.add(u); urls.push(u); } };
    for (const q of queries) {
        add(await pinterestUrls(q));
        if (urls.length < want * 4) add(await bingUrls(q, aspect));
        if (urls.length >= want * 4) break;
    }
    return urls;
}

// ---- تنزيل الصور مع التنقية: تالفة/صغيرة/مكررة/شكل غير مناسب تُتجاهل
// orient: 'tall' للخلفيات، 'square' للصور الشخصية، وإلا أي شكل
async function fetchImages(urls, count, { orient, minSide = 400, maxSide = 2048 } = {}) {
    const sharp = await sharpOrFail();
    const out = [], hashes = [];
    out.urls = [];                                       // مصدر كل صورة (لزر «فتح الصورة» في المعرض)
    for (let i = 0; i < urls.length && out.length < count; i += 8) {
        const got = await mapLimit(urls.slice(i, i + 8), 8, async (u) => {
            const { buf, type } = await httpBuffer(u, 15 * 1024 * 1024, { timeout: 20000, headers: { Referer: new URL(u).origin + '/' } });
            if (type && !/^image\//.test(type)) return null;
            const meta = await sharp(buf, { failOn: 'none' }).metadata();   // يفشل مع التالف فتُتجاهل
            if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < minSide) return null;
            const hw = meta.height / meta.width;
            if (orient === 'tall' && hw < 1.5) return null;
            if (orient === 'square' && (hw < 0.8 || hw > 1.25)) return null;
            if (!orient && (hw > 3 || hw < 0.33)) return null;
            return { jpg: await toJpeg(buf, { maxSide }), h: await hashOf(sharp, buf), u };
        });
        for (const g of got) {
            if (!g || out.length >= count) continue;
            if (hashes.some((h) => h.reduce((n, v, k) => n + (v !== g.h[k] ? 1 : 0), 0) <= 5)) continue;
            out.push(g.jpg); out.urls.push(g.u); hashes.push(g.h);
        }
    }
    return out;
}

// الكلمات العربية تُترجم للإنجليزية (نتائج أفضل) مع إبقاء الأصل كاحتياط
async function searchTerms(text) {
    const terms = [text];
    if (/[\u0600-\u06FF]/.test(text)) {
        try { const en = (await gtranslate(text, 'en')).text.trim(); if (en && en.toLowerCase() !== text.toLowerCase()) terms.unshift(en); } catch (e) { /* نكمل بالأصل */ }
    }
    return terms;
}

// عدة صور = معرض أفقي (كل صورة في بطاقة بجانب الأخرى)، وصورة واحدة = رسالة عادية
async function sendImages(c, images, caption, label) {
    if (images.length >= 2) {
        try {
            const cards = images.map((img, i) => ({ image: img, body: `${label || '🖼️'} (${i + 1}/${images.length})`, footer: '『✦』 Eren Bot 『✦』', url: images.urls?.[i], button: '🔗 فتح الصورة' }));
            await sendImageCarousel(c.sock, c.from, cards, { text: caption || '🖼️', footer: '👈 مرّر لرؤية باقي الصور' });
            return images.length;
        } catch (e) { logErr('صور-معرض', e); }   // إن فشل المعرض نرسل الصور واحدة واحدة
    }
    let sent = 0;
    for (let i = 0; i < images.length; i++) {
        try { await c.media({ image: images[i], ...(i === 0 && caption ? { caption } : {}) }); sent++; } catch (e) { logErr('صور-إرسال', e); }
        if (i < images.length - 1) await sleep(700);
    }
    return sent;
}

const IMG_KINDS = {
    'صورة':    { def: 1, orient: undefined, aspect: '',       q: (t) => [t],                                   title: 'صورة' },
    'بنتريست': { def: 6, orient: undefined, aspect: '',       q: (t) => [t, `${t} aesthetic`],                 title: 'بنتريست' },
    'خلفية':   { def: 3, orient: 'tall',    aspect: 'tall',   q: (t) => [`${t} wallpaper`, `${t} phone wallpaper hd`], title: 'خلفية' },
    'بروفايل': { def: 4, orient: 'square',  aspect: 'square', q: (t) => [`${t} pfp`, `${t} icon`, `${t} aesthetic`],   title: 'بروفايل' }
};
async function cmdImageSearch(c, kind) {
    const k = IMG_KINDS[kind];
    let arg = c.args.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim(), count = k.def;
    const m = /^(\d{1,2})\s+(.+)$/.exec(arg);
    if (m) { count = Math.min(IMG_MAX, Math.max(1, parseInt(m[1], 10))); arg = m[2].trim(); }
    if (!arg) return c.reply(`📌 اكتب ما تريد البحث عنه.\nمثال: \`.${kind} ${kind === 'بروفايل' ? 'ايرين' : kind === 'خلفية' ? 'سيارات' : 'قطط'}\` أو \`.${kind} 5 ${kind === 'بروفايل' ? 'ايرين' : 'قطط'}\``);
    arg = arg.slice(0, 80);
    await c.reply(`🔎 جاري البحث عن (${arg})...`);
    const terms = await searchTerms(arg);
    const queries = terms.flatMap((t) => k.q(t));
    const urls = await findImageUrls(queries, count, k.aspect);
    const side = count >= 2 ? (kind === 'خلفية' ? 1600 : 1280) : (kind === 'خلفية' ? 2560 : 2048);   // المعرض يحتاج صوراً أخف
    let images = urls.length ? await fetchImages(urls, count, { orient: k.orient, maxSide: side }) : [];
    if (!images.length && k.orient && urls.length) images = await fetchImages(urls, count, { maxSide: side });   // احتياط: نخفف شرط الشكل
    console.error(`[صور] ${kind} (${terms.join(' | ')}): ${urls.length} رابط -> ${images.length} صورة`);
    if (!images.length) return c.reply(`❌ لم أجد صوراً مناسبة لـ (${arg}). جرّب كلمة أخرى أو اكتبها بالإنجليزية.`);
    await sendImages(c, images, `🖼️ ${k.title}: ${arg}`, `🖼️ ${arg}`);
}

// ---- .انمي : صورة أنمي عشوائية (آمنة SFW) أو بحث باسم
async function cmdAnimeImg(c) {
    const arg = c.args.trim().slice(0, 80);
    if (arg) {
        const terms = await searchTerms(arg);
        const urls = await findImageUrls(terms.flatMap((t) => [`${t} anime`, `${t} anime pfp`]), 1);
        const imgs = urls.length ? await fetchImages(urls, 1) : [];
        if (!imgs.length) return c.reply(`❌ لم أجد صور أنمي لـ (${arg}).`);
        return void await sendImages(c, imgs, `🎌 أنمي: ${arg}`);
    }
    const cats = ['waifu', 'neko', 'shinobu', 'megumin'];
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const apis = [
        async () => (await httpJson(`https://api.waifu.pics/sfw/${cat}`, { timeout: 20000 })).url,
        async () => (await httpJson('https://nekos.best/api/v2/neko', { timeout: 20000 })).results?.[0]?.url
    ];
    for (const api of apis) {
        try {
            const u = await api();
            if (!u) continue;
            const { buf } = await httpBuffer(u, 15 * 1024 * 1024, { timeout: 25000 });
            return void await sendImages(c, [await toJpeg(buf)], '🎌 أنمي عشوائي');
        } catch (e) { logErr('صور-انمي', e); }
    }
    // احتياط أخير: بحث Pinterest
    const urls = await findImageUrls(['anime pfp', 'anime aesthetic'], 1);
    const imgs = urls.length ? await fetchImages(urls, 1) : [];
    if (!imgs.length) return c.reply('❌ تعذر جلب صورة أنمي الآن، حاول لاحقاً.');
    await sendImages(c, imgs, '🎌 أنمي');
}

// ---- أدوات التعديل المحلية (sharp): الهدف صورة مرفقة أو مردود عليها
const IMG_KINDS_IN = ['imageMessage', 'stickerMessage', 'documentMessage'];
async function getInputImage(c) {
    const t = getTarget(c, IMG_KINDS_IN);
    if (!t) { await c.reply(NEED_IMG); return null; }
    return await download(c, t);
}
const numArg = (c, def, min, max) => { const n = parseFloat(String(c.args).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

async function cmdBlur(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const sharp = await sharpOrFail();
    const out = await sharp(buf, { failOn: 'none' }).rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).blur(numArg(c, 10, 0.5, 60)).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
    await c.media({ image: out, caption: '🌫️ تم التغبيش. (للتحكم: `.تغبيش 30`)' });
}
async function cmdBW(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const sharp = await sharpOrFail();
    const out = await sharp(buf, { failOn: 'none' }).rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).greyscale().normalise().jpeg({ quality: 90 }).toBuffer();
    await c.media({ image: out, caption: '⚫⚪ تم التحويل إلى أبيض وأسود.' });
}
async function cmdCompress(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const sharp = await sharpOrFail();
    const q = Math.round(numArg(c, 35, 5, 90));
    const out = await sharp(buf, { failOn: 'none' }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    await c.media({ document: out, mimetype: 'image/jpeg', fileName: 'compressed.jpg', caption: `🗜️ الحجم: ${fmtSize(buf.length)} ← ${fmtSize(out.length)} (الجودة ${q}%)\nللتحكم: \`.ضغط 20\`` });
}
async function cmdEnhance(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const useHD = /hd|اتش/i.test(c.args);                                   // `.تحسين hd` = 1920، الافتراضي 4K = 3840
    const asFile = /ملف|file|doc/i.test(c.args);
    const L = useHD ? 1920 : 3840;
    const id = uid();
    const inp = path.join(TMP, `enh_in_${id}.bin`), out = path.join(TMP, `enh_out_${id}.jpg`);
    fs.writeFileSync(inp, buf);
    // F = معامل التكبير: حتى ×4 للوصول إلى الدقة المطلوبة، ولا يُكبَّر إن كانت الصورة كبيرة أصلاً
    const F = `if(lt(${L}/max(iw\\,ih)\\,1.05)\\,1\\,min(4\\,${L}/max(iw\\,ih)))`;
    const vf = `hqdn3d=2:2:6:6,scale=trunc(iw*${F}/2)*2:trunc(ih*${F}/2)*2:flags=lanczos,unsharp=5:5:1.0:5:5:0.0,eq=saturation=1.1:contrast=1.04`;
    try {
        let dims = '';
        try {
            await run(FFMPEG, ['-y', '-v', 'error', '-i', inp, '-frames:v', '1', '-vf', vf, '-q:v', '2', out], 120000);
        } catch (e) {
            logErr('تحسين-ffmpeg', e);
            // احتياط: بدون فلتر التنعيم إن لم يتوفر في ffmpeg
            await run(FFMPEG, ['-y', '-v', 'error', '-i', inp, '-frames:v', '1', '-vf', vf.replace('hqdn3d=2:2:6:6,', ''), '-q:v', '2', out], 120000);
        }
        const img = fs.readFileSync(out);
        const sharp = await getSharp();
        let w0 = 0, h0 = 0, w1 = 0, h1 = 0;
        if (sharp) { try { const m0 = await sharp(buf, { failOn: 'none' }).metadata(); const m1 = await sharp(img).metadata(); w0 = m0.width; h0 = m0.height; w1 = m1.width; h1 = m1.height; } catch (e) { /* تجاهل */ } }
        if (w0) dims = `\n📐 الدقة: ${w0}×${h0} ← ${w1}×${h1}`;
        const cap = `✨ تم تحسين الصورة (${useHD ? 'HD' : '4K'})${dims}\n📦 الحجم: ${fmtSize(img.length)}` + (useHD ? '' : '\n💡 للدقة الأخف اكتب `.تحسين hd`');
        if (asFile) await c.media({ document: img, mimetype: 'image/jpeg', fileName: `enhanced_${useHD ? 'HD' : '4K'}.jpg`, caption: cap });
        else await c.media({ image: img, caption: cap });
    } finally { rm(inp, out); }
}
async function cmdFormat(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const sharp = await sharpOrFail();
    let fmt = c.args.trim().toLowerCase().replace(/^\./, '');
    if (fmt === 'jpeg') fmt = 'jpg';
    if (!fmt) fmt = 'png';
    if (!['png', 'jpg', 'webp'].includes(fmt)) return c.reply('📌 الصيغ المتاحة: `png` | `jpg` | `webp`\nمثال: `.صيغة png`');
    let p = sharp(buf, { failOn: 'none' }).rotate();
    if (fmt === 'jpg') p = p.flatten({ background: '#ffffff' }).jpeg({ quality: 92 });
    else if (fmt === 'png') p = p.png();
    else p = p.webp({ quality: 90 });
    const out = await p.toBuffer();
    await c.media({ document: out, mimetype: fmt === 'jpg' ? 'image/jpeg' : `image/${fmt}`, fileName: `image.${fmt}`, caption: `🔄 تم التحويل إلى ${fmt.toUpperCase()} (${fmtSize(out.length)}).` });
}

// ---- إزالة الخلفية: remove.bg إن وُجد REMOVEBG_API_KEY، وإلا طريقة محلية تنجح مع الخلفيات الموحدة
// تملأ من الأطراف كل ما يشبه لون الخلفية وتجعله شفافاً. data: RGBA خام. تعيد null إذا لم تكن الخلفية موحدة.
function floodRemoveBg(data, w, h, tol = 42) {
    const idx = (x, y) => (y * w + x) * 4;
    const border = [];
    for (let x = 0; x < w; x++) { border.push([x, 0], [x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { border.push([0, y], [w - 1, y]); }
    let r = 0, g = 0, b = 0;
    for (const [x, y] of border) { const i = idx(x, y); r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    r /= border.length; g /= border.length; b /= border.length;
    const near = (i) => Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b) <= tol;
    const similar = border.filter(([x, y]) => near(idx(x, y))).length;
    if (similar / border.length < 0.7) return null;                  // الخلفية غير موحدة
    const seen = new Uint8Array(w * h), stack = [];
    for (const [x, y] of border) if (near(idx(x, y)) && !seen[y * w + x]) { seen[y * w + x] = 1; stack.push(y * w + x); }
    while (stack.length) {
        const p = stack.pop(), x = p % w, y = (p - (p % w)) / w;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = ny * w + nx;
            if (!seen[q] && near(q * 4)) { seen[q] = 1; stack.push(q); }
        }
    }
    let removed = 0;
    for (let p = 0; p < w * h; p++) if (seen[p]) { data[p * 4 + 3] = 0; removed++; }
    // تنعيم الحواف: البكسلات المجاورة للمحذوف تصبح نصف شفافة
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (!seen[p] && (seen[p - 1] || seen[p + 1] || seen[p - w] || seen[p + w])) data[p * 4 + 3] = 140;
    }
    return removed / (w * h) > 0.02 && removed / (w * h) < 0.97 ? data : null;   // لا شيء حُذف أو حُذف كل شيء = فشل
}
let RMBG_QUEUE = Promise.resolve();                                   // نموذج الذكاء الاصطناعي ثقيل: صورة واحدة في كل مرة
const RMBG_WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'rmbg-worker.mjs');
async function removeBgAI(png) {
    const errs = [];
    const run1 = async () => {
        const id = uid(), inF = path.join(TMP, `rmbg_in_${id}.png`), outF = path.join(TMP, `rmbg_out_${id}.png`);
        fs.writeFileSync(inF, png);
        try {
            for (const model of ['small', 'medium']) {                // الصغير أخف وأسرع، والمتوسط أدق
                try {
                    await new Promise((resolve, reject) => {
                        execFile(process.execPath, [RMBG_WORKER, inF, outF, model], { timeout: 240000, maxBuffer: 8 * 1024 * 1024 }, (err, so, se) => {
                            if (err) { err.stderr = String(se || ''); return reject(err); }
                            resolve();
                        });
                    });
                    const out = fs.existsSync(outF) ? fs.readFileSync(outF) : null;
                    if (out && out.length > 1000) return out;
                    errs.push(`${model}: ناتج فارغ`);
                } catch (e) {
                    const why = e.killed ? 'انتهت المهلة' : e.signal ? `أُنهيت العملية (${e.signal}) غالباً نفاد الذاكرة` : `رمز الخروج ${e.code}`;
                    errs.push(`${model}: ${why}\n${String(e.stderr || e.message).slice(0, 500)}`);
                }
            }
        } finally { rm(inF, outF); }
        const err = new Error('RMBG_ALL_FAILED'); err.debug = errs.join('\n'); throw err;
    };
    const job = RMBG_QUEUE.then(run1, run1);
    RMBG_QUEUE = job.catch(() => {});
    return await job;
}
async function cmdRemoveBg(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const sharp = await sharpOrFail();
    await c.reply('✂️ جاري إزالة الخلفية... (أول مرة قد تستغرق دقيقة لتحميل النموذج)');
    const png0 = await sharp(buf, { failOn: 'none' }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    let png = null, how = '', aiDebug = '';
    if (process.env.REMOVEBG_API_KEY) {                                // 1) remove.bg (أدق نتيجة، يحتاج مفتاحاً)
        try {
            const form = new FormData();
            form.append('image_file', new Blob([await toJpeg(buf, { maxSide: 2500, quality: 92 })], { type: 'image/jpeg' }), 'image.jpg');
            form.append('size', 'auto');
            const res = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY }, body: form, signal: AbortSignal.timeout(90000) });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            png = Buffer.from(await res.arrayBuffer()); how = 'remove.bg';
        } catch (e) { logErr('صور-removebg', e); }
    }
    if (!png) {                                                        // 2) نموذج ذكاء اصطناعي محلي يعمل لأي صورة
        try { png = await removeBgAI(png0); how = 'AI'; } catch (e) {
            aiDebug = e?.debug || String(e?.message || e);
            console.error('[صور] إزالة الخلفية (AI) فشلت:\n' + aiDebug.slice(0, 1500));
        }
    }
    if (!png) {                                                        // 3) احتياط: خلفية موحدة اللون فقط
        const { data, info } = await sharp(png0, { failOn: 'none' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const res = floodRemoveBg(data, info.width, info.height);
        if (res) { png = await sharp(res, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer(); how = 'محلي'; }
    }
    console.error(`[صور] إزالة الخلفية: ${how || 'فشلت كل الطرق'}`);
    if (!png) {
        const e = new Error('RMBG_FAILED');
        e.friendly = '❌ تعذرت إزالة الخلفية. تأكد أن حزمة `@imgly/background-removal-node` مثبّتة (npm install) أو أضف مفتاح `REMOVEBG_API_KEY`.'
            + (c.isSenderDev && aiDebug ? `\n\n🔧 للمطور (سبب الفشل):\n${aiDebug.slice(0, 700)}` : '');
        throw e;
    }
    await c.media({ document: png, mimetype: 'image/png', fileName: 'no-background.png', caption: '✂️ تمت إزالة الخلفية (PNG شفاف، أُرسل كملف للحفاظ على الشفافية).' });
}

// ---- قراءة النص من الصورة (OCR) عبر ocr.space (مفتاح مجاني اختياري OCR_API_KEY)
const OCR_LANGS = { 'عربي': 'ara', 'العربية': 'ara', 'انجليزي': 'eng', 'إنجليزي': 'eng', 'فرنسي': 'fre', 'الماني': 'ger', 'ألماني': 'ger', 'اسباني': 'spa', 'إسباني': 'spa', 'تركي': 'tur', 'روسي': 'rus', 'ياباني': 'jpn', 'كوري': 'kor', 'صيني': 'chs', 'ايطالي': 'ita', 'إيطالي': 'ita' };
async function ocrCall(buf, lang, engine) {
    const sharp = await sharpOrFail();
    let img = null;
    for (const [side, q] of [[1800, 80], [1400, 68], [1000, 55]]) {   // الخدمة المجانية تقبل حتى 1MB
        img = await sharp(buf, { failOn: 'none' }).rotate().resize(side, side, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: q }).toBuffer();
        if (img.length < 900 * 1024) break;
    }
    const body = new URLSearchParams({ base64Image: 'data:image/jpeg;base64,' + img.toString('base64'), language: lang, OCREngine: String(engine), scale: 'true', detectOrientation: 'true', isOverlayRequired: 'false' });
    const j = await httpJson('https://api.ocr.space/parse/image', {
        method: 'POST', timeout: 45000, body,
        headers: { apikey: process.env.OCR_API_KEY || 'helloworld', 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (j?.IsErroredOnProcessing) throw new Error('OCR: ' + [].concat(j.ErrorMessage || '').join(' ').slice(0, 100));
    return (j?.ParsedResults || []).map((r) => r.ParsedText || '').join('\n').replace(/\r/g, '').trim();
}
async function readImageText(buf, langWord) {
    const key = Object.keys(OCR_LANGS).find((k) => norm(k) === norm(langWord || ''));
    if (key) return await ocrCall(buf, OCR_LANGS[key], 1);
    let best = '';
    for (const [lang, engine] of [['ara', 1], ['eng', 2]]) {          // بدون لغة محددة: نجرّب العربية ثم الإنجليزية ونأخذ الأفضل
        try { const t = await ocrCall(buf, lang, engine); if (t.length > best.length) best = t; } catch (e) { logErr('صور-ocr', e); }
        if (best.length > 25) break;
    }
    return best;
}
async function cmdOCR(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const text = await readImageText(buf, c.args.trim().split(/\s+/)[0]);
    if (!text) return c.reply('❌ لم أستطع قراءة نص من هذه الصورة. جرّب صورة أوضح، أو حدّد اللغة مثل: `.قراءة انجليزي`');
    await c.reply(`📖 *النص المستخرج:*\n\n${text.slice(0, 3800)}`);
}
async function cmdOCRTranslate(c) {
    const buf = await getInputImage(c); if (!buf) return;
    const text = await readImageText(buf, '');
    if (!text) return c.reply('❌ لم أستطع قراءة نص من هذه الصورة. جرّب صورة أوضح.');
    const w = c.args.trim().split(/\s+/)[0];
    const langKey = Object.keys(LANGS).find((k) => norm(k) === norm(w || ''));
    let tl = langKey ? LANGS[langKey] : '', r;
    const src = text.slice(0, 3000);
    r = await gtranslate(src, tl || 'ar');
    if (!tl && (r.from || '').startsWith('ar')) r = await gtranslate(src, 'en');
    await c.reply(`🌐 *الترجمة:*\n\n${r.text.slice(0, 3000)}\n\n📖 *النص الأصلي:*\n${text.slice(0, 700)}${text.length > 700 ? '...' : ''}`);
}

// ---- صور الحسابات: .صورتي / .صورته @عضو
async function sendAvatar(c, jid, label) {
    let url = null;
    try { url = await c.sock.profilePictureUrl(jid, 'image'); } catch (e) { /* لا توجد صورة أو الخصوصية تمنعها */ }
    if (!url) return c.reply('🚫 لا توجد صورة بروفايل لهذا الحساب، أو أن إعدادات الخصوصية تمنع عرضها.');
    const { buf } = await httpBuffer(url, 15 * 1024 * 1024, { timeout: 25000 });
    await c.media({ image: buf, caption: `👤 ${label}` });
}
async function cmdMyAvatar(c) { await sendAvatar(c, c.sender, 'صورتك'); }
async function cmdAvatar(c) {
    const own = unwrap(c.msg.message);
    const ci = own?.extendedTextMessage?.contextInfo;
    let jid = ci?.mentionedJid?.[0] || ci?.participant;
    if (!jid) { const d = c.args.replace(/[^\d]/g, ''); if (d.length >= 8 && d.length <= 15) jid = d + '@s.whatsapp.net'; }
    if (!jid) return c.reply('📌 منشن العضو أو رد على رسالته أو اكتب رقمه.\nمثال: `.صورته @العضو`');
    await sendAvatar(c, jid, 'صورة الحساب');
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

// ---------------------------------------------------------------- يوتيوب: أمر «.بحث_يوت» (المنطق في ytsearch.js و lib/dl.js)
const dlSafe = (fn) => async (c) => {
    try { await fn(c); } catch (e) {
        if (e instanceof DlError) return c.reply(e.friendly + (c.isSenderDev && e.debug ? `\n\n🔧 للمطور:\n${String(e.debug).slice(0, 700)}` : ''));
        throw e;
    }
};
// تجهيز أداة التنزيل مسبقاً حتى لا ينتظر أول مستخدم
setTimeout(() => { warmupYtdlp().catch((e) => console.error('[yt-dlp] التجهيز المسبق:', e?.friendly || e?.message || e)); }, 20000).unref?.();

// ---------------------------------------------------------------- الموزّع
const COOLDOWN = new Map();
const HEAVY = new Set(['بحث_يوت', 'متحرك', 'حزمة', 'صورة', 'بنتريست', 'خلفية', 'بروفايل', 'انمي', 'بدون_خلفية', 'تحسين', 'قراءة', 'ترجمة_صورة', 'اسأل', 'تخيل', 'تلخيص', 'ترجمة', 'صحح', 'شرح', 'اكتب', 'كود']);
for (const n of MORE_HEAVY) HEAVY.add(n);
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
    'صور': (c) => sendSection(c, IMAGE_SECTION), 'ملصقات': (c) => sendSection(c, STICKER_SECTION), 'تحميل': (c) => sendSection(c, DOWNLOAD_SECTION), 'بحث_يوت': dlSafe((c) => cmdYtSearch(c, quotedText(c))), 'ذكاء': (c) => sendSection(c, AI_SECTION),
    'ملصق': (c) => cmdSticker(c, 'ملصق'), 'دائري': (c) => cmdSticker(c, 'دائري'),
    'سرقة': cmdSteal, 'لصورة': cmdToImage, 'ايموجي': cmdEmoji, 'كتابة': cmdText, 'باك': cmdPackImages, 'حزمة': cmdCharPack, 
    'صورة': (c) => cmdImageSearch(c, 'صورة'), 'بنتريست': (c) => cmdImageSearch(c, 'بنتريست'), 'خلفية': (c) => cmdImageSearch(c, 'خلفية'), 'بروفايل': (c) => cmdImageSearch(c, 'بروفايل'),
    'انمي': cmdAnimeImg, 'بدون_خلفية': cmdRemoveBg, 'تحسين': cmdEnhance, 'تغبيش': cmdBlur, 'ابيض_اسود': cmdBW, 'ضغط': cmdCompress, 'صيغة': cmdFormat,
    'قراءة': cmdOCR, 'ترجمة_صورة': cmdOCRTranslate, 'صورتي': cmdMyAvatar, 'صورته': cmdAvatar,
    'لفيديو': cmdToVideo, 'متحرك': cmdAnimSticker,
    'اسأل': cmdAsk, 'تخيل': cmdImagine, 'تلخيص': cmdSummarize, 'ترجمة': cmdTranslate,
    'صحح': (c) => cmdSimpleAI(c, SYSTEM + ' صحّح الإملاء والنحو في النص التالي وأعد النص المصحّح فقط ثم سطراً قصيراً بأهم التعديلات.', '📌 اكتب النص المراد تصحيحه بعد الأمر.'),
    'شرح': (c) => cmdSimpleAI(c, SYSTEM + ' اشرح الموضوع التالي بأسلوب مبسّط مع مثال قصير.', '📌 مثال: `.شرح الذكاء الاصطناعي`'),
    'اكتب': (c) => cmdSimpleAI(c, SYSTEM + ' اكتب النص المطلوب (منشور/رسالة/قصيدة/إعلان...) بأسلوب جميل جاهز للنشر.', '📌 مثال: `.اكتب منشور ترحيب بأعضاء الجروب`'),
    'كود': (c) => cmdSimpleAI(c, SYSTEM + ' أنت مبرمج خبير. أجب بكود صحيح داخل كتل مع شرح مختصر.', '📌 مثال: `.كود دالة جافاسكربت لعكس نص`'),
    'نسيان': async (c) => { memory.delete(c.sender); await c.reply('🧹 تم مسح ذاكرة محادثتك مع الذكاء الاصطناعي.'); }
};

for (const [k, fn] of Object.entries(buildMoreDownloadHandlers({ quotedText, getTarget, download }))) HANDLERS[k] = dlSafe(fn);

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

    if (HEAVY.has(name) && !(name === 'بحث_يوت' && args.startsWith('~'))) {
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

