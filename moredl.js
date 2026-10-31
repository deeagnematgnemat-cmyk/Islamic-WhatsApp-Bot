// ============ moredl.js : أوامر قسم التنزيل الإضافية (نفس أسلوب «.بحث_يوت») ============
// تيك توك • إنستا • فيسبوك • تويتر • سناب • ساوند • بنتريست • ميديافاير • حمل (عام)
// اغنية • سورة • قارئ • محاضرة • اذان • غلاف • معلومات_فيديو • ايدت
// يعتمد على نفس محرّك lib/dl.js (yt-dlp + ffmpeg) ونفس متغيرات البيئة (الكوكيز/البروكسي/الحدود).
import fs from 'fs';
import path from 'path';
import { cmdYtSearch, _internal as YT } from './ytsearch.js';
import { sendVideoCarousel } from './menu.js';
import {
    DlError, withSlot, searchVideos, getVideoInfo, downloadYt, fetchThumb,
    parseYtInput, isYtId, fmtDuration, fmtViews, _ext
} from './lib/dl.js';

const { frame, row, cut } = YT;
const {
    getYtdlp, baseFlags, run, mkjob, rmrf, getBuf, getJson, safeName, ensureWhatsAppMp4, fitVideo,
    toAudio, finishFile, tooBigOutput, LIM, MB, FFMPEG, cobaltFetch, TOO_BIG, ytdlp
} = _ext;

const DEV = 'Eren';
const fmtSize = (n) => (n >= MB ? (n / MB).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const URL_RE = /https?:\/\/[^\s<>"'،]+/i;

// ---------------------------------------------------------------- المنصات
const PLATFORMS = {
    tiktok:     { label: 'تيك توك',    cmd: '.تيك',       hosts: ['tiktok.com'] },
    instagram:  { label: 'إنستغرام',   cmd: '.انستا',     hosts: ['instagram.com', 'instagr.am'] },
    facebook:   { label: 'فيسبوك',     cmd: '.فيس',       hosts: ['facebook.com', 'fb.watch', 'fb.com'] },
    twitter:    { label: 'تويتر (X)',  cmd: '.تويتر',     hosts: ['twitter.com', 'x.com'] },
    snapchat:   { label: 'سناب شات',   cmd: '.سناب',      hosts: ['snapchat.com'] },
    soundcloud: { label: 'ساوند كلاود', cmd: '.ساوند',     hosts: ['soundcloud.com', 'snd.sc'] },
    pinterest:  { label: 'بنتريست',    cmd: '.بنتريست_تنزيل', hosts: ['pin.it'] },
    mediafire:  { label: 'ميديافاير',  cmd: '.ميديافاير', hosts: ['mediafire.com'] },
    youtube:    { label: 'يوتيوب',     cmd: '.بحث_يوت',   hosts: ['youtube.com', 'youtu.be'] }
};
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };
const hostIs = (h, d) => h === d || h.endsWith('.' + d);

export function detectPlatform(url) {
    const h = hostOf(url);
    if (!h) return null;
    if (/(^|\.)pinterest\.[a-z.]+$/.test(h)) return 'pinterest';
    for (const [k, p] of Object.entries(PLATFORMS)) if (p.hosts.some((d) => hostIs(h, d))) return k;
    return null;
}
export function extractUrl(text) {
    const m = URL_RE.exec(String(text || ''));
    return m ? m[0].replace(/[)\].,;!؟]+$/, '') : '';
}
const wantsAudio = (text) => /(^|\s)(صوت|mp3|ام_بي_3)(\s|$)/i.test(String(text || '').replace(URL_RE, ' '));

// ---------------------------------------------------------------- مساعدات التصميم
const done = (label, title, size) => frame('✅ *تَـمَّ الـتَّـحْـمِـيـلُ:*', [[
    row('📱', 'المصدر', label),
    ...(title ? [row('📛', 'العنوان', cut(title, 50))] : []),
    row('📦', 'الحجم', fmtSize(size))
]], `🤖 ${DEV}`);
const waiting = (c, icon, kind, label) => c.reply(frame('⏳ *جَـارِي الـتَّـحْـمِـيـلِ...*', [[
    row(icon, 'النوع', kind), ...(label ? [row('📱', 'المصدر', label)] : []), row('⚡', 'الحالة', 'يتم التجهيز، لحظات من فضلك')
]]));
const usage = (cmd, what, example, link = true) => `📌 *الاستخدام:*\n\`${cmd} ${what}\`${link ? '\nأو رد على رسالة فيها الرابط بالأمر.' : ''}\n\n💡 مثال: \`${cmd} ${example}\``;

// ---------------------------------------------------------------- yt-dlp لغير يوتيوب
function classifyGeneric(e) {
    const t = `${e?.stderr || ''}\n${e?.message || ''}`;
    console.error('[dl-more]', t.slice(-600).trim());
    if (e instanceof DlError) return e;
    const mk = (m, soft = false) => { const x = new DlError(m, 'DL_FAIL'); x.debug = t.replace(/\s+/g, ' ').trim().slice(-300); x.soft = soft; return x; };
    if (e?.code === 'ENOENT') return mk('❌ أداة التنزيل غير جاهزة على السيرفر. أبلغ المطور.');
    if (e?.killed || e?.signal === 'SIGTERM') return mk('⏱️ انتهت مهلة التنزيل، جرّب رابطاً أقصر.');
    if (/unsupported url/i.test(t)) return mk('❌ هذا الرابط غير مدعوم.');
    if (/larger than max-filesize/i.test(t)) return mk(TOO_BIG);
    if (/private|log ?in|sign in|authenticat|cookies|restricted|rate.?limit|checkpoint|empty media response/i.test(t)) return mk('🔒 المحتوى خاص أو يحتاج تسجيل دخول، أو أن المنصة تمنع التنزيل من هذا السيرفر حالياً.', true);
    if (/404|not found|removed|deleted|unavailable|does not exist/i.test(t)) return mk('❌ المحتوى غير متاح أو محذوف.');
    return mk('❌ تعذر التنزيل من هذا الرابط. حاول مرة أخرى بعد قليل.', true);
}
async function ytdlpGeneric(args, timeout = 25 * 60 * 1000) {
    const bin = await getYtdlp();
    const flags = await baseFlags(bin);
    try { return await run(bin, [...flags, ...args], { timeout }); } catch (e) { throw classifyGeneric(e); }
}

const VIDEO_EXTS = ['.mp4', '.mkv', '.webm', '.mov', '.m4v'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const AUDIO_EXTS = ['.m4a', '.mp3', '.opus', '.ogg', '.aac', '.wav'];

// يجمع ما نزل في المجلد: { dir, videos, images, audios, title, author }
function collect(dir) {
    const files = fs.readdirSync(dir).filter((n) => !n.endsWith('.part') && !n.endsWith('.ytdl')).sort();
    const pick = (exts) => files.filter((n) => exts.includes(path.extname(n).toLowerCase())).map((n) => path.join(dir, n));
    let title = '', author = '';
    const meta = files.find((n) => n.endsWith('.info.json'));
    if (meta) {
        try {
            const j = JSON.parse(fs.readFileSync(path.join(dir, meta), 'utf8'));
            title = String(j.title || j.description || '').trim();
            author = String(j.uploader || j.channel || '').trim();
        } catch (e) {}
    }
    return { dir, videos: pick(VIDEO_EXTS), images: pick(IMAGE_EXTS), audios: pick(AUDIO_EXTS), title, author };
}
const hasMedia = (r) => !!(r && (r.videos.length || r.images.length || r.audios.length));

async function viaYtdlp(url, platform, audio, dir) {
    const fmt = audio ? 'ba[ext=m4a]/ba/b' : 'bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b';
    const args = ['-f', fmt, '--merge-output-format', 'mp4', '--write-info-json', '--match-filter', '!is_live',
        '--max-filesize', LIM.docMB + 'M', '-o', path.join(dir, '%(autonumber)03d.%(ext)s')];
    if (platform === 'tiktok' || audio) args.push('--no-playlist');
    else args.push('--yes-playlist', '--playlist-items', '1-5');
    args.push(url);
    const r = await ytdlpGeneric(args);
    const res = collect(dir);
    if (!hasMedia(res)) throw (tooBigOutput(r) ? new DlError(TOO_BIG) : Object.assign(new DlError('❌ لم أجد وسائط قابلة للتنزيل في هذا الرابط.'), { soft: true }));
    return res;
}

// tikwm مجاني ويسمح بطلب واحد كل ثانية تقريباً: نرتّب الطلبات ونعيد المحاولة إذا رفض بسبب الحد
let tikwmNext = 0;
async function tikwmJson(u, timeout) {
    let j = null;
    for (let i = 0; i < 3; i++) {
        const now = Date.now();
        const at = Math.max(now, tikwmNext);
        tikwmNext = at + 1200;
        if (at > now) await new Promise((r) => setTimeout(r, at - now));
        j = await getJson(u, timeout);
        if (j && j.code === 0) return j;
        if (!/limit|second/i.test(String(j?.msg || ''))) return j;
    }
    return j;
}

// ---- بدائل عند فشل yt-dlp
async function viaTikwm(url, dir) {
    const j = await tikwmJson('https://www.tikwm.com/api/?hd=1&url=' + encodeURIComponent(url), 30000);
    const d = j && j.code === 0 ? j.data : null;
    if (!d) throw new Error('TIKWM_FAIL');
    const abs = (u) => (String(u || '').startsWith('/') ? 'https://www.tikwm.com' + u : String(u || ''));
    if (Array.isArray(d.images) && d.images.length) {
        let i = 0;
        for (const u of d.images.slice(0, 10)) {
            try { fs.writeFileSync(path.join(dir, `tk${String(++i).padStart(2, '0')}.jpg`), await getBuf(abs(u), { timeout: 60000, max: 20 * MB })); } catch (e) {}
        }
    } else {
        const vu = abs(d.hdplay || d.play);
        if (!vu) throw new Error('TIKWM_NO_VIDEO');
        fs.writeFileSync(path.join(dir, 'tk01.mp4'), await getBuf(vu, { timeout: 5 * 60 * 1000, max: LIM.docMB * MB }));
    }
    const res = collect(dir);
    res.title = String(d.title || '').trim();
    res.author = String(d.author?.nickname || '').trim();
    if (!hasMedia(res)) throw new Error('TIKWM_EMPTY');
    return res;
}

const unEnt = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const metaTag = (html, names) => {
    for (const n of names) {
        const m = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)["']`, 'i').exec(html)
            || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, 'i').exec(html);
        if (m) return unEnt(m[1]);
    }
    return '';
};
async function viaOpenGraph(url, dir) {
    const html = (await getBuf(url, { timeout: 30000, max: 8 * MB, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })).toString('utf8');
    const video = metaTag(html, ['og:video:url', 'og:video', 'twitter:player:stream']);
    let image = metaTag(html, ['og:image', 'twitter:image']);
    const title = metaTag(html, ['og:title', 'twitter:title']);
    if (video && /\.(mp4|m3u8)(\?|$)/i.test(video) && !/\.m3u8/i.test(video)) {
        fs.writeFileSync(path.join(dir, 'og01.mp4'), await getBuf(video, { timeout: 5 * 60 * 1000, max: LIM.docMB * MB }));
    } else if (image) {
        image = image.replace(/\/(?:\d+x\d*|\d+x)\//, '/originals/');
        let buf;
        try { buf = await getBuf(image, { timeout: 60000, max: 30 * MB }); }
        catch (e) { buf = await getBuf(metaTag(html, ['og:image']), { timeout: 60000, max: 30 * MB }); }
        fs.writeFileSync(path.join(dir, 'og01' + (/\.png(\?|$)/i.test(image) ? '.png' : '.jpg')), buf);
    } else throw new Error('OG_NO_MEDIA');
    const res = collect(dir);
    res.title = title;
    if (!hasMedia(res)) throw new Error('OG_EMPTY');
    return res;
}

async function viaCobalt(url, audio, dir) {
    const f = await cobaltFetch({ url }, audio ? 'mp3' : '720', dir);
    if (!f) throw new Error('COBALT_OFF');
    const dest = path.join(dir, 'cb01' + (audio ? '.mp3' : '.mp4'));
    if (f !== dest) fs.renameSync(f, dest);
    return collect(dir);
}

async function fetchMedia(url, platform, audio) {
    const dir = mkjob();
    try {
        let first;
        const attempts = [() => viaYtdlp(url, platform, audio, dir)];
        if (platform === 'tiktok') attempts.push(() => viaTikwm(url, dir));
        if (platform === 'pinterest' && !audio) attempts.push(() => viaOpenGraph(url, dir));
        if (process.env.COBALT_API_URL) attempts.push(() => viaCobalt(url, audio, dir));
        for (const at of attempts) {
            try { return await at(); }
            catch (e) {
                if (!first) first = e;
                if (e instanceof DlError && !e.soft) throw e;          // أخطاء نهائية (غير مدعوم/محذوف/كبير جداً)
                console.error('[dl-more] محاولة فاشلة:', e?.message || e);
            }
        }
        throw first instanceof DlError ? first : new DlError('❌ تعذر التنزيل من هذا الرابط. حاول مرة أخرى بعد قليل.');
    } catch (e) { rmrf(dir); throw e; }
}

// ---------------------------------------------------------------- إرسال النتيجة
async function toJpeg(file, dir) {
    if (!/\.webp$/i.test(file)) return file;
    const out = path.join(dir, 'img_' + path.basename(file, '.webp') + '.jpg');
    try { await run(FFMPEG, ['-y', '-v', 'error', '-i', file, out], { timeout: 60000 }); if (fs.existsSync(out)) return out; } catch (e) {}
    return file;
}

async function deliver(c, res, { audio, label }) {
    try {
        if (audio) {
            const src = res.audios[0] || res.videos[0];
            if (!src) throw new DlError('❌ لم أجد صوتاً في هذا الرابط.');
            const a = await toAudio(src, res.dir);
            const buf = finishFile(a.file);
            await c.media({ audio: buf, mimetype: a.mime, fileName: safeName(res.title || label) + a.ext });
            return c.reply(done(label, res.title, buf.length));
        }
        let sent = 0, lastErr = null;
        for (const f of res.videos.slice(0, 5)) {
            try {
                let p = await ensureWhatsAppMp4(f, res.dir);
                p = await fitVideo(p, res.dir, { duration: 0 }, '720');
                const buf = finishFile(p);
                await c.media({ video: buf, mimetype: 'video/mp4', ...(sent === 0 ? { caption: done(label, res.title, buf.length) } : {}) });
                sent++;
            } catch (e) { if (e instanceof DlError) lastErr = e; else throw e; }
        }
        for (const f of res.images.slice(0, 10)) {
            try {
                const buf = finishFile(await toJpeg(f, res.dir));
                await c.media({ image: buf, ...(sent === 0 ? { caption: done(label, res.title, buf.length) } : {}) });
                sent++;
            } catch (e) { if (e instanceof DlError) lastErr = e; else throw e; }
        }
        if (!sent && res.audios.length) {     // رابط صوتي فقط (مثل ساوند) بدون طلب صوت صريح
            return deliver(c, res, { audio: true, label });
        }
        if (!sent) throw lastErr || new DlError('❌ لم أجد وسائط في هذا الرابط.');
    } finally { rmrf(res.dir); }
}

// ---------------------------------------------------------------- أمر منصة محددة
async function platformCommand(c, fallbackText, platform, { forceAudio = false } = {}) {
    const P = PLATFORMS[platform];
    const url = extractUrl(c.args) || extractUrl(fallbackText);
    if (!url) return c.reply(usage(P.cmd, '<رابط ' + P.label + '>', platform === 'soundcloud' ? 'https://soundcloud.com/...' : 'https://...') + (platform === 'soundcloud' ? '' : '\n🎧 أضف كلمة `صوت` لتحميل الصوت فقط.'));
    const real = detectPlatform(url);
    if (real !== platform && !(platform === 'pinterest' && real === 'pinterest')) {
        if (real && PLATFORMS[real]) return c.reply(`❌ هذا رابط ${PLATFORMS[real].label}، استخدم الأمر ${PLATFORMS[real].cmd} أو ‎.حمل`);
        return c.reply(`❌ الرابط ليس رابط ${P.label}.`);
    }
    const audio = forceAudio || wantsAudio(c.args);
    await waiting(c, audio ? '🎧' : '🎥', audio ? 'صوت MP3' : 'فيديو / صور', P.label);
    const res = await withSlot(() => fetchMedia(url, platform, audio));
    await deliver(c, res, { audio, label: P.label });
}

// ---------------------------------------------------------------- ميديافاير
const MIME = { '.zip': 'application/zip', '.rar': 'application/vnd.rar', '.7z': 'application/x-7z-compressed', '.apk': 'application/vnd.android.package-archive', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.json': 'application/json', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

export function findMediafireLink(html) {
    let m = /data-scrambled-url=["']([A-Za-z0-9+/=]+)["']/i.exec(html);
    if (m) { try { const u = Buffer.from(m[1], 'base64').toString('utf8'); if (/^https?:\/\//i.test(u)) return u; } catch (e) {} }
    m = /id=["']downloadButton["'][^>]*href=["'](https?:\/\/[^"']+)["']/i.exec(html)
        || /href=["'](https?:\/\/[^"']+)["'][^>]*id=["']downloadButton["']/i.exec(html)
        || /aria-label=["']Download file["'][^>]*href=["'](https?:\/\/[^"']+)["']/i.exec(html)
        || /(https?:\/\/download[\w-]*\.mediafire\.com\/[^"'\s<>]+)/i.exec(html);
    return m ? unEnt(m[1]) : '';
}

async function cmdMediafire(c, fallbackText) {
    const url = extractUrl(c.args) || extractUrl(fallbackText);
    if (!url) return c.reply(usage('.ميديافاير', '<رابط ميديافاير>', 'https://www.mediafire.com/file/...'));
    if (detectPlatform(url) !== 'mediafire') return c.reply('❌ الرابط ليس رابط ميديافاير.');
    if (/mediafire\.com\/(folder|\?)/i.test(url)) return c.reply('❌ روابط المجلدات غير مدعومة، أرسل رابط ملف واحد.');
    await waiting(c, '📁', 'ملف', 'ميديافاير');
    const { buf, name } = await withSlot(async () => {
        let html;
        try { html = (await getBuf(url, { timeout: 30000, max: 8 * MB, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })).toString('utf8'); }
        catch (e) { throw new DlError('❌ تعذر فتح رابط ميديافاير. تأكد أنه صحيح.'); }
        const link = findMediafireLink(html);
        if (!link) throw new DlError('❌ لم أجد رابط التحميل (قد يكون الملف محذوفاً أو محمياً بكلمة مرور).');
        let nm = '';
        try { nm = decodeURIComponent(new URL(link).pathname.split('/').pop() || ''); } catch (e) {}
        const buf = await getBuf(link, { timeout: 25 * 60 * 1000, max: LIM.docMB * MB });
        return { buf, name: safeName(nm || 'mediafire_file') };
    });
    await c.media({ document: buf, mimetype: MIME[path.extname(name).toLowerCase()] || 'application/octet-stream', fileName: name, caption: done('ميديافاير', name, buf.length) });
}

// ---------------------------------------------------------------- .حمل (عام: يكتشف المنصة)
async function cmdGeneric(c, fallbackText) {
    const url = extractUrl(c.args) || extractUrl(fallbackText);
    if (!url) return c.reply(`📌 *الاستخدام:*\n\`.حمل <رابط>\`\nأو رد على رسالة فيها رابط.\n\n🌐 يدعم: يوتيوب • تيك توك • إنستا • فيسبوك • تويتر • سناب • ساوند • بنتريست • ميديافاير\n🎧 أضف كلمة \`صوت\` لتحميل الصوت فقط.`);
    const platform = detectPlatform(url);
    if (platform === 'youtube') { c.args = url; return cmdYtSearch(c, ''); }
    if (platform === 'mediafire') return cmdMediafire(c, '');
    if (!platform) return c.reply('❌ هذا الموقع غير مدعوم. المدعوم: يوتيوب، تيك توك، إنستا، فيسبوك، تويتر، سناب، ساوند، بنتريست، ميديافاير.');
    return platformCommand(c, '', platform, { forceAudio: platform === 'soundcloud' });
}

// ---------------------------------------------------------------- بحث ثم تنزيل صوت مباشرة
async function audioFromSearch(query, { minSec = 0, maxSec = 90 * 60 } = {}) {
    const items = await searchVideos(query, 8);
    const ok = (v) => !v.live && (!v.duration || (v.duration >= minSec && v.duration <= maxSec));
    const v = items.find((x) => x.duration && ok(x)) || items.find(ok) || items.find((x) => !x.live);
    if (!v) throw new DlError('❌ لم أجد نتائج مناسبة، جرّب كلمات أخرى.');
    return withSlot(() => downloadYt(v.id, 'mp3'));
}
async function sendAudio(c, r, extraRows = []) {
    await c.media({ audio: r.buffer, mimetype: r.mime, fileName: r.fileName });
    await c.reply(frame('✅ *تَـمَّ الـتَّـحْـمِـيـلُ:*', [[
        row('📛', 'العنوان', cut(r.info.title, 50)),
        ...extraRows,
        row('🎧', 'الصيغة', r.mime === 'audio/mpeg' ? 'MP3' : 'M4A'),
        row('📦', 'الحجم', fmtSize(r.buffer.length))
    ]], `🤖 ${DEV}`));
}

async function cmdSong(c) {
    const q = String(c.args || '').trim();
    if (!q) return c.reply(usage('.اغنية', '<اسم الأغنية>', 'فيروز سلامات', false));
    await waiting(c, '🎧', 'صوت MP3', '');
    const r = await audioFromSearch(q, { minSec: 45, maxSec: 20 * 60 });
    return sendAudio(c, r);
}

async function cmdLecture(c) {
    const q = String(c.args || '').trim();
    if (!q) return c.reply(usage('.محاضرة', '<اسم المحاضرة أو الشيخ>', 'الشيخ الشعراوي الصبر', false));
    await waiting(c, '🎙️', 'محاضرة (صوت)', '');
    const r = await audioFromSearch(/محاضر|خطب|درس/.test(q) ? q : 'محاضرة ' + q, { minSec: 120 });
    return sendAudio(c, r);
}

const ADHAN = [
    { keys: ['مكة', 'مكه', 'الحرم', 'المكي'], name: 'الحرم المكي', q: 'أذان الحرم المكي' },
    { keys: ['المدينة', 'المدينه', 'النبوي'], name: 'المسجد النبوي', q: 'أذان المسجد النبوي' },
    { keys: ['الاقصى', 'الأقصى', 'القدس'], name: 'المسجد الأقصى', q: 'أذان المسجد الأقصى' },
    { keys: ['مصر', 'القاهرة'], name: 'مصر', q: 'أذان مصر الشيخ محمد رفعت' }
];
async function cmdAdhan(c) {
    const a = String(c.args || '').trim();
    const pick = ADHAN.find((x) => x.keys.some((k) => a.includes(k))) || ADHAN[0];
    await waiting(c, '🕌', 'أذان (صوت)', pick.name);
    const r = await audioFromSearch(pick.q, { minSec: 50, maxSec: 8 * 60 });
    return sendAudio(c, r, [row('🕌', 'الأذان', pick.name)]);
}

// ---------------------------------------------------------------- القرآن (mp3quran مع بديل يوتيوب)
const SURAHS = ['الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'];

const RECITERS = [
    { key: 'afs', name: 'مشاري العفاسي', aliases: ['العفاسي', 'عفاسي', 'مشاري'], base: 'https://server8.mp3quran.net/afs/' },
    { key: 'maher', name: 'ماهر المعيقلي', aliases: ['ماهر', 'المعيقلي'], base: 'https://server12.mp3quran.net/maher/' },
    { key: 'sds', name: 'عبدالرحمن السديس', aliases: ['السديس', 'سديس'], base: 'https://server11.mp3quran.net/sds/' },
    { key: 'shur', name: 'سعود الشريم', aliases: ['الشريم', 'شريم'], base: 'https://server7.mp3quran.net/shur/' },
    { key: 'husr', name: 'محمود خليل الحصري', aliases: ['الحصري', 'حصري'], base: 'https://server13.mp3quran.net/husr/' },
    { key: 'basit', name: 'عبدالباسط عبدالصمد', aliases: ['عبدالباسط', 'عبد_الباسط', 'باسط'], base: 'https://server7.mp3quran.net/basit/' },
    { key: 'minsh', name: 'محمد صديق المنشاوي', aliases: ['المنشاوي', 'منشاوي'], base: 'https://server10.mp3quran.net/minsh/' }
];

export const normAr = (s) => String(s || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
const stripAl = (s) => (s.length > 3 && s.startsWith('ال') ? s.slice(2) : s);
const SURAH_KEYS = SURAHS.map((n) => { const k = normAr(n).replace(/\s/g, ''); return [k, stripAl(k)]; });

// يرجع { n, rest } حيث rest ما تبقّى من النص (اسم القارئ)
export function resolveSurah(text) {
    let t = normAr(text).replace(/^سوره\s+/, '').replace(/^سورة\s+/, '');
    if (!t) return null;
    const words = t.split(' ');
    // رقم أولاً
    if (/^\d{1,3}$/.test(words[0])) {
        const n = Number(words[0]);
        return n >= 1 && n <= 114 ? { n, rest: words.slice(1).join(' ') } : null;
    }
    // نجرّب 1 ثم 2 ثم 3 كلمات (مثل «آل عمران»)
    for (let len = Math.min(3, words.length); len >= 1; len--) {
        const k = words.slice(0, len).join('').replace(/\s/g, '');
        const ks = stripAl(k);
        const i = SURAH_KEYS.findIndex(([a, b]) => a === k || b === k || b === ks || a === ks);
        if (i >= 0) return { n: i + 1, rest: words.slice(len).join(' ') };
    }
    return null;
}
export const findReciter = (text) => {
    const t = normAr(text).replace(/\s/g, '').replace(/_/g, '');
    if (!t) return RECITERS[0];
    return RECITERS.find((r) => [r.name, ...r.aliases].some((a) => { const x = normAr(a).replace(/\s/g, '').replace(/_/g, ''); return t.includes(x) || x.includes(t); })) || null;
};
const isMp3Buf = (b) => b && b.length > 5000 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0));

async function cmdReciters(c) {
    return c.reply(frame('🎙️ *قَـائِـمَـةُ الـقُـرَّاءِ:*', [
        RECITERS.map((r, i) => row('🎙️', `${i + 1}. ${r.name}`, `.سورة الكهف ${r.aliases[0]}`)),
        [row('📖', 'الاستخدام', '.سورة <اسم أو رقم السورة> [القارئ]')]
    ], '💡 بدون ذكر القارئ يكون الافتراضي: مشاري العفاسي.'));
}

async function cmdSurah(c) {
    const a = String(c.args || '').trim();
    const s = resolveSurah(a);
    if (!s) return c.reply(usage('.سورة', '<اسم أو رقم السورة> [القارئ]', 'الكهف ماهر', false) + '\n🎙️ لقائمة القراء: `.قارئ`');
    const reciter = findReciter(s.rest);
    if (!reciter) return c.reply('❌ لم أتعرف على اسم القارئ.\n🎙️ اكتب `.قارئ` لعرض القائمة.');
    const name = SURAHS[s.n - 1];
    await waiting(c, '📖', 'تلاوة (صوت)', `سورة ${name} • ${reciter.name}`);
    const fileName = safeName(`سورة ${name} - ${reciter.name}`) + '.mp3';
    let buf = null;
    try {
        const b = await withSlot(() => getBuf(reciter.base + String(s.n).padStart(3, '0') + '.mp3', { timeout: 20 * 60 * 1000, max: LIM.docMB * MB }));
        if (isMp3Buf(b)) buf = b;
    } catch (e) { if (e instanceof DlError && e.friendly === '⏳ البوت مشغول بتنزيلات أخرى الآن، أعد المحاولة بعد قليل.') throw e; console.error('[سورة] المصدر المباشر فشل، أجرّب يوتيوب:', e?.message || e); }
    if (buf) {
        await c.media({ audio: buf, mimetype: 'audio/mpeg', fileName });
        return c.reply(frame('✅ *تَـمَّ الـتَّـحْـمِـيـلُ:*', [[
            row('📖', 'السورة', `${s.n}. ${name}`), row('🎙️', 'القارئ', reciter.name), row('📦', 'الحجم', fmtSize(buf.length))
        ]], `🤖 ${DEV}`));
    }
    const r = await audioFromSearch(`سورة ${name} ${reciter.name}`, { minSec: 20 });
    return sendAudio(c, r, [row('📖', 'السورة', `${s.n}. ${name}`)]);
}

// ---------------------------------------------------------------- أدوات يوتيوب: غلاف / معلومات / ترجمة
function ytIdFrom(c, fallbackText) {
    const p = parseYtInput(c.args) || parseYtInput(fallbackText);
    return p ? p.id : '';
}
async function cmdCover(c, fallbackText) {
    const id = ytIdFrom(c, fallbackText);
    if (!id) return c.reply(usage('.غلاف', '<رابط يوتيوب>', 'https://youtu.be/...'));
    let buf = null;
    for (const name of ['maxresdefault', 'sddefault']) {
        try { const b = await getBuf(`https://i.ytimg.com/vi/${id}/${name}.jpg`, { timeout: 15000, max: 5 * MB }); if (b.length > 4000 && b[0] === 0xFF && b[1] === 0xD8) { buf = b; break; } } catch (e) {}
    }
    if (!buf) buf = await fetchThumb(id);
    if (!buf) throw new DlError('❌ تعذر جلب غلاف الفيديو.');
    let title = ''; try { title = (await getVideoInfo(id)).title; } catch (e) {}
    await c.media({ image: buf, caption: frame('🖼️ *غِـلَافُ الـفِـيـدِيـو:*', [[...(title ? [row('📛', 'العنوان', cut(title, 50))] : []), row('📦', 'الحجم', fmtSize(buf.length))]], `🤖 ${DEV}`) });
}
async function cmdVideoInfo(c, fallbackText) {
    const id = ytIdFrom(c, fallbackText);
    if (!id) return c.reply(usage('.معلومات_فيديو', '<رابط يوتيوب>', 'https://youtu.be/...'));
    const i = await getVideoInfo(id);
    return c.reply(frame('📋 *مَـعْـلُـومَـاتُ الـفِـيـدِيـو:*', [[
        row('📛', 'العنوان', cut(i.title, 70)),
        ...(i.channel ? [row('📺', 'القناة', cut(i.channel, 40))] : []),
        row('⏱️', 'المدة', fmtDuration(i.duration)),
        row('👁️', 'المشاهدات', i.views === null ? '—' : fmtViews(i.views)),
        row('🔗', 'الرابط', `https://youtu.be/${i.id}`)
    ]], `🤖 ${DEV}`));
}

// ---------------------------------------------------------------- ايدت: 3 إيديتات من تيك توك (بطاقات فيديو أفقية)
const EDITS_COUNT = 3;
const EDIT_MAX_MB = 14;                       // أكبر حجم لفيديو داخل بطاقة (البطاقات الثقيلة قد ترفضها واتساب)
const EDIT_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d';
const EDIT_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const isMp4 = (b) => !!b && b.length > 20000 && b.subarray(4, 8).toString('latin1') === 'ftyp';

async function toEnglish(text) {
    try {
        const j = await getJson('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(text), 15000);
        return String((j?.[0] || []).map((x) => x?.[0] || '').join('')).trim();
    } catch (e) { return ''; }
}

// صفحة الهاشتاق في تيك توك عبر yt-dlp
async function tagSearch(tag, notes) {
    try {
        const r = await ytdlp(['--flat-playlist', '--dump-json', '--playlist-end', '12', '--no-warnings', `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`], { timeout: 50000 });
        const out = [];
        for (const line of String(r?.stdout || '').split('\n')) {
            if (!line.trim().startsWith('{')) continue;
            try {
                const j = JSON.parse(line);
                const url = String(j.webpage_url || j.url || '');
                if (!/tiktok\.com\/.+\/video\/\d+/.test(url)) continue;
                out.push({ id: String(j.id || ''), title: String(j.title || j.description || '').trim(), author: String(j.uploader || j.channel || '').trim(),
                    duration: Number(j.duration || 0), plays: Number(j.view_count || 0), url });
            } catch (e) {}
        }
        if (!out.length) notes.push(`yt-dlp #${tag}: 0 نتائج`);
        return out;
    } catch (e) { notes.push(`yt-dlp #${tag}: ${String(e?.friendly || e?.message || e).slice(0, 90)}`); return []; }
}

// تقليص فيديو ثقيل ليناسب بطاقة الكاروسيل (بدل رفضه)
async function shrinkEdit(buf) {
    if (buf.length <= EDIT_MAX_MB * MB) return buf;
    const dir = mkjob();
    try {
        const inp = path.join(dir, 'in.mp4'), out = path.join(dir, 'out.mp4');
        fs.writeFileSync(inp, buf);
        await run(FFMPEG, ['-y', '-v', 'error', '-i', inp, '-vf', "scale=-2:'min(480,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], { timeout: 5 * 60 * 1000 });
        const o = fs.readFileSync(out);
        if (o.length > 20000 && o.length <= EDIT_MAX_MB * MB) return o;
    } catch (e) { console.error('[ايدت] فشل تقليص الفيديو:', String(e?.stderr || e?.message || e).slice(-200)); }
    finally { rmrf(dir); }
    return null;
}

// تنزيل فيديو واحد من رابطه في تيك توك بنفس طريقة أمر .تيك (يعمل مع كل ما يعمل معه الأمر)
async function getEditBuf(v, notes) {
    if (!v.url || !/^https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//i.test(v.url)) return null;
    let res;
    try {
        res = await fetchMedia(v.url, 'tiktok', false);
        const file = res.videos[0];
        if (!file) throw new Error('لا فيديو');
        if (!v.title && res.title) v.title = res.title;
        if (!v.author && res.author) v.author = res.author;
        const buf = fs.readFileSync(await ensureWhatsAppMp4(file, res.dir));
        if (buf.length > 20000) { const s = await shrinkEdit(buf); if (s) return s; }
    } catch (e) { notes.push('تنزيل: ' + String(e?.friendly || e?.message || e).slice(0, 80)); }
    finally { if (res?.dir) rmrf(res.dir); }
    return null;
}

// بحث تيك توك بالكلمات المفتاحية → روابط tiktok.com للفيديوهات
async function tiktokSearch(keywords, notes) {
    const out = [];
    const cursor = [0, 0, 10, 20][Math.floor(Math.random() * 4)];       // تنويع النتائج في كل مرة
    try {
        const j = await tikwmJson(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(keywords)}&count=20&cursor=${cursor}&hd=1`, 25000);
        const list = j && j.code === 0 ? (j.data?.videos || []) : [];
        for (const d of list) {
            const author = String(d.author?.unique_id || '').trim();
            const id = String(d.video_id || d.aweme_id || '').trim();
            if (!author || !id) continue;
            out.push({ id, title: String(d.title || '').trim(), author, duration: Number(d.duration || 0), plays: Number(d.play_count || 0),
                url: `https://www.tiktok.com/@${author}/video/${id}` });
        }
        if (!out.length) notes.push(`بحث تيك توك: 0 نتائج لـ«${keywords}»`);
    } catch (e) { notes.push(`بحث تيك توك: ${String(e?.message || e).slice(0, 70)}`); }
    return out;
}

// بحث ويب عن روابط تيك توك الأصلية (tiktok.com) فقط
async function webSearchTikTok(query, notes) {
    const q = `site:tiktok.com ${query}`;
    const urls = [
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
        `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en&count=30`
    ];
    const found = new Map();
    const grab = (txt) => {
        const re = /tiktok\.com\/(@[\w.\-]+)\/video\/(\d{8,25})/g;
        let m; while ((m = re.exec(txt))) if (!found.has(m[2])) found.set(m[2], m[1].slice(1));
        const re2 = /tiktok\.com\s*(?:›|&rsaquo;|&#8250;)\s*(@[\w.\-]+)\s*(?:›|&rsaquo;|&#8250;)\s*video\s*(?:›|&rsaquo;|&#8250;)\s*(\d{8,25})/g;
        while ((m = re2.exec(txt))) if (!found.has(m[2])) found.set(m[2], m[1].slice(1));
    };
    for (const u of urls) {
        try {
            const html = (await getBuf(u, { timeout: 20000, max: 4 * MB, headers: { 'Accept-Language': 'en-US,en;q=0.9' } })).toString('utf8');
            grab(html);
            grab(html.replace(/%2F/gi, '/').replace(/%40/g, '@').replace(/%3A/gi, ':'));
            const re3 = /[?&;]u=a1([A-Za-z0-9_\-]+)/g;                     // روابط بينغ المشفّرة
            let m; while ((m = re3.exec(html))) { try { grab(Buffer.from(m[1], 'base64url').toString('utf8')); } catch (e) {} }
        } catch (e) { notes.push(`بحث ويب: ${String(e?.message || e).slice(0, 70)}`); }
        if (found.size >= 8) break;
    }
    if (!found.size) notes.push(`بحث ويب: 0 روابط لـ«${query}»`);
    const list = [...found].slice(0, 8).map(([id, author]) => ({ id, title: '', author, duration: 0, plays: 0, url: `https://www.tiktok.com/@${author}/video/${id}` }));
    await Promise.allSettled(list.map(async (v) => {                       // العنوان من oEmbed (اختياري)
        try { const j = await getJson('https://www.tiktok.com/oembed?url=' + encodeURIComponent(v.url), 8000); v.title = String(j?.title || '').trim(); } catch (e) {}
    }));
    return list;
}

const recentEdits = [];                  // آخر الإيديتات المرسلة، حتى لا تتكرر نفس الفيديوهات
const EDIT_STOP = new Set(['edit', 'edits', 'anime', 'amv', 'fyp', 'ايدت', 'ايديت', 'ايديتات', 'إيديت', 'تصميم', 'تصاميم', 'تصميمات', 'ايدتات']);
const compact = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');

async function fetchEdits(name, notes) {
    const hasAr = /[\u0600-\u06FF]/.test(name);
    const en = hasAr ? await toEnglish(name) : '';
    const words = [...new Set(`${name} ${en}`.toLowerCase().split(/\s+/).map(compact).filter((w) => w.length >= 3 && !EDIT_STOP.has(w)))];
    const joined = [compact(en), compact(name)].filter((w) => w.length >= 4);
    // الفيديو ذو صلة بالشخصية إذا ذُكر اسمها (أو جزء منه) في عنوانه أو حسابه
    const relevant = (v) => {
        const t = compact(`${v.title} ${v.author}`);
        if (!t) return true;                                   // لا عنوان متاح: نقبله لأنه جاء من بحث الاسم نفسه
        return words.some((w) => t.includes(w)) || joined.some((w) => t.includes(w));
    };
    const core = en && en.toLowerCase() !== name.toLowerCase() ? en : name;
    const queries = [...new Set([`${core} edit`, `${core} anime edit`, hasAr ? `${name} ايدت` : `${core} edits`].filter(Boolean))];
    const keyOf = (v) => v.id || v.url;
    const seen = new Set(), pool = [], tried = new Set(), got = [];
    let allowRecent = false;
    const add = (list) => {
        for (const v of list) {
            const key = keyOf(v);
            if (!key || seen.has(key) || !v.url || (!allowRecent && recentEdits.includes(key))) continue;
            if (v.duration && (v.duration < 4 || v.duration > 120)) continue;
            if (!relevant(v)) continue;
            seen.add(key); pool.push(v);
        }
    };
    const isEdit = (v) => /edit|ايدت|إيدت|ايديت|إيديت|amv|fyp/i.test(v.title) ? 1 : 0;
    const harvest = async () => {
        const fresh = pool.filter((v) => !tried.has(keyOf(v))).sort((a, b) => (isEdit(b) - isEdit(a)) || (Math.random() - 0.5));
        for (let i = 0; i < fresh.length && got.length < EDITS_COUNT;) {
            const part = fresh.slice(i, i + (EDITS_COUNT - got.length));
            i += part.length;
            part.forEach((v) => tried.add(keyOf(v)));
            const results = await Promise.allSettled(part.map(async (v) => {
                const buf = await getEditBuf(v, notes);
                if (!buf) throw new Error('NO_BUF');
                return { v, buf };
            }));
            for (const r of results) if (r.status === 'fulfilled' && got.length < EDITS_COUNT) got.push(r.value);
        }
    };
    // 1) البحث في تيك توك عن تصاميم الشخصية ثم تنزيل الروابط
    for (const q of queries) { add(await tiktokSearch(q, notes)); if (pool.length >= 9) break; }
    await harvest();
    // 2) بحث ويب عن روابط tiktok.com
    if (got.length < EDITS_COUNT) {
        for (const q of queries.slice(0, 2)) { add(await webSearchTikTok(q, notes)); if (pool.length >= 9) break; }
        await harvest();
    }
    // 3) هاشتاق تيك توك
    if (got.length < EDITS_COUNT) {
        const base = compact(en || name).replace(/[\u0600-\u06FF]/g, '');
        for (const tag of base ? [base + 'edit', base] : []) { add(await tagSearch(tag, notes)); }
        await harvest();
    }
    if (!got.length) {                                          // لم يبقَ شيء جديد: أعد استخدام ما أُرسل سابقاً بدل الفشل
        allowRecent = true;
        for (const q of queries) { add(await tiktokSearch(q, notes)); if (pool.length >= 9) break; }
        await harvest();
    }
    for (const g of got) { recentEdits.push(keyOf(g.v)); if (recentEdits.length > 60) recentEdits.shift(); }
    if (!got.length) notes.push(`مرشّحون=${pool.length}`);
    return got;
}

async function cmdEdits(c) {
    const name = String(c.args || '').replace(URL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name) return c.reply(usage('.ايدت', '<اسم الشخصية>', 'ناروتو', false) + '\n🎬 يجلب لك 3 إيديتات من تيك توك بشكل بطاقات أفقية.');
    await waiting(c, '🎬', 'إيديتات تيك توك', 'تيك توك');
    const notes = [];
    const got = await withSlot(() => fetchEdits(name, notes));
    if (!got.length) {
        console.error('[ايدت] لم تُجلب نتائج:', notes.join(' | '));
        const err = new DlError(`❌ لم أجد إيديتات لـ «${name}». جرّب اسماً آخر أو اكتبه بالإنجليزية.`);
        err.debug = notes.join('\n');
        throw err;
    }
    const cards = got.map(({ v, buf }, i) => ({
        video: buf,
        body: `*🎬 إيديت ${i + 1}*\n\n` + [
            row('📛', 'العنوان', cut(v.title, 70) || '—'),
            row('👤', 'الحساب', '@' + (cut(v.author, 30) || '—')),
            ...(v.duration ? [row('⏱️', 'المدة', fmtDuration(v.duration))] : []),
            row('📱', 'المصدر', 'تيك توك')
        ].join('\n'),
        footer: `🤖 ${DEV}`,
        url: EDIT_CHANNEL_URL,
        button: '📢 انضمام للقناة'
    }));
    if (got.length >= 2) {
        try {
            await sendVideoCarousel(c.sock, c.from, cards, { text: `🎬 *إيديتات ${cut(name, 40)}*`, footer: '👈 مرّر لرؤية باقي الإيديتات' });
            return;
        } catch (e) { console.error('[ايدت] تعذر الكاروسيل، سيتم الإرسال منفصلاً:', e?.message || e); }
    }
    for (let i = 0; i < got.length; i++) {          // احتياط: كل إيديت في رسالة مستقلة
        await c.media({ video: got[i].buf, mimetype: 'video/mp4', caption: cards[i].body + `\n\n🤖 ${DEV}` });
    }
}

// ---------------------------------------------------------------- الموزّع (يستدعيه features.js)
// يرجع دالة معالجة لكل اسم أمر أساسي؛ fq = دالة تقرأ نص الرسالة المردود عليها
export function buildMoreDownloadHandlers({ quotedText, getTarget, download }) {
    const fq = (c) => quotedText(c);
    return {
        'تيك': (c) => platformCommand(c, fq(c), 'tiktok'),
        'انستا': (c) => platformCommand(c, fq(c), 'instagram'),
        'فيس': (c) => platformCommand(c, fq(c), 'facebook'),
        'تويتر': (c) => platformCommand(c, fq(c), 'twitter'),
        'سناب': (c) => platformCommand(c, fq(c), 'snapchat'),
        'ساوند': (c) => platformCommand(c, fq(c), 'soundcloud', { forceAudio: true }),
        'بنتريست_تنزيل': (c) => platformCommand(c, fq(c), 'pinterest'),
        'ميديافاير': (c) => cmdMediafire(c, fq(c)),
        'حمل': (c) => cmdGeneric(c, fq(c)),
        'اغنية': cmdSong,
        'سورة': cmdSurah,
        'قارئ': cmdReciters,
        'محاضرة': cmdLecture,
        'اذان': cmdAdhan,
        'غلاف': (c) => cmdCover(c, fq(c)),
        'معلومات_فيديو': (c) => cmdVideoInfo(c, fq(c)),
        'ايدت': cmdEdits
    };
}

// الأسماء الأساسية والاختصارات (تُدمج في COMMANDS داخل features.js)
export const MORE_COMMANDS = {
    'تيك': ['tiktok', 'تيكتوك', 'تيك_توك'], 'انستا': ['ig', 'insta', 'انستغرام', 'انستقرام'], 'فيس': ['fb', 'فيسبوك'],
    'تويتر': ['tw', 'twitter', 'اكس'], 'سناب': ['snap', 'سنابشات', 'سناب_شات'], 'ساوند': ['soundcloud', 'ساوند_كلاود'],
    'بنتريست_تنزيل': ['pinterest_dl', 'بنتريست_رابط'], 'ميديافاير': ['mediafire', 'ميديا_فاير'], 'حمل': ['dl', 'download'],
    'اغنية': ['song', 'اغاني', 'أغنية'], 'سورة': ['surah', 'سوره'], 'قارئ': ['القراء', 'قراء', 'reciters'],
    'محاضرة': ['lecture', 'محاضره'], 'اذان': ['adhan', 'azan', 'أذان'],
    'غلاف': ['cover', 'thumb', 'ثمنيل'], 'معلومات_فيديو': ['vinfo', 'معلومات_يوتيوب'],
    'ايدت': ['edit', 'edits', 'ايديت', 'ايديتات', 'إيديت', 'ايدتات']
};
export const MORE_LINK_COMMANDS = ['تيك', 'انستا', 'فيس', 'تويتر', 'سناب', 'ساوند', 'بنتريست_تنزيل', 'ميديافاير', 'حمل', 'غلاف', 'معلومات_فيديو'];
export const MORE_HEAVY = ['تيك', 'انستا', 'فيس', 'تويتر', 'سناب', 'ساوند', 'بنتريست_تنزيل', 'ميديافاير', 'حمل', 'اغنية', 'سورة', 'محاضرة', 'اذان', 'غلاف', 'معلومات_فيديو', 'ايدت'];

export const _internalMore = { PLATFORMS, SURAHS, RECITERS };
