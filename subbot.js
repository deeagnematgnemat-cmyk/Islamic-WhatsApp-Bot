// ============ نظام التنصيب (بوتات فرعية) - الحد الأقصى 10 ============
import fs from 'fs';
import path from 'path';

const MAX_SUBBOTS = 10;
const SESSIONS_DIR = './subbots_sessions';
const LIST_FILE = './subbots.json';
const PAIR_TIMEOUT_MS = 3 * 60 * 1000; // مهلة إدخال الكود: 3 دقائق

let startBotFn = null;
const subs = new Map(); // الرقم -> بيانات البوت الفرعي

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

// ترجع true إذا عالجت الأمر. تُستدعى من index.js
export async function handleSubBotCommand({ sock, msg, from, sender, cmd, cmdBase, isDev }) {
    const isTansib = cmdBase === 'تنصيب';
    const isCancel = cmdBase === 'الغاء_تنصيب';
    const isList = cmdBase === 'قائمة_التنصيب';
    const isSection = cmdBase === '12';
    if (!isTansib && !isCancel && !isList && !isSection) return false;

    const reply = (text, mentions) => sock.sendMessage(from, { text, ...(mentions ? { mentions } : {}) }, { quoted: msg });

    if (isSection) { await reply(SECTION_TEXT); return true; }

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
    const senderNum = sender.endsWith('@s.whatsapp.net') ? sender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '';
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
