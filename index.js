import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

// قائمة كلمات الشتم القوية الحصرية التي تمس الشرف
const strictBadWords = ['كس', 'قحبة', 'قحبه', 'شرموط', 'شرموطة', 'شرموطه', 'منيوك', 'عرص', 'قواد', 'طيز', 'زب'];

// موسوعة حكم وأقوال شخصيات الأنمي (موسوعة ضخمة مطورة بـ 5000+ عنصر)
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

// قاموس القرآن الكريم الضخم والشامل (آيات متعددة)
const quranDatabase = [
    "﴿اللَّهُ لَا إِلٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ﴾ [البقرة: 255]",
    "﴿إِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ فَإِنَّ مَعَ الْعُسْرِ يُسْرًا﴾ [الشرح: 5-6]",
    "﴿وَاصْبِرْ لِحُكْمِ رَبِّكَ فَإِنَّكَ بِأَعْيُنِنَا وَسَبِّحْ بِحَمْدِ رَبِّكَ حِينَ تَقُومُ﴾ [الطور: 48]",
    "﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾ [طه: 114]",
    "﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾ [البقرة: 153]",
    "﴿رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ﴾ [البقرة: 201]",
    "﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾ [الرعد: 28]",
    "﴿وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ﴾ [الطلاق: 2-3]",
    "﴿رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي﴾ [طه: 25-26]",
    "﴿فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ﴾ [البقرة: 152]"
];

// مستودع الغزل
const ghazalsList = [
    "عيناكِ أرض لا خائن فيها، وجمالكِ حقيقة لا جدال فيها.",
    "لو كان الحب كلمات تُكتب لإنتهت أقلامي، لكن الحب أرواح تُوهب فهل تكفيكِ روحي؟",
    "في سكون الليل وفي زحمة النهار، تبقين أنتِ الفكرة الوحيدة التي تجعل قلبي يبتسم.",
    "أنتِ لستِ جزءاً من حياتي، أنتِ الحياة بكل تفاصيلها وروعتها.",
    "كالماء أنتِ، لا أستطيع العيش بدونكِ، وكالهواء تتنفسكِ روحي في كل لحظة."
];

// مستودع النكت
const jokesList = [
    "محشش سألوه: شو رأيك بالزواج المبكر؟ قال: الساعة قديش؟! 🤣",
    "واحد بخيل أخذ ولده على السوبر ماركت، الولد مسك شوكولاتة وقال: بحبها! الأب قاله: بوسها ورجعها! 😂",
    "محشش شاف لافتة مكتوب عليها 'ممنوع الوقوف'، انسدح! 🤣",
    "واحدة بتقول لزوجها: ليتني تزوجت إبليس ولا تزوجتك! قالها: شرعاً لا يجوز الأخ يتزوج أخته! 😭"
];

// مستودع ماذا لو
const whatIfList = [
    "ماذا لو استيقظت غداً ووجدت نفسك الشخص الوحيد المتبقي على كوكب الأرض؟ 🌍",
    "ماذا لو كان بإمكانك السفر عبر الزمن ولكن لمرة واحدة فقط دون العودة؟ ⏳",
    "ماذا لو استطعت قراءة أفكار الآخرين لمدة 24 ساعة فقط؟ 🧠"
];

// مستودع الأقوال
const quotesList = [
    "الهيبةُ ليستْ بصَخبِ الـحُضور، بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى.",
    "لا تندم على ماضٍ علمك كيف تكون قويًا اليوم.",
    "القوة ليست في عدم السقوط، بل في القيام مجدداً في كل مرة تسقط فيها."
];

// مستودع الأدعية
const duaList = [
    "اللَّهُمَّ إِنِّي أَسْأَلُكَ العَفْوَ وَالعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ.",
    "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي.",
    "اللَّهُمَّ آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ."
];

// مستودع الأحاديث
const hadithList = [
    "«إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى» [صحيح البخاري]",
    "«المُسْلِمُ مَنْ سَلِمَ المُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ» [متفق عليه]"
];

process.on('uncaughtException', (err) => console.log('خطأ:', err));
process.on('unhandledRejection', (err) => console.log('خطأ معالجة:', err));

const DEVELOPER_NUMBER = '962796163926';
const DEVELOPER_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
let extraDevelopers = []; 
let vipUsers = []; 
let botLogs = [];

function getJordanTime() {
    return new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hour12: true });
}

function getJordanDateKey() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' });
}

function logBotAction(action) {
    const time = getJordanTime();
    botLogs.unshift(`> 🔹 [${time}] ↞ ${action}`);
    if (botLogs.length > 20) botLogs.pop();
}

let userPoints = {};
let userWarnings = {};
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
    if (userWarnings[userJid].length === 0) delete userWarnings[userJid];
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
'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
'الترفيه', 'العاب', 'فعاليات', 'bank', 'البنك', 'النقاط',
'حسابي', 'بنك', 'تحويل', 'توب_نقاط', 'الاغنياء', 'الأغنياء', 'مكافأة', 'هدية',
'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'لوخيروك', 'حكمة',
'صراحة', 'تحدي', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'انسحب',
'زواج', 'طلاق', 'غزل', 'ثنائي', 'ملك_المجموعة', 'ملكة_المجموعة', 'محبوب_المجموعة', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'مميز_المجموعة', 'كيوت_المجموعة',
'رسائلي', 'توب_التفاعل',
'المطور', 'مطور', 'الادارة', 'الاداره',
'اضافة_مطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار',
'اضف_انذار', 'ازل_انذار', 'حذف_انذار', 'عدد_الانذارات', 'قائمة_الانذارات',
'حظر رابط', 'سماح رابط', 'حظر شتم', 'سماح شتم', 'حظر جهات', 'سماح جهات',
'ايقاف_البوت', 'تفعيل_البوت', 'إيقاف_البوت', 'إيقاف البوت', 'تفعيل البوت',
'اضف_نخبة', 'ازل_نخبة', 'عرض_نخبة',
'قران', 'قرآن', 'دعاء', 'ذكر', 'حديث', 'أذكار', 'اذكار', 'اذكار_الصباح', 'اذكار_المساء', 'اذكار_الاستيقاظ', 'اذكار_الصلاة', 'اذكار_المسجد',
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
        const welcomeMsg = `🌾┊تـرحـيـب:

❋・────━【🗡】━────・❋

- مـحـارب جـديـد يـحـط الـرحـال فـي أرض ڤـيـنـلانـد، أهـلاً وسـهـلاً ومـرحـبـاً بـك، نـتـمـنـى أن تـكـون رحـلـتـك مـلـيـئـة بـالـمـجـد والـمـغـامـرات.

❋・────━【🗡】━────・❋

🌙┆الـعـضـو ↜『@${user.split('@')[0]}』

❋・────━【🗡】━────・❋

※ نــرجــوا مـنـك دخــول رابــط إعـلانـات نـقـابـة إنـجـلانـد 🗡️

『 https://chat.whatsapp.com/IBy60bdcmcvCP8GPwtM1wq?s=cl&p=a&mlu=4&ilr=4 』

❋・────━【🗡】━────・❋

※ ونــرجــوا مــنــك أيــضــاً دخــول رابــط صـحـيـفـة ڤـيـنـلانـد ❄

『 https://chat.whatsapp.com/KY5GUeANAvO8px1An1FZeV 』

❋・────━【🗡】━────・❋

🫎┊مـع تـحـيـات ˼‏🗡️˹ ⤺

『𝑽. 𝑳. 𝑫 ⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨ℕ𝐷』`;

        await sock.sendMessage(id, { image: { url: userPp }, caption: welcomeMsg, mentions: [user] });
    }
} else if (action === 'remove' && settings.goodbye) {
    for (let user of participants) {
        const userPp = await getUserProfilePic(sock, user);
        const goodbyeMsg = `🍂┊تـوديـع:

❋・────━【🗡】━────・❋

- مُـحـارب يـغـادر أرض ڤـيـنـلانـد، وتـنـطـوي صـفـحـة مـن رحـلـتـه بـيـنـنـا.

❋・────━【🗡】━────・❋

🌙┆الـعـضـو ↜『@${user.split('@')[0]}』

❋・────━【🗡】━────・❋

※ نـتـمـنـى لـك الـتـوفـيـق فـي رحـلـتـك الـقـادمـة، وتـبـقـى ذكـريـاتـك جـزءًا مـن تـاريـخ ڤـيـنـلانـد.

❋・────━【🗡】━────・❋

※ سـتـبـقـى أبـواب ڤـيـنـلانـد مـفـتـوحـة لـمـن أراد الـعـودة يـومًـا.

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

if (globalBotStopped && !isSenderDev) return;

const groupSettingsForCheck = getGroupSetting(from);

if (groupSettingsForCheck.botMode === 'private' && !isSenderDev && !isVipUser(sender)) {
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
            if (shouldLockChat) { await sock.groupSettingUpdate(from, 'announcement'); }
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
                    
                if (['disassemble', 'typing', 'arrange', 'reverseGame'].includes(type) && cat) {    
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

if (['قفل', 'غلق', 'فتح', 'حذف', 'مسح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'اضف_انذار', 'ازل_انذار', 'حذف_انذار', 'صفر', 'عدد_الانذارات', 'قائمة_الانذارات', 'كتم', 'الغاء_كتم', 'فك_كتم', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط', 'اضافة_لقب', 'ازالة_لقب', 'حجز_لقب', 'الغاء_حجز_لقب'].includes(cmdBase) || cmd.startsWith('تغيير_الاسم') || cmd.startsWith('تغيير_الوصف') || cmd === 'تفعيل ادمن' || cmd === 'توقيف ادمن' || cmd === 'تفعيل ترحيب' || cmd === 'توقيف ترحيب' || cmd === 'تفعيل توديع' || cmd === 'توقيف توديع' || cmd === 'رابط_الجروب' || cmd === 'الرابط' || cmd === 'غلق') {    
    if (!isSenderAdmin && !isSenderDev) {    
        return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!' });    
    }    
}    

if (cmdBase === 'قفل' || cmd === 'غلق') {    
    await sock.groupSettingUpdate(from, 'announcement');    
    const text = `╭━━━〔 🔒 〕━━━╮\n『 إِغْـلَاقُ الـمَـجْـمُـوعَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔒 ⌯ الإجراء ↞ إغلاق المجموعة\n🛡️ ⌯ الحالة ↞ تم إغلاق المجموعة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    

if (cmdBase === 'فتح') {    
    await sock.groupSettingUpdate(from, 'not_announcement');    
    const text = `╭━━━〔 🔓 〕━━━╮\n『 فَـتْـحُ الـمَـجْـمُـوعَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔓 ⌯ الإجراء ↞ فتح المجموعة\n✨ ⌯ الحالة ↞ أصبحت المجموعة مفتوحة للجميع»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    

if (cmdBase === 'حذف' || cmdBase === 'مسح') {    
    const q = msg.message.extendedTextMessage?.contextInfo;    
    if (!q) return sock.sendMessage(from, { text: '📌 رد على الرسالة المراد حذفها.' });    
    try { await sock.sendMessage(from, { delete: { remoteJid: from, id: q.stanzaId, participant: q.participant } }); } catch (e) {}    
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

if (cmdBase === 'رفع' || cmdBase === 'ترقية') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.رفع @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'promote');    
        const text = `╭━━━〔 👑 〕━━━╮\n『 تَـرْقِـيَـةٌ إِدَارِيَّـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🏆 ⌯ الرتبة الجديدة ↞ مشرف\n✨ ⌯ الحالة ↞ تمت الترقية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
    } catch (e) { return sock.sendMessage(from, { text: '❌ فشل رفع العضو، تأكد أن البوت مشرف ولديه الصلاحيات.' }); }    
}    

if (cmdBase === 'ازل' || cmdBase === 'تنزيل') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.ازل @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'demote');    
        const text = `╭━━━〔 ♟️ 〕━━━╮\n『 سَـحْـبُ الـصَّـلَاحِـيَـات 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📉 ⌯ الرتبة السابقة ↞ مشرف\n👤 ⌯ الرتبة الحالية ↞ عضو\n✅ ⌯ الحالة ↞ تمت إزالة الإشراف بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
    } catch (e) { return sock.sendMessage(from, { text: '❌ فشل تنزيل العضو، تأكد أن البوت مشرف.' }); }    
}    

if (cmdBase === 'طرد') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.طرد @عضو`' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        const text = `╭━━━〔 ⚔️ 〕━━━╮\n『 قَـرَارُ الإِبْـعَـاد 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📌 ⌯ الإجراء ↞ الطرد من المجموعة\n⚖️ ⌯ السبب ↞ مخالفة قوانين المجموعة\n✅ ⌯ الحالة ↞ تمت عملية الطرد بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
    } catch (e) { return sock.sendMessage(from, { text: '❌ فشل طرد العضو، تأكد أن البوت مشرف.' }); }    
}    

if (cmdBase === 'بوم') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطور الأساسي فقط!' });
    try {
        const meta = await sock.groupMetadata(from);
        let devCleanNum = DEVELOPER_NUMBER.replace(/[^0-9]/g, '');
        let botCleanNum = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';

        let usersToKick = meta.participants
            .map(p => p.id)
            .filter(id => {
                let cleanId = id.replace(/[^0-9]/g, '');
                return !cleanId.includes(devCleanNum) && !devCleanNum.includes(cleanId) &&
                       !cleanId.includes(botCleanNum) && !botCleanNum.includes(cleanId);
            });

        if (usersToKick.length === 0) {
            return sock.sendMessage(from, { text: `⚠️ لا توجد أعضاء آخرين لطردهم.` });
        }

        await sock.sendMessage(from, { text: `💣 *جاري إخلاء المجموعـة وطرد الجميع دفعة واحدة (${usersToKick.length} عضو)...*` });
        await sock.groupParticipantsUpdate(from, usersToKick, 'remove');
        return sock.sendMessage(from, { text: `💥 تمت عملية الإخلاء الكلي بنجاح!` });
    } catch (e) { return sock.sendMessage(from, { text: '❌ تعذر تنفيذ أمر الإخلاء.' }); }
}

if (cmdBase === 'اضف_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.اضف_انذار @عضو`' });    
    const activeWarnings = addWarningToUser(targetUser);

    if (activeWarnings >= 3) {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        delete userWarnings[targetUser];    
        return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]} لتجاوزه الحد الأقصى من الإنذارات!`, mentions: [targetUser] });    
    }    

    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 إِنْـذَارٌ إِدَارِيّ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📌 ⌯ السبب ↞ مخالفة قوانين المجموعة\n🔢 ⌯ عدد التحذيرات ↞ [${activeWarnings}/3]\n⚠️ ⌯ الحالة ↞ تم تسجيل التحذير»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
}    

if (cmdBase === 'ازل_انذار' || cmdBase === 'حذف_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.ازل_انذار @عضو`' });    
    removeOneWarningFromUser(targetUser);
    const text = `╭━━━〔 ✅ 〕━━━╮\n『 إِلْـغَـاءُ الإِنْـذَار 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🧾 ⌯ الإجراء ↞ حذف التحذير\n✨ ⌯ الحالة ↞ تمت إعادة ضبط التحذيرات»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
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

if (cmdBase === 'قائمة_الانذارات') {
    let allUsers = Object.keys(userWarnings);
    let activeWarnedUsers = allUsers.filter(u => getUserWarningCount(u) > 0);
    if (activeWarnedUsers.length === 0) return sock.sendMessage(from, { text: '📋 لا يوجد أي عضو لديه إنذارات نشطة حالياً!' });

    let text = `╭━━━〔 ⚠️ 〕━━━╮\n『 قَـائِـمَـةُ الإِنْـذَارَاتِ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;
    let mentions = [];
    activeWarnedUsers.forEach((u) => {
        const count = getUserWarningCount(u);
        text += `«👤 ⌯ العضو ↞ @${u.split('@')[0]}\n🔢 ⌯ عدد التحذيرات ↞ [${count}/3]\n\n`;
        mentions.push(u);
    });
    text += `❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions });
}

if (cmdBase === 'كتم') {    
    const parts = trimmedBody.split(' ');    
    const mins = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(mins) || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.كتم <دقائق> @عضو`' });    
    if (!mutedUsers[from]) mutedUsers[from] = {};    
    mutedUsers[from][targetUser] = Date.now() + (mins * 60 * 1000);    
    const text = `╭━━━〔 🔇 〕━━━╮\n『 إِسْـكَـاتُ عُـضْـو 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔇 ⌯ الإجراء ↞ تفعيل الكتم\n⏳ ⌯ المدة ↞ [${mins} دقيقة]\n✅ ⌯ الحالة ↞ تم تنفيذ الكتم»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
}    

if (cmdBase === 'الغاء_كتم' || cmdBase === 'فك_كتم') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.الغاء_كتم @عضو`' });    
    if (mutedUsers[from]) delete mutedUsers[from][targetUser];    
    const text = `╭━━━〔 🔊 〕━━━╮\n『 إِلْـغَـاءُ الـكَـتْـم 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔊 ⌯ الإجراء ↞ إلغاء الكتم\n✅ ⌯ الحالة ↞ أصبح العضو غير مكتوم»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });    
}    

if (cmd === 'تفعيل ادمن') { getGroupSetting(from).adminOnly = true; return sock.sendMessage(from, { text: '🟢 تم تفعيل وضع الآدمن.' }); }    
if (cmd === 'توقيف ادمن') { getGroupSetting(from).adminOnly = false; return sock.sendMessage(from, { text: '🔴 تم إيقاف وضع الآدمن.' }); }    
if (cmd === 'تفعيل ترحيب') { getGroupSetting(from).welcome = true; return sock.sendMessage(from, { text: '🟢 تم تفعيل الترحيب.' }); }    
if (cmd === 'توقيف ترحيب') { getGroupSetting(from).welcome = false; return sock.sendMessage(from, { text: '🔴 تم إيقاف الترحيب.' }); }    
if (cmd === 'تفعيل توديع') { getGroupSetting(from).goodbye = true; return sock.sendMessage(from, { text: '🟢 تم تفعيل التوديع.' }); }    
if (cmd === 'توقيف توديع') { getGroupSetting(from).goodbye = false; return sock.sendMessage(from, { text: '🔴 تم إيقاف التوديع.' }); }    

if (cmd.startsWith('تغيير_الاسم')) {    
    const newName = trimmedBody.replace(/^\.تغيير_الاسم/i, '').trim();    
    if (!newName) return sock.sendMessage(from, { text: '📌 يرجى كتابة الاسم الجديد.' });    
    try { await sock.groupUpdateSubject(from, newName); return sock.sendMessage(from, { text: `✅ تم تغيير اسم المجموعة إلى: *${newName}*` }); } catch (e) { return sock.sendMessage(from, { text: '❌ فشل التغيير تأكد أن البوت مشرف.' }); }    
}    
if (cmd.startsWith('تغيير_الوصف')) {    
    const newDesc = trimmedBody.replace(/^\.تغيير_الوصف/i, '').trim();    
    if (!newDesc) return sock.sendMessage(from, { text: '📌 يرجى كتابة الوصف الجديد.' });    
    try { await sock.groupUpdateDescription(from, newDesc); return sock.sendMessage(from, { text: `✅ تم تغيير وصف المجموعة بنجاح!` }); } catch (e) { return sock.sendMessage(from, { text: '❌ فشل التغيير تأكد أن البوت مشرف.' }); }    
}    

if (cmd === 'رابط_الجروب' || cmd === 'الرابط') {    
    try {    
        const code = await sock.groupInviteCode(from);    
        const groupMeta = await sock.groupMetadata(from);
        const text = `╭━━━〔 🔗 〕━━━╮\n『 رَابِـطُ الـمَـجْـمُـوعَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👥 ⌯ المجموعة ↞ ${groupMeta.subject}\n👑 ⌯ الطلب بواسطة ↞ @${sender.split('@')[0]}\n🔗 ⌯ الرابط ↞ https://chat.whatsapp.com/${code}\n✅ ⌯ الحالة ↞ تم جلب الرابط»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        return sock.sendMessage(from, { text, mentions: [sender] });    
    } catch (e) { return sock.sendMessage(from, { text: '❌ فشل جلب الرابط تأكد أن البوت مشرف.' }); }    
}    

if (cmdBase === 'حظر_رابط' || cmdBase === 'حظر رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮\n『 تَـفْـعِـيـلُ مَـانِـعِ الروابط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ منع الروابط\n✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_رابط' || cmdBase === 'سماح رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 تَـعْـطِـيـلُ مَـانِـعِ الروابط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ الروابط\n⛔ ⌯ الحالة ↞ تم تعطيل الحماية»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'حظر_شتم' || cmdBase === 'حظر شتم' || cmdBase === 'حظر_سب') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮\n『 تَـفْـعِـيـلُ مَـانِـعِ الشتم والسب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ منع الشتم والسب\n✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_شتم' || cmdBase === 'سماح شتم' || cmdBase === 'سماح_سب') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 تَـعْـطِـيـلُ مَـانِـعِ الشتم والسب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ الشتم والسب\n⛔ ⌯ الحالة ↞ تم تعطيل الحماية»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'حظر_جهات' || cmdBase === 'حظر جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮\n『 تَـفْـعِـيـلُ مَـانِـعِ جهات الاتصال 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ منع جهات الاتصال\n✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_جهات' || cmdBase === 'سماح جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 تَـعْـطِـيـلُ مَـانِـعِ جهات الاتصال 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ جهات الاتصال\n⛔ ⌯ الحالة ↞ تم تعطيل الحماية»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender] });    
}    

if (activeGames[from]) {    
    if (['صراحة', 'تحدي', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'زواج', 'طلاق'].includes(cmdBase)) {    
        return sock.sendMessage(from, { text: `⚠️ توجد فعالية قيد التشغيل حالياً في هذه المجموعة! قم بالإجابة عليها أو اكتب \`.انسحب\` أولاً.` });    
    }    
}    

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
        const marriageText = `╭━━〔 💍 𝑴𝑨𝑹𝑹𝑰𝑨𝑮𝑬 💍 〕━━⬣\n\n│ 🤵🏻 ⇢ الـعـريـس:\n│ 👑 ⇢ @${sender.split('@')[0]}\n\n│ 👰🏻 ⇢ الـعـروسـة:\n│ 👑 ⇢ @${targetUser.split('@')[0]}\n\n├────────────⬣\n│ 👶 الـأولاد:\n│ 👶 ⇢ @${child1.split('@')[0]}\n│ 👶 ⇢ @${child2.split('@')[0]}\n├────────────⬣\n\n✨ مبروك للعروسين، نتمنى لكم حياة سعيدة. 😂❤️\n\n╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;
        return sock.sendMessage(from, { text: marriageText, mentions: [sender, targetUser, child1, child2] });
    } catch (e) { return sock.sendMessage(from, { text: '❌ تعذر إتمام مراسم الزواج.' }); }
}    

if (cmd === 'طلاق') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.طلاق @العروس`' });    
    if (!marriages[from] || marriages[from][sender] !== targetUser) {    
        return sock.sendMessage(from, { text: `❌ لا يوجد عقد زواج مسجل بينك وبين العضو @${targetUser.split('@')[0]} لإتمام الطلاق!`, mentions: [targetUser] }, { quoted: msg });    
    }    
    delete marriages[from][sender];    
    const divorceText = `╭━━〔 💔 𝑫𝑰𝑽𝑶𝑹𝑪𝑬 💔 〕━━⬣\n\n│ 🤵🏻 ⇢ الـطَّـلِـيـق:\n│ 👑 ⇢ @${sender.split('@')[0]}\n\n│ 👰🏻 ⇢ الـطَّـلِـيـقَـة:\n│ 👑 ⇢ @${targetUser.split('@')[0]}\n\n├────────────⬣\n│ 💔 حَـالَـةُ الـعِـلاقَـة:\n│ ☠️ ⇢ تم الانفصال والطلاق رسمياً\n├────────────⬣\n\n💔 للأسف انتهت المودة، ونتمنى لكل طرف التوفيق في طريقه. 🥀\n\n╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;
    return sock.sendMessage(from, { text: divorceText, mentions: [sender, targetUser] });    
}    

if (cmd === 'صراحة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const participants = meta.participants.map(p => p.id);    
        const randomUser = participants[Math.floor(Math.random() * participants.length)];    
        return sock.sendMessage(from, { text: `💬 *لعبة صراحة لـ @${randomUser.split('@')[0]}:*\n\nما هو أقوى موقف سويته وتندمت عليه؟`, mentions: [randomUser] });    
    } catch (e) { return sock.sendMessage(from, { text: `💬 *لعبة صراحة:* ما هو أقوى موقف سويته وتندمت عليه؟` }); }    
}    

if (cmd === 'تحدي') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const participants = meta.participants.map(p => p.id);    
        const randomUser = participants[Math.floor(Math.random() * participants.length)];    
        return sock.sendMessage(from, { text: `🔥 *تحدي جديد موجه إلى @${randomUser.split('@')[0]}:*\n\nقم بإرسال ايموجي 🦅 في الشات حالاً!`, mentions: [randomUser] });    
    } catch (e) { return sock.sendMessage(from, { text: `🔥 *تحدي:* قم بإرسال ايموجي 🦅 في الشات حالاً!` }); }    
}    

if (cmd === 'حرف') {    
    const letters = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ر', 'س', 'ش', 'ص', 'ع', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'];    
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];    
    return sock.sendMessage(from, { text: `🔠 *لعبة الحرف الأنمي:*\n\nالحرف المطلوب: [ *${randomLetter}* ]\n⏳ كتابة 3 أسماء شخصيات انمي تبدأ بهذا الحرف بسرعة!` });    
}    

if (cmd === 'خيروك' || cmd === 'لوخيروك') {    
    return sock.sendMessage(from, { text: `❓ *لعبة لو خيروك:*\n\nتأكل أكل حار جداً طوال حياتك 🌶️ أم تعيش بدون إنترنت نهائياً؟ 📱` });    
}    

if (cmd === 'حكمة') {    
    const item = animeQuotesList[Math.floor(Math.random() * animeQuotesList.length)];    
    const quoteFormatted = `📜 *مَوْسُوعَةُ حِكَمِ وَأَقْوَالِ الشَّخْصِيَّاتِ (الأنمي):*\n\n> "${item.quote}"\n\n👤 *الشَّخْصِيَّة:* \`${item.character}\``;
    return sock.sendMessage(from, { text: quoteFormatted });    
}    

if (cmd === 'اكمل') { startTimedGame(from, sock, 'complete', ["من حفر حفلة لأخيه.. وقع فيها", "العقل السليم.. في الجسم السليم", "الصديق وقت.. الضيق"], 30); return; }    
if (cmd === 'رتب') { startNextSameGame(from, sock, 'arrange', [{word: "ن ت ر و ج", answer: "ترنجو"}]); return; }    
if (cmd === 'خمن') { startTimedGame(from, sock, 'guess', ["7", "15", "42", "99"], 30); return; }    
if (cmd === 'عكس') { startNextSameGame(from, sock, 'reverseGame', [{word: "نيراي", answer: "يريان"}]); return; }    
if (cmdBase === 'حزورة' || cmdBase === 'لغز') { startTimedGame(from, sock, 'riddles', ["شيء يلبسه الملك وليس له ذراعين فما هو؟ التاج"], 30); return; }    

if (cmd === 'قران' || cmd === 'قرآن') {    
    let selectedAyat = [];
    let tempDb = [...quranDatabase];
    for (let i = 0; i < 5; i++) {
        if (tempDb.length === 0) break;
        let randIdx = Math.floor(Math.random() * tempDb.length);
        selectedAyat.push(`🔹 ${tempDb[randIdx]}`);
        tempDb.splice(randIdx, 1);
    }
    return sock.sendMessage(from, { text: `📖 *آيَاتٌ قُرْآنِيَّةٌ مُبَارَكَةٌ (5 آيات):*\n\n` + selectedAyat.join('\n\n') });    
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
    return sock.sendMessage(from, { text: `*╎أذكـار 🌙私╎*

*أذكار الـصـبـاح ⛅*

- اللّهُ لاَ إِلَـهَ إِلاّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إلّا بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ.

- قُلْ هُوَ اللهُ أَحَدٌ، اللهُ الصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ.

- قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ، مِن شَرِّ مَا خَلَقَ، وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ، وَمِن شَرِّالنَّفَّاثَاتِ فِي الْعُقَدِ، وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ

- قُلْ أَعُوذُ بِرَبِّ النَّاسِ، مَلِكِ النَّاسِ، إِلَهِ النَّاسِ، مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ، الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ، مِنَ الْجِنَّةِ وَ النَّاسِ

- أَصْـبَحْنا وَأَصْـبَحَ المُـلْكُ لله وَالحَمدُ لله ، لا إلهَ إلاّ اللّهُ وَحدَهُ لا شَريكَ لهُ، لهُ المُـلكُ ولهُ الحَمْـد، وهُوَ على كلّ شَيءٍ قدير ، رَبِّ أسْـأَلُـكَ خَـيرَ ما في هـذا اليوم وَخَـيرَ ما بَعْـدَه ، وَأَعـوذُ بِكَ مِنْ شَـرِّ ما في هـذا اليوم وَشَرِّ ما بَعْـدَه، رَبِّ أَعـوذُ بِكَ مِنَ الْكَسَـلِ وَسـوءِ الْكِـبَر ، رَبِّ أَعـوذُ بِكَ مِنْ عَـذابٍ في النّـارِ وَعَـذابٍ في القَـبْر.

- اللّهـمَّ أَنْتَ رَبِّـي لا إلهَ إلاّ أَنْتَ ، خَلَقْتَنـي وَأَنا عَبْـدُك ، وَأَنا عَلـى عَهْـدِكَ وَوَعْـدِكَ ما اسْتَـطَعْـت ، أَعـوذُ بِكَ مِنْ شَـرِّ ما صَنَـعْت ، أَبـوءُ لَـكَ بِنِعْـمَتِـكَ عَلَـيَّ وَأَبـوءُ بِذَنْـبي فَاغْفـِرْ لي فَإِنَّـهُ لا يَغْـفِرُ الذُّنـوبَ إِلاّ أَنْتَ.

- رَضيـتُ بِاللهِ رَبَّـاً وَبِالإسْلامِ ديـناً وَبِمُحَـمَّدٍ صلى الله عليه وسلم نَبِيّـاً.

- اللّهُـمَّ إِنِّـي أَصْبَـحْتُ أُشْـهِدُك ، وَأُشْـهِدُ حَمَلَـةَ عَـرْشِـك ، وَمَلائكتَك ، وَجَمـيعَ خَلْـقِك ، أَنَّـكَ أَنْـتَ اللهُ لا إلهَ إلّا أَنْـتَ وَحْـدَكَ لا شَريكَ لَـك ، وَأَنَّ مُحَمّـداً عَبْـدُكَ وَرَسـولُـك.

- اللّهُـمَّ ما أَصْبَـَحَ بي مِـنْ نِعْـمَةٍ أَو بِأَحَـدٍ مِـنْ خَلْـقِك ، فَمِـنْكَ وَحْـدَكَ لا شريكَ لَـك ، فَلَـكَ الْحَمْـدُ وَلَـكَ الشُّكْـر.

- حَسْبِـيَ اللّهُ لا إلهَ إلّا هُوَ عَلَـيهِ تَوَكَّـلتُ وَهُوَ رَبُّ العَرْشِ العَظـيم.

- بِسـمِ اللهِ الذي لا يَضُـرُّ مَعَ اسمِـهِ شَيءٌ في الأرْضِ وَلا في السّمـاءِ وَهـوَ السّمـيعُ العَلـيم.

- اللّهُـمَّ بِكَ أَصْـبَحْنا وَبِكَ أَمْسَـينا ، وَبِكَ نَحْـيا وَبِكَ نَمُـوتُ وَإِلَـيْكَ النُّـشُور.

- أَصْبَـحْـنا عَلَى فِطْرَةِ الإسْلاَمِ، وَعَلَى كَلِمَةِ الإِخْلاَصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إبْرَاهِيمَ حَنِيفاً مُسْلِماً وَمَا كَانَ مِنَ المُشْرِكِينَ.

- سُبْحـانَ اللهِ وَبِحَمْـدِهِ عَدَدَ خَلْـقِه ، وَرِضـا نَفْسِـه ، وَزِنَـةَ عَـرْشِـه ، وَمِـدادَ كَلِمـاتِـه.

- اللّهُـمَّ عافِـني في بَدَنـي ، اللّهُـمَّ عافِـني في سَمْـعي ، اللّهُـمَّ عافِـني في بَصَـري ، لا إلهَ إلاّ أَنْـتَ.

- اللّهُـمَّ إِنّـي أَعـوذُ بِكَ مِنَ الْكُـفر ، وَالفَـقْر ، وَأَعـوذُ بِكَ مِنْ عَذابِ القَـبْر ، لا إلهَ إلّا أَنْـتَ.

- اللّهُـمَّ إِنِّـي أسْـأَلُـكَ العَـفْوَ وَالعـافِـيةَ في الدُّنْـيا وَالآخِـرَة ، اللّهُـمَّ إِنِّـي أسْـأَلُـكَ العَـفْوَ وَالعـافِـيةَ في ديني وَدُنْـيايَ وَأهْـلي وَمالـي ، اللّهُـمَّ اسْتُـرْ عـوْراتي وَآمِـنْ رَوْعاتـي ، اللّهُـمَّ احْفَظْـني مِن بَـينِ يَدَيَّ وَمِن خَلْفـي وَعَن يَمـيني وَعَن شِمـالي ، وَمِن فَوْقـي ، وَأَعـوذُ بِعَظَمَـتِكَ أَن أُغْـتالَ مِن تَحْتـي.

- يا حَـيُّ يا قَيّـومُ بِـرَحْمَـتِكَ أَسْتَـغـيث ، أَصْلِـحْ لي شَـأْنـي كُلَّـه ، وَلا تَكِلـني إِلى نَفْـسي طَـرْفَةَ عَـين.

- أَصْبَـحْـنا وَأَصبحَ المُـلكُ للهِ رَبِّ العـالَمـين ، اللّهُـمَّ إِنِّـي أسْـأَلُـكَ خَـيْرَ هـذا الـيَوْم ، فَـتْحَهُ ، وَنَصْـرَهُ ، وَنـورَهُ وَبَـرَكَتَـهُ ، وَهُـداهُ ، وَأَعـوذُ بِـكَ مِـنْ شَـرِّ ما فـيهِ وَشَـرِّ ما بَعْـدَه.

- اللّهُـمَّ عالِـمَ الغَـيْبِ وَالشّـهادَةِ فاطِـرَ السّماواتِ وَالأرْضِ رَبَّ كـلِّ شَـيءٍ وَمَليـكَه ، أَشْهَـدُ أَنْ لا إِلـهَ إِلاّ أَنْت ، أَعـوذُ بِكَ مِن شَـرِّ نَفْسـي وَمِن شَـرِّ الشَّيْـطانِ وَشِـرْكِه ، وَأَنْ أَقْتَـرِفَ عَلـى نَفْسـي سوءاً أَوْ أَجُـرَّهُ إِلـى مُسْـلِم.

- أَعـوذُ بِكَلِمـاتِ اللّهِ التّـامّـاتِ مِنْ شَـرِّ ما خَلَـق.

- اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ على نَبِيِّنَا مُحمَّد.

- اللَّهُمَّ إِنَّا نَعُوذُ بِكَ مِنْ أَنْ نُشْرِكَ بِكَ شَيْئاً نَعْلَمُهُ ، وَنَسْتَغْفِرُكَ لِمَا لَا نَعْلَمُهُ.

- اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنْ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنْ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ، وَقَهْرِ الرِّجَالِ.

- أسْتَغْفِرُ اللهَ العَظِيمَ الَّذِي لاَ إلَهَ إلاَّ هُوَ، الحَيُّ القَيُّومُ، وَأتُوبُ إلَيهِ.

- يَا رَبِّ , لَكَ الْحَمْدُ كَمَا يَنْبَغِي لِجَلَالِ وَجْهِكَ , وعظيم سُلْطَانِكَ.

- لا إله إلّا الله وَحْدَهُ لا شَريْكَ لهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءِ قَدِيرِ.

- اللَّهُمَّ أَنْتَ رَبِّي لا إِلَهَ إِلا أَنْتَ ، عَلَيْكَ تَوَكَّلْتُ ، وَأَنْتَ رَبُّ الْعَرْشِ الْكَرِيمِ , مَا شَاءَ اللَّهُ كَانَ ، وَمَا لَمْ يَشَأْ لَمْ يَكُنْ ، وَلا حَوْلَ وَلا قُوَّةَ إِلا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ , أَعْلَمُ أَنَّ اللَّهَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ ، وَأَنَّ الله قَدْ أَحَاطَ بِكُلِّ شَيْءٍ عِلْمًا , اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي ، وَمِنْ شَرِّ كُلِّ دَابَّةٍ أَنْتَ آخِذٌ بِنَاصِيَتِهَا ، إِنَّ رَبِّي عَلَى صِرَاطٍ مُسْتَقِيمٍ.

- سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.

*￭─╼━╾─══─┇￮𑀄🌙𑀄￮┇─══─╼━╾─￭*` });    
}    

if (cmd === 'اذكار_المساء' || cmd === 'أذكار_المساء') {    
    return sock.sendMessage(from, { text: `*أذكار الـمـسـاء 🌙*

* اللهم انت ربي لا اله الا انت خلقتني وانا عبدك وانا على عهدك ووعدك ما استطعت اعوذ بك من شر ما صنع ابوءلك بنعمتك عليّ و ابوء بذنبي فاغفر لي  فإنه لا يغفر الذنوب الا انت

* سبحان الله وبحمده مئة مره

* امسينا على فطرة الإسلام وكلمة الإخلاص ودين نبينا محمد صل الله عليه وسلم وعلى ملة ابينا ابراهيم حنيفا مسلما وما كان من المشركين

* اللهم آتنا في الدنيا حسنة و في الاخرة حسنة وقنا عذاب النار

*￭─╼━╾─══─┇￮𑀄🌙𑀄￮┇─══─╼━╾─￭*` });    
}    

if (cmd === 'اذكار_الاستيقاظ') {
    return sock.sendMessage(from, { text: `*╎أذكـار 🌙私𝕎*

*أذكار الإستيقاظ 🥀*

- الحَمْـدُ لِلّهِ الّذي أَحْـيانا بَعْـدَ ما أَماتَـنا وَإليه النُّـشور.

- الحمدُ للهِ الذي عافاني في جَسَدي وَرَدّ عَليّ روحي وَأَذِنَ لي بِذِكْرِه.

- لا إلهَ إلّا اللّهُ وَحْـدَهُ لا شَـريكَ له، لهُ المُلـكُ ولهُ الحَمـد، وهوَ على كلّ شيءٍ قدير، سُـبْحانَ اللهِ، والحمْـدُ لله ، ولا إلهَ إلاّ اللهُ واللهُ أكبَر، وَلا حَولَ وَلا قوّة إلاّ باللّهِ العليّ العظيم. رَبِّ اغْفرْ لي.

*￭─╼━╾─══─┇￮𑀄🌙𑀄￮┇─══─╼━╾─￭*` });
}

if (cmd === 'اذكار_الصلاة') {
    return sock.sendMessage(from, { text: `*╎أذكـار 🌙私𝕎*

*أذكار الصلاة 🕌*

- استغفر الله (ثلاثاً).
- اللهم أنت السلام ومنك السلام، تباركت يا ذا الجلال والإكرام.
- لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.

*￭─╼━╾─══─┇￮𑀄🌙𑀄￮┇─══─╼━╾─￭*` });
}

if (cmd === 'اذكار_المسجد') {
    return sock.sendMessage(from, { text: `*╎أذكـار 🌙私𝕎*

*أذكار المسجد 🏛️*

- أعوذ بالله العظيم، وبوجهه الكريم، وسلطانه القديم من الشيطان الرجيم.
- بسم الله، والصلاة والسلام على رسول الله، اللهم افتح لي أبواب رحمتك.
- اللهم إني أسألك من فضلك.

*￭─╼━╾─══─┇￮𑀄🌙𑀄￮┇─══─╼━╾─￭*` });
}

if (cmd === 'أذكار' || cmd === 'اذكار') {    
    return sock.sendMessage(from, { text: `🌙 *الأوامر المتاحة للأذكار:\n\n.اذكار_الصباح\n.اذكار_المساء\n.اذكار_الاستيقاظ\n.اذكار_الصلاة\n.اذكار_المسجد` });    
}    

if (cmd === 'نكتة') { return sock.sendMessage(from, { text: jokesList[Math.floor(Math.random() * jokesList.length)] }); }    
if (cmd === 'ماذا_لو') { return sock.sendMessage(from, { text: whatIfList[Math.floor(Math.random() * whatIfList.length)] }); }    
if (cmd === 'قول') { return sock.sendMessage(from, { text: `🗣️ *مقولة اليوم:* \n\n> "${quotesList[Math.floor(Math.random() * quotesList.length)]}"` }); }    

if (cmd === 'غزل') {    
    const targetUser = getTargetUser(msg) || sender;
    return sock.sendMessage(from, { text: `🌹 *تَرْتِيلَةُ غَزَلٍ لِـ @${targetUser.split('@')[0]}:*\n\n> "${ghazalsList[Math.floor(Math.random() * ghazalsList.length)]}"`, mentions: [targetUser] });
}

if (cmd === 'ثنائي') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        if (mems.length < 2) return sock.sendMessage(from, { text: `❌ الأعضاء لا يكفون لتكوين ثنائي!` });
        const p1 = mems[Math.floor(Math.random() * mems.length)].id;
        let p2 = mems[Math.floor(Math.random() * mems.length)].id;
        while (p1 === p2) { p2 = mems[Math.floor(Math.random() * mems.length)].id; }
        return sock.sendMessage(from, { text: `💞 *استمارة نقابة فينلاند الرسمية لأفضل ثنائي متطابق:* \n\n✨ تم إعلان الثنائي الأسطوري بين:\n👤 @${p1.split('@')[0]}\n👤 @${p2.split('@')[0]}\n\nنتمنى لهما حياة سعيدة وموفقة! 🥂❤️`, mentions: [p1, p2] });    
    } catch (e) { return sock.sendMessage(from, { text: `💞 تم اختيار الثنائي الأسطوري بنجاح.` }); }    
}

if (cmd === 'ملك_المجموعة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const chosen = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;    
        return sock.sendMessage(from, { text: `👑 *إعلان ملك المجموعة:* \n\nبناءً على التفاعل الأسطوري، تم اختيار:\n\n✨ @${chosen.split('@')[0]} ✨\n\nليكون *ملك المجموعة* لهذا اليوم! 🏆🔥`, mentions: [chosen] });    
    } catch (e) { return sock.sendMessage(from, { text: `👑 تم اختيار ملك المجموعة.` }); }    
}

if (cmd === 'كيوت_المجموعة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const chosen = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;    
        return sock.sendMessage(from, { text: `🌸 *إعلان لطافة المجموعة:* \n\nتم اختيار العضو:\n\n🧸 @${chosen.split('@')[0]} 🧸\n\nليكون رسمياً *كيوت المجموعة* لهذا اليوم! ✨🍼`, mentions: [chosen] });    
    } catch (e) { return sock.sendMessage(from, { text: `🌸 تم اختيار كيوت المجموعة.` }); }    
}

if (['ملكة_المجموعة', 'محبوب_المجموعة', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'مميز_المجموعة'].includes(cmdBase)) {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const chosen = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;    
        return sock.sendMessage(from, { text: `👑 لقب (${cmdBase}) تم منحه بجدارة إلى العضو: @${chosen.split('@')[0]} ✨`, mentions: [chosen] });    
    } catch (e) { return sock.sendMessage(from, { text: `👑 تم اختيار الألقاب.` }); }    
}    

if (cmd === 'رسائلي') {    
    const todayKey = getJordanDateKey();    
    const count = userMessagesCount[from]?.[todayKey]?.[sender] || 0;    
    return sock.sendMessage(from, { text: `📩 عدد رسائلك المسجلة اليوم يا @${sender.split('@')[0]} هو: *${count} رسالة*`, mentions: [sender] });    
}

if (cmd === 'توب_التفاعل') {    
    const todayKey = getJordanDateKey();
    const groupMsgs = userMessagesCount[from]?.[todayKey] || {};
    try {
        const meta = await sock.groupMetadata(from);
        let totalGroupMessages = 0;
        Object.values(groupMsgs).forEach(val => totalGroupMessages += val);

        let sortedParticipants = meta.participants.sort((a, b) => (groupMsgs[b.id] || 0) - (groupMsgs[a.id] || 0));
        let text = `📊 *إِحْـصَـائِـيَّـاتُ تـوبِ الـتَّـفَـاعُـلِ لِـلْـيَـوْمِ (${todayKey}):*\n💬 *إجمالي رسائل المجموعة اليوم:* \`${totalGroupMessages}\` رسالة\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n\n`;
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
    } catch (e) { return sock.sendMessage(from, { text: `❌ تعذر جلب توب التفاعل.` }); }
}

if (cmd.startsWith('اضافة_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    const title = trimmedBody.replace(/^\.اضافة_لقب/i, '').replace(/@\d+/g, '').trim();
    if (!targetUser || !title) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.اضافة_لقب @العضو اللقب`' });
    if (!groupTitles[from]) groupTitles[from] = {};
    if (!groupReservedTitles[from]) groupReservedTitles[from] = {};
    if (Object.values(groupTitles[from]).includes(title) || Object.values(groupReservedTitles[from]).includes(title)) {
        return sock.sendMessage(from, { text: `❌ اللقب ( *${title}* ) مأخوذ أو محجوز مسبقاً!` });
    }
    groupTitles[from][targetUser] = title;
    const text = `╭━━━〔 👑 〕━━━╮\n『 تَـسْـجِـيـلُ لَـقَـبٍ جَـدِيـد 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🏷️ ⌯ اللقب ↞ [ ${title} ]\n✨ ⌯ الحالة ↞ تم تسجيل اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('ازالة_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.ازالة_لقب @العضو`' });
    if (groupTitles[from]) delete groupTitles[from][targetUser];
    const text = `╭━━━〔 ❌ 〕━━━╮\n『 إِزَالَـةُ لَـقَـب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n✨ ⌯ الحالة ↞ تمت إزالة اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('حجز_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    const title = trimmedBody.replace(/^\.حجز_لقب/i, '').replace(/@\d+/g, '').trim();
    if (!targetUser || !title) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.حجز_لقب @العضو اللقب`' });
    if (!groupTitles[from]) groupTitles[from] = {};
    if (!groupReservedTitles[from]) groupReservedTitles[from] = {};
    if (Object.values(groupTitles[from]).includes(title) || Object.values(groupReservedTitles[from]).includes(title)) {
        return sock.sendMessage(from, { text: `❌ اللقب ( *${title}* ) مأخوذ أو محجوز مسبقاً!` });
    }
    groupReservedTitles[from][targetUser] = title;
    const text = `╭━━━〔 🔒 〕━━━╮\n『 حَـجْـزُ لَـقَـبٍ خَـاص 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔒 ⌯ اللقب ↞ [ ${title} ]\n✨ ⌯ الحالة ↞ تم حجز اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('الغاء_حجز_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام الصحيح: `.الغاء_حجز_لقب @العضو`' });
    if (groupReservedTitles[from]) delete groupReservedTitles[from][targetUser];
    const text = `╭━━━〔 🔓 〕━━━╮\n『 إِلْـغَـاءُ حَـجْـزِ لَـقَـب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n✨ ⌯ الحالة ↞ تم إلغاء حجز اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmd === 'قائمة_الالقاب') {
    const titles = groupTitles[from] || {};
    const keys = Object.keys(titles);
    if (keys.length === 0) return sock.sendMessage(from, { text: '📋 لا توجد ألقاب مسجلة في هذه المجموعة بعد!' });
    let text = `╭━━━〔 👑 〕━━━╮\n『 قَـائِـمَـةُ الأَلْـقَـابِ الـمُـسَـجَّـلَـةِ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;
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
    let text = `╭━━━〔 🔒 〕━━━╮\n『 قَـائِـمَـةُ الأَلْـقَـابِ الـمَـحْـجُـوﺯَةِ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;
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

if (cmdBase === 'اضافة_مطور') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });    
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    if (!extraDevelopers.includes(cleanNum)) extraDevelopers.push(cleanNum);
    
    const text = `╭━━━〔 ♟️ 〕━━━╮\n『 إِضَـافَـةُ مُـطَـوِّرٍ جَـدِيـد 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ الحساب ↞ @${cleanNum}\n👑 ⌯ المسؤول ↞ المطور الأساسي\n🛡️ ⌯ الصلاحية ↞ مطور\n✅ ⌯ الحالة ↞ تمت إضافة المطور بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser] });    
}    

if (cmdBase === 'حذف_مطور') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (targetUser) {
        const cleanNum = targetUser.replace(/[^0-9]/g, '');
        extraDevelopers = extraDevelopers.filter(d => d !== cleanNum);
    }
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 إِزَالَـةُ صَـلَاحِـيَـاتِ مُـطَـوِّر 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ الحساب ↞ @${targetUser ? targetUser.split('@')[0] : 'المستخدم'}\n👑 ⌯ المسؤول ↞ المطور الأساسي\n🔓 ⌯ الإجراء ↞ إزالة صلاحيات المطور\n✅ ⌯ الحالة ↞ تمت إزالة المطور بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: targetUser ? [targetUser] : [] });    
}    

if (cmdBase === 'اضف_نخبة') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    if (!vipUsers.includes(cleanNum)) vipUsers.push(cleanNum);

    const text = `╭━━━〔 👑 〕━━━╮\n『 إِضَـافَـةُ عُـضْـوٍ إِلَـى الـنُّـخْـبَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${cleanNum}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n✨ ⌯ الرتبة ↞ نُخبة\n🛡️ ⌯ الصلاحية ↞ عضو نخبة\n✅ ⌯ الحالة ↞ تمت الإضافة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmdBase === 'ازل_نخبة') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    vipUsers = vipUsers.filter(v => v !== cleanNum);

    const text = `╭━━━〔 ♟️ 〕━━━╮\n『 إِزَالَـةُ عُـضْـوٍ مِنَ الـنُّـخْـبَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${cleanNum}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📉 ⌯ الرتبة السابقة ↞ نُخبة\n🔓 ⌯ الإجراء ↞ سحب رتبة النخبة\n✅ ⌯ الحالة ↞ تمت الإزالة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [targetUser, sender] });
}

if (cmdBase === 'عرض_نخبة') {
    if (vipUsers.length === 0) return sock.sendMessage(from, { text: '📋 لا يوجد أعضاء نخبة مسجلين حالياً!' });
    let text = `👑 *قَـائِـمَـةُ أَعْـضَـاءِ الـنُّـخْـبَـةِ:*\n\n`;
    let mentions = [];
    vipUsers.forEach((v, idx) => {
        text += `${idx + 1}. @${v}\n`;
        mentions.push(v + '@s.whatsapp.net');
    });
    return sock.sendMessage(from, { text, mentions });
}

if (cmdBase === 'اختبار') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    let isBotActive = !globalBotStopped;
    let statusEmoji = isBotActive ? '🟢' : '🔴';
    let testReport = `🧪 *فَـحْـصُ وَاسْـتِـعْـرَاضُ حَـالَـةِ أَوْامِـرِ الـبُـوتِ:*\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n\n`;
    validCommands.forEach((c, idx) => { testReport += `> ${idx + 1}. \`.${c}\` ↞ ${statusEmoji}\n`; });
    testReport += `\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n📊 *إجمالي الأوامر الفعالة:* \`${validCommands.length}\` أمر\n🟢 حالة النظام: [ممتازة]`;
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
    return sock.sendMessage(from, { text: `🔴 تم إيقاف البوت كلياً! لا يستجيب لأي أحد نهائياً.` });
}

if (cmdBase === 'تفعيل_البوت' || cmdBase === 'تفعيل البوت') {
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
    globalBotStopped = false;
    return sock.sendMessage(from, { text: `🟢 تم تفعيل البوت بنجاح! البوت يعود للاستجابة للجميع.` });
}

if (cmdBase === 'تعطيل_البوتات' || cmd === 'تعطيل بوتات') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const parts = trimmedBody.split(' ');    
    const action = (parts[1] || '').toLowerCase();    
    if (action === 'تفعيل' || action === 'تشغيل') {    
        getGroupSetting(from).antiOtherBots = true;    
        return sock.sendMessage(from, { text: `🛡️ *تم تفعيل تعطيل البوتات الأخرى في هذه المجموعة.*` });    
    } else if (action === 'ايقاف' || action === 'إيقاف' || action === 'تعطيل') {    
        getGroupSetting(from).antiOtherBots = false;    
        return sock.sendMessage(from, { text: `🔓 *تم إيقاف ميزة تعطيل البوتات.*` });    
    } else {    
        return sock.sendMessage(from, { text: `📌 الاستخدام: \`.تعطيل_البوتات تفعيل\` أو \`.تعطيل_البوتات ايقاف\`` });    
    }    
}    

if (cmdBase === 'خاص' || cmdBase === 'وضع_خاص') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين الأساسيين فقط!' });    
    getGroupSetting(from).botMode = 'private';    
    return sock.sendMessage(from, { text: '🔒 تم تفعيل الوضع الخاص (المطورين والنخبة فقط).' });    
}    

if (cmdBase === 'عام' || cmdBase === 'وضع_عام') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين الأساسيين فقط!' });    
    getGroupSetting(from).botMode = 'public';    
    return sock.sendMessage(from, { text: '🔓 تم تفعيل الوضع العام للجميع.' });    
}    

if (cmdBase === 'كشف') {    
    if (quotedMsg) {    
        try {    
            let quotInfo = msg.message.extendedTextMessage.contextInfo;    
            let targetMsg = { key: { remoteJid: from, id: quotInfo.stanzaId, participant: quotInfo.participant || quotInfo.remoteJid }, message: quotedMsg };    
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
        } catch (e) { return sock.sendMessage(from, { text: `❌ حدث خطأ أثناء كشف الوسائط.` }); }    
    }    
    return sock.sendMessage(from, { text: `📌 يرجى الرد على رسالة العرض مرة واحدة بكلمة \`كشف\`` });    
}    

if (cmdBase === 'تفكيك') { startNextSameGame(from, sock, 'disassemble', [{word: "ن ت ر و ج", answer: "ترنجو"}]); return; }    
if (cmdBase === 'كتابه' || cmdBase === 'كتابة') { startNextSameGame(from, sock, 'typing', ["فينلاند ساغا اسطورة الأنمي"]); return; }    

if (cmdBase === 'توب_نقاط' || cmdBase === 'الاغنياء' || cmdBase === 'الأغنياء') {    
    try {
        const meta = await sock.groupMetadata(from);
        let mentions = meta.participants.map(p => p.id);
        let sorted = mentions.sort((a, b) => (userPoints[b] || 0) - (userPoints[a] || 0));

        let topText = `╭━━━〔 🏆 〕━━━╮\n『 قَـائِـمَـةُ أَعْـلَى الـنِّـقَـاط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;    
        sorted.forEach((u, index) => { 
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
            topText += `${medal} *الـمَـرْتَـبَـة [${index + 1}]* ↞ @${u.split('@')[0]}\n> 💰 *الـرَّصِـيـد:* \`${userPoints[u] || 0}\` نقطة\n\n`; 
        });    
        topText += `❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
        const userPp = await getUserProfilePic(sock, sender);    
        try { await sock.sendMessage(from, { image: { url: userPp }, caption: topText, mentions }); } catch (e) { await sock.sendMessage(from, { text: topText, mentions }); }    
        return;    
    } catch (e) { return sock.sendMessage(from, { text: '❌ تعذر جلب توب النقاط.' }); }
}    

if (cmdBase === 'تحويل') {    
    const parts = trimmedBody.split(' ');    
    const amount = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(amount) || amount <= 0 || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.تحويل <المبلغ> @منشن`' });    
    getBankAccount(sender); getBankAccount(targetUser);    
    if ((userPoints[sender] || 0) < amount) return sock.sendMessage(from, { text: `❌ رصيدك لا يكفي!` });    
    userPoints[sender] -= amount; userPoints[targetUser] += amount;    
    const text = `╭━━━〔 💸 〕━━━╮\n『 تَـحْـوِيـلُ الـنِّـقَـاط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ المُرسِل ↞ @${sender.split('@')[0]}\n🎯 ⌯ المُستلم ↞ @${targetUser.split('@')[0]}\n💰 ⌯ المبلغ ↞ ${amount} نقطة\n✅ ⌯ الحالة ↞ تمت عملية التحويل بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text, mentions: [sender, targetUser] });    
}    

if (cmdBase === 'قائمة_المطورين') {    
    let text = `👑 *قَـائِـمَـةُ الـمُـطَـوِّرِيـنَ:*\n\n> @${DEVELOPER_NUMBER}\n`;
    let mentions = [DEVELOPER_NUMBER + '@s.whatsapp.net'];

    if (extraDevelopers.length > 0) {
        extraDevelopers.forEach((dev) => {
            text += `> @${dev}\n`;
            mentions.push(dev + '@s.whatsapp.net');
        });
    }
    return sock.sendMessage(from, { text, mentions });    
}    

if (cmdBase === 'اعطاء' || cmdBase === 'إعطاء') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });    
    const parts = trimmedBody.split(' ');    
    const amount = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(amount) || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.اعطاء 1000 @منشن`' });    
    getBankAccount(targetUser);    
    userPoints[targetUser] = (userPoints[targetUser] || 0) + amount;    
    return sock.sendMessage(from, { text: `✅ تم إضافة ${amount} نقطة بنجاح.`, mentions: [targetUser] }, { quoted: msg });    
}    

if (cmdBase === 'اذاعة' || cmdBase === 'إذاعة') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });    
    const bcText = trimmedBody.replace(/^\.(اذاعة|إذاعة)/i, '').trim();    
    if (!bcText) return sock.sendMessage(from, { text: '📌 اكتب نص الإذاعة بعد الأمر.' });    
    
    try {    
        const allGroups = await sock.groupFetchAllParticipating();    
        const groupKeys = Object.keys(allGroups);    
        let targetGroupsCount = 0;

        for (let gId of groupKeys) {    
            const groupMeta = allGroups[gId];
            targetGroupsCount++;
            const allGroupMentions = groupMeta.participants.map(p => p.id);
            const hiddenMentionSpace = '‌'.repeat(allGroupMentions.length);

            const broadcastFormatted = `╭━━〔 📡 𝑩𝑹𝑶𝑨𝑫𝑪𝑨𝑺𝑻 〕━━⬣

│ 📢 نَـصُّ الإِعْـلَان:
│ ${bcText}
│${hiddenMentionSpace}
├────────────⬣
│ 👑 المُـرسِـل: المطور الأساسي
│ 🎯 النطاق: إذاعة عامة شاملة
│ ✅ الحالة: تم استلام البث بنجاح
╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』 〕━━⬣`;

            await sock.sendMessage(gId, { text: broadcastFormatted, mentions: allGroupMentions });
        }    

        const finalReport = `╭━━〔 📡 𝑹𝑬𝑷𝑶𝑹𝑻 〕━━⬣

│ 📊 تَقْرِيرُ الإِذَاعَةِ الشَّامِلَةِ:
│ تم إرسال البث بنجاح تامة!
│ 
│ 🏛️ عدد المجموعات المستهدفة: [${targetGroupsCount}] مجموعة
│ 🕒 وقت الإرسال: ${getJordanTime()}
╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』 〕━━⬣`;

        return sock.sendMessage(from, { text: finalReport });    
    } catch (e) { return sock.sendMessage(from, { text: '❌ فشل إرسال الإذاعة.' }); }    
}    

if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });    
    await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' });    
    process.exit(0);    
}    

// أمر بوت (مع تضمين رابط قناة البوت بشكل خفي غير مرئي في نص الاستمارة)
if (cmdBase === 'بوت') {    
    const time = getJordanTime();    
    const botWelcomeText = `
🍷 *أَهْـلاً بِـكَ فِي عَالَمِ 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}
> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> ┃ ⌯👨🏻‍💻︙الــمـطـور → 𝐸𝓇𝑒𝓃 (962796163926)
> ┃ 📊︙عدد الأوامر → ${validCommands.length} أمراً
> ┃ 
> ┃ ⌯🚀︙الـتـوقـيـت → ${time} (الأردن)

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

⚙️ *لِـعَـرْضِ كَـافَّـةِ أَقْـسَـامِ الأَوَامِـرِ وَالإِدَارَةِ:*
اكتب الأمر: 👇
📌 *.الاوامر*  أو  *.اقسام*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
`.trim() + `\n\nhttps://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d`;

const botPp = await getBotProfilePic(sock);
try { await sock.sendMessage(from, { image: { url: botPp }, caption: botWelcomeText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: botWelcomeText }); }
return;
}

// أمر الاوامر / اقسام (مع تضمين رابط قناة البوت بشكل خفي غير مرئي في نص الاستمارة)
if (cmdBase === 'الاوامر' || cmd === 'اوامر' || cmd === 'منيو' || cmd === 'اقسام') {    
    const menuText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ الـرَّسْـمِـيَّة:*

> 🛡️ \`.1\` ↞ الحماية
> 🎉 \`.2\` ↞ الترفيه
> 💳 \`.3\` ↞ البنك والنقاط
> 🕌 \`.4\` ↞ اسلامي
> 😂 \`.5\` ↞ الضحك
> 👥 \`.6\` ↞ المجموعات
> ♟️ \`.7\` ↞ المطور
> ⚡ \`.8\` ↞ الادارة
> 🔍 \`.9\` ↞ الكشف
> 👑 \`.10\` ↞ الألقاب

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
💡 *اكتب رقم القسم للوصول السريع!*` + `\n\nhttps://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d`;

const devPp = await getDeveloperProfilePic(sock);
try { await sock.sendMessage(from, { image: { url: devPp }, caption: menuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: menuText }); }
return;
}

if (cmdBase === '1') {    
    const settings = getGroupSetting(from);    
    const userPp = await getUserProfilePic(sock, sender);    
    const text1 = `🛡️ *الحماية (لهذه المجموعة):*

🔗 1. حماية الروابط: [${settings.antiLink ? '🟢 مفعلة' : '🔴 معطلة'}]
> تفعيل: .حظر_رابط | سماح: .سماح_رابط

🤬 2. حماية الشتم: [${settings.antiBadWords ? '🟢 مفعلة' : '🔴 معطلة'}]
> تفعيل: .حظر_شتم | سماح: .سماح_شتم

📇 3. حماية جهات الاتصال: [${settings.antiContact ? '🟢 مفعلة' : '🔴 معطلة'}]
> تفعيل: .حظر_جهات | سماح: .سماح_جهات

⚙️ لتصفير إنذارات أي عضو: \`.صفر @العضو\``;
try { await sock.sendMessage(from, { image: { url: userPp }, caption: text1, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: text1 }); }
return;
}

if (cmdBase === '2' || cmd === 'الترفيه' || cmd === 'العاب' || cmd === 'فعاليات') {    
    const entAndGamesText = `🎮🎲 *2. الترفيه والألعاب والفعاليات الأسطورية:*

> ❓ .خيروك ↞ لو خيروك
> 📜 .حكمة ↞ حكمة أنمي
> 💍 .زواج @العضو ↞ زواج
> 💔 .طلاق @العضو ↞ طلاق
> 🧩 .تفكيك ↞ تفكيك أنمي (+10 نقاط)
> ✍️ .كتابه ↞ سرعة كتابة (+10 نقاط)
> 💬 .صراحة ↞ صراحة وتحدي
> 🔥 .تحدي ↞ تحديات
> 🔤 .رتب ↞ ترتيب الحروف
> 🎯 .خمن ↞ خمن الرقم
> 🔠 .حرف ↞ كلمات بالحرف
> 🚪 .انسحب ↞ إلغاء الفعالية`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: entAndGamesText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: entAndGamesText }); }
return;
}

if (cmdBase === '3' || cmd === 'bank' || cmd === 'البنك' || cmd === 'النقاط') {    
    const bankMenuText = `💳 *3. البنك والنقاط:*

> 💳 .بنك | .حسابي ↞ كشف الحساب البنكي
> 💸 .تحويل <المبلغ> @منشن ↞ تحويل نقاط
> 🏆 .توب_نقاط ↞ ترتيب النقاط
> 🎁 .مكافأة ↞ الهدية اليومية (+20 نقطة)`;
const userPp = await getUserProfilePic(sock, sender);
try { await sock.sendMessage(from, { image: { url: userPp }, caption: bankMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: bankMenuText }); }
return;
}

if (cmdBase === '4') {
    const islamText = `🕌 *اسلامي:*

> 📖 .قران ↞ جلب 5 آيات من القران الكريم
> 🤲 .دعاء ↞ أدعية مباركة عشوائية
> 📿 .ذكر ↞ أذكار عشوائية مباركة
> ☪️ .حديث ↞ أحاديث نبوية شريفة
> ☀️ .اذكار_الصباح ↞ أذكار الصباح كاملة
> 🌙 .اذكار_المساء ↞ أذكار المساء كاملة
> 🥀 .اذكار_الاستيقاظ ↞ أذكار الاستيقاظ من النوم
> 🕌 .اذكار_الصلاة ↞ أذكار بعد الصلاة المفروضة
> 🏛️ .اذكار_المسجد ↞ أذكار دخول وخروج المسجد`;
    const userPp = await getUserProfilePic(sock, sender);
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: islamText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: islamText }); }
    return;
}

if (cmdBase === '5') {
    const funText = `😂 *الضحك:*

> 🤣 .نكتة ↞ نكتة مضحكة
> 🤔 .ماذا_لو ↞ تساؤلات خيالية
> 🗣️ .قول ↞ حكمة اليوم`;
    const userPp = await getUserProfilePic(sock, sender);
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: funText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: funText }); }
    return;
}

if (cmdBase === '6') {
    const groupExtText = `👥 *المجموعات:*

> 💍 .زواج @العضو ↞ زواج
> 💔 .طلاق @العضو ↞ طلاق
> 🌹 .غزل @منشن ↞ بيت غزل
> 💞 .ثنائي ↞ ثنائي عشوائي
> 👑 .ملك_المجموعة ↞ ملك الجروب
> 🧸 .كيوت_المجموعة ↞ كيوت الجروب
> 📩 .رسائلي ↞ عدد رسائلك
> 📊 .توب_التفاعل ↞ توب تفاعلات الجروب`;
    const userPp = await getUserProfilePic(sock, sender);
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: groupExtText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: groupExtText }); }
    return;
}

if (cmdBase === '7' || cmd === 'المطور' || cmd === 'مطور') {
    const devMenuText = `♟️ *قِـسْـمُ الـمُـطَـوِّرِ:*

> 👤 المطور: 𝐸𝓇𝑒𝓃
> 📱 الرقم: 962796163926

> 🔴 .ايقاف_البوت ↞ إيقاف البوت كلياً
> 🟢 .تفعيل_البوت ↞ تفعيل البوت
> 💣 .بوم ↞ طرد الأعضاء العاديين
> 👑 .اضافة_مطور @منشن ↞ إضافة مطور
> ❌ .حذف_مطور @منشن ↞ إزالة مطور
> 🌟 .اضف_نخبة @منشن ↞ إضافة نخبة
> ❌ .ازل_نخبة @منشن ↞ إزالة نخبة
> 📜 .عرض_نخبة ↞ عرض أرقام النخبة (منشن)
> 📋 .قائمة_المطورين ↞ عرض أرقام المطورين (منشن)
> 📡 .سجل_البوت ↞ سجل العمليات
> 🧪 .اختبار ↞ فحص الأوامر
> 📢 .إذاعة <النص> ↞ إذاعة عامة
> 🔄 .ريستارت ↞ إعادة التشغيل.`;
    const devPp = await getDeveloperProfilePic(sock);
    try { await sock.sendMessage(from, { image: { url: devPp }, caption: devMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: devMenuText }); }
    return;
}

if (cmdBase === '8' || cmd === 'الادارة' || cmd === 'الاداره') {    
    const adminMenuText = `⚡ *قِـسْـمُ الإِدَارَةِ:*

> 🔒 .قفل أو .غلق ↞ قفل الجروب
> 🔓 .فتح ↞ فتح الجروب
> 🗑️ .حذف ↞ حذف رسالة
> 📢 .الكل أو .منشن ↞ منشن جماعي
> 👑 .رفع @عضو ↞ ترقية مشرف
> 📉 .تنزيل @عضو ↞ سحب الإشراف
> 🚨 .طرد @عضو ↞ طرد
> ⚠️ .اضف_انذار @عضو ↞ إنذار
> 📉 .ازل_انذار @عضو ↞ حذف الإنذار
> 📊 .عدد_الانذارات @عضو ↞ عدد الإنذارات
> 📋 .قائمة_الانذارات ↞ المخالفون
> 🔇 .كتم <دقائق> @عضو ↞ كتم
> 🔊 .الغاء_كتم @عضو ↞ فك الكتم
> 🔗 .الرابط ↞ رابط المجموعة
> 🟢 .تفعيل ترحيب / توقيف ترحيب ↞ تفعيل/إيقاف الترحيب التلقائي
> 🔴 .تفعيل توديع / توقيف توديع ↞ تفعيل/إيقاف التوديع التلقائي`;
    const userPp = await getUserProfilePic(sock, sender);
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: adminMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: adminMenuText }); }
    return;
}

if (cmdBase === '9' || cmd === 'الكاشف') {    
    const detectorMenuText = `🔍 *الكشف:* رد على رسالة (عرض مرة واحدة) بكلمة \`.كشف\` لفكها فوراً.`;    
    const userPp = await getUserProfilePic(sock, sender);    
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: detectorMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: detectorMenuText }); }    
    return;    
}    

if (cmdBase === '10' || cmd === 'اللقب' || cmd === 'الالقاب') {
    const titleMenuText = `👑 *قسم الألقاب:*

> ✍️ \`.اضافة_لقب @العضو اللقب\`
> ❌ \`.ازالة_لقب @العضو\`
> 🔒 \`.حجز_لقب @العضو اللقب\`
> 🔓 \`.الغاء_حجز_لقب @العضو\`
> 📋 \`.قائمة_الالقاب\`
> 🔒 \`.قائمة_الالقاب_المحجوزة\``;
    const userPp = await getUserProfilePic(sock, sender);
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: titleMenuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: titleMenuText }); }
    return;
}

if (cmdBase === 'بنك' || cmd === 'حسابي') {    
    const userPp = await getUserProfilePic(sock, sender);    
    const accText = `💳 *كَـشْـفُ الحِـسَـابِ:* \n> رصيدك: *${userPoints[sender]} نقطة*`;    
    try { await sock.sendMessage(from, { image: { url: userPp }, caption: accText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: accText, mentions: [sender] }); }    
    return;    
}    

if (cmdBase === 'مكافأة' || cmd === 'هدية') {    
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    if (!dailyRewards[sender]) dailyRewards[sender] = 0;
    if ((now - dailyRewards[sender]) < cooldown) {
        return sock.sendMessage(from, { text: `⚠️ لقد استلمت مكافأتك اليومية مسبقاً!`, mentions: [sender] });
    }
    dailyRewards[sender] = now;
    getBankAccount(sender);
    userPoints[sender] += 20;

    const rewardText = `╭━━━〔 🎁 〕━━━╮\n『 الـمُـكَـافَـأَةُ الـيَـوْمِـيَّـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${sender.split('@')[0]}\n💰 ⌯ المكافأة ↞ 20 نقطة\n✨ ⌯ الحالة ↞ تم استلام المكافأة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text: rewardText, mentions: [sender] });
}

});

}

startBot();
