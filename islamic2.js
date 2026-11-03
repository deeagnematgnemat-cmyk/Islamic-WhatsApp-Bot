// ============================================================
// أوامر القسم الإسلامي (إضافة):
//  .معلومات_سورة <اسم السورة>  ↞ كل ما يخص السورة + التفسير الميسر
//  .حديث [رقم]                 ↞ حديث نبوي صحيح مع الراوي والمصدر والشرح
// ============================================================
import axios from 'axios';
import { resolveSurah, _internalMore } from './moredl.js';
import { AYAT, MADANI, NUZUL, THEMES } from './surahData.js';
import { HADITHS } from './hadithData.js';

const SURAHS = _internalMore.SURAHS;
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatin = (s) => String(s || '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
const toAr = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FOOT = '*￭─╼━╾─══─┇￮𑀄🕌𑀄￮┇─══─╼━╾─￭*';

// ------------------------------------------------------------ جلب بيانات السورة
const cache = new Map();
function cleanBism(n, ayahs) {
    if (n !== 1 && n !== 9 && ayahs[0]) {
        const w = ayahs[0].text.split(' ');
        const plain = w.slice(0, 4).join(' ').replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '');
        if (w.length > 4 && plain.startsWith('بسم')) ayahs[0] = { ...ayahs[0], text: w.slice(4).join(' ') };
    }
    return ayahs;
}
async function fetchSurahData(n) {
    if (cache.has(n)) return cache.get(n);
    let ayahs = null; let tafsir = null;
    try {
        const r = await axios.get(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,ar.muyassar`, { timeout: 25000 });
        const d = r.data?.data;
        if (Array.isArray(d) && d.length >= 2 && d[0]?.ayahs?.length) {
            ayahs = d[0].ayahs.map((a) => ({ n: a.numberInSurah, text: String(a.text), page: a.page, juz: a.juz, sajda: a.sajda || null }));
            tafsir = (d[1].ayahs || []).map((a) => ({ n: a.numberInSurah, text: String(a.text) }));
        }
    } catch (e) {}
    if (!tafsir || !tafsir.length) {
        try {
            const r = await axios.get(`https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/ar-tafsir-muyassar/${n}.json`, { timeout: 25000 });
            const list = r.data?.ayahs;
            if (Array.isArray(list) && list.length) tafsir = list.map((a) => ({ n: a.ayah, text: String(a.text) }));
        } catch (e) {}
    }
    if (!ayahs) {
        try {
            const r = await axios.get(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf/${n}.json`, { timeout: 20000 });
            const list = r.data?.chapter;
            if (Array.isArray(list) && list.length) ayahs = list.map((a) => ({ n: a.verse, text: String(a.text) }));
        } catch (e) {}
    }
    if (ayahs) ayahs = cleanBism(n, ayahs);
    const out = { ayahs, tafsir };
    if (ayahs || tafsir) cache.set(n, out);
    return out;
}

function chunkText(parts, max = 3500) {
    const chunks = []; let cur = '';
    for (const p of parts) {
        if (cur && (cur.length + p.length + 2) > max) { chunks.push(cur.trim()); cur = ''; }
        cur += p + '\n\n';
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
}

const SURAH_INFO_USAGE = '📖 *معلومات سورة:*\n\n> 📖 .معلومات سورة <اسم أو رقم السورة> ↞ كل ما يخص السورة مع تفسيرها\n> 🔹 .معلومات سورة <اسم السورة> <رقم الآية> ↞ تفسير آية محددة\n> 🔹 .معلومات سورة <اسم السورة> <من>-<إلى> ↞ تفسير مجموعة آيات\n\n💡 أمثلة: `.معلومات سورة الكهف` • `.معلومات سورة البقرة 255` • `.معلومات سورة 112`';

export async function cmdSurahInfo({ sock, from, send }, args) {
    const s = resolveSurah(args);
    if (!s) { await send(sock, from, { text: SURAH_INFO_USAGE }); return true; }
    const n = s.n; const name = SURAHS[n - 1];
    const rest = toLatin(s.rest || '').replace(/^(?:ايه|اية|آية|الايه|الاية|الآية|ايات|آيات)\s*/i, '').trim();
    let range = null;
    if (rest) {
        const m = rest.match(/^(\d{1,3})(?:\s*[-–—~]\s*(\d{1,3})|\s+(?:الى|إلى|الي)\s+(\d{1,3}))?$/);
        if (!m) { await send(sock, from, { text: SURAH_INFO_USAGE }); return true; }
        range = [Number(m[1]), Number(m[2] || m[3] || m[1])];
        if (range[0] > range[1]) range = [range[1], range[0]];
        if (range[0] < 1 || range[1] > AYAT[n - 1]) { await send(sock, from, { text: `❌ سورة ${name} فيها ${toAr(AYAT[n - 1])} آية فقط.` }); return true; }
    }

    const data = await fetchSurahData(n);

    // ---------- بطاقة المعلومات (تُرسل عند طلب السورة كاملة)
    if (!range) {
        const lines = [];
        lines.push(`📖 *معلومات سُورَةِ ${name}*`);
        lines.push('');
        lines.push(`🔹 *ترتيبها في المصحف:* ${toAr(n)} من ١١٤`);
        lines.push(`🔹 *ترتيب نزولها:* ${toAr(NUZUL.indexOf(n) + 1)}`);
        lines.push(`🔹 *نوعها:* ${MADANI.has(n) ? 'مدنية 🕌' : 'مكية 🕋'}`);
        lines.push(`🔹 *عدد آياتها:* ${toAr(AYAT[n - 1])} آية`);
        lines.push(`🔹 *البسملة:* ${n === 9 ? 'لا تبدأ بالبسملة' : 'تبدأ بالبسملة'}`);
        const ay = data.ayahs;
        if (ay && ay.length) {
            const words = ay.reduce((t, a) => t + a.text.split(/\s+/).filter(Boolean).length, 0);
            const letters = ay.reduce((t, a) => t + (a.text.replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').match(/[\u0621-\u064A\u0671]/g) || []).length, 0);
            lines.push(`🔹 *عدد كلماتها:* ${toAr(words)} كلمة (تقريباً)`);
            lines.push(`🔹 *عدد حروفها:* ${toAr(letters)} حرفاً (تقريباً)`);
            const first = ay[0]; const last = ay[ay.length - 1];
            if (first.juz) lines.push(`🔹 *موضعها:* ${first.juz === last.juz ? `الجزء ${toAr(first.juz)}` : `من الجزء ${toAr(first.juz)} إلى الجزء ${toAr(last.juz)}`}`);
            if (first.page) lines.push(`🔹 *صفحاتها:* ${first.page === last.page ? `صفحة ${toAr(first.page)}` : `من صفحة ${toAr(first.page)} إلى ${toAr(last.page)}`} (مصحف المدينة)`);
            const sj = ay.filter((a) => a.sajda).map((a) => a.n);
            lines.push(`🔹 *سجدة التلاوة:* ${sj.length ? `نعم، عند الآية ${sj.map(toAr).join(' و')}` : 'لا يوجد فيها سجدة'}`);
        }
        lines.push('');
        lines.push('📌 *موضوعها ومقاصدها:*');
        lines.push(THEMES[n - 1]);
        if (!data.tafsir || !data.tafsir.length) { lines.push(''); lines.push('⚠️ تعذر جلب التفسير حالياً، حاول بعد قليل.'); }
        else { lines.push(''); lines.push('📚 *التفسير الميسر لها في الرسائل التالية 👇*'); }
        lines.push('');
        lines.push(FOOT);
        await send(sock, from, { text: lines.join('\n') });
    }

    // ---------- التفسير
    if (!data.tafsir || !data.tafsir.length) {
        if (range) await send(sock, from, { text: '❌ تعذر جلب التفسير حالياً، حاول بعد قليل.' });
        return true;
    }
    const [a, b] = range || [1, AYAT[n - 1]];
    const withText = (b - a + 1) <= 40 && data.ayahs;
    const textOf = new Map((data.ayahs || []).map((x) => [x.n, x.text]));
    const parts = data.tafsir.filter((t) => t.n >= a && t.n <= b).map((t) => (
        withText && textOf.get(t.n) ? `﴿${textOf.get(t.n)}﴾ *(${toAr(t.n)})*\n📝 ${t.text.trim()}` : `*(${toAr(t.n)})* ${t.text.trim()}`
    ));
    const chunks = chunkText(parts);
    const label = range ? (a === b ? `الآية ${toAr(a)}` : `الآيات ${toAr(a)} - ${toAr(b)}`) : 'السورة كاملة';
    for (let i = 0; i < chunks.length; i++) {
        const head = i === 0 ? `📚 *التفسير الميسر لسورة ${name} • ${label}*\n\n` : '';
        const tail = i === chunks.length - 1 ? `\n\n📖 المصدر: التفسير الميسر (مجمع الملك فهد لطباعة المصحف الشريف)` : `\n\n📄 (${toAr(i + 1)}/${toAr(chunks.length)})`;
        await send(sock, from, { text: head + chunks[i] + tail });
        if (i < chunks.length - 1) await sleep(900);
    }
    return true;
}

// ------------------------------------------------------------ الحديث النبوي
const lastHadith = new Map();
export async function cmdHadith({ sock, from, send }, args) {
    const a = toLatin(args || '').trim();
    const total = HADITHS.length;
    let i;
    if (a) {
        if (!/^\d{1,3}$/.test(a) || Number(a) < 1 || Number(a) > total) {
            await send(sock, from, { text: `☪️ *حديث نبوي:*\n\n> ☪️ .حديث ↞ حديث صحيح عشوائي مع شرحه\n> 🔢 .حديث <رقم> ↞ حديث محدد (من ١ إلى ${toAr(total)})` });
            return true;
        }
        i = Number(a) - 1;
    } else {
        do { i = Math.floor(Math.random() * total); } while (total > 1 && i === lastHadith.get(from));
        lastHadith.set(from, i);
    }
    const [text, narrator, source, topic, sharh] = HADITHS[i];
    const msg = `☪️ *حديث نبوي شريف* (${toAr(i + 1)}/${toAr(total)})\n\n` +
        `❝ ${text} ❞\n\n` +
        `👤 *الراوي:* ${narrator}\n` +
        `📚 *المصدر:* ${source}\n` +
        `🎯 *موضوع الحديث:* ${topic}\n\n` +
        `📖 *شرح الحديث:*\n${sharh}\n\n` +
        `💡 لحديث آخر اكتب \`.حديث\`\n${FOOT}`;
    await send(sock, from, { text: msg });
    return true;
}
