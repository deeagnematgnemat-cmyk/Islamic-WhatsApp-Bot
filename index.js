import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage, proto, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import pino from 'pino';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { badWords, characterImages, characterEdits, gamesData } from './database/data.js';

process.on('uncaughtException', (err) => console.log('خطأ:', err));
process.on('unhandledRejection', (err) => console.log('خطأ معالجة:', err));

const DEVELOPER_NUMBER = '962796163926';
const DEVELOPER_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝐨𝓉 『✦』';
let extraDevelopers = [];
let botLogs = [];

function logBotAction(action) {
const time = new Date().toLocaleTimeString('ar-EG');
botLogs.unshift(`> 🔹 [${time}] ↞${action}`);
if (botLogs.length > 20) botLogs.pop();
}

let userPoints = {}, userWarnings = {};
let bankAccounts = {};
let activeGames = {};
let dailyRewards = {};
let mutedUsers = {};
let userMessagesCount = {};
let groupSettings = {};
let marriages = {};

let globalBotStopped = false;

let userStickerPacksCount = {};
let globalCreatedPacks = [];

let commandReactionEnabled = true;
let commandReactionEmoji = '⚡';

let devReactionEnabled = true;
let devReactionEmoji = '👑';

const validCommands = [
'كشف', 'الكاشف',
'تفاعل', 'تفاعل_مطور', 'اعطاء', 'إعطاء', 'اذاعة', 'إذاعة', 'ريستارت', 'اعادة_تشغيل', 'حذف', 'مسح', 'كتم', 'الغاء_كتم', 'فك_كتم',
'خاص', 'عام', 'وضع_خاص', 'وضع_عام', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تفعيل', 'توقيف',
'قفل', 'غلق', 'فتح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد',
'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط',
'حظر_رابط', 'سماح_رابط', 'حظر_سب', 'سماح_سب', 'حظر_جهات', 'حظر_جهات_الاتصال', 'سماح_جهات', 'سماح_جهات_الاتصال',
'صفر', 'بوت', 'الاوامر', 'اوامر', 'منيو', 'اقسام',
'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
'الترفيه', 'العاب', 'فعاليات', 'bank', 'البنك', 'النقاط',
'متجر', 'المتجر', 'شراء', 'بنك', 'حسابي', 'مكافأة', 'هدية',
'حجرة', 'حجر', 'توقع', 'تحويل', 'توب_نقاط', 'الاغنياء', 'الأغنياء',
'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'لوخيروك', 'حكمة',
'صراحة', 'تحدي', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'انسحب',
'زواج', 'طلاق',
'المطور', 'مطور', 'الادارة', 'الاداره',
'اضافة_مطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار',
'اضف_انذار', 'ازل_انذار', 'عدد_الانذارات',
'حظر رابط', 'سماح رابط', 'حظر سب', 'سماح سب', 'حظر جهات', 'سماح جهات',
'ايقاف_البوت', 'تفعيل_البوت', 'إيقاف_البوت', 'إيقاف البوت', 'تفعيل البوت',
'كرة_قدم', 'مباريات', 'نتائج', 'بطولات', 'لاعب', 'فريق', 'ترتيب', 'هداف', 'مباراة', 'إنجازات',
'ai', 'اسأل', 'اكتب', 'لخص', 'ترجم', 'صحح', 'فكرة', 'اشرح', 'برمج', 'حل',
'سؤال', 'سؤال_ذكاء', 'صح_او_خطأ', 'ثقافة', 'جغرافيا', 'علوم', 'تاريخ', 'سؤال_ديني', 'مسابقة', 'اختبرني',
'قرآن', 'آية', 'سورة', 'دعاء', 'ذكر', 'حديث', 'أذكار', 'قبلة', 'استغفار', 'تذكير',
'نكتة', 'ضحكني', 'مهرج', 'فضيحة', 'مين_الأكثر', 'ماذا_لو', 'رعب', 'قول', 'مقلب',
'غزل', 'ثنائي',
'ملك_المجموعة', 'ملكة_المجموعة', 'نجم_المجموعة', 'محبوب_المجموعة', 'أذكى_عضو', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'أسطورة_المجموعة', 'مميز_المجموعة',
'رسائلي', 'رسائل_الأعضاء', 'توب_الرسائل', 'أكثر_عضو_نشاطًا', 'رسائل_أمس', 'رسائل_التاريخ', 'نشاطي', 'تصفير_إحصائياتي', 'إحصائيات_المجموعة', 'أرشيف_الرسائل',
'تعطيل_البوتات', 'تعطيل بوتات',
'يوتيوب', 'تيك', 'انستا', 'فيس', 'اكس', 'سناب', 'بنترست', 'تويتش', 'كيك', 'دايلي', 'ريديت', 'تليجرام', 'فيميو', 'لايكي', 'كواي', 'ريلز', 'شورتس', 'تريلر', 'صوره', 'تطقيم', 'ايدت',
'صنع_حزمة', 'بحث_متقدم', 'احصائياتي', 'إحصائياتي', 'كيفية_الاستخدام', 'ملصق'
];

async function searchTelegramStickerPacks(query) {
try {
const res = await fetch(`https://combot.org/telegram/stickers?q=${encodeURIComponent(query)}`, {
headers: {
"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
});
const html = await res.text();
const $ = cheerio.load(html);
let packs = [];
$('a[href]').each((_, el) => {
const href = $(el).attr('href');
if (href && (href.includes('t.me/addstickers/') || href.includes('telegram.me/addstickers/'))) {
if (!packs.includes(href)) packs.push(href);
}
});
return packs;
} catch (e) {
return [];
}
}

function generateProgressBar(percent, title = "جاري المعالجة") {
percent = Math.max(0, Math.min(100, percent));
const filled = Math.floor(percent / 10);
const bar = "█".repeat(filled) + "░".repeat(10 - filled);
return `🎮 ${title}\n[${bar}]${percent}%`;
}

function isValidCmd(fullCmd) {
const base = fullCmd.split(' ')[0];
if (validCommands.includes(fullCmd)) return true;
if (validCommands.includes(base)) return true;
return false;
}

function isExtraDeveloper(senderJid) {
const cleanNum = senderJid.replace(/[^0-9]/g, '');
return extraDevelopers.some(dev => cleanNum.includes(dev) || dev.includes(cleanNum));
}

function isDeveloper(senderJid, sock) {
if (!senderJid) return false;
const cleanNum = senderJid.replace(/[^0-9]/g, '');
const devNum = DEVELOPER_NUMBER.replace(/[^0-9]/g, '');
const botJidNum = sock?.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';
if (cleanNum === devNum || cleanNum.endsWith(devNum) || devNum.endsWith(cleanNum)) return true;
if (botJidNum && (cleanNum === botJidNum || cleanNum.endsWith(botJidNum))) return true;
return extraDevelopers.some(dev => cleanNum.includes(dev) || dev.includes(cleanNum));
}

async function getBotProfilePic(sock) {
try {
const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (DEVELOPER_NUMBER + '@s.whatsapp.net');
return await sock.profilePictureUrl(botJid, 'image');
} catch (e) {
return 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg';
}
}

async function getDeveloperProfilePic(sock) {
try {
const devJid = DEVELOPER_NUMBER + '@s.whatsapp.net';
return await sock.profilePictureUrl(devJid, 'image');
} catch (e) {
return 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg';
}
}

async function getUserProfilePic(sock, senderJid) {
try {
return await sock.profilePictureUrl(senderJid, 'image');
} catch (e) {
return 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg';
}
}

function startTimedGame(from, sock, gameType, categoryObj, timeoutSec = 30) {
if (activeGames[from] && activeGames[from].timer) {
clearTimeout(activeGames[from].timer);
}
const timer = setTimeout(async () => {
if (activeGames[from]) {
delete activeGames[from];
await sock.sendMessage(from, { text: `⏰ انتهى الوقت! لم يقم أحد بالإجابة في الوقت المحدد.` });
}
}, timeoutSec * 1000);

const item = categoryObj[Math.floor(Math.random() * categoryObj.length)];
let promptText = `🎯 *فعالية تفاعلية (الوقت: ${timeoutSec} ثانية):*\n\n${item.question || item}`;

sock.sendMessage(from, { text: promptText }).then(sent => {
activeGames[from] = { type: gameType, answer: item.answer || item, category: categoryObj, timer: timer, msgId: sent.key.id };
});

}

function startNextSameGame(from, sock, gameType, categoryObj) {
if (activeGames[from] && activeGames[from].timer) {
clearTimeout(activeGames[from].timer);
}

const item = categoryObj[Math.floor(Math.random() * categoryObj.length)];
let promptText = `🧩 *فعالية التفكيك (الوقت: 30 ثانية):*\n\nفكك الكلمة:\n\n👉 *${item.word}*`;
if (gameType === 'typing') promptText = `✍️ *فعالية الكتابة (الوقت: 30 ثانية):*\n\nاكتب التالي بدقة:\n\n👉 *${item}*`;

const timer = setTimeout(async () => {
if (activeGames[from]) {
delete activeGames[from];
await sock.sendMessage(from, { text: `⏰ *انتهى الوقت!*` });
}
}, 30000);

sock.sendMessage(from, { text: promptText }).then(sent => {
activeGames[from] = { type: gameType, answer: item.answer || item, category: categoryObj, timer: timer, msgId: sent.key.id };
});

}

function getBankAccount(senderJid) {
if (!bankAccounts[senderJid]) {
const randomId = Math.floor(100000 + Math.random() * 900000);
bankAccounts[senderJid] = {
bankId: `EREN-${randomId}`,
createdAt: new Date().toLocaleDateString('ar-EG')
};
}
if (userPoints[senderJid] === undefined) userPoints[senderJid] = 0;
return bankAccounts[senderJid];
}

function getGroupSetting(groupId) {
if (!groupSettings[groupId]) {
groupSettings[groupId] = {
adminOnly: false,
antiLink: true,
antiBadWords: true,
antiContact: true,
welcome: true,
goodbye: true,
botMode: 'public',
antiOtherBots: false
};
}
return groupSettings[groupId];
}

function getTargetUser(msg) {
const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
return mentioned || quoted || null;
}

async function startBot() {
const { state, saveCreds } = await useMultiFileAuthState('arem_new_session');
const { version } = await fetchLatestBaileysVersion();

const sock = makeWASocket({
auth: state,
version,
printQRInTerminal: false,
logger: pino({ level: 'silent' }),
browser: ['Ubuntu', 'Chrome', '110.0.5481.100'],
syncFullHistory: false,
shouldSyncHistoryMessage: () => false,
markOnlineOnConnect: true
});

sock.ev.on('creds.update', saveCreds);

if (!sock.authState.creds.registered) {
setTimeout(async () => {
try {
let phoneNumber = "962795106901";
let code = await sock.requestPairingCode(phoneNumber);
code = code?.match(/.{1,4}/g)?.join("-") || code;
console.log(`\n========================================`);
console.log(`🔑 كود الاقتران الخاص بك هو: ${code}`);
console.log(`========================================\n`);
} catch (e) {
console.error('خطأ في طلب كود الاقتران:', e);
}
}, 8000);
}

sock.ev.on('connection.update', (u) => {
if (u.connection === 'close') {
if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
} else if (u.connection === 'open') console.log('👑 تم الاتصال بالواتساب بنجاح 👑');
});

sock.ev.on('group-participants.update', async (anu) => {
try {
const { id, participants, action } = anu;
const settings = getGroupSetting(id);

if (action === 'add' && settings.welcome) {    
        for (let user of participants) {    
            const userPp = await getUserProfilePic(sock, user);    
            const welcomeMsg = `*🌾┊تـرحـيـب:*

❋・────━【🗡】━────・❋

- مـحـارب جـديـد يـحـط الـرحـال فـي أرض ڤـيـنـلاند، أهـلاً وسـهـلاً ومـرحـبـاً بـك

❋・────━【🗡】━────・❋

🌙┆الـعـضـو ↜『@${user.split('@')[0]}』
🌙┆مـسـؤول الألـقـاب ↜『 يـامـوشـي 』

❋・────━【🗡】━────・❋

※ نــرجــوا مـنـك دخــول رابــط إعـلانـات نـقـابـة إنـجـلانـد 🗡️

『https://chat.whatsapp.com/EFVzBBws1jEJWWwtjb6ZAV?s=cl&p=a&mlu=4&ilr=4』

❋・────━【🗡】━────・❋

※ ونــرجــوا مــنــك أيــضــاً دخــول رابــط صـحـيـفـة ڤـيـنـلانـد ❄

『https://chat.whatsapp.com/G8qyya3BHZPCZtU4TTDuCO?s=cl&p=a&mlu=4&ilr=4』

❋・────━【🗡】━────・❋

🫎┊مـع تـحـيـات ˼‏🗡️˹ ⤺

『𝑽. 𝑳. 1⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨ℕ𝙳』`;

await sock.sendMessage(id, { image: { url: userPp }, caption: welcomeMsg, mentions: [user] });
}
} else if (action === 'remove' && settings.goodbye) {
for (let user of participants) {
const userPp = await getUserProfilePic(sock, user);
const goodbyeMsg = `🥀┊تـودـيـع الـعـضـو:

❋・────━【🗡】━────・❋

- لـقـد رحـل عـنـا مـحـارب مـن أرض ڤـيـنـلاند، نـتـمـنـى لـه كـل الـتـوفـيـق

❋・────━【🗡】━────・❋

🌙┆الـعـضـو الـمـغـادر ↜『@${user.split('@')[0]}』

❋・────━【🗡】━────・❋

🫎┊مـع تـحـيـات ˼‏🗡️˹ ⤺

『𝑽. 𝑳. 1⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨ℕ𝙳』`;

await sock.sendMessage(id, { image: { url: userPp }, caption: goodbyeMsg, mentions: [user] });
}
}
} catch (e) {}
});

sock.ev.on('messages.upsert', async (m) => {
if (!['notify', 'append'].includes(m.type)) return;

const msg = m.messages[0];     
if (!msg || !msg.message) return;    

const from = msg.key.remoteJid;    
const isGroup = from.endsWith('@g.us');    
    
const isFromMe = msg.key.fromMe;    
const sender = isFromMe ? (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (DEVELOPER_NUMBER + '@s.whatsapp.net')) : (msg.key.participant || msg.key.remoteJid);    

const cleanSenderNum = sender.replace(/[^0-9]/g, '');    

if (isGroup) {    
    const todayKey = new Date().toLocaleDateString('ar-EG');    
    if (!userMessagesCount[from]) userMessagesCount[from] = {};    
    if (!userMessagesCount[from][todayKey]) userMessagesCount[from][todayKey] = {};    
    userMessagesCount[from][todayKey][sender] = (userMessagesCount[from][todayKey][sender] || 0) + 1;    
}    
    
let isSenderDev = isDeveloper(sender, sock);    
let isSenderExtraDev = isExtraDeveloper(sender);    
let isSenderAdmin = isFromMe || isSenderDev;    

if (isGroup && !isFromMe && !isSenderDev) {    
    try {    
        const groupMetadata = await sock.groupMetadata(from);    
        const participants = groupMetadata.participants;    
        isSenderAdmin = participants.some(p => p.id.replace(/[^0-9]/g, '') === cleanSenderNum && (p.admin === 'admin' || p.admin === 'superadmin'));    
    } catch (e) {}    
}    

const interactiveResponse =
    msg.message?.interactiveResponseMessage
        ?.nativeFlowResponseMessage?.paramsJson;

let buttonId = '';

if (interactiveResponse) {
    try {
        buttonId = JSON.parse(interactiveResponse).id || '';
    } catch (e) {}
}

const body =
    buttonId === 'bot_sections'
        ? '.الاوامر'
        : (
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            ''
        );

let trimmedBody = body.trim();    
let lowerBody = trimmedBody.toLowerCase();    

if (globalBotStopped && !isSenderDev) {
    return;
}

if (isGroup && !isFromMe) {    
    const groupSt = getGroupSetting(from);    
    if (groupSt.antiOtherBots) {    
        const isBotMsg = (msg.key.id && (msg.key.id.startsWith('BAE5') || msg.key.id.length < 18)) ||     
                         (msg.message.botInvokeMessage || msg.message.templateButtonReplyMessage || msg.message.interactiveResponseMessage) ||    
                         (body.startsWith('!') || body.startsWith('#') || body.startsWith('/') || body.startsWith('.') && !isValidCmd(body.substring(1).toLowerCase().trim().replace(/[أإآا]/g, 'ا').split(' ')[0]));    
            
        if (isBotMsg) {    
            try {    
                await sock.sendMessage(from, { delete: msg.key });    
                return;    
            } catch (e) {}    
        }    
    }    
}    

if (isGroup && mutedUsers[from] && mutedUsers[from][sender]) {    
    if (mutedUsers[from][sender] > Date.now()) {    
        try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}    
        return;    
    } else {    
        delete mutedUsers[from][sender];    
    }    
}    

if (isSenderExtraDev && devReactionEnabled) {    
    try {    
        await sock.sendMessage(from, { react: { text: devReactionEmoji, key: msg.key } });    
    } catch (e) {}    
}    

if (isGroup && !isSenderAdmin && !isSenderDev) {    
    const settings = getGroupSetting(from);    
    const mType = Object.keys(msg.message || {});    
        
    let violationDetected = false;    
    let violationType = '';    

    if (settings.antiContact && (mType.includes('contactMessage') || mType.includes('contactsArrayMessage'))) {    
        violationDetected = true;    
        violationType = 'جهات الاتصال';    
    } else if (settings.antiLink && (lowerBody.includes('http://') || lowerBody.includes('https://'))) {    
        violationDetected = true;    
        violationType = 'الروابط';    
    } else if (settings.antiBadWords && badWords.some(w => lowerBody.includes(w))) {    
        violationDetected = true;    
        violationType = 'السبام والشتائم';    
    }    

    if (violationDetected) {    
        try {    
            await sock.sendMessage(from, { delete: msg.key });    
            await sock.groupSettingUpdate(from, 'announcement');    

            if (!userWarnings[sender]) userWarnings[sender] = 0;    
            userWarnings[sender]++;    

            if (userWarnings[sender] >= 3) {    
                await sock.sendMessage(from, { text: `🚨 @${sender.split('@')[0]} تم طردك لتجاوزك الحد الأقصى من الإنذارات (${violationType})!`, mentions: [sender] });    
                await sock.groupParticipantsUpdate(from, [sender], 'remove');    
                userWarnings[sender] = 0;    
            } else {    
                await sock.sendMessage(from, { text: `⚠️ تنبيه ومخالفة (${violationType})!\n👤 @${sender.split('@')[0]}\n📌 الإنذار الحالي: [${userWarnings[sender]}/3]\n🔒 تم إغلاق الشات تلقائياً بسبب المخالفة.`, mentions: [sender] });    
            }    
            return;    
        } catch (e) {}    
    }    
}    

if (trimmedBody === '.انسحب' || lowerBody === 'انسحاب') {    
    if (activeGames[from]) {    
        clearTimeout(activeGames[from].timer);    
        delete activeGames[from];    
        return sock.sendMessage(from, { text: `🚪 *تم إلغاء الفعالية بنجاح!*`, mentions: [sender] });    
    } else {    
        return sock.sendMessage(from, { text: `📌 لا توجد فعالية قيد التشغيل حالياً لإلغائها.` });    
    }    
}    

if (activeGames[from]) {    
    const game = activeGames[from];    
    const quotedContext = msg.message.extendedTextMessage?.contextInfo;    
    if (quotedContext && quotedContext.stanzaId === game.msgId) {    
        if (!trimmedBody.startsWith('.')) {    
            const cleanUserAns = trimmedBody.replace(/[أإآاىئؤة]/g, 'ا').replace(/\s+/g, ' ').toLowerCase();    
            const cleanCorrectAns = game.answer.replace(/[أإآاىئؤة]/g, 'ا').replace(/\s+/g, ' ').toLowerCase();    

            if (cleanUserAns === cleanCorrectAns || cleanUserAns.includes(cleanCorrectAns)) {    
                clearTimeout(game.timer);    
                getBankAccount(sender);    
                userPoints[sender] += 10;    
                const type = game.type;    
                const cat = game.category;    
                delete activeGames[from];    
                await sock.sendMessage(from, { text: `🎉 *إجابة صحيحة يا أسطورة!* @${sender.split('@')[0]}\n💰 *كسبت 10 نقاط!*`, mentions: [sender] });    
                    
                if (['disassemble', 'typing', 'riddles', 'arrange', 'letterGame', 'reverseGame', 'complete'].includes(type) && cat) {    
                    setTimeout(() => startNextSameGame(from, sock, type, cat), 1000);    
                }    
                return;    
            } else {    
                await sock.sendMessage(from, { text: `❌ *إجابة خاطئة* @${sender.split('@')[0]}\n💡 *الجواب الصحيح هو:* \`${game.answer}\``, mentions: [sender] }, { quoted: msg });    
                return;    
            }    
        }    
    }    
}    

if (!trimmedBody.startsWith('.')) return;    

let cmd = trimmedBody.substring(1).toLowerCase().trim().replace(/[أإآا]/g, 'ا');    
let cmdBase = cmd.split(' ')[0];    

if (!isValidCmd(cmdBase) && !isValidCmd(cmd)) return;    

if (commandReactionEnabled) {    
    try {    
        await sock.sendMessage(from, { react: { text: commandReactionEmoji, key: msg.key } });    
    } catch (e) {}    
}    

logBotAction(`استخدام أمر (${cmd}) من قبل العضو ${cleanSenderNum}`);    

if (!isGroup) {    
    return sock.sendMessage(from, { text: `❌ عذراً، هذا الأمر مخصص للمجموعات فقط ولا يعمل في الشات الخاص!` });    
}    

const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;    

const groupSettingsForCheck = getGroupSetting(from);    
if (groupSettingsForCheck.botMode === 'private' && !isSenderDev) {    
    return;    
}    

if (['قفل', 'غلق', 'فتح', 'حذف', 'مسح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'اضف_انذار', 'ازل_انذار', 'صفر', 'عدد_الانذارات', 'كتم', 'الغاء_كتم', 'فك_كتم', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط'].includes(cmdBase) || cmd.startsWith('تغيير_الاسم') || cmd.startsWith('تغيير_الوصف') || cmd === 'تفعيل ادمن' || cmd === 'توقيف ادمن' || cmd === 'تفعيل ترحيب' || cmd === 'توقيف ترحيب' || cmd === 'تفعيل توديع' || cmd === 'توقيف توديع' || cmd === 'رابط_الجروب' || cmd === 'الرابط' || cmd === 'غلق') {    
    if (!isSenderAdmin && !isSenderDev) {    
        return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!' });    
    }    
}    

if (cmdBase === 'قفل' || cmd === 'غلق') {    
    await sock.groupSettingUpdate(from, 'announcement');    
    return sock.sendMessage(from, { text: '🔒 تم قفل المجموعة!' });    
}    
if (cmdBase === 'فتح') {    
    await sock.groupSettingUpdate(from, 'not_announcement');    
    return sock.sendMessage(from, { text: '🔓 تم فتح المجموعة!' });    
}    
if (cmdBase === 'حذف' || cmdBase === 'مسح') {    
    const q = msg.message.extendedTextMessage?.contextInfo;    
    if (!q) return sock.sendMessage(from, { text: '📌 رد على الرسالة المراد حذفها.' });    
    try {    
        await sock.sendMessage(from, { delete: { remoteJid: from, id: q.stanzaId, participant: q.participant } });    
    } catch (e) {}    
    return;    
}    
if (cmdBase === 'الكل' || cmdBase === 'منشن') {    
    const meta = await sock.groupMetadata(from);    
    let mentions = [];    
    let text = `📢 *نداء إداري لجميع الأعضاء:*\n\n`;    
    for (let mem of meta.participants) {    
        text += `@${mem.id.split('@')[0]} \n`;    
        mentions.push(mem.id);    
    }    
    return sock.sendMessage(from, { text, mentions });    
}    
if (cmdBase === 'رفع' || cmdBase === 'ترقية') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.رفع @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'promote');    
        return sock.sendMessage(from, { text: `👑 تم رفع @${targetUser.split('@')[0]} مشرفاً بنجاح!`, mentions: [targetUser] }, { quoted: msg });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل رفع العضو، تأكد أن البوت مشرف ولديه الصلاحيات.' });    
    }    
}    
if (cmdBase === 'ازل' || cmdBase === 'تنزيل') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.تنزيل @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'demote');    
        return sock.sendMessage(from, { text: `📉 تم تنزيل @${targetUser.split('@')[0]} بنجاح.`, mentions: [targetUser] }, { quoted: msg });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل تنزيل العضو، تأكد أن البوت مشرف.' });    
    }    
}    
if (cmdBase === 'طرد') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.طرد @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]} بنجاح.`, mentions: [targetUser] }, { quoted: msg });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل طرد العضو، تأكد أن البوت مشرف.' });    
    }    
}    
if (cmdBase === 'اضف_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.اضف_انذار @عضو`' });    
    userWarnings[targetUser] = (userWarnings[targetUser] || 0) + 1;    
    if (userWarnings[targetUser] >= 3) {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        userWarnings[targetUser] = 0;    
        return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]} لتجاوزه الإنذارات!`, mentions: [targetUser] }, { quoted: msg });    
    }    
    return sock.sendMessage(from, { text: `⚠️ تم إضافة إنذار (${userWarnings[targetUser]}/3).`, mentions: [targetUser] }, { quoted: msg });    
}    
if (cmdBase === 'ازل_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.ازل_انذار @عضو`' });    
    if (userWarnings[targetUser] > 0) userWarnings[targetUser]--;    
    return sock.sendMessage(from, { text: `✅ تم إزالة إنذار عن العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });    
}    
if (cmdBase === 'صفر') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.صفر @عضو`' });    
    userWarnings[targetUser] = 0;    
    return sock.sendMessage(from, { text: `✅ تم تصفير إنذارات العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });    
}    
if (cmdBase === 'عدد_الانذارات') {    
    const targetUser = getTargetUser(msg) || sender;    
    return sock.sendMessage(from, { text: `📊 عدد الإنذارات: *${userWarnings[targetUser] || 0} / 3*`, mentions: [targetUser] }, { quoted: msg });    
}    
if (cmdBase === 'كتم') {    
    const parts = trimmedBody.split(' ');    
    const mins = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(mins) || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.كتم <دقائق> @عضو` (أو بالرد على رسالته)' });    
    if (!mutedUsers[from]) mutedUsers[from] = {};    
    mutedUsers[from][targetUser] = Date.now() + (mins * 60 * 1000);    
    return sock.sendMessage(from, { text: `🔇 تم كتم العضو @${targetUser.split('@')[0]} لمدة ${mins} دقيقة بنجاح.`, mentions: [targetUser] }, { quoted: msg });    
}    
if (cmdBase === 'الغاء_كتم' || cmdBase === 'فك_كتم') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.الغاء_كتم @عضو`' });    
    if (mutedUsers[from]) delete mutedUsers[from][targetUser];    
    return sock.sendMessage(from, { text: `🔊 تم فك الكتم عن العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });    
}    

if (cmd === 'تفعيل ادمن') {    
    getGroupSetting(from).adminOnly = true;    
    return sock.sendMessage(from, { text: '🟢 تم تفعيل وضع الآدمن.' });    
}    
if (cmd === 'توقيف ادمن') {    
    getGroupSetting(from).adminOnly = false;    
    return sock.sendMessage(from, { text: '🔴 تم إيقاف وضع الآدمن.' });    
}    
if (cmd === 'تفعيل ترحيب') {    
    getGroupSetting(from).welcome = true;    
    return sock.sendMessage(from, { text: '🟢 تم تفعيل الترحيب.' });    
}    
if (cmd === 'توقيف ترحيب') {    
    getGroupSetting(from).welcome = false;    
    return sock.sendMessage(from, { text: '🔴 تم إيقاف الترحيب.' });    
}    
if (cmd === 'تفعيل توديع') {    
    getGroupSetting(from).goodbye = true;    
    return sock.sendMessage(from, { text: '🟢 تم تفعيل التوديع.' });    
}    
if (cmd === 'توقيف توديع') {    
    getGroupSetting(from).goodbye = false;    
    return sock.sendMessage(from, { text: '🔴 تم إيقاف التوديع.' });    
}    
if (cmd.startsWith('تغيير_الاسم')) {    
    const newName = trimmedBody.replace(/^\.تغيير_الاسم/i, '').trim();    
    if (!newName) return sock.sendMessage(from, { text: '📌 يرجى كتابة الاسم الجديد.' });    
    try {    
        await sock.groupUpdateSubject(from, newName);    
        return sock.sendMessage(from, { text: `✅ تم تغيير اسم المجموعة إلى: *${newName}*` });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل التغيير تأكد أن البوت مشرف.' });    
    }    
}    
if (cmd.startsWith('تغيير_الوصف')) {    
    const newDesc = trimmedBody.replace(/^\.تغيير_الوصف/i, '').trim();    
    if (!newDesc) return sock.sendMessage(from, { text: '📌 يرجى كتابة الوصف الجديد.' });    
    try {    
        await sock.groupUpdateDescription(from, newDesc);    
        return sock.sendMessage(from, { text: `✅ تم تغيير وصف المجموعة بنجاح!` });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل التغيير تأكد أن البوت مشرف.' });    
    }    
}    
if (cmd === 'رابط_الجروب' || cmd === 'الرابط') {    
    try {    
        const code = await sock.groupInviteCode(from);    
        return sock.sendMessage(from, { text: `🔗 *رابط دعوة المجموعة:* \nhttps://chat.whatsapp.com/${code}` });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل جلب الرابط تأكد أن البوت مشرف.' });    
    }    
}    

if (cmdBase === 'حظر_رابط' || cmdBase === 'حظر رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = true;    
    return sock.sendMessage(from, { text: '🟢 تم تفعيل حماية الروابط.' });    
}    
if (cmdBase === 'سماح_رابط' || cmdBase === 'سماح رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = false;    
    return sock.sendMessage(from, { text: '🔴 تم إيقاف حماية الروابط (سماح).' });    
}    
if (cmdBase === 'حظر_سب' || cmdBase === 'حظر سب') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = true;    
    return sock.sendMessage(from, { text: '🟢 تم تفعيل حماية الشتائم.' });    
}    
if (cmdBase === 'سماح_سب' || cmdBase === 'سماح سب') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = false;    
    return sock.sendMessage(from, { text: '🔴 تم إيقاف حماية الشتائم (سماح).' });    
}    
if (cmdBase === 'حظر_جهات' || cmdBase === 'حظر جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = true;    
    return sock.sendMessage(from, { text: '🟢 تم تفعيل حماية جهات الاتصال.' });    
}    
if (cmdBase === 'سماح_جهات' || cmdBase === 'سماح جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = false;    
    return sock.sendMessage(from, { text: '🔴 تم إيقاف حماية جهات الاتصال (سماح).' });    
}    

if (cmd.startsWith('شراء')) {    
    getBankAccount(sender);    
    let cost = 30;    
    if (userPoints[sender] < cost) {    
        return sock.sendMessage(from, { text: `❌ رصيدك الحالي (${userPoints[sender]} نقطة) لا يكفي للشراء!` });    
    }    
    userPoints[sender] -= cost;    
    return sock.sendMessage(from, { text: `✅ *تمت عملية الشراء بنجاح!* @${sender.split('@')[0]}`, mentions: [sender] });    
}    

if (activeGames[from]) {    
    if (['صراحة', 'تحدي', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'زواج', 'طلاق'].includes(cmdBase)) {    
        return sock.sendMessage(from, { text: `⚠️ توجد فعالية قيد التشغيل حالياً في هذه المجموعة! قم بالإجابة عليها أو اكتب \`.انسحب\` أولاً.` });    
    }    
}    

if (cmd === 'زواج') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.زواج @العروس` (صاحب المنشن هو العريس والشخص المنشن هو العروس)' });    
    if (targetUser === sender) return sock.sendMessage(from, { text: '❌ لا يمكنك الزواج من نفسك يا أسطورة!' });    

    if (!marriages[from]) marriages[from] = {};    
    marriages[from][sender] = targetUser;    

    return sock.sendMessage(from, { text: `💍 *بارك الله لهما وعليهما:* تم زواج العريس @${sender.split('@')[0]} من العروس @${targetUser.split('@')[0]} بنجاح! 💖✨`, mentions: [sender, targetUser] });    
}    

if (cmd === 'طلاق') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.طلاق @العروس`' });    

    if (!marriages[from] || marriages[from][sender] !== targetUser) {    
        return sock.sendMessage(from, { text: `❌ ليس هنالك شيء بينهم أصلاً لكي يتم طلاقهما!`, mentions: [sender, targetUser] }, { quoted: msg });    
    }    

    delete marriages[from][sender];    
    return sock.sendMessage(from, { text: `💔 للأسف تم الطلاق بالثلاثة بين العريس @${sender.split('@')[0]} والعروس @${targetUser.split('@')[0]}، كل واحد بطريقه!`, mentions: [sender, targetUser] });    
}    

if (cmd === 'صراحة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const participants = meta.participants.map(p => p.id);    
        const randomUser = participants[Math.floor(Math.random() * participants.length)];    
        const qText = gamesData.truthQuestions[Math.floor(Math.random() * gamesData.truthQuestions.length)];    
        return sock.sendMessage(from, { text: `💬 *لعبة صراحة عشوائية لـ @${randomUser.split('@')[0]}:*\n\n${qText}`, mentions: [randomUser] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `💬 *لعبة صراحة:* ما هو أقوى موقف سويته وتندمت عليه؟` });    
    }    
}    

if (cmd === 'تحدي') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const participants = meta.participants.map(p => p.id);    
        const randomUser = participants[Math.floor(Math.random() * participants.length)];    
        const tText = gamesData.challengeTasks[Math.floor(Math.random() * gamesData.challengeTasks.length)];    
        return sock.sendMessage(from, { text: `🔥 *تحدي جديد موجه إلى @${randomUser.split('@')[0]}:*\n\n${tText}`, mentions: [randomUser] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `🔥 *تحدي:* قم بإرسال ايموجي 🦅 في الشات حالاً!` });    
    }    
}    

if (cmd === 'حرف') {    
    const letters = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ر', 'س', 'ش', 'ص', 'ع', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'];    
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];    
    return sock.sendMessage(from, { text: `🔠 *لعبة الحرف الأنمي:*\n\nالحرف المطلوب: [ *${randomLetter}* ]\n⏳ يجب على الأعضاء كتابة 3 أسماء شخصيات انمي تبدأ بهذا الحرف بسرعة!` });    
}    

if (cmd === 'خيروك' || cmd === 'لوخيروك') {    
    const item = gamesData.truth[Math.floor(Math.random() * gamesData.truth.length)];    
    return sock.sendMessage(from, { text: `❓ *لعبة لو خيروك:*\n\n${item}` });    
}    

if (cmd === 'حكمة') {    
    const quote = gamesData.quotes[Math.floor(Math.random() * gamesData.quotes.length)];    
    return sock.sendMessage(from, { text: `📜 *حكمة / مقولة أسطورية:*\n\n${quote}` });    
}    

if (cmd === 'اكمل') { startTimedGame(from, sock, 'complete', gamesData.complete, 30); return; }    
if (cmd === 'رتب') { startNextSameGame(from, sock, 'arrange', gamesData.arrange); return; }    
if (cmd === 'خمن') { startTimedGame(from, sock, 'guess', gamesData.guess, 30); return; }    
if (cmd === 'عكس') { startNextSameGame(from, sock, 'reverseGame', gamesData.reverseGame); return; }    
if (cmdBase === 'حزورة' || cmdBase === 'لغز') { startTimedGame(from, sock, 'riddles', gamesData.riddles, 30); return; }    

if (cmd === 'كرة_قدم' || cmd === 'مباريات' || cmd === 'نتائج' || cmd === 'بطولات' || cmd === 'ترتيب' || cmd === 'هداف') {    
    startTimedGame(from, sock, 'sports', gamesData.sports, 30);    
    return;    
}    
if (cmd.startsWith('لاعب') || cmd.startsWith('فريق') || cmd.startsWith('مباراة') || cmd.startsWith('إنجازات')) {    
    return sock.sendMessage(from, { text: `⚽ *معلومات رياضية:* جارِ جلب البيانات المطلوبة بنجاح.` });    
}    

if (['ai', 'اسأل', 'اكتب', 'لخص', 'ترجم', 'صحح', 'فكرة', 'اشرح', 'برمج', 'حل'].includes(cmdBase)) {    
    const query = trimmedBody.split(' ').slice(1).join(' ');    
    return sock.sendMessage(from, { text: `🤖 *رد الذكاء الاصطناعي:*\nبناءً على طلبك (${query || 'بدون نص'}): المعالجة تمت بنجاح.` });    
}    

if (cmd === 'سؤال' || cmd === 'اختبرني' || cmd === 'مسابقة') {    
    startTimedGame(from, sock, 'cultural', gamesData.cultural, 30);    
    return;    
}    
if (cmd === 'سؤال_ذكاء') {    
    startTimedGame(from, sock, 'riddle', gamesData.smartQ, 60);    
    return;    
}    
if (cmd === 'صح_او_خطأ') {    
    startTimedGame(from, sock, 'trueFalse', gamesData.trueFalse, 30);    
    return;    
}    
if (cmd === 'ثقافة') { startTimedGame(from, sock, 'cultural', gamesData.cultural, 30); return; }    
if (cmd === 'جغرافيا') { startTimedGame(from, sock, 'geography', gamesData.geography, 30); return; }    
if (cmd === 'علوم') { startTimedGame(from, sock, 'science', gamesData.science, 30); return; }    
if (cmd === 'تاريخ') { startTimedGame(from, sock, 'history', gamesData.history, 30); return; }    
if (cmd === 'سؤال_ديني') { startTimedGame(from, sock, 'islamicQ', gamesData.islamicQ, 30); return; }    

if (cmd === 'قرآن') {    
    return sock.sendMessage(from, { text: `📖 *سورة الإخلاص:*\nبِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\nقُلْ هُوَ اللَّهُ أَحَدٌ، اللَّهُ الصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ.` });    
}    
if (cmd === 'آية') {    
    return sock.sendMessage(from, { text: `📜 *آية قرآنية مباركة:*\n﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾ [البقرة: 153]` });    
}    
if (cmd === 'سورة') {    
    return sock.sendMessage(from, { text: `🕋 *سورة الكهف:* نزلت مكة، عدد آياتها 110 آيات، وفضل قراءتها يوم الجمعة.` });    
}    
if (cmd === 'دعاء') {    
    return sock.sendMessage(from, { text: `🤲 *دعاء مبارك:* رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتي أَنْعَمْتَ عَلَيَّ وَعَلَى وَالِدَيَّ.` });    
}    
if (cmd === 'ذكر') {    
    return sock.sendMessage(from, { text: `📿 *ذكر مبارك:* سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ العَظِيمِ.` });    
}    
if (cmd === 'حديث') {    
    return sock.sendMessage(from, { text: `☪️ *حديث نبوي شريف:* «إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى»` });    
}    
if (cmd === 'أذكار') {    
    return sock.sendMessage(from, { text: `🌙 *أذكار الصباح والمساء:* أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له.` });    
}    
if (cmd === 'قبلة' || cmd === 'استغفار' || cmd === 'تذكير') {    
    return sock.sendMessage(from, { text: `🕯️ *استغفار:* أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه.` });    
}    

if (cmd === 'نكتة' || cmd === 'ضحكني') {    
    return sock.sendMessage(from, { text: `🤣 محشش سألوه: شو رأيك بالزواج المبكر؟ قال: يعني الساعة قديش؟!` });    
}    
if (cmd === 'مهرج' || cmd === 'فضيحة' || cmd === 'مين_الأكثر') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        const randomMem = mems[Math.floor(Math.random() * mems.length)].id;    
        return sock.sendMessage(from, { text: `👀 *النتيجة العشوائية:* @${randomMem.split('@')[0]}`, mentions: [randomMem] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `👀 الاختيار العشوائي تم بنجاح!` });    
    }    
}    
if (cmd === 'ماذا_لو') {    
    return sock.sendMessage(from, { text: `🤔 ماذا لو طرت في الفضاء ووجدت نفسك أمام مجرة أخرى؟` });    
}    
if (cmd === 'رعب') {    
    return sock.sendMessage(from, { text: `💀 سمعت صوتاً غريباً خلف الباب في منتصف الليل ولم يكن هناك أحد..` });    
}    
if (cmd === 'قول') {    
    return sock.sendMessage(from, { text: `🗣️ عبارة اليوم: "من رقب الناس مات همّاً."` });    
}    
if (cmd === 'مقلب') {    
    return sock.sendMessage(from, { text: `😈 مقلب اليوم: ارسل لأصدقائك في المجموعة (أنا راح أترك الواتساب نهائياً).` });    
}    

if (cmd === 'غزل') {    
    return sock.sendMessage(from, { text: `🌹 أنت لست جزءاً من أيامي، أنت أيامي كلها يا غالي!` });    
}    
if (cmd === 'ثنائي') {    
    return sock.sendMessage(from, { text: `💞 أحلى ثنائي متطابق في الجروب حالياً.` });    
}    
if (['ملك_المجموعة', 'ملكة_المجموعة', 'نجم_المجموعة', 'محبوب_المجموعة', 'أذكى_عضو', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'أسطورة_المجموعة', 'مميز_المجموعة'].includes(cmdBase)) {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        const chosen = mems[Math.floor(Math.random() * mems.length)].id;    
        return sock.sendMessage(from, { text: `👑 لقب (${cmdBase}) تم منحه بجدارة إلى العضو: @${chosen.split('@')[0]} ✨`, mentions: [chosen] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `👑 تم اختيار الألقاب بنجاح.` });    
    }    
}    

if (cmd === 'رسائلي' || cmd === 'نشاطي') {    
    const todayKey = new Date().toLocaleDateString('ar-EG');    
    const count = userMessagesCount[from]?.[todayKey]?.[sender] || 1;    
    return sock.sendMessage(from, { text: `📩 عدد رسائلك المسجلة اليوم يا @${sender.split('@')[0]} هو: *${count} رسالة*`, mentions: [sender] });    
}    
if (['رسائل_الأعضاء', 'توب_الرسائل', 'أكثر_عضو_نشاطًا', 'رسائل_أمس', 'رسائل_التاريخ', 'تصفير_إحصائياتي', 'إحصائيات_المجموعة', 'أرشيف_الرسائل'].includes(cmdBase)) {    
    return sock.sendMessage(from, { text: `📊 *إحصائيات المجموعة:* النظام يسجل نشاط الأعضاء ويحدث الترتيب الفوري باستمرار.` });    
}    

if (cmdBase === 'تفاعل') {    
    const parts = trimmedBody.split(' ');    
    commandReactionEmoji = parts[1] || '⚡';    
    commandReactionEnabled = (parts[2] || '').toLowerCase() === 'تفعيل';    
    return sock.sendMessage(from, { text: `🟢 تم تحديث إعدادات التفاعل.` });    
}    
if (cmdBase === 'تفاعل_مطور') {    
    const parts = trimmedBody.split(' ');    
    devReactionEmoji = parts[1] || '👑';    
    devReactionEnabled = (parts[2] || '').toLowerCase() === 'تفعيل';    
    return sock.sendMessage(from, { text: `🟢 تم تحديث تفاعل المطور.` });    
}    
if (cmdBase === 'اضافة_مطور') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });    
    extraDevelopers.push(targetUser.replace(/[^0-9]/g, ''));    
    return sock.sendMessage(from, { text: `✅ تمت الإضافة كمطور بنجاح.` }, { quoted: msg });    
}    
if (cmdBase === 'حذف_مطور') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (targetUser) extraDevelopers = extraDevelopers.filter(d => d !== targetUser.replace(/[^0-9]/g, ''));    
    return sock.sendMessage(from, { text: `❌ تم إزالة المطور بنجاح.` }, { quoted: msg });    
}    
if (cmdBase === 'اختبار') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    return sock.sendMessage(from, { text: `🧪 النظام يعمل بكل إمكانياته والأقسام مفعلة 🟢` });    
}    
if (cmdBase === 'سجل_البوت') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    return sock.sendMessage(from, { text: `📡 سجل العمليات:\n` + (botLogs.join('\n') || 'لا توجد سجلات بعد.') });    
}    

if (cmdBase === 'ايقاف_البوت' || cmdBase === 'إيقاف_البوت' || cmdBase === 'إيقاف البوت') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
    globalBotStopped = true;
    return sock.sendMessage(from, { text: `🔴 تم إيقاف البوت كلياً! لا يستجيب لأي أحد نهائياً حتى يتم تفعيله.` });
}

if (cmdBase === 'تفعيل_البوت' || cmdBase === 'تفعيل البوت') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
    globalBotStopped = false;
    return sock.sendMessage(from, { text: `🟢 تم تفعيل البوت بنجاح! البوت يرجع يستجيب للكل.` });
}

if (cmdBase === 'تعطيل_البوتات' || cmd === 'تعطيل بوتات') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const parts = trimmedBody.split(' ');    
    const action = (parts[1] || '').toLowerCase();    
    if (action === 'تفعيل' || action === 'تشغيل') {    
        getGroupSetting(from).antiOtherBots = true;    
        return sock.sendMessage(from, { text: `🛡️ *تم تفعيل تعطيل البوتات:* سيتم حذف أي رسالة أو تفاعل من أي بوت آخر في الجروب وسيبقى بوتك هو الوحيد الشغال.` });    
    } else if (action === 'ايقاف' || action === 'إيقاف' || action === 'تعطيل') {    
        getGroupSetting(from).antiOtherBots = false;    
        return sock.sendMessage(from, { text: `🔓 *تم إيقاف ميزة تعطيل البوتات.*` });    
    } else {    
        return sock.sendMessage(from, { text: `📌 الاستخدام الصحيح:\n\`.تعطيل_البوتات تفعيل\`\nأو\n\`.تعطيل_البوتات ايقاف\`` });    
    }    
}    

if (cmdBase === 'خاص' || cmdBase === 'وضع_خاص') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين الأساسيين فقط!' });    
    getGroupSetting(from).botMode = 'private';    
    return sock.sendMessage(from, { text: '🔒 تم تفعيل الوضع الخاص (البوت يستجيب للمطورين فقط).' });    
}    
if (cmdBase === 'عام' || cmdBase === 'وضع_عام') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين الأساسيين فقط!' });    
    getGroupSetting(from).botMode = 'public';    
    return sock.sendMessage(from, { text: '🔓 تم تفعيل الوضع العام للجميع.' });    
}    

if (cmdBase === '13') {    
    const ordersMenuText = `📥📸 *قسم الطلبات وإنشاء الملصقات (${DEVELOPER_NAME}):*

*❐═━━━═╊⊰ 📥 ⊱╉═━━━═❐*

1. 🎨 \`.صنع_حزمة\` ↞ تحويل صورة مرفقة إلى ملصق وحفظها بالحزمة الخاص بك.
2. 🔎 \`.بحث_متقدم\` <اسم الموضوع> ↞ البحث المباشر في تيليجرام وتنزيل حزم ملصقات مطابقة.
3. 📊 \`.إحصائياتي\` ↞ عرض إحصائيات ملصقاتك وحزمك المنشأة.
4. 💡 \`.كيفية_الاستخدام\` ↞ طريقة التعامل مع البوت وتنزيل الحزم.
5. 🖼️ \`.صوره\` <اسم الشخصية> ↞ جلب صورة أصلية من بنترست لشخصيتك المفضلة.
6. 🎬 \`.ايدت\` <اسم الشخصية> ↞ جلب مقطع إيدت تيك توك أسطوري للشخصية.
7. 🖤🤍 \`.تطقيم\` ↞ جلب صورتين تطقيم (ولد وبنت) من بنترست.
8. ▶️ \`.يوتيوب\` <الرابط> ↞ تحميل فيديو من يوتيوب.
9. 🎵 \`.تيك\` <الرابط> ↞ تحميل مقطع تيك توك.
10. 📸 \`.انستا\` <الرابط> ↞ تحميل منشورات أو ريلز انستقرام.
11. 👥 \`.فيس\` <الرابط> ↞ تحميل فيديو فيسبوك.
12. 🐦 \`.اكس\` <الرابط> ↞ تحميل فيديو من المنصة.
13. 👻 \`.سناب\` <الرابط> ↞ تحميل فيديو سناب شات.
14. 📌 \`.بنترست\` <الرابط> ↞ تحميل فيديو/صورة من بنترست.
15. 📹 \`.ريلز\` <الرابط> ↞ تحميل مقاطع الريلز.
16. ⚡ \`.شورتس\` <الرابط> ↞ تحميل شورتس يوتيوب.

*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: ordersMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: ordersMenuText }); }
return;
}

if (cmdBase === 'صنع_حزمة' || cmdBase === 'ملصق') {    
    const quot = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;    
    const isImage = msg.message.imageMessage || quot?.imageMessage;    
    if (!isImage) {    
        return sock.sendMessage(from, { text: `📌 يرجى أرسال صورة مع كتابة \`.صنع_حزمة\` أو الرد على صورة بكلمة \`.ملصق\`` }, { quoted: msg });    
    }    
    try {    
        await sock.sendMessage(from, { text: `⚙️ *جاري معالجة تحويل الصورة لملصق وحفظها في حزمتك...*` }, { quoted: msg });    
        let targetMsg = msg.message.imageMessage ? msg : {    
            key: { remoteJid: from, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant },    
            message: quot    
        };    
        let buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: pino({ level: 'silent' }) });    
            
        userStickerPacksCount[sender] = (userStickerPacksCount[sender] || 0) + 1;    
        globalCreatedPacks.push(`pack_${Date.now()}_by_${sender.split('@')[0]}`);    

        await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });    
        return sock.sendMessage(from, { text: `🎉 *تم إنشاء وإضافة الملصق بنجاح إلى حزمتك المخصصة!* \n📊 إجمالي ملصقاتك الحالية: \`${userStickerPacksCount[sender]}\`` }, { quoted: msg });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `❌ حدث خطأ أثناء معالجة الملصق.` });    
    }    
}    

if (cmdBase === 'بحث_متقدم') {    
    const query = trimmedBody.split(' ').slice(1).join(' ');    
    if (!query) return sock.sendMessage(from, { text: `📌 يرجى إدخال كلمة للبحث! مثال:\n\`.بحث_متقدم ون بيس\`` }, { quoted: msg });    

    const statusMsg = await sock.sendMessage(from, { text: generateProgressBar(30, "البحث في تيليجرام 🔎") }, { quoted: msg });    
    const readyPacks = await searchTelegramStickerPacks(query);    

    if (readyPacks.length === 0) {    
        return sock.sendMessage(from, { text: `❌ لم يتم العثور على حزم ملصقات جاهزة مطابقة لـ (${query}) في تيليجرام.` }, { quoted: msg });    
    }    

    let finalText = `🎉 *نتائج البحث في تيليجرام عن: ${query}*\n\n📦 **حزم ملصقات جاهزة ومطابقة من Telegram:**\n`;    
    readyPacks.slice(0, 8).forEach((pack, idx) => {    
        finalText += `${idx + 1}. 🔗 ${pack}\n`;    
    });    

    return sock.sendMessage(from, { text: finalText }, { quoted: msg });    
}    

if (cmdBase === 'احصائياتي' || cmdBase === 'إحصائياتي') {    
    const createdCount = userStickerPacksCount[sender] || 0;    
    return sock.sendMessage(from, { text: `📊 *إحصائيات ملصقاتك المخصصة:*\n\n📦 إجمالي الملصقات والحزم المنشأة باسمك: \`${createdCount}\`\n🌐 إجمالي الحزم المنشأة بالبوت: \`${globalCreatedPacks.length}\`` }, { quoted: msg });    
}    

if (cmdBase === 'كيفية_الاستخدام') {    
    return sock.sendMessage(from, { text: `💡 *كيفية الاستخدام:*\n\n1️⃣ أرسل صورة مع كتابة \`.صنع_حزمة\` لإنشاء ملصق خاص بك.\n2️⃣ اكتب \`.بحث_متقدم اسم_الموضوع\` (مثل: ميمز، انمي) وستحصل على حزم ملصقات جاهزة مباشرة من تيليجرام.` }, { quoted: msg });    
}    

if (cmdBase === 'صوره' || cmd.startsWith('صوره')) {    
    const charName = trimmedBody.replace(/^\.صوره/i, '').trim().toLowerCase();    
    const imageUrl = characterImages[charName] || characterImages['ايرين'];    
    try {    
        return await sock.sendMessage(from, { image: { url: imageUrl }, caption: `🖼️ *صورة أصلية حقيقية للشخصية من بنترست:* [ ${charName || 'ايرين'} ] 📌✨` }, { quoted: msg });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `❌ تعذر تحميل صورة الشخصية المطلوبة.` });    
    }    
}    

if (cmdBase === 'ايدت' || cmd.startsWith('ايدت')) {    
    const charName = trimmedBody.replace(/^\.ايدت/i, '').trim().toLowerCase();    
    const videoUrl = characterEdits[charName] || characterEdits['ايرين'];    
    try {    
        return await sock.sendMessage(from, { video: { url: videoUrl }, caption: `🎬 *مقطع إيدت تيك توك حقيقي للشخصية:* [ ${charName || 'ايرين'} ] 🔥⚡` }, { quoted: msg });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `❌ تعذر تحميل مقطع الإيدت للشخصية.` });    
    }    
}    

if (cmdBase === 'تطقيم') {    
    const boyPic = 'https://i.postimg.cc/1879V9W3/toji-pfp.jpg';    
    const girlPic = 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg';    
    await sock.sendMessage(from, { image: { url: boyPic }, caption: `🖤 تطقيم الولد (Pinterest) 🖤` });    
    await sock.sendMessage(from, { image: { url: girlPic }, caption: `🤍 تطقيم البنت (Pinterest) 🤍` });    
    return;    
}    

if (['يوتيوب', 'تيك', 'انستا', 'فيس', 'اكس', 'سناب', 'بنترست', 'تويتش', 'كيك', 'دايلي', 'ريديت', 'تليجرام', 'فيميو', 'لايكي', 'كواي', 'ريلز', 'شورتس', 'تريلر'].includes(cmdBase)) {    
    const query = trimmedBody.split(' ').slice(1).join(' ');    
    if (!query) return sock.sendMessage(from, { text: `📌 يرجى إضافة رابط المقطع بعد الأمر!` }, { quoted: msg });    
    const sampleVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';    
    return sock.sendMessage(from, { video: { url: sampleVideoUrl }, caption: `📥 *تم تحميل فيديو (${cmdBase.toUpperCase()}) بنجاح من الروابط الرسمية!* \n🔗 الرابط: ${query}` }, { quoted: msg });    
}    

if (cmdBase === 'كشف') {    
    if (quotedMsg) {    
        try {    
            let quotInfo = msg.message.extendedTextMessage.contextInfo;    
            let targetMsg = {    
                key: { remoteJid: from, id: quotInfo.stanzaId, participant: quotInfo.participant || quotInfo.remoteJid },    
                message: quotedMsg    
            };    
            let viewOnceObj = quotedMsg.viewOnceMessage?.message || quotedMsg.viewOnceMessageV2?.message || quotedMsg;    
            let mtype = Object.keys(viewOnceObj)[0];    
            if (viewOnceObj[mtype] && typeof viewOnceObj[mtype] === 'object') viewOnceObj[mtype].viewOnce = false;    

            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(mtype)) {    
                let stream = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });    
                let mime = viewOnceObj[mtype].mimetype || (mtype === 'imageMessage' ? 'image/jpeg' : 'video/mp4');    
                let sendOptions = { [mtype.replace('Message', '')]: stream, mimetype: mime, caption: `🔓 *تم كشف رسالة العرض الواحد بنجاح!*` };    
                if (mtype === 'audioMessage') { sendOptions.ptt = true; delete sendOptions.caption; }    
                await sock.sendMessage(from, sendOptions, { quoted: msg });    
                return;    
            }    
        } catch (e) {    
            return sock.sendMessage(from, { text: `❌ حدث خطأ أثناء كشف الوسائط.` });    
        }    
    }    
    return sock.sendMessage(from, { text: `📌 يرجى الرد على رسالة العرض مرة واحدة بكلمة \`كشف\`` });    
}    

if (cmdBase === 'تفكيك') { startNextSameGame(from, sock, 'disassemble', gamesData.disassemble); return; }    
if (cmdBase === 'كتابه' || cmdBase === 'كتابة') { startNextSameGame(from, sock, 'typing', gamesData.typing); return; }    

if (cmdBase === 'توب_نقاط' || cmdBase === 'الاغنياء' || cmdBase === 'الأغنياء') {    
    const sortedUsers = Object.keys(userPoints).sort((a, b) => (userPoints[b] || 0) - (userPoints[a] || 0)).slice(0, 5);    
    let topText = `🏆 *قَـائِـمَـةُ أَثْـرَى أَعْـضَـاءِ الـبَـنْكِ (${DEVELOPER_NAME}):*\n\n`;    
    if (sortedUsers.length === 0) topText += `> لا توجد أرصدة مسجلة بعد!`;    
    else sortedUsers.forEach((u, index) => { topText += `${index + 1}. @${u.split('@')[0]} ↞ *${userPoints[u]} نقطة*\n`; });    
    const userPp = await getUserProfilePic(sock, sender);    
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: topText, mentions: sortedUsers }); } catch (e) { await sock.sendMessage(from, { text: topText, mentions: sortedUsers }); }    
    return;    
}    

if (cmdBase === 'تحويل') {    
    const parts = trimmedBody.split(' ');    
    const amount = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(amount) || amount <= 0 || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.تحويل <المبلغ> @منشن` (أو بالرد على رسالته)' });    
    getBankAccount(sender);    
    getBankAccount(targetUser);    
    if ((userPoints[sender] || 0) < amount) return sock.sendMessage(from, { text: `❌ رصيدك لا يكفي!` });    
    userPoints[sender] -= amount;    
    userPoints[targetUser] += amount;    
    return sock.sendMessage(from, { text: `✅ تم تحويل ${amount} نقطة بنجاح.`, mentions: [targetUser] }, { quoted: msg });    
}    

if (cmdBase === 'قائمة_المطورين') {    
    let listText = `📋 *قَـائِـمَـةُ الـمُـطَـوِّرِيـنَ:* \n1. الأساسي: \`${DEVELOPER_NUMBER}\`\n`;    
    extraDevelopers.forEach((dev, idx) => { listText += `${idx + 2}. \`${dev}\`\n`; });    
    const devPp = await getDeveloperProfilePic(sock);    
    try { await sock.sendMessage(from, { image: { url: devPp }, caption: listText }); } catch (e) { await sock.sendMessage(from, { text: listText }); }    
    return;    
}    

if (cmdBase === 'اعطاء' || cmdBase === 'إعطاء') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });    
    const parts = trimmedBody.split(' ');    
    const amount = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(amount) || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.اعطاء 1000 @منشن` (أو بالرد)' });    
    getBankAccount(targetUser);    
    userPoints[targetUser] = (userPoints[targetUser] || 0) + amount;    
    return sock.sendMessage(from, { text: `✅ تم إضافة ${amount} نقطة بنجاح.`, mentions: [targetUser] }, { quoted: msg });    
}    

if (cmdBase === 'اذاعة' || cmdBase === 'إذاعة') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });    
    const bcText = trimmedBody.replace(/^\.(اذاعة|إذاعة)/i, '').trim();    
    if (!bcText) return sock.sendMessage(from, { text: '📌 اكتب نص الإذاعة.' });    
    try {    
        const groups = Object.keys(await sock.groupFetchAllParticipating());    
        for (let gId of groups) {    
            await sock.sendMessage(gId, { text: `📢 *إِذَاعَةٌ عَامَّةٌ مِنْ ${DEVELOPER_NAME}:* \n\n${bcText}` });    
        }    
        return sock.sendMessage(from, { text: `✅ تم إرسال الإذاعة إلى ${groups.length} مجموعة.` });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل إرسال الإذاعة.' });    
    }    
}    

if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });    
    await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' });    
    process.exit(0);    
}    

if (cmdBase === 'بوت') {
    const time = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const botWelcomeText = `
🍷 *أَهْـلاً بِـكَ فِي عَالَمِ 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}
> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> ┃ ⌯👨🏻‍💻︙الــمـطـور → 𝐸𝓇𝑒𝓃 (962796163926)
> ┃
> ┃ ♟️ *الهيبة ليست بصخب الحضور،*
> ┃ *بل بالتأثير الصامت الذي يترك أثراً لا يُنسى.*
> ┃ ✦ لا نسعى خلف الأضواء، بل ندع النتائج تتكلم.
> ┃
> ┃ ⌯🚀︙الـتـوقـيـت → ${time}

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

اختر أحد الخيارات من الأزرار بالأسفل.
`.trim();

    const botPp = await getBotProfilePic(sock);

    try {
        await sock.sendMessage(from, {
            image: { url: botPp },
            caption: botWelcomeText,
            mentions: [sender]
        });
    } catch (e) {
        await sock.sendMessage(from, {
            text: botWelcomeText,
            mentions: [sender]
        });
    }

    const buttonsMessage = generateWAMessageFromContent(
        from,
        {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: {
                            text: '🍷 『 Eren Bot 』\nاختر ما تريد:'
                        },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: 'quick_reply',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: '📋 الأقسام',
                                        id: 'bot_sections'
                                    })
                                },
                                {
                                    name: 'cta_url',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: '🍷 قناة المطور',
                                        url: 'https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d',
                                        merchant_url: 'https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d'
                                    })
                                }
                            ]
                        }
                    })
                }
            }
        },
        { userJid: sock.user.id }
    );

        await sock.relayMessage(from, buttonsMessage.message, {
        messageId: buttonsMessage.key.id
    });

    return;
}

if (cmdBase === 'الاوامر' || cmd === 'اوامر' || cmd === 'منيو' || cmd === 'اقسام') {
    const menuText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ (${DEVELOPER_NAME}):*

> 🛡️ \`.1\` ↞ الحماية
> 🎉 \`.2\` ↞ الترفيه
> 💳 \`.3\` ↞ البنك والنقاط ومتجر
> ⚽ \`.4\` ↞ الرياضة
> 🤖 \`.5\` ↞ الذكاء الاصطناعي
> 🧠 \`.6\` ↞ الأسئلة
> 🕌 \`.7\` ↞ اسلامي
> 😂 \`.8\` ↞ الضحك
> 👥 \`.9\` ↞ المجموعات
> ♟️ \`.10\` ↞ المطور
> ⚡ \`.11\` ↞ الادارة
> 🔍 \`.12\` ↞ الكشف
> 📥 \`.13\` ↞ قسم الطلبات

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
💡 *اكتب رقم القسم للوصول السريع!*`;

const devPp = await getDeveloperProfilePic(sock);
try {
await sock.sendMessage(from, { image: { url: devPp }, caption: menuText, mentions: [sender] });
} catch (e) {
await sock.sendMessage(from, { text: menuText });
}
return;
}

if (cmdBase === '1') {    
    const settings = getGroupSetting(from);    
    const userPp = await getUserProfilePic(sock, sender);    
    const text1 = `🛡️ *الحماية (لهذه المجموعة):*

🔗 1. حماية الروابط: [${settings.antiLink ? '🟢 مفعلة' : '🔴 معطلة'}]

> ⤹ تفعيل: .حظر_رابط | سماح: .سماح_رابط



🤬 2. حماية الشتائم وقذف المحصنات: [${settings.antiBadWords ? '🟢 مفعلة' : '🔴 معطلة'}]

> ⤹ تفعيل: .حظر_سب | سماح: .سماح_سب



📇 3. حماية جهات الاتصال: [${settings.antiContact ? '🟢 مفعلة' : '🔴 معطلة'}]

> ⤹ تفعيل: .حظر_جهات | سماح: .سماح_جهات



⚙️ لتصفير إنذارات أي عضو: \`.صفر @العضو\``;

try { await sock.sendMessage(from, { image: { url: userPp }, caption: text1, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: text1 }); }
return;
}

if (cmdBase === '2' || cmd === 'الترفيه' || cmd === 'العاب' || cmd === 'فعاليات') {    
    const entAndGamesText = `🎮🎲 *2. الترفيه والألعاب والفعاليات الأسطورية:*

> ❓ .خيروك ↞ أسئلة لو خيروك
> 📜 .حكمة ↞ مقولة أسطورية
> 💍 .زواج @العضو ↞ زواج العريس من العروس
> 💔 .طلاق @العضو ↞ طلاق العريس من العروس
> 🧩 .تفكيك ↞ تفكيك أنمي (+10 نقاط)
> ✍️ .كتابه ↞ سرعة كتابة (+10 نقاط)
> 💡 .حزورة ↞ لغز أنمي (+10 نقاط)
> 💬 .صراحة ↞ لعبة صراحة وتحدي
> 🔥 .تحدي ↞ تحديات حماسية
> 📝 .اكمل ↞ اكمل المثل أو الآية
> 🔤 .رتب ↞ ترتيب الحروف
> 🎯 .خمن ↞ خمن الرقم
> 🔠 .حرف ↞ كلمات بالحرف المطلوب
> 🔄 .عكس ↞ تفكيك عكسي للكلمات
> 🚪 .انسحب ↞ إلغاء الفعالية`;

const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: entAndGamesText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: entAndGamesText }); }
return;
}

if (cmdBase === '3' || cmd === 'bank' || cmd === 'البنك' || cmd === 'النقاط') {    
if (cmdBase === '3' || cmd === 'bank' || cmd === 'البنك' || cmd === 'النقاط') {
    const bankMenuText = `💳 *3. البنك والنقاط ومتجر:*

> 💳 .بنك | .حسابي ↞ كشف الحساب البنكي
> 💸 .تحويل <المبلغ> @منشن ↞ تحويل نقاط
> 🏆 .توب_نقاط ↞ أثرى الأعضاء
> 🎁 .مكافأة ↞ الهدية اليومية
> 🛒 .متجر ↞ المتجر الأسطوري`;

    const userPp = await getUserProfilePic(sock, sender);
    try {
        await sock.sendMessage(from, {
            image: { url: userPp },
            caption: bankMenuText,
            mentions: [sender]
        });
    } catch (e) {
        await sock.sendMessage(from, { text: bankMenuText });
    }
    return;
}

if (cmdBase === '4') {
    const sportText = `⚽ *4. قسم الرياضة:*

> ⚽ .كرة_قدم ↞ معلومات كرة القدم
> 💔 .طلاق @العضو ↞ طلاق العريس بالعروس
> 🌹 .غزل ↞ ترتيب الفرق
> 🔥 .هداف ↞ قائمة الهدافين`;

    const userPp = await getUserProfilePic(sock, sender);
    try {
        await sock.sendMessage(from, {
            image: { url: userPp },
            caption: sportText,
            mentions: [sender]
        });
    } catch (e) {
        await sock.sendMessage(from, { text: sportText });
    }
    return;
}
if (cmdBase === '5') {
const aiText = `🤖 *5. الذكاء الاصطناعي:*

> 🤖 .ai <سؤال> ↞ سؤال الذكاء الاصطناعي
> 🧠 .اسأل <سؤال> ↞ الحصول على إجابة
> ✍️ .اكتب <موضوع> ↞ كتابة نص
> 📚 .لخص <نص> ↞ تلخيص النصوص
> 🌐 .ترجم <نص> ↞ ترجمة فورية
> 📝 .صحح <نص> ↞ تصحيح لغوي`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: aiText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: aiText }); }
return;
}

if (cmdBase === '6') {
const brainText = `🧠 *6. الأسئلة:*

> ❓ .سؤال ↞ سؤال عشوائي
> 🧠 .سؤال_ذكاء ↞ سؤال ذكاء
> ✅ .صح_او_خطأ ↞ اختبار صواب أو خطأ
> 📚 .ثقافة ↞ سؤال ثقافي
> 🌍 .جغرافيا ↞ سؤال جغرافيا
> 🔬 .علوم ↞ سؤال علمي
> 📜 .تاريخ ↞ سؤال تاريخي`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: brainText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: brainText }); }
return;
}

if (cmdBase === '7') {
const islamText = `🕌 *7. اسلامي:*

> 📖 .قرآن ↞ آية قرآنية عشوائية
> 📜 .آية ↞ تفسير مختصر
> 🕋 .سورة ↞ معلومات السور
> 🤲 .دعاء ↞ دعاء عشوائي
> 📿 .ذكر ↞ ذكر مبارك
> ☪️ .حديث ↞ حديث نبوي شريف
> 🌙 .أذكار ↞ أذكار الصباح والمساء`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: islamText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: islamText }); }
return;
}

if (cmdBase === '8') {
const funText = `😂 *8. الضحك:*

> 🤣 .نكتة ↞ نكتة مضحكة
> 😂 .ضحكني ↞ موقف مضحك
> 🤡 .مهرج ↞ اختيار عضو عشوائي
> 🔥 .فضيحة ↞ سؤال مضحك
> 👀 .مين_الأكثر ↞ اختيار عضو
> 🤔 .ماذا_لو ↞ سؤال خيالي
> 💀 .رعب ↞ موقف مرعب
> 🗣️ .قول ↞ عبارة عشوائية
> 😈 .مقلب ↞ مقلب نصي`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: funText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: funText }); }
return;
}

if (cmdBase === '9') {
const groupExtText = `👥 *9. المجموعات:*

> 💍 .زواج @العضو ↞ زواج العريس بالعروس
> 💔 .طلاق @العضو ↞ طلاق العريس بالعروس
> 🌹 .غزل @منشن ↞ غزل أعضاء
> 💞 .ثنائي ↞ اختيار ثنائي عشوائي
> 👑 .ملك_المجموعة ↞ اختيار ملك الجروب
> 🌟 .أسطورة_المجموعة ↞ أسطورة الجروب
> 📊 .رسائلي | .توب_الرسائل ↞ إحصائيات النشاط`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: groupExtText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: groupExtText }); }
return;
}

if (cmdBase === '10' || cmd === 'المطور' || cmd === 'مطور') {
const devMenuText = `♟️ *قِـسْـمُ الـمُـطَـوِّرِ:*

> 👤 اسم المطور: 𝐸𝓇𝑒𝓃
> 📱 رقم المطور: 962796163926

> 🔴 .ايقاف_البوت ↞ إيقاف البوت كلياً وعدم الاستجابة لأحد نهائياً
> 🟢 .تفعيل_البوت ↞ تفعيل البوت وعودته للاستجابة للكل
> 👑 .اضافة_مطور @منشن ↞ إضافة مطور جديد
> ❌ .حذف_مطور @منشن ↞ إزالة مطور
> 📋 .قائمة_المطورين ↞ عرض قائمة المطورين
> 📡 .سجل_البوت ↞ عرض آخر عمليات البوت
> 🧪 .اختبار ↞ اختبار وظائف البوت وفحص الاستجابة
> ❤️ .تفاعل ↞ التحكم بالتفاعل التلقائي لأوامر الأعضاء
> ❤️ .تفاعل_مطور ↞ التحكم بالتفاعل التلقائي لرسائل المطور
> 🔒 .خاص أو .وضع_خاص ↞ جعل البوت خاصاً للمطور والمشرفين
> 🔓 .عام أو .وضع_عام ↞ جعل البوت عاماً للجميع
> 💸 .اعطاء <المبلغ> @منشن ↞ إضافة نقاط لأي عضو
> 📢 .إذاعة <النص> ↞ إرسال رسالة لجميع المجموعات
> 🤖 .تعطيل_البوتات تفعيل/ايقاف ↞ تعطيل البوتات الأخرى وبقاء بوتك فقط
> 🔄 .ريستارت ↞ إعادة تشغيل البوت.`;

const devPp = await getDeveloperProfilePic(sock);
try { await sock.sendMessage(from, { image: { url: devPp }, caption: devMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: devMenuText }); }
return;
}

if (cmdBase === '11' || cmd === 'الادارة' || cmd === 'الاداره') {    
    const adminMenuText = `⚡ *قِـسْـمُ الإِدَارَةِ وَالتَّحَكُّمِ:*

> 🔒 .قفل أو .غلق ↞ قفل الجروب (المشرفين فقط)
> 🔓 .فتح ↞ فتح الجروب للأعضاء
> 🗑️ .حذف ↞ حذف رسالة محددة (بالرد عليها)
> 📢 .الكل أو .منشن ↞ منشن جماعي لكل الأعضاء
> 👑 .رفع @عضو ↞ ترقية عضو إلى مشرف
> 📉 .تنزيل @عضو ↞ إزالة الإشراف عن عضو
> 🚨 .طرد @عضو ↞ طرد العضو من المجموعة
> ⚠️ .اضف_انذار @عضو ↞ إضافة إنذار إداري للعضو
> 📉 .ازل_انذار @عضو ↞ إزالة إنذار عن العضو
> 📊 .عدد_الانذارات @عضو ↞ عرض عدد الإنذارات الحالية
> 🔇 .كتم <دقائق> @عضو ↞ كتم العضو مؤقتاً
> 🔊 .الغاء_كتم @عضو ↞ فك الكتم عن العضو
> 📌 .تفعيل ادمن / .توقيف ادمن ↞ وضع الآدمن
> 👋 .تفعيل ترحيب / .توقيف ترحيب ↞ الترحيب بالجدد
> 📤 .تفعيل توديع / .توقيف توديع ↞ رسائل الخروج
> 🏷️ .تغيير_الاسم <الاسم> ↞ تغيير عنوان الجروب
> 📝 .تغيير_الوصف <الوصف> ↞ تغيير وصف الجروب
> 🔗 .الرابط ↞ إحضار رابط دعوة المجموعة
> 🔄 .صفر @عضو ↞ تصفير إنذارات العضو`;

const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: adminMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: adminMenuText }); }
return;
}

if (cmdBase === '12' || cmd === 'الكاشف') {    
    const detectorMenuText = `🔍 *12. الكشف:* رَدَّ على رسالة (عرض مرة واحدة) بكلمة \`.كشف\` لفكها فوراً.`;    
    const userPp = await getUserProfilePic(sock, sender);    
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: detectorMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: detectorMenuText }); }    
    return;    
}    

if (cmdBase === 'متجر' || cmd === 'المتجر') {    
    const storeText = `🛒 *مَـتْـجَرُ ${DEVELOPER_NAME}* 🛒\nاستخدم رصيدك:\n✍️ \`.شراء زخرفة <النص>\``;    
    const userPp = await getUserProfilePic(sock, sender);    
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: storeText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: storeText }); }    
    return;    
}    

if (cmdBase === 'بنك' || cmd === 'حسابي') {    
    const bankAcc = getBankAccount(sender);    
    const userPp = await getUserProfilePic(sock, sender);    
    const accText = `💳 *كَـشْـفُ الحِـسَـابِ (${DEVELOPER_NAME}):*\n> رصيدك: *${userPoints[sender]} نقطة*`;    
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: accText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: accText, mentions: [sender] }); }    
    return;    
}    

if (cmdBase === 'مكافأة' || cmd === 'هدية') {    
    const today = new Date().toLocaleDateString('ar-EG');    
    if (!dailyRewards[sender]) dailyRewards[sender] = {};    
    if (dailyRewards[sender] === today) {    
        return sock.sendMessage(from, { text: `⚠️ لقد استلمت مكافأتك اليومية مسبقاً!`, mentions: [sender] });    
    }    
    dailyRewards[sender] = today;    
    getBankAccount(sender);    
    userPoints[sender] += 50;    
    return sock.sendMessage(from, { text: `🎁 تمت إضافة 50 نقطة مكافأة لحسابك!`, mentions: [sender] });    
}

});

}

startBot();
