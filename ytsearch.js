// ============ ytsearch.js : أمر «.بحث_يوت» (بحث ← اختيار فيديو ← اختيار جودة ← تنزيل) ============
// الأمر الوحيد الظاهر في قسم التنزيل. الخطوات التالية تعمل بالأزرار وتستخدم نفس الأمر داخلياً:
//   .بحث_يوت <اسم أو رابط>          ← يعرض نتائج البحث + زر «اختر فيديو»
//   .بحث_يوت ~v <معرّف الفيديو>      ← (من الزر) يعرض بطاقة الجودة + زر «اختر الجودة»
//   .بحث_يوت ~q <معرّف> <الجودة>     ← (من الزر) يبدأ التنزيل ويرسل الملف
import { sendCardWithButtons, selectButton } from './menu.js';
import {
    DlError, withSlot, searchVideos, getVideoInfo, downloadYt, fetchThumb,
    parseYtInput, isYtId, isQuality, fmtDuration, fmtViews
} from './lib/dl.js';

// ---------------------------------------------------------------- الهوية (غيّرها من هنا فقط)
const BRAND = 'EREN BOT';
const DEV = 'Eren';
const CMD = '.بحث_يوت';
const RESULTS = 6;

// ---------------------------------------------------------------- الإطار والصفوف (نفس تصميم الصور)
const LINE = '◈─═────═╋⊰❄️⊱╋═────═─◈';
const row = (emoji, text) => `┃│= ${emoji} ⁝ ${text}`;
const BLANK = '┃│';
const brandLine = () => `┃ _*${BRAND}*_`;
const byLine = () => `┃ \`\`\`BY ¦ ${DEV}\`\`\``;
const frame = (lines) => [LINE, ...lines, brandLine(), LINE, byLine()].join('\n');

// يمنع رموز تنسيق واتساب داخل عناوين الفيديوهات ويقصّ الطويل
const clean = (s) => String(s || '').replace(/[*_~`\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => { const t = clean(s); return t.length > n ? t.slice(0, n).trim() : t; };

const USAGE = `📌 *الاستخدام:*\n\`${CMD} اسم الفيديو\`\nأو \`${CMD} رابط يوتيوب\`\nأو رد على رسالة فيها رابط يوتيوب.`;

// ---------------------------------------------------------------- الجودات
const QUALITY_ROWS = [
    { q: '360', emoji: '🎥', label: '360p', desc: 'جودة عادية' },
    { q: '480', emoji: '🎥', label: '480p', desc: 'جودة متوسطة' },
    { q: '720', emoji: '🎥', label: '720p', desc: 'جودة عالية' },
    { q: '1080', emoji: '🎥', label: '1080p', desc: 'جودة فائقة' },
    { q: 'mp3', emoji: '🎧', label: 'صوت MP3', desc: 'تحميل صوت فقط' }
];

// ---------------------------------------------------------------- الخطوة 1: نتائج البحث
async function stepSearch(c, query) {
    const items = await searchVideos(query, RESULTS);
    const lines = [
        row('🔍', 'نتائج البحث'),
        row('🔎', cut(query, 60)),
        row('📊', `${items.length} فيديو`),
        BLANK
    ];
    items.forEach((v, i) => {
        lines.push(`┃│= ${i + 1} ⁝ ${cut(v.title, 40)}`);
        lines.push(`┃│  ⏱️ ${fmtDuration(v.duration)} · 👁️ ${v.views === null ? '—' : fmtViews(v.views)}`);
    });
    lines.push('', row('📌', 'اضغط الزر واختر فيديو'));
    const text = frame(lines);

    const button = selectButton('🔍 اختر فيديو', [{
        title: '🎬 النتائج',
        rows: items.map((v) => ({
            header: '',
            title: `🎬 〘 ${cut(v.title, 18)} 〙`,
            description: `${fmtDuration(v.duration)} · ${v.views === null ? '—' : fmtViews(v.views)}`,
            id: `${CMD} ~v ${v.id}`
        }))
    }]);

    const image = await fetchThumb(items[0].id);
    const ok = await sendCardWithButtons(c.sock, c.from, {
        title: '🔍 بحث يوتيوب', subtitle: '🔍 بحث يوتيوب', image, text, footer: DEV,
        mentionJid: c.sender, extraButtons: [button]
    });
    if (!ok) {
        const fallback = items.map((v, i) => `${i + 1}. ${cut(v.title, 60)} (${fmtDuration(v.duration)})\nhttps://youtu.be/${v.id}`).join('\n\n');
        await c.reply(`${text}\n\n${fallback}\n\n⚠️ تعذر عرض الأزرار، انسخ رابط الفيديو وأرسله مع الأمر:\n${CMD} <الرابط>`);
    }
}

// ---------------------------------------------------------------- الخطوة 2: اختيار الجودة
async function stepQuality(c, id) {
    if (!isYtId(id)) return c.reply(USAGE);
    const info = await getVideoInfo(id);
    const text = frame([
        row('🎬', 'اختر الجودة'),
        row('📛', cut(info.title, 50)),
        row('📌', 'اضغط واختر الجودة')
    ]);
    const button = selectButton('🎥 اختر الجودة', [{
        title: 'الجودة',
        rows: QUALITY_ROWS.map((r) => ({
            header: '',
            title: `${r.emoji} 〘 ${r.label} 〙`,
            description: r.desc,
            id: `${CMD} ~q ${id} ${r.q}`
        }))
    }]);
    const image = await fetchThumb(id);
    const ok = await sendCardWithButtons(c.sock, c.from, {
        title: '🎥 جودة التحميل', subtitle: '🎥 جودة التحميل', image, text, footer: DEV,
        mentionJid: c.sender, extraButtons: [button]
    });
    if (!ok) await c.reply(`${text}\n\n⚠️ تعذر عرض الأزرار، حاول مرة أخرى.`);
}

// ---------------------------------------------------------------- الخطوة 3: التنزيل والإرسال
async function stepDownload(c, id, quality) {
    if (!isYtId(id) || !isQuality(quality)) return c.reply(USAGE);
    const audio = quality === 'mp3';

    await c.reply(frame([
        row('⏳', 'جاري التحميل...'),
        row(audio ? '🎧' : '🎥', audio ? 'صوت MP3' : `جودة ${quality}p`),
        row('⚡', 'أسرع مصدر')
    ]));

    const r = await withSlot(() => downloadYt(id, quality));

    const done = frame([
        row('🎬', 'تم التحميل'),
        row('📛', audio ? 'audio' : 'video'),
        row('🔷', audio ? 'MP3' : `${quality}p`),
        row('⚡', 'YouTube')
    ]);

    if (r.asDocument) {
        await c.media({ document: r.buffer, mimetype: r.mime, fileName: r.fileName, caption: done });
    } else if (audio) {
        await c.media({ audio: r.buffer, mimetype: r.mime, fileName: r.fileName });
        await c.reply(done);
    } else {
        await c.media({ video: r.buffer, mimetype: r.mime, caption: done });
    }
}

// ---------------------------------------------------------------- نقطة الدخول
// fallbackText: نص الرسالة المردود عليها (لو كتب العضو الأمر وحده ورد على رابط)
export async function cmdYtSearch(c, fallbackText = '') {
    const a = String(c.args || '').trim();

    let m = /^~v\s+([\w-]{11})\s*$/.exec(a);
    if (m) return stepQuality(c, m[1]);

    m = /^~q\s+([\w-]{11})\s+(\w+)\s*$/.exec(a);
    if (m) return stepDownload(c, m[1], m[2].toLowerCase());

    if (a.startsWith('~')) return c.reply(USAGE);

    const q = a || (parseYtInput(fallbackText) ? fallbackText : '');
    if (!q) return c.reply(USAGE);

    // رابط يوتيوب مباشر: نتخطى البحث ونذهب لاختيار الجودة
    const direct = parseYtInput(q);
    if (direct) return stepQuality(c, direct.id);
    if (/^https?:\/\//i.test(q)) throw new DlError('❌ الرابط ليس رابط يوتيوب.');

    return stepSearch(c, q);
}

export const _internal = { frame, row, QUALITY_ROWS, clean, cut };
