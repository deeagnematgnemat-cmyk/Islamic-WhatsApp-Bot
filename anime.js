// ============ anime.js : ألعاب وفعاليات الأنمي (مافيا، برا السالفة، مسابقات، صور...) ============
import { QUIZ, EMOJI_PUZZLES, CHARACTERS, BARA_WORDS } from './animeData.js';
import { sendImageWithQuickReply, sendSelectList } from './menu.js';
import { GUESS_ANIME, GUESS_CHARS, guessEval, guessIsAsk } from './guessData.js';

const SIG = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
const LINE = '❐═━━━═╊⊰🍷⊱╉═━━━═❐';
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const MAX_PLAYERS = 20;

// ---------------------------------------------------------------- الأسماء
const NAMES = [
    'مافيا', 'برا_السالفة', 'برا_السالفه', 'برا',
    'مسابقة', 'مسابقه', 'قنبلة', 'قنبله', 'مرر',
    'سلوت', 'قلب_عملة', 'قلب_عمله', 'قلب', 'نرد', 'عجلة', 'عجله',
    'حجر', 'ورقة', 'ورقه', 'مقص',
    'اكس_او', 'xo', 'خمن_ايموجي', 'خمن_الايموجي',
    'خمن_الشخصية', 'خمن_الشخصيه', 'معرفة_الشخصية', 'معرفه_الشخصيه', 'عين',
    'سالفة', 'انضم', 'ابدا', 'لاعبين', 'صوت', 'قتل', 'حماية', 'حمايه', 'فحص', 'دوري',
    'انهاء_اللعبة', 'انهاء_لعبة', 'انهاء_اللعبه',
    'احزر'
];
export const animeCommandNames = NAMES;
const PRIVATE_NAMES = new Set(['قتل', 'حماية', 'حمايه', 'فحص', 'دوري', 'حجر', 'ورقة', 'ورقه', 'مقص']);

// ---------------------------------------------------------------- أدوات عامة
const games = new Map();      // معرف المجموعة -> لعبة جارية (واحدة لكل مجموعة)
const duels = new Map();      // معرف المجموعة -> تحدي حجر ورقة مقص بين عضوين
const cooldowns = new Map();  // مفتاح -> وقت آخر استخدام

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const num = (j) => String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const tag = (j) => '@' + num(j);
const bt = (s) => '`' + s + '`';
const toEn = (s) => String(s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const norm = (s) => String(s || '').toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و')
    .replace(/[^\p{L}\p{N}]+/gu, '');

function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}
// مطابقة الإجابة مع الأسماء المقبولة (تتسامح مع اختلاف الهمزات والأخطاء الإملائية البسيطة)
function matches(text, answers, exact = false) {
    const n = norm(text);
    if (!n) return false;
    for (const a of answers) {
        const na = norm(a);
        if (!na) continue;
        if (n === na) return true;
        if (exact || /^\d+$/.test(na)) continue;
        if (na.length >= 4 && n.length <= na.length + 8 && n.includes(na)) return true;
        if (na.length >= 5 && n.length >= 4 && lev(n, na) <= (na.length >= 8 ? 2 : 1)) return true;
    }
    return false;
}

function box(emoji, title, lines, tip) {
    return `╭━━━〔 ${emoji} 〕━━━╮\n『 ${title} 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n${lines}\n\n${LINE}\n${tip ? bt(tip) + '\n\n' : ''}${SIG}`;
}
const kv = (e, k, v) => `${e} ⌯ ${k} ↞ ${v}`;

const say = (g, text, mentions) => g.sock.sendMessage(g.from, mentions ? { text, mentions } : { text }).catch(() => null);

function botNum(sock) { return num(sock?.user?.id); }
function idsOf(ctx) {
    const k = ctx.msg?.key || {};
    const s = new Set();
    for (const j of [ctx.sender, k.participant, k.participantAlt, k.remoteJidAlt, ctx.isGroup ? null : ctx.from]) { const n = num(j); if (n) s.add(n); }
    return s;
}
const hasId = (p, ids) => [...p.ids].some((x) => ids.has(x));
function mkPlayer(ctx) {
    const k = ctx.msg?.key || {};
    const pn = [k.participantAlt, ctx.sender].find((j) => String(j || '').endsWith('@s.whatsapp.net'));
    return { jid: ctx.sender, ids: idsOf(ctx), dm: pn || ctx.sender, alive: true, got: false, n: 0 };
}
// لقب اللاعب (يُعرض بدل المنشن في مافيا وبرا السالفة)
const nm = (p) => p.nick || tag(p.jid);
const parseNick = (ctx) => String(ctx.trimmedBody || '').replace(/^\S+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 20);
const nickTaken = (g, nick, except) => g.players.some((q) => q !== except && q.nick && norm(q.nick) === norm(nick));
function cooldown(key, ms) {
    const now = Date.now();
    const left = (cooldowns.get(key) || 0) + ms - now;
    if (left > 0) return Math.ceil(left / 1000);
    cooldowns.set(key, now);
    return 0;
}
function clearGame(g) {
    if (!g) return;
    clearTimeout(g.timer); clearTimeout(g.timer2); clearTimeout(g.timer3); clearTimeout(g.verifyTimer);
}
function endGame(g) { clearGame(g); if (games.get(g.from) === g) games.delete(g.from); }
const isHostOrAdmin = (ctx, g) => ctx.isSenderAdmin || ctx.isSenderDev || (g.hostIds && [...g.hostIds].some((x) => idsOf(ctx).has(x)));

// الانسحاب من أي فعالية أنمي جارية في المجموعة (لعبة أو تحدي حجر/ورقة/مقص): يرجع true إن أُلغيت فعالية
export function withdrawAnime(from) {
    let done = false;
    const g = games.get(from);
    if (g) { endGame(g); done = true; }
    const d = duels.get(from);
    if (d) { clearTimeout(d.timer); duels.delete(from); done = true; }
    return done;
}

// ---------------------------------------------------------------- جلب الصور (Pinterest ثم Bing ثم Jikan)
async function axiosLib() { return (await import('axios')).default; }
async function pinUrls(q) {
    const urls = [];
    try {
        const axios = await axiosLib();
        const data = JSON.stringify({ options: { isPrefetch: false, query: q, scope: 'pins', no_fetch_context_on_resource: false }, context: {} });
        const src = `/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;
        const r = await axios.get(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(src)}&data=${encodeURIComponent(data)}`, {
            timeout: 20000,
            headers: { 'User-Agent': UA, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-Source-Url': src, 'X-Pinterest-AppState': 'active' }
        });
        for (const it of (r.data?.resource_response?.data?.results || [])) {
            const u = it?.images?.orig?.url || it?.images?.['736x']?.url;
            if (u && !urls.includes(u)) urls.push(u);
        }
    } catch (e) { /* ننتقل للمصدر التالي */ }
    return urls;
}
async function bingUrls(q) {
    const urls = [];
    try {
        const axios = await axiosLib();
        const r = await axios.get(`https://www.bing.com/images/async?q=${encodeURIComponent(q)}&first=0&count=50&mmasync=1&adlt=strict&qft=${encodeURIComponent('+filterui:imagesize-large')}`, { timeout: 20000, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
        for (const m of String(r.data).matchAll(/murl&quot;:&quot;(https?:.+?)&quot;/g)) {
            const u = m[1].replace(/&amp;/g, '&');
            if (/\.(jpe?g|png|webp)(\?|$)/i.test(u) && !urls.includes(u)) urls.push(u);
        }
    } catch (e) { /* ننتقل للمصدر التالي */ }
    return urls;
}
async function jikanUrls(name) {
    const urls = [];
    try {
        const axios = await axiosLib();
        const s = await axios.get(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=1`, { timeout: 15000 });
        const id = s.data?.data?.[0]?.mal_id;
        if (id) {
            const p = await axios.get(`https://api.jikan.moe/v4/characters/${id}/pictures`, { timeout: 15000 });
            for (const it of (p.data?.data || [])) { const u = it?.jpg?.image_url; if (u) urls.push(u); }
        }
    } catch (e) { /* لا شيء */ }
    return urls;
}
async function downloadImage(url) {
    const axios = await axiosLib();
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 10 * 1024 * 1024, headers: { 'User-Agent': UA, Referer: 'https://www.pinterest.com/' } });
    const ct = String(r.headers['content-type'] || '');
    if (!ct.startsWith('image/') || ct.includes('gif')) throw new Error('not image');
    const buf = Buffer.from(r.data);
    if (buf.length < 4000) throw new Error('too small');
    return buf;
}
// يرجع حتى want صورة عشوائية (Buffers) لعبارة بحث معينة
async function getImages(query, want, jikanName) {
    let urls = await pinUrls(query);
    if (urls.length < want * 2) urls = urls.concat((await bingUrls(query)).filter((u) => !urls.includes(u)));
    if (urls.length < want && jikanName) urls = urls.concat((await jikanUrls(jikanName)).filter((u) => !urls.includes(u)));
    urls = shuffle(urls);
    const out = [];
    for (let i = 0; i < urls.length && out.length < want; i += want) {
        const batch = urls.slice(i, i + (want - out.length) + 2);
        const res = await Promise.allSettled(batch.map(downloadImage));
        for (const r of res) if (r.status === 'fulfilled' && out.length < want) out.push(r.value);
        if (i > want * 6) break;
    }
    return out;
}
// تمويه الصورة (بكسلة) لتصعيب التعرف عليها
async function pixelate(buf, blocks) {
    try {
        const sharp = (await import('sharp')).default;
        const base = await sharp(buf, { failOn: 'none' }).rotate().toBuffer();
        const meta = await sharp(base).metadata();
        const scale = Math.min(1, 900 / Math.max(meta.width, meta.height));
        const W = Math.max(1, Math.round(meta.width * scale)), H = Math.max(1, Math.round(meta.height * scale));
        const small = await sharp(base).resize(blocks, Math.max(1, Math.round(blocks * H / W)), { fit: 'fill' }).toBuffer();
        return await sharp(small).resize(W, H, { kernel: 'nearest' }).jpeg({ quality: 85 }).toBuffer();
    } catch (e) { return buf; }
}
// يقصّ الصورة ويُبقي شريط العيون فقط (تقدير بحسب موضع العيون المعتاد في وجوه الأنمي)
async function cropEyes(buf) {
    try {
        const sharp = (await import('sharp')).default;
        const base = await sharp(buf, { failOn: 'none' }).rotate().toBuffer();
        const meta = await sharp(base).metadata();
        const W = meta.width, H = meta.height;
        // الصورة أصلاً شريط عيون عريض (لقطة عيون مقرّبة): تُترك كما هي بدون قص حتى لا تضيع العيون
        if (W / H >= 1.6) return await sharp(base).resize({ width: 900, withoutEnlargement: false }).jpeg({ quality: 90 }).toBuffer();
        const left = Math.round(W * 0.12), width = Math.round(W * 0.76);
        const top = Math.round(H * 0.27), height = Math.max(1, Math.round(H * 0.28));
        return await sharp(base).extract({ left, top, width, height }).resize({ width: 900, withoutEnlargement: false }).jpeg({ quality: 90 }).toBuffer();
    } catch (e) { return buf; }
}
async function sendImages(g, bufs, caption) {
    // صورة واحدة فقط وبدون زر
    if (!bufs.length) return;
    await g.sock.sendMessage(g.from, { image: bufs[0], caption }).catch(() => null);
}
// منشن حقيقي: نفس رقم/معرّف المرسل (بدون رقم الجهاز) حتى يظهر المنشن قابلاً للضغط
const realJid = (j) => { const [u, d] = String(j || '').split('@'); return u.split(':')[0] + '@' + (d || 's.whatsapp.net'); };
// رقم الفائز الحقيقي (s.whatsapp.net) بدل المعرّف المخفي (lid) حتى يظهر المنشن باسم العضو وليس رقماً وهمياً
async function realMentionJid(ctx) {
    const k = ctx.msg?.key || {};
    const isPn = (j) => String(j || '').endsWith('@s.whatsapp.net');
    const pn = [k.participantAlt, k.remoteJidAlt, ctx.sender].find(isPn);
    if (pn) return realJid(pn);
    try {
        const meta = await ctx.sock.groupMetadata(ctx.from);
        const me = (meta.participants || []).find((p) => [p.id, p.lid, p.jid].some((x) => x && num(x) === num(ctx.sender)));
        const alt = [me?.phoneNumber, me?.jid, me?.id].find(isPn);
        if (alt) return realJid(alt);
    } catch (e) { /* نكتفي بالمعرّف الأصلي */ }
    return ctx.sender;
}
// استمارة الإجابة (فوز / انتهاء الوقت): نص أو صورة + زر «التالي» لبدء نفس الفعالية مباشرة
async function sendAnswerForm(g, text, image, mentions = [], withButton = true) {
    const ments = mentions.map(realJid);
    if (withButton && await sendImageWithQuickReply(g.sock, g.from, image || null, text, 'التالي', g.nextCmd, ments)) return;
    if (image) await g.sock.sendMessage(g.from, { image, caption: text, mentions: ments }).catch(() => null);
    else await g.sock.sendMessage(g.from, { text, mentions: ments }).catch(() => null);
}

// ================================================================ 1) لوبي مشترك (مافيا + برا السالفة + XO)
const M_ROLES = {
    mafia: { e: '🥷', n: 'عضو الأكاتسكي (مافيا)', d: 'مهمتك مع زملائك أن تتخلصوا من أهل القرية واحداً تلو الآخر دون أن يُكشف أمركم.' },
    doctor: { e: '🩺', n: 'تسونادي (الطبيبة)', d: 'كل ليلة تحمي لاعباً واحداً من الاغتيال (يمكنك حماية نفسك).' },
    detective: { e: '🕵️', n: 'إل (المحقق)', d: 'كل ليلة تفحص لاعباً واحداً لتعرف هل هو من الأكاتسكي أم لا.' },
    citizen: { e: '🍃', n: 'قروي من كونوها (مواطن)', d: 'لا قدرة خاصة لك، لكن صوتك في النهار هو سلاحك لكشف الأكاتسكي.' }
};

async function openLobby(ctx, type) {
    const { sock, from } = ctx;
    if (games.has(from) || ctx.hasActiveGame?.()) {
        return sock.sendMessage(from, { text: '⚠️ توجد لعبة أو فعالية قيد التشغيل في هذه المجموعة! أنهوها أو اكتبوا ' + bt('.انهاء_اللعبة') });
    }
    const host = mkPlayer(ctx);
    const hostNick = parseNick(ctx);
    if (hostNick && norm(hostNick)) host.nick = hostNick;
    const g = { type, phase: 'lobby', sock, from, bank: ctx.bank, host: host.jid, hostIds: host.ids, players: [host], min: type === 'mafia' ? 5 : 3 };
    games.set(from, g);
    const isMafia = type === 'mafia';
    const text = box(isMafia ? '🥷' : '🕶️', isMafia ? 'مَـافِـيَـا الأَكَـاتْـسُـكِـي' : 'بَـرَّا الـسَّـالِـفَـة (أَنْـمِـي)',
        `«👑 ⌯ المضيف ↞ ${nm(host)}\n👥 ⌯ اللاعبون ↞ 1 / ${MAX_PLAYERS}\n🎯 ⌯ الحد الأدنى ↞ ${g.min} لاعبين»\n\n` +
        (isMafia
            ? '🥷 الأكاتسكي يتخفّون بين أهل كونوها.. والطبيبة والمحقق يحاولان إنقاذ القرية!\n📩 الأدوار تصل في *الخاص* — تأكد أن خاصّك مفتوح للبوت.'
            : '🎌 الجميع يعرف اسم الأنمي إلا واحد منكم (برا السالفة)!\nتكلموا عن الأنمي دون ذكر اسمه، ثم صوّتوا على من تظنونه الدخيل.\n📩 الكلمة تصل في *الخاص*.'),
        'اكتبوا .انضم <لقبكم> للدخول — والمضيف يكتب .ابدا للبدء');
    await sock.sendMessage(from, { text, mentions: [host.jid] });
}

async function joinCommand(ctx) {
    const { sock, from } = ctx;
    const g = games.get(from);
    if (!g || g.phase !== 'lobby') return sock.sendMessage(from, { text: '📌 لا توجد لعبة مفتوحة للانضمام حالياً.' });
    const ids = idsOf(ctx);
    const me = g.players.find((p) => hasId(p, ids));
    if (g.type !== 'xo') {   // مافيا / برا السالفة: التسجيل باللقب
        const nick = parseNick(ctx);
        if (me && me.nick) return sock.sendMessage(from, { text: `✅ أنت منضم بالفعل بلقب «${me.nick}»` });
        if (!nick || !norm(nick)) return sock.sendMessage(from, { text: '📌 اكتب لقبك بعد الأمر، مثال: ' + bt('.انضم ناروتو') });
        if (nickTaken(g, nick, me)) return sock.sendMessage(from, { text: '⚠️ هذا اللقب مستخدم، اختر لقباً آخر.' });
        if (me) { me.nick = nick; return sock.sendMessage(from, { text: `✅ تم تسجيل لقبك: «${nick}»` }); }
        if (g.players.length >= MAX_PLAYERS) return sock.sendMessage(from, { text: '⚠️ اكتمل عدد اللاعبين.' });
        const np = mkPlayer(ctx); np.nick = nick; g.players.push(np);
        return sock.sendMessage(from, { text: `✅ «${nick}» انضم إلى اللعبة  ⟦ ${g.players.length} / ${MAX_PLAYERS} ⟧` });
    }
    if (me) return sock.sendMessage(from, { text: '✅ أنت منضم بالفعل!' });
    if (g.targetNum && !ids.has(g.targetNum)) return sock.sendMessage(from, { text: `⚠️ هذا التحدي موجّه إلى @${g.targetNum} فقط.`, mentions: [g.targetJid] });
    g.players.push(mkPlayer(ctx));
    return xoStart(g);
}

async function playersCommand(ctx) {
    const g = games.get(ctx.from);
    if (!g || !g.players) return ctx.sock.sendMessage(ctx.from, { text: '📌 لا توجد لعبة فيها لاعبون الآن.' });
    const lines = g.players.map((p, i) => `🔹 ${p.n || i + 1} ↞ ${nm(p)}${g.phase !== 'lobby' && !p.alive ? ' 💀' : ''}`).join('\n');
    return ctx.sock.sendMessage(ctx.from, { text: box('👥', 'قَـائِـمَـةُ الـلَّاعِـبِـيـن', lines, 'اللعبة: ' + g.type), mentions: g.players.map((p) => p.jid) });
}

async function startCommand(ctx) {
    const g = games.get(ctx.from);
    if (!g) return ctx.sock.sendMessage(ctx.from, { text: '📌 لا توجد لعبة مفتوحة للبدء.' });
    if (!isHostOrAdmin(ctx, g)) return ctx.sock.sendMessage(ctx.from, { text: '❌ البدء للمضيف أو المشرفين فقط!' });
    // المضيف هو من يدير الفعالية بـ .ابدا (لا توجد مدة زمنية)
    if (g.phase === 'talk') return votePhase(g);
    if (g.phase === 'vote') return tallyVotes(g);
    if (g.type === 'mafia' && g.phase === 'night') return mafiaDawn(g);
    if (g.phase === 'verify') return g.onReady();
    if (g.phase === 'guess') return ctx.sock.sendMessage(ctx.from, { text: '⏳ بانتظار اختيار الدخيل للأنمي من القائمة.' });
    if (g.phase !== 'lobby') return ctx.sock.sendMessage(ctx.from, { text: '⚠️ اللعبة بدأت بالفعل.' });
    if (g.type === 'xo') return ctx.sock.sendMessage(ctx.from, { text: '⏳ بانتظار انضمام الخصم بكتابة .انضم' });
    if (g.players.length < g.min) return ctx.sock.sendMessage(ctx.from, { text: `⚠️ العدد غير كافٍ! الحد الأدنى ${g.min} لاعبين (الآن ${g.players.length}).` });
    const noNick = g.players.filter((p) => !p.nick);
    if (noNick.length) return ctx.sock.sendMessage(ctx.from, { text: `⚠️ لا يمكن البدء — لاعبون لم يسجلوا لقباً:\n${noNick.map((p) => '🔹 ' + tag(p.jid)).join('\n')}\n\nيكتب كلٌّ منهم: ${bt('.انضم <اللقب>')}`, mentions: noNick.map((p) => p.jid) });
    clearTimeout(g.timer);
    g.players.forEach((p, i) => { p.n = i + 1; });
    return g.type === 'mafia' ? mafiaBegin(g) : baraBegin(g);
}

// إرسال الأدوار في الخاص + التأكد من وصولها قبل بدء اللعبة
async function sendDm(g, p, text, mentions) {
    try { await g.sock.sendMessage(p.dm, mentions ? { text, mentions } : { text }); return true; } catch (e) { return false; }
}
async function deliverAll(g, onReady) {
    const failed = [];
    for (const p of g.players) {
        p.got = await sendDm(g, p, roleText(g, p), p.role === 'mafia' ? g.players.filter((x) => x.role === 'mafia').map((x) => x.jid) : undefined);
        if (!p.got) failed.push(p);
        await sleep(700);
    }
    if (!failed.length) return onReady();
    g.phase = 'verify'; g.onReady = onReady;
    await say(g, box('📨', 'تَـعَـذَّرَ إِرْسَـالُ الأَدْوَار',
        `«لم تصل الرسالة إلى:\n${failed.map((p) => '🔹 ' + nm(p)).join('\n')}»\n\nراسلوا البوت في *الخاص* واكتبوا ${bt('.دوري')} ليصلكم دوركم.\n⏭️ المضيف يكتب ${bt('.ابدا')} للمتابعة دون انتظارهم.`, 'لا تبدأ اللعبة قبل استلام الجميع لأدوارهم'), failed.map((p) => p.jid));
}
async function myRoleCommand(ctx) {
    const ids = idsOf(ctx);
    const g = [...games.values()].find((x) => x.players && x.phase !== 'lobby' && x.players.some((p) => hasId(p, ids)));
    if (!g) return ctx.sock.sendMessage(ctx.from, { text: '📌 لا توجد لعبة بدأت وأنت ضمن لاعبيها.' });
    const p = g.players.find((x) => hasId(x, ids));
    if (!ctx.isGroup) p.dm = ctx.from;
    const ok = await sendDm(g, p, roleText(g, p));
    p.got = p.got || ok;
    if (ctx.isGroup) await ctx.sock.sendMessage(ctx.from, { text: ok ? '📩 أرسلت لك دورك في الخاص.' : '❌ تعذر الإرسال — راسل البوت في الخاص واكتب .دوري هناك.' });
    if (g.phase === 'verify' && g.players.every((x) => x.got)) { clearTimeout(g.verifyTimer); g.onReady(); }
}

function roleText(g, p) {
    if (g.type === 'bara') {
        return p.outsider
            ? box('🕶️', 'أَنْـتَ بَـرَّا الـسَّـالِـفَـة!', `«🎭 لا تعرف اسم الأنمي!\n🔍 استمع لكلام اللاعبين وتظاهر أنك تعرفه، وحاول أن تستنتج الأنمي.\n🎯 إن اكتُشفت فلديك فرصة أخيرة لتخمين اسم الأنمي!»`, 'لا تفضح نفسك')
            : box('🎌', 'كَـلِـمَـةُ الـسَّـالِـفَـة', `«🎬 الأنمي ↞ ${g.word.w}\n🕶️ بينكم لاعب واحد لا يعرف هذه الكلمة — اكشفوه!\n💡 صِف الأنمي دون ذكر اسمه صراحة.»`, 'كن ذكياً ولا تكشف الاسم');
    }
    const r = M_ROLES[p.role];
    let extra = '';
    if (p.role === 'mafia') {
        const mates = g.players.filter((x) => x.role === 'mafia' && x !== p);
        extra = `\n🤝 زملاؤك: ${mates.length ? mates.map((x) => `${x.n}) ${nm(x)}`).join('، ') : 'لا أحد — أنت وحدك!'}`;
    }
    return box(r.e, 'دَوْرُكَ فِي الـلُّـعْـبَـة', `«${r.e} ⌯ دورك ↞ ${r.n}\n📜 ⌯ مهمتك ↞ ${r.d}»${extra}\n\n🔢 رقمك في اللعبة: *${p.n}*`, 'لا تُخبر أحداً بدورك!');
}

const aliveOf = (g) => g.players.filter((p) => p.alive);
const listOf = (g, onlyAlive = true) => (onlyAlive ? aliveOf(g) : g.players).map((p) => `🔹 ${p.n} ↞ ${nm(p)}${p.alive ? '' : ' 💀'}`).join('\n');

// ---------------------------------------------------------------- مافيا
async function mafiaBegin(g) {
    const N = g.players.length;
    const mc = N <= 7 ? 1 : N <= 11 ? 2 : 3;
    const order = shuffle(g.players);
    order.forEach((p, i) => { p.role = i < mc ? 'mafia' : i === mc ? 'doctor' : i === mc + 1 ? 'detective' : 'citizen'; p.alive = true; });
    g.mafiaCount = mc; g.round = 0;
    g.phase = 'dealing';
    await say(g, box('🥷', 'بَـدْءُ مَـافِـيَـا الأَكَـاتْـسُـكِـي',
        `«👥 ⌯ اللاعبون ↞ ${N}\n🥷 ⌯ الأكاتسكي ↞ ${mc}\n🩺 ⌯ طبيبة ↞ 1  |  🕵️ محقق ↞ 1  |  🍃 مواطنون ↞ ${N - mc - 2}»\n\n📩 جاري إرسال الأدوار في الخاص...\n\n${listOf(g)}`, 'الدور يصل لكل لاعب في الخاص وليس هنا'), g.players.map((p) => p.jid));
    await deliverAll(g, () => mafiaNight(g));
}
async function mafiaNight(g) {
    if (games.get(g.from) !== g) return;
    g.round++; g.phase = 'night';
    g.night = { kills: {}, protect: null, check: null, done: new Set() };
    const actors = aliveOf(g).filter((p) => ['mafia', 'doctor', 'detective'].includes(p.role));
    g.actorCount = actors.length;
    await say(g, box('🌙', `الـلَّـيْـل — الـلَّـيْـلَـةُ ${g.round}`,
        `«🌑 القرية تنام والظلام يسدل ستاره...\n🥷 الأكاتسكي يختارون ضحيتهم\n🩺 الطبيبة تحمي أحدهم\n🕵️ المحقق يفحص مشتبهاً به»\n\n👥 الأحياء:\n${listOf(g)}\n\n📩 الأدوار تُنفّذ في الخاص — المضيف يكتب ${bt('.ابدا')} لإنهاء الليل`, 'التصرف الليلي يكون في الخاص فقط'), aliveOf(g).map((p) => p.jid));
    const list = listOf(g);
    for (const p of actors) {
        const cmd = p.role === 'mafia' ? '.قتل' : p.role === 'doctor' ? '.حماية' : '.فحص';
        const act = p.role === 'mafia' ? 'اختر ضحية الليلة' : p.role === 'doctor' ? 'اختر من تحميه الليلة' : 'اختر من تفحصه الليلة';
        await sendDm(g, p, box(M_ROLES[p.role].e, 'مُـهِـمَّـةُ الـلَّـيْـل', `«${act}»\n\n${list}\n\nأرسل: ${bt(cmd + ' <الرقم>')}`, 'اختر بحكمة!'), aliveOf(g).map((x) => x.jid));
        await sleep(400);
    }
}
async function mafiaNightAction(ctx, g, p, kind) {
    const reply = (t) => ctx.sock.sendMessage(ctx.from, { text: t });
    if (g.phase !== 'night') return reply('⏳ ليس وقت الليل الآن.');
    if (!p.alive) return reply('💀 أنت خارج اللعبة.');
    const need = { قتل: 'mafia', حماية: 'doctor', حمايه: 'doctor', فحص: 'detective' }[kind];
    if (p.role !== need) return reply('❌ هذا الأمر ليس لدورك.');
    const n = parseInt(toEn(ctx.cmd.split(' ')[1] || ''), 10);
    const target = aliveOf(g).find((x) => x.n === n);
    if (!target) return reply('⚠️ رقم غير صحيح — اختر رقماً من قائمة الأحياء.');
    if (need === 'mafia' && target.role === 'mafia') return reply('🚫 لا يمكنك استهداف زميلك!');
    if (need === 'mafia') g.night.kills[p.n] = target.n;
    if (need === 'doctor') g.night.protect = target.n;
    if (need === 'detective') {
        g.night.check = target.n;
        await reply(box('🕵️', 'نَـتِـيـجَـةُ الـفَـحْـص', `«👤 اللاعب ${target.n} ↞ ${nm(target)}\n🔎 النتيجة ↞ ${target.role === 'mafia' ? '🥷 من الأكاتسكي!' : '🍃 ليس من الأكاتسكي'}»`, 'استخدم المعلومة بحكمة'));
    } else {
        await reply(`✅ تم تسجيل اختيارك: اللاعب ${target.n}.`);
    }
    g.night.done.add(p.n);
    if (g.night.done.size >= g.actorCount) { clearTimeout(g.timer); mafiaDawn(g); }
}
async function mafiaDawn(g) {
    if (games.get(g.from) !== g || g.phase !== 'night') return;
    g.phase = 'dawn'; clearTimeout(g.timer);
    const counts = {};
    Object.values(g.night.kills).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
    const top = Math.max(0, ...Object.values(counts));
    const targetN = top ? Number(rnd(Object.keys(counts).filter((k) => counts[k] === top))) : null;
    let text;
    const mentions = [];
    if (!targetN) text = '🌅 مرّت الليلة بهدوء... لم يُقتل أحد.';
    else if (g.night.protect === targetN) text = '🌅 حاول الأكاتسكي اغتيال أحدهم، لكن الطبيبة أنقذته في اللحظة الأخيرة! 🩺✨';
    else {
        const v = g.players.find((p) => p.n === targetN);
        v.alive = false; mentions.push(v.jid);
        text = `🌅 أشرقت الشمس على جريمة!\n💀 قُتل ${nm(v)} الليلة.\n🎭 كان دوره: ${M_ROLES[v.role].e} ${M_ROLES[v.role].n}`;
    }
    await say(g, box('☀️', 'الـصَّـبَـاح', text, 'ناقشوا من تشكّون به'), mentions);
    if (await mafiaCheckWin(g)) return;
    g.phase = 'talk';
    await say(g, box('💬', 'وَقْـتُ الـنِّـقَـاش', `«👥 الأحياء:\n${listOf(g)}»\n\n🗳️ المضيف يكتب ${bt('.ابدا')} لبدء التصويت.`, 'ناقشوا وحاولوا كشف الأكاتسكي'), aliveOf(g).map((p) => p.jid));
}
async function mafiaCheckWin(g) {
    const al = aliveOf(g), m = al.filter((p) => p.role === 'mafia').length, o = al.length - m;
    let winners = null, title = '';
    if (m === 0) { winners = g.players.filter((p) => p.role !== 'mafia'); title = '🍃 فاز أهل كونوها! تم القضاء على الأكاتسكي.'; }
    else if (m >= o) { winners = g.players.filter((p) => p.role === 'mafia'); title = '🥷 فاز الأكاتسكي! سيطروا على القرية.'; }
    if (!winners) return false;
    for (const w of winners) await g.bank?.add(w.jid, 40);
    const roles = g.players.map((p) => `${M_ROLES[p.role].e} ${p.n} ↞ ${nm(p)} (${M_ROLES[p.role].n})`).join('\n');
    await say(g, box('🏆', 'نِـهَـايَـةُ الـمَـافِـيَـا', `«${title}\n🎁 مكافأة الفائزين: +40 نقطة»\n\n📜 الأدوار:\n${roles}`, 'شكراً للعب!'), g.players.map((p) => p.jid));
    endGame(g);
    return true;
}

// ---------------------------------------------------------------- التصويت (مشترك: مافيا + برا السالفة)
async function votePhase(g) {
    if (games.get(g.from) !== g) return;
    g.phase = 'vote'; g.votes = new Map(); clearTimeout(g.timer);
    const text = box('🗳️', 'وَقْـتُ الـتَّـصْـوِيـت', `«👥 اللاعبون:\n${listOf(g)}»\n\nاضغط زر ${bt('تصويت')} واختر اللقب\n🏁 المضيف يكتب ${bt('.ابدا')} لإنهاء التصويت`, 'من يحصل على أكثر الأصوات يُطرد');
    const rows = aliveOf(g).map((p) => ({ header: '', title: p.nick || ('لاعب ' + p.n), description: 'اختيار هذا اللقب', id: `.صوت ${p.n}` }));
    const ok = await sendSelectList(g.sock, g.from, text, 'تصويت', rows);
    if (!ok) await say(g, text + `\n\nأو اكتبوا ${bt('.صوت <الرقم>')}`);
}
const baraVote = (g) => votePhase(g);
async function voteCommand(ctx) {
    const g = games.get(ctx.from);
    if (!g || g.phase !== 'vote') return ctx.sock.sendMessage(ctx.from, { text: '📌 لا يوجد تصويت جارٍ الآن.' });
    const ids = idsOf(ctx);
    const voter = g.players.find((p) => hasId(p, ids));
    if (!voter || !voter.alive) return ctx.sock.sendMessage(ctx.from, { text: '❌ أنت لست من اللاعبين الأحياء!' });
    const n = parseInt(toEn(ctx.cmd.split(' ')[1] || ''), 10);
    const target = aliveOf(g).find((p) => p.n === n);
    if (!target) return ctx.sock.sendMessage(ctx.from, { text: '⚠️ رقم غير صحيح — اكتب .صوت ورقم اللاعب.' });
    if (g.votes.has(voter.n)) return ctx.sock.sendMessage(ctx.from, { text: `⚠️ ${nm(voter)} صوّتَّ بالفعل — لا يمكن التصويت أكثر من مرة.`, mentions: [voter.jid] });
    g.votes.set(voter.n, target.n);
    await ctx.sock.sendMessage(ctx.from, { text: `🗳️ ${nm(voter)} صوّت (${g.votes.size} / ${aliveOf(g).length})`, mentions: [voter.jid] });
    if (g.votes.size >= aliveOf(g).length) { clearTimeout(g.timer); tallyVotes(g); }
}
// اختيار الدخيل لاسم الأنمي من القائمة: صح = فوزه، خطأ = خسارته
async function baraPick(ctx, args) {
    const g = games.get(ctx.from);
    if (!g || g.type !== 'bara' || g.phase !== 'guess') return ctx.sock.sendMessage(ctx.from, { text: '📌 لا يوجد اختيار جارٍ الآن.' });
    if (!hasId(g.guessBy, idsOf(ctx))) return ctx.sock.sendMessage(ctx.from, { text: '❌ الاختيار للدخيل فقط!' });
    const n = parseInt(toEn(args || ''), 10);
    const opt = g.options[n - 1];
    if (!opt) return ctx.sock.sendMessage(ctx.from, { text: '⚠️ اختيار غير صحيح — اختر من القائمة.' });
    g.phase = 'done';
    return baraResult(g, opt === g.word ? 'guessed' : 'caught', g.guessBy);
}
async function tallyVotes(g) {
    if (games.get(g.from) !== g || g.phase !== 'vote') return;
    g.phase = 'tally'; clearTimeout(g.timer);
    const counts = {};
    for (const t of g.votes.values()) counts[t] = (counts[t] || 0) + 1;
    const top = Math.max(0, ...Object.values(counts));
    const tops = Object.keys(counts).filter((k) => counts[k] === top).map(Number);
    const summary = Object.entries(counts).map(([k, v]) => `🔹 ${nm(g.players.find((p) => p.n === Number(k)) || { jid: '' })} ↞ ${v} صوت`).join('\n') || 'لا أصوات';
    if (!top || tops.length > 1) {
        await say(g, box('⚖️', 'تَـعَـادُل', `«${summary}»\n\nتعادلت الأصوات — لا أحد يُطرد!`, 'ننتقل للمرحلة التالية'));
        if (g.type === 'mafia') return mafiaNight(g);
        return baraResult(g, 'tie', g.players.find((p) => p.outsider));
    }
    const out = g.players.find((p) => p.n === tops[0]);
    if (g.type === 'bara') {
        if (!out.outsider) return baraResult(g, 'wrong', g.players.find((p) => p.outsider), out);
        g.phase = 'guess'; g.guessBy = out;
        g.options = shuffle([g.word, ...shuffle(BARA_WORDS.filter((w) => w !== g.word)).slice(0, 5)]);
        const gtext = box('🎯', 'تَـمَّ كَـشْـفُـه!', `«${summary}»\n\n🕶️ ${nm(out)} هو برا السالفة فعلاً!\n🎬 على الدخيل أن يختار اسم الأنمي الصحيح من القائمة — إن أصاب فاز وإن أخطأ خسر!`, 'فرصته الأخيرة!');
        const grows = g.options.map((o, i) => ({ header: '', title: o.w, description: 'اختيار هذا الأنمي', id: `.سالفة ${i + 1}` }));
        const gok = await sendSelectList(g.sock, g.from, gtext, 'اختر الأنمي', grows);
        if (!gok) await say(g, gtext + `\n\n${g.options.map((o, i) => `🔹 ${i + 1} ↞ ${o.w}`).join('\n')}\n\nاكتب ${bt('.سالفة <الرقم>')}`, [out.jid]);
        return;
    }
    out.alive = false;
    await say(g, box('⚔️', 'نَـتِـيـجَـةُ الـتَّـصْـوِيـت', `«${summary}»\n\n💀 تم طرد ${nm(out)}\n🎭 كان دوره: ${M_ROLES[out.role].e} ${M_ROLES[out.role].n}`, 'القرار الجماعي نُفّذ'), [out.jid]);
    if (await mafiaCheckWin(g)) return;
    return mafiaNight(g);
}

// ---------------------------------------------------------------- برا السالفة
async function baraBegin(g) {
    g.word = rnd(BARA_WORDS);
    const outsider = rnd(g.players);
    g.players.forEach((p) => { p.outsider = p === outsider; p.alive = true; });
    g.phase = 'dealing';
    await say(g, box('🕶️', 'بَـدْءُ بَـرَّا الـسَّـالِـفَـة', `«👥 اللاعبون ↞ ${g.players.length}\n📩 جاري إرسال الكلمة في الخاص...»\n\n${listOf(g)}`, 'واحد منكم لا يعرف الكلمة!'), g.players.map((p) => p.jid));
    await deliverAll(g, async () => {
        if (games.get(g.from) !== g) return;
        g.phase = 'talk';
        const order = shuffle(g.players).map((p, i) => `🔹 ${i + 1} ↞ ${nm(p)}`).join('\n');
        await say(g, box('💬', 'جَـوْلَـةُ الـوَصْـف', `«كل لاعب يكتب جملة قصيرة يصف بها الأنمي دون ذكر اسمه، بالترتيب التالي:»\n\n${order}\n\n🗳️ المضيف يكتب ${bt('.ابدا')} عندما تنتهون لبدء التصويت`, 'اكشفوا الدخيل بذكائكم'), g.players.map((p) => p.jid));
    });
}
async function baraResult(g, kind, outsider, voted) {
    const crew = g.players.filter((p) => !p.outsider);
    let text, winners;
    if (kind === 'guessed') { winners = [outsider]; text = `🕶️ ${nm(outsider)} خمّن الأنمي بنجاح ونجا!`; }
    else if (kind === 'wrong') { winners = [outsider]; text = `🕶️ طردتم ${nm(voted)} خطأً! الدخيل الحقيقي هو ${nm(outsider)} وقد فاز.`; }
    else if (kind === 'tie') { winners = [outsider]; text = `⚖️ تعادلت الأصوات فنجا الدخيل ${nm(outsider)} وفاز!`; }
    else { winners = crew; text = `🎌 فاز اللاعبون! كُشف الدخيل ${nm(outsider)} ولم يستطع تخمين الأنمي.`; }
    const pts = kind === 'caught' ? 30 : 50;
    for (const w of winners) await g.bank?.add(w.jid, pts);
    await say(g, box('🏆', 'نِـهَـايَـةُ بَـرَّا الـسَّـالِـفَـة', `«${text}\n🎬 الأنمي كان ↞ ${g.word.w}\n🎁 المكافأة: +${pts} نقطة للفائزين»`, 'جولة أخرى؟ اكتبوا .برا_السالفة'), g.players.map((p) => p.jid));
    endGame(g);
}

// ================================================================ 2) جولات الأسئلة (مسابقة + خمن الإيموجي)
async function startRounds(ctx, kind, items, rounds, titleBox) {
    const { sock, from } = ctx;
    if (games.has(from) || ctx.hasActiveGame?.()) return sock.sendMessage(from, { text: '⚠️ توجد لعبة أو فعالية قيد التشغيل! اكتبوا ' + bt('.انهاء_اللعبة') });
    const g = { type: kind, sock, from, bank: ctx.bank, hostIds: idsOf(ctx), items: shuffle(items).slice(0, rounds), idx: -1, scores: {}, names: {} };
    games.set(from, g);
    await sock.sendMessage(from, { text: titleBox(g.items.length) });
    g.timer2 = setTimeout(() => nextRound(g), 2500);
}
async function nextRound(g) {
    if (games.get(g.from) !== g) return;
    g.idx++;
    if (g.idx >= g.items.length) return finishRounds(g);
    g.cur = g.items[g.idx]; g.solved = false;
    const isEmoji = g.type === 'emoji';
    await say(g, box(isEmoji ? '🎭' : '🧠', `الـجَـوْلَـة ${g.idx + 1} / ${g.items.length}`,
        isEmoji ? `«🎬 خمّن الأنمي من الإيموجي:»\n\n        ${g.cur.q}\n\n⏳ الوقت: 25 ثانية` : `«❓ ${g.cur.q}»\n\n⏳ الوقت: 20 ثانية`, 'أول إجابة صحيحة تفوز بالنقاط'));
    g.timer = setTimeout(async () => {
        if (games.get(g.from) !== g || g.solved) return;
        g.solved = true;
        await say(g, `⏰ *انتهى الوقت!*\n💡 الإجابة: ${bt(g.cur.a[0])}`);
        g.timer2 = setTimeout(() => nextRound(g), 2500);
    }, isEmoji ? 25000 : 20000);
}
async function finishRounds(g) {
    const entries = Object.entries(g.scores).sort((a, b) => b[1] - a[1]);
    let text;
    if (!entries.length) text = '😴 لم يفز أحد بأي جولة هذه المرة!';
    else {
        const medals = ['🥇', '🥈', '🥉'];
        text = entries.slice(0, 5).map(([jid, s], i) => `${medals[i] || '🎖️'} ${tag(jid)} ↞ ${s} جولة`).join('\n');
        await g.bank?.add(entries[0][0], 10);
        text += `\n\n🎁 مكافأة المتصدر ${tag(entries[0][0])}: +10 نقاط`;
    }
    await say(g, box('🏆', 'نِـهَـايَـةُ الـمُـسَـابَـقَـة', `«${text}»`, 'شكراً للمشاركة!'), entries.map(([j]) => j));
    endGame(g);
}

// ================================================================ 3) القنبلة
async function bombStart(ctx) {
    const { sock, from, sender } = ctx;
    if (games.has(from) || ctx.hasActiveGame?.()) return sock.sendMessage(from, { text: '⚠️ توجد لعبة قيد التشغيل! اكتبوا ' + bt('.انهاء_اللعبة') });
    const g = { type: 'bomb', sock, from, bank: ctx.bank, hostIds: idsOf(ctx), holder: sender, passes: 0 };
    games.set(from, g);
    const fuse = 25000 + Math.floor(Math.random() * 30000);
    g.timer = setTimeout(() => bombExplode(g), fuse);
    await sock.sendMessage(from, {
        text: box('💣', 'قُـنْـبُـلَـةُ دِيـدَارَا', `«🎨 دِيدارا يقول: الفنّ... انفجار!\n💣 القنبلة الآن مع ↞ ${tag(sender)}\n🔥 مرّرها بسرعة قبل أن تنفجر!»\n\nالأمر: ${bt('.مرر @منشن')} أو بالرد على رسالة العضو`, 'من تنفجر عنده يخسر 10 نقاط'),
        mentions: [sender]
    });
}
async function bombPass(ctx) {
    const { sock, from, sender } = ctx;
    const g = games.get(from);
    if (!g || g.type !== 'bomb') return sock.sendMessage(from, { text: '📌 لا توجد قنبلة في هذه المجموعة. ابدأوا بـ .قنبلة' });
    if (!idsOf(ctx).has(num(g.holder))) return sock.sendMessage(from, { text: '🚫 القنبلة ليست معك!' });
    const target = ctx.getTarget?.(ctx.msg);
    if (!target) return sock.sendMessage(from, { text: '⚠️ منشن العضو أو رُدّ على رسالته: .مرر @منشن' });
    if (num(target) === num(sender) || num(target) === botNum(sock)) return sock.sendMessage(from, { text: '🚫 لا يمكنك تمريرها لنفسك أو للبوت!' });
    g.holder = target; g.passes++;
    await sock.sendMessage(from, { text: `💨 ${tag(sender)} مرّر القنبلة إلى ${tag(target)}!\n⏳ تكتك... تكتك... 💣`, mentions: [sender, target] });
}
async function bombExplode(g) {
    if (games.get(g.from) !== g) return;
    await g.bank?.add(g.holder, -10);
    await say(g, box('💥', 'بُـووووم!', `«🎨 دِيدارا: «هذا هو الفنّ الحقيقي!» 💥\n☠️ انفجرت القنبلة في ${tag(g.holder)}\n💸 الخسارة ↞ -10 نقاط\n🔄 عدد التمريرات ↞ ${g.passes}»`, 'جولة أخرى؟ .قنبلة'), [g.holder]);
    endGame(g);
}

// ================================================================ 4) ألعاب فردية سريعة
const SLOT_SYMS = ['🍥', '🍖', '🔥', '⚡', '👁️', '🗡️'];
async function slotCommand(ctx) {
    const { sock, from, sender } = ctx;
    const left = cooldown('slot:' + num(sender), 6000);
    if (left) return sock.sendMessage(from, { text: `⏳ انتظر ${left} ثوانٍ قبل الدوران التالي.`, mentions: [sender] });
    const arg = parseInt(toEn(ctx.cmd.split(' ')[1] || ''), 10);
    const bet = Number.isFinite(arg) ? arg : 10;
    if (bet < 5 || bet > 500) { cooldowns.delete('slot:' + num(sender)); return sock.sendMessage(from, { text: '⚠️ الرهان بين 5 و 500 نقطة. مثال: .سلوت 50' }); }
    const bal = await ctx.bank.get(sender);
    if (bal < bet) { cooldowns.delete('slot:' + num(sender)); return sock.sendMessage(from, { text: `💸 رصيدك ${bal} نقطة فقط ولا يكفي للرهان بـ ${bet}.`, mentions: [sender] }); }
    const sent = await sock.sendMessage(from, { text: box('🎰', 'سَـلُـوت الأَنْـمِـي', `«🌀 │ 🌀 │ 🌀\n\n⏳ تدور البكرات...»`, `الرهان: ${bet} نقطة`) });
    const r = [rnd(SLOT_SYMS), rnd(SLOT_SYMS), rnd(SLOT_SYMS)];
    let mult = 0, label = '💔 خسرت الرهان';
    if (r[0] === r[1] && r[1] === r[2]) { mult = r[0] === '👁️' ? 10 : 5; label = r[0] === '👁️' ? '👁️ شارينغان! الجائزة الكبرى!' : '🔥 ثلاثة متطابقة!'; }
    else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) { mult = 1.5; label = '✨ رمزان متطابقان'; }
    const payout = Math.floor(bet * mult);
    const net = payout - bet;
    await ctx.bank.add(sender, net);
    await sleep(1500);
    const final = box('🎰', 'سَـلُـوت الأَنْـمِـي', `«${r.join(' │ ')}\n\n${label}\n💰 ${net >= 0 ? 'الربح' : 'الخسارة'} ↞ ${net >= 0 ? '+' : ''}${net} نقطة\n🏦 رصيدك ↞ ${await ctx.bank.get(sender)}»\n\n👤 ${tag(sender)}`, `الرهان: ${bet} نقطة`);
    try { await sock.sendMessage(from, { text: final, edit: sent.key, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: final, mentions: [sender] }); }
}
async function coinCommand(ctx) {
    const side = Math.random() < 0.5
        ? { e: '🍃', n: 'وجه — كونوها', c: 'ريح التغيير تهبّ لصالحك!' }
        : { e: '☁️', n: 'كتابة — الأكاتسكي', c: 'الغيوم الحمراء تقترب...' };
    return ctx.sock.sendMessage(ctx.from, { text: box('🪙', 'قَـلْـبُ الـعُـمْـلَـة', `«🪙 ⌯ النتيجة ↞ ${side.e} ${side.n}\n💬 ${side.c}»\n\n👤 ${tag(ctx.sender)}`, 'اللاعب الأسرع يطلب جولة أخرى'), mentions: [ctx.sender] });
}
async function diceCommand(ctx) {
    const cnt = Math.min(3, Math.max(1, parseInt(toEn(ctx.cmd.split(' ')[1] || '1'), 10) || 1));
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const rolls = Array.from({ length: cnt }, () => 1 + Math.floor(Math.random() * 6));
    const sum = rolls.reduce((a, b) => a + b, 0);
    const cm = rolls.every((x) => x === 6) ? '🔥 بانكاي! قوة خارقة!' : rolls.every((x) => x === 1) ? '😅 حتى لوفي حظّه أفضل!' : sum >= cnt * 4 ? '⚡ حظ أسطوري!' : '🍃 رمية عادية.';
    return ctx.sock.sendMessage(ctx.from, { text: box('🎲', 'نَـرْدُ الـمَـعْـرَكَـة', `«🎲 ⌯ الرميات ↞ ${rolls.map((r) => faces[r - 1] + ' ' + r).join('  ')}\n➕ ⌯ المجموع ↞ ${sum}\n💬 ${cm}»\n\n👤 ${tag(ctx.sender)}`, 'اكتب .نرد 2 لرمي نردين (حتى 3)'), mentions: [ctx.sender] });
}
const WHEEL = [
    { t: '🍃 وسام كونوها', p: 5, w: 25 }, { t: '🍥 رامين إيتشيراكو', p: 10, w: 20 }, { t: '⚡ تشيدوري', p: 20, w: 8 },
    { t: '👁️ شارينغان', p: 50, w: 3 }, { t: '👑 جائزة الهوكاجي', p: 100, w: 1 }, { t: '💨 عجلة فارغة', p: 0, w: 25 }, { t: '💣 فخّ ديدارا', p: -10, w: 18 }
];
async function wheelCommand(ctx) {
    const { sock, from, sender } = ctx;
    const left = cooldown('wheel:' + num(sender), 5 * 60 * 1000);
    if (left) return sock.sendMessage(from, { text: `⏳ يمكنك تدوير العجلة مرة كل 5 دقائق — باقي ${Math.ceil(left / 60)} دقيقة.`, mentions: [sender] });
    let pick = Math.random() * WHEEL.reduce((a, b) => a + b.w, 0), item = WHEEL[0];
    for (const w of WHEEL) { if ((pick -= w.w) < 0) { item = w; break; } }
    await ctx.bank.add(sender, item.p);
    return sock.sendMessage(from, { text: box('🎡', 'عَـجَـلَـةُ الـحَـظّ', `«🎡 ⌯ وقفت العجلة على ↞ ${item.t}\n💰 ⌯ النتيجة ↞ ${item.p > 0 ? '+' : ''}${item.p} نقطة\n🏦 ⌯ رصيدك ↞ ${await ctx.bank.get(sender)}»\n\n👤 ${tag(sender)}`, 'العجلة متاحة كل 5 دقائق'), mentions: [sender] });
}

// ---------------------------------------------------------------- حجر ورقة مقص
const RPS = { حجر: { e: '🪨', n: 'حجر (قبضة لوفي)', beats: 'مقص' }, ورقة: { e: '📜', n: 'ورقة (تعويذة)', beats: 'حجر' }, مقص: { e: '✂️', n: 'مقص (كوناي)', beats: 'ورقة' } };
const rpsKey = (c) => (c === 'ورقه' ? 'ورقة' : c);
async function rpsCommand(ctx) {
    const { sock, from, sender } = ctx;
    const mine = rpsKey(ctx.cmdBase);
    const target = ctx.getTarget?.(ctx.msg);
    if (!target) { // ضد البوت
        const bot = rnd(Object.keys(RPS));
        const res = mine === bot ? 'تعادل 🤝' : RPS[mine].beats === bot ? 'فزت! 🏆 (+5 نقاط)' : 'فاز البوت 🤖';
        if (RPS[mine].beats === bot) await ctx.bank.add(sender, 5);
        return sock.sendMessage(from, { text: box('✊', 'حَـجَـرٌ وَوَرَقَـةٌ وَمِـقَـصّ', `«👤 أنت ↞ ${RPS[mine].e} ${RPS[mine].n}\n🤖 البوت ↞ ${RPS[bot].e} ${RPS[bot].n}\n\n🎯 النتيجة ↞ ${res}»`, 'تحدَّ عضواً: .حجر @منشن'), mentions: [sender] });
    }
    if (num(target) === num(sender) || num(target) === botNum(sock)) return sock.sendMessage(from, { text: '🚫 اختر عضواً آخر للتحدي.' });
    if (duels.has(from)) return sock.sendMessage(from, { text: '⚠️ يوجد تحدٍّ جارٍ في المجموعة، انتظروا نهايته.' });
    const d = { sock, from, a: { jid: sender, ids: idsOf(ctx) }, b: { jid: target, ids: new Set([num(target)]) }, choice: {} };
    duels.set(from, d);
    d.timer = setTimeout(() => { if (duels.get(from) === d) { duels.delete(from); sock.sendMessage(from, { text: '⌛ انتهى وقت التحدي بدون اكتمال الاختيارات.' }).catch(() => {}); } }, 90000);
    await sock.sendMessage(from, { text: box('⚔️', 'تَـحَـدِّي حَـجَـر وَوَرَقَـة وَمِـقَـص', `«🥊 ${tag(sender)} يتحدّى ${tag(target)}!\n📩 كل لاعب يرسل اختياره *سرّاً في خاص البوت*:\n${bt('.حجر')}  أو  ${bt('.ورقة')}  أو  ${bt('.مقص')}»\n\n⏳ المهلة: 90 ثانية`, 'الاختيار في الخاص حتى لا يراه الخصم'), mentions: [sender, target] });
}
async function rpsDuelChoice(ctx, d, who) {
    d.choice[who] = rpsKey(ctx.cmdBase);
    await ctx.sock.sendMessage(ctx.from, { text: `✅ سُجّل اختيارك: ${RPS[d.choice[who]].e}. انتظر الخصم...` });
    if (!d.choice.a || !d.choice.b) return;
    clearTimeout(d.timer); duels.delete(d.from);
    const ca = d.choice.a, cb = d.choice.b;
    let res, winner = null;
    if (ca === cb) res = 'تعادل 🤝';
    else if (RPS[ca].beats === cb) { winner = d.a.jid; res = `فاز ${tag(d.a.jid)} 🏆 (+10 نقاط)`; }
    else { winner = d.b.jid; res = `فاز ${tag(d.b.jid)} 🏆 (+10 نقاط)`; }
    if (winner) await ctx.bank?.add(winner, 10);
    await d.sock.sendMessage(d.from, { text: box('⚔️', 'نَـتِـيـجَـةُ الـتَّـحَـدِّي', `«${tag(d.a.jid)} ↞ ${RPS[ca].e} ${RPS[ca].n}\n${tag(d.b.jid)} ↞ ${RPS[cb].e} ${RPS[cb].n}\n\n🎯 ${res}»`, 'تحدٍّ آخر؟ .حجر @منشن'), mentions: [d.a.jid, d.b.jid] }).catch(() => {});
}

// ================================================================ 5) إكس أو (XO)
const XO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const XO_MARK = ['🍥', '⚡'];
const NUM_E = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
async function xoOpen(ctx) {
    const { sock, from } = ctx;
    if (games.has(from) || ctx.hasActiveGame?.()) return sock.sendMessage(from, { text: '⚠️ توجد لعبة قيد التشغيل! اكتبوا ' + bt('.انهاء_اللعبة') });
    const host = mkPlayer(ctx);
    const target = ctx.getTarget?.(ctx.msg);
    const g = { type: 'xo', phase: 'lobby', sock, from, bank: ctx.bank, host: host.jid, hostIds: host.ids, players: [host], board: Array(9).fill(null), turn: 0, targetJid: target || null, targetNum: target ? num(target) : null };
    games.set(from, g);
    g.timer = setTimeout(() => { if (games.get(from) === g && g.phase === 'lobby') { endGame(g); say(g, '⌛ لم ينضم أحد — أُلغي التحدي.'); } }, 60000);
    await sock.sendMessage(from, {
        text: box('⭕', 'تَـحَـدِّي إِكْـس أُو (أَنْـمِـي)', `«🍥 ${tag(host.jid)} ضد ${g.targetJid ? tag(g.targetJid) : 'أي متحدٍّ'}\n⚡ الخصم يكتب ${bt('.انضم')} لقبول التحدي»\n\n⏳ المهلة: 60 ثانية`, 'اللاعب الأول 🍥 والثاني ⚡'),
        mentions: [host.jid, ...(g.targetJid ? [g.targetJid] : [])]
    });
}
function xoBoard(g) { return [0, 3, 6].map((r) => [0, 1, 2].map((c) => (g.board[r + c] ? XO_MARK[g.board[r + c] - 1] : NUM_E[r + c])).join(' ')).join('\n'); }
async function xoStart(g) {
    clearTimeout(g.timer); g.phase = 'play'; g.turn = 0;
    await xoPrompt(g, 'بدأت المعركة!');
}
async function xoPrompt(g, head) {
    const cur = g.players[g.turn];
    await say(g, box('⭕', 'إِكْـس أُو — الأَنْـمِـي', `«${head}\n\n${xoBoard(g)}\n\n🎯 الدور على ↞ ${XO_MARK[g.turn]} ${tag(cur.jid)}»\n\nاكتب رقم الخانة (1-9) في الشات`, 'لديك 60 ثانية للعب'), g.players.map((p) => p.jid));
    clearTimeout(g.timer);
    g.timer = setTimeout(async () => {
        if (games.get(g.from) !== g) return;
        const win = g.players[1 - g.turn];
        await g.bank?.add(win.jid, 10);
        await say(g, `⌛ انتهى وقت ${tag(cur.jid)}!\n🏆 فاز ${tag(win.jid)} بالانسحاب (+10 نقاط).`, [cur.jid, win.jid]);
        endGame(g);
    }, 60000);
}
async function xoMove(g, ctx) {
    const cur = g.players[g.turn];
    if (!hasId(cur, idsOf(ctx))) return false;
    const n = parseInt(toEn(ctx.trimmedBody.trim()), 10);
    if (!/^[1-9]$/.test(toEn(ctx.trimmedBody.trim())) || g.board[n - 1]) return false;
    g.board[n - 1] = g.turn + 1;
    const win = XO_LINES.some((l) => l.every((i) => g.board[i] === g.turn + 1));
    if (win) {
        await g.bank?.add(cur.jid, 25);
        await say(g, box('🏆', 'فَـوْزٌ سَـاحِـق', `«${xoBoard(g)}\n\n🎉 فاز ${XO_MARK[g.turn]} ${tag(cur.jid)}\n🎁 المكافأة ↞ +25 نقطة»`, 'مبروك الانتصار!'), [cur.jid]);
        endGame(g); return true;
    }
    if (g.board.every(Boolean)) {
        await say(g, box('🤝', 'تَـعَـادُل', `«${xoBoard(g)}\n\nانتهت اللعبة بالتعادل!»`, 'جولة أخرى؟ .اكس_او'));
        endGame(g); return true;
    }
    g.turn = 1 - g.turn;
    await xoPrompt(g, 'حركة موفقة!');
    return true;
}

// ================================================================ 6) ألعاب الصور: خمن الشخصية / معرفة الشخصية / عين
const MODES = {
    blur: { title: 'خَـمِّـنِ الـشَّـخْـصِـيَّـة', emoji: '🖼️', want: 1, suffix: ' anime', hint: 22000, end: 45000 },
    album: { title: 'مَـعْـرِفَـةُ الـشَّـخْـصِـيَّـة', emoji: '🎴', want: 1, suffix: ' anime', hint: 30000, end: 60000 },
    eyes: { title: 'خَـمِّـنْ صَـاحِـبَ الـعَـيْـن', emoji: '👁️', want: 1, suffix: ' anime eyes close up', hint: 25000, end: 50000 }
};
async function charGame(ctx, mode) {
    const { sock, from } = ctx;
    if (games.has(from) || ctx.hasActiveGame?.()) return sock.sendMessage(from, { text: '⚠️ توجد لعبة قيد التشغيل! اكتبوا ' + bt('.انهاء_اللعبة') });
    const M = MODES[mode];
    const ch = rnd(CHARACTERS);
    const g = { type: 'char', mode, sock, from, bank: ctx.bank, hostIds: idsOf(ctx), ch, answers: [...ch.ar, ...ch.en], solved: false, nextCmd: (mode === 'blur' ? '.خمن_الشخصية' : mode === 'album' ? '.معرفة_الشخصية' : '.عين') + ' next' };
    games.set(from, g);
    await sock.sendMessage(from, { text: `${M.emoji} *جاري البحث عن الصور...* انتظر لحظات ⏳` });
    let imgs = [];
    try { imgs = await getImages(ch.q + M.suffix, M.want, ch.q); } catch (e) { imgs = []; }
    if (games.get(from) !== g) return;   // أُنهيت اللعبة أثناء التحميل
    if (!imgs.length) { endGame(g); return sock.sendMessage(from, { text: '❌ تعذر جلب الصور حالياً، حاول بعد قليل.' }); }
    g.imgs = imgs;
    const head = box(M.emoji, M.title, mode === 'blur'
        ? `«🕵️ من هي هذه الشخصية؟ (الصورة مموّهة)\n⏳ الوقت: ${M.end / 1000} ثانية»`
        : `«🔎 من صاحب ${mode === 'eyes' ? 'هذه العيون' : 'هذه الصور'}؟\n🖼️ عدد الصور: ${imgs.length}\n⏳ الوقت: ${M.end / 1000} ثانية»`, 'اكتب اسم الشخصية في الشات — الأسرع يفوز');
    const first = mode === 'blur' ? [await pixelate(imgs[0], 18)] : mode === 'eyes' ? [await cropEyes(imgs[0])] : imgs;
    await sendImages(g, first, head);
    g.timer2 = setTimeout(async () => {
        if (games.get(from) !== g || g.solved) return;
        if (mode === 'blur') await sendImages(g, [await pixelate(imgs[0], 54)], `💡 *تلميح:* الأنمي ↞ ${ch.anime}\n(الصورة أوضح الآن)`);
        else await say(g, `💡 *تلميح:* الأنمي ↞ ${bt(ch.anime)}`);
    }, M.hint);
    g.timer = setTimeout(async () => {
        if (games.get(from) !== g || g.solved) return;
        g.solved = true;
        endGame(g);
        if (mode === 'blur') await sendAnswerForm(g, `⏰ *انتهى الوقت!*\n✅ الشخصية: ${ch.ar[0]} (${ch.anime})`, imgs[0], [], false);
        else await sendAnswerForm(g, `⏰ *انتهى الوقت!*\n✅ الشخصية: ${bt(ch.ar[0])} من أنمي ${ch.anime}`, null, [], false);
    }, M.end);
}
async function eyeBrowse(ctx, query) {
    const { sock, from } = ctx;
    const left = ctx.nextTap ? (cooldowns.set('eye:' + from, Date.now()), 0) : cooldown('eye:' + from, 12000);
    if (left) return sock.sendMessage(from, { text: `⏳ انتظر ${left} ثانية قبل البحث التالي.` });
    const found = CHARACTERS.find((c) => matches(query, [...c.ar, ...c.en], c.exact));
    const q = found ? found.q : query;
    await sock.sendMessage(from, { text: '👁️ *جاري البحث عن العيون...* ⏳' });
    let imgs = [];
    try { imgs = await getImages(`${q} anime eyes close up`, 1, found ? found.q : query); } catch (e) { imgs = []; }
    if (!imgs.length) return sock.sendMessage(from, { text: '❌ لم أجد صوراً لهذه الشخصية. جرّب اسماً آخر (مثال: .عين ايرين).' });
    imgs = [await cropEyes(imgs[0])];
    await sendAnswerForm({ sock, from, nextCmd: `.عين ${query} next` }, box('👁️', 'عُـيُـونُ الـشَّـخْـصِـيَّـة', `«🎴 الشخصية ↞ ${found ? found.ar[0] : query}\n🖼️ عدد الصور ↞ ${imgs.length}»`, 'للعبة التخمين اكتب .عين فقط'), imgs[0]);
}

// ================================================================ احزر: خمّن شخصية الأنمي بأسئلة صح / غلط
const GUESS_TIME = 6 * 60 * 1000;
async function guessStart(ctx) {
    const { sock, from } = ctx;
    if (games.has(from) || ctx.hasActiveGame?.()) return sock.sendMessage(from, { text: '⚠️ توجد لعبة قيد التشغيل! اكتبوا ' + bt('.انهاء_اللعبة') });
    const ch = rnd(GUESS_CHARS);
    const g = { type: 'guess', sock, from, bank: ctx.bank, hostIds: idsOf(ctx), ch, answers: ch.names, solved: false, q: 0, lastConf: 0, nextCmd: '.احزر next' };
    games.set(from, g);
    await say(g, box('🕵️', 'احْـزِرِ الـشَّـخْـصِـيَّـة', `«🎌 اخترتُ شخصية أنمي مشهورة.. حاولوا تخمينها!\n❓ اسألوا أي سؤال فيه كلمة «هل» وأنا أجاوب *صح ✅* أو *غلط ❌*\n💬 مثال: هل هذه الشخصية من ون بيس؟ • هل شعره أسود؟ • هل هو شرير؟ • هل يستخدم سيف؟\n⏳ الوقت: ${GUESS_TIME / 60000} دقائق\n🎁 الفائز ↞ +10 نقاط»`, 'للتخمين اكتب اسم الشخصية مباشرة في الشات'));
    const anime = GUESS_ANIME[ch.anime]?.ar || '';
    g.timer2 = setTimeout(async () => {
        if (games.get(from) !== g || g.solved) return;
        await say(g, `💡 *تلميح:* اسم الأنمي يبدأ بحرف ${bt([...anime][0] || '؟')}`);
    }, 2 * 60 * 1000);
    g.timer3 = setTimeout(async () => {
        if (games.get(from) !== g || g.solved) return;
        await say(g, `💡 *تلميح:* الشخصية ${ch.g === 'f' ? 'أنثى 👩' : 'ذكر 👨'}`);
    }, 4 * 60 * 1000);
    g.timer = setTimeout(async () => {
        if (games.get(from) !== g || g.solved) return;
        g.solved = true;
        endGame(g);
        await sendAnswerForm(g, `⏰ *انتهى الوقت!*\n✅ الشخصية: ${bt(ch.ar[0] || ch.en[0])} من أنمي ${anime}`, null, [], false);
    }, GUESS_TIME);
}
async function guessAnswer(g, ctx) {
    if (g.solved) return false;
    const text = String(ctx.trimmedBody || '');
    const asked = guessIsAsk(text);
    // تخمين مباشر بالاسم (رسالة قصيرة بدون «هل»)
    let verdict = null;
    if (!asked) {
        if (text.length <= 40 && matches(text, g.answers, false)) verdict = 'win';
        else if (/[؟?]\s*$/.test(text)) { verdict = guessEval(g.ch, text); if (verdict === 'unknown') return false; }
        else return false;
    } else verdict = guessEval(g.ch, text);
    g.q++;
    if (verdict === 'win') {
        g.solved = true; clearTimeout(g.timer); clearTimeout(g.timer2); clearTimeout(g.timer3);
        await g.bank?.add(ctx.sender, 10);
        endGame(g);
        const wj = await realMentionJid(ctx);
        await sendAnswerForm(g, box('🎉', 'إِجَـابَـةٌ صَـحِـيـحَـة', `«👤 الفائز ↞ ${tag(wj)}\n✅ الشخصية ↞ ${g.ch.ar[0] || g.ch.en[0]} (${GUESS_ANIME[g.ch.anime]?.ar || ''})\n❓ عدد الأسئلة ↞ ${g.q}\n🎁 +10 نقاط»`, 'عبقري أنمي!'), null, [wj]);
        return true;
    }
    if (verdict === 'unknown') {
        if (Date.now() - g.lastConf < 15000) return true;
        g.lastConf = Date.now();
        await g.sock.sendMessage(g.from, { text: '🤔 ما فهمت سؤالك! اسأل عن: *الأنمي* (هل من ون بيس؟) • *الجنس* (هل هو ولد؟) • *لون الشعر* (هل شعره أسود؟) • *الصفات* (هل هو شرير؟ / هل يستخدم سيف؟ / هل هو نينجا؟)' }, { quoted: ctx.msg }).catch(() => null);
        return true;
    }
    await g.sock.sendMessage(g.from, { text: verdict === 'true' ? '✅ *صح*' : '❌ *غلط*' }, { quoted: ctx.msg }).catch(() => null);
    return true;
}

// ================================================================ المعالجات الرئيسية
// ردود نصية عادية (بدون نقطة): إجابات الجولات، حركات XO، تخمين الدخيل
export async function handleAnimeAnswer(ctx) {
    const g = games.get(ctx.from);
    if (!g) return false;
    const text = ctx.trimmedBody;
    if (g.type === 'guess') return guessAnswer(g, ctx);
    if (g.type === 'xo' && g.phase === 'play') return xoMove(g, ctx);
    if ((g.type === 'quiz' || g.type === 'emoji') && g.cur && !g.solved) {
        if (!matches(text, g.cur.a)) return false;
        g.solved = true; clearTimeout(g.timer);
        g.scores[ctx.sender] = (g.scores[ctx.sender] || 0) + 1;
        await g.bank?.add(ctx.sender, 2);
        const wj = await realMentionJid(ctx);
        await say(g, box('✅', 'إِجَـابَـةٌ صَـحِـيـحَـة', `«👤 الفائز ↞ ${tag(wj)}\n💡 الإجابة ↞ ${g.cur.a[0]}\n🎁 +2 نقطة»`, `رصيد الجولات: ${g.scores[ctx.sender]}`), [wj]);
        g.timer2 = setTimeout(() => nextRound(g), 2500);
        return true;
    }
    if (g.type === 'char' && !g.solved) {
        if (!matches(text, g.answers, g.ch.exact)) return false;
        g.solved = true; clearTimeout(g.timer); clearTimeout(g.timer2);
        await g.bank?.add(ctx.sender, 10);
        endGame(g);
        const wj = await realMentionJid(ctx);
        await sendAnswerForm(g, box('🎉', 'إِجَـابَـةٌ صَـحِـيـحَـة', `«👤 الفائز ↞ ${tag(wj)}\n✅ الشخصية ↞ ${g.ch.ar[0]} (${g.ch.anime})\n🎁 +10 نقاط»`, 'عبقري أنمي!'), g.mode === 'blur' ? g.imgs[0] : null, [wj]);
        return true;
    }
    return false;
}

// أوامر الخاص: أدوار المافيا، اختيارات التحدي، إعادة إرسال الدور
export async function handleAnimePrivate(ctx) {
    const base = ctx.cmdBase;
    if (!PRIVATE_NAMES.has(base)) return false;
    const ids = idsOf(ctx);
    if (['قتل', 'حماية', 'حمايه', 'فحص'].includes(base)) {
        const g = [...games.values()].find((x) => x.type === 'mafia' && x.players.some((p) => hasId(p, ids)));
        if (!g) { await ctx.sock.sendMessage(ctx.from, { text: '📌 لا توجد لعبة مافيا جارية وأنت ضمن لاعبيها.' }); return true; }
        const p = g.players.find((x) => hasId(x, ids));
        p.dm = ctx.from;
        await mafiaNightAction(ctx, g, p, base);
        return true;
    }
    if (base === 'دوري') { await myRoleCommand(ctx); return true; }
    // حجر / ورقة / مقص في الخاص: اختيار تحدٍّ
    const d = [...duels.values()].find((x) => hasId(x.a, ids) || hasId(x.b, ids));
    if (!d) { await ctx.sock.sendMessage(ctx.from, { text: '📌 لا يوجد تحدٍّ جارٍ باسمك. ابدأ واحداً في المجموعة: .حجر @منشن' }); return true; }
    await rpsDuelChoice(ctx, d, hasId(d.a, ids) ? 'a' : 'b');
    return true;
}

// أوامر المجموعات
export async function handleAnimeCommand(ctx) {
    const { sock, from, cmdBase: base } = ctx;
    if (!NAMES.includes(base)) return false;
    ctx.cmd = ctx.cmd || base;
    let args = ctx.cmd.slice(base.length).trim();
    if (/(^|\s)next$/i.test(args)) { ctx.nextTap = true; args = args.replace(/(^|\s)next$/i, '').trim(); }
    try {
        switch (base) {
            case 'مافيا': await openLobby(ctx, 'mafia'); return true;
            case 'برا': case 'برا_السالفة': case 'برا_السالفه': await openLobby(ctx, 'bara'); return true;
            case 'سالفة': await baraPick(ctx, args); return true;
            case 'انضم': await joinCommand(ctx); return true;
            case 'ابدا': await startCommand(ctx); return true;
            case 'لاعبين': await playersCommand(ctx); return true;
            case 'صوت': await voteCommand(ctx); return true;
            case 'دوري': await myRoleCommand(ctx); return true;
            case 'قتل': case 'حماية': case 'حمايه': case 'فحص':
                await sock.sendMessage(from, { text: '🔒 أوامر الليل تُرسل في *خاص البوت* وليس هنا حتى لا ينكشف دورك!' }); return true;
            case 'مسابقة': case 'مسابقه': {
                const n = Math.min(15, Math.max(3, parseInt(toEn(args), 10) || 5));
                await startRounds(ctx, 'quiz', QUIZ, n, (c) => box('🧠', 'مُـسَـابَـقَـةُ الأَنْـمِـي', `«🎯 عدد الجولات ↞ ${c}\n⏳ وقت الجولة ↞ 20 ثانية\n🎁 كل إجابة صحيحة ↞ +2 نقطة\n🏆 المتصدر يحصل على +10 إضافية»`, 'أسئلة أنمي — الأسرع يفوز!'));
                return true;
            }
            case 'خمن_ايموجي': case 'خمن_الايموجي': {
                const n = Math.min(10, Math.max(3, parseInt(toEn(args), 10) || 5));
                await startRounds(ctx, 'emoji', EMOJI_PUZZLES, n, (c) => box('🎭', 'خَـمِّـنِ الأَنْـمِـي بِـالإِيـمُـوجِـي', `«🎯 عدد الجولات ↞ ${c}\n⏳ وقت الجولة ↞ 25 ثانية\n🎁 كل إجابة صحيحة ↞ +2 نقطة»`, 'اكتب اسم الأنمي كما تعرفه'));
                return true;
            }
            case 'قنبلة': case 'قنبله': await bombStart(ctx); return true;
            case 'مرر': await bombPass(ctx); return true;
            case 'سلوت': await slotCommand(ctx); return true;
            case 'قلب': case 'قلب_عملة': case 'قلب_عمله': await coinCommand(ctx); return true;
            case 'نرد': await diceCommand(ctx); return true;
            case 'عجلة': case 'عجله': await wheelCommand(ctx); return true;
            case 'حجر': case 'ورقة': case 'ورقه': case 'مقص': await rpsCommand(ctx); return true;
            case 'اكس_او': case 'xo': await xoOpen(ctx); return true;
            case 'خمن_الشخصية': case 'خمن_الشخصيه': await charGame(ctx, 'blur'); return true;
            case 'معرفة_الشخصية': case 'معرفه_الشخصيه': await charGame(ctx, 'album'); return true;
            case 'احزر': await guessStart(ctx); return true;
            case 'عين': if (args) await eyeBrowse(ctx, args); else await charGame(ctx, 'eyes'); return true;
            case 'انهاء_اللعبة': case 'انهاء_لعبة': case 'انهاء_اللعبه': {
                const g = games.get(from);
                if (!g) return sock.sendMessage(from, { text: '📌 لا توجد لعبة لإنهائها.' }).then(() => true);
                if (!isHostOrAdmin(ctx, g)) { await sock.sendMessage(from, { text: '❌ الإنهاء للمضيف أو المشرفين فقط!' }); return true; }
                endGame(g);
                await sock.sendMessage(from, { text: '🚪 *تم إنهاء اللعبة بنجاح!*' });
                return true;
            }
            default: return false;
        }
    } catch (e) {
        console.error('خطأ ألعاب الأنمي:', e?.message || e);
        await sock.sendMessage(from, { text: '❌ حدث خطأ غير متوقع في اللعبة، حاول مجدداً.' }).catch(() => {});
        return true;
    }
}
