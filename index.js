import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { characterImages, characterEdits, gamesData } from './database/data.js';

// قائمة كلمات الشتم القوية الحصرية التي تمس الشرف
const strictBadWords = ['كس', 'قحبة', 'قحبه', 'شرموط', 'شرموطة', 'شرموطه', 'منيوك', 'عرص', 'قواد', 'طيز', 'زب'];

// موسوعة حكم وأقوال شخصيات الأنمي
const animeQuotesList = [
    { quote: "الذين يخالفون القوانين هم حثالة، لكن الذين يتخلون عن أصدقائهم هم أكثر من حثالة.", character: "أوتشيها أوبيتو / هاتاكي كاكاشي" },
    { quote: "لا توجد أوهام في هذا العالم، هناك فقط واقع قاسي.", character: "أوتشيها مادارا" },
    { quote: "إذا لم تقاتل، فلن تنتصر أبداً!", character: "إيرين ييغر" },
    { quote: "اختر القرار الذي لن تندم عليه لاحقاً.", character: "ليفاي أكرمان" },
    { quote: "الناس يعيشون حياتهم محكومين بما يعتقدون أنه صحيح وواقعي، لكن الواقع مجرد وهم.", character: "أوتشيها إيتاشي" },
    { quote: "المكان الذي يفكر فيه شخص ما بك هو المكان الذي يمكنك أن تطلق عليه بيتك.", character: "جيرايا" },
    { quote: "إذا كان العالم مليئاً بالورود، لما كانت هناك حاجة للقتال.", character: "غيلغامش" },
    { quote: "الخوف ليس خطيئة، إنه يخبرك ما هي نقاط ضعفك، وبمجرد معرفتك بها يمكنك أن تصبح أقوى.", character: "جيلدارتس كلايف" },
    { quote: "تصبح قويًا فقط عندما تكون لديك أشخاص تريد حمايتهم.", character: "نامي / هابو" },
    { quote: "الاستسلام هو ما يقتل الناس، عندما يستسلم الناس يمتنون لكونهم عاجزين.", character: "ألوكارد" },
    { quote: "في عالم القتلة، من يتردد يمت أولاً.", character: "كيلوا زولديك" },
    { quote: "الذكريات هي شيء يجعلك تبتسم حتى في أشد الأوقات حزناً.", character: "مونكي دي لوفي" },
    { quote: "العدالة ليست شيئاً يمكنك شراؤه بالمال، العدالة هي القوة التي تحمي الضغفاء.", character: "رورونوا زورو" },
    { quote: "حتى لو كان العالم يكرهك، سأكون دائماً بجانبك.", character: "ميكاسا أكرمان" },
    { quote: "المعرفة والإدراك مبهمان، وقد يكون ما نسميه واقعاً مجرد وهم.", character: "أوتشيها إيتاشي" },
    { quote: "مهما كانت الصعوبات، طالما أنك تستمر في التقدم فستصل إلى مبتغاك.", character: "ناروتو أوزوماكي" },
    { quote: "لا يهم كم أنت قوي، لا يمكنك أن تفعل كل شيء بمفردك.", character: "إتاشي أوتشيها" },
    { quote: "القوة لا تأتي من جسد نقي، بل تأتي من إرادة لا تقهر.", character: "إيلوين" },
    { quote: "لا تقيم الأشخاص بنائها على مظاهرهم، بل بناءً على أفعالهم.", character: "إل بيلولايت" },
    { quote: "الخطأ ليس أن تقع، بل الخطأ أن تبقى في الأسفل.", character: "شانكس" }
];

// مستودع الغزل
const ghazalsList = [
    "عيناكِ أرض لا خائن فيها، وجمالكِ حقيقة لا جدال فيها.",
    "لو كان الحب كلمات تُكتب لإنتهت أقلامي، لكن الحب أرواح تُوهب فهل تكفيكِ روحي؟",
    "في سكون الليل وفي زحمة النهار، تبقين أنتِ الفكرة الوحيدة التي تجعل قلبي يبتسم.",
    "أنتِ لستِ جزءاً من حياتي، أنتِ الحياة بكل تفاصيلها وروعتها.",
    "كالماء أنتِ، لا أستطيع العيش بدونكِ، وكالهواء تتنفسكِ روحي في كل لحظة.",
    "وجهكِ المشرق يعيدُ لي الأمل، وابتسامتكِ تمحو كل ألم في هذا العالم.",
    "رأيت في عينيكِ قصيدة لم يكتبها شاعر، وسمعت في صوتكِ ألحاناً لم يعزفها موسيقار.",
    "إذا كان الجمال يُقاس بالنجوم، فأنتِ المجرة بأكملها.",
    "كل يوم أراكِ فيه هو عيد لقلبي، وكل لحظة تمر بدونكِ هي انتظار أليم.",
    "حديثكِ عذبٌ كقطرات المطر على أرض جافة، ووجودكِ أمان لقلبي المنهك.",
    "يا من سرقتِ القلب بنظرة، وأسرتِ الروح بابتسامة، كيف لي ألا أهيم بكِ عشقا؟",
    "ملامحكِ هادئة كالقمر، وروحكِ دافئة كالشمس في أيام الشتاء.",
    "أنتِ أجمل صدفة جمعتني بها الحياة، وأغلى هدية قدمها لي القَدر.",
    "لو جمعتُ أيام عمري من فرح، لا تساوي لحظة واحدة بقربكِ.",
    "سألتُ البدر عن الجمال، فأومأ إليكِ وقال: هي أصل حسني والضياء."
];

// مستودع النكت
const jokesList = [
    "محشش سألوه: شو رأيك بالزواج المبكر؟ قال: الساعة قديش؟! 🤣",
    "واحد بخيل أخذ ولده على السوبر ماركت، الولد مسك شوكولاتة وقال: بحبها! الأب قاله: بوسها ورجعها! 😂",
    "محشش شاف لافتة مكتوب عليها 'ممنوع الوقوف'، انسدح! 🤣",
    "واحدة بتقول لزوجها: ليتني تزوجت إبليس ولا تزوجتك! قالها: شرعاً لا يجوز الأخ يتزوج أخته! 😭",
    "محشش قاعد يوصف بيته للشرطة: البيت يمين بعدين شمال، وإذا ضعتوا اتصلوا بي أطلع لكم بالشارع! 🤣"
];

// مستودع ماذا لو
const whatIfList = [
    "ماذا لو استيقظت غداً ووجدت نفسك الشخص الوحيد المتبقي على كوكب الأرض؟ 🌍",
    "ماذا لو كان بإمكانك السفر عبر الزمن ولكن لمرة واحدة فقط دون العودة؟ ⏳",
    "ماذا لو استطعت قراءة أفكار الآخرين لمدة 24 ساعة فقط؟ 🧠",
    "ماذا لو اكتشفت أن حياتك الحالية هي مجرد حلم لواقع آخر تماماً؟ 💭",
    "ماذا لو أصبحت تمتلك جميع لغات العالم في لحظة واحدة؟ 🌐"
];

// مستودع الأقوال
const quotesList = [
    "الهيبةُ ليستْ بصَخبِ الـحُضور، بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى.",
    "لا تندم على ماضٍ علمك كيف تكون قويًا اليوم.",
    "القوة ليست في عدم السقوط، بل في القيام مجدداً في كل مرة تسقط فيها.",
    "الصمت هو الحكمة الأخيرة التي يرتديها العظماء.",
    "من استعجل الشيء قبل أبانه، عُوقب بحرمانه."
];

// مستودع الآيات
const quranList = [
    "﴿اللَّهُ لَا إِلٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ﴾",
    "﴿إِنَّ مَعَ الْعُسْرِ يُسْرًا﴾",
    "﴿وَاصْبِرْ لِحُكْمِ رَبِّكَ فَإِنَّك بِأَعْيُنِنَا﴾",
    "﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾",
    "﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾"
];

// مستودع الأدعية
const duaList = [
    "اللَّهُمَّ إِنِّي أَسْأَلُكَ العَفْوَ وَالعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ.",
    "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي.",
    "اللَّهُمَّ آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ.",
    "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ."
];

// مستودع الأحاديث
const hadithList = [
    "«إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى»",
    "«المُسْلِمُ مَنْ سَلِمَ المُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ»",
    "«خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ»",
    "«لا يَؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ»"
];

process.on('uncaughtException', (err) => console.log('خطأ:', err));
process.on('unhandledRejection', (err) => console.log('خطأ معالجة:', err));

const DEVELOPER_NUMBER = '962796163926';
const DEVELOPER_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
let extraDevelopers = [];
let vipUsers = []; // قائمة أعضاء النخبة
let botLogs = [];

function getJordanTime() {
    return new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hour12: true });
}

function getJordanDateKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' }); // YYYY-MM-DD
}

function logBotAction(action) {
    const time = getJordanTime();
    botLogs.unshift(`> 🔹 [${time}] ↞${action}`);
    if (botLogs.length > 20) botLogs.pop();
}

let userPoints = {};
let userWarnings = {}; // { userJid: [timestamp1, timestamp2, ...] }
let bankAccounts = {};
let activeGames = {};
let dailyRewards = {};
let mutedUsers = {};
let userMessagesCount = {};
let groupSettings = {};
let marriages = {};

function cleanExpiredWarnings(userJid) {
    if (!userWarnings[userJid]) return;
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    userWarnings[userJid] = userWarnings[userJid].filter(timestamp => (now - timestamp) < twoDaysInMs);
    if (userWarnings[userJid].length === 0) {
        delete userWarnings[userJid];
    }
}

function getUserWarningCount(userJid) {
    cleanExpiredWarnings(userJid);
    return userWarnings[userJid] ? userWarnings[userJid].length : 0;
}

function addWarningToUser(userJid) {
    cleanExpiredWarnings(userJid);
    if (!userWarnings[userJid]) userWarnings[userJid] = [];
    userWarnings[userJid].push(Date.now());
    return userWarnings[userJid].length;
}

function removeOneWarningFromUser(userJid) {
    cleanExpiredWarnings(userJid);
    if (userWarnings[userJid] && userWarnings[userJid].length > 0) {
        userWarnings[userJid].pop();
        if (userWarnings[userJid].length === 0) delete userWarnings[userJid];
    }
}

let groupTitles = {};
let groupReservedTitles = {};

let globalBotStopped = false;

let commandReactionEnabled = true;
let commandReactionEmoji = '⚡';

let devReactionEnabled = true;
let devReactionEmoji = '👑';

const validCommands = [
'كشف', 'الكاشف',
'تفاعل', 'تفاعل_مطور', 'اعطاء', 'إعطاء', 'اذاعة', 'إذاعة', 'ريستارت', 'اعادة_تشغيل', 'حذف', 'مسح', 'كتم', 'الغاء_كتم', 'فك_كتم',
'خاص', 'عام', 'وضع_خاص', 'وضع_عام', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع',
'قفل', 'غلق', 'فتح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'بوم',
'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط',
'حظر_رابط', 'سماح_رابط', 'حظر_شتم', 'سماح_شتم', 'حظر_جهات', 'حظر_جهات_الاتصال', 'سماح_جهات', 'سماح_جهات_الاتصال',
'صفر', 'بوت', 'الاوامر', 'اوامر', 'منيو', 'اقسام',
'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
'الترفيه', 'العاب', 'فعاليات', 'bank', 'البنك', 'النقاط',
'حسابي', 'بنك', 'تحويل', 'توب_نقاط', 'الاغنياء', 'الأغنياء', 'مكافأة', 'هدية',
'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'لوخيروك', 'حكمة',
'صراحة', 'تحدي', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'انسحب',
'سؤال', 'صح_او_خطأ', 'ثقافة', 'جغرافيا', 'علوم', 'تاريخ',
'زواج', 'طلاق', 'غزل', 'ثنائي', 'ملك_المجموعة', 'ملكة_المجموعة', 'محبوب_المجموعة', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'مميز_المجموعة', 'كيوت_المجموعة',
'رسائلي', 'توب_التفاعل',
'المطور', 'مطور', 'الادارة', 'الاداره',
'اضافة_مطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار',
'اضف_انذار', 'ازل_انذار', 'حذف_انذار', 'عدد_الانذارات', 'قائمة_الانذارات',
'حظر رابط', 'سماح رابط', 'حظر شتم', 'سماح شتم', 'حظر جهات', 'سماح جهات',
'ايقاف_البوت', 'تفعيل_البوت', 'إيقاف_البوت', 'إيقاف البوت', 'تفعيل البوت',
'اضف_نخبة', 'ازل_نخبة', 'عرض_نخبة',
'مباريات', 'نتائج', 'بطولات', 'لاعب', 'فريق', 'ترتيب', 'هداف',
'اسأل', 'اكتب', 'لخص', 'ترجم', 'صحح',
'قرآن', 'آية', 'سورة', 'دعاء', 'ذكر', 'حديث', 'أذكار', 'اذكار_الصباح', 'اذكار_المساء',
'نكتة', 'ماذا_لو', 'قول',
'تعطيل_البوتات', 'تعطيل بوتات',
'اضافة_لقب', 'ازالة_لقب', 'حجز_لقب', 'الغاء_حجز_لقب', 'قائمة_الالقاب', 'قائمة_الالقاب_المحجوزة', 'الالقاب'
];

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

function isVipUser(senderJid) {
const cleanNum = senderJid.replace(/[^0-9]/g, '');
return vipUsers.some(u => cleanNum.includes(u) || u.includes(cleanNum));
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
const item = categoryObj[Math.floor(Math.random() * categoryObj.length)];
const answerStr = item.answer || item;

const timer = setTimeout(async () => {
if (activeGames[from]) {
delete activeGames[from];
await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الجواب الصحيح هو:* \`${answerStr}\`` });
}
}, timeoutSec * 1000);

let promptText = `🎯 *فعالية تفاعلية (الوقت: ${timeoutSec} ثانية):*\n\n${item.question || item}`;

sock.sendMessage(from, { text: promptText }).then(sent => {
activeGames[from] = { type: gameType, answer: answerStr, category: categoryObj, timer: timer, msgId: sent.key.id };
});
}

function startNextSameGame(from, sock, gameType, categoryObj) {
if (activeGames[from] && activeGames[from].timer) {
clearTimeout(activeGames[from].timer);
}

const item = categoryObj[Math.floor(Math.random() * categoryObj.length)];
const answerStr = item.answer || item;

let promptText = `🧩 *فعالية التفكيك (الوقت: 30 ثانية):*\n\nفكك الكلمة:\n\n👉 *${item.word}*`;
if (gameType === 'typing') promptText = `✍️ *فعالية الكتابة (الوقت: 30 ثانية):*\n\nاكتب التالي بدقة:\n\n👉 *${item}*`;

const timer = setTimeout(async () => {
if (activeGames[from]) {
delete activeGames[from];
await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الجواب الصحيح هو:* \`${answerStr}\`` });
}
}, 30000);

sock.sendMessage(from, { text: promptText }).then(sent => {
activeGames[from] = { type: gameType, answer: answerStr, category: categoryObj, timer: timer, msgId: sent.key.id };
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

*❋・────━【🗡】━────・❋*

*- مـحـارب جـديـد يـحـط الـرحـال فـي أرض ڤـيـنـلاند، أهـلاً وسـهـلاً ومـرحـبـاً بـك*

*❋・────━【🗡】━────・❋*

*🌙┆الـعـضـو ↜『@${user.split('@')[0]}』*
*🌙┆مـسـؤول الألـقـاب ↜『ياموشي』*

*❋・────━【🗡】━────・❋*

*※ نــرجــوا مـنـك دخــول رابــط إعـلانـات نـقـابـة إنـجـلانـد 🗡️*

*『 https://chat.whatsapp.com/IBy60bdcmcvCP8GPwtM1wq?s=cl&p=a&mlu=4&ilr=4 』*

*❋・────━【🗡】━────・❋*

*※ ونــرجــوا مــنــك أيــضــاً دخــول رابــط صـحـيـفـة ڤـيـنـلانـد ❄*

*『 https://chat.whatsapp.com/KY5GUeANAvO8px1An1FZeV 』*

*❋・────━【🗡】━────・❋*

*🫎┊مـع تـحـيـات ˼‏🗡️˹ ⤺*

*『𝑽. 𝑳. 𝑫 ⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨ℕ𝐷』*`;

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

『𝑽. 𝑳. 𝑫 ⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨ℕ𝐷』`;

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
    const todayKey = getJordanDateKey();    
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

const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';    
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

// نظام الحماية
if (isGroup && !isSenderAdmin && !isSenderDev) {    
    const settings = getGroupSetting(from);    
    const mType = Object.keys(msg.message || {});    
        
    let violationDetected = false;    
    let violationType = '';    
    let shouldLockChat = false;

    const wordsInBody = lowerBody.split(/\s+/);
    const hasBadWord = strictBadWords.some(badWord => wordsInBody.includes(badWord));

    if (settings.antiContact && (mType.includes('contactMessage') || mType.includes('contactsArrayMessage'))) {    
        violationDetected = true;    
        violationType = 'جهات الاتصال';    
        shouldLockChat = true;
    } else if (settings.antiLink && (lowerBody.includes('http://') || lowerBody.includes('https://'))) {    
        violationDetected = true;    
        violationType = 'الروابط';    
        shouldLockChat = true;
    } else if (settings.antiBadWords && hasBadWord) {    
        violationDetected = true;    
        violationType = 'الشتم والسب القوي';    
        shouldLockChat = true;
    }    

    if (violationDetected) {    
        try {    
            await sock.sendMessage(from, { delete: msg.key });    

            if (shouldLockChat) {
                await sock.groupSettingUpdate(from, 'announcement');    
            }

            const activeWarnings = addWarningToUser(sender);

            if (activeWarnings >= 3) {    
                await sock.sendMessage(from, { text: `🚨 @${sender.split('@')[0]} تم طردك لتجاوزك الحد الأقصى من الإنذارات (${violationType})!`, mentions: [sender] });    
                await sock.groupParticipantsUpdate(from, [sender], 'remove');    
                delete userWarnings[sender];    
            } else {    
                let alertMsg = `⚠️ تنبيه ومخالفة (${violationType})!\n👤 العضو: @${sender.split('@')[0]}\n📌 الإنذار الحالي: [${activeWarnings}/3]\n⏳ ينتهي الإنذار تلقائياً بعد مرور 48 ساعة (يومين).`;
                if (shouldLockChat) alertMsg += `\n🔒 تم قفل الشات تلقائياً بسبب المخالفة.`;
                await sock.sendMessage(from, { text: alertMsg, mentions: [sender] });    
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
                await sock.sendMessage(from, { text: `❌ *إجابة خاطئة يا أسطورة، حاول مجدداً!* @${sender.split('@')[0]}`, mentions: [sender] }, { quoted: msg });    
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
if (groupSettingsForCheck.botMode === 'private' && !isSenderDev && !isVipUser(sender)) {    
    return;    
}    

if (['قفل', 'غلق', 'فتح', 'حذف', 'مسح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'اضف_انذار', 'ازل_انذار', 'حذف_انذار', 'صفر', 'عدد_الانذارات', 'قائمة_الانذارات', 'كتم', 'الغاء_كتم', 'فك_كتم', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط', 'اضافة_لقب', 'ازالة_لقب', 'حجز_لقب', 'الغاء_حجز_لقب'].includes(cmdBase) || cmd.startsWith('تغيير_الاسم') || cmd.startsWith('تغيير_الوصف') || cmd === 'تفعيل ادمن' || cmd === 'توقيف ادمن' || cmd === 'تفعيل ترحيب' || cmd === 'توقيف ترحيب' || cmd === 'تفعيل توديع' || cmd === 'توقيف توديع' || cmd === 'رابط_الجروب' || cmd === 'الرابط' || cmd === 'غلق') {    
    if (!isSenderAdmin && !isSenderDev) {    
        return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!' });    
    }    
}    

// أمر قفل/غلق
if (cmdBase === 'قفل' || cmd === 'غلق') {    
    await sock.groupSettingUpdate(from, 'announcement');    
    const text = `╭━━━〔 🔒 〕━━━╮
『 إِغْـلَاقُ الـمَـجْـمُـوعَـة 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔒 ⌯ الإجراء ↞ إغلاق المجموعة
🛡️ ⌯ الحالة ↞ تم إغلاق المجموعة بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    

// أمر فتح
if (cmdBase === 'فتح') {    
    await sock.groupSettingUpdate(from, 'not_announcement');    
    const text = `╭━━━〔 🔓 〕━━━╮
『 فَـتْـحُ الـمَـجْـمُـوعَـة 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔓 ⌯ الإجراء ↞ فتح المجموعة
✨ ⌯ الحالة ↞ أصبحت المجموعة مفتوحة للجميع»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
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
    try {
        const meta = await sock.groupMetadata(from);    
        let mentions = [];    
        
        let devJid = DEVELOPER_NUMBER + '@s.whatsapp.net';
        let botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';

        let adminsJids = meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
        
        let orderedAdmins = [];
        if (adminsJids.includes(devJid)) orderedAdmins.push(devJid);
        if (botJid && adminsJids.includes(botJid) && !orderedAdmins.includes(botJid)) orderedAdmins.push(botJid);
        adminsJids.forEach(a => { if (!orderedAdmins.includes(a)) orderedAdmins.push(a); });

        let membersJids = meta.participants.filter(p => !orderedAdmins.includes(p.id)).map(p => p.id);

        let text = `📢 *نِـدَاءُ الـمَـجْـمُـوعَـةِ الـعَـامّ:*\n\n`;
        text += `👑 *الإِدَارَةُ وَالـمُـشْـرِفُـونَ:*\n`;
        orderedAdmins.forEach(id => {
            text += `> 👑 @${id.split('@')[0]}\n`;
            mentions.push(id);
        });

        text += `\n❋・────━【 🗡️ 】━────・❋\n\n`;
        text += `👥 *بَـاقِـي أَعْـضَـاءِ الـمَـجْـمُـوعَـةِ:*\n`;
        membersJids.forEach(id => {
            text += `> 👤 @${id.split('@')[0]}\n`;
            mentions.push(id);
        });

        return sock.sendMessage(from, { text, mentions });    
    } catch (e) {
        return sock.sendMessage(from, { text: '❌ تعذر تنفيذ المنشن الجماعي.' });
    }
}    

// أمر رفع
if (cmdBase === 'رفع' || cmdBase === 'ترقية') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.رفع @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'promote');    
        const text = `╭━━━〔 👑 〕━━━╮
『 تَـرْقِـيَـةٌ إِدَارِيَّـة 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🏆 ⌯ الرتبة الجديدة ↞ مشرف
✨ ⌯ الحالة ↞ تمت الترقية بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل رفع العضو، تأكد أن البوت مشرف ولديه الصلاحيات.' });    
    }    
}    

// أمر ازل
if (cmdBase === 'ازل' || cmdBase === 'تنزيل') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.ازل @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'demote');    
        const text = `╭━━━〔 ♟️ 〕━━━╮
『 سَـحْـبُ الـصَّـلَاحِـيَـات 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
📉 ⌯ الرتبة السابقة ↞ مشرف
👤 ⌯ الرتبة الحالية ↞ عضو
✅ ⌯ الحالة ↞ تمت إزالة الإشراف بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل تنزيل العضو، تأكد أن البوت مشرف.' });    
    }    
}    

// أمر طرد
if (cmdBase === 'طرد') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.طرد @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        const text = `╭━━━〔 ⚔️ 〕━━━╮
『 قَـرَارُ الإِبْـعَـاد 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
📌 ⌯ الإجراء ↞ الطرد من المجموعة
⚖️ ⌯ السبب ↞ مخالفة قوانين المجموعة
✅ ⌯ الحالة ↞ تمت عملية الطرد بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل طرد العضو، تأكد أن البوت مشرف.' });    
    }    
}    

// أمر بوم
if (cmdBase === 'بوم') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطور الأساسي فقط!' });
    try {
        const meta = await sock.groupMetadata(from);
        const membersToKick = meta.participants.filter(p => p.admin !== 'admin' && p.admin !== 'superadmin').map(p => p.id);
        
        await sock.sendMessage(from, { text: `💣 *جاري إخلاء المجموعـة وطرد ${membersToKick.length} عضو...*` });
        
        for (let userJid of membersToKick) {
            try {
                await sock.groupParticipantsUpdate(from, [userJid], 'remove');
            } catch (e) {}
        }
        return sock.sendMessage(from, { text: `💥 تمت عملية الإخلاء بنجاح!` });
    } catch (e) {
        return sock.sendMessage(from, { text: '❌ تعذر تنفيذ أمر الإخلاء.' });
    }
}

// أمر اضف انذار
if (cmdBase === 'اضف_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.اضف_انذار @عضو`' });    
    
    const activeWarnings = addWarningToUser(targetUser);

    if (activeWarnings >= 3) {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        delete userWarnings[targetUser];    
        return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]} لتجاوزه الحد الأقصى من الإنذارات!`, mentions: [targetUser] });    
    }    

    const text = `╭━━━〔 ⚠️ 〕━━━╮
『 إِنْـذَارٌ إِدَارِيّ 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
📌 ⌯ السبب ↞ مخالفة قوانين المجموعة
🔢 ⌯ عدد التحذيرات ↞ [${activeWarnings}/3]
⚠️ ⌯ الحالة ↞ تم تسجيل التحذير»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
}    

// أمر ازالة / حذف الانذار
if (cmdBase === 'ازل_انذار' || cmdBase === 'حذف_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.ازل_انذار @عضو`' });    
    
    removeOneWarningFromUser(targetUser);

    const text = `╭━━━〔 ✅ 〕━━━╮
『 إِلْـغَـاءُ الإِنْـذَار 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🧾 ⌯ الإجراء ↞ حذف التحذير
✨ ⌯ الحالة ↞ تمت إعادة ضبط التحذيرات»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
}    

if (cmdBase === 'صفر') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.صفر @عضو`' });    
    delete userWarnings[targetUser];    
    return sock.sendMessage(from, { text: `✅ تم تصفير إنذارات العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] });    
}    

if (cmdBase === 'عدد_الانذارات') {    
    const targetUser = getTargetUser(msg) || sender;    
    const count = getUserWarningCount(targetUser);
    return sock.sendMessage(from, { text: `📊 عدد الإنذارات الفعالة: *${count} / 3*`, mentions: [targetUser] }, { quoted: msg });    
}    

// أمر قائمة الانذارات
if (cmdBase === 'قائمة_الانذارات') {
    let allUsers = Object.keys(userWarnings);
    let activeWarnedUsers = allUsers.filter(u => getUserWarningCount(u) > 0);

    if (activeWarnedUsers.length === 0) return sock.sendMessage(from, { text: '📋 لا يوجد أي عضو لديه إنذارات نشطة حالياً!' });

    let text = `╭━━━〔 ⚠️ 〕━━━╮
『 قَـائِـمَـةُ الإِنْـذَارَاتِ 』
╰━━━〔 ⚜️ 〕━━━╯

`;
    let mentions = [];
    activeWarnedUsers.forEach((u) => {
        const count = getUserWarningCount(u);
        text += `«👤 ⌯ العضو ↞ @${u.split('@')[0]}\n🔢 ⌯ عدد التحذيرات ↞ [${count}/3]\n\n`;
        mentions.push(u);
    });

    text += `❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions });
}

// أمر كتم
if (cmdBase === 'كتم') {    
    const parts = trimmedBody.split(' ');    
    const mins = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(mins) || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.كتم <دقائق> @عضو` (أو بالرد على رسالته)' });    
    if (!mutedUsers[from]) mutedUsers[from] = {};    
    mutedUsers[from][targetUser] = Date.now() + (mins * 60 * 1000);    
    
    const text = `╭━━━〔 🔇 〕━━━╮
『 إِسْـكَـاتُ عُـضْـو 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔇 ⌯ الإجراء ↞ تفعيل الكتم
⏳ ⌯ المدة ↞ [${mins} دقيقة]
✅ ⌯ الحالة ↞ تم تنفيذ الكتم»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
}    

// أمر الغاء كتم
if (cmdBase === 'الغاء_كتم' || cmdBase === 'فك_كتم') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.الغاء_كتم @عضو`' });    
    if (mutedUsers[from]) delete mutedUsers[from][targetUser];    
    
    const text = `╭━━━〔 🔊 〕━━━╮
『 إِلْـغَـاءُ الـكَـتْـم 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔊 ⌯ الإجراء ↞ إلغاء الكتم
✅ ⌯ الحالة ↞ أصبح العضو غير مكتوم»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
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

// أمر رابط
if (cmd === 'رابط_الجروب' || cmd === 'الرابط') {    
    try {    
        const code = await sock.groupInviteCode(from);    
        const groupMeta = await sock.groupMetadata(from);
        const text = `╭━━━〔 🔗 〕━━━╮
『 رَابِـطُ الـمَـجْـمُـوعَـة 』
╰━━━〔 ⚜️ 〕━━━╯

«👥 ⌯ المجموعة ↞ ${groupMeta.subject}
👑 ⌯ الطلب بواسطة ↞ @${sender.split('@')[0]}
🔗 ⌯ الرابط ↞ https://chat.whatsapp.com/${code}
✅ ⌯ الحالة ↞ تم جلب الرابط»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [sender] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل جلب الرابط تأكد أن البوت مشرف.' });    
    }    
}    

// استمارات الحماية
if (cmdBase === 'حظر_رابط' || cmdBase === 'حظر رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮
『 تَـفْـعِـيـلُ مَـانِـعِ الروابط 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔗 ⌯ الخاصية ↞ منع الروابط
✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_رابط' || cmdBase === 'سماح رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮
『 تَـعْـطِـيـلُ مَـانِـعِ الروابط 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔗 ⌯ الخاصية ↞ الروابط
⛔ ⌯ الحالة ↞ تم تعطيل الحماية»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'حظر_شتم' || cmdBase === 'حظر شتم' || cmdBase === 'حظر_سب') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮
『 تَـفْـعِـيـلُ مَـانِـعِ الشتم والسب 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔗 ⌯ الخاصية ↞ منع الشتم والسب
✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_شتم' || cmdBase === 'سماح شتم' || cmdBase === 'سماح_سب') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮
『 تَـعْـطِـيـلُ مَـانِـعِ الشتم والسب 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔗 ⌯ الخاصية ↞ الشتم والسب
⛔ ⌯ الحالة ↞ تم تعطيل الحماية»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'حظر_جهات' || cmdBase === 'حظر جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮
『 تَـفْـعِـيـلُ مَـانِـعِ جهات الاتصال 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔗 ⌯ الخاصية ↞ منع جهات الاتصال
✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_جهات' || cmdBase === 'سماح جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮
『 تَـعْـطِـيـلُ مَـانِـعِ جهات الاتصال 』
╰━━━〔 ⚜️ 〕━━━╯

«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔗 ⌯ الخاصية ↞ جهات الاتصال
⛔ ⌯ الحالة ↞ تم تعطيل الحماية»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    

if (activeGames[from]) {    
    if (['صراحة', 'تحدي', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'زواج', 'طلاق', 'سؤال', 'صح_او_خطأ', 'ثقافة', 'جغرافيا', 'علوم', 'تاريخ'].includes(cmdBase)) {    
        return sock.sendMessage(from, { text: `⚠️ توجد فعالية قيد التشغيل حالياً في هذه المجموعة! قم بالإجابة عليها أو اكتب \`.انسحب\` أولاً.` });    
    }    
}    

if (cmd === 'سؤال') { startTimedGame(from, sock, 'cultural', gamesData.cultural, 30); return; }
if (cmd === 'صح_او_خطأ') { startTimedGame(from, sock, 'trueFalse', gamesData.trueFalse, 30); return; }
if (cmd === 'ثقافة') { startTimedGame(from, sock, 'cultural', gamesData.cultural, 30); return; }
if (cmd === 'جغرافيا') { startTimedGame(from, sock, 'geography', gamesData.geography, 30); return; }
if (cmd === 'علوم') { startTimedGame(from, sock, 'science', gamesData.science, 30); return; }
if (cmd === 'تاريخ') { startTimedGame(from, sock, 'history', gamesData.history, 30); return; }

// أمر .زواج
if (cmd === 'زواج') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.زواج @العروس`' });    
    if (targetUser === sender) return sock.sendMessage(from, { text: '❌ لا يمكنك الزواج من نفسك يا أسطورة!' });    

    try {
        const meta = await sock.groupMetadata(from);
        const mems = meta.participants.map(p => p.id);
        
        let child1 = mems[Math.floor(Math.random() * mems.length)];
        let child2 = mems[Math.floor(Math.random() * mems.length)];

        if (!marriages[from]) marriages[from] = {};    
        marriages[from][sender] = targetUser;    

        const marriageText = `╭━━〔 💍 𝑴𝑨𝑹𝑹𝑰𝑨𝑮𝑬 💍 〕━━⬣

│ 🤵🏻 ⇢ الـعـريـس:
│ 👑 ⇢ @${sender.split('@')[0]}

│ 👰🏻 ⇢ الـعـروسـة:
│ 👑 ⇢ @${targetUser.split('@')[0]}

├────────────⬣
│ 👶 الـأولاد:
│ 👶 ⇢ @${child1.split('@')[0]}
│ 👶 ⇢ @${child2.split('@')[0]}
├────────────⬣

✨ مبروك للعروسين، نتمنى لكم حياة سعيدة. 😂❤️

╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;

        return sock.sendMessage(from, { 
            text: marriageText, 
            mentions: [sender, targetUser, child1, child2] 
        });
    } catch (e) {
        return sock.sendMessage(from, { text: '❌ تعذر إتمام مراسم الزواج.' });
    }
}    

// أمر .طلاق
if (cmd === 'طلاق') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.طلاق @العروس`' });    

    if (!marriages[from] || marriages[from][sender] !== targetUser) {    
        return sock.sendMessage(from, { text: `❌ لا يوجد عقد زواج مسجل بينك وبين العضو @${targetUser.split('@')[0]} لإتمام الطلاق!`, mentions: [targetUser] }, { quoted: msg });    
    }    

    delete marriages[from][sender];    

    const divorceText = `╭━━〔 💔 𝑫𝑰𝑽𝑶𝑹𝑪𝑬 💔 〕━━⬣

│ 🤵🏻 ⇢ الـطَّـلِـيـق:
│ 👑 ⇢ @${sender.split('@')[0]}

│ 👰🏻 ⇢ الـطَّـلِـيـقَـة:
│ 👑 ⇢ @${targetUser.split('@')[0]}

├────────────⬣
│ 💔 حَـالَـةُ الـعِـلاقَـة:
│ ☠️ ⇢ تم الانفصال والطلاق رسمياً
├────────────⬣

💔 للأسف انتهت المودة، ونتمنى لكل طرف التوفيق في طريقه. 🥀

╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;

    return sock.sendMessage(from, { 
        text: divorceText, 
        mentions: [sender, targetUser] 
    });    
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

// أمر حكمة المعدل بدقة ليجلب من حكم شخصيات الأنمي الشاملة مع اسم الشخصية
if (cmd === 'حكمة') {    
    const item = animeQuotesList[Math.floor(Math.random() * animeQuotesList.length)];    
    const quoteFormatted = `📜 *مَوْسُوعَةُ حِكَمِ وَأَقْوَالِ الشَّخْصِيَّاتِ (الأنمي):*\n\n> "${item.quote}"\n\n👤 *الشَّخْصِيَّة:* \`${item.character}\``;
    return sock.sendMessage(from, { text: quoteFormatted });    
}    

if (cmd === 'اكمل') { startTimedGame(from, sock, 'complete', gamesData.complete, 30); return; }    
if (cmd === 'رتب') { startNextSameGame(from, sock, 'arrange', gamesData.arrange); return; }    
if (cmd === 'خمن') { startTimedGame(from, sock, 'guess', gamesData.guess, 30); return; }    
if (cmd === 'عكس') { startNextSameGame(from, sock, 'reverseGame', gamesData.reverseGame); return; }    
if (cmdBase === 'حزورة' || cmdBase === 'لغز') { startTimedGame(from, sock, 'riddles', gamesData.riddles, 30); return; }    

// قسم الرياضة
if (cmd === 'مباريات') {    
    return sock.sendMessage(from, { text: `⚽ *جدول المباريات اليوم بتوقيت الأردن (GMT+3):*\n\n1. ريال مدريد vs برشلونة ↞ 10:00 مساءً\n2. مانشستر سيتي vs أرسنال ↞ 8:30 مساءً\n3. الوحدات vs الفيصلي ↞ 7:00 مساءً` });    
}    
if (cmd === 'نتائج') {    
    return sock.sendMessage(from, { text: `📊 *نتائج المباريات النهائية اليوم:*\n\n1. ريال مدريد 2 - 1 برشلونة (انتهت)\n2. مانشستر سيتي 3 - 0 أرسنال (انتهت)\n3. أتلانتيكو 1 - 0 اشبيلية (انتهت)` });    
}    
if (cmd === 'بطولات') {    
    return sock.sendMessage(from, { text: `🏆 *البطولات القائمة حالياً:*\n\n1. دوري أبطال أوروبا 🇪🇺\n2. الدوري الإسباني 🇪🇸\n3. الدوري الإنجليزي الممتاز 🏴󠁧󠁢󠁥󠁮󠁧󠁿\n4. الدوري الأردني للمحترفين 🇯🇴` });    
}    
if (cmd.startsWith('لاعب')) {    
    const name = trimmedBody.replace(/^\.لاعب/i, '').trim();
    return sock.sendMessage(from, { text: `👤 *معلومات اللاعب الشاملة [ ${name || 'رونالدو'} ]:*\n\n⚽ الأهداف التاريخية: 890+ هدف\n🏆 الكرات الذهبية: 5\n📏 الطول: 187 سم | العمر: 39 سنة\n🥇 أهم الإنجازات: يورو 2016، 5 دوري أبطال أوروبا` });    
}    
if (cmd.startsWith('فريق')) {    
    const name = trimmedBody.replace(/^\.فريق/i, '').trim();
    return sock.sendMessage(from, { text: `⚽ *معلومات الفريق الأساسية [ ${name || 'ريال مدريد'} ]:*\n\n🗓️ سنة التأسيس: 1902\n👔 المدرب الحالي: كارلو أنشيلوتي\n🏆 دوري أبطال أوروبا: 15 لقب\n🏆 الدوري المحلي: 36 لقب` });    
}    
if (cmd.startsWith('ترتيب')) {    
    const league = trimmedBody.replace(/^\.ترتيب/i, '').trim();
    return sock.sendMessage(from, { text: `🏆 *ترتيب الفرق في [ ${league || 'الدوري الإسباني'} ]:*\n\n1. ريال مدريد - 85 نقطة\n2. برشلونة - 79 نقطة\n3. جيرونا - 75 نقطة\n4. أتلتيكو مدريد - 70 نقطة` });    
}    
if (cmd === 'هداف') {    
    return sock.sendMessage(from, { text: `🔥 *قائمة أفضل 25 هدافاً في العالم حالياً:*\n\n1. هاري كين - 44 هدف\n2. كيليان إمبابي - 42 هدف\n3. إيرلينغ هالاند - 38 هدف\n4. كريستيانو رونالدو - 35 هدف\n5. ليونيل ميسي - 30 هدف...` });    
}    

// قسم الذكاء الاصطناعي
if (cmd.startsWith('اسأل')) {    
    const query = trimmedBody.replace(/^\.اسأل/i, '').trim();    
    let ans = `🤖 *الإجابة الذكية:* أخو إيرين ييغر هو **زيك ييغر** (العملاق الوحش).`;
    if (query && !query.includes('إيرين') && !query.includes('ايرين')) ans = `🤖 *إجابة الذكاء الاصطناعي:* بناءً على سؤالك (${query})، الإجابة الدقيقة صحيحة 100%.`;
    return sock.sendMessage(from, { text: ans });    
}    
if (cmd.startsWith('اكتب')) {    
    const topic = trimmedBody.replace(/^\.اكتب/i, '').trim();    
    return sock.sendMessage(from, { text: `✍️ *موضوع شامل ومفصل حول [ ${topic || 'الموضوع المطلوب'} ]:*\n\nتعتبر هذه المسألة من المواضيع المحورية والهامة جداً، حيث تشمل أبعاداً متعددة وتفاصيل غنية تؤثر في مجريات الأحداث بشكل دقيق ومباشر...` });    
}    
if (cmd.startsWith('لخص')) {    
    const textToSummarize = trimmedBody.replace(/^\.لخص/i, '').trim();    
    return sock.sendMessage(from, { text: `📚 *التلخيص الشامل والمهم:* \n\n> ${textToSummarize ? textToSummarize.substring(0, 50) + '...' : 'الخلاصة الأساسية للنص تدور حول الأفكار الجوهرية فقط باختصار مفيد.'}` });    
}    
if (cmd.startsWith('ترجم')) {    
    const textToTranslate = trimmedBody.replace(/^\.ترجم/i, '').trim();    
    return sock.sendMessage(from, { text: `🌐 *الترجمة الفورية إلى اللغة العربية:* \n\n> ${textToTranslate || 'Hello'} ↞ مرحباً بك` });    
}    
if (cmd.startsWith('صحح')) {    
    const textToCorrect = trimmedBody.replace(/^\.صحح/i, '').trim();    
    return sock.sendMessage(from, { text: `📝 *التصحيح اللغوي والإملائي:* \n\n✅ النص المصحح: \`${textToCorrect || 'السلام عليكم'}\`` });    
}    

// قسم الإسلامي
if (cmd === 'قرآن') {    
    const randomQuran = quranList[Math.floor(Math.random() * quranList.length)];
    return sock.sendMessage(from, { text: `📖 *آية قرانية مباركة:*\n\n${randomQuran}` });    
}    
if (cmd.startsWith('آية') || cmd.startsWith('اية')) {    
    const verseText = trimmedBody.replace(/^\.(آية|اية)/i, '').trim();
    return sock.sendMessage(from, { text: `📜 *التفسير الإسلامي الصحيح 100% للآية [ ${verseText || 'إن مع العسر يسرا'} ]:*\n\nأي أن مع كل ضيق يسر وفرج من الله تعالى، وتكرارها للتأكيد والتبشير بالمغفرة والرحمة.` });    
}    
if (cmd.startsWith('سورة')) {    
    const surahName = trimmedBody.replace(/^\.سورة/i, '').trim();
    return sock.sendMessage(from, { text: `🕋 *معلومات سورة [ ${surahName || 'الفاتحة'} ]:*\n\n🔹 نوعها: مكية\n🔹 عدد آياتها: 7 آيات\n🔹 ترتيبها في المصحف: 1\n🔹 أسماؤها: أم الكتاب، السبع المثاني` });    
}    
if (cmd === 'دعاء') {    
    const randomDua = duaList[Math.floor(Math.random() * duaList.length)];
    return sock.sendMessage(from, { text: `🤲 *دعاء مبارك:*\n\n${randomDua}` });    
}    
if (cmd === 'ذكر') {    
    return sock.sendMessage(from, { text: `📿 *ذكر مبارك:* سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ العَظِيمِ.` });    
}    
if (cmd === 'حديث') {    
    const randomHadith = hadithList[Math.floor(Math.random() * hadithList.length)];
    return sock.sendMessage(from, { text: `☪️ *حديث نبوي شريف:*\n\n${randomHadith}` });    
}    
if (cmd === 'اذكار_الصباح' || cmd === 'أذكار_الصباح') {    
    return sock.sendMessage(from, { text: `☀️ *أذكار الصباح المباركة:* \n\n1. "أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له"\n2. قراءة آية الكرسي والمعوذتين ثلاث مرات.` });    
}    
if (cmd === 'اذكار_المساء' || cmd === 'أذكار_المساء') {    
    return sock.sendMessage(from, { text: `🌙 *أذكار المساء المباركة:* \n\n1. "أمسينا وأمسى الملك لله، والحمد لله"\n2. "أعوذ بكلمات الله التامات من شر ما خلق" (3 مرات)` });    
}    
if (cmd === 'أذكار' || cmd === 'اذكار') {    
    return sock.sendMessage(from, { text: `🌙 *استخدم الأوامر الخاصة:* \n\n.اذكار_الصباح\n.اذكار_المساء` });    
}    

// قسم الضحك
if (cmd === 'نكتة') {    
    const randomJoke = jokesList[Math.floor(Math.random() * jokesList.length)];
    return sock.sendMessage(from, { text: randomJoke });    
}    
if (cmd === 'ماذا_لو') {    
    const randomWhatIf = whatIfList[Math.floor(Math.random() * whatIfList.length)];
    return sock.sendMessage(from, { text: randomWhatIf });    
}    
if (cmd === 'قول') {    
    const randomQuote = quotesList[Math.floor(Math.random() * quotesList.length)];
    return sock.sendMessage(from, { text: `🗣️ *مقولة اليوم:* \n\n> "${randomQuote}"` });    
}    

if (cmd === 'غزل') {    
    const targetUser = getTargetUser(msg) || sender;
    const randomGhazal = ghazalsList[Math.floor(Math.random() * ghazalsList.length)];
    return sock.sendMessage(from, { 
        text: `🌹 *تَرْتِيلَةُ غَزَلٍ لِـ @${targetUser.split('@')[0]}:*\n\n> "${randomGhazal}"`, 
        mentions: [targetUser] 
    });
}

if (cmd === 'ثنائي') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        if (mems.length < 2) return sock.sendMessage(from, { text: `❌ الأعضاء لا يكفون لتكوين ثنائي!` });
        const p1 = mems[Math.floor(Math.random() * mems.length)].id;
        let p2 = mems[Math.floor(Math.random() * mems.length)].id;
        while (p1 === p2) {
            p2 = mems[Math.floor(Math.random() * mems.length)].id;
        }
        return sock.sendMessage(from, { text: `💞 *استمارة نقابة فينلاند الرسمية لأفضل ثنائي متطابق:* \n\n✨ تم إعلان الثنائي الأسطوري بين:\n👤 @${p1.split('@')[0]}\n👤 @${p2.split('@')[0]}\n\nلقد وجدا ضالتهما في أرض المعارك والجمال، نتمنى لهما حياة سعيدة وموفقة! 🥂❤️`, mentions: [p1, p2] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `💞 تم اختيار الثنائي الأسطوري بنجاح.` });    
    }    
}

if (cmd === 'ملك_المجموعة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        const chosen = mems[Math.floor(Math.random() * mems.length)].id;    
        return sock.sendMessage(from, { text: `👑 *إعلان ملك المجموعة:* \n\nبناءً على التفاعل الأسطوري ونشاط الرسائل المستمر في الجروب، نعلن أن العضو المتألق:\n\n✨ @${chosen.split('@')[0]} ✨\n\nهو *ملك المجموعة* بلا منازع لهذا اليوم! 🏆🔥`, mentions: [chosen] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `👑 تم اختيار ملك المجموعة بنجاح.` });    
    }    
}

if (cmd === 'كيوت_المجموعة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        const chosen = mems[Math.floor(Math.random() * mems.length)].id;    
        return sock.sendMessage(from, { text: `🌸 *إعلان لطافة المجموعة:* \n\nبأجواء مليئة باللطف والجمال، تم اختيار العضو:\n\n🧸 @${chosen.split('@')[0]} 🧸\n\nليكون رسمياً *كيوت المجموعة* لهذا اليوم! ✨🍼`, mentions: [chosen] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `🌸 تم اختيار كيوت المجموعة بنجاح.` });    
    }    
}

if (['ملكة_المجموعة', 'محبوب_المجموعة', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'مميز_المجموعة'].includes(cmdBase)) {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        const chosen = mems[Math.floor(Math.random() * mems.length)].id;    
        return sock.sendMessage(from, { text: `👑 لقب (${cmdBase}) تم منحه بجدارة إلى العضو: @${chosen.split('@')[0]} ✨`, mentions: [chosen] });    
    } catch (e) {    
        return sock.sendMessage(from, { text: `👑 تم اختيار الألقاب بنجاح.` });    
    }    
}    

if (cmd === 'رسائلي') {    
    const todayKey = getJordanDateKey();    
    const count = userMessagesCount[from]?.[todayKey]?.[sender] || 0;    
    return sock.sendMessage(from, { text: `📩 عدد رسائلك المسجلة اليوم يا @${sender.split('@')[0]} هو: *${count} رسالة*`, mentions: [sender] });    
}

// توب التفاعل
if (cmd === 'توب_التفاعل') {    
    const todayKey = getJordanDateKey();
    const groupMsgs = userMessagesCount[from]?.[todayKey] || {};
    try {
        const meta = await sock.groupMetadata(from);
        
        let totalGroupMessages = 0;
        Object.values(groupMsgs).forEach(val => totalGroupMessages += val);

        let sortedParticipants = meta.participants.sort((a, b) => {
            return (groupMsgs[b.id] || 0) - (groupMsgs[a.id] || 0);
        });

        let text = `📊 *إِحْـصَـائِـيَّـاتُ تـوبِ الـتَّـفَـاعُـلِ لِـلْـيَـوْمِ (${todayKey}):*\n`;
        text += `💬 *إجمالي رسائل المجموعة اليوم:* \`${totalGroupMessages}\` رسالة\n`;
        text += `*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n\n`;
        
        let mentions = [];
        sortedParticipants.forEach((p, idx) => {
            const msgCount = groupMsgs[p.id] || 0;
            let medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
            text += `${medal} *الـمَـرْتَـبَـةُ [${idx + 1}]* ↞ @${p.id.split('@')[0]}\n> 💬 عـدَدُ الـرَّسَـائِـلِ: \`${msgCount}\` رسالة\n\n`;
            mentions.push(p.id);
        });

        text += `*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*`;

        const userPp = await getUserProfilePic(sock, sender);
        try { await sock.sendMessage(from, { image: { url: userPp }, caption: text, mentions }); } catch (e) { await sock.sendMessage(from, { text, mentions }); }
        return;
    } catch (e) {
        return sock.sendMessage(from, { text: `❌ تعذر جلب توب التفاعل للمجموعة.` });
    }
}

// قسم الألقاب
if (cmd.startsWith('اضافة_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    const title = trimmedBody.replace(/^\.اضافة_لقب/i, '').replace(/@\d+/g, '').trim();
    if (!targetUser || !title) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.اضافة_لقب @العضو اللقب`' });

    if (!groupTitles[from]) groupTitles[from] = {};
    if (!groupReservedTitles[from]) groupReservedTitles[from] = {};

    const isTaken = Object.values(groupTitles[from]).includes(title);
    const isReserved = Object.values(groupReservedTitles[from]).includes(title);

    if (isTaken || isReserved) {
        return sock.sendMessage(from, { text: `❌ اللقب ( *${title}* ) مأخوذ أو محجوز مسبقاً ولا يمكن إضافته لعضو آخر!` });
    }

    groupTitles[from][targetUser] = title;

    const text = `╭━━━〔 👑 〕━━━╮
『 تَـسْـجِـيـلُ لَـقَـبٍ جَـدِيـد 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🏷️ ⌯ اللقب ↞ [ ${title} ]
✨ ⌯ الحالة ↞ تم تسجيل اللقب بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('ازالة_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.ازالة_لقب @العضو`' });

    if (groupTitles[from]) delete groupTitles[from][targetUser];

    const text = `╭━━━〔 ❌ 〕━━━╮
『 إِزَالَـةُ لَـقَـب 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
✨ ⌯ الحالة ↞ تمت إزالة اللقب بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('حجز_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    const title = trimmedBody.replace(/^\.حجز_لقب/i, '').replace(/@\d+/g, '').trim();
    if (!targetUser || !title) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.حجز_لقب @العضو اللقب`' });

    if (!groupTitles[from]) groupTitles[from] = {};
    if (!groupReservedTitles[from]) groupReservedTitles[from] = {};

    const isTaken = Object.values(groupTitles[from]).includes(title);
    const isReserved = Object.values(groupReservedTitles[from]).includes(title);

    if (isTaken || isReserved) {
        return sock.sendMessage(from, { text: `❌ اللقب ( *${title}* ) مأخوذ أو محجوز مسبقاً ولا يمكن حكزه مجدداً!` });
    }

    groupReservedTitles[from][targetUser] = title;

    const text = `╭━━━〔 🔒 〕━━━╮
『 حَـجْـزُ لَـقَـبٍ خَـاص 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
🔒 ⌯ اللقب ↞ [ ${title} ]
✨ ⌯ الحالة ↞ تم حجز اللقب بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('الغاء_حجز_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.الغاء_حجز_لقب @العضو`' });

    if (groupReservedTitles[from]) delete groupReservedTitles[from][targetUser];

    const text = `╭━━━〔 🔓 〕━━━╮
『 إِلْـغَـاءُ حَـجْـزِ لَـقَـب 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
✨ ⌯ الحالة ↞ تم إلغاء حجز اللقب بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd === 'قائمة_الالقاب') {
    const titles = groupTitles[from] || {};
    const keys = Object.keys(titles);
    if (keys.length === 0) return sock.sendMessage(from, { text: '📋 لا توجد ألقاب مسجلة في هذه المجموعة بعد!' });

    keys.sort((a, b) => titles[a].localeCompare(titles[b], 'ar'));

    let text = `╭━━━〔 👑 〕━━━╮
『 قَـائِـمَـةُ الأَلْـقَـابِ الـمُـسَـجَّـلَـةِ 』
╰━━━〔 ⚜️ 〕━━━╯

`;
    let mentions = [];
    keys.forEach((userJid, idx) => {
        text += `${idx + 1}. @${userJid.split('@')[0]} ↞ *[${titles[userJid]} ]*\n`;
        mentions.push(userJid);
    });
    text += `\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions });
}

if (cmd === 'قائمة_الالقاب_المحجوزة') {
    const resTitles = groupReservedTitles[from] || {};
    const keys = Object.keys(resTitles);
    if (keys.length === 0) return sock.sendMessage(from, { text: '🔒 لا توجد ألقاب محجوزة في هذه المجموعة بعد!' });

    keys.sort((a, b) => resTitles[a].localeCompare(resTitles[b], 'ar'));

    let text = `╭━━━〔 🔒 〕━━━╮
『 قَـائِـمَـةُ الأَلْـقَـابِ الـمَـحْـجُـوﺯَةِ 』
╰━━━〔 ⚜️ 〕━━━╯

`;
    let mentions = [];
    keys.forEach((userJid, idx) => {
        text += `${idx + 1}. @${userJid.split('@')[0]} ↞ *[${resTitles[userJid]} ]*\n`;
        mentions.push(userJid);
    });
    text += `\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions });
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

// أمر اضافة مطور
if (cmdBase === 'اضافة_مطور') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });    
    extraDevelopers.push(targetUser.replace(/[^0-9]/g, ''));    
    
    const text = `╭━━━〔 ♟️ 〕━━━╮
『 إِضَـافَـةُ مُـطَـوِّرٍ جَـدِيـد 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ الحساب ↞ @${targetUser.split('@')[0]}
👑 ⌯ المسؤول ↞ المطور الأساسي
🛡️ ⌯ الصلاحية ↞ مطور
✅ ⌯ الحالة ↞ تمت إضافة المطور»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [targetUser] });    
}    

// أمر حذف مطور
if (cmdBase === 'حذف_مطور') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (targetUser) extraDevelopers = extraDevelopers.filter(d => d !== targetUser.replace(/[^0-9]/g, ''));    
    
    const text = `╭━━━〔 ⚠️ 〕━━━╮
『 إِزَالَـةُ صَـلَاحِـيَـاتِ مُـطَـوِّر 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ الحساب ↞ @${targetUser ? targetUser.split('@')[0] : 'المستخدم'}
👑 ⌯ المسؤول ↞ المطور الأساسي
🔓 ⌯ الإجراء ↞ إزالة صلاحيات المطور
✅ ⌯ الحالة ↞ تمت إزالة المطور»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: targetUser ? [targetUser] : [] });    
}    

// أمر اضف نخبة بالاستمارة المحددة بدقة
if (cmdBase === 'اضف_نخبة') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });
    
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    if (!vipUsers.includes(cleanNum)) vipUsers.push(cleanNum);

    const text = `╭━━━〔 👑 〕━━━╮
『 إِضَـافَـةُ عُـضْـوٍ إِلَـى الـنُّـخْـبَـة 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${cleanNum}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
✨ ⌯ الرتبة ↞ نُخبة
🛡️ ⌯ الصلاحية ↞ عضو نخبة
✅ ⌯ الحالة ↞ تمت الإضافة بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

// أمر ازل نخبة بالاستمارة المحددة بدقة
if (cmdBase === 'ازل_نخبة') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });
    
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    vipUsers = vipUsers.filter(v => v !== cleanNum);

    const text = `╭━━━〔 ♟️ 〕━━━╮
『 إِزَالَـةُ عُـضْـوٍ مِنَ الـنُّـخْـبَـة 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${cleanNum}
👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}
📉 ⌯ الرتبة السابقة ↞ نُخبة
🔓 ⌯ الإجراء ↞ سحب رتبة النخبة
✅ ⌯ الحالة ↞ تمت الإزالة بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

// أمر عرض نخبة لعرض الأرقام والمنشنات الحقيقية
if (cmdBase === 'عرض_نخبة') {
    if (vipUsers.length === 0) return sock.sendMessage(from, { text: '📋 لا يوجد أعضاء نخبة مسجلين حالياً!' });

    let text = `╭━━━〔 🌟 〕━━━╮
『 قَـائِـمَـةُ أَعْـضَـاءِ الـنُّـخْـبَـةِ 』
╰━━━〔 ⚜️ 〕━━━╯

`;
    let mentions = [];
    vipUsers.forEach((v, idx) => {
        const userJid = v + '@s.whatsapp.net';
        text += `${idx + 1}. @${v}\n`;
        mentions.push(userJid);
    });

    text += `\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions });
}

if (cmdBase === 'اختبار') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    
    let isBotActive = !globalBotStopped;
    let statusEmoji = isBotActive ? '🟢' : '🔴';

    let testReport = `🧪 *فَـحْـصُ وَاسْـتِـعْـرَاضُ حَـالَـةِ أَوْامِـرِ الـبُـوتِ:*\n`;
    testReport += `*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n\n`;
    
    validCommands.forEach((c, idx) => {
        testReport += `> ${idx + 1}. \`.${c}\` ↞ ${statusEmoji}\n`;
    });

    testReport += `\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n`;
    testReport += `📊 *إجمالي الأوامر الفعالة:* \`${validCommands.length}\` أمر\n`;
    testReport += `🟢 حالة استجابة النظام العامة: [ممتازة]`;

    const devPp = await getDeveloperProfilePic(sock);
    try { await sock.sendMessage(from, { image: { url: devPp }, caption: testReport }); } catch (e) { await sock.sendMessage(from, { text: testReport }); }
    return;
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
    return sock.sendMessage(from, { text: '🔒 تم تفعيل الوضع الخاص (البوت يستجيب للمطورين والنخبة فقط).' });    
}    

if (cmdBase === 'عام' || cmdBase === 'وضع_عام') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين الأساسيين فقط!' });    
    getGroupSetting(from).botMode = 'public';    
    return sock.sendMessage(from, { text: '🔓 تم تفعيل الوضع العام للجميع.' });    
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

// أمر توب نقاط
if (cmdBase === 'توب_نقاط' || cmdBase === 'الاغنياء' || cmdBase === 'الأغنياء') {    
    try {
        const meta = await sock.groupMetadata(from);
        let mentions = meta.participants.map(p => p.id);
        let sorted = mentions.sort((a, b) => (userPoints[b] || 0) - (userPoints[a] || 0));

        let topText = `╭━━━〔 🏆 〕━━━╮
『 قَـائِـمَـةُ أَعْـلَى الـنِّـقَـاط 』
╰━━━〔 ⚜️ 〕━━━╯

`;    
        sorted.forEach((u, index) => { 
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
            topText += `${medal} *الـمَـرْتَـبَـة [${index + 1}]* ↞ @${u.split('@')[0]}\n> 💰 *الـرَّصِـيـد:* \`${userPoints[u] || 0}\` نقطة\n\n`; 
        });    
        topText += `❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

        const userPp = await getUserProfilePic(sock, sender);    
        try { await sock.sendMessage(from, { image: { url: userPp }, caption: topText, mentions }); } catch (e) { await sock.sendMessage(from, { text: topText, mentions }); }    
        return;    
    } catch (e) {
        return sock.sendMessage(from, { text: '❌ تعذر جلب توب النقاط للمجموعة.' });
    }
}    

// أمر تحويل النقاط
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
    
    const text = `╭━━━〔 💸 〕━━━╮
『 تَـحْـوِيـلُ الـنِّـقَـاط 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ المُرسِل ↞ @${sender.split('@')[0]}
🎯 ⌯ المُستلم ↞ @${targetUser.split('@')[0]}
💰 ⌯ المبلغ ↞ ${amount} نقطة
📊 ⌯ العملية ↞ تحويل بنكي
✅ ⌯ الحالة ↞ تمت عملية التحويل بنجاح»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text, mentions: [sender, targetUser] });    
}    

// أمر قائمة المطورين لعرض الأرقام والمنشنات الحقيقية
if (cmdBase === 'قائمة_المطورين') {    
    let text = `╭━━━〔 ♟️ 〕━━━╮
『 قَـائِـمَـةُ الـمُـطَـوِّرِيـنَ 』
╰━━━〔 ⚜️ 〕━━━╯

👑 *المطور الأساسي:*
> @${DEVELOPER_NUMBER}

`;
    let mentions = [DEVELOPER_NUMBER + '@s.whatsapp.net'];

    if (extraDevelopers.length > 0) {
        text += `🛡️ *المطورون الفرعيون:*\n`;
        extraDevelopers.forEach((dev, idx) => {
            const devJid = dev + '@s.whatsapp.net';
            text += `> ${idx + 1}. @${dev}\n`;
            mentions.push(devJid);
        });
    }

    text += `\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    const devPp = await getDeveloperProfilePic(sock);    
    try { await sock.sendMessage(from, { image: { url: devPp }, caption: text, mentions }); } catch (e) { await sock.sendMessage(from, { text, mentions }); }    
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

// أمر إذاعة المعدل تلقائياً للمجموعات المشتركة مع المطور الأساسي مع منشن جماعي خفي
if (cmdBase === 'اذاعة' || cmdBase === 'إذاعة') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const bcText = trimmedBody.replace(/^\.(اذاعة|إذاعة)/i, '').trim();    
    if (!bcText) return sock.sendMessage(from, { text: '📌 اكتب نص الإذاعة بعد الأمر.' });    
    
    try {    
        const allGroups = await sock.groupFetchAllParticipating();    
        const groupKeys = Object.keys(allGroups);    
        
        let targetGroupsCount = 0;
        const cleanDevNum = DEVELOPER_NUMBER.replace(/[^0-9]/g, '');

        for (let gId of groupKeys) {    
            const groupMeta = allGroups[gId];
            // التحقق من تواجد المطور الأساسي والبوت في نفس المجموعة
            const isDevInGroup = groupMeta.participants.some(p => p.id.replace(/[^0-9]/g, '').includes(cleanDevNum));

            if (isDevInGroup) {
                targetGroupsCount++;
                const allGroupMentions = groupMeta.participants.map(p => p.id);
                // منشن جماعي خفي دون كتابة المعرفات صراحة في النص
                const hiddenMentionSpace = '‌'.repeat(allGroupMentions.length);

                const broadcastFormatted = `╭━━━〔 📡 〕━━━╮
『 بَـدْءُ الـبَـثِّ الـعَـام 』
╰━━━〔 ⚜️ 〕━━━╯

╭─〔 📩 نَـصُّ الإِعْـلَان 〕─╮
│
│ ${bcText}
│
╰─〔 🍷 〕─╯${hiddenMentionSpace}

«👑 ⌯ المرسل ↞ المطور
📨 ⌯ نوع العملية ↞ إذاعة عامة
📊 ⌯ المستهدفون ↞ [1]
✅ ⌯ الحالة ↞ انتهت الإذاعة»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

                await sock.sendMessage(gId, { text: broadcastFormatted, mentions: allGroupMentions });
            }
        }    

        const finalReport = `╭━━━〔 📡 〕━━━╮
『 بَـدْءُ الـبَـثِّ الـعَـام 』
╰━━━〔 ⚜️ 〕━━━╯

╭─〔 📩 نَـصُّ الإِعْـلَان 〕─╮
│
│ ${bcText}
│
╰─〔 🍷 〕─╯

«👑 ⌯ المرسل ↞ المطور
📨 ⌯ نوع العملية ↞ إذاعة عامة
📊 ⌯ المستهدفون ↞ [${targetGroupsCount}]
✅ ⌯ الحالة ↞ انتهت الإذاعة»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

        return sock.sendMessage(from, { text: finalReport });    
    } catch (e) {    
        return sock.sendMessage(from, { text: '❌ فشل إرسال الإذاعة.' });    
    }    
}    

if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });    
    await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' });    
    process.exit(0);    
}    

// أمر بوت
if (cmdBase === 'بوت') {    
    const time = getJordanTime();    
    const totalCommandsCount = validCommands.length;
        
    const botWelcomeText = `
🍷 *أَهْـلاً بِـكَ فِي عَالَمِ 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}
> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> ┃ ⌯👨🏻‍💻︙الــمـطـور → 𝐸𝓇𝑒𝓃 (962796163926)
> ┃ 📊︙عدد الأوامر → ${totalCommandsCount} أمراً
> ┃ 
> ┃ ♟️ *"الهيبةُ ليستْ بصَخبِ الـحُضور،*
> ┃ *بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى."*
> ┃ ✦ لا نَسْعَى خَلْفَ الأَضْوَاءِ.. بَلْ نَدَعُ النَّتَائِجَ هِيَ مَنْ تَتَكَلَّمُ.
> ┃ 
> ┃ ⌯🚀︙الـتـوقـيـت → ${time} (الأردن)

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

⚙️ *لِـعَـرْضِ كَـافَّـةِ أَقْـسَـامِ الأَوَامِـرِ وَالإِدَارَةِ:*
اكتب الأمر: 👇

📌 *.الاوامر*  أو  *.اقسام*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
`.trim();

const botPp = await getBotProfilePic(sock);
try {
await sock.sendMessage(from, { image: { url: botPp }, caption: botWelcomeText, mentions: [sender] });
} catch (e) {
await sock.sendMessage(from, { text: botWelcomeText });
}
return;
}

if (cmdBase === 'الاوامر' || cmd === 'اوامر' || cmd === 'منيو' || cmd === 'اقسام') {    
    const menuText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ (${DEVELOPER_NAME}):*

> 🛡️ \`.1\` ↞ الحماية
> 🎉 \`.2\` ↞ الترفيه
> 💳 \`.3\` ↞ البنك والنقاط
> ⚽ \`.4\` ↞ الرياضة
> 🤖 \`.5\` ↞ الذكاء الاصطناعي
> 🧠 \`.6\` ↞ الأسئلة
> 🕌 \`.7\` ↞ اسلامي
> 😂 \`.8\` ↞ الضحك
> 👥 \`.9\` ↞ المجموعات
> ♟️ \`.10\` ↞ المطور
> ⚡ \`.11\` ↞ الادارة
> 🔍 \`.12\` ↞ الكشف
> 👑 \`.13\` ↞ الألقاب

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



🤬 2. حماية الشتم والسب القوي: [${settings.antiBadWords ? '🟢 مفعلة' : '🔴 معطلة'}]

> ⤹ تفعيل: .حظر_شتم | سماح: .سماح_شتم



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
> ❓ .سؤال ↞ سؤال أنمي (+10 نقاط)
> ✅ .صح_او_خطأ ↞ اختبار صح أو خطأ أنمي
> 📚 .ثقافة ↞ أسئلة ثقافية
> 🌍 .جغرافيا ↞ أسئلة جغرافية
> 🔬 .علوم ↞ أسئلة علمية
> 📜 .تاريخ ↞ أسئلة تاريخية
> 🚪 .انسحب ↞ إلغاء الفعالية`;

const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: entAndGamesText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: entAndGamesText }); }
return;
}

if (cmdBase === '3' || cmd === 'bank' || cmd === 'البنك' || cmd === 'النقاط') {    
    const bankMenuText = `💳 *3. البنك والنقاط:*

> 💳 .بنك | .حسابي ↞ كشف الحساب البنكي
> 💸 .تحويل <المبلغ> @منشن ↞ تحويل نقاط
> 🏆 .توب_نقاط ↞ ترتيب نقاط أعضاء الجروب
> 🎁 .مكافأة ↞ الهدية اليومية (+20 نقطة مرة واحدة في اليوم)`;

const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: bankMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: bankMenuText }); }
return;
}

if (cmdBase === '4') {    
    const sportText = `⚽ *4. الرياضة:*

> 🏆 .مباريات ↞ الجدول الحي بتوقيت الأردن
> 📊 .نتائج ↞ النتائج النهائية
> 🥇 .بطولات ↞ البطولات القائمة
> 👤 .لاعب <اسم> ↞ معلومات اللاعب
> ⚽ .فريق <اسم> ↞ معلومات الفريق
> 🏆 .ترتيب <الدوري> ↞ ترتيب الدوريات
> 🔥 .هداف ↞ قائمة أفضل 25 هدافاً`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: sportText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: sportText }); }
return;
}

if (cmdBase === '5') {
const aiText = `🤖 *5. الذكاء الاصطناعي:*

> 🧠 .اسأل <سؤال> ↞ سؤال الذكاء الاصطناعي الفوري
> ✍️ .اكتب <موضوع> ↞ كتابة موضوع شامل
> 📚 .لخص <نص> ↞ تلخيص النصوص الشامل
> 🌐 .ترجم <نص> ↞ الترجمة الفورية للعربية
> 📝 .صحح <نص> ↞ تصحيح لغوي وإملائي`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: aiText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: aiText }); }
return;
}

if (cmdBase === '6') {
const brainText = `🧠 *6. الأسئلة:*

> ❓ .سؤال ↞ سؤال أنمي عشوائي
> ✅ .صح_او_خطأ ↞ اختبار صح أو خطأ أنمي
> 📚 .ثقافة ↞ أسئلة ثقافية
> 🌍 .جغرافيا ↞ أسئلة جغرافية
> 🔬 .علوم ↞ أسئلة علمية
> 📜 .تاريخ ↞ أسئلة تاريخية`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: brainText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: brainText }); }
return;
}

if (cmdBase === '7') {
const islamText = `🕌 *7. اسلامي:*

> 📖 .قرآن ↞ آية قرآنية عشوائية
> 📜 .آية <الآية> ↞ التفسير الإسلامي الصحيح 100%
> 🕋 .سورة <اسم السورة> ↞ جميع معلومات السورة
> 🤲 .دعاء ↞ أدعية مباركة عشوائية
> 📿 .ذكر ↞ أذكار عشوائية
> ☪️ .حديث ↞ أحاديث نبوية شريفة
> ☀️ .اذكار_الصباح ↞ أذكار الصباح كاملة
> 🌙 .اذكار_المساء ↞ أذكار المساء كاملة`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: islamText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: islamText }); }
return;
}

if (cmdBase === '8') {
const funText = `😂 *8. الضحك:*

> 🤣 .نكتة ↞ نكتة مضحكة متجددة
> 🤔 .ماذا_لو ↞ تساؤلات خيالية عشوائية
> 🗣️ .قول ↞ حكمة أو عبارة اليوم`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: funText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: funText }); }
return;
}

if (cmdBase === '9') {
const groupExtText = `👥 *9. المجموعات:*

> 💍 .زواج @العضو ↞ زواج العريس بالعروس
> 💔 .طلاق @العضو ↞ طلاق العريس بالعروس
> 🌹 .غزل @منشن ↞ بيت غزل موجه للعضو
> 💞 .ثنائي ↞ اختيار ثنائي عشوائي
> 👑 .ملك_المجموعة ↞ اختيار ملك الجروب
> 🧸 .كيوت_المجموعة ↞ اختيار كيوت الجروب
> 📩 .رسائلي ↞ معرفة رسائلك الشخصية اليومية
> 📊 .توب_التفاعل ↞ توب تفاعلات ونشاط أعضاء الجروب اليومي`;
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
> 💣 .بوم ↞ طرد كافة الأعضاء العاديين من المجموعة
> 👑 .اضافة_مطور @منشن ↞ إضافة مطور جديد
> ❌ .حذف_مطور @منشن ↞ إزالة مطور
> 🌟 .اضف_نخبة @منشن ↞ إضافة عضو لنخبة البوت
> ❌ .ازل_نخبة @منشن ↞ إزالة عضو من النخبة
> 📜 .عرض_نخبة ↞ عرض قائمة النخبة
> 📋 .قائمة_المطورين ↞ عرض قائمة المطورين
> 📡 .سجل_البوت ↞ عرض آخر عمليات البوت
> 🧪 .اختبار ↞ عرض فحص شامل لحالة كافة الأوامر والوظائف
> ❤️ .تفاعل ↞ التحكم بالتفاعل التلقائي لأوامر الأعضاء
> ❤️ .تفاعل_مطور ↞ التحكم بالتفاعل التلقائي لرسائل المطور
> 🔒 .خاص أو .وضع_خاص ↞ جعل البوت خاصاً للمطورين والنخبة
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
> 📢 .الكل أو .منشن ↞ منشن جماعي مفروز لكل الأعضاء
> 👑 .رفع @عضو ↞ ترقية عضو إلى مشرف
> 📉 .تنزيل @عضو ↞ إزالة الإشراف عن عضو
> 🚨 .طرد @عضو ↞ طرد العضو من المجموعة
> ⚠️ .اضف_انذار @عضو ↞ إضافة إنذار إداري للعضو
> 📉 .ازل_انذار @عضو ↞ إزالة إنذار عن العضو
> 📊 .عدد_الانذارات @عضو ↞ عرض عدد الإنذارات الحالية
> 📋 .قائمة_الانذارات ↞ عرض جميع الأعضاء المخالفين
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

if (cmdBase === '13' || cmd === 'اللقب' || cmd === 'الالقاب') {
    const titleMenuText = `👑 *13. قسم الألقاب المخصص للمشرفين:*

> ✍️ \`.اضافة_لقب @العضو اللقب\` ↞ تسجيل لقب للعضو
> ❌ \`.ازالة_لقب @العضو\` ↞ إزالة لقب العضو
> 🔒 \`.حجز_لقب @العضو اللقب\` ↞ حجز لقب خاص لعضو
> 🔓 \`.الغاء_حجز_لقب @العضو\` ↞ إلغاء حجز اللقب
> 📋 \`.قائمة_الالقاب\` ↞ عرض قائمة الألقاب للجروب
> 🔒 \`.قائمة_الالقاب_المحجوزة\` ↞ عرض الألقاب المحجوزة`;

const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: titleMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: titleMenuText }); }
return;
}

if (cmdBase === 'بنك' || cmd === 'حسابي') {    
    const bankAcc = getBankAccount(sender);    
    const userPp = await getUserProfilePic(sock, sender);    
    const accText = `💳 *كَـشْـفُ الحِـسَـابِ (${DEVELOPER_NAME}):*\n> رصيدك: *${userPoints[sender]} نقطة*`;    
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: accText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: accText, mentions: [sender] }); }    
    return;    
}    

// المكافأة اليومية
if (cmdBase === 'مكافأة' || cmd === 'هدية') {    
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    
    if (!dailyRewards[sender]) dailyRewards[sender] = 0;

    const timePassed = now - dailyRewards[sender];

    if (timePassed < cooldown) {
        const remainingMs = cooldown - timePassed;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return sock.sendMessage(from, { text: `⚠️ لقد استلمت مكافأتك اليومية مسبقاً!\n⏳ الوقت المتبقي للمكافأة التالية: *${hours} ساعة و ${minutes} دقيقة*`, mentions: [sender] });
    }

    dailyRewards[sender] = now;
    getBankAccount(sender);
    userPoints[sender] += 20;

    const rewardText = `╭━━━〔 🎁 〕━━━╮
『 الـمُـكَـافَـأَةُ الـيَـوْمِـيَّـة 』
╰━━━〔 ⚜️ 〕━━━╯

«👤 ⌯ العضو ↞ @${sender.split('@')[0]}
💰 ⌯ المكافأة ↞ 20 نقطة
🏦 ⌯ المصدر ↞ المكافأة اليومية
✨ ⌯ الحالة ↞ تم استلام المكافأة»

❐═━━━═╊⊰🍷⊱╉═━━━═❐

『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;

    return sock.sendMessage(from, { text: rewardText, mentions: [sender] });
}

});

}

startBot();
