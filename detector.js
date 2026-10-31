// ============ قسم الكشف: الرسائل المحذوفة + فحص الأرقام ============
// الأوامر:
//  .تفعيل_كشف_المحذوف / .ايقاف_كشف_المحذوف  ↞ تشغيل/إيقاف تسجيل الرسائل المحذوفة بصمت (مشرفون)
//  .المحذوف                                  ↞ قائمة بكل الرسائل المحذوفة المسجّلة (مشرفون)
//  .المحذوف <رقم>                            ↞ عرض رسالة محذوفة بعينها كاملة (مع وسائطها)
//  .التعديل / .قائمة_التعديل                 ↞ قائمة بكل الرسائل المعدّلة (قبل وبعد)
//  .التعديل <رقم>                            ↞ عرض تعديل بعينه كاملاً
//  .كشف_رقم [@منشن | رد]                     ↞ فحص رقم عضو (مشرفون)
//  .كشف_الوهمي                               ↞ فحص أرقام المجموعة كلها (مشرفون)
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const detectorCommandNames = [
    'تفعيل_كشف_المحذوف', 'ايقاف_كشف_المحذوف', 'المحذوف', 'كشف_المحذوف', 'التعديل', 'قائمة_التعديل',
    'كشف_رقم', 'كشف_الوهمي', 'كشف_الارقام'
];

const SILENT = pino({ level: 'silent' });
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'database');
const FILE = path.join(DIR, 'detector.json');

// ---------- الحالة المحفوظة (المجموعات المفعّل فيها كشف المحذوف) ----------
let state = { enabled: {} };
try { state = { enabled: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) {}
function saveState() {
    try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state)); } catch (e) {}
}

// ---------- ذاكرة الرسائل (لا تُحفظ على القرص) ----------
const CACHE_MAX = 4000;                 // أقصى عدد رسائل
const CACHE_TTL = 12 * 60 * 60 * 1000;  // 12 ساعة
const MEDIA_MAX_ONE = 4 * 1024 * 1024;  // أكبر وسائط تُحفظ (4MB)
const MEDIA_MAX_ALL = 80 * 1024 * 1024; // مجموع الوسائط المحفوظة
const LOG_MAX = 50;                     // آخر المحذوفات لكل مجموعة

const cache = new Map();                // id -> entry
const deletedLog = {};                  // groupJid -> [entry]
const editLog = {};                     // groupJid -> [سجل تعديل]
const recentEdits = new Set();          // لمنع تسجيل نفس التعديل مرتين
const bufQueue = [];                    // لتتبع حجم الوسائط
let bufBytes = 0;

const IGNORE_KEYS = new Set(['messageContextInfo', 'senderKeyDistributionMessage']);
const MEDIA_TYPES = new Set(['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']);

function unwrap(message) {
    let x = message || {};
    for (let i = 0; i < 5; i++) {
        const inner = x.ephemeralMessage?.message || x.viewOnceMessage?.message || x.viewOnceMessageV2?.message ||
            x.viewOnceMessageV2Extension?.message || x.documentWithCaptionMessage?.message || x.editedMessage?.message;
        if (!inner) break;
        x = inner;
    }
    return x;
}

function describe(msg) {
    const content = unwrap(msg.message);
    const type = Object.keys(content).find(k => !IGNORE_KEYS.has(k)) || '';
    const body = content[type] || {};
    const text = content.conversation || content.extendedTextMessage?.text || body.caption || '';
    return { content, type, body, text };
}

function pruneCache() {
    const now = Date.now();
    for (const [id, e] of cache) {
        if (now - e.t > CACHE_TTL || cache.size > CACHE_MAX) cache.delete(id);
        else break; // الخريطة مرتبة حسب وقت الإدخال
    }
}

function trackBuffer(entry) {
    bufQueue.push(entry);
    bufBytes += entry.buf.length;
    while (bufBytes > MEDIA_MAX_ALL && bufQueue.length) {
        const old = bufQueue.shift();
        if (old.buf) { bufBytes -= old.buf.length; old.buf = null; }
    }
}

// تُستدعى لكل رسالة واردة: تحفظها مؤقتاً إذا كان الكشف مفعّلاً في مجموعتها
export function cacheIncoming(sock, msg) {
    try {
        const from = msg?.key?.remoteJid;
        if (!from || !from.endsWith('@g.us') || msg.key.fromMe || !state.enabled[from]) return;
        if (!msg.message || unwrap(msg.message).protocolMessage) return;
        const { type, body, text } = describe(msg);
        if (!type) return;
        const entry = {
            id: msg.key.id, from, msg, type, text,
            sender: msg.key.participant || '', t: Date.now(), buf: null
        };
        cache.set(entry.id, entry);
        pruneCache();
        const viewOnce = !!(msg.message.viewOnceMessage || msg.message.viewOnceMessageV2 || msg.message.viewOnceMessageV2Extension || body.viewOnce);
        const size = Number(body.fileLength?.low ?? body.fileLength ?? 0);
        if (MEDIA_TYPES.has(type) && !viewOnce && size <= MEDIA_MAX_ONE) {
            downloadMediaMessage(msg, 'buffer', {}, { logger: SILENT, reuploadRequest: sock.updateMediaMessage })
                .then(buf => { if (buf && buf.length <= MEDIA_MAX_ONE) { entry.buf = buf; trackBuffer(entry); } })
                .catch(() => {});
        }
    } catch (e) {}
}

const timeAr = (t) => new Date(t).toLocaleTimeString('ar-JO', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit' });
const num = (jid) => String(jid || '').split('@')[0].split(':')[0];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TYPE_NAMES = {
    conversation: 'نص', extendedTextMessage: 'نص', imageMessage: 'صورة', videoMessage: 'فيديو',
    audioMessage: 'مقطع صوتي', stickerMessage: 'ملصق', documentMessage: 'ملف', contactMessage: 'جهة اتصال',
    locationMessage: 'موقع', pollCreationMessage: 'استطلاع'
};

async function reveal(sock, from, entry, deleter, sendBotMessage) {
    const mentions = [...new Set([entry.sender, deleter].filter(Boolean))];
    let head = `🗑️ *رسالة محذوفة*\n👤 المرسل ↞ @${num(entry.sender)}\n🕒 وقت الإرسال ↞ ${timeAr(entry.t)}\n📎 النوع ↞ ${TYPE_NAMES[entry.type] || 'رسالة'}`;
    if (deleter && num(deleter) !== num(entry.sender)) head += `\n🧹 حذفها ↞ @${num(deleter)}`;
    const { body, type } = describe(entry.msg);
    const textPart = entry.text ? `\n\n${entry.text}` : '';
    try {
        if (entry.buf && type === 'imageMessage') return await sendBotMessage(sock, from, { image: entry.buf, caption: head + textPart, mentions });
        if (entry.buf && type === 'videoMessage') return await sendBotMessage(sock, from, { video: entry.buf, caption: head + textPart, mentions, mimetype: body.mimetype });
        if (entry.buf && type === 'documentMessage') return await sendBotMessage(sock, from, { document: entry.buf, mimetype: body.mimetype, fileName: body.fileName || 'file', caption: head + textPart, mentions });
        if (entry.buf && type === 'stickerMessage') {
            await sendBotMessage(sock, from, { sticker: entry.buf });
            return await sendBotMessage(sock, from, { text: head, mentions });
        }
        if (entry.buf && type === 'audioMessage') {
            await sendBotMessage(sock, from, { audio: entry.buf, mimetype: body.mimetype || 'audio/ogg; codecs=opus', ptt: !!body.ptt });
            return await sendBotMessage(sock, from, { text: head, mentions });
        }
        if (type === 'locationMessage') {
            await sendBotMessage(sock, from, { location: { degreesLatitude: body.degreesLatitude, degreesLongitude: body.degreesLongitude } });
            return await sendBotMessage(sock, from, { text: head, mentions });
        }
        if (MEDIA_TYPES.has(type)) head += `\n⚠️ تعذّر استرجاع الوسائط (كبيرة الحجم أو حُذفت قبل حفظها).`;
        return await sendBotMessage(sock, from, { text: head + textPart, mentions });
    } catch (e) { /* تجاهل */ }
}

// وصف محتوى الرسالة المحذوفة بنص قابل للعرض في القائمة
function contentLine(entry) {
    const { type, body, text } = describe(entry.msg);
    const parts = [];
    if (text) parts.push(text.length > 500 ? text.slice(0, 500) + '… (للنص الكامل: .المحذوف رقمها)' : text);
    if (type === 'contactMessage') parts.push(`📇 ${body.displayName || ''}`);
    if (type === 'locationMessage') parts.push(`📍 ${body.name || ''} (${body.degreesLatitude}, ${body.degreesLongitude})`.trim());
    if (type === 'documentMessage') parts.push(`📄 ${body.fileName || 'ملف'}`);
    if (type === 'pollCreationMessage') parts.push(`📊 ${body.name || ''}`);
    if (MEDIA_TYPES.has(type)) parts.push(entry.buf ? '✅ الوسائط محفوظة — اعرضها برقمها' : '⚠️ الوسائط غير محفوظة');
    return parts.join('\n') || '(بدون نص)';
}

function buildDeletedList(log) {
    const items = [...log].reverse(); // 1 = الأحدث
    return items.map((e, i) => {
        let t = `*${i + 1}.* 👤 @${num(e.sender)}\n🕒 أُرسلت ${timeAr(e.t)}`;
        if (e.deletedAt) t += ` • 🗑️ حُذفت ${timeAr(e.deletedAt)}`;
        t += `\n📎 ${TYPE_NAMES[e.type] || 'رسالة'}`;
        if (e.deleter && num(e.deleter) !== num(e.sender)) t += ` • 🧹 حذفها @${num(e.deleter)}`;
        t += `\n${contentLine(e)}`;
        return t;
    });
}

function textOf(message) {
    const c = unwrap(message || {});
    const t = Object.keys(c).find(k => !IGNORE_KEYS.has(k)) || '';
    const b = c[t] || {};
    return c.conversation || c.extendedTextMessage?.text || b.caption || '';
}

// تسجيل تعديل رسالة (قبل/بعد)
function recordEdit(from, key, participant, newMessage) {
    if (!from || !state.enabled[from] || !key?.id || !newMessage) return false;
    const newText = textOf(newMessage);
    const sig = `${key.id}|${newText}`;
    if (recentEdits.has(sig)) return true;
    recentEdits.add(sig);
    if (recentEdits.size > 500) recentEdits.delete(recentEdits.values().next().value);
    const entry = cache.get(key.id);
    const rec = {
        id: key.id, sender: participant || entry?.sender || '', type: entry?.type || '',
        oldText: entry ? entry.text : null, newText, t: entry?.t || null, editedAt: Date.now()
    };
    if (entry) entry.text = newText; // التعديل التالي يقارَن بهذا النص
    const log = (editLog[from] = editLog[from] || []);
    log.push(rec);
    while (log.length > LOG_MAX) log.shift();
    return true;
}

// بعض إصدارات Baileys تُبلّغ بالتعديل عبر messages.update بدل messages.upsert
export function handleMessagesUpdate(updates) {
    try {
        for (const u of updates || []) {
            const key = u?.key;
            if (!key?.remoteJid?.endsWith('@g.us') || key.fromMe) continue;
            const em = u.update?.message?.editedMessage?.message;
            const nc = em?.protocolMessage?.editedMessage || em;
            if (nc) recordEdit(key.remoteJid, key, key.participant, nc);
        }
    } catch (e) {}
}

function editRow(r, i, full) {
    const cut = (x) => (!full && x && x.length > 300) ? x.slice(0, 300) + `… (للكامل: .التعديل ${i + 1})` : x;
    let t = `*${i + 1}.* 👤 @${num(r.sender)}\n`;
    t += r.t ? `🕒 أُرسلت ${timeAr(r.t)} • ✏️ عُدّلت ${timeAr(r.editedAt)}` : `✏️ عُدّلت ${timeAr(r.editedAt)}`;
    if (r.type) t += `\n📎 ${TYPE_NAMES[r.type] || 'رسالة'}`;
    t += `\n📝 قبل: ${r.oldText === null ? '(غير متوفر — الرسالة أُرسلت قبل بدء التسجيل)' : (cut(r.oldText) || '(فارغ)')}`;
    t += `\n✅ بعد: ${cut(r.newText) || '(فارغ)'}`;
    return t;
}

async function sendChunked(sock, from, title, rows, footer, mentions, send) {
    let chunk = title;
    const flush = async (last) => {
        await send(sock, from, { text: chunk + (last ? footer : ''), mentions });
        chunk = '';
    };
    for (const r of rows) {
        if ((chunk + r).length > 3500) await flush(false);
        chunk += r + '\n\n';
    }
    await flush(true);
}

// تُستدعى عند وصول رسالة حذف (REVOKE) أو تعديل. ترجع true إذا تم تسجيلها.
export async function handleRevoke({ sock, msg, sendBotMessage }) {
    try {
        const pm = unwrap(msg?.message).protocolMessage;
        // نفس المدخل يلتقط التعديلات أيضاً (MESSAGE_EDIT)
        if (pm && (pm.type === 14 || pm.type === 'MESSAGE_EDIT') && pm.key?.id && pm.editedMessage) {
            const g = msg.key.remoteJid;
            if (!g?.endsWith('@g.us') || msg.key.fromMe) return false;
            return recordEdit(g, pm.key, pm.key.participant || msg.key.participant, pm.editedMessage);
        }
        if (!pm || !(pm.type === 0 || pm.type === 'REVOKE') || !pm.key?.id) return false;
        const from = msg.key.remoteJid;
        if (!from?.endsWith('@g.us') || msg.key.fromMe || !state.enabled[from]) return false;
        const entry = cache.get(pm.key.id);
        if (!entry || entry.revealed) return false;
        entry.revealed = true;
        entry.deleter = msg.key.participant || null;
        entry.deletedAt = Date.now();
        const log = (deletedLog[from] = deletedLog[from] || []);
        log.push(entry);
        while (log.length > LOG_MAX) log.shift();
        return true; // تسجيل صامت: لا يُرسل شيء للمجموعة
    } catch (e) { return false; }
}

// ================== فحص الأرقام ==================
// كود الدولة -> رمز ISO (1 و 7 مشتركان بين أكثر من دولة)
const CC = {
    1: 'US', 7: 'RU', 20: 'EG', 27: 'ZA', 30: 'GR', 31: 'NL', 32: 'BE', 33: 'FR', 34: 'ES', 36: 'HU', 39: 'IT', 40: 'RO', 41: 'CH', 43: 'AT', 44: 'GB', 45: 'DK', 46: 'SE', 47: 'NO', 48: 'PL', 49: 'DE',
    51: 'PE', 52: 'MX', 53: 'CU', 54: 'AR', 55: 'BR', 56: 'CL', 57: 'CO', 58: 'VE', 60: 'MY', 61: 'AU', 62: 'ID', 63: 'PH', 64: 'NZ', 65: 'SG', 66: 'TH', 81: 'JP', 82: 'KR', 84: 'VN', 86: 'CN',
    90: 'TR', 91: 'IN', 92: 'PK', 93: 'AF', 94: 'LK', 95: 'MM', 98: 'IR', 212: 'MA', 213: 'DZ', 216: 'TN', 218: 'LY', 220: 'GM', 221: 'SN', 222: 'MR', 223: 'ML', 224: 'GN', 225: 'CI', 226: 'BF',
    227: 'NE', 228: 'TG', 229: 'BJ', 230: 'MU', 231: 'LR', 232: 'SL', 233: 'GH', 234: 'NG', 235: 'TD', 236: 'CF', 237: 'CM', 238: 'CV', 239: 'ST', 240: 'GQ', 241: 'GA', 242: 'CG', 243: 'CD', 244: 'AO',
    245: 'GW', 248: 'SC', 249: 'SD', 250: 'RW', 251: 'ET', 252: 'SO', 253: 'DJ', 254: 'KE', 255: 'TZ', 256: 'UG', 257: 'BI', 258: 'MZ', 260: 'ZM', 261: 'MG', 263: 'ZW', 264: 'NA', 265: 'MW', 266: 'LS',
    267: 'BW', 268: 'SZ', 269: 'KM', 351: 'PT', 352: 'LU', 353: 'IE', 354: 'IS', 355: 'AL', 356: 'MT', 357: 'CY', 358: 'FI', 359: 'BG', 370: 'LT', 371: 'LV', 372: 'EE', 373: 'MD', 374: 'AM', 375: 'BY',
    380: 'UA', 381: 'RS', 385: 'HR', 386: 'SI', 387: 'BA', 389: 'MK', 420: 'CZ', 421: 'SK', 591: 'BO', 593: 'EC', 595: 'PY', 598: 'UY', 880: 'BD', 960: 'MV', 961: 'LB', 962: 'JO', 963: 'SY', 964: 'IQ',
    965: 'KW', 966: 'SA', 967: 'YE', 968: 'OM', 970: 'PS', 971: 'AE', 972: 'IL', 973: 'BH', 974: 'QA', 975: 'BT', 976: 'MN', 977: 'NP', 992: 'TJ', 993: 'TM', 994: 'AZ', 995: 'GE', 996: 'KG', 998: 'UZ'
};
// الدول المتوقعة في مجموعة عربية (غيرها يُعدّ «خارج النطاق» فقط كمؤشر ضعيف)
const EXPECTED = new Set(['EG', 'MA', 'DZ', 'TN', 'LY', 'SD', 'SO', 'DJ', 'MR', 'LB', 'JO', 'SY', 'IQ', 'KW', 'SA', 'YE', 'OM', 'PS', 'IL', 'AE', 'BH', 'QA', 'KM']);
const VIRTUAL_HEAVY = new Set(['1', '44']); // أكواد يكثر عليها بيع الأرقام الافتراضية

let regionNames = null;
try { regionNames = new Intl.DisplayNames(['ar'], { type: 'region' }); } catch (e) {}
const flag = (iso) => [...iso].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');

function lookupCountry(n) {
    for (const len of [3, 2, 1]) {
        const code = n.slice(0, len);
        const iso = CC[code];
        if (iso) {
            let name = regionNames ? (regionNames.of(iso) || iso) : iso;
            if (code === '1') name = 'أمريكا/كندا';
            if (code === '7') name = 'روسيا/كازاخستان';
            return { code, iso, name, flag: code === '1' ? '🇺🇸' : flag(iso) };
        }
    }
    return null;
}

function hasSequential(s, min) {
    let up = 1, down = 1;
    for (let i = 1; i < s.length; i++) {
        const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
        up = d === 1 ? up + 1 : 1;
        down = d === -1 ? down + 1 : 1;
        if (up >= min || down >= min) return true;
    }
    return false;
}

export function analyzeNumber(n) {
    const reasons = [];
    let score = 0;
    const c = lookupCountry(n);
    if (!c) { score += 3; reasons.push('كود دولة غير معروف'); }
    if (n.length < 8 || n.length > 15) { score += 3; reasons.push('طول الرقم غير طبيعي'); }
    const national = c ? n.slice(c.code.length) : n;
    if (c && national.length < 6) { score += 2; reasons.push('الرقم المحلي قصير جداً'); }
    if (/(\d)\1{5,}/.test(national)) { score += 3; reasons.push('أرقام مكررة بشكل غير طبيعي'); }
    if (hasSequential(national, 7)) { score += 3; reasons.push('تسلسل أرقام مصطنع'); }
    if (c && VIRTUAL_HEAVY.has(c.code)) { score += 2; reasons.push('كود يكثر عليه بيع الأرقام الافتراضية'); }
    else if (c && !EXPECTED.has(c.iso)) { score += 1; reasons.push('خارج الدول المتوقعة للمجموعة'); }
    return { n, c, score, reasons };
}

const level = (s) => (s >= 4 ? '🔴 مشبوه بدرجة عالية' : s >= 2 ? '🟠 مشبوه' : '🟢 يبدو طبيعياً');
const NOTE = 'ℹ️ هذا تقدير مبني على مؤشرات في الرقم، وليس إثباتاً قاطعاً — كثير من المغتربين لديهم أرقام أجنبية حقيقية.';

// يحوّل مشارك/معرّف إلى رقم هاتف (يدعم معرّفات LID إن توفّر الرقم في بيانات المجموعة)
function phoneOf(p) {
    for (const x of [p?.phoneNumber, p?.jid, p?.id, typeof p === 'string' ? p : null]) {
        if (x && String(x).endsWith('@s.whatsapp.net')) return num(x).replace(/\D/g, '');
    }
    return null;
}

async function resolveTarget(sock, msg, from, sender) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const jid = ctx?.mentionedJid?.[0] || ctx?.participant || sender;
    let phone = phoneOf(jid);
    if (!phone) {
        try {
            const meta = await sock.groupMetadata(from);
            const p = meta.participants.find(x => x.id === jid || x.lid === jid);
            phone = phoneOf(p);
        } catch (e) {}
    }
    return { jid, phone };
}

async function checkOne(sock, msg, from, sender, sendBotMessage) {
    const { jid, phone } = await resolveTarget(sock, msg, from, sender);
    if (!phone) return sendBotMessage(sock, from, { text: '⚠️ تعذّر معرفة رقم هذا العضو (واتساب يخفي رقمه).', mentions: [jid] });
    const a = analyzeNumber(phone);
    const pnJid = phone + '@s.whatsapp.net';
    let registered = null, business = null, hasPic = null, bio = null;
    try { const r = await sock.onWhatsApp(pnJid); registered = !!(r && r[0] && r[0].exists); } catch (e) {}
    try { const b = await sock.getBusinessProfile(pnJid); business = !!b; } catch (e) {}
    try { await sock.profilePictureUrl(pnJid, 'image'); hasPic = true; } catch (e) { hasPic = false; }
    try {
        const st = await sock.fetchStatus(pnJid);
        const s = Array.isArray(st) ? (st[0]?.status ?? st[0]) : st;
        bio = s?.status || s?.text || null;
    } catch (e) {}
    let score = a.score;
    const reasons = [...a.reasons];
    if (hasPic === false && !bio && !business) { score += 1; reasons.push('بلا صورة ولا نبذة'); }

    const text = `📱 *كشف الرقم*\n\n` +
        `👤 العضو ↞ @${num(jid)}\n` +
        `🔢 الرقم ↞ +${phone}\n` +
        `🌍 الدولة ↞ ${a.c ? `${a.c.flag} ${a.c.name} (+${a.c.code})` : 'غير معروفة'}\n` +
        (registered === null ? '' : `✅ واتساب ↞ ${registered ? 'مسجّل' : 'غير مسجّل'}\n`) +
        (business === null ? '' : `🏢 نوع الحساب ↞ ${business ? 'تجاري' : 'عادي'}\n`) +
        `🖼️ الصورة ↞ ${hasPic ? 'موجودة' : 'غير موجودة أو مخفية'}\n` +
        `💬 النبذة ↞ ${bio ? bio : 'لا توجد أو مخفية'}\n\n` +
        `🎯 التقييم ↞ ${level(score)}\n` +
        `📌 المؤشرات ↞ ${reasons.length ? reasons.join('، ') : 'لا توجد مؤشرات مريبة'}\n\n${NOTE}`;
    return sendBotMessage(sock, from, { text, mentions: [jid] });
}

async function scanGroup(sock, from, sendBotMessage) {
    const meta = await sock.groupMetadata(from);
    const results = [];
    let unknown = 0;
    for (const p of meta.participants) {
        const phone = phoneOf(p);
        if (!phone) { unknown++; continue; }
        results.push({ ...analyzeNumber(phone), jid: p.id });
    }
    const byCountry = {};
    for (const r of results) {
        const k = r.c ? `${r.c.flag} ${r.c.name}` : '❓ غير معروف';
        byCountry[k] = (byCountry[k] || 0) + 1;
    }
    const dist = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' • ');
    const suspects = results.filter(r => r.score >= 2).sort((a, b) => b.score - a.score);
    const shown = suspects.slice(0, 25);
    let text = `🕵️ *فحص أرقام المجموعة*\n\n👥 الأعضاء ↞ ${meta.participants.length} | 🔍 المفحوص ↞ ${results.length}` +
        (unknown ? ` | 🙈 مخفي ↞ ${unknown}` : '') + `\n🌍 التوزيع ↞ ${dist || '—'}\n\n`;
    if (!shown.length) text += '✅ لا توجد أرقام مشبوهة.\n';
    else {
        text += `🚨 *المشبوهون (${suspects.length}):*\n`;
        shown.forEach((r, i) => {
            text += `${i + 1}. @${num(r.jid)} ↞ ${r.c ? r.c.flag : '❓'} ${level(r.score)} — ${r.reasons.join('، ')}\n`;
        });
        if (suspects.length > shown.length) text += `… و${suspects.length - shown.length} آخرين\n`;
    }
    text += `\n${NOTE}`;
    return sendBotMessage(sock, from, { text, mentions: shown.map(r => r.jid) });
}

// ================== معالج الأوامر ==================
export async function handleDetectorCommand({ sock, msg, from, sender, cmd, cmdBase, isSenderAdmin, isSenderDev, sendBotMessage }) {
    if (!detectorCommandNames.includes(cmdBase)) return false;
    if (!from.endsWith('@g.us')) return false;
    if (!isSenderAdmin && !isSenderDev) {
        await sendBotMessage(sock, from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!' });
        return true;
    }

    if (cmdBase === 'تفعيل_كشف_المحذوف') {
        state.enabled[from] = true; saveState();
        await sendBotMessage(sock, from, { text: '🟢 *تم تفعيل تسجيل الرسائل المحذوفة والمعدّلة.*\nسأسجّل بصمت (بدون إرسال شيء للمجموعة) أي رسالة تُحذف أو تُعدَّل، وتراها بالأمرين `.المحذوف` و`.التعديل`\n\n⚠️ لا أستطيع تسجيل ما حدث قبل التفعيل.' });
        return true;
    }
    if (cmdBase === 'ايقاف_كشف_المحذوف') {
        delete state.enabled[from]; saveState();
        for (const [id, e] of cache) if (e.from === from) cache.delete(id);
        delete deletedLog[from];
        delete editLog[from];
        await sendBotMessage(sock, from, { text: '🔴 تم إيقاف تسجيل المحذوف والمعدّل ومسح ما تم حفظه.' });
        return true;
    }
    if (cmdBase === 'المحذوف' || cmdBase === 'كشف_المحذوف') {
        if (!state.enabled[from]) {
            await sendBotMessage(sock, from, { text: '⚠️ التسجيل غير مفعّل في هذه المجموعة.\nفعّله بالأمر `.تفعيل_كشف_المحذوف` وسأسجّل أي رسالة تُحذف بعده.' });
            return true;
        }
        const log = deletedLog[from] || [];
        if (!log.length) {
            await sendBotMessage(sock, from, { text: '📭 لا توجد رسائل محذوفة مسجّلة بعد.' });
            return true;
        }
        const arg = parseInt(cmd.split(' ')[1]);
        const items = [...log].reverse();
        if (arg) { // عرض رسالة بعينها كاملة
            const e = items[arg - 1];
            if (!e) { await sendBotMessage(sock, from, { text: `⚠️ لا توجد رسالة بالرقم ${arg}. المتاح: 1 إلى ${items.length}` }); return true; }
            await reveal(sock, from, e, e.deleter, sendBotMessage);
            return true;
        }
        const rows = buildDeletedList(log);
        const mentions = [...new Set(log.flatMap(e => [e.sender, e.deleter]).filter(Boolean))];
        await sendChunked(sock, from, `🗑️ *قائمة الرسائل المحذوفة (${rows.length})*\n\n`, rows,
            `\n━━━━━━━━\n📌 لعرض رسالة كاملة مع وسائطها: \`.المحذوف <رقم>\``, mentions, sendBotMessage);
        return true;
    }
    if (cmdBase === 'التعديل' || cmdBase === 'قائمة_التعديل') {
        if (!state.enabled[from]) {
            await sendBotMessage(sock, from, { text: '⚠️ التسجيل غير مفعّل في هذه المجموعة.\nفعّله بالأمر `.تفعيل_كشف_المحذوف` وسأسجّل أي رسالة تُعدَّل بعده.' });
            return true;
        }
        const log = editLog[from] || [];
        if (!log.length) {
            await sendBotMessage(sock, from, { text: '📭 لا توجد رسائل معدّلة مسجّلة بعد.' });
            return true;
        }
        const arg = parseInt(cmd.split(' ')[1]);
        const items = [...log].reverse();
        if (arg) {
            const r = items[arg - 1];
            if (!r) { await sendBotMessage(sock, from, { text: `⚠️ لا يوجد تعديل بالرقم ${arg}. المتاح: 1 إلى ${items.length}` }); return true; }
            await sendBotMessage(sock, from, { text: `✏️ *تعديل رقم ${arg}*\n\n` + editRow(r, arg - 1, true), mentions: [r.sender].filter(Boolean) });
            return true;
        }
        const rows = items.map((r, i) => editRow(r, i, false));
        const mentions = [...new Set(items.map(r => r.sender).filter(Boolean))];
        await sendChunked(sock, from, `✏️ *قائمة الرسائل المعدّلة (${rows.length})*\n\n`, rows,
            `\n━━━━━━━━\n📌 لعرض تعديل كامل: \`.التعديل <رقم>\``, mentions, sendBotMessage);
        return true;
    }
    if (cmdBase === 'كشف_رقم') { await checkOne(sock, msg, from, sender, sendBotMessage); return true; }
    if (cmdBase === 'كشف_الوهمي' || cmdBase === 'كشف_الارقام') { await scanGroup(sock, from, sendBotMessage); return true; }
    return false;
}
