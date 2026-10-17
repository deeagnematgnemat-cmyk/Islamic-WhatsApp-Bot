import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Eren Bot is running successfully!\n');
});

server.keepAliveTimeout = 60000;
server.on('error', (err) => console.log('HTTP Server Error:', err));
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP Server is running on port ${PORT}`);
});

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

const strictBadWords = ['كس', 'قحبة', 'قحبه', 'شرموط', 'شرموطة', 'شرموطه', 'منيوك', 'عرص', 'قواد', 'طيز', 'زب'];

const animeDatabase = [
    "ناروتو", "ساسكي", "إيتاشي", "مادارا", "أوبيتو", "كاكاشي", "جيرايا", "تسونادي", "أوروتشيمارو", "ميناتو",
    "كوشينا", "هيناتا", "ساكورا", "غارا", "شيكامارو", "كيبا", "تشوجي", "إينو", "روكلي", "نيجي", "تينتين",
    "لوفي", "زورو", "سانجي", "نامي", "روبين", "تشوبر", "فرنكي", "بروك", "جيمبي", "شانكس", "إيس", "سابو",
    "ميهوك", "بوجي", "كايدو", "بيغ مام", "تيتش", "قارب", "سينغوكو", "أوكيجي", "أكاينو", "كيزارو", "فوجيتورا",
    "إيرين", "ميكاسا", "ليفاي", "آرمين", "أروين", "هانجي", "راينر", "بيرتولدت", "آني", "جان", "كوني", "ساشا",
    "هيستوريا", "يمير", "زيكمارلي", "غابي", "فالكو", "زيك", "غريشا", "كارلا", "فيلكس", "جانغي",
    "غوكو", "فيجيتا", "غوهان", "ترانكس", "بيكولو", "كوريرين", "تينيشهان", "يامتشا", "بولما", "بيروس", "وايس",
    "فريزا", "سيل", "بوو", "برولي", "هيت", "جيرين", "توppo", "كالي", "كيفلا", "كبتاين",
    "تانجيرو", "نيزوكو", "زينيتسو", "إينوسكي", "غيومي", "سانيمي", "غييو", "شينوبو", "ميتسوري", "أوباناي",
    "مويتشيرو", "رينغوكو", "تنجين", "أكازا", "دوما", "كوكوشيبو", "موزان", "يوريتشي", "تاماโย",
    "غون", "كيلوا", "كورابيكا", "ليوريو", "هيسوكا", "إيلومي", "كرولو", "نيتيرو", "ميرويم", "بيتو",
    "يوبي", "بوف", "زينو", "سيلفا", "بيسكيت", "جين", "كايتو", "ماتشي", "فينكس", "نوبوناغا",
    "إيتادوري", "ميغومي", "نوبارا", "غوجو", "سكونا", "مواكي", "باندا", "توجي", "نانامي", "غيتو",
    "ماهيتو", "جوجو", "تشوسو", "يوتا", "ماكي", "ناأويا", "أكوتامي", "تودو", "ميوا", "كامو",
    "سينكو", "تايجو", "يوزوريها", "تسوكاسا", "غينرو", "كينرو", "كوهكو", "كروم", "سويكا", "ريوسوي",
    "سايتاما", "جينوس", "غاروس", "تاتسوماكي", "فوبوكي", "بانغ", "أتوميك", "كينغ", "ميتال", "زومبي مان",
    "ديكو", "باكوغو", "تودوروكي", "أولمايت", "أيزاوا", "شيغاراكي", "دابي", "توغا", "أوفورأول", "إنديفور",
    "هواكس", "ميريو", "نجيرة", "أماجيكي", "كاميناري", "كيريشيما", "أوراراكا", "تسويو", "جيرو", "ياويوروزو",
    "كاراسونو", "هيناتا", "كاغياما", "تسوكيشيما", "نيشينويا", "تاناكا", "أويكوا", "إيواديزومي",
    "بوكوتو", "آكاآشي", "كوروو", "كينما", "أوشيجيما", "تندو", "أتسومو", "أوسامو", "كيتا", "ساكوسا",
    "الشيفرة", "سبارو", "لولوش", "سوزاكو", "سي سي", "شيرلي", "ناليلي", "كارين", "شنايزل", "كوروروجي",
    "نورمان", "إيما", "راي", "إيزابيلا", "كرون", "دون", "جيلدا", "فيل", "زرفان", "أوليفر",
    "ضوء", "L", "ميزا", "ملو", "ريوك", "ريم", "سويتشيرو", "ماتسودا", "تيروا"
];

const sarahaQuestions = [
    "ما هي الشفرة أو السر الذي تخفيه عن الجميع ولم تتجرأ على قوله لأي شخص؟",
    "ما هو القرار الأشد صعوبة الذي اتخذته في حياتك وتغيرت بعده تماماً؟",
    "لو أتيحت لك فرصة الاعتذار لشخص واحد فقط في هذا العالم، فمن سيكون وماذا ستقول له؟",
    "ما هي الذكرى التي تحاول نسيانها بكل قوتك ولكنها تعود لك دائماً؟",
    "ما هو العيب الوحيد في شخصيتك الذي تتمنى لو تستطيع تغييره بحزم؟",
    "هل شعرت يوماً أنك تصنّعت شخصية أخرى فقط لتكسب إعجاب أو احترام الآخرين؟",
    "ما هو الحلم الأكبر الذي تنازلت عنه مجبراً بسبب الظروف؟",
    "من هو الشخص في المجموعة الذي تشعر أنك قريب منه دون أن تتحدث معه كثيراً؟",
    "ما هو أعمق حزن مررت به ولم يلاحظه أي شخص من حولك؟",
    "ما هو الموقف الذي جعلك تفقد الثقة في شخص كنت تعتبره سندك؟",
    "لو خُيّرت بين استعادة الماضي أو قراءة المستقبل، ماذا ستختار ولماذا؟",
    "ما هي الكلمة التي قيلت لك يوماً وما زالت تجرحك أو تؤثر فيك حتى الآن؟"
];

const khayrokQuestions = [
    "تكتشف مستقبل العالم كاملاً 🔮 أَم تعود بالزمن لتصحيح أكبر أخطائك؟ ⏳",
    "تعيش في عالم أنمي من اختيارك بشخصية جانبية 🗡️ أَم تعيش في العالم الحقيقي بثراء فاحش؟ 💎",
    "تمتلك قوة الطيران 🦅 أَم الاختفاء عن أنظار الجميع وقتما تشاء؟ 👻",
    "تكون ملكاً في العصور القديمة بلا إنترنت 👑 أَم شخصاً عادياً في العصر الحالي؟ 📱",
    "تقرأ أفكار الناس وتعرف حقيقتهم 🧠 أَم تتحكم في مشاعرهم تجاهك؟ 💔",
    "تخسر كل ذكرياتك الماضية وتبدأ من جديد 🧠 أَم تفقد القدرة على تكوين ذكريات جديدة؟ 🚫",
    "تعيش طوال حياتك في مدينة يكسوها الثلج ❄️ أَم في جزيرة استوائية مشمسة؟ ☀️",
    "تكون عبقرياً جداً ولكنك وحيد 🧠 أَم شخصاً بسيطاً وحولك الكثير من الأصدقاء؟ 👥",
    "تتحدث جميع لغات العالم بطلاقة 🗣️ أَم تتحدث مع الحيوانات وتفهمها؟ 🐾",
    "تكون صاحب أقوى قوة جسدية في العالم 💪 أَم صاحب أسرع ذكاء ودهاء في التاريخ؟ 🧠"
];

const animeQuotesList = [
    { quote: "الذين يخالفون القوانين هم حثالة، لكن الذين يتخلون عن أصدقائهم هم أكثر من حثالة.", character: "أوتشيها أوبيتو / هاتاكي كاكاشي" },
    { quote: "لا توجد أوهام في هذا العالم، هناك فقط واقع قاسي.", character: "أوتشيها مادارا" },
    { quote: "إذا لم تقاتل، فلن تنتصر أبداً!", character: "إيرين ييغر" },
    { quote: "اختر القرار الذي لن تندم عليه لاحقاً.", character: "ليفاي أكرمان" },
    { quote: "الناس يعيشون حياتهم محكومين بما يعتقدون أنه صحيح وواقعي، لكن الواقع مجرد وهم.", character: "أوتشيها إيتاشي" },
    { quote: "المكان الذي يفكر فيه شخص ما بك هو المكان الذي يمكنك أن تطلق عليه بيتك.", character: "جيرايا" },
    { quote: "الخوف ليس خطيئة، إنه يخبرك ما هي نقاط ضعفك، وبمجرد معرفتك بها يمكنك أن تصبح أقوى.", character: "جيلدارتس كلايف" },
    { quote: "الاستسلام هو ما يقتل الناس، عندما يستسلم الناس يمتنون لكونهم عاجزين.", character: "ألوكارد" },
    { quote: "في عالم القتلة، من يتردد يمت أولاً.", character: "كيلوا زولديك" },
    { quote: "العدالة ليست شيئاً يمكنك شراؤه بالمال، العدالة هي القوة التي تحمي الضغفاء.", character: "رورونوا زورو" }
];

const quranDatabase = [
    "﴿اللَّهُ لَا إِلٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ﴾ [البقرة: 255]",
    "﴿إِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ فَإِنَّ مَعَ الْعُسْرِ يُسْرًا﴾ [الشرح: 5-6]",
    "﴿وَاصْبِرْ لِحُكْمِ رَبِّكَ فَإِنَّكَ بِأَعْيُنِنَا وَسَبِّحْ بِحَمْدِ رَبِّكَ حِينَ تَقُومُ﴾ [الطور: 48]",
    "﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾ [طه: 114]",
    "﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾ [البقرة: 153]",
    "﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾ [الرعد: 28]",
    "﴿وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ﴾ [الطلاق: 2-3]"
];

const ghazalsList = [
    "عيناكِ أرض لا خائن فيها، وجمالكِ حقيقة لا جدال فيها.",
    "لو كان الحب كلمات تُكتب لإنتهت أقلامي، لكن الحب أرواح تُوهب فهل تكفيكِ روحي؟",
    "في سكون الليل وفي زحمة النهار، تبقين أنتِ الفكرة الوحيدة التي تجعل قلبي يبتسم."
];

const jokesList = [
    "محشش سألوه: شو رأيك بالزواج المبكر؟ قال: الساعة قديش؟! 🤣",
    "واحد بخيل أخذ ولده على السوبر ماركت، الولد مسك شوكولاتة وقال: بحبها! الأب قاله: بوسها ورجعها! 😂",
    "محشش شاف لافتة مكتوب عليها 'ممنوع الوقوف'، انسدح! 🤣"
];

const whatIfList = [
    "ماذا لو استيقظت غداً ووجدت نفسك الشخص الوحيد المتبقي على كوكب الأرض؟ 🌍",
    "ماذا لو كان بإمكانك السفر عبر الزمن ولكن لمرة واحدة فقط دون العودة؟ ⏳",
    "ماذا لو استطعت قراءة أفكار الآخرين لمدة 24 ساعة فقط؟ 🧠"
];

const quotesList = [
    "الهيبةُ ليستْ بصَخبِ الـحُضور، بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى.",
    "لا تندم على ماضٍ علمك كيف تكون قويًا اليوم.",
    "القوة ليست في عدم السقوط، بل في القيام مجدداً في كل مرة تسقط فيها."
];

const duaList = [
    "اللَّهُمَّ إِنِّي أَسْأَلُكَ العَفْوَ وَالعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ.",
    "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي.",
    "اللَّهُمَّ آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ."
];

const hadithList = [
    "«إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى» [صحيح البخاري]",
    "«المُسْلِمُ مَنْ سَلِمَ المُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ» [متفق عليه]"
];

process.on('uncaughtException', (err) => console.log('خطأ:', err));
process.on('unhandledRejection', (err) => console.log('خطأ معالجة:', err));

const DEVELOPER_NUMBER = '962796163926';
const DEVELOPER_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
const BOT_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d';
const BOT_COMMANDS_VIDEO_URL = 'https://v1.pinimg.com/videos/iht/expMp4/5f/62/d0/5f62d0e960f2a2f55f99a912b25311ba_720w.mp4';

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
'صفر', 'بوت', 'اوامر', 'الأوامر',
'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
'الترفيه', 'العاب', 'فعاليات', 'bank', 'البنك', 'النقاط',
'حسابي', 'بنك', 'تحويل', 'توب_نقاط', 'الاغنياء', 'الأغنياء', 'مكافأة', 'هدية',
'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'لوخيروك', 'حكمة',
'صراحة', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'انسحب',
'زواج', 'غزل', 'ثنائي', 'ملك_المجموعة', 'ملكة_المجموعة', 'محبوب_المجموعة', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'مميز_المجموعة', 'كيوت_المجموعة',
'رسائلي', 'توب_التفاعل',
'المطور', 'مطور', 'الادارة', 'الاداره',
'اضافة_المطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار',
'اضف_انذار', 'ازل_انذار', 'حذف_انذار', 'عدد_الانذارات', 'قائمة_الانذارات',
'حظر رابط', 'سماح رابط', 'حظر شتم', 'سماح شتم', 'حظر جهات', 'سماح جهات',
'ايقاف_البوت', 'تفعيل_البوت', 'إيقاف_البوت', 'إيقاف البوت', 'تفعيل البوت',
'اضف_نخبة', 'ازل_نخبة', 'عرض_نخبة',
'قران', 'قرآن', 'دعاء', 'ذكر', 'حديث', 'أذكار', 'اذكار', 'اذكار_الصباح', 'اذكار_المساء', 'اذكار_الاستيقاظ', 'اذكار_الصلاة', 'اذكار_المسجد',
'نكتة', 'ماذا_لو', 'قول',
'تعطيل_البوتات', 'تعطيل بوتات',
'اضافة_لقب', 'ازالة_لقب', 'حجز_لقب', 'الغاء_حجز_لقب', 'قائمة_الالقاب', 'قائمة_الالقاب_المحجوزة', 'الالقاب',
'ملصق', 's', 'لصورة', 'toimage', 'ملصق_متحرك', 'فيديو_لملصق', 'متحرك_لفيديو', 'ملصق_رابط', 'ملصق_نصي', 'حزمة', 'مساعدة_الملصقات'
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

function shuffleString(str) {
    let arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join(' ');
}

function disassembleWord(str) {
    return str.split('').join(' ');
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

function cleanTextForComparison(str) {
    if (!str) return '';
    return str.toString()
        .replace(/[أإآاىئؤة]/g, 'ا')
        .replace(/[\u064b-\u065f]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();
}

let isPairingRequested = false;

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

sock.ev.on('connection.update', async (u) => {
const { connection, lastDisconnect, qr } = u;

if (connection === 'close') {
    isPairingRequested = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
    if (shouldReconnect) {
        setTimeout(startBot, 3000);
    }
} else if (connection === 'connecting') {
    if (!sock.authState.creds.registered && !isPairingRequested) {
        isPairingRequested = true;
        setTimeout(async () => {
            try {
                let phoneNumber = "962795106901";
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n========================================`);
                console.log(`🔑 كود الاقتران الخاص بك هو: ${code}`);
                console.log(`========================================\n`);
            } catch (e) {
                console.error('خطأ في طلب كود الاقتران:', e?.message || e);
                isPairingRequested = false;
            }
        }, 3000);
    }
} else if (connection === 'open') {
    console.log('👑 تم الاتصال بالواتساب بنجاح 👑');
}
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

- مـحـارب جـديـد يـحـط الـرحـال فـي أرض ڤـيـنـلانـد، أهـلاً وسـهـلاً ومـرحـبـاً بـك، نـتـمـنـى أن تـكـون رحـلـتـك مـلـيـئـة بـالـمـجـد وَالـمـغـامـرات.

❋・────━【🗡】━────・❋

🌙┆الـعـضـو ↜『@${user.split('@')[0]}』

❋・────━【🗡】━────・❋

※ نــرجــوا مـنـك دخــول رابــط إعـلانـات نـقـابـة إنـجـلانـد 🗡️

『 https://chat.whatsapp.com/IBy60bdcmcvCP8GPwtM1wq?s=cl&p=a&mlu=4&ilr=4 』

❋・────━【🗡】━────・❋

※ ونــرجــوا مـنـك أيــضــاً دخــول رابـط صـحـيـفـة ڤـيـنـلانـد ❄

『 https://chat.whatsapp.com/KY5GUeANAvO8px1An1FZeV 』

❋・────━【🗡】━────・❋

🫎┊مـع تـحـيـات ˼‏🗡️˹ ⤺

『𝑽. 𝑳. 1⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨ℕ𝐷』`;

        try {
            await sock.sendMessage(id, { image: { url: userPp }, caption: welcomeMsg, mentions: [user] });
        } catch (err) {
            await sock.sendMessage(id, { text: welcomeMsg, mentions: [user] });
        }
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

『𝑽. 𝑳. 1⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨ℕ𝐷』`;

        try {
            await sock.sendMessage(id, { image: { url: userPp }, caption: goodbyeMsg, mentions: [user] });
        } catch (err) {
            await sock.sendMessage(id, { text: goodbyeMsg, mentions: [user] });
        }
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

if (activeGames[from] && !trimmedBody.startsWith('.')) {
    const game = activeGames[from];
    if (game.isCompleted) return;
    
    let isCorrect = false;

    if (game.type === 'typing') {
        const userClean = cleanTextForComparison(trimmedBody);
        const correctClean = cleanTextForComparison(game.answer);
        if (userClean === correctClean) isCorrect = true;
    } else if (game.type === 'disassemble') {
        const expectedDisassembled = disassembleWord(game.answer).replace(/[أإآاىئؤة]/g, 'ا').toLowerCase();
        const userDisassembledInput = trimmedBody.split('').join(' ').replace(/\s+/g, ' ').trim().replace(/[أإآاىئؤة]/g, 'ا').toLowerCase();
        if (userDisassembledInput === expectedDisassembled || cleanTextForComparison(trimmedBody) === cleanTextForComparison(game.answer)) {
            isCorrect = true;
        }
    } else if (game.type === 'arrange') {
        const userClean = cleanTextForComparison(trimmedBody);
        const correctClean = cleanTextForComparison(game.answer);
        if (userClean === correctClean) isCorrect = true;
    } else if (game.type === 'guess') {
        if (trimmedBody.trim() === game.answer) isCorrect = true;
    } else if (game.type === 'riddles') {
        const userClean = cleanTextForComparison(trimmedBody);
        const correctClean = cleanTextForComparison(game.answer);
        if (userClean.includes(correctClean) || correctClean.includes(userClean)) isCorrect = true;
    } else if (game.type === 'letter_characters') {
        const charNames = trimmedBody.split(/[\n,،-]+/).map(s => s.trim()).filter(s => s.length > 0);
        const reqLetter = game.requiredLetter.replace(/[أإآا]/g, 'ا');
        const validChars = charNames.filter(c => c.replace(/[أإآا]/g, 'ا').startsWith(reqLetter));
        if (validChars.length >= 3) isCorrect = true;
    }

    if (isCorrect) {
        game.isCompleted = true;
        clearTimeout(game.timer);
        getBankAccount(sender);
        userPoints[sender] += 10;
        const gameTypeToRestart = game.type;
        delete activeGames[from];

        await sock.sendMessage(from, { 
            text: `✅ إجابة صحيحة!\n🏆 اللاعب: @${sender.split('@')[0]}\n💰 النقاط المكتسبة: +10 نقاط`, 
            mentions: [sender] 
        });

        setTimeout(() => {
            if (!activeGames[from]) {
                restartSameGame(sock, from, gameTypeToRestart);
            }
        }, 1500);
        return;
    } else {
        return;
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
        return sock.sendMessage(from, { text: `🚨 @${targetUser.split('@')[0]} تم طردك لتجاوزك الحد الأقصى من الإنذارات!`, mentions: [targetUser] });    
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
    if (['صراحة', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'زواج'].includes(cmdBase)) {    
        return sock.sendMessage(from, { text: `⚠️ توجد فعالية قيد التشغيل حالياً في هذه المجموعة! قم بالإجابة عليها أو اكتب \`.انسحب\` أولاً.` });    
    }    
}    

if (cmd === 'مساعدة_الملصقات') {
    const stickerHelpText = `╭━━━〔 🎨 〕━━━╮\n『 قِـسْـمُ الـمَـلْـصَـقَـات 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n> 🎨 \`.ملصق\` أو \`.s\` ↞ تحويل الصورة إلى ملصق.\n> 🖼️ \`.لصورة\` ↞ تحويل الملصق إلى صورة.\n> 🔗 \`.ملصق_رابط <الرابط>\` ↞ إنشاء ملصق من رابط صورة مباشر.\n> ✍️ \`.ملصق_نصي <النص>\` ↞ إنشاء ملصق نصي أنيق.\n> 🎞️ \`.ملصق_متحرك\` ↞ إنشاء ملصق متحرك (فيديو/صورة متحركة).\n> 🎬 \`.فيديو_لملصق\` ↞ تحويل فيديو إلى ملصق متحرك.\n> 🎥 \`.متحرك_لفيديو\` ↞ تحويل ملصق متحرك إلى فيديو قابل للتشغيل.\n> 📦 \`.حزمة <اسم الشخصية>\` ↞ جلب حزمة ملصقات للشخصية (ناروتو، إيرين، إيتاتشي...).\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text: stickerHelpText });
}

if (cmd === 'ملصق' || cmd === 's') {
    try {
        const qMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        const mime = Object.keys(qMsg)[0];
        if (!['imageMessage', 'videoMessage', 'documentMessage'].includes(mime)) {
            return sock.sendMessage(from, { text: `📌 يرجى إرسال صورة أو فيديو أو الرد عليها بكلمة \`.ملصق\`` });
        }
        const mediaStream = await downloadMediaMessage({ key: msg.key, message: qMsg }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
        
        const sticker = new Sticker(mediaStream, {
            pack: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』',
            author: DEVELOPER_NAME,
            type: StickerTypes.DEFAULT,
            categories: ['✨', '🍷'],
            quality: 50
        });
        const buffer = await sticker.toBuffer();
        return sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
    } catch (e) {
        return sock.sendMessage(from, { text: `❌ فشل إنشاء الملصق، تأكد من إرسال وسائط صالحة.` });
    }
}

if (cmd === 'لصورة' || cmd === 'toimage') {
    try {
        const qMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!qMsg || !qMsg.stickerMessage) {
            return sock.sendMessage(from, { text: `📌 يرجى الرد على ملصق بكلمة \`.لصورة\` لتحويله.` });
        }
        const mediaStream = await downloadMediaMessage({ key: msg.key, message: qMsg }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
        return sock.sendMessage(from, { image: mediaStream, caption: `✨ *تم تحويل الملصق إلى صورة بنجاح!*` }, { quoted: msg });
    } catch (e) {
        return sock.sendMessage(from, { text: `❌ فشل تحويل الملصق إلى صورة.` });
    }
}

if (cmd.startsWith('ملصق_رابط')) {
    const url = trimmedBody.replace(/^\.ملصق_رابط/i, '').trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return sock.sendMessage(from, { text: `📌 الاستخدام الصحيح: \`.ملصق_رابط <رابط الصورة المباشر>\`` });
    }
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('image')) {
            return sock.sendMessage(from, { text: `❌ الرابط المدخل لا يؤدي إلى صورة مباشرة صالحة!` });
        }
        const buffer = Buffer.from(response.data);
        const sticker = new Sticker(buffer, {
            pack: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』',
            author: DEVELOPER_NAME,
            type: StickerTypes.DEFAULT,
            quality: 50
        });
        const stickerBuffer = await sticker.toBuffer();
        return sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
    } catch (e) {
        return sock.sendMessage(from, { text: `❌ تعذر جلب الصورة من الرابط، تأكد من أن الرابط مباشر وصالح.` });
    }
}

if (cmd.startsWith('ملصق_نصي')) {
    const textQuery = trimmedBody.replace(/^\.ملصق_نصي/i, '').trim();
    if (!textQuery) {
        return sock.sendMessage(from, { text: `📌 الاستخدام الصحيح: \`.ملصق_نصي <النص المطلوب>\`` });
    }
    try {
        const imgApiUrl = `https://api.lolhuman.xyz/api/text2image?apikey=gapis&text=${encodeURIComponent(textQuery)}`;
        const response = await axios.get(imgApiUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('image')) {
            return sock.sendMessage(from, { text: `❌ فشل توليد صورة النص من الخدمة السحابية.` });
        }
        const buffer = Buffer.from(response.data);
        const sticker = new Sticker(buffer, {
            pack: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』',
            author: DEVELOPER_NAME,
            type: StickerTypes.FULL,
            quality: 50
        });
        const stickerBuffer = await sticker.toBuffer();
        return sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
    } catch (e) {
        return sock.sendMessage(from, { text: `⚠️ عذراً، تعذر توليد الملصق النصي حالياً. يرجى تجربة نص قصير آخر.` });
    }
}

if (cmd === 'ملصق_متحرك' || cmd === 'فيديو_لملصق') {
    try {
        const qMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        const mime = Object.keys(qMsg)[0];
        if (!['videoMessage', 'documentMessage'].includes(mime) && !qMsg.videoMessage) {
            return sock.sendMessage(from, { text: `📌 يرجى إرسال فيديو قصير أو الرد عليه بكلمة \`.ملصق_متحرك\`` });
        }
        const mediaStream = await downloadMediaMessage({ key: msg.key, message: qMsg }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
        
        const sticker = new Sticker(mediaStream, {
            pack: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』',
            author: DEVELOPER_NAME,
            type: StickerTypes.CROPPED,
            categories: ['✨', '🍷'],
            quality: 30
        });
        const buffer = await sticker.toBuffer();
        return sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
    } catch (e) {
        return sock.sendMessage(from, { text: `❌ فشل تحويل الفيديو إلى ملصق متحرك.` });
    }
}

if (cmd === 'متحرك_لفيديو') {
    try {
        const qMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!qMsg || !qMsg.stickerMessage) {
            return sock.sendMessage(from, { text: `📌 يرجى الرد على ملصق متحرك بكلمة \`.متحرك_لفيديو\` لتحويله.` });
        }
        
        const mediaStream = await downloadMediaMessage({ key: msg.key, message: qMsg }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
        
        const tempDir = os.tmpdir();
        const inputWebp = path.join(tempDir, `input_${Date.now()}.webp`);
        const outputMp4 = path.join(tempDir, `output_${Date.now()}.mp4`);

        fs.writeFileSync(inputWebp, mediaStream);

        await new Promise((resolve, reject) => {
            ffmpeg(inputWebp)
                .inputFormat('webp')
                .outputOptions([
                    '-pix_fmt yuv420p',
                    '-c:v libx264',
                    '-movflags +faststart',
                    '-loop 0'
                ])
                .toFormat('mp4')
                .on('end', resolve)
                .on('error', reject)
                .save(outputMp4);
        });

        const videoBuffer = fs.readFileSync(outputMp4);
        try { fs.unlinkSync(inputWebp); fs.unlinkSync(outputMp4); } catch (e) {}

        return sock.sendMessage(from, { 
            video: videoBuffer, 
            caption: `✨ *تم تحويل الملصق المتحرك إلى فيديو صالح ويعمل بكفاءة!*`, 
            mimetype: 'video/mp4',
            ptt: false 
        }, { quoted: msg });

    } catch (e) {
        console.error('خطأ تحويل المتحرك لفيديو:', e);
        return sock.sendMessage(from, { text: `❌ فشل تحويل الملصق المتحرك إلى فيديو صالح.` });
    }
}

if (cmd.startsWith('حزمة')) {
    const characterName = trimmedBody.replace(/^\.حزمة/i, '').trim();
    if (!characterName) {
        return sock.sendMessage(from, { text: `📌 الاستخدام الصحيح: \`.حزمة <اسم الشخصية>\`\nمثال: \`.حزمة ناروتو\`` });
    }
    try {
        const searchApi = `https://api.lolhuman.xyz/api/pinterest?apikey=gapis&text=${encodeURIComponent(characterName + ' sticker anime')}`;
        const res = await axios.get(searchApi, { timeout: 15000 });
        const results = res.data?.result;

        if (!results || !Array.isArray(results) || results.length === 0) {
            return sock.sendMessage(from, { text: `❌ لم يتم العثور على حزمة ملصقات للشخصية (${characterName}).` });
        }

        let countSent = 0;
        for (let i = 0; i < Math.min(results.length, 3); i++) {
            try {
                let imgUrl = results[i];
                let imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 10000 });
                let imgBuffer = Buffer.from(imgRes.data);
                
                let stickerObj = new Sticker(imgBuffer, {
                    pack: `حزمة: ${characterName}`,
                    author: DEVELOPER_NAME,
                    type: StickerTypes.DEFAULT,
                    quality: 40
                });
                let stBuffer = await stickerObj.toBuffer();
                await sock.sendMessage(from, { sticker: stBuffer });
                countSent++;
                await new Promise(r => setTimeout(r, 1000));
            } catch (err) {}
        }

        if (countSent > 0) {
            return sock.sendMessage(from, { text: `✅ *تم إرسال (${countSent}) ملصقات حقيقية بنجاح لشخصية (${characterName})!*` });
        } else {
            return sock.sendMessage(from, { text: `❌ تعذر تحميل وتشكيل ملصقات هذه الحزمة.` });
        }
    } catch (e) {
        return sock.sendMessage(from, { text: `❌ عذراً، خدمة جلب الحزم غير متوفرة حالياً.` });
    }
}

async function restartSameGame(sock, from, gameType) {
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }

    const word = animeDatabase[Math.floor(Math.random() * animeDatabase.length)];

    if (gameType === 'typing') {
        const timer = setTimeout(async () => {
            if (activeGames[from] && activeGames[from].type === 'typing' && !activeGames[from].isCompleted) {
                delete activeGames[from];
                await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الكلمة كانت:* \`${word}\`` });
            }
        }, 30000);
        const sent = await sock.sendMessage(from, { text: `✍️ *فَـعَـالِـيَّـةُ الـكِـتَـابَـةِ (الوقت: 30 ثانية):*\n\nاكتب كلمة/اسم الأنمي التالية:\n\n👉 *${word}*` });
        activeGames[from] = { type: 'typing', answer: word, timer: timer, isCompleted: false, msgId: sent.key.id };

    } else if (gameType === 'disassemble') {
        const timer = setTimeout(async () => {
            if (activeGames[from] && activeGames[from].type === 'disassemble' && !activeGames[from].isCompleted) {
                delete activeGames[from];
                await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *التفكيك الصحيح هو:* \`${disassembleWord(word)}\`` });
            }
        }, 30000);
        const sent = await sock.sendMessage(from, { text: `🧩 *فَـعَـالِـيَّـةُ الـتَّـفْـكِـيـكِ (الوقت: 30 ثانية):*\n\nقم بتفكيك اسم/كلمة الأنمي التالية:\n\n👉 *${word}*` });
        activeGames[from] = { type: 'disassemble', answer: word, timer: timer, isCompleted: false, msgId: sent.key.id };

    } else if (gameType === 'arrange') {
        const shuffled = shuffleString(word);
        const timer = setTimeout(async () => {
            if (activeGames[from] && activeGames[from].type === 'arrange' && !activeGames[from].isCompleted) {
                delete activeGames[from];
                await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الترتيب الصحيح هو:* \`${word}\`` });
            }
        }, 30000);
        const sent = await sock.sendMessage(from, { text: `🔤 *فَـعَـالِـيَّـةُ الـتَّـرْتِـيـبِ (الوقت: 30 ثانية):*\n\nأعد ترتيب الحروف المبعثرة:\n\n👉 *[ ${shuffled} ]*` });
        activeGames[from] = { type: 'arrange', answer: word, timer: timer, isCompleted: false, msgId: sent.key.id };

    } else if (gameType === 'guess') {
        const randomNum = Math.floor(Math.random() * 50) + 1;
        const timer = setTimeout(async () => {
            if (activeGames[from] && activeGames[from].type === 'guess' && !activeGames[from].isCompleted) {
                delete activeGames[from];
                await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الرقم الصحيح هو:* \`${randomNum}\`` });
            }
        }, 30000);
        const sent = await sock.sendMessage(from, { text: `🎯 *فعالية التخمين:* خمن الرقم الصحيح من 1 إلى 50!` });
        activeGames[from] = { type: 'guess', answer: randomNum.toString(), timer: timer, isCompleted: false, msgId: sent.key.id };
    }
}

if (cmd === 'زواج') {    
    try {
        const meta = await sock.groupMetadata(from);
        const mems = meta.participants.map(p => p.id);
        
        let groom = sender;
        let bride = getTargetUser(msg);

        if (!bride) {
            groom = mems[Math.floor(Math.random() * mems.length)];
            bride = mems[Math.floor(Math.random() * mems.length)];
            while (groom === bride) {
                bride = mems[Math.floor(Math.random() * mems.length)];
            }
        }

        const marriageText = `╭━━〔 💍 𝑴𝑨𝑹𝑹𝑰𝑨𝑮𝑬 👑 〕━━⬣

│ 🕊️ بِـفَـرْمَـانٍ رَسْـمِـيٍّ مِـنْ نِـقَـابَـةِ ڤِـيـنْـلاَنْـد 🗡️
│ يُـعْـلَـنُ الـآنَ عَـقْـدُ الـقِـرَانِ الأُسْـطُـورِيّ بَـيْـنَ:

│ 🤵🏻 ⇢ الـعَـرِيـسُ الـمُـحَـارِب:
│ 👑 ⇢ @${groom.split('@')[0]}

│ 👰🏻 ⇢ الـعَـرُوسُ الـفَـاتِـنَـة:
│ 👑 ⇢ @${bride.split('@')[0]}

├────────────⬣
│ ✨ نَـتَـمَـنَّـى لَـهُـمَـا حَـيَـاةً مَـلِـيئَـةً بِـالـمَـجْـدِ وَالـسَّـعَـادَةِ الدَّائِـمَـة! 🥂❤️
╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;

        return sock.sendMessage(from, { text: marriageText, mentions: [groom, bride] });
    } catch (e) { return sock.sendMessage(from, { text: '❌ تعذر إتمام عقد الزواج.' }); }
}    

if (cmd === 'صراحة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const participants = meta.participants.map(p => p.id);    
        const randomUser = participants[Math.floor(Math.random() * participants.length)];    
        const q = sarahaQuestions[Math.floor(Math.random() * sarahaQuestions.length)];
        return sock.sendMessage(from, { text: `💬 *سُـؤَالُ صَـرَاحَـةٍ مَـوَجَّـهٌ إِلَـى @${randomUser.split('@')[0]}:*\n\n> 🎯 ${q}`, mentions: [randomUser] });    
    } catch (e) { return sock.sendMessage(from, { text: `💬 *سُـؤَالُ صَـرَاحَـة:* ${sarahaQuestions[0]}` }); }    
}    

if (cmd === 'خيروك' || cmd === 'لوخيروك') {    
    const q = khayrokQuestions[Math.floor(Math.random() * khayrokQuestions.length)];
    return sock.sendMessage(from, { text: `❓ *لَـعْـبَـةُ لَـوْ خَـيَّـرُوكَ:* \n\n> ${q}` });    
}    

if (cmdBase === 'كتابه' || cmdBase === 'كتابة') {
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }
    const word = animeDatabase[Math.floor(Math.random() * animeDatabase.length)];
    const timer = setTimeout(async () => {
        if (activeGames[from] && activeGames[from].type === 'typing' && !activeGames[from].isCompleted) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد (30 ثانية)!*\n💡 *الكلمة كانت:* \`${word}\`` });
        }
    }, 30000);

    const promptText = `✍️ *فَـعَـالِـيَّـةُ الـكِـتَـابَـةِ (الوقت: 30 ثانية):*\n\nاكتب كلمة/اسم الأنمي التالية بدقة سرعة:\n\n👉 *${word}*`;
    return sock.sendMessage(from, { text: promptText }).then(sent => {
        activeGames[from] = { type: 'typing', answer: word, timer: timer, isCompleted: false, msgId: sent.key.id };
    });
}

if (cmdBase === 'تفكيك') {
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }
    const word = animeDatabase[Math.floor(Math.random() * animeDatabase.length)];
    const timer = setTimeout(async () => {
        if (activeGames[from] && activeGames[from].type === 'disassemble' && !activeGames[from].isCompleted) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد (30 ثانية)!*\n💡 *التفكيك الصحيح هو:* \`${disassembleWord(word)}\`` });
        }
    }, 30000);

    const promptText = `🧩 *فَـعَـالِـيَّـةُ الـتَّـفْـكِـيـكِ (الوقت: 30 ثانية):*\n\nقم بتفكيك اسم/كلمة الأنمي التالية وإعادة كتابتها بحروف مفصولة بمسافات:\n\n👉 *${word}*`;
    return sock.sendMessage(from, { text: promptText }).then(sent => {
        activeGames[from] = { type: 'disassemble', answer: word, timer: timer, isCompleted: false, msgId: sent.key.id };
    });
}

if (cmd === 'رتب') {
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }
    const word = animeDatabase[Math.floor(Math.random() * animeDatabase.length)];
    const shuffled = shuffleString(word);

    const timer = setTimeout(async () => {
        if (activeGames[from] && activeGames[from].type === 'arrange' && !activeGames[from].isCompleted) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد (30 ثانية)!*\n💡 *الترتيب الصحيح هو:* \`${word}\`` });
        }
    }, 30000);

    const promptText = `🔤 *فَـعَـالِـيَّـةُ تَـرْتِـيـبِ الـحُـرُوفِ (الوقت: 30 ثانية):*\n\nأعد ترتيب الحروف المبعثرة لتكوين اسم أنمي أو شخصية صحيحة:\n\n👉 *[ ${shuffled} ]*`;
    return sock.sendMessage(from, { text: promptText }).then(sent => {
        activeGames[from] = { type: 'arrange', answer: word, timer: timer, isCompleted: false, msgId: sent.key.id };
    });
}

if (cmd === 'حرف') {    
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }
    const letters = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ر', 'س', 'ش', 'ص', 'ع', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'];    
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];    
    
    const timer = setTimeout(async () => {
        if (activeGames[from] && activeGames[from].type === 'letter_characters' && !activeGames[from].isCompleted) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد للفعالية!*` });
        }
    }, 45000);

    const promptText = `🔠 *فَـعَـالِـيَّـةُ الـحَـرْفِ (الوقت: 45 ثانية):*\n\nالحرف المطلوب: [ *${randomLetter}* ]\n\n📌 *المطلوب:* اكتب 3 أسماء شخصيات أنمي تبدأ بهذا الحرف في رسالة واحدة!`;
    return sock.sendMessage(from, { text: promptText }).then(sent => {
        activeGames[from] = { type: 'letter_characters', requiredLetter: randomLetter, timer: timer, isCompleted: false, msgId: sent.key.id };
    });
}    

if (cmd === 'حكمة') {    
    const item = animeQuotesList[Math.floor(Math.random() * animeQuotesList.length)];    
    const quoteFormatted = `📜 *مَوْسُوعَةُ حِكَمِ وَأَقْوَالِ الشَّخْصِيَّاتِ (الأنمي):*\n\n> "${item.quote}"\n\n👤 *الشَّخْصِيَّة:* \`${item.character}\``;
    return sock.sendMessage(from, { text: quoteFormatted });    
}    

if (cmd === 'خمن') { 
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }
    const randomNum = Math.floor(Math.random() * 50) + 1;
    const timer = setTimeout(async () => {
        if (activeGames[from] && activeGames[from].type === 'guess' && !activeGames[from].isCompleted) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الرقم الصحيح هو:* \`${randomNum}\`` });
        }
    }, 30000);
    return sock.sendMessage(from, { text: `🎯 *فعالية التخمين:* خمن الرقم الصحيح من 1 إلى 50!` }).then(sent => {
        activeGames[from] = { type: 'guess', answer: randomNum.toString(), timer: timer, isCompleted: false, msgId: sent.key.id };
    });
}    

if (cmdBase === 'حزورة' || cmdBase === 'لغز') { 
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }
    const riddles = [
        { q: "شيء يلبسه الملك وليس له ذراعين فما هو؟", a: "التاج" },
        { q: "شيء يمشي بلا أرجل ويدخل الأذنين؟", a: "الصوت" }
    ];
    const item = riddles[Math.floor(Math.random() * riddles.length)];
    const timer = setTimeout(async () => {
        if (activeGames[from] && activeGames[from].type === 'riddles' && !activeGames[from].isCompleted) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الجواب الصحيح:* \`${item.a}\`` });
        }
    }, 30000);
    return sock.sendMessage(from, { text: `🧩 *لغز وحزورة:*\n\n${item.q}` }).then(sent => {
        activeGames[from] = { type: 'riddles', answer: item.a, timer: timer, isCompleted: false, msgId: sent.key.id };
    });
}    

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
    return sock.sendMessage(from, { text: `*╎أذكـار 🌙私*\n\n*أذكار الـصـبـاح ⛅*\n\n- اللّهُ لاَ إِلَـهَ إِلاّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ...` });    
}    

if (cmd === 'اذكار_المساء' || cmd === 'أذكار_المساء') {    
    return sock.sendMessage(from, { text: `*أذكار الـمـسـاء 🌙*\n\n- اللهم انت ربي لا اله الا انت خلقتني وانا عبدك...` });    
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
        let text = `📊 *إِحْـصَـائِـيَّـاتُ تـوبِ الـتَّـفَـاعُـلِ لِـلْـيَوْمِ (${todayKey}):*\n💬 *إجمالي رسائل المجموعة اليوم:* \`${totalGroupMessages}\` رسالة\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n\n`;
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
    testReport += `\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐\n📊 *إجمالي الأوامر الفعالة:* \`${validCommands.length}\` أمر\n🟢 حالة النظام: [ممتازة]`;
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
    return sock.sendMessage(from, { text: `🟢 تم إيقاف البوت كلياً! لا يستجيب لأي أحد نهائياً.` });
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

if (cmdBase === 'توب_نقاط' || cmdBase === 'الاغنياء' || cmdBase === 'الأغنياء') {    
    try {
        const meta = await sock.groupMetadata(from);
        let mentions = meta.participants.map(p => p.id);
        let sorted = mentions.sort((a, b) => (userPoints[b] || 0) - (userPoints[a] || 0));

        let topText = `╭━━━〔 🏆 〕━━━╮\n『 قَـائِـمَـةُ أَعْلَى الـنِّـقَـاط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;    
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
╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;

            await sock.sendMessage(gId, { text: broadcastFormatted, mentions: allGroupMentions });
        }    

        const finalReport = `╭━━〔 📡 𝑹𝑬𝑷𝑶𝑹𝑻 〕━━⬣

│ 📊 تَقْرِيرُ الإِذَاعَةِ الشَّامِلَةِ:
│ تم إرسال البث بنجاح تامة!
│ 
│ 🏛️ عدد المجموعات المستهدفة: [${targetGroupsCount}] مجموعة
│ 🕒 وقت الإرسال: ${getJordanTime()}
╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;

        return sock.sendMessage(from, { text: finalReport });    
    } catch (e) { return sock.sendMessage(from, { text: '❌ فشل إرسال الإذاعة.' }); }    
}    

if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {    
    if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });    
    await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' });    
    process.exit(0);    
}    

if (cmdBase === 'بوت') {    
    const time = getJordanTime();    
    const botWelcomeText = `🍷 *أَهْـلاً بِـكَ فِي عَالَمِ 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}
> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> ┃ ⌯👨🏻‍💻︙الــمـطـور → 𝐸𝓇𝑒𝓃 (962796163926)
> ┃ 📊︙عدد الأوامر → ${validCommands.length} أمراً
> ┃ 
> ┃ ♟️ *"الهيبةُ ليستْ بصَخبِ الـحُضور،*
> ┃ *بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى."*
> ┃ ✦ لا نَسْعَى خَلْفَ الأَضْوَاءِ.. بَلْ نَدَعُ النَّتَائِجَ هِيَ مَنْ تَتَكَلَّمُ.
> ┃ 
> ┃ ⌯🚀︙الـتـوقـيـت → ${time}

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

📢 *قناة المطور الرسمية:*
${BOT_CHANNEL_URL}`;

    try { 
        // إرسال الفيديو والاستمارة الأصلية مرة واحدة فقط ودون أي تكرار
        await sock.sendMessage(from, { 
            video: { url: BOT_COMMANDS_VIDEO_URL }, 
            caption: botWelcomeText,
            mentions: [sender]
        });
    } catch (e) { 
        await sock.sendMessage(from, { 
            text: botWelcomeText,
            mentions: [sender]
        }); 
    }
    return;
}

if (cmdBase === 'اوامر' || cmdBase === 'الأوامر') {    
    const botCommandsText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ الـرَّسْـمِـيَّة:*

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
> 🎨 \`.11\` ↞ الملصقات

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
💡 *اكتب رقم القسم للوصول السريع!*`;

    const botPp = await getBotProfilePic(sock);
    try { 
        await sock.sendMessage(from, { 
            video: { url: BOT_COMMANDS_VIDEO_URL }, 
            caption: botCommandsText,
            mentions: [sender]
        }); 
    } catch (e) { 
        await sock.sendMessage(from, { text: botCommandsText }); 
    }
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
try { 
    try {
        await sock.sendMessage(from, { image: { url: userPp }, caption: text1, mentions: [sender] }); 
    } catch (err) {
        await sock.sendMessage(from, { text: text1, mentions: [sender] });
    }
} catch (e) { 
    await sock.sendMessage(from, { text: text1 }); 
}
return;
}

if (cmdBase === '2' || cmd === 'الترفيه' || cmd === 'العاب' || cmd === 'فعاليات') {    
    const entAndGamesText = `🎮🎲 *2. الترفيه والألعاب والفعاليات الأسطورية:*

> ❓ .خيروك ↞ لو خيروك
> 📜 .حكمة ↞ حكمة أنمي
> 💍 .زواج ↞ إعلان زواج عشوائي / منشن
> 🧩 .تفكيك ↞ تفكيك أنمي (+10 نقاط)
> ✍️ .كتابه ↞ سرعة كتابة (+10 نقاط)
> 💬 .صراحة ↞ صراحة وجمال الجمل
> 🔤 .رتب ↞ ترتيب الحروف
> 🎯 .خمن ↞ خمن الرقم
> 🔠 .حرف ↞ كلمات بالحرف
> 🚪 .انسحب ↞ إلغاء الفعالية`;
const userPp = await getUserProfilePic(sock, sender);
try { 
    try {
        await sock.sendMessage(from, { image: { url: userPp }, caption: entAndGamesText, mentions: [sender] }); 
    } catch (err) {
        await sock.sendMessage(from, { text: entAndGamesText, mentions: [sender] });
    }
} catch (e) { 
    await sock.sendMessage(from, { text: entAndGamesText }); 
}
return;
}

if (cmdBase === '3' || cmd === 'bank' || cmd === 'البنك' || cmd === 'النقاط') {    
    const bankMenuText = `💳 *3. البنك والنقاط:*

> 💳 .بنك | .حسابي ↞ كشف الحساب البنكي
> 💸 .تحويل <المبلغ> @منشن ↞ تحويل نقاط
> 🏆 .توب_نقاط ↞ ترتيب النقاط
> 🎁 .مكافأة ↞ الهدية اليومية (+20 نقطة)`;
const userPp = await getUserProfilePic(sock, sender);
try { 
    try {
        await sock.sendMessage(from, { image: { url: userPp }, caption: bankMenuText, mentions: [sender] }); 
    } catch (err) {
        await sock.sendMessage(from, { text: bankMenuText, mentions: [sender] });
    }
} catch (e) { 
    await sock.sendMessage(from, { text: bankMenuText }); 
}
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
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: islamText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: islamText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: islamText }); 
    }
    return;
}

if (cmdBase === '5') {
    const funText = `😂 *الضحك:*

> 🤣 .نكتة ↞ نكتة مضحكة
> 🤔 .ماذا_لو ↞ تساؤلات خيالية
> 🗣️ .قول ↞ حكمة اليوم`;
    const userPp = await getUserProfilePic(sock, sender);
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: funText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: funText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: funText }); 
    }
    return;
}

if (cmdBase === '6') {
    const groupExtText = `👥 *المجموعات:*

> 💍 .زواج ↞ زواج عشوائي للجروب
> 🌹 .غزل @منشن ↞ بيت غزل
> 💞 .ثنائي ↞ ثنائي عشوائي
> 👑 .ملك_المجموعة ↞ ملك الجروب
> 🧸 .كيوت_المجموعة ↞ كيوت الجروب
> 📩 .رسائلي ↞ عدد رسائلك
> 📊 .توب_التفاعل ↞ توب تفاعلات الجروب`;
    const userPp = await getUserProfilePic(sock, sender);
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: groupExtText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: groupExtText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: groupExtText }); 
    }
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
    try { 
        try {
            await sock.sendMessage(from, { image: { url: devPp }, caption: devMenuText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: devMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: devMenuText }); 
    }
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
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: adminMenuText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: adminMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: adminMenuText }); 
    }
    return;
}

if (cmdBase === '9' || cmd === 'الكاشف') {    
    const detectorMenuText = `🔍 *الكشف:* رد على رسالة (عرض مرة واحدة) بكلمة \`كشف\` لفكها فوراً.`;    
    const userPp = await getUserProfilePic(sock, sender);    
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: detectorMenuText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: detectorMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: detectorMenuText }); 
    }    
    return;    
}    

if (cmdBase === '10' || cmd === 'اللقب' || cmd === 'الالقب') {
    const titleMenuText = `👑 *قسم الألقاب:*

> ✍️ \`.اضافة_لقب @العضو اللقب\`
> ❌ \`.ازالة_لقب @العضو\`
> 🔒 \`.حجز_لقب @العضو اللقب\`
> 🔓 \`.الغاء_حجز_لقب @العضو\`
> 📋 \`.قائمة_الالقاب\`
> 🔒 \`.قائمة_الالقاب_المحجوزة\``;
    const userPp = await getUserProfilePic(sock, sender);
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: titleMenuText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: titleMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: titleMenuText }); 
    }
    return;
}

if (cmdBase === '11') {
    const stickerMenuText = `🎨 *قسـم الملصقات:*

> 🎨 \`.ملصق\` ↞ تحويل إلى ملصق
> 🖼️ \`.لصورة\` ↞ تحويل لصورة
> 🔗 \`.ملصق_رابط\` ↞ ملصق من رابط
> ✍️ \`.ملصق_نصي\` ↞ ملصق نصي
> 🎞️ \`.ملصق_متحرك\` ↞ ملصق متحرك
> 🎬 \`.فيديو_لملصق\` ↞ فيديو لملصق
> 🎥 \`.متحرك_لفيديو\` ↞ متحرك لفيديو
> 📦 \`.حزمة <اسم الشخصية>\` ↞ حزمة ملصقات`;
    const userPp = await getUserProfilePic(sock, sender);
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: stickerMenuText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: stickerMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: stickerMenuText }); 
    }
    return;
}

if (cmdBase === 'بنك' || cmd === 'حسابي') {    
    const userPp = await getUserProfilePic(sock, sender);    
    const accText = `💳 *كَـشْـفُ الحِـسَـابِ:* \n> رصيدك: *${userPoints[sender]} نقطة*`;    
    try { 
        try {
            await sock.sendMessage(from, { image: { url: userPp }, caption: accText, mentions: [sender] }); 
        } catch (err) {
            await sock.sendMessage(from, { text: accText, mentions: [sender] });
        }
    } catch (e) { 
        await sock.sendMessage(from, { text: accText, mentions: [sender] }); 
    }    
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

    const rewardText = `╭━━━〔 🎁 〕━━━╮\n『 الـمُـكَـافَـأَةُ الـيَـوْمِـيَّـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو @${sender.split('@')[0]}\n💰 ⌯ المكافأة 20 نقطة\n✨ ⌯ الحالة تم استلام المكافأة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 『✦』`;
    return sock.sendMessage(from, { text: rewardText, mentions: [sender] });
}

});

}

startBot();
