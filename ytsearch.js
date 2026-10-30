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
const DEV = 'Eren';
const CMD = '.بحث_يوت';
const RESULTS = 6;

// ---------------------------------------------------------------- التصميم (نفس أسلوب باقي الأقسام: عنوان + سطور > ↞)
const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const row = (emoji, label, value) => `> ${emoji} ${label} ↞ ${value}`;
// title: عنوان القسم | blocks: مجموعات سطور تُفصل بسطر فارغ | note: ملاحظة أخيرة
const frame = (title, blocks, note) => [title, '', ...blocks.map((b) => b.join('\n') + '\n'), ...(note ? [note] : [])].join('\n').trim();

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
    const list = items.map((v, i) => [
        `> ${NUM[i] || (i + 1)} ${cut(v.title, 42)}`,
        `> ⏱️ ${fmtDuration(v.duration)}  •  👁️ ${v.views === null ? '—' : fmtViews(v.views)}`
    ]);
    const text = frame('🔍 *نَـتَـائِـجُ الـبَـحْـثِ:*', [
        [row('🔎', 'البحث', cut(query, 60)), row('📊', 'النتائج', `${items.length} فيديو`)],
        ...list
    ], '💡 اضغط زر «اختر فيديو» بالأسفل.');

    const button = selectButton('🔍 اختر فيديو', [{
        title: '🎬 النتائج',
        rows: items.map((v, i) => ({
            header: '',
            title: `${NUM[i] || (i + 1)} ${cut(v.title, 22)}`,
            description: `⏱️ ${fmtDuration(v.duration)} • 👁️ ${v.views === null ? '—' : fmtViews(v.views)}`,
            id: `${CMD} ~v ${v.id}`
        }))
    }]);

    const image = await fetchThumb(items[0].id);
    const ok = await sendCardWithButtons(c.sock, c.from, {
        title: '', subtitle: '', image, text, footer: DEV,
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
    const meta = [row('📛', 'العنوان', cut(info.title, 50))];
    if (info.channel) meta.push(row('📺', 'القناة', cut(info.channel, 30)));
    if (info.duration) meta.push(row('⏱️', 'المدة', fmtDuration(info.duration)));
    const text = frame('🎥 *اخْـتَـرْ الـجَـوْدَةَ:*', [
        meta,
        QUALITY_ROWS.map((r) => row(r.emoji, r.label, r.desc))
    ], '💡 اضغط زر «اختر الجودة» بالأسفل.\n📲 الفيديو يصلك مقطعاً جاهزاً للتشغيل في واتساب.');
    const button = selectButton('🎥 اختر الجودة', [{
        title: 'الجودة',
        rows: QUALITY_ROWS.map((r) => ({
            header: '',
            title: `${r.emoji} ${r.label}`,
            description: r.desc,
            id: `${CMD} ~q ${id} ${r.q}`
        }))
    }]);
    const image = await fetchThumb(id);
    const ok = await sendCardWithButtons(c.sock, c.from, {
        title: '', subtitle: '', image, text, footer: DEV,
        mentionJid: c.sender, extraButtons: [button]
    });
    if (!ok) await c.reply(`${text}\n\n⚠️ تعذر عرض الأزرار، حاول مرة أخرى.`);
}

// ---------------------------------------------------------------- الخطوة 3: التنزيل والإرسال
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

async function stepDownload(c, id, quality) {
    if (!isYtId(id) || !isQuality(quality)) return c.reply(USAGE);
    const audio = quality === 'mp3';

    await c.reply(frame('⏳ *جَـارِي الـتَّـحْـمِـيـلِ...*', [[
        row(audio ? '🎧' : '🎥', 'النوع', audio ? 'صوت MP3' : `فيديو ${quality}p`),
        row('⚡', 'الحالة', 'يتم التجهيز، لحظات من فضلك')
    ]]));

    const r = await withSlot(() => downloadYt(id, quality));

    const done = frame('✅ *تَـمَّ الـتَّـحْـمِـيـلُ:*', [[
        row('📛', 'العنوان', cut(r.info.title, 50)),
        row(audio ? '🎧' : '🎥', 'الصيغة', audio ? (r.mime === 'audio/mpeg' ? 'MP3' : 'M4A') : `${quality}p`),
        row('📦', 'الحجم', fmtSize(r.buffer.length))
    ]], `🤖 ${DEV}`);

    if (audio) {
        await c.media({ audio: r.buffer, mimetype: r.mime, fileName: r.fileName });
        await c.reply(done);
    } else {
        // دائماً كفيديو جاهز للتشغيل في واتساب (بدون إرساله كملف)
        await c.media({ video: r.buffer, mimetype: 'video/mp4', caption: done });
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
