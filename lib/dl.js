// ============ lib/dl.js : محرّك يوتيوب (بحث متعدد النتائج + تنزيل بجودة يختارها العضو) ============
// متغيرات بيئة اختيارية (Railway → Variables):
//   YTDLP_PATH         مسار yt-dlp إن كان مثبتاً عندك (وإلا يُنزَّل تلقائياً ويتحدّث وحده)
//   YT_COOKIES_B64     محتوى ملف cookies.txt مُرمَّزاً base64 (يحلّ حظر يوتيوب لسيرفرات الاستضافة)
//   YT_COOKIES_FILE    أو مسار ملف cookies.txt
//   YT_PROXY           بروكسي للتنزيل (اختياري)
//   YT_MAX_VIDEO_MIN   أقصى مدة فيديو بالدقائق (الافتراضي 60)
//   YT_MAX_AUDIO_MIN   أقصى مدة صوت بالدقائق (الافتراضي 90)
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
    videoMin: num(env.YT_MAX_VIDEO_MIN, 60),
    audioMin: num(env.YT_MAX_AUDIO_MIN, 90),
    videoMB: num(env.DL_MAX_VIDEO_MB, 95),        // الفيديو الأكبر من هذا يُضغط تلقائياً ليبقى فيديو جاهزاً في واتساب (لا يُرسل كملف)
    docMB: num(env.DL_MAX_DOC_MB, 150),
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
    if (/requested format is not available|no video formats|only images are available|sign in to confirm|HTTP Error 403|unable to download/i.test(t)) return mk('❌ تعذر التنزيل من يوتيوب. حاول مرة أخرى بعد قليل.', { retry: true });
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

// ---------------------------------------------------------------- تنسيقات
export const fmtDuration = (s) => (s && s > 0 ? fmtDur(s) : '--:--');
export function fmtViews(n) {
    n = Number(n);
    if (!Number.isFinite(n) || n < 0) return '0';
    const f = (v, u) => (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') + u;
    if (n >= 1e9) return f(n / 1e9, 'B');
    if (n >= 1e6) return f(n / 1e6, 'M');
    if (n >= 1e3) return f(n / 1e3, 'K');
    return String(Math.round(n));
}

// ---------------------------------------------------------------- يوتيوب: إدخال/بحث/معلومات
const YT_RE = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s]*?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/i;
export function parseYtInput(text) {
    const m = YT_RE.exec(String(text || ''));
    return m ? { id: m[1], url: 'https://www.youtube.com/watch?v=' + m[1] } : null;
}
export const isYtId = (s) => /^[\w-]{11}$/.test(String(s || ''));

// ذاكرة مؤقتة لنتائج البحث حتى لا نعيد جلب العنوان والمدة عند اختيار العضو (تسقط بعد 3 ساعات)
const INFO_CACHE = new Map();
const INFO_TTL = 3 * 3600 * 1000;
function remember(info) {
    INFO_CACHE.set(info.id, { at: Date.now(), info });
    while (INFO_CACHE.size > 400) INFO_CACHE.delete(INFO_CACHE.keys().next().value);
    return info;
}
const recall = (id) => {
    const e = INFO_CACHE.get(id);
    if (!e) return null;
    if (Date.now() - e.at > INFO_TTL) { INFO_CACHE.delete(id); return null; }
    return e.info;
};
const mkInfo = (o) => ({
    id: o.id, url: 'https://www.youtube.com/watch?v=' + o.id,
    title: String(o.title || 'YouTube'), channel: String(o.channel || ''),
    duration: Number(o.duration) > 0 ? Number(o.duration) : 0,
    views: Number.isFinite(Number(o.views)) && o.views !== null && o.views !== undefined ? Number(o.views) : null,
    live: !!o.live
});

// بحث عبر yt-dlp (يعطي العنوان والمدة والمشاهدات)
async function searchYtDlp(q, n) {
    const out = await ytdlp(['--flat-playlist', '-j', `ytsearch${n}:${q.slice(0, 200)}`], { timeout: 60000 });
    const items = [];
    for (const line of out.stdout.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('{')) continue;
        let j; try { j = JSON.parse(t); } catch (e) { continue; }
        if (!isYtId(j.id)) continue;
        const live = j.live_status === 'is_live' || j.live_status === 'is_upcoming';
        if (live) continue;
        items.push(mkInfo({ id: j.id, title: j.title, duration: j.duration, views: j.view_count ?? null, channel: j.channel || j.uploader }));
    }
    return items;
}

// بديل بلا yt-dlp: يقرأ صفحة نتائج يوتيوب مباشرة (يعمل غالباً حتى لو حُظرت أداة التنزيل)
function collectRenderers(o, out) {
    if (!o || typeof o !== 'object') return;
    if (o.videoRenderer && o.videoRenderer.videoId) out.push(o.videoRenderer);
    for (const k of Object.keys(o)) collectRenderers(o[k], out);
}
const durToSec = (t) => String(t || '').split(':').map(Number).reduce((a, x) => (Number.isFinite(x) ? a * 60 + x : NaN), 0);
async function searchYtScrape(q, n) {
    const url = 'https://www.youtube.com/results?hl=en&sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q.slice(0, 200));
    const html = (await getBuf(url, { timeout: 20000, max: 8 * MB, headers: { 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI' } })).toString('utf8');
    const m = /ytInitialData\s*=\s*/.exec(html);
    if (!m) return [];
    const start = html.indexOf('{', m.index + m[0].length - 1);
    const end = html.indexOf(';</script>', start);
    if (start < 0 || end < 0) return [];
    let data; try { data = JSON.parse(html.slice(start, end)); } catch (e) { return []; }
    const rs = []; collectRenderers(data, rs);
    const seen = new Set(), items = [];
    for (const r of rs) {
        if (seen.has(r.videoId) || !isYtId(r.videoId)) continue;
        seen.add(r.videoId);
        const lenText = r.lengthText?.simpleText;
        if (!lenText) continue;                                  // بلا مدة = بث مباشر/عرض أول
        const vt = r.viewCountText?.simpleText || '';
        const digits = vt.replace(/[^\d]/g, '');
        items.push(mkInfo({
            id: r.videoId,
            title: (r.title?.runs || []).map((x) => x.text).join('') || r.title?.simpleText,
            duration: durToSec(lenText), views: digits ? Number(digits) : 0,
            channel: r.ownerText?.runs?.[0]?.text || r.longBylineText?.runs?.[0]?.text
        }));
        if (items.length >= n) break;
    }
    return items;
}

// يرجع قائمة نتائج (حتى n) مع العنوان والمدة والمشاهدات
export async function searchVideos(query, n = 6) {
    const q = String(query || '').trim();
    let items = [], firstErr;
    try { items = await searchYtDlp(q, n); }
    catch (e) { if (!e?.soft) throw e; firstErr = e; }
    if (!items.length) {
        try { items = await searchYtScrape(q, n); } catch (e) { if (!firstErr) firstErr = e; }
    }
    if (!items.length) {
        if (firstErr && firstErr instanceof DlError) throw firstErr;
        throw new DlError('❌ لم أجد نتائج لهذا البحث، جرّب كلمات أخرى.');
    }
    return items.slice(0, n).map(remember);
}

async function ytInfo(id) {
    const url = 'https://www.youtube.com/watch?v=' + id;
    const out = await ytdlp(['-J', '--no-playlist', '--skip-download', url], { timeout: 90000 });
    let j;
    try { j = JSON.parse(out.stdout); } catch (e) { throw new DlError('❌ تعذر قراءة معلومات الفيديو.'); }
    return mkInfo({
        id: j.id || id, title: j.title, channel: j.channel || j.uploader, duration: j.duration,
        views: j.view_count ?? null, live: !!j.is_live || j.live_status === 'is_live' || j.live_status === 'is_upcoming'
    });
}
// بديل: العنوان والقناة عبر oEmbed الرسمي (لا يعطي المدة)
async function ytInfoOembed(id) {
    const url = 'https://www.youtube.com/watch?v=' + id;
    const j = await getJson('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url), 20000);
    return mkInfo({ id, title: j.title, channel: j.author_name, duration: 0, views: null });
}

// معلومات فيديو بمعرّفه: من الذاكرة المؤقتة أولاً (بعد البحث) وإلا تُجلب
export async function getVideoInfo(id) {
    if (!isYtId(id)) throw new DlError('❌ معرّف الفيديو غير صحيح.');
    const hit = recall(id);
    if (hit) return hit;
    let info;
    try { info = await ytInfo(id); }
    catch (e) { if (!e?.soft) throw e; info = await ytInfoOembed(id).catch(() => { throw e; }); }
    return remember(info);
}

// صورة الفيديو المصغّرة (Buffer) أو null
export async function fetchThumb(id) {
    for (const name of ['hq720', 'mqdefault', 'hqdefault']) {
        try {
            const b = await getBuf(`https://i.ytimg.com/vi/${id}/${name}.jpg`, { timeout: 15000, max: 3 * MB });
            if (b.length > 1500 && b[0] === 0xFF && b[1] === 0xD8) return b;
        } catch (e) {}
    }
    return null;
}

// ---------------------------------------------------------------- جودات التنزيل
export const QUALITIES = ['360', '480', '720', '1080', 'mp3'];
export const isQuality = (q) => QUALITIES.includes(String(q));

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
// يحوّل أي ملف صوت/فيديو إلى MP3. إن فشل التحويل وكان الملف m4a/mp4 يُرسل كما هو (واتساب يشغّله)
async function toAudio(file, dir) {
    const ext = path.extname(file).toLowerCase();
    const head = fs.readFileSync(file).subarray(0, 4);
    if (ext === '.mp3' && isMp3(Buffer.concat([head, Buffer.alloc(3000)]))) return { file, mime: 'audio/mpeg', ext: '.mp3' };
    const out = path.join(dir, 'a.mp3');
    try {
        await run(FFMPEG, ['-y', '-v', 'error', '-i', file, '-vn', '-map', 'a:0', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', out], { timeout: 25 * 60 * 1000 });
        if (fs.existsSync(out) && fs.statSync(out).size > 2000) return { file: out, mime: 'audio/mpeg', ext: '.mp3' };
    } catch (e) { console.error('[mp3] فشل التحويل:', String(e?.stderr || e?.message || e).slice(-300)); }
    if (ext === '.m4a') return { file, mime: 'audio/mp4', ext: '.m4a' };
    throw new DlError('❌ فشل تحويل الصوت إلى MP3.');
}
const AUDIO_EXTS = ['.m4a', '.mp3', '.opus', '.ogg', '.aac', '.webm', '.mp4', '.mkv', '.mov'];

// الصوت: أولاً ننزّل أفضل مسار صوت خام (بلا اعتماد على -x الخاص بـyt-dlp)،
// وإن فشل ننزّل فيديو 360 (المسار المعروف أنه يعمل) ونستخرج منه الصوت بـffmpeg
async function fetchAudioRaw(info, dir) {
    const sub1 = path.join(dir, 'a1'); fs.mkdirSync(sub1, { recursive: true });
    try {
        const r = await ytdlp(['-f', 'ba[ext=m4a]/ba/b', '--no-playlist', '--max-filesize', LIM.docMB + 'M', '-o', path.join(sub1, 'raw.%(ext)s'), info.url], { timeout: 25 * 60 * 1000 });
        const f = findOut(sub1, AUDIO_EXTS);
        if (f) return f;
        if (tooBigOutput(r)) throw new DlError(TOO_BIG);
    } catch (e) { if (!e?.soft) throw e; console.error('[صوت] المسار الأول فشل، أجرّب استخراج الصوت من فيديو 360'); }
    const sub2 = path.join(dir, 'a2'); fs.mkdirSync(sub2, { recursive: true });
    const r2 = await ytdlp(['-f', '18/b[height<=480][ext=mp4]/b[height<=480]/w[ext=mp4]/w', '--no-playlist', '--max-filesize', LIM.docMB + 'M', '-o', path.join(sub2, 'rawv.%(ext)s'), info.url], { timeout: 25 * 60 * 1000 });
    const f2 = findOut(sub2, AUDIO_EXTS);
    if (!f2) throw new DlError(tooBigOutput(r2) ? TOO_BIG : '❌ فشل تنزيل الصوت.');
    return f2;
}

async function probeDuration(file) {
    try {
        const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 30000 });
        const d = Number(stdout.trim()); return Number.isFinite(d) && d > 0 ? d : 0;
    } catch (e) { return 0; }
}
// إن كان الفيديو أكبر من الحد يُعاد ترميزه بمعدل بت محسوب ليبقى «فيديو» جاهزاً في واتساب بدل ملف
async function fitVideo(file, dir, info, quality) {
    const limit = LIM.videoMB * MB;
    if (fs.statSync(file).size <= limit) return file;
    const dur = info.duration || await probeDuration(file);
    if (!dur) return file;
    const totalBps = ((LIM.videoMB - 8) * MB * 8) / dur;
    const vb = Math.max(Math.floor(totalBps - 128000), 250000);
    const out = path.join(dir, 'fit.mp4');
    try {
        await run(FFMPEG, ['-y', '-v', 'error', '-i', file,
            '-vf', `scale=-2:'min(${Number(quality)},ih)'`,
            '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', String(vb), '-maxrate', String(Math.floor(vb * 1.2)), '-bufsize', String(vb * 2), '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], { timeout: 25 * 60 * 1000 });
        if (fs.existsSync(out) && fs.statSync(out).size > 5000) return out;
    } catch (e) { console.error('[ضغط] فشل ضغط الفيديو:', String(e?.stderr || e?.message || e).slice(-300)); }
    return file;
}
const TOO_BIG = '❌ حجم الملف كبير جداً للإرسال عبر واتساب، جرّب جودة أقل.';
const finishFile = (file) => {
    const buf = fs.readFileSync(file);
    if (buf.length > LIM.docMB * MB) throw new DlError(TOO_BIG);
    return buf;
};
const tooBigOutput = (r) => /larger than max-filesize/i.test(`${r?.stdout || ''}\n${r?.stderr || ''}`);

// ---- بديل اختياري: خادم cobalt (COBALT_API_URL / COBALT_API_KEY) عندما يحجب يوتيوب أداة التنزيل
async function cobaltFetch(info, quality, dir) {
    const base = env.COBALT_API_URL;
    if (!base) return null;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA };
    if (env.COBALT_API_KEY) headers.Authorization = 'Api-Key ' + env.COBALT_API_KEY;
    const audio = quality === 'mp3';
    const body = audio
        ? { url: info.url, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }
        : { url: info.url, downloadMode: 'auto', videoQuality: String(quality), youtubeVideoCodec: 'h264', filenameStyle: 'basic' };
    const res = await fetchImpl(base.replace(/\/+$/, '') + '/', { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const j = await res.json().catch(() => null);
    if (!j || !['tunnel', 'redirect', 'stream'].includes(j.status) || !j.url) throw new Error('COBALT_' + (j?.error?.code || j?.status || res.status));
    const buf = await getBuf(j.url, { timeout: 20 * 60 * 1000, max: LIM.docMB * MB });
    const file = path.join(dir, audio ? 'cobalt.bin' : 'cobalt.mp4');
    fs.writeFileSync(file, buf);
    return file;
}

// ---- مصدر بديل بلا كوكيز: خوادم Piped (تجلب روابط الفيديو من جهتها فلا يحجبها يوتيوب عن سيرفرك)
//   PIPED_INSTANCES  قائمة روابط مفصولة بفاصلة (اختياري) لتغيير/إضافة خوادم
const PIPED_DEFAULT = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee'];
const pipedList = () => (env.PIPED_INSTANCES ? env.PIPED_INSTANCES.split(',').map((x) => x.trim()).filter(Boolean) : PIPED_DEFAULT);
const heightOf = (st) => Number(st.height) || parseInt(String(st.quality || ''), 10) || 0;

export function pickPipedStreams(j, quality) {
    const audios = (j.audioStreams || []).filter((a) => a.url && !a.videoOnly);
    const audio = audios.filter((a) => /mp4/i.test(a.mimeType || a.format || '')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
        || audios.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;
    if (quality === 'mp3') return { audio };
    const h = Number(quality);
    const vids = (j.videoStreams || []).filter((v) => v.url && heightOf(v) && heightOf(v) <= h && /mp4|mpeg_4/i.test(`${v.mimeType || ''} ${v.format || ''}`));
    const score = (v) => heightOf(v) * 10 + (/avc1|h264/i.test(v.codec || v.mimeType || '') ? 1 : 0);
    const muxed = vids.filter((v) => !v.videoOnly).sort((a, b) => score(b) - score(a))[0];
    const only = vids.filter((v) => v.videoOnly).sort((a, b) => score(b) - score(a))[0];
    // نفضّل ملفاً جاهزاً (صوت+صورة) إن كان بنفس الجودة المطلوبة تقريباً، وإلا ندمج صورة عالية مع صوت
    if (muxed && (!only || heightOf(muxed) >= heightOf(only))) return { muxed };
    if (only && audio) return { video: only, audio };
    if (muxed) return { muxed };
    return {};
}

async function pipedFetch(info, quality, dir) {
    let lastErr;
    for (const base of pipedList()) {
        try {
            const j = await getJson(base.replace(/\/+$/, '') + '/streams/' + info.id, 25000);
            const pick = pickPipedStreams(j, quality);
            const get = async (st, name) => {
                const f = path.join(dir, name);
                fs.writeFileSync(f, await getBuf(st.url, { timeout: 20 * 60 * 1000, max: LIM.docMB * MB }));
                return f;
            };
            if (quality === 'mp3') {
                if (!pick.audio) throw new Error('PIPED_NO_AUDIO');
                return await get(pick.audio, 'piped_a.m4a');
            }
            if (pick.muxed) return await get(pick.muxed, 'piped_v.mp4');
            if (pick.video && pick.audio) {
                const v = await get(pick.video, 'piped_vo.mp4'), a = await get(pick.audio, 'piped_ao.m4a');
                const out = path.join(dir, 'piped_merged.mp4');
                await run(FFMPEG, ['-y', '-v', 'error', '-i', v, '-i', a, '-c', 'copy', '-movflags', '+faststart', out], { timeout: 10 * 60 * 1000 });
                return out;
            }
            throw new Error('PIPED_NO_STREAM');
        } catch (e) { lastErr = e; console.error('[piped]', base, e?.message || e); }
    }
    throw lastErr || new Error('PIPED_UNAVAILABLE');
}

// يجرّب المصادر البديلة بالترتيب: cobalt (إن ضُبط) ثم Piped
async function altFetch(info, quality, dir) {
    try { const f = await cobaltFetch(info, quality, dir); if (f) return f; } catch (e) { console.error('[cobalt]', e?.message || e); }
    try { return await pipedFetch(info, quality, dir); } catch (e) { console.error('[بدائل]', e?.message || e); }
    return null;
}

// ---------------------------------------------------------------- التنزيل بجودة محددة (360 | 480 | 720 | 1080 | mp3)
export async function downloadYt(id, quality, { onInfo } = {}) {
    quality = String(quality);
    if (!isQuality(quality)) throw new DlError('❌ جودة غير مدعومة.');
    const audio = quality === 'mp3';
    const info = await getVideoInfo(id);
    guard(info, audio ? 'audio' : 'video');
    if (onInfo) { try { await onInfo(info, fmtDur); } catch (e) {} }
    const dir = mkjob();
    try {
        let file;
        try {
            if (audio) {
                file = await fetchAudioRaw(info, dir);
            } else {
                const h = Number(quality);
                const sel = [
                    `bv*[vcodec^=avc1][height<=${h}]+ba[ext=m4a]`, `b[vcodec^=avc1][height<=${h}][ext=mp4]`,
                    `bv*[height<=${h}]+ba`, `b[height<=${h}]`, 'b'
                ].join('/');
                const r = await ytdlp(['-f', sel, '--merge-output-format', 'mp4', '--no-playlist', '--max-filesize', LIM.docMB + 'M', '-o', path.join(dir, 'media.%(ext)s'), info.url], { timeout: 25 * 60 * 1000 });
                file = findOut(dir, ['.mp4', '.mkv', '.webm', '.mov']);
                if (!file) throw new DlError(tooBigOutput(r) ? TOO_BIG : '❌ فشل تنزيل الفيديو.');
            }
        } catch (e) {
            if (!e?.soft) throw e;
            const alt = await altFetch(info, quality, dir);
            if (!alt) throw e;
            file = alt;
        }

        if (audio) {
            const a = await toAudio(file, dir);
            const buffer = finishFile(a.file);
            return { info, quality, buffer, mime: a.mime, fileName: safeName(info.title) + a.ext, asDocument: false };
        }

        file = await ensureWhatsAppMp4(file, dir);
        file = await fitVideo(file, dir, info, quality);     // يبقى فيديو جاهزاً في واتساب (وليس ملفاً)
        const buffer = finishFile(file);
        return { info, quality, buffer, mime: 'video/mp4', fileName: safeName(info.title) + '.mp4', asDocument: false };
    } finally { rmrf(dir); }
}

export const _test = { pickPipedStreams, pipedFetch, isMp3, LIM, searchYtScrape, collectRenderers, durToSec, mkInfo, remember, recall };

// ---- أدوات مشتركة تستخدمها أوامر التنزيل الإضافية (moredl.js) — إضافة فقط، لا تغيّر سلوك ما سبق
export const _ext = {
    getYtdlp, baseFlags, run, mkjob, rmrf, getBuf, getJson, safeName, fmtDur, findOut,
    ensureWhatsAppMp4, fitVideo, toAudio, finishFile, tooBigOutput, guard, LIM, MB, UA, FFMPEG, cobaltFetch, TOO_BIG, ytdlp
};
