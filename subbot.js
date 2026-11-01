// ============ نظام التنصيب (بوتات فرعية) - الحد الأقصى 10 ============
import fs from 'fs';
import path from 'path';
import { sendSectionWithButtons } from './menu.js';

const MAX_SUBBOTS = 10;
const SESSIONS_DIR = './subbots_sessions';
const LIST_FILE = './subbots.json';
const PAIR_TIMEOUT_MS = 3 * 60 * 1000; // مهلة إدخال الكود: 3 دقائق

let startBotFn = null;
const subs = new Map(); // الرقم -> بيانات البوت الفرعي

// ----- إعدادات كل بوت منصّب (الوضع + المشرفون) تُحفظ في ملف مستقل
const SETTINGS_FILE = './subbots_settings.json';
let settingsStore = {};
try { settingsStore = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {}; } catch (e) { settingsStore = {}; }

function saveSettings() {
    try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsStore)); } catch (e) {}
}

function getSettings(number) {
    if (!settingsStore[number]) settingsStore[number] = { mode: 'public', mods: [] };
    const st = settingsStore[number];
    if (st.mode !== 'private') st.mode = 'public';
    if (!Array.isArray(st.mods)) st.mods = [];
    return st;
}

const ownerOf = (sock) => (sock?.user?.id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

// يستخرج الرقم الحقيقي من معرّف (يدعم @lid)
async function numberOfJid(sock, msg, jid, useMsgKeys = false) {
    const pnOf = (j) => (typeof j === 'string' && j.endsWith('@s.whatsapp.net')) ? j.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '';
    let num = pnOf(jid);
    if (num) return num;
    if (useMsgKeys) {
        const k = msg?.key || {};
        for (const j of [k.participantPn, k.participantAlt, k.senderPn, k.remoteJidAlt, msg?.participant_pn]) {
            num = pnOf(j);
            if (num) return num;
        }
    }
    try {
        const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid);
        return pnOf(pn) || String(pn || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    } catch (e) { return ''; }
}

function fmtDuration(ms) {
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d) return `${d} يوم و${h % 24} ساعة`;
    if (h) return `${h} ساعة و${m % 60} دقيقة`;
    return `${m} دقيقة`;
}

// يُستدعى من index.js: هل يتجاهل هذا البوت المنصّب المرسل لأن الوضع «خاص»؟
export async function isSubBotPrivateBlocked({ sock, msg, sender, isFromMe }) {
    try {
        if (!sock?.isSubBot) return false;
        const owner = ownerOf(sock);
        const st = getSettings(owner);
        if (st.mode !== 'private') return false;
        if (isFromMe) return false;
        const num = await numberOfJid(sock, msg, sender, true);
        if (num && (num === owner || st.mods.includes(num))) return false;
        return true;
    } catch (e) { return false; }
}

function saveList() {
    try { fs.writeFileSync(LIST_FILE, JSON.stringify([...subs.values()].filter(e => e.connected).map(e => e.number))); } catch (e) {}
}

function readList() {
    try { return JSON.parse(fs.readFileSync(LIST_FILE, 'utf8')); } catch (e) { return []; }
}

// تشغيل بوت فرعي. opts: { onCode, onConnected, onFail, onTimeout }
function launch(number, opts = {}) {
    const dir = path.join(SESSIONS_DIR, number);
    const isNew = !fs.existsSync(path.join(dir, 'creds.json'));
    fs.mkdirSync(dir, { recursive: true });

    const entry = {
        number, dir, stopped: false, connected: false, sock: null, codeRequested: false, timer: null,

        // يستدعيها startBot كل مرة ينشئ فيها اتصالاً
        onSock(sock) {
            entry.sock = sock;
            sock.ev.on('connection.update', ({ connection }) => {
                if (connection === 'open' && !entry.connected) {
                    entry.connected = true;
                    entry.connectedAt = Date.now();
                    clearTimeout(entry.timer);
                    saveList();
                    if (opts.onConnected) opts.onConnected();
                }
            });
            if (isNew && !entry.codeRequested) {
                entry.codeRequested = true;
                requestCode(entry, sock, opts);
            }
        },

        // إذا فصل المستخدم الجهاز من هاتفه
        onLoggedOut() { removeSub(number); }
    };

    subs.set(number, entry);

    if (isNew) {
        entry.timer = setTimeout(async () => {
            if (!entry.connected) {
                await removeSub(number);
                if (opts.onTimeout) opts.onTimeout();
            }
        }, PAIR_TIMEOUT_MS);
    }

    startBotFn(dir, entry);
    return entry;
}

async function requestCode(entry, sock, opts) {
    for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 3000));
        if (entry.stopped) return;
        try {
            let code = await sock.requestPairingCode(entry.number);
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            if (opts.onCode) opts.onCode(code);
            return;
        } catch (e) {
            if (i === 2) {
                await removeSub(entry.number);
                if (opts.onFail) opts.onFail(e);
            }
        }
    }
}

async function removeSub(number) {
    const entry = subs.get(number);
    if (!entry) return false;
    entry.stopped = true;
    clearTimeout(entry.timer);
    subs.delete(number);
    try { if (entry.connected && entry.sock) await entry.sock.logout(); } catch (e) {}
    try { entry.sock?.end?.(undefined); } catch (e) {}
    try { entry.sock?.ws?.close(); } catch (e) {}
    try { fs.rmSync(entry.dir, { recursive: true, force: true }); } catch (e) {}
    if (settingsStore[number]) { delete settingsStore[number]; saveSettings(); }
    saveList();
    return true;
}

// تُستدعى مرة واحدة من index.js بعد تشغيل البوت الرئيسي: تعيد تشغيل البوتات المحفوظة
export function initSubBots(startBot) {
    startBotFn = startBot;
    readList().forEach((number, i) => {
        if (!fs.existsSync(path.join(SESSIONS_DIR, number, 'creds.json'))) return;
        setTimeout(() => { if (!subs.has(number)) launch(number); }, 10000 + i * 5000);
    });
}

const SECTION_TEXT =
`📲 *12. التنصيب (بوت خاص بك):*

> 📥 \`.تنصيب\` ↞ يرسل لك كود ربط لرقمك
> 🗑️ \`.الغاء_تنصيب\` ↞ للمطور فقط (رقم أو «الكل»)
> 📋 \`.قائمة_التنصيب\` ↞ عرض البوتات المنصّبة (للمطور)

*طريقة التنصيب:*
1️⃣ أرسل \`.تنصيب\` للبوت في الخاص
2️⃣ سيصلك كود من 8 خانات
3️⃣ واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف
4️⃣ أدخل الكود خلال 3 دقائق وانتظر رسالة النجاح

⚠️ الحد الأقصى للبوتات المنصّبة: ${MAX_SUBBOTS}`;

const SECTION16_TEXT =
`🔧 *16. الفرعي (التحكم ببوتك المنصّب):*

> 📊 \`.حالة_بوتي\` ↞ حالة بوتك ومدة تشغيله
> 🔄 \`.اعادة_تشغيل\` ↞ إعادة تشغيل بوتك أنت فقط
> 🗑️ \`.حذف_بوتي\` ↞ حذف بوتك نهائياً (يطلب تأكيداً)
> 🔒 \`.وضع_خاص\` ↞ البوت لك وللمشرفين الذين حددتهم فقط
> 🌐 \`.وضع_عام\` ↞ البوت للجميع
> 👥 \`.مشرف_بوتي <رقم>\` ↞ إضافة مشرف (أو بالرد على رسالته / منشنه)
> ➖ \`.مشرف_بوتي حذف <رقم>\` ↞ إزالة مشرف
> 📋 \`.مشرف_بوتي\` ↞ عرض المشرفين

*ملاحظات:*
• أوامر هذا القسم تعمل من داخل بوتك المنصّب فقط.
• قسم الفرعي وكل أوامره لصاحب البوت والمطور فقط.
• في الوضع الخاص يتجاهل البوت أي شخص غير صاحبه ومشرفيه.
• دور المشرف الوحيد: أن يستجيب له البوت في الوضع الخاص.`;

const SUB_ONLY = ['حالة_بوتي', 'حذف_بوتي', 'مشرف_بوتي'];
const SUB_OVERRIDE = ['وضع_خاص', 'وضع_عام', 'اعادة_تشغيل'];   // موجودة أصلاً للبوت الرئيسي: نعترضها داخل البوت المنصّب فقط

// أوامر قسم «الفرعي». ترجع true إذا عالجت الأمر
async function handleSub16({ sock, msg, from, sender, cmd, cmdBase, isDev }) {
    const reply = (text, mentions) => sock.sendMessage(from, { text, ...(mentions ? { mentions } : {}) }, { quoted: msg });

    // داخل البوت المنصّب: قسم الفرعي وأوامره لصاحب البوت والمطور فقط (المشرفون وظيفتهم الاستجابة في الوضع الخاص فقط)
    let senderNum = '', isOwner = true;
    if (sock.isSubBot) {
        const ownerNum = ownerOf(sock);
        senderNum = msg.key?.fromMe ? ownerNum : await numberOfJid(sock, msg, sender, true);
        isOwner = isDev || (!!senderNum && senderNum === ownerNum);
    }

    if (cmdBase === '16' || cmdBase === 'الفرعي') {
        if (sock.isSubBot && !isOwner) { await reply('❌ هذا القسم لصاحب البوت والمطور فقط.'); return true; }
        if (!(await sendSectionWithButtons(sock, from, SECTION16_TEXT, null, sender))) await reply(SECTION16_TEXT);
        return true;
    }

    const isNew = SUB_ONLY.includes(cmdBase);
    const isOverride = SUB_OVERRIDE.includes(cmdBase) && sock.isSubBot;
    if (!isNew && !isOverride) return false;

    if (!sock.isSubBot) {
        await reply('⚠️ أوامر هذا القسم تعمل من داخل بوتك المنصّب فقط.\nأرسل `.تنصيب` لتنصيب بوتك.');
        return true;
    }

    const owner = ownerOf(sock);
    const st = getSettings(owner);
    const entry = subs.get(owner);

    if (cmdBase === 'حالة_بوتي') {
        if (!isOwner) { await reply('❌ هذا الأمر لصاحب البوت والمطور فقط.'); return true; }
        const up = entry?.connectedAt ? fmtDuration(Date.now() - entry.connectedAt) : 'غير معروف';
        await reply(`📊 *حالة بوتك:*\n\n> 📱 الرقم: ${owner}\n> 🟢 الحالة: يعمل\n> ⏱️ مدة التشغيل: ${up}\n> ${st.mode === 'private' ? '🔒 الوضع: خاص' : '🌐 الوضع: عام'}\n> 👥 عدد المشرفين: ${st.mods.length}`);
        return true;
    }

    if (!isOwner) { await reply('❌ هذا الأمر لصاحب البوت والمطور فقط.'); return true; }

    if (cmdBase === 'وضع_خاص') {
        st.mode = 'private'; saveSettings();
        await reply('🔒 تم تفعيل *الوضع الخاص*.\nبوتك الآن يستجيب لك ولمشرفيك فقط' + (st.mods.length ? ` (${st.mods.length} مشرف).` : '.\nلإضافة مشرف: `.مشرف_بوتي <رقم>`'));
        return true;
    }

    if (cmdBase === 'وضع_عام') {
        st.mode = 'public'; saveSettings();
        await reply('🌐 تم تفعيل *الوضع العام*.\nبوتك الآن يستجيب للجميع.');
        return true;
    }

    if (cmdBase === 'اعادة_تشغيل') {
        await reply('🔄 جاري إعادة تشغيل بوتك... سيعود خلال ثوانٍ.');
        if (entry) entry.connectedAt = Date.now();
        setTimeout(() => { try { sock.end(new Error('restart')); } catch (e) {} }, 1500);
        return true;
    }

    if (cmdBase === 'حذف_بوتي') {
        const arg = cmd.split(' ').slice(1).join(' ').trim();
        if (arg !== 'تأكيد' && arg !== 'تاكيد') {
            await reply('⚠️ سيتم فصل بوتك وحذف جلسته نهائياً.\nللتأكيد اكتب: `.حذف_بوتي تأكيد`');
            return true;
        }
        await reply('🗑️ تم حذف بوتك. يمكنك التنصيب من جديد بـ `.تنصيب` من البوت الرئيسي.');
        setTimeout(() => { removeSub(owner); }, 1500);
        return true;
    }

    // ----- مشرف_بوتي
    const args = cmd.split(' ').slice(1).join(' ').trim();
    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    const isRemove = /^(حذف|ازالة|إزالة|ازاله)(\s|$)/.test(args.replace(/[أإآا]/g, 'ا')) || /^(حذف|ازالة|ازاله)(\s|$)/.test(args);
    const digits = args.replace(/^(حذف|ازالة|إزالة|ازاله)/, '').replace(/[^0-9]/g, '');
    let target = '';
    if (/^\d{8,15}$/.test(digits)) target = digits;
    else if (ctx.mentionedJid?.length) target = await numberOfJid(sock, msg, ctx.mentionedJid[0]);
    else if (ctx.participant) target = await numberOfJid(sock, msg, ctx.participant);

    if (!target) {
        if (args && !/^(حذف|ازالة|إزالة|ازاله)$/.test(args)) { await reply('⚠️ اكتب الرقم مع رمز الدولة، أو رد على رسالة الشخص، أو اعمل له منشن.\nمثال: `.مشرف_بوتي 962791234567`'); return true; }
        if (isRemove) { await reply('⚠️ حدد من تريد إزالته: `.مشرف_بوتي حذف 962791234567` أو بالرد/المنشن.'); return true; }
        const list = st.mods.length ? st.mods.map((n, i) => `> ${i + 1}. ${n}`).join('\n') : '> لا يوجد مشرفون حالياً';
        await reply(`👥 *مشرفو بوتك (${st.mods.length}):*\n\n${list}\n\nللإضافة: \`.مشرف_بوتي <رقم>\`\nللحذف: \`.مشرف_بوتي حذف <رقم>\``);
        return true;
    }

    if (target === owner) { await reply('⚠️ هذا رقمك أنت، أنت صاحب البوت أصلاً.'); return true; }

    if (isRemove) {
        if (!st.mods.includes(target)) { await reply('⚠️ هذا الرقم ليس ضمن مشرفيك.'); return true; }
        st.mods = st.mods.filter(n => n !== target); saveSettings();
        await reply(`➖ تمت إزالة ${target} من مشرفي بوتك.`);
        return true;
    }

    if (st.mods.includes(target)) { await reply('⚠️ هذا الرقم مضاف مسبقاً كمشرف.'); return true; }
    if (st.mods.length >= 20) { await reply('❌ الحد الأقصى للمشرفين 20.'); return true; }
    st.mods.push(target); saveSettings();
    await reply(`✅ تمت إضافة ${target} كمشرف على بوتك.\nيستطيع استخدام البوت حتى في الوضع الخاص.`);
    return true;
}

// ترجع true إذا عالجت الأمر. تُستدعى من index.js
export async function handleSubBotCommand({ sock, msg, from, sender, cmd, cmdBase, isDev }) {
    if (await handleSub16({ sock, msg, from, sender, cmd, cmdBase, isDev })) return true;

    const isTansib = cmdBase === 'تنصيب';
    const isCancel = cmdBase === 'الغاء_تنصيب';
    const isList = cmdBase === 'قائمة_التنصيب';
    const isSection = cmdBase === '12';
    if (!isTansib && !isCancel && !isList && !isSection) return false;

    const reply = (text, mentions) => sock.sendMessage(from, { text, ...(mentions ? { mentions } : {}) }, { quoted: msg });

    if (isSection) { if (!(await sendSectionWithButtons(sock, from, SECTION_TEXT, null, sender))) await reply(SECTION_TEXT); return true; }

    // التنصيب يعمل من البوت الرئيسي فقط (يمنع التنصيب المتسلسل)
    if (sock.isSubBot) {
        await reply('⚠️ التنصيب متاح من البوت الرئيسي فقط.');
        return true;
    }

    if (isList) {
        if (!isDev) { await reply('❌ هذا الأمر مخصص للمطور فقط!'); return true; }
        if (subs.size === 0) { await reply(`📋 لا توجد بوتات منصّبة حالياً.\n🔢 المتاح: ${MAX_SUBBOTS}`); return true; }
        const lines = [...subs.values()].map((e, i) => `> ${i + 1}. ${e.number} ${e.connected ? '🟢 يعمل' : '🟡 بانتظار الربط'}`);
        await reply(`📋 *البوتات المنصّبة (${subs.size}/${MAX_SUBBOTS}):*\n\n${lines.join('\n')}`);
        return true;
    }

    // تحديد الرقم: العضو العادي رقمه فقط، والمطور يقدر يكتب رقماً
    const argNum = cmd.split(' ').slice(1).join('').replace(/[^0-9]/g, '');
    // رقم صاحب الطلب: من المعرّف المباشر، وإن كان @lid (مجموعات/حسابات جديدة) نأخذ رقمه الحقيقي من بيانات الرسالة
    const pnOf = (j) => (typeof j === 'string' && j.endsWith('@s.whatsapp.net')) ? j.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '';
    let senderNum = pnOf(sender);
    if (!senderNum) {
        const k = msg.key || {};
        for (const j of [k.participantPn, k.participantAlt, k.senderPn, k.remoteJidAlt, msg.participant_pn]) {
            senderNum = pnOf(j);
            if (senderNum) break;
        }
    }
    if (!senderNum) {
        try {
            const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(sender);
            senderNum = pnOf(pn) || String(pn || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        } catch (e) {}
    }
    let number = argNum;
    if (senderNum && (!isDev || !argNum)) number = senderNum;

    if (isCancel) {
        if (!isDev) { await reply('❌ هذا الأمر مخصص للمطور فقط!'); return true; }
        const rawArg = cmd.split(' ').slice(1).join(' ').trim();
        if (['الكل', 'الجميع', 'all', '*'].includes(rawArg.toLowerCase())) {
            const all = [...subs.keys()];
            if (!all.length) { await reply('📋 لا توجد بوتات منصّبة لحذفها.'); return true; }
            for (const n of all) await removeSub(n);
            await reply(`🗑️ تم إلغاء جميع التنصيبات (${all.length}).`);
            return true;
        }
        if (!/^\d{8,15}$/.test(number) || !subs.has(number)) { await reply('⚠️ لا يوجد بوت منصّب على هذا الرقم.'); return true; }
        await removeSub(number);
        await reply(`🗑️ تم حذف البوت الخاص بالرقم ${number}.`);
        return true;
    }

    // ----- تنصيب -----
    if (!/^\d{8,15}$/.test(number)) {
        await reply('⚠️ اكتب الأمر مع رقمك وبرمز الدولة، مثال:\n`.تنصيب 962791234567`');
        return true;
    }
    const mainNum = (sock.user?.id || '').split(':')[0].split('@')[0];
    if (number === mainNum) { await reply('⚠️ هذا هو رقم البوت الرئيسي نفسه.'); return true; }

    const existing = subs.get(number);
    if (existing) {
        await reply(existing.connected
            ? '✅ بوتك منصّب ويعمل بالفعل.\nلحذفه تواصل مع المطور.'
            : '⏳ لديك محاولة ربط جارية، أدخل الكود الذي وصلك أو انتظر انتهاء مهلته (3 دقائق).');
        return true;
    }
    if (subs.size >= MAX_SUBBOTS) {
        await reply(`❌ تم الوصول للحد الأقصى من البوتات المنصّبة (${MAX_SUBBOTS}). حاول لاحقاً.`);
        return true;
    }

    await reply(`⏳ جاري تجهيز بوت للرقم ${number}...`);
    launch(number, {
        onCode: async (code) => {
            await sock.sendMessage(from, {
                text: `🔑 *كود الربط الخاص بك:*\n\nواتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف ثم أدخل الكود.\n⏱️ صلاحيته 3 دقائق.\n\n👇 الكود:`
            }, { quoted: msg });
            await sock.sendMessage(from, { text: code });
        },
        onConnected: () => sock.sendMessage(from, { text: `✅ تم تنصيب البوت بنجاح على الرقم ${number}!\nاكتب \`.بوت\` من حسابك لتجربته.\nلحذفه تواصل مع المطور.` }, { quoted: msg }).catch(() => {}),
        onFail: () => sock.sendMessage(from, { text: '❌ تعذر الحصول على كود الربط. تأكد من الرقم وحاول مرة أخرى.' }, { quoted: msg }).catch(() => {}),
        onTimeout: () => sock.sendMessage(from, { text: '⌛ انتهت مهلة الربط. أرسل `.تنصيب` للمحاولة من جديد.' }, { quoted: msg }).catch(() => {})
    });
    return true;
}
