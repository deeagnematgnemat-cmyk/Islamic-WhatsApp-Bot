// ============ extras.js : إضافات جديدة ============
// الحماية: حظر السبام (تكرار نفس الرسالة 3 مرات) + سبام الملصقات (3 ملصقات متتالية) + الكلمات المحظورة (.حظر / .ازل_حظر / .قائمة_الكلمات_المحظورة)
// الترفيه: .صدق_او_كذب • .حروف • .حساب_سريع
// الإسلامي: .اية_اليوم • .تسبيح • .ختمتي
// الضحك: .ميم • .اعترف
// المجموعات: .تقرير_اسبوعي (للمشرفين)   |   المطور: .احصائيات
import fs from 'fs';
import os from 'os';
import { sendImageWithQuickReply } from './menu.js';

const FOOT = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
const box = (icon, title, body) => `╭━━━〔 ${icon} 〕━━━╮\n『 ${title} 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n${body}\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n${FOOT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (jid) => '@' + String(jid || '').split('@')[0].split(':')[0];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const toEnDigits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const stripMarks = (s) => String(s || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '');
// تطبيع النص العربي للمقارنة (همزات/تاء مربوطة/ياء/تشكيل/رموز)
export const normAr = (s) => toEnDigits(stripMarks(s)).toLowerCase()
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const ammanDay = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' });

function readJson(file, fallback) { try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); return d && typeof d === 'object' ? d : fallback; } catch (e) { return fallback; } }
function writeJson(file, data) { try { fs.writeFileSync(file, JSON.stringify(data)); } catch (e) { console.error('[extras] تعذر الحفظ:', file, e?.message || e); } }

// ================================================================ حماية السبام
// 1) نفس الرسالة النصية 3 مرات متتالية من نفس العضو
// 2) 3 ملصقات متتالية من نفس العضو دون أي رسالة أخرى منه بينها
// العدّ يتوقف (يبدأ من جديد) إذا مرّت أكثر من 10 دقائق بين الرسائل.
const SPAM_WINDOW = 10 * 60 * 1000;
const SPAM_LIMIT = 3;
const spamState = new Map();   // "group|sender" -> { text, count, at, stickers, sAt }
const NON_CONTENT = new Set(['reactionMessage', 'protocolMessage', 'senderKeyDistributionMessage', 'pollUpdateMessage', 'messageContextInfo']);

function unwrapMsg(m) {
    for (let i = 0; i < 4 && m; i++) {
        const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message;
        if (!inner) break;
        m = inner;
    }
    return m;
}

// ترجع 'text' عند تكرار نفس الرسالة، 'sticker' عند تكرار الملصقات، وإلا null
export function checkSpam(groupId, sender, message, now = Date.now()) {
    const m = unwrapMsg(message);
    if (!m) return null;
    const keys = Object.keys(m).filter((k) => !NON_CONTENT.has(k));
    if (!keys.length) return null;                       // تفاعل/بروتوكول: ليست رسالة حقيقية فلا تؤثر على العدّ

    const key = `${groupId}|${sender}`;
    let st = spamState.get(key);
    if (!st) { st = { text: null, count: 0, at: 0, stickers: 0, sAt: 0 }; spamState.set(key, st); }
    if (spamState.size > 6000) {                         // تنظيف الذاكرة
        for (const [k, v] of spamState) { if (now - Math.max(v.at, v.sAt) > SPAM_WINDOW) spamState.delete(k); }
    }

    if (m.stickerMessage) {
        st.text = null; st.count = 0;                    // الملصق يفصل بين الرسائل النصية
        st.stickers = (now - st.sAt <= SPAM_WINDOW ? st.stickers : 0) + 1;
        st.sAt = now;
        return st.stickers >= SPAM_LIMIT ? 'sticker' : null;
    }

    st.stickers = 0;                                     // أي رسالة غير ملصق تقطع تسلسل الملصقات
    const raw = m.conversation ?? m.extendedTextMessage?.text ?? '';
    const norm = String(raw).trim().replace(/\s+/g, ' ').toLowerCase();
    if (!norm || norm.startsWith('.')) { st.text = null; st.count = 0; return null; }   // وسائط أو أوامر البوت: لا تُعدّ سبام
    if (st.text === norm && now - st.at <= SPAM_WINDOW) st.count++;
    else { st.text = norm; st.count = 1; }
    st.at = now;
    return st.count >= SPAM_LIMIT ? 'text' : null;
}
export const _resetSpam = () => spamState.clear();

// ================================================================ الكلمات المحظورة
const BW_FILE = './banned_words.json';
let banned = readJson(BW_FILE, {});
const saveBanned = () => writeJson(BW_FILE, banned);
const PREFIXES = ['', 'ال', 'و', 'وال', 'ب', 'بال', 'ل', 'لل', 'ك', 'كال', 'ف', 'فال'];
const BW_MAX = 100;

// ترجع الكلمة المحظورة الموجودة في النص (كلمة كاملة، مع قبول سوابق مثل ال/و/ب/ل) أو null
export function findBannedWord(groupId, text) {
    const list = banned[groupId];
    if (!list || !list.length || !text) return null;
    const t = ' ' + normAr(text) + ' ';
    for (const w of list) {
        const nw = normAr(w);
        if (!nw) continue;
        if (nw.includes(' ')) { if (t.includes(' ' + nw + ' ')) return w; continue; }
        for (const p of PREFIXES) { if (t.includes(' ' + p + nw + ' ')) return w; }
    }
    return null;
}
export function addBannedWord(groupId, word) {
    const w = String(word || '').trim().replace(/\s+/g, ' ');
    if (!normAr(w)) return 'invalid';
    if (w.length > 40) return 'long';
    const list = banned[groupId] || (banned[groupId] = []);
    if (list.some((x) => normAr(x) === normAr(w))) return 'exists';
    if (list.length >= BW_MAX) return 'full';
    list.push(w); saveBanned();
    return 'ok';
}
export function removeBannedWord(groupId, word) {
    const list = banned[groupId] || [];
    const i = list.findIndex((x) => normAr(x) === normAr(word));
    if (i < 0) return false;
    list.splice(i, 1);
    if (!list.length) delete banned[groupId];
    saveBanned();
    return true;
}
export const listBannedWords = (groupId) => [...(banned[groupId] || [])];
export const _setBannedForTest = (obj) => { banned = obj; };

// ================================================================ التخزين الخفيف (ذاكرة + حفظ دوري)
function makeStore(file) {
    const state = { data: readJson(file, {}), dirty: false };
    const t = setInterval(() => { if (state.dirty) { state.dirty = false; writeJson(file, state.data); } }, 15000);
    if (t.unref) t.unref();
    return { get data() { return state.data; }, touch() { state.dirty = true; }, flush() { state.dirty = false; writeJson(file, state.data); } };
}

// ================================================================ الألعاب: صدق_او_كذب • حروف • حساب_سريع
const games = new Map();           // groupId -> لعبة نشطة من هذه الإضافة
const GAME_POINTS = 10;
const addPoints = async (bank, jid, n) => { try { if (bank) await bank.add(jid, n); } catch (e) {} };
const say = (ctx, content) => (ctx.sendBotMessage ? ctx.sendBotMessage(ctx.sock, ctx.from, content) : ctx.sock.sendMessage(ctx.from, content));

const TF_ITEMS = [
    ['الشمس هي أقرب نجم إلى كوكب الأرض.', true],
    ['عدد أركان الإسلام ستة أركان.', false],
    ['الحوت الأزرق هو أكبر حيوان على وجه الأرض.', true],
    ['سورة البقرة هي أطول سورة في القرآن الكريم.', true],
    ['عاصمة أستراليا هي مدينة سيدني.', false],
    ['يحتوي جسم الإنسان البالغ على 206 عظام.', true],
    ['الذهب أخف وزناً من الحديد.', false],
    ['الماء يغلي عند 100 درجة مئوية عند مستوى سطح البحر.', true],
    ['عدد كواكب المجموعة الشمسية ثمانية كواكب.', true],
    ['وقعت غزوة بدر في شهر رمضان.', true],
    ['الكعبة المشرفة تقع في المدينة المنورة.', false],
    ['عدد سور القرآن الكريم 114 سورة.', true],
    ['السنة الهجرية القمرية أطول من السنة الميلادية.', false],
    ['يمتلك الأخطبوط ثلاثة قلوب.', true],
    ['سرعة الضوء أكبر من سرعة الصوت.', true],
    ['تقع اليابان في قارة أفريقيا.', false],
    ['العنكبوت من الحشرات.', false],
    ['المحيط الأطلسي هو أكبر محيطات العالم.', false],
    ['الزرافة هي أطول حيوان بري في العالم.', true],
    ['تقع مدينة إسطنبول في قارتين: آسيا وأوروبا.', true],
    ['الدلفين من فصيلة الأسماك.', false],
    ['عاصمة الأردن هي عمّان.', true],
    ['يضم الأسبوع ثمانية أيام.', false],
    ['نرى البرق قبل أن نسمع صوت الرعد.', true],
    ['الفراشة تتذوق الطعام بأرجلها.', true],
    ['المريخ هو أصغر كوكب في المجموعة الشمسية.', false],
    ['عدد حروف اللغة العربية 28 حرفاً.', true],
    ['يعيش الدب القطبي في القطب الجنوبي.', false],
    ['الرمز الكيميائي للذهب هو Au.', true],
    ['روسيا هي أكبر دولة في العالم من حيث المساحة.', true],
    ['يوجد 29 يوماً في شهر فبراير في السنة الكبيسة.', true],
    ['الألماس مصنوع من عنصر الكربون.', true],
    ['ينتقل الصوت في الفراغ.', false],
    ['يقع برج إيفل في مدينة روما.', false],
    ['المسجد الأقصى هو أولى القبلتين.', true],
    ['نزل القرآن الكريم لأول مرة في شهر رمضان.', true],
    ['سيدنا يونس عليه السلام هو من ابتلعه الحوت.', true],
    ['القمر يضيء بنوره الخاص.', false],
    ['تحتوي خلية النحل عادةً على ملكة واحدة.', true],
    ['تقع الصين في قارة أوروبا.', false]
];
const recentTf = new Map();

const HANG_WORDS = [
    ['تفاح', 'فاكهة'], ['برتقال', 'فاكهة'], ['موز', 'فاكهة'], ['عنب', 'فاكهة'], ['فراولة', 'فاكهة'], ['رمان', 'فاكهة'], ['بطيخ', 'فاكهة'], ['مانجو', 'فاكهة'], ['خوخ', 'فاكهة'], ['ليمون', 'فاكهة'],
    ['أسد', 'حيوان'], ['نمر', 'حيوان'], ['فيل', 'حيوان'], ['زرافة', 'حيوان'], ['ذئب', 'حيوان'], ['ثعلب', 'حيوان'], ['حصان', 'حيوان'], ['جمل', 'حيوان'], ['دلفين', 'حيوان'], ['سلحفاة', 'حيوان'], ['ببغاء', 'حيوان'], ['عقرب', 'حيوان'],
    ['الأردن', 'دولة'], ['فلسطين', 'دولة'], ['مصر', 'دولة'], ['السعودية', 'دولة'], ['الكويت', 'دولة'], ['قطر', 'دولة'], ['تركيا', 'دولة'], ['اليابان', 'دولة'], ['المغرب', 'دولة'], ['العراق', 'دولة'], ['لبنان', 'دولة'],
    ['دمشق', 'مدينة'], ['بغداد', 'مدينة'], ['القاهرة', 'مدينة'], ['الرياض', 'مدينة'], ['دبي', 'مدينة'], ['مكة', 'مدينة'], ['الدوحة', 'مدينة'], ['بيروت', 'مدينة'], ['تونس', 'مدينة'],
    ['مفتاح', 'شيء'], ['كتاب', 'شيء'], ['هاتف', 'شيء'], ['ساعة', 'شيء'], ['مدرسة', 'مكان'], ['سيارة', 'مركبة'], ['طائرة', 'مركبة'], ['حاسوب', 'شيء'], ['كرسي', 'شيء'], ['نافذة', 'شيء'],
    ['طبيب', 'مهنة'], ['معلم', 'مهنة'], ['مهندس', 'مهنة'], ['طيار', 'مهنة'], ['نجار', 'مهنة']
];
const HANG_MAX_MISS = 6;
const hangLetter = (ch) => ch.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
const isArLetter = (ch) => /^[\u0621-\u064A]$/.test(ch);

function hangBoard(g) {
    const board = g.letters.map((l) => (g.shown.has(l.n) ? l.ch : '＿')).join(' ');
    const wrong = [...g.wrong].join(' ') || '—';
    return `«🏷️ ⌯ الفئة ↞ ${g.cat}\n🔤 ⌯ الكلمة ↞ ${board}\n❌ ⌯ الأخطاء ↞ ${wrong} (${g.wrong.size}/${HANG_MAX_MISS})»`;
}

function makeEquation() {
    const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const a = r(2, 20), b = r(2, 12), c = r(1, 30);
    const kind = r(0, 3);
    if (kind === 0) return { q: `${a} + ${b} × ${c}`, a: a + b * c };
    if (kind === 1) return { q: `${a} × ${b} - ${c}`, a: a * b - c };
    if (kind === 2) return { q: `(${a} + ${b}) × ${c}`, a: (a + b) * c };
    return { q: `${a} × ${b} + ${c}`, a: a * b + c };
}

async function endGame(ctx, from, why) {
    const g = games.get(from);
    if (!g || g.done) return;
    g.done = true; clearTimeout(g.timer); games.delete(from);
    try {
        if (g.type === 'tf') {
            const winners = [...g.answers].filter(([, v]) => v === g.answer).map(([j]) => j);
            for (const j of winners) await addPoints(ctx.bank, j, GAME_POINTS);
            const body = `«✅ ⌯ الإجابة الصحيحة ↞ *${g.answer ? 'صدق' : 'كذب'}*\n👥 ⌯ عدد المشاركين ↞ ${g.answers.size}\n🏆 ⌯ أجابوا صح ↞ ${winners.length}»` +
                (winners.length ? `\n\n🎁 +${GAME_POINTS} نقاط لكل من أجاب صح:\n${winners.map((j) => '> 🏅 ' + tag(j)).join('\n')}` : '\n\n😅 لم يُجب أحد إجابة صحيحة!');
            await say(ctx, { text: box('🎯', 'نَـتِـيـجَـةُ صِـدْقٍ أَمْ كَـذِبٍ', body), mentions: winners });
        } else if (g.type === 'math') {
            await say(ctx, { text: box('⏰', 'انْـتَـهَـى الـوَقْـتُ', `«🧮 ⌯ المسألة ↞ ${g.q}\n✅ ⌯ الناتج الصحيح ↞ *${g.answer}*»\n\n😅 لم يحلّها أحد في الوقت المحدد!`) });
        } else if (g.type === 'hang') {
            await say(ctx, { text: box('🔤', why === 'lose' ? 'خَـسِـرْتُـمُ الـجَـوْلَـةَ' : 'انْـتَـهَـى الـوَقْـتُ', `«🏷️ ⌯ الفئة ↞ ${g.cat}\n✅ ⌯ الكلمة كانت ↞ *${g.word}*»\n\n${why === 'lose' ? '💔 انتهت المحاولات الخاطئة!' : '⏳ انتهى الوقت المحدد!'}`) });
        }
    } catch (e) { console.error('[extras] خطأ إنهاء اللعبة:', e?.message || e); }
}

async function startGame(ctx, type) {
    const { from } = ctx;
    if (games.has(from) || (ctx.hasActiveGame && ctx.hasActiveGame())) {
        return say(ctx, { text: '🎮 توجد فعالية شغالة حالياً في المجموعة، انتظروا انتهاءها أولاً.' });
    }
    if (type === 'tf') {
        const used = recentTf.get(from) || [];
        let i, tries = 0;
        do { i = Math.floor(Math.random() * TF_ITEMS.length); tries++; } while (used.includes(i) && tries < 30);
        recentTf.set(from, [...used.slice(-12), i]);
        const [q, a] = TF_ITEMS[i];
        const g = { type: 'tf', answer: a, answers: new Map(), done: false };
        games.set(from, g);
        await say(ctx, { text: box('🎯', 'صِـدْقٌ أَمْ كَـذِبٌ', `«❓ ⌯ العبارة ↞ ${q}\n⏳ ⌯ المهلة ↞ 20 ثانية\n🎁 ⌯ الجائزة ↞ +${GAME_POINTS} نقاط لكل إجابة صحيحة»\n\n✍️ أجب بكلمة: *صدق* أو *كذب*`) });
        g.timer = setTimeout(() => endGame(ctx, from, 'time'), 20000);
        return;
    }
    if (type === 'math') {
        const eq = makeEquation();
        const g = { type: 'math', q: eq.q, answer: eq.a, done: false };
        games.set(from, g);
        await say(ctx, { text: box('🧮', 'حِـسَـابٌ سَـرِيـعٌ', `«🧮 ⌯ المسألة ↞ ${eq.q} = ؟\n⏳ ⌯ المهلة ↞ 30 ثانية\n🎁 ⌯ الجائزة ↞ +${GAME_POINTS} نقاط لأول إجابة صحيحة»\n\n✍️ اكتب الناتج رقماً فقط`) });
        g.timer = setTimeout(() => endGame(ctx, from, 'time'), 30000);
        return;
    }
    if (type === 'hang') {
        const [word, cat] = pick(HANG_WORDS);
        const letters = [...word].filter(isArLetter).map((ch) => ({ ch, n: hangLetter(ch) }));
        const g = { type: 'hang', word, cat, letters, shown: new Set(), wrong: new Set(), done: false };
        games.set(from, g);
        await say(ctx, { text: box('🔤', 'لُـعْـبَـةُ الـحُـرُوفِ', `${hangBoard(g)}\n\n✍️ أرسل حرفاً واحداً لتخمينه، أو اكتب الكلمة كاملة للفوز.\n⏳ المهلة: 3 دقائق • 🎁 +${GAME_POINTS} نقاط للفائز`) });
        g.timer = setTimeout(() => endGame(ctx, from, 'time'), 3 * 60 * 1000);
    }
}

// يُستدعى لكل رسالة نصية غير أمر داخل المجموعة؛ يرجع true إذا استهلك الرسالة كإجابة
export async function handleExtrasAnswer(ctx) {
    const { from, sender, trimmedBody } = ctx;
    const g = games.get(from);
    if (!g || g.done || !trimmedBody || trimmedBody.startsWith('.')) return false;

    if (g.type === 'tf') {
        const n = normAr(trimmedBody);
        let val;
        if (['صدق', 'صح', 'صحيح'].includes(n)) val = true;
        else if (['كذب', 'خطا', 'غلط'].includes(n)) val = false;
        else return false;
        if (!g.answers.has(sender)) g.answers.set(sender, val);
        return true;
    }

    if (g.type === 'math') {
        const n = toEnDigits(trimmedBody).trim();
        if (!/^-?\d{1,9}$/.test(n)) return false;
        if (Number(n) !== g.answer) return false;
        g.done = true; clearTimeout(g.timer); games.delete(from);
        await addPoints(ctx.bank, sender, GAME_POINTS);
        await say(ctx, { text: box('🏆', 'إِجَـابَـةٌ صَـحِـيـحَـةٌ', `«🧮 ⌯ المسألة ↞ ${g.q} = *${g.answer}*\n👤 ⌯ الفائز ↞ ${tag(sender)}\n🎁 ⌯ الجائزة ↞ +${GAME_POINTS} نقاط»`), mentions: [sender] });
        return true;
    }

    if (g.type === 'hang') {
        const t = trimmedBody.trim();
        // كلمة كاملة
        if (t.length >= 2) {
            if (normAr(t).replace(/\s/g, '') !== normAr(g.word).replace(/\s/g, '')) return false;
            g.done = true; clearTimeout(g.timer); games.delete(from);
            await addPoints(ctx.bank, sender, GAME_POINTS);
            await say(ctx, { text: box('🏆', 'فَـائِـزٌ بِـالـكَـلِـمَـةِ', `«✅ ⌯ الكلمة ↞ *${g.word}*\n🏷️ ⌯ الفئة ↞ ${g.cat}\n👤 ⌯ الفائز ↞ ${tag(sender)}\n🎁 ⌯ الجائزة ↞ +${GAME_POINTS} نقاط»`), mentions: [sender] });
            return true;
        }
        // حرف واحد
        if (!isArLetter(t)) return false;
        const n = hangLetter(t);
        if (g.shown.has(n) || g.wrong.has(t)) return true;       // مُخمَّن سابقاً: تجاهل بصمت
        if (g.letters.some((l) => l.n === n)) {
            g.shown.add(n);
            if (g.letters.every((l) => g.shown.has(l.n))) {
                g.done = true; clearTimeout(g.timer); games.delete(from);
                await addPoints(ctx.bank, sender, GAME_POINTS);
                await say(ctx, { text: box('🏆', 'اكْـتَـمَـلَـتِ الـكَـلِـمَـةُ', `«✅ ⌯ الكلمة ↞ *${g.word}*\n🏷️ ⌯ الفئة ↞ ${g.cat}\n👤 ⌯ أكمل الكلمة ↞ ${tag(sender)}\n🎁 ⌯ الجائزة ↞ +${GAME_POINTS} نقاط»`), mentions: [sender] });
                return true;
            }
            await say(ctx, { text: `✅ حرف صحيح!\n\n${hangBoard(g)}` });
            return true;
        }
        g.wrong.add(t);
        if (g.wrong.size >= HANG_MAX_MISS) { await endGame(ctx, from, 'lose'); return true; }
        await say(ctx, { text: `❌ الحرف غير موجود!\n\n${hangBoard(g)}` });
        return true;
    }
    return false;
}
export const _gamesForTest = games;

// ================================================================ الإسلامي: اية_اليوم • تسبيح • ختمتي
const AYAH_REFS = ['2:255', '2:286', '2:152', '2:153', '2:186', '3:139', '3:159', '4:28', '5:2', '9:51', '12:86', '13:11', '13:28', '14:7', '16:97', '16:128',
    '20:114', '21:87', '29:69', '39:10', '39:53', '40:60', '41:34', '49:13', '51:56', '55:13', '65:3', '94:5', '94:6'];
let ayahCache = { day: '', data: null };
const dayNumber = () => { const [y, m, d] = ammanDay().split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };

async function getJson(url, timeout = 15000) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}
async function fetchAyah(ref) {
    try {
        const j = await getJson(`https://api.alquran.cloud/v1/ayah/${ref}/editions/quran-uthmani,ar.muyassar`);
        const [a, t] = j.data;
        return { text: a.text, surah: a.surah.name, num: a.numberInSurah, tafsir: t?.text || '' };
    } catch (e) {
        const [s, v] = ref.split(':').map(Number);          // بديل: النص فقط بدون تفسير
        const j = await getJson(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf/${s}.json`, 20000);
        const verse = (j.chapter || []).find((x) => x.verse === v);
        if (!verse) throw new Error('AYAH_NOT_FOUND');
        return { text: verse.text, surah: 'سورة رقم ' + s, num: v, tafsir: '' };
    }
}
async function cmdAyahOfDay(ctx) {
    const day = ammanDay();
    if (ayahCache.day !== day || !ayahCache.data) {
        ayahCache = { day, data: await fetchAyah(AYAH_REFS[dayNumber() % AYAH_REFS.length]) };
    }
    const d = ayahCache.data;
    const tafsir = d.tafsir ? `\n\n📝 *التفسير الميسر:*\n${d.tafsir.slice(0, 700)}${d.tafsir.length > 700 ? '…' : ''}` : '';
    return say(ctx, { text: box('🌟', 'آيَـةُ الـيَـوْمِ', `﴿ ${d.text} ﴾\n\n📖 ${d.surah} • الآية ${d.num}${tafsir}`) });
}

// ---- التسبيح
const tasbeehStore = makeStore('./tasbeeh.json');
const tasbeehCool = new Map();
const DHIKR = [[33, 'سُبْحَانَ اللَّهِ'], [66, 'الْحَمْدُ لِلَّهِ'], [99, 'اللَّهُ أَكْبَرُ'], [100, 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ']];
const dhikrAt = (n) => DHIKR.find(([max]) => n <= max)[1];
const bar = (p, len = 10) => { const f = Math.max(0, Math.min(len, Math.round(p * len))); return '▰'.repeat(f) + '▱'.repeat(len - f); };

export function tasbeehStep(rec, k = 1) {       // يزيد العدّاد؛ الجولة = 100. يرجع عدد الجولات التي اكتملت الآن
    rec.n = (rec.n || 0) + k; rec.total = (rec.total || 0) + k;
    const done = Math.floor(rec.n / 100);
    rec.n = rec.n % 100;
    rec.rounds = (rec.rounds || 0) + done;
    return done;
}
async function cmdTasbeeh(ctx, args) {
    const { sender, from, sock } = ctx;
    const store = tasbeehStore.data;
    const a = normAr(args);
    if (a === 'صفر' || a === 'تصفير') {
        store[sender] = { n: 0, total: 0, rounds: 0 }; tasbeehStore.touch();
        return say(ctx, { text: '🔄 تم تصفير عدّاد التسبيح الخاص بك.' });
    }
    if (Date.now() - (tasbeehCool.get(sender) || 0) < 1000) return;
    tasbeehCool.set(sender, Date.now());
    const rec = store[sender] || (store[sender] = { n: 0, total: 0, rounds: 0 });
    const k = /^\d{1,3}$/.test(a) ? Math.min(100, Math.max(1, Number(a))) : 1;
    const done = tasbeehStep(rec, k);
    tasbeehStore.touch();
    const roundDone = done > 0;
    const shown = rec.n === 0 ? (roundDone ? 100 : 0) : rec.n;
    const body = `«📿 ⌯ الذكر ↞ ${dhikrAt(shown || 1)}\n🔢 ⌯ العدّاد ↞ ${shown}/100\n${bar(shown / 100)}\n🔁 ⌯ الجولات المكتملة ↞ ${rec.rounds || 0}\n📊 ⌯ إجمالي تسبيحاتك ↞ ${rec.total}»` +
        (roundDone ? '\n\n🎉 ما شاء الله! أتممت جولة كاملة من 100 تسبيحة.' : '');
    const caption = `${box('📿', 'الـمِـسْـبَـحَـةُ', body)}\n\n${tag(sender)}`;
    let ok = false;
    try { ok = await sendImageWithQuickReply(sock, from, null, caption, '📿 سَبِّح', '.تسبيح', [sender]); } catch (e) { ok = false; }
    if (!ok) await say(ctx, { text: caption + '\n\n💡 اكتب .تسبيح للمتابعة', mentions: [sender] });
}

// ---- الختمة
const khatmaStore = makeStore('./khatma.json');
const MUSHAF_PAGES = 604;
const juzOf = (p) => Math.min(30, Math.max(1, p <= 21 ? 1 : Math.floor((p - 2) / 20) + 1));
async function cmdKhatma(ctx, args) {
    const { sender } = ctx;
    const store = khatmaStore.data;
    const rec = store[sender] || (store[sender] = { page: 0, khatmat: 0, start: Date.now() });
    const a = normAr(args);
    let note = '';
    let m;
    if (/^(صفر|ابدا|جديده|تصفير|reset)$/.test(a)) { rec.page = 0; rec.start = Date.now(); note = '🔄 تم بدء ختمة جديدة من الصفحة 1.'; }
    else if ((m = /^(?:قرات\s*)?(\d{1,3})(?:\s*صفحه|\s*صفحات)?$/.exec(a))) { rec.page += Math.min(MUSHAF_PAGES, Number(m[1])); note = `✅ تمت إضافة ${Number(m[1])} صفحة.`; }
    else if ((m = /^صفحه\s*(\d{1,3})$/.exec(a))) { rec.page = Math.min(MUSHAF_PAGES, Number(m[1])); note = `📍 تم ضبط موضعك عند الصفحة ${rec.page}.`; }
    else if (a) {
        return say(ctx, { text: box('📖', 'خَـتْـمَـتِـي', `📌 *الاستخدام:*\n> 📖 .ختمتي ↞ عرض تقدّمك\n> ➕ .ختمتي قرأت 5 ↞ إضافة صفحات\n> 📍 .ختمتي صفحة 120 ↞ تحديد الصفحة الحالية\n> 🔄 .ختمتي صفر ↞ بدء ختمة جديدة`) });
    }
    let finished = false;
    if (rec.page >= MUSHAF_PAGES) { rec.khatmat = (rec.khatmat || 0) + 1; rec.page = 0; rec.start = Date.now(); finished = true; }
    khatmaStore.touch();
    const remaining = MUSHAF_PAGES - rec.page;
    const days = Math.max(1, Math.ceil((Date.now() - rec.start) / 86400000));
    const body = finished
        ? `🎉 *ما شاء الله، ختمت القرآن الكريم!*\n🏅 عدد ختماتك ↞ ${rec.khatmat}\n\n🤲 تقبّل الله منك، وبدأت ختمة جديدة تلقائياً.`
        : `«📍 ⌯ الصفحة ↞ ${rec.page}/${MUSHAF_PAGES}\n📊 ⌯ التقدم ↞ ${Math.round((rec.page / MUSHAF_PAGES) * 100)}%\n${bar(rec.page / MUSHAF_PAGES, 15)}\n📚 ⌯ الجزء تقريباً ↞ ${rec.page ? juzOf(rec.page) : 0}/30\n📄 ⌯ المتبقي ↞ ${remaining} صفحة\n🎯 ⌯ لإنهائها خلال 30 يوماً ↞ ${Math.ceil(remaining / 30)} صفحة يومياً\n⏱️ ⌯ مدة الختمة الحالية ↞ ${days} يوم\n🏅 ⌯ ختماتك ↞ ${rec.khatmat || 0}»`;
    return say(ctx, { text: box('📖', 'خَـتْـمَـتِـي', (note ? note + '\n\n' : '') + body + `\n\n👤 ${tag(sender)}`), mentions: [sender] });
}

// ================================================================ الضحك: ميم • اعترف
const MEME_SUBS = ['ArabicMemes', 'memes', 'wholesomememes'];
async function fetchMeme() {
    for (const sub of MEME_SUBS) {
        for (let i = 0; i < 2; i++) {
            try {
                const j = await getJson(`https://meme-api.com/gimme/${sub}`, 12000);
                if (!j || j.nsfw || j.spoiler || !/\.(jpe?g|png|webp)(\?|$)/i.test(String(j.url || ''))) continue;
                const res = await fetch(j.url, { signal: AbortSignal.timeout(20000) });
                if (!res.ok) continue;
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length > 8 * 1024 * 1024 || buf.length < 1000) continue;
                return { buf, title: String(j.title || '').slice(0, 120) };
            } catch (e) {}
        }
    }
    return null;
}
async function cmdMeme(ctx) {
    const m = await fetchMeme();
    if (!m) return say(ctx, { text: '❌ تعذر جلب ميم الآن، حاول بعد قليل.' });
    await ctx.sock.sendMessage(ctx.from, { image: m.buf, caption: `😂 *ميم عشوائي*${m.title ? `\n\n${m.title}` : ''}\n\n${FOOT}` }, { quoted: ctx.msg });
}

const CONFESS = [
    'شو أكثر موقف محرج صار معك قدام الناس؟', 'آخر مرة كذبت فيها على مين وليش؟', 'مين أكثر شخص بتحبه وما قلتله؟', 'شو أغرب شي أكلته بحياتك؟',
    'شو أكثر عادة سيئة عندك؟', 'لو انكشف سجل بحثك على الإنترنت، شو أكثر شي بتحرج منه؟', 'آخر مرة بكيت فيها كانت ليش؟', 'شو أكثر رسالة ندمت إنك أرسلتها؟',
    'مين آخر شخص كتمته أو حظرته وليش؟', 'شو أسوأ هدية أخذتها وكيف كان ردة فعلك؟', 'شو أكثر مسلسل أو أنمي بتخجل تعترف إنك بتحبه؟',
    'مرة تأخرت على موعد وقلت عذر كاذب، شو كان العذر؟', 'شو أكثر شي بتخاف منه وما حدا بيعرف؟', 'شو أكثر لقب كرهته ناداك فيه أحد؟',
    'مين أكثر عضو بالمجموعة بتحس إنه بيشبهك؟', 'كم ساعة بتقضي على الجوال يومياً؟ (الصراحة!)', 'شو آخر شي اشتريته وندمت عليه؟',
    'مرة نسيت اسم شخص قدامه؟ كيف تصرفت؟', 'شو أكثر أغنية بتسمعها بالسر وبتخجل منها؟', 'مرة ضحكت بوقت غلط؟ وين وكيف؟',
    'شو أكثر قرار غلط أخذته وبتتمنى ترجع فيه؟', 'مين أكثر شخص بتتجنب ترد على مكالمته؟', 'شو أكثر كذبة صغيرة بتكررها دايماً؟',
    'مرة نمت بمكان غلط (دوام/مدرسة/مجلس)؟ وين؟', 'شو أول شي بتفتحه على جوالك الصبح؟', 'كم مرة بتعيد قراءة الرسالة قبل ما ترسلها؟',
    'لو بتقدر تمسح رسالة وحدة من المجموعة، أي وحدة بتمسح؟', 'شو أكثر شي بتتظاهر إنك بتحبه وإنت ما بتحبه؟', 'شو أكثر أكلة مصيبة طبختها؟',
    'مين آخر شخص تخانقت معه وليش؟', 'شو أكثر مهارة بتتمنى تتعلمها بس بتكسل؟'
];
async function cmdConfess(ctx) {
    const { msg, sock, from, sender } = ctx;
    const ci = msg.message?.extendedTextMessage?.contextInfo;
    let target = ci?.mentionedJid?.[0] || ci?.participant || null;
    if (!target) {
        try {
            const meta = await sock.groupMetadata(from);
            const botD = String(sock.user?.id || '').split(':')[0].split('@')[0];
            const pool = (meta.participants || []).map((p) => p.id).filter((j) => j !== sender && !String(j).startsWith(botD));
            target = pool.length ? pick(pool) : sender;
        } catch (e) { target = sender; }
    }
    return say(ctx, { text: box('🤫', 'كُـرْسِـيُّ الاعْـتِـرَافِ', `«🎯 ⌯ المستهدف ↞ ${tag(target)}\n🙋 ⌯ بطلب من ↞ ${tag(sender)}»\n\n❓ *${pick(CONFESS)}*\n\n⏳ بانتظار اعترافك بكل صراحة!`), mentions: [target, sender] });
}

// ================================================================ تقرير المجموعة الأسبوعي (للمشرفين)
export function buildWeeklyStats(counts, groupId, botDigits = '') {
    const days = []; const perUser = {}; let total = 0;
    for (let i = 6; i >= 0; i--) {
        const key = ammanDay(i); const d = (counts[groupId] || {})[key] || {};
        let sum = 0;
        for (const [j, n] of Object.entries(d)) {
            if (botDigits && String(j).startsWith(botDigits)) continue;
            sum += n; perUser[j] = (perUser[j] || 0) + n;
        }
        days.push({ key, sum }); total += sum;
    }
    const top = Object.entries(perUser).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { days, total, active: Object.keys(perUser).length, top };
}
async function cmdWeekly(ctx) {
    const { sock, from } = ctx;
    const data = ctx.getData();
    const botD = String(sock.user?.id || '').split(':')[0].split('@')[0];
    const s = buildWeeklyStats(data.userMessagesCount || {}, from, botD);
    let name = '';
    try { name = (await sock.groupMetadata(from)).subject; } catch (e) {}
    if (!s.total) return say(ctx, { text: '📊 لا توجد رسائل مسجّلة لهذه المجموعة خلال آخر 7 أيام.' });
    const busiest = s.days.reduce((a, b) => (b.sum > a.sum ? b : a));
    const quiet = s.days.reduce((a, b) => (b.sum < a.sum ? b : a));
    const max = Math.max(1, ...s.days.map((d) => d.sum));
    const wd = (k) => new Date(k + 'T12:00:00+03:00').toLocaleDateString('ar', { weekday: 'long', timeZone: 'Asia/Amman' });
    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
    const body = `«${name ? `👥 ⌯ المجموعة ↞ ${name}\n` : ''}📅 ⌯ الفترة ↞ ${s.days[0].key} → ${s.days[6].key}\n💬 ⌯ إجمالي الرسائل ↞ ${s.total}\n👤 ⌯ الأعضاء المتفاعلون ↞ ${s.active}\n📈 ⌯ المتوسط اليومي ↞ ${Math.round(s.total / 7)}\n🔥 ⌯ أنشط يوم ↞ ${wd(busiest.key)} (${busiest.sum})\n💤 ⌯ أهدأ يوم ↞ ${wd(quiet.key)} (${quiet.sum})»\n\n🏆 *أكثر المتفاعلين:*\n` +
        s.top.map(([j, n], i) => `> ${medals[i]} ${tag(j)} ↞ ${n} رسالة`).join('\n') +
        `\n\n📅 *نشاط الأيام:*\n` + s.days.map((d) => `> ${bar(d.sum / max, 8)} ${wd(d.key)} ↞ ${d.sum}`).join('\n') +
        `\n\nℹ️ الأرقام محسوبة من الرسائل التي سجّلها البوت.`;
    return say(ctx, { text: box('📊', 'الـتَّـقْـرِيـرُ الأُسْـبُـوعِـيُّ', body), mentions: s.top.map(([j]) => j) });
}

// ================================================================ إحصائيات البوت (للمطور)
const fmtUptime = (sec) => { const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60); return `${d ? d + ' يوم ' : ''}${h} ساعة ${m} دقيقة`; };
async function cmdStats(ctx) {
    const { sock } = ctx;
    const data = ctx.getData();
    let groups = 0, members = 0;
    try { const all = Object.values(await sock.groupFetchAllParticipating()); groups = all.length; members = all.reduce((s, g) => s + (g.participants?.length || 0), 0); } catch (e) {}
    const today = ammanDay();
    let todayMsgs = 0, weekMsgs = 0;
    const weekKeys = Array.from({ length: 7 }, (_, i) => ammanDay(i));
    for (const g of Object.values(data.userMessagesCount || {})) {
        for (const k of weekKeys) { const d = g[k]; if (!d) continue; const s = Object.values(d).reduce((a, b) => a + b, 0); weekMsgs += s; if (k === today) todayMsgs += s; }
    }
    const points = Object.values(data.userPoints || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const mem = process.memoryUsage();
    const body = `«👥 ⌯ المجموعات ↞ ${groups}\n🧑‍🤝‍🧑 ⌯ إجمالي الأعضاء ↞ ${members}\n💬 ⌯ رسائل اليوم ↞ ${todayMsgs}\n📅 ⌯ رسائل آخر 7 أيام ↞ ${weekMsgs}\n🏦 ⌯ حسابات البنك ↞ ${Object.keys(data.bankAccounts || {}).length}\n💰 ⌯ مجموع النقاط ↞ ${points}\n⚠️ ⌯ أعضاء لديهم إنذارات ↞ ${Object.keys(data.userWarnings || {}).length}\n🤖 ⌯ البوتات المنصّبة ↞ ${ctx.subBotCount ? ctx.subBotCount() : 0}»\n\n🖥️ *النظام:*\n> ⏱️ مدة التشغيل ↞ ${fmtUptime(process.uptime())}\n> 🧠 الذاكرة ↞ ${(mem.rss / 1048576).toFixed(0)} MB\n> 🟢 Node ↞ ${process.version}\n> 💻 النظام ↞ ${os.platform()} ${os.arch()}`;
    return say(ctx, { text: box('📊', 'إِحْـصَـائِـيَّـاتُ الـبُـوتِ', body) });
}

// ================================================================ الأوامر والموزّع
export const extrasCommandNames = [
    'حظر_سبام', 'سماح_سبام', 'حظر_ملصقات', 'سماح_ملصقات', 'حظر', 'ازل_حظر', 'قائمة_الكلمات_المحظورة',
    'صدق_او_كذب', 'حروف', 'حساب_سريع', 'اية_اليوم', 'تسبيح', 'ختمتي', 'ميم', 'اعترف', 'تقرير_اسبوعي', 'احصائيات'
];
const EXTRAS = new Set(extrasCommandNames);
const SPACED_PROTECTION = new Set(['رابط', 'شتم', 'سب', 'جهات', 'توجيه']);   // صيغ الحماية القديمة: تبقى كما هي

const TOGGLES = {
    'حظر_سبام': ['antiSpam', true, '🚫', 'مَـانِـعِ الـسِّـبَـامِ', 'منع تكرار نفس الرسالة 3 مرات'],
    'سماح_سبام': ['antiSpam', false, '⚠️', 'مَـانِـعِ الـسِّـبَـامِ', 'تكرار الرسائل'],
    'حظر_ملصقات': ['antiStickerSpam', true, '🚫', 'مَـانِـعِ سِـبَـامِ الـمُـلْـصَـقَـاتِ', 'منع إرسال 3 ملصقات متتالية'],
    'سماح_ملصقات': ['antiStickerSpam', false, '⚠️', 'مَـانِـعِ سِـبَـامِ الـمُـلْـصَـقَـاتِ', 'الملصقات المتتالية']
};

export async function handleExtrasCommand(ctx) {
    const { cmdBase, trimmedBody, from, sender, isSenderAdmin, isSenderDev } = ctx;
    if (!EXTRAS.has(cmdBase)) return false;
    const isAdm = !!(isSenderAdmin || isSenderDev);
    const args = String(trimmedBody || '').replace(/^\.\S+\s*/, '').trim();
    const adminOnly = () => say(ctx, { text: '❌ متاح للمشرفين والمطور فقط!' });

    try {
        // ---- تفعيل/تعطيل حماية السبام والملصقات
        if (TOGGLES[cmdBase]) {
            if (!isAdm) { await adminOnly(); return true; }
            const [key, on, icon, title, what] = TOGGLES[cmdBase];
            ctx.getGroupSetting(from)[key] = on;
            await say(ctx, { text: box(icon, (on ? 'تَـفْـعِـيـلُ ' : 'تَـعْـطِـيـلُ ') + title, `«👑 ⌯ المسؤول ↞ ${tag(sender)}\n🛡️ ⌯ الخاصية ↞ ${what}\n${on ? '✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح' : '⛔ ⌯ الحالة ↞ تم تعطيل الحماية'}»`), mentions: [sender] });
            return true;
        }

        // ---- الكلمات المحظورة
        if (cmdBase === 'حظر') {
            if (SPACED_PROTECTION.has(normAr(args))) return false;
            if (!isAdm) { await adminOnly(); return true; }
            if (!args) { await say(ctx, { text: '📌 اكتب الكلمة بعد الأمر.\nمثال: `.حظر كلمة`\n\n🧾 للقائمة: `.قائمة_الكلمات_المحظورة`\n♻️ للإزالة: `.ازل_حظر كلمة`' }); return true; }
            const r = addBannedWord(from, args);
            const msgs = {
                ok: box('🚫', 'كَـلِـمَـةٌ مَـحْـظُـورَةٌ', `«🔤 ⌯ الكلمة ↞ *${args}*\n👑 ⌯ المسؤول ↞ ${tag(sender)}\n✅ ⌯ الحالة ↞ أي عضو (غير مشرف) يرسلها تُحذف رسالته ويأخذ إنذاراً»\n\n💡 يلزم أن يكون البوت مشرفاً في المجموعة.`),
                exists: '⚠️ هذه الكلمة محظورة مسبقاً.', invalid: '❌ اكتب كلمة صالحة.', long: '❌ الكلمة طويلة جداً (الحد 40 حرفاً).', full: '❌ وصلت للحد الأقصى (100 كلمة محظورة).'
            };
            await say(ctx, { text: msgs[r], mentions: [sender] });
            return true;
        }
        if (cmdBase === 'ازل_حظر') {
            if (!isAdm) { await adminOnly(); return true; }
            if (!args) { await say(ctx, { text: '📌 اكتب الكلمة المراد إزالتها.\nمثال: `.ازل_حظر كلمة`' }); return true; }
            const ok = removeBannedWord(from, args);
            await say(ctx, { text: ok ? box('✅', 'إِزَالَـةُ حَـظْـرِ كَـلِـمَـةٍ', `«🔤 ⌯ الكلمة ↞ *${args}*\n👑 ⌯ المسؤول ↞ ${tag(sender)}\n✅ ⌯ الحالة ↞ تم السماح بالكلمة»`) : '❌ هذه الكلمة ليست في قائمة المحظورات.', mentions: [sender] });
            return true;
        }
        if (cmdBase === 'قائمة_الكلمات_المحظورة') {
            if (!isAdm) { await adminOnly(); return true; }
            const list = listBannedWords(from);
            await say(ctx, { text: list.length
                ? box('🧾', 'الـكَـلِـمَـاتُ الـمَـحْـظُـورَةُ', `${list.map((w, i) => `> ${i + 1}. ${w}`).join('\n')}\n\n📊 العدد: ${list.length}\n♻️ للإزالة: .ازل_حظر <الكلمة>`)
                : '📌 لا توجد كلمات محظورة في هذه المجموعة.\nلإضافة كلمة: `.حظر كلمة`' });
            return true;
        }

        // ---- الترفيه
        if (cmdBase === 'صدق_او_كذب') { await startGame(ctx, 'tf'); return true; }
        if (cmdBase === 'حروف') { await startGame(ctx, 'hang'); return true; }
        if (cmdBase === 'حساب_سريع') { await startGame(ctx, 'math'); return true; }

        // ---- الإسلامي
        if (cmdBase === 'اية_اليوم') {
            try { await cmdAyahOfDay(ctx); } catch (e) { console.error('[اية_اليوم]', e?.message || e); await say(ctx, { text: '❌ تعذر جلب آية اليوم الآن، حاول بعد قليل.' }); }
            return true;
        }
        if (cmdBase === 'تسبيح') { await cmdTasbeeh(ctx, args); return true; }
        if (cmdBase === 'ختمتي') { await cmdKhatma(ctx, args); return true; }

        // ---- الضحك
        if (cmdBase === 'ميم') { await cmdMeme(ctx); return true; }
        if (cmdBase === 'اعترف') { await cmdConfess(ctx); return true; }

        // ---- المجموعات (مشرفون فقط)
        if (cmdBase === 'تقرير_اسبوعي') {
            if (!isAdm) { await adminOnly(); return true; }
            await cmdWeekly(ctx);
            return true;
        }

        // ---- المطور
        if (cmdBase === 'احصائيات') {
            if (!isSenderDev) { await say(ctx, { text: '❌ هذا الأمر للمطور فقط!' }); return true; }
            await cmdStats(ctx);
            return true;
        }
    } catch (e) {
        console.error(`[extras] خطأ في الأمر ${cmdBase}:`, e?.message || e);
        try { await say(ctx, { text: '❌ تعذر تنفيذ الأمر، حاول مرة أخرى.' }); } catch (e2) {}
    }
    return true;
}
