// ============ lib/dl.js : محرّك التنزيل (يوتيوب فيديو/صوت + تلاوات القرآن) ============
// متغيرات بيئة اختيارية (Railway → Variables):
//   YTDLP_PATH         مسار yt-dlp إن كان مثبتاً عندك (وإلا يُنزَّل تلقائياً ويتحدّث وحده)
//   YT_COOKIES_B64     محتوى ملف cookies.txt مُرمَّزاً base64 (يحلّ حظر يوتيوب لسيرفرات الاستضافة)
//   YT_COOKIES_FILE    أو مسار ملف cookies.txt
//   YT_PROXY           بروكسي للتنزيل (اختياري)
//   YT_MAX_VIDEO_MIN   أقصى مدة فيديو بالدقائق (الافتراضي 30)
//   YT_MAX_AUDIO_MIN   أقصى مدة صوت بالدقائق (الافتراضي 90)
//   TILAWA_MAX_AYAT    أقصى عدد آيات في طلب واحد (الافتراضي 40)
//   DL_MAX_DOC_MB      أقصى حجم ملف يُرسل (الافتراضي 150)
//   DL_MAX_JOBS        أقصى تنزيلات متزامنة (الافتراضي 2)
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

const env = process.env;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BIN_DIR = path.join(ROOT, '.bin');
const FFMPEG = env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg');
const FFPROBE = env.FFPROBE_PATH || (path.basename(FFMPEG) === 'ffmpeg' ? path.join(path.dirname(FFMPEG), 'ffprobe') : 'ffprobe');
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const MB = 1024 * 1024;

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const LIM = {
    videoMin: num(env.YT_MAX_VIDEO_MIN, 30),
    audioMin: num(env.YT_MAX_AUDIO_MIN, 90),
    mediaMB: 64,                                  // أكبر من هذا يُرسل كملف (مستند) بدل وسائط
    docMB: num(env.DL_MAX_DOC_MB, 150),
    ayat: num(env.TILAWA_MAX_AYAT, 40),
    jobs: num(env.DL_MAX_JOBS, 2)
};

export class DlError extends Error {
    constructor(friendly, detail) { super(detail || friendly); this.name = 'DlError'; this.friendly = friendly; }
}

// ---------------------------------------------------------------- أدوات عامة
const run = (file, args, { timeout = 60000, cwd } = {}) => new Promise((resolve, reject) => {
    execFile(file, args, { timeout, cwd, maxBuffer: 128 * MB, windowsHide: true }, (err, stdout, stderr) => {
        if (err) { err.stdout = String(stdout || ''); err.stderr = String(stderr || ''); return reject(err); }
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} };
const mkjob = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dl_'));
const pad3 = (n) => String(n).padStart(3, '0');
const fmtDur = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const safeName = (s) => String(s || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';

// حدّ التنزيلات المتزامنة (يحمي ذاكرة وسرعة البوت)
let active = 0;
export async function withSlot(fn) {
    if (active >= LIM.jobs) throw new DlError('⏳ البوت مشغول بتنزيلات أخرى الآن، أعد المحاولة بعد قليل.');
    active++;
    try { return await fn(); } finally { active--; }
}

// ---------------------------------------------------------------- جلب HTTP (قابل للاستبدال في الاختبارات)
let fetchImpl = (...a) => fetch(...a);
export function _setFetch(fn) { fetchImpl = fn; }

async function getBuf(url, { timeout = 60000, max = LIM.docMB * MB, headers = {} } = {}) {
    let last;
    for (let i = 0; i < 2; i++) {
        try {
            const res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': UA, ...headers } });
            if (!res.ok) { const er = new Error('HTTP ' + res.status); er.status = res.status; throw er; }
            const len = Number(res.headers.get('content-length') || 0);
            if (len && len > max) throw new DlError('❌ حجم الملف كبير جداً للإرسال عبر واتساب.');
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > max) throw new DlError('❌ حجم الملف كبير جداً للإرسال عبر واتساب.');
            return buf;
        } catch (e) {
            last = e;
            if (e instanceof DlError || e?.name === 'TimeoutError' || (e?.status >= 400 && e?.status < 500)) break;
            await sleep(600 * (i + 1));
        }
    }
    throw last;
}
async function getJson(url, timeout = 30000) { return JSON.parse((await getBuf(url, { timeout, max: 20 * MB })).toString('utf8')); }
const isMp3 = (b) => !!b && b.length > 2000 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0));

async function mapLimit(items, limit, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
    }));
    return out;
}

// ================================================================ yt-dlp
const ytdlpAsset = () => {
    const { platform, arch } = process;
    if (platform === 'linux') return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : (arch === 'x64' ? 'yt-dlp_linux' : null);
    if (platform === 'darwin') return 'yt-dlp_macos';
    if (platform === 'win32') return 'yt-dlp.exe';
    return null;
};
const works = async (bin) => { try { await run(bin, ['--version'], { timeout: 25000 }); return true; } catch (e) { return false; } };

async function downloadYtdlp(file, asset) {
    const base = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const res = await fetchImpl(base + asset, { redirect: 'follow', signal: AbortSignal.timeout(240000) });
    if (!res.ok) throw new Error('YTDLP_DOWNLOAD_HTTP_' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    // تحقق من البصمة الرسمية قبل التشغيل
    const sumsRes = await fetchImpl(base + 'SHA2-256SUMS', { redirect: 'follow', signal: AbortSignal.timeout(60000) });
    if (!sumsRes.ok) throw new Error('YTDLP_SUMS_HTTP_' + sumsRes.status);
    const sums = await sumsRes.text();
    const m = new RegExp('^([0-9a-f]{64})\\s+\\*?' + asset.replace(/[.]/g, '\\.') + '\\s*$', 'mi').exec(sums);
    if (!m) throw new Error('YTDLP_SUM_MISSING');
    if (crypto.createHash('sha256').update(buf).digest('hex') !== m[1].toLowerCase()) throw new Error('YTDLP_SUM_MISMATCH');
    const tmp = file + '.part';
    fs.writeFileSync(tmp, buf, { mode: 0o755 });
    fs.renameSync(tmp, file);
    try { fs.chmodSync(file, 0o755); } catch (e) {}
}

let ytdlpPromise = null;
let ownBinary = false;
export function getYtdlp() {
    if (!ytdlpPromise) ytdlpPromise = resolveYtdlp().catch((e) => { ytdlpPromise = null; throw e; });
    return ytdlpPromise;
}
async function resolveYtdlp() {
    if (env.YTDLP_PATH) return env.YTDLP_PATH;
    const asset = ytdlpAsset();
    const file = path.join(BIN_DIR, asset === 'yt-dlp.exe' ? 'yt-dlp.exe' : 'yt-dlp');
    if (asset) {
        if (fs.existsSync(file) && await works(file)) { ownBinary = true; return file; }
        try {
            await downloadYtdlp(file, asset);
            if (await works(file)) { ownBinary = true; return file; }
            rmrf(file);
            console.error('[yt-dlp] الملف المنزَّل لا يعمل على هذا النظام');
        } catch (e) { console.error('[yt-dlp] فشل تنزيل الأداة:', e?.message || e); }
    }
    if (await works('yt-dlp')) return 'yt-dlp';           // احتياط: النسخة المثبتة على النظام
    throw new DlError('❌ أداة التنزيل غير جاهزة على السيرفر حالياً. أبلغ المطور.', 'YTDLP_UNAVAILABLE');
}

let lastUpdate = 0;
async function trySelfUpdate(bin) {
    if (!ownBinary || Date.now() - lastUpdate < 30 * 60 * 1000) return false;
    lastUpdate = Date.now();
    try { await run(bin, ['-U'], { timeout: 120000 }); return true; } catch (e) { console.error('[yt-dlp] فشل التحديث:', e?.message || e); return false; }
}
export async function warmupYtdlp() {
    const bin = await getYtdlp();
    // تحديث يومي للنسخة التي نملكها (يوتيوب يغيّر آلياته باستمرار)
    if (ownBinary) { try { if (Date.now() - fs.statSync(bin).mtimeMs > 24 * 3600 * 1000) await trySelfUpdate(bin); } catch (e) {} }
    return bin;
}

let cookiePath;
function cookiesFile() {
    if (cookiePath !== undefined) return cookiePath;
    cookiePath = null;
    try {
        if (env.YT_COOKIES_FILE && fs.existsSync(env.YT_COOKIES_FILE)) {
            cookiePath = path.join(os.tmpdir(), 'yt_cookies.txt');
            fs.copyFileSync(env.YT_COOKIES_FILE, cookiePath);
        } else if (env.YT_COOKIES_B64) {
            cookiePath = path.join(os.tmpdir(), 'yt_cookies.txt');
            fs.writeFileSync(cookiePath, Buffer.from(env.YT_COOKIES_B64, 'base64'), { mode: 0o600 });
        }
    } catch (e) { cookiePath = null; console.error('[yt-dlp] تعذر تجهيز الكوكيز:', e?.message); }
    return cookiePath;
}

let baseFlagsCache = null;
async function baseFlags(bin) {
    if (baseFlagsCache) return baseFlagsCache;
    const flags = ['--no-warnings', '--force-ipv4', '--socket-timeout', '30', '--retries', '3'];
    if (path.isAbsolute(FFMPEG)) flags.push('--ffmpeg-location', FFMPEG);
    if (env.YT_PROXY) flags.push('--proxy', env.YT_PROXY);
    const ck = cookiesFile(); if (ck) flags.push('--cookies', ck);
    // يوتيوب يحتاج بيئة JavaScript لفك التشفير: نمرّر node الحالي إن كانت النسخة تدعم الخيار
    const js = ['--js-runtimes', 'node:' + process.execPath];
    try { await run(bin, [...js, '--version'], { timeout: 25000 }); flags.push(...js); } catch (e) {}
    baseFlagsCache = flags;
    return flags;
}

function classifyYt(e) {
    const t = `${e?.stderr || ''}\n${e?.message || ''}`;
    const tail = t.replace(/\s+/g, ' ').trim().slice(-300);
    console.error('[yt-dlp]', t.slice(-700).trim());
    if (e instanceof DlError) return { err: e, retry: false, bot: false };
    const mk = (m, { retry = false, bot = false } = {}) => {
        const err = new DlError(m, 'YTDLP_FAIL'); err.debug = tail; err.soft = retry || bot;
        return { err, retry, bot };
    };
    if (e?.code === 'ENOENT') return mk('❌ أداة التنزيل غير جاهزة على السيرفر. أبلغ المطور.');
    if (e?.killed || e?.signal === 'SIGTERM') return mk('⏱️ انتهت مهلة التنزيل، جرّب فيديو أقصر.');
    if (/not a bot|confirm you.{1,3}re not/i.test(t)) return mk('❌ يوتيوب يمنع التنزيل من هذا السيرفر حالياً (يطلب التحقق). أبلغ المطور ليضيف ملف كوكيز.', { bot: true });
    if (/confirm your age|age.restricted|inappropriate for some users/i.test(t)) return mk('🔞 هذا الفيديو مقيّد بالعمر ولا يمكن تنزيله.');
    if (/private video|video is private/i.test(t)) return mk('🔒 هذا الفيديو خاص.');
    if (/members.only|join this channel/i.test(t)) return mk('🔒 هذا الفيديو لأعضاء القناة فقط.');
    if (/live event|is live|premieres in|will begin in/i.test(t)) return mk('📡 البث المباشر/العرض الأول غير مدعوم، جرّب فيديو عادياً.');
    if (/not available in your country|blocked it in your country|geo.?restrict/i.test(t)) return mk('🌍 هذا الفيديو محجوب في بلد السيرفر.');
    if (/video unavailable|has been removed|no longer available|account .* terminated|not available/i.test(t)) return mk('❌ الفيديو غير متاح أو محذوف.');
    return mk('❌ تعذر التنزيل من يوتيوب. حاول مرة أخرى بعد قليل.', { retry: true });
}

// يوتيوب يحجب عملاء معيّنين عن بعض الـIPs: نجرّب مجموعات عملاء مختلفة قبل الاستسلام
const CLIENT_SETS = [null, 'tv,web_safari,web_embedded', 'android_vr,mweb'];
async function ytdlp(args, { timeout = 120000, retryUpdate = true } = {}) {
    const bin = await getYtdlp();
    const flags = await baseFlags(bin);
    const pot = env.YT_POT_URL ? ['--extractor-args', 'youtubepot-bgutilhttp:base_url=' + env.YT_POT_URL] : [];
    let last;
    for (const cs of CLIENT_SETS) {
        const extra = cs ? ['--extractor-args', 'youtube:player_client=' + cs] : [];
        try { return await run(bin, [...flags, ...pot, ...extra, ...args], { timeout }); }
        catch (e) {
            last = classifyYt(e);
            if (!last.retry && !last.bot) throw last.err;     // أخطاء نهائية: لا فائدة من التبديل
        }
    }
    if (last.retry && retryUpdate && await trySelfUpdate(bin)) return ytdlp(args, { timeout, retryUpdate: false });
    throw last.err;
}

// ---------------------------------------------------------------- يوتيوب: إدخال/بحث/معلومات
const YT_RE = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s]*?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/i;
export function parseYtInput(text) {
    const m = YT_RE.exec(String(text || ''));
    return m ? { id: m[1], url: 'https://www.youtube.com/watch?v=' + m[1] } : null;
}
const goodDur = (d) => d && d !== 'NA' && d !== 'None' && Number(d) > 0;

async function searchYt(q) {
    const out = await ytdlp(['--flat-playlist', '--playlist-items', '1-5', '--print', '%(id)s\t%(duration)s\t%(live_status)s', 'ytsearch5:' + q.slice(0, 200)], { timeout: 60000 });
    const rows = out.stdout.split('\n').map((l) => l.trim().split('\t')).filter((r) => /^[\w-]{11}$/.test(r[0] || ''));
    if (!rows.length) throw new DlError('❌ لم أجد نتائج لهذا البحث، جرّب كلمات أخرى أو ضع الرابط مباشرة.');
    const pick = rows.find((r) => goodDur(r[1]) && !/is_live|is_upcoming/.test(r[2] || '')) || rows[0];
    return pick[0];
}
// بديل بلا yt-dlp: يقرأ صفحة نتائج يوتيوب مباشرة (يعمل غالباً حتى لو حُظرت أداة التنزيل)
async function searchYtScrape(q) {
    const url = 'https://www.youtube.com/results?hl=en&sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q.slice(0, 200));
    const html = (await getBuf(url, { timeout: 20000, max: 8 * MB, headers: { 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI' } })).toString('utf8');
    const m = /"videoRenderer":\{"videoId":"([\w-]{11})"/.exec(html) || /"videoId":"([\w-]{11})"/.exec(html);
    if (!m) throw new DlError('❌ لم أجد نتائج لهذا البحث، جرّب كلمات أخرى أو ضع الرابط مباشرة.');
    return m[1];
}

async function ytInfo(id) {
    const url = 'https://www.youtube.com/watch?v=' + id;
    const out = await ytdlp(['-J', '--no-playlist', '--skip-download', url], { timeout: 90000 });
    let j;
    try { j = JSON.parse(out.stdout); } catch (e) { throw new DlError('❌ تعذر قراءة معلومات الفيديو.'); }
    return {
        id: j.id || id, url, title: String(j.title || 'YouTube'),
        channel: String(j.channel || j.uploader || ''), duration: Number(j.duration) || 0,
        live: !!j.is_live || j.live_status === 'is_live' || j.live_status === 'is_upcoming'
    };
}
// بديل: العنوان والقناة عبر oEmbed الرسمي (لا يعطي المدة)
async function ytInfoOembed(id) {
    const url = 'https://www.youtube.com/watch?v=' + id;
    const j = await getJson('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url), 20000);
    return { id, url, title: String(j.title || 'YouTube'), channel: String(j.author_name || ''), duration: 0, live: false, basic: true };
}

export async function resolveYt(input) {
    const q = String(input || '').trim();
    const direct = parseYtInput(q);
    let id = direct?.id;
    if (!id) {
        if (/^https?:\/\//i.test(q)) throw new DlError('❌ الرابط ليس رابط يوتيوب.');
        try { id = await searchYt(q); }
        catch (e) { if (!e?.soft) throw e; id = await searchYtScrape(q).catch(() => { throw e; }); }
    }
    try { return await ytInfo(id); }
    catch (e) { if (!e?.soft) throw e; return await ytInfoOembed(id).catch(() => { throw e; }); }
}

function guard(info, kind) {
    if (info.live) throw new DlError('📡 البث المباشر غير مدعوم، جرّب فيديو عادياً.');
    const max = kind === 'audio' ? LIM.audioMin : LIM.videoMin;
    if (info.duration && info.duration > max * 60) throw new DlError(`⏱️ المقطع طويل (${fmtDur(info.duration)}). الحد الأقصى ${max} دقيقة.`);
}
function findOut(dir, exts) {
    const f = fs.readdirSync(dir).find((n) => exts.includes(path.extname(n).toLowerCase()) && !n.endsWith('.part'));
    return f ? path.join(dir, f) : null;
}
async function probeCodec(file, stream) {
    try {
        const { stdout } = await run(FFPROBE, ['-v', 'error', '-select_streams', stream, '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file], { timeout: 30000 });
        return stdout.trim().split('\n')[0].trim() || null;
    } catch (e) { return null; }
}
// واتساب يشغّل فقط H.264 + AAC داخل mp4 (يوتيوب أحياناً يعطي VP9/AV1/Opus)
async function ensureWhatsAppMp4(file, dir) {
    const vc = await probeCodec(file, 'v:0'), ac = await probeCodec(file, 'a:0');
    if (!vc) return file;                                // ffprobe غير متاح: لا نعبث بالملف
    if (vc === 'h264' && (ac === 'aac' || !ac) && file.toLowerCase().endsWith('.mp4')) return file;
    const out = path.join(dir, 'wa.mp4');
    const v = vc === 'h264' ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p'];
    const a = (ac === 'aac' || !ac) ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '128k'];
    await run(FFMPEG, ['-y', '-v', 'error', '-i', file, ...v, ...a, '-movflags', '+faststart', out], { timeout: 25 * 60 * 1000 });
    return out;
}
async function ensureMp3(file, dir) {
    const head = fs.readFileSync(file).subarray(0, 4);
    if (isMp3(Buffer.concat([head, Buffer.alloc(3000)])) && file.toLowerCase().endsWith('.mp3')) return file;
    const out = path.join(dir, 'a.mp3');
    await run(FFMPEG, ['-y', '-v', 'error', '-i', file, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', out], { timeout: 25 * 60 * 1000 });
    return out;
}
const finishFile = (file) => {
    const buf = fs.readFileSync(file);
    if (buf.length > LIM.docMB * MB) throw new DlError('❌ حجم الملف كبير جداً للإرسال عبر واتساب، جرّب مقطعاً أقصر.');
    return buf;
};

// ---- بديل اختياري: خادم cobalt (COBALT_API_URL / COBALT_API_KEY) عندما يحجب يوتيوب أداة التنزيل
async function cobaltFetch(info, kind, dir) {
    const base = env.COBALT_API_URL;
    if (!base) return null;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA };
    if (env.COBALT_API_KEY) headers.Authorization = 'Api-Key ' + env.COBALT_API_KEY;
    const body = kind === 'audio'
        ? { url: info.url, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }
        : { url: info.url, downloadMode: 'auto', videoQuality: '720', youtubeVideoCodec: 'h264', filenameStyle: 'basic' };
    const res = await fetchImpl(base.replace(/\/+$/, '') + '/', { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const j = await res.json().catch(() => null);
    if (!j || !['tunnel', 'redirect', 'stream'].includes(j.status) || !j.url) throw new Error('COBALT_' + (j?.error?.code || j?.status || res.status));
    const buf = await getBuf(j.url, { timeout: 20 * 60 * 1000, max: LIM.docMB * MB });
    const file = path.join(dir, kind === 'audio' ? 'cobalt.bin' : 'cobalt.mp4');
    fs.writeFileSync(file, buf);
    return file;
}

// ---------------------------------------------------------------- يوتيوب: صوت
export async function ytAudio(input, { onInfo } = {}) {
    const info = await resolveYt(input);
    guard(info, 'audio');
    if (onInfo) { try { await onInfo(info, fmtDur); } catch (e) {} }
    const dir = mkjob();
    try {
        let file;
        try {
            await ytdlp(['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '128K', '--no-playlist', '-o', path.join(dir, 'media.%(ext)s'), info.url], { timeout: 25 * 60 * 1000 });
            file = findOut(dir, ['.mp3']);
            if (!file) throw new DlError('❌ فشل تحويل الصوت.');
        } catch (e) {
            if (!e?.soft) throw e;
            let alt = null;
            try { alt = await cobaltFetch(info, 'audio', dir); } catch (e2) { console.error('[cobalt]', e2?.message || e2); }
            if (!alt) throw e;
            file = await ensureMp3(alt, dir);
        }
        const buffer = finishFile(file);
        return { info, buffer, mime: 'audio/mpeg', fileName: safeName(info.title) + '.mp3', asDocument: buffer.length > LIM.mediaMB * MB };
    } finally { rmrf(dir); }
}

// ---------------------------------------------------------------- يوتيوب: فيديو
export async function ytVideo(input, { onInfo } = {}) {
    const info = await resolveYt(input);
    guard(info, 'video');
    if (onInfo) { try { await onInfo(info, fmtDur); } catch (e) {} }
    // جودة تتناسب مع المدة حتى يبقى الحجم مناسباً لواتساب
    const h = !info.duration ? 480 : info.duration <= 240 ? 720 : info.duration <= 600 ? 480 : 360;
    const sel = [
        `bv*[vcodec^=avc1][height<=${h}]+ba[ext=m4a]`, `b[vcodec^=avc1][height<=${h}][ext=mp4]`,
        `bv*[height<=${h}]+ba`, `b[height<=${h}]`, 'b'
    ].join('/');
    const dir = mkjob();
    try {
        let file;
        try {
            await ytdlp(['-f', sel, '--merge-output-format', 'mp4', '--no-playlist', '-o', path.join(dir, 'media.%(ext)s'), info.url], { timeout: 25 * 60 * 1000 });
            file = findOut(dir, ['.mp4', '.mkv', '.webm', '.mov']);
            if (!file) throw new DlError('❌ فشل تنزيل الفيديو.');
        } catch (e) {
            if (!e?.soft) throw e;
            let alt = null;
            try { alt = await cobaltFetch(info, 'video', dir); } catch (e2) { console.error('[cobalt]', e2?.message || e2); }
            if (!alt) throw e;
            file = alt;
        }
        file = await ensureWhatsAppMp4(file, dir);
        const buffer = finishFile(file);
        return { info, buffer, mime: 'video/mp4', fileName: safeName(info.title) + '.mp4', asDocument: buffer.length > LIM.mediaMB * MB };
    } finally { rmrf(dir); }
}

// ================================================================ التلاوات
export const SURAHS = ['الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'];
export const AYAH_COUNTS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];
const SURAH_ALIASES = { 1: ['فاتحه', 'الحمد'], 2: ['بقره'], 3: ['عمران'], 9: ['براءه'], 17: ['بني اسرائيل'], 18: ['كهف'], 32: ['الم السجده'], 36: ['ياسين'], 40: ['المؤمن'], 41: ['حم السجده'], 67: ['تبارك'], 68: ['ن'], 78: ['عم'], 112: ['الاخلاص', 'قل هو الله احد'] };

const norm = (s) => String(s || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .toLowerCase().replace(/\s+/g, ' ').trim();
const squash = (s) => norm(s).replace(/\s+/g, '');

const SURAH_KEYS = new Map();   // الاسم المطبَّع -> رقم السورة
SURAHS.forEach((name, i) => {
    const n = norm(name);
    SURAH_KEYS.set(n, i + 1);
    if (/^ال\S/.test(n)) SURAH_KEYS.set(n.slice(2), i + 1);
    for (const a of (SURAH_ALIASES[i + 1] || [])) SURAH_KEYS.set(norm(a), i + 1);
});
const MAX_SURAH_WORDS = 4;
export const surahStart = (s) => { let t = 0; for (let i = 0; i < s - 1; i++) t += AYAH_COUNTS[i]; return t; };   // عدد الآيات قبل السورة

// ever: مجلدات everyayah مرتبة بالأفضلية (نجرّب بالتتابع) | edition: إصدار alquran.cloud | q: اسم مميّز للبحث في mp3quran
export const RECITERS = [
    { name: 'مشاري راشد العفاسي', al: ['العفاسي', 'عفاسي', 'مشاري', 'afasy', 'alafasy'], ever: ['Alafasy_128kbps', 'Alafasy_64kbps'], edition: 'ar.alafasy', q: 'العفاسي' },
    { name: 'عبدالرحمن السديس', al: ['السديس', 'سديس', 'sudais'], ever: ['Abdurrahmaan_As-Sudais_192kbps', 'Abdurrahmaan_As-Sudais_64kbps'], edition: 'ar.abdurrahmaansudais', q: 'السديس' },
    { name: 'سعود الشريم', al: ['الشريم', 'شريم', 'shuraim'], ever: ['Saood_ash-Shuraym_128kbps', 'Saood_ash-Shuraym_64kbps'], edition: 'ar.saoodshuraym', q: 'الشريم' },
    { name: 'ماهر المعيقلي', al: ['المعيقلي', 'معيقلي', 'ماهر', 'maher'], ever: ['Maher_AlMuaiqly_64kbps', 'MaherAlMuaiqly128kbps', 'Maher_AlMuaiqly_128kbps'], edition: 'ar.mahermuaiqly', q: 'المعيقلي' },
    { name: 'عبدالباسط عبدالصمد', al: ['عبدالباسط', 'باسط', 'basit'], ever: ['Abdul_Basit_Murattal_192kbps', 'Abdul_Basit_Murattal_64kbps'], edition: 'ar.abdulbasitmurattal', q: 'عبدالباسط' },
    { name: 'محمد صديق المنشاوي', al: ['المنشاوي', 'منشاوي', 'minshawi'], ever: ['Minshawy_Murattal_128kbps'], edition: 'ar.minshawi', q: 'المنشاوي' },
    { name: 'محمود خليل الحصري', al: ['الحصري', 'حصري', 'husary'], ever: ['Husary_64kbps', 'Husary_128kbps'], edition: 'ar.husary', q: 'الحصري' },
    { name: 'سعد الغامدي', al: ['الغامدي', 'غامدي', 'ghamdi'], ever: ['Ghamadi_40kbps'], edition: null, q: 'سعدالغامدي' },
    { name: 'هاني الرفاعي', al: ['الرفاعي', 'رفاعي', 'rifai'], ever: ['Hani_Rifai_192kbps', 'Hani_Rifai_64kbps'], edition: 'ar.hanirifai', q: 'الرفاعي' },
    { name: 'أبو بكر الشاطري', al: ['الشاطري', 'شاطري', 'shatri'], ever: ['Abu_Bakr_Ash-Shaatree_128kbps', 'Abu_Bakr_Ash-Shaatree_64kbps'], edition: 'ar.shaatree', q: 'الشاطري' },
    { name: 'ياسر الدوسري', al: ['الدوسري', 'دوسري', 'ياسر', 'dossari'], ever: ['Yasser_Ad-Dussary_128kbps'], edition: null, q: 'الدوسري' },
    { name: 'ناصر القطامي', al: ['القطامي', 'قطامي', 'ناصر', 'qatami'], ever: ['Nasser_Alqatami_128kbps'], edition: null, q: 'القطامي' },
    { name: 'أحمد العجمي', al: ['العجمي', 'عجمي', 'ajmi'], ever: ['Ahmed_ibn_Ali_al-Ajamy_128kbps_ketab.net'], edition: 'ar.ahmedajamy', q: 'العجمي' }
];
const RECITER_LIST = RECITERS.map((r) => '• ' + r.name).join('\n');

const TILAWA_USAGE = `🕌 *تلاوة القرآن:*\n\n> .تلاوة الكهف ↞ السورة كاملة\n> .تلاوة البقرة 255 ↞ آية واحدة\n> .تلاوة الفاتحة 1-7 ↞ مجموعة آيات (حتى ${LIM.ayat} آية)\n> .تلاوة الكهف السديس ↞ السورة بصوت قارئ آخر\n> .تلاوة البقرة 255-257 ماهر ↞ آيات بصوت قارئ محدد\n\n🎙️ *القرّاء:*\n${RECITER_LIST}\n\nالقارئ الافتراضي: مشاري العفاسي.`;

const STOP = new Set(['بصوت', 'قارئ', 'القارئ', 'الشيخ', 'للشيخ', 'سوره', 'سورة', 'اية', 'ايه', 'آية', 'الايه', 'الاية', 'ايات', 'الايات', 'من']);

export function parseTilawa(text) {
    let s = norm(text).replace(/[–—−]/g, '-').replace(/(\d+)\s*(?:الي|الى)\s*(\d+)/g, '$1-$2').replace(/\s*-\s*/g, '-');
    let toks = s.split(' ').filter(Boolean).filter((t) => !STOP.has(t));
    if (!toks.length) throw new DlError(TILAWA_USAGE);

    let surah = 0, used = 0;
    if (/^\d+$/.test(toks[0])) {
        surah = Number(toks[0]); used = 1;
        if (surah < 1 || surah > 114) throw new DlError('❌ رقم السورة يجب أن يكون بين 1 و114.');
    } else {
        for (let n = Math.min(MAX_SURAH_WORDS, toks.length); n >= 1 && !surah; n--) {
            const k = SURAH_KEYS.get(toks.slice(0, n).join(' '));
            if (k) { surah = k; used = n; }
        }
        if (!surah) throw new DlError(`❌ لم أتعرّف على اسم السورة «${text.trim().split(/\s+/)[0]}».\nاكتب اسم السورة أولاً، مثال: \`.تلاوة الكهف\``);
    }
    const rest = toks.slice(used);
    let from = 0, to = 0; const words = [];
    for (const t of rest) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(t);
        if (m && !from) { from = Number(m[1]); to = m[2] ? Number(m[2]) : from; }
        else words.push(t);
    }
    const max = AYAH_COUNTS[surah - 1];
    if (from) {
        if (from < 1 || to < from || to > max) throw new DlError(`❌ سورة ${SURAHS[surah - 1]} فيها ${max} آية فقط. تأكد من رقم الآية.`);
        if (to - from + 1 > LIM.ayat) throw new DlError(`❌ الحد الأقصى ${LIM.ayat} آية في الطلب الواحد. للسورة كاملة اكتب: \`.تلاوة ${SURAHS[surah - 1]}\``);
    }
    const query = words.join(' ');
    let reciter = null;
    if (query) {
        const sq = squash(query);
        reciter = RECITERS.find((r) => r.al.some((a) => sq.includes(squash(a)) || (sq.length >= 3 && squash(a).includes(sq)))) || null;
    } else reciter = RECITERS[0];
    return { surah, from, to, query, reciter, surahName: SURAHS[surah - 1] };
}

// ---- mp3quran (روابط السور الكاملة، تُجلب حيّة لتبقى صحيحة)
let mp3qCache = { at: 0, data: null };
async function mp3quranReciters() {
    if (mp3qCache.data && Date.now() - mp3qCache.at < 6 * 3600 * 1000) return mp3qCache.data;
    let j = null, last;
    for (const u of ['https://www.mp3quran.net/api/v3/reciters?language=ar', 'https://mp3quran.net/api/v3/reciters?language=ar']) {
        try { j = await getJson(u, 40000); if (Array.isArray(j?.reciters)) break; } catch (e) { last = e; }
    }
    if (!Array.isArray(j?.reciters)) throw last || new Error('MP3QURAN_BAD_JSON');
    mp3qCache = { at: Date.now(), data: j.reciters };
    return j.reciters;
}
async function mp3quranUrl(surah, q) {
    const key = squash(q);
    if (key.length < 3) return null;
    const list = await mp3quranReciters();
    for (const r of list.filter((x) => squash(x.name).includes(key))) {
        const cands = (r.moshaf || []).filter((m) => m.server && String(m.surah_list || '').split(',').map((x) => x.trim()).includes(String(surah)));
        const ok = (m) => !/مجود|تجويد|ورش|قالون|دوري|سوسي|شعبه|بزي|قنبل/.test(norm(m.name));
        const m = cands.find((x) => /حفص/.test(norm(x.name)) && ok(x)) || cands.find(ok) || cands[0];
        if (m) return { url: String(m.server).replace(/\/?$/, '/') + pad3(surah) + '.mp3', who: r.name };
    }
    return null;
}

async function concatMp3(bufs) {
    const dir = mkjob();
    try {
        const files = bufs.map((b, i) => { const f = path.join(dir, `p${String(i).padStart(3, '0')}.mp3`); fs.writeFileSync(f, b); return f; });
        const list = path.join(dir, 'list.txt'), out = path.join(dir, 'out.mp3');
        fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
        try { await run(FFMPEG, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { timeout: 120000 }); }
        catch (e) { await run(FFMPEG, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '128k', out], { timeout: 180000 }); }
        const buf = fs.readFileSync(out);
        if (!isMp3(buf)) throw new Error('CONCAT_BAD_OUTPUT');
        return buf;
    } finally { rmrf(dir); }
}

// يُرجع Buffer أو null (مع تسجيل أسباب الفشل في trail)
async function ayahAudio(req, trail) {
    const rec = req.reciter;
    const nums = []; for (let a = req.from; a <= req.to; a++) nums.push(a);
    const sources = rec.ever.map((f) => ({ id: 'everyayah/' + f, url: (a) => `https://everyayah.com/data/${f}/${pad3(req.surah)}${pad3(a)}.mp3` }));
    if (rec.edition) for (const br of [128, 64]) sources.push({ id: 'islamic.network/' + br, url: (a) => `https://cdn.islamic.network/quran/audio/${br}/${rec.edition}/${surahStart(req.surah) + a}.mp3` });
    for (const src of sources) {
        try {
            const get = async (a) => {
                const b = await getBuf(src.url(a), { timeout: 45000, max: 20 * MB });
                if (!isMp3(b)) throw new Error('NOT_MP3');
                return b;
            };
            const first = await get(nums[0]);                         // نختبر المصدر بأول آية قبل جلب الباقي
            const rest = await mapLimit(nums.slice(1), 5, get);
            const bufs = [first, ...rest];
            return bufs.length === 1 ? bufs[0] : await concatMp3(bufs);
        } catch (e) { trail.push(`${src.id}: ${e?.message || e}`); console.error('[تلاوة آيات]', src.id, e?.message || e); }
    }
    return null;
}

async function surahAudio(req, trail) {
    const rec = req.reciter;
    const urls = [];
    try {
        const r = await mp3quranUrl(req.surah, rec ? rec.q : req.query);
        if (r) urls.push({ id: 'mp3quran', url: r.url });
        else if (!rec) throw new DlError(`❌ لم أجد قارئاً باسم «${req.query}».\n\n🎙️ *القرّاء المتاحون:*\n${RECITER_LIST}`);
        else trail.push('mp3quran: القارئ/السورة غير موجود');
    } catch (e) { if (e instanceof DlError) throw e; trail.push('mp3quran-api: ' + (e?.message || e)); console.error('[تلاوة] mp3quran:', e?.message || e); }
    if (rec?.edition) for (const br of [128, 64]) urls.push({ id: 'islamic-surah/' + br, url: `https://cdn.islamic.network/quran/audio-surah/${br}/${rec.edition}/${req.surah}.mp3` });
    for (const u of urls) {
        try {
            const b = await getBuf(u.url, { timeout: 30 * 60 * 1000, max: LIM.docMB * MB });
            if (isMp3(b)) return b;
            trail.push(u.id + ': NOT_MP3');
        } catch (e) {
            if (e instanceof DlError) throw e;
            trail.push(`${u.id}: ${e?.message || e}`); console.error('[تلاوة]', u.id, e?.message || e);
        }
    }
    // احتياط أخير: السور القصيرة تُجمَّع من الآيات
    if (rec && AYAH_COUNTS[req.surah - 1] <= 60) {
        const b = await ayahAudio({ ...req, from: 1, to: AYAH_COUNTS[req.surah - 1] }, trail);
        if (b) return b;
    }
    return null;
}

export async function tilawa(text, { onStart } = {}) {
    const req = parseTilawa(text);
    const who = req.reciter ? req.reciter.name : req.query;
    const what = req.from ? `سورة ${req.surahName} • ${req.from === req.to ? 'الآية ' + req.from : `الآيات ${req.from}-${req.to}`}` : `سورة ${req.surahName} كاملة`;
    if (onStart) { try { await onStart(`🕌 *${what}*\n🎙️ ${who}\n⏳ جاري التجهيز...`); } catch (e) {} }
    if (req.from && !req.reciter) throw new DlError(`❌ لتلاوة الآيات اختر قارئاً من القائمة:\n${RECITER_LIST}`);
    const trail = [];
    const buffer = req.from ? await ayahAudio(req, trail) : await surahAudio(req, trail);
    if (!buffer) {
        const err = new DlError('❌ تعذر جلب التلاوة الآن من المصادر المتاحة. جرّب قارئاً آخر أو أعد المحاولة بعد قليل.');
        err.debug = trail.join(' | ');
        throw err;
    }
    return {
        buffer, mime: 'audio/mpeg', asDocument: buffer.length > LIM.mediaMB * MB,
        fileName: safeName(`${req.surahName}${req.from ? ` ${req.from}${req.to !== req.from ? '-' + req.to : ''}` : ''} - ${who}`) + '.mp3',
        caption: `🕌 ${what}\n🎙️ ${who}`
    };
}

// ================================================================ فحص ذاتي (للمطور): أي مصدر يعمل وأيّه يفشل ولماذا
export async function diagnose() {
    const L = [];
    const t = async (name, fn) => {
        const t0 = Date.now();
        try { const r = await fn(); L.push(`✅ ${name}${r ? ' — ' + r : ''} (${Date.now() - t0}ms)`); }
        catch (e) { L.push(`❌ ${name} — ${String(e?.debug || e?.stderr || e?.friendly || e?.message || e).replace(/\s+/g, ' ').slice(-170)}`); }
    };
    await t('أداة yt-dlp', async () => { const b = await getYtdlp(); const r = await run(b, ['--version'], { timeout: 30000 }); return r.stdout.trim() + (ownBinary ? ' (مُنزَّلة)' : ' (نظام)'); });
    await t('ffmpeg', async () => (await run(FFMPEG, ['-version'], { timeout: 15000 })).stdout.split('\n')[0].slice(0, 40));
    await t('يوتيوب: معلومات فيديو (yt-dlp)', async () => (await ytInfo('dQw4w9WgXcQ')).title.slice(0, 28));
    await t('يوتيوب: معلومات بديلة (oEmbed)', async () => (await ytInfoOembed('dQw4w9WgXcQ')).title.slice(0, 28));
    await t('يوتيوب: بحث بديل (صفحة النتائج)', async () => (await searchYtScrape('quran')).toString());
    await t('تلاوة: everyayah', async () => { const b = await getBuf('https://everyayah.com/data/Alafasy_128kbps/001001.mp3', { timeout: 25000, max: 5 * MB }); if (!isMp3(b)) throw new Error('ليس mp3'); return Math.round(b.length / 1024) + 'KB'; });
    await t('تلاوة: islamic.network', async () => { const b = await getBuf('https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3', { timeout: 25000, max: 5 * MB }); if (!isMp3(b)) throw new Error('ليس mp3'); return Math.round(b.length / 1024) + 'KB'; });
    await t('تلاوة: mp3quran (قائمة القرّاء)', async () => { const l = await mp3quranReciters(); const u = await mp3quranUrl(18, 'العفاسي'); return `${l.length} قارئ، الكهف: ${u ? 'موجود' : 'غير موجود'}`; });
    L.push(`\nكوكيز: ${cookiesFile() ? 'مفعّلة' : 'لا'} | بروكسي: ${env.YT_PROXY ? 'نعم' : 'لا'} | cobalt: ${env.COBALT_API_URL ? 'نعم' : 'لا'} | PO-token: ${env.YT_POT_URL ? 'نعم' : 'لا'}`);
    return L.join('\n');
}

export const _test = { norm, squash, isMp3, LIM, concatMp3 };
