import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import * as BaileysNs from '@whiskeysockets/baileys';
import pino from 'pino';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { initSubBots, handleSubBotCommand, isSubBotPrivateBlocked, getSubBotMedia } from './subbot.js';
import { sendFormWithButtons, sendDevInfoWithButton, getButtonId, sendSectionWithButtons, sendSectionsList, setForwardContextProvider, protectionButton } from './menu.js';
import { handleFeatureCommand, featureCommandNames, isFeatureLinkCommand, collectPackImages } from './features.js';
import { handleToolsCommand, toolsCommandNames, isToolsLinkCommand } from './tools.js';

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
    { quote: "العدالة ليست شيئاً يمكنك شراءه بالمال، العدالة هي القوة التي تحمي الضغفاء.", character: "رورونوا زورو" }
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
// ===== حماية أوامر المطور داخل البوتات الفرعية =====
// البوت الفرعي لا يقبل أوامر المطور إلا من حساب المطور الأساسي أو حساب البوت الرئيسي
const MAIN_BOT_NUMBER = String(global.botnumber || '962795106901').replace(/[^0-9]/g, '');
const DEV_ONLY_COMMANDS = ['7', 'المطور', 'مطور', 'ايقاف_البوت', 'إيقاف_البوت', 'إيقاف البوت', 'تفعيل_البوت', 'تفعيل البوت', 'بوم', 'اضافة_مطور', 'حذف_مطور', 'اضف_نخبة', 'ازل_نخبة', 'عرض_نخبة', 'قائمة_المطورين', 'سجل_البوت', 'اختبار', 'اذاعة', 'إذاعة', 'اساسي', 'ريستارت', 'تعطيل_البوتات', 'تعطيل بوتات'];
function isMainAccount(senderJid) {
const n = String(senderJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
return !!n && (n === DEVELOPER_NUMBER || n === MAIN_BOT_NUMBER);
}
const BOT_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbAyOwm3mFY0ohjZCB04';
const BOT_COMMANDS_VIDEO_URL = 'https://videotourl.com/videos/1792370059642-b3c5430a-35a6-4703-83a2-f9ed1224cfe3.mp4';
const BOT_VIDEO_FILE = './bot_commands_video.mp4';
const DEV_INFO_VIDEO_URL = 'https://videotourl.com/videos/1793411909499-fceac088-929e-4d67-890d-f9a40165767e.mp4';
// الفيديو الظاهر فوق استمارة .بوت: الملف المحفوظ بأمر .اساسي إن وُجد، وإلا الرابط الافتراضي
function getBotCommandsVideo() {
    try { if (fs.existsSync(BOT_VIDEO_FILE) && fs.statSync(BOT_VIDEO_FILE).size > 0) return BOT_VIDEO_FILE; } catch (e) {}
    return BOT_COMMANDS_VIDEO_URL;
}
const BOT_PROFILE_IMAGE_URL = 'https://i.ibb.co/3Y7vn8zZ/1001256689-1.png';

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

async function sendBotMessage(sock, jid, content, options = {}) {
    let finalContent = {};
    if (typeof content === 'string') {
        finalContent = { text: content };
    } else {
        finalContent = { ...content };
    }

    return await sock.sendMessage(jid, {
        ...finalContent,
        ...options
    });
}

let userPoints = {};
let userWarnings = {};
let bankAccounts = {};
let activeGames = {}; 
let dailyRewards = {};
let mutedUsers = {};
let userMessagesCount = {};
let groupSettings = {};
const WELCOME_FILE = './group_welcome.json';
let welcomeStore = {};
try { welcomeStore = JSON.parse(fs.readFileSync(WELCOME_FILE, 'utf8')) || {}; } catch (e) { welcomeStore = {}; }

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
const stoppedSubBotGroups = new Set(); // المجموعات التي أُوقفت فيها البوتات المنصّبة فقط

let commandReactionEnabled = true;
let commandReactionEmoji = '⚡';
let devReactionEnabled = true;
let devReactionEmoji = '👑';

const validCommands = [
'كشف', 'الكاشف',
'تفاعل', 'تفاعل_مطور', 'اعطاء', 'إعطاء', 'اذاعة', 'إذاعة', 'ريستارت', 'اعادة_تشغيل', 'حذف', 'مسح', 'كتم', 'الغاء_كتم', 'فك_كتم',
'خاص', 'عام', 'وضع_خاص', 'وضع_عام', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_ترحيب', 'تغيير_توديع', 'ترحيب_افتراضي', 'توديع_افتراضي', 'تفعيل_كشف_المحذوف', 'توقيف_كشف_المحذوف', 'قائمة_المحذوف', 'تفعيل_كشف_المعدل', 'توقيف_كشف_المعدل', 'قائمة_المعدل',
'قفل', 'غلق', 'فتح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'بوم',
'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط',
'حظر_رابط', 'سماح_رابط', 'حظر_شتم', 'سماح_شتم', 'حظر_جهات', 'حظر_جهات_الاتصال', 'سماح_جهات', 'سماح_جهات_الاتصال',
'صفر', 'بوت', 'devinfo_form',
'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '16', 'الفرعي', 'حالة_بوتي', 'حذف_بوتي', 'مشرف_بوتي', 'اسم_البوت', 'صورة_البوت', 'تنصيب', 'الغاء_تنصيب', 'قائمة_التنصيب',
'الترفيه', 'العاب', 'فعاليات', 'bank', 'البنك', 'النقاط',
'حسابي', 'بنك', 'تحويل', 'توب_نقاط', 'الاغنياء', 'الأغنياء', 'مكافأة', 'هدية',
'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'لوخيروك', 'حكمة',
'صراحة', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'انسحب',
'زواج', 'غزل', 'ثنائي', 'ملك_المجموعة', 'ملكة_المجموعة', 'محبوب_المجموعة', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'مميز_المجموعة', 'كيوت_المجموعة',
'رسائلي', 'توب_التفاعل',
'المطور', 'مطور', 'الادارة', 'الاداره',
'اضافة_مطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار',
'اضف_انذار', 'ازل_انذار', 'حذف_انذار', 'عدد_الانذارات', 'قائمة_الانذارات',
'حظر رابط', 'سماح رابط', 'حظر شتم', 'سماح شتم', 'حظر جهات', 'سماح جهات',
'ايقاف_البوت', 'تفعيل_البوت', 'إيقاف_البوت', 'إيقاف البوت', 'تفعيل البوت',
'اضف_نخبة', 'ازل_نخبة', 'عرض_نخبة',
'اساسي',
'قران', 'قرآن', 'دعاء', 'ذكر', 'حديث', 'أذكار', 'اذكار', 'اذكار_الصباح', 'اذكار_المساء', 'اذكار_الاستيقاظ', 'اذكار_الصلاة', 'اذكار_المسجد',
'نكتة', 'ماذا_لو', 'قول',
'تعطيل_البوتات', 'تعطيل بوتات',
'اضافة_لقب', 'ازالة_لقب', 'حجز_لقب', 'الغاء_حجز_لقب', 'قائمة_الالقاب', 'قائمة_الالقاب_المحجوزة', 'الالقاب',
];
validCommands.push(...featureCommandNames);
validCommands.push(...toolsCommandNames);
validCommands.push('قوانين', 'ضبط_قوانين', 'منشن_المشرفين', 'حظر_اكواد', 'سماح_اكواد', 'غير_المتفاعلين', 'طرد_غير_المتفاعلين', 'قفل_مؤقت', 'جدولة_قفل');
validCommands.push('مستواي', 'توب_المستويات', 'تايتن', 'اهجم', 'توب_المهاجمين', 'ميلادي', 'اقرب_ميلاد', 'بطاقتي', 'مزاد', 'زايد', 'كبسولة');

function isValidCmd(fullCmd) {
const base = fullCmd.split(' ')[0];
if (base === 'قائمة_الاقسام') return true;
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
if (!sock?.isSubBot && botJidNum && (cleanNum === botJidNum || cleanNum.endsWith(botJidNum))) return true;
return extraDevelopers.some(dev => cleanNum.includes(dev) || dev.includes(cleanNum));
}

async function getUserProfilePic(sock, senderJid) {
try {
return await sock.profilePictureUrl(senderJid, 'image');
} catch (e) {
return BOT_PROFILE_IMAGE_URL;
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
welcome: false,
goodbye: false,
botMode: 'public',
antiOtherBots: false
};
// الترحيب والتوديع متوقفان افتراضياً حتى يشغّلهما المشرف، وكل مجموعة لها إعداداتها ونصوصها الخاصة
Object.assign(groupSettings[groupId], welcomeStore[groupId] || {});
}
return groupSettings[groupId];
}

// استبدال علامة المنشن في نص الترحيب/التوديع المخصص (@العضو أو @منشن أو @user)، وإن لم توجد تُضاف منشن للعضو في آخر النص
function applyMemberMention(text, user) {
const tag = '@' + user.split('@')[0];
const re = /@(العضو|منشن|user)/g;
if (re.test(text)) return text.replace(/@(العضو|منشن|user)/g, () => tag);
return text + '\n\n' + tag;
}
function persistWelcome(groupId) {
const g = getGroupSetting(groupId);
welcomeStore[groupId] = { welcome: !!g.welcome, goodbye: !!g.goodbye, welcomeText: g.welcomeText || '', goodbyeText: g.goodbyeText || '' };
try { fs.writeFileSync(WELCOME_FILE, JSON.stringify(welcomeStore)); } catch (e) {}
}

// ===== أوامر المجموعات الإضافية: قوانين / منشن_المشرفين / حظر_اكواد / غير_المتفاعلين / طرد_غير_المتفاعلين / قفل_مؤقت / جدولة_قفل =====
const GROUP_EXTRA_FILE = './group_extra.json';
let groupExtra = { rules: {}, blockedCodes: {}, lastSeen: {}, joined: {}, trackStart: {}, tempLocks: {}, schedules: {} };
try { const d = JSON.parse(fs.readFileSync(GROUP_EXTRA_FILE, 'utf8')); if (d && typeof d === 'object') groupExtra = { ...groupExtra, ...d }; } catch (e) {}
let groupExtraDirty = false;
let groupExtraFlusher = null;
const mentionAdminsCooldown = {};
const GE_CMDS = new Set(['قوانين', 'ضبط_قوانين', 'منشن_المشرفين', 'حظر_اكواد', 'سماح_اكواد', 'غير_المتفاعلين', 'طرد_غير_المتفاعلين', 'قفل_مؤقت', 'جدولة_قفل']);
const GE_ALIASES = [
    [/^طرد[ _]غير[ _]المتفاعلين(?=\s|$)/, 'طرد_غير_المتفاعلين'],
    [/^غير[ _]المتفاعلين(?=\s|$)/, 'غير_المتفاعلين'],
    [/^قفل[ _]مؤقت(?=\s|$)/, 'قفل_مؤقت'],
    [/^جدول[ةه][ _]قفل(?=\s|$)/, 'جدولة_قفل'],
    [/^منشن[ _]المشرفين(?=\s|$)/, 'منشن_المشرفين'],
    [/^حظر[ _]اكواد(?=\s|$)/, 'حظر_اكواد'],
    [/^سماح[ _]اكواد(?=\s|$)/, 'سماح_اكواد'],
    [/^ضبط[ _]قوانين(?=\s|$)/, 'ضبط_قوانين'],
];
// يحوّل صيغ الأوامر الجديدة التي فيها مسافة إلى صيغة موحّدة (حتى لا تتعارض مع قفل/طرد/منشن الأصلية)
function normalizeGroupExtraCmd(cmd) {
    for (const [re, to] of GE_ALIASES) { if (re.test(cmd)) { cmd = cmd.replace(re, to); break; } }
    const m = cmd.match(/^(\S+)\n/);
    if (m && GE_CMDS.has(m[1])) cmd = cmd.replace('\n', ' ');
    return cmd;
}
function saveGroupExtra() { try { fs.writeFileSync(GROUP_EXTRA_FILE, JSON.stringify(groupExtra)); } catch (e) {} groupExtraDirty = false; }
function jidDigits(j) { return String(j || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
function memberKeys(p) { return [p?.id, p?.phoneNumber, p?.lid, p?.jid].map(jidDigits).filter(Boolean); }
function toLatinDigits(str) { return String(str || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }
function ensureTrack(groupId) { if (!groupExtra.trackStart[groupId]) { groupExtra.trackStart[groupId] = Date.now(); groupExtraDirty = true; } }
function fmtAmman(ts) { return new Date(ts).toLocaleTimeString('ar-EG', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hour12: true }); }
function ammanMinutesNow() {
    const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Amman', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
    const [h, m] = t.split(':').map(Number);
    return ((h % 24) * 60) + m;
}
function fmtHM(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix} (${hhmm})`;
}
// قراءة وقت مثل 23:00 أو 6:00ص أو 12م
function parseTimeToken(tok) {
    const m = String(tok).match(/^(\d{1,2})(?::(\d{2}))?(ص|م|am|pm)?$/i);
    if (!m) return null;
    let h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0; const suf = (m[3] || '').toLowerCase();
    if (min > 59) return null;
    if (suf) { if (h < 1 || h > 12) return null; h = (suf === 'م' || suf === 'pm') ? (h % 12) + 12 : h % 12; }
    else if (h > 23) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function computeInactive(sock, meta, groupId, days) {
    const now = Date.now();
    const limit = days * 86400000;
    const ls = groupExtra.lastSeen[groupId] || {};
    const jn = groupExtra.joined[groupId] || {};
    const start = groupExtra.trackStart[groupId] || now;
    const botD = jidDigits(sock.user?.id);
    const list = [];
    for (const p of meta.participants || []) {
        if (p.admin === 'admin' || p.admin === 'superadmin') continue;
        const keys = memberKeys(p);
        if (botD && keys.includes(botD)) continue;
        if (isDeveloper(p.phoneNumber || p.id, sock) || isDeveloper(p.id, sock)) continue;
        const seen = Math.max(0, ...keys.map((k) => ls[k] || 0));
        const joined = Math.max(0, ...keys.map((k) => jn[k] || 0));
        const last = Math.max(start, seen, joined);
        if (now - last >= limit) list.push({ id: p.id, last, seen: seen > 0 });
    }
    list.sort((a, b) => a.last - b.last);
    return { list, trackDays: (now - start) / 86400000 };
}

async function handleGroupExtraCommand({ sock, msg, from, sender, cmd, trimmedBody, isSenderAdmin, isSenderDev }) {
    const base = cmd.split(' ')[0];
    if (!GE_CMDS.has(base)) return false;
    const args = cmd.slice(base.length).trim();
    const isAdm = isSenderAdmin || isSenderDev;
    const reply = (text, mentions) => sendBotMessage(sock, from, mentions ? { text, mentions } : { text }).catch(() => {});
    const adminOnly = () => reply('❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!');
    ensureTrack(from);

    // ---------- القوانين ----------
    if (base === 'قوانين') {
        const rules = groupExtra.rules[from];
        if (!rules) return reply('📜 لم يتم ضبط قوانين لهذه المجموعة بعد.' + (isAdm ? '\n📌 اضبطها بالأمر: `.ضبط_قوانين <النص>`' : '')), true;
        return reply(`📜 *قوانين المجموعة:*\n\n${rules}`), true;
    }
    if (base === 'ضبط_قوانين') {
        if (!isAdm) return adminOnly(), true;
        const text = trimmedBody.replace(/^\.ضبط[ _]قوانين/i, '').trim();
        if (!text) return reply('📌 اكتب القوانين بعد الأمر.\nمثال:\n`.ضبط_قوانين\n1- الاحترام المتبادل\n2- ممنوع الروابط`'), true;
        if (text.length > 3000) return reply('❌ القوانين طويلة جداً، الحد الأقصى 3000 حرف.'), true;
        groupExtra.rules[from] = text; saveGroupExtra();
        return reply('✅ تم حفظ قوانين المجموعة، يعرضها الجميع بـ `.قوانين`'), true;
    }

    // ---------- منشن المشرفين ----------
    if (base === 'منشن_المشرفين') {
        if (!isAdm) {
            const last = mentionAdminsCooldown[from + sender] || 0;
            if (Date.now() - last < 60000) return reply('⏳ انتظر دقيقة قبل استدعاء المشرفين مرة أخرى.'), true;
            mentionAdminsCooldown[from + sender] = Date.now();
        }
        try {
            const meta = await sock.groupMetadata(from);
            const botD = jidDigits(sock.user?.id);
            const admins = (meta.participants || []).filter((p) => (p.admin === 'admin' || p.admin === 'superadmin') && !(botD && memberKeys(p).includes(botD))).map((p) => p.id);
            if (!admins.length) return reply('❌ لا يوجد مشرفون لمنشنهم.'), true;
            const reason = trimmedBody.replace(/^\.منشن[ _]المشرفين/i, '').trim();
            let text = `🚨 *نِـدَاءٌ لِـلْـمُـشْـرِفِـيـن*\n\n👤 من: @${sender.split('@')[0]}\n`;
            if (reason) text += `📝 السبب: ${reason}\n`;
            text += `\n`;
            admins.forEach((id) => { text += `> 👑 @${id.split('@')[0]}\n`; });
            return reply(text, [...admins, sender]), true;
        } catch (e) { return reply('❌ تعذر منشن المشرفين.'), true; }
    }

    // ---------- حظر / سماح أكواد الدول ----------
    if (base === 'حظر_اكواد' || base === 'سماح_اكواد') {
        if (!isAdm) return adminOnly(), true;
        const list = groupExtra.blockedCodes[from] || [];
        const codes = toLatinDigits(args).split(/[\s,،]+/).map((c) => c.replace(/^\+/, '').replace(/^00/, '')).filter(Boolean);
        if (base === 'حظر_اكواد') {
            if (!codes.length) return reply(list.length ? `🚫 *أكواد الدول المحظورة:*\n${list.map((c) => `> +${c}`).join('\n')}\n\n📌 للإضافة: \`.حظر_اكواد 1 212\`\n📌 للإزالة: \`.سماح_اكواد 1\`` : '📌 لا توجد أكواد محظورة.\nمثال: `.حظر_اكواد 1 212` (يطرد أي عضو جديد رقمه يبدأ بهذه الأكواد)'), true;
            const bad = codes.filter((c) => !/^\d{1,4}$/.test(c));
            if (bad.length) return reply('❌ اكتب الأكواد أرقاماً فقط (مثل 1 أو 212 أو 972).'), true;
            groupExtra.blockedCodes[from] = [...new Set([...list, ...codes])]; saveGroupExtra();
            return reply(`🚫 تم حظر الأكواد: ${codes.map((c) => '+' + c).join('، ')}\n📌 يُطبّق على الأعضاء الجدد، ويلزم أن يكون البوت مشرفاً.`), true;
        }
        if (!codes.length) return reply('📌 اكتب الكود المراد السماح به، مثال: `.سماح_اكواد 1` أو `.سماح_اكواد الكل`'), true;
        if (args.trim() === 'الكل') { groupExtra.blockedCodes[from] = []; saveGroupExtra(); return reply('✅ تم السماح بكل الأكواد.'), true; }
        groupExtra.blockedCodes[from] = list.filter((c) => !codes.includes(c)); saveGroupExtra();
        return reply(`✅ تم السماح بالأكواد: ${codes.map((c) => '+' + c).join('، ')}`), true;
    }

    // ---------- غير المتفاعلين / طرد غير المتفاعلين ----------
    if (base === 'غير_المتفاعلين' || base === 'طرد_غير_المتفاعلين') {
        if (!isAdm) return adminOnly(), true;
        const days = parseInt(toLatinDigits(args).replace(/[^0-9]/g, ''), 10);
        const isKick = base === 'طرد_غير_المتفاعلين';
        if (!days || days < 1 || days > 365) return reply(`📌 اكتب عدد الأيام بعد الأمر.\nمثال: \`.${base} 5\``), true;
        try {
            const meta = await sock.groupMetadata(from);
            const { list, trackDays } = computeInactive(sock, meta, from, days);
            const trackTxt = trackDays < 1 ? 'أقل من يوم' : `${Math.floor(trackDays)} يوم`;
            if (isKick) {
                if (trackDays < days) return reply(`⚠️ البوت يتتبع نشاط الأعضاء منذ ${trackTxt} فقط، ولا يمكن طرد من لم يتفاعل ${days} يوم قبل اكتمال المدة.\nجرّب مدة أقل أو انتظر.`), true;
                if (!list.length) return reply(`✅ لا يوجد أعضاء غير متفاعلين منذ ${days} يوم.`), true;
                await reply(`⏳ جارٍ طرد ${list.length} عضو غير متفاعل منذ ${days} يوم...`);
                let ok = 0;
                for (let i = 0; i < list.length; i += 10) {
                    const chunk = list.slice(i, i + 10).map((x) => x.id);
                    try { await sock.groupParticipantsUpdate(from, chunk, 'remove'); ok += chunk.length; } catch (e) {}
                    await new Promise((r) => setTimeout(r, 2000));
                }
                if (!ok) return reply('❌ فشل الطرد، تأكد أن البوت مشرف ولديه الصلاحيات.'), true;
                return reply(`╭━━━〔 ⚔️ 〕━━━╮\n『 طَـرْدُ غَـيْـرِ الـمُـتَـفَـاعِـلِـيـن 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📅 ⌯ المدة ↞ ${days} يوم\n✅ ⌯ تم طرد ↞ ${ok} من ${list.length}»`, [sender]), true;
            }
            let text = `📉 *الأعضاء غير المتفاعلين منذ ${days} يوم أو أكثر:* (${list.length})\n`;
            if (trackDays < days) text += `⚠️ البوت يتتبع النشاط منذ ${trackTxt} فقط، فالنتائج غير مكتملة.\n`;
            if (!list.length) return reply(text + `\n✅ لا يوجد أعضاء غير متفاعلين.`), true;
            text += `\n`;
            const shown = list.slice(0, 60);
            const now = Date.now();
            shown.forEach((x) => {
                const d = Math.floor((now - x.last) / 86400000);
                text += `> 👤 @${x.id.split('@')[0]} ↞ ${x.seen ? `آخر رسالة قبل ${d} يوم` : `بدون رسائل منذ ${d} يوم`}\n`;
            });
            if (list.length > shown.length) text += `\n... و ${list.length - shown.length} آخرين`;
            text += `\n\n📌 للطرد: \`.طرد_غير_المتفاعلين ${days}\``;
            return reply(text, shown.map((x) => x.id)), true;
        } catch (e) { return reply('❌ تعذر جلب بيانات الأعضاء.'), true; }
    }

    // ---------- قفل مؤقت ----------
    if (base === 'قفل_مؤقت') {
        if (!isAdm) return adminOnly(), true;
        if (args === 'الغاء') {
            if (!groupExtra.tempLocks[from]) return reply('📌 لا يوجد قفل مؤقت نشط.'), true;
            delete groupExtra.tempLocks[from]; saveGroupExtra();
            return reply('✅ تم إلغاء الفتح التلقائي، افتح المجموعة يدوياً بـ `.فتح`.'), true;
        }
        const mins = parseInt(toLatinDigits(args).replace(/[^0-9]/g, ''), 10);
        if (!mins || mins < 1 || mins > 1440) return reply('📌 اكتب المدة بالدقائق (من 1 إلى 1440).\nمثال: `.قفل_مؤقت 30`\nللإلغاء: `.قفل_مؤقت الغاء`'), true;
        try { await sock.groupSettingUpdate(from, 'announcement'); }
        catch (e) { return reply('❌ فشل قفل المجموعة، تأكد أن البوت مشرف.'), true; }
        const unlockAt = Date.now() + mins * 60000;
        groupExtra.tempLocks[from] = { unlockAt, botId: jidDigits(sock.user?.id), by: sender, tries: 0 };
        saveGroupExtra();
        return reply(`╭━━━〔 🔒 〕━━━╮\n『 قَـفْـلٌ مُـؤَقَّـت 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n⏳ ⌯ المدة ↞ ${mins} دقيقة\n🔓 ⌯ تفتح تلقائياً ↞ ${fmtAmman(unlockAt)} (توقيت عمّان)»`, [sender]), true;
    }

    // ---------- جدولة قفل ----------
    if (base === 'جدولة_قفل') {
        if (!isAdm) return adminOnly(), true;
        const cur = groupExtra.schedules[from];
        if (args === 'الغاء') {
            if (!cur) return reply('📌 لا توجد جدولة قفل لهذه المجموعة.'), true;
            delete groupExtra.schedules[from]; saveGroupExtra();
            return reply('✅ تم إلغاء جدولة القفل.'), true;
        }
        if (!args) {
            return reply(cur ? `🗓️ *جدولة القفل الحالية:*\n🔒 القفل ↞ ${fmtHM(cur.lock)}\n🔓 الفتح ↞ ${fmtHM(cur.unlock)}\n🌍 التوقيت ↞ عمّان\n\n📌 للإلغاء: \`.جدولة_قفل الغاء\`` : '📌 اكتب وقت القفل ثم وقت الفتح.\nمثال: `.جدولة_قفل 23:00 06:00`\nأو بالصباح/المساء: `.جدولة_قفل 11:00م 6:00ص`\nللإلغاء: `.جدولة_قفل الغاء`\n🌍 التوقيت: عمّان'), true;
        }
        const cleaned = toLatinDigits(args).replace(/\s+(ص|م|am|pm)(?=\s|$)/gi, '$1');
        const toks = cleaned.split(/[\s,،\-–]+/).filter((t) => t && !['الى', 'الي', 'حتى', 'و'].includes(t));
        const times = toks.map(parseTimeToken);
        if (toks.length !== 2 || times.some((t) => !t)) return reply('❌ صيغة غير صحيحة.\nمثال: `.جدولة_قفل 23:00 06:00` أو `.جدولة_قفل 11:00م 6:00ص`'), true;
        if (times[0] === times[1]) return reply('❌ وقت القفل ووقت الفتح لا يمكن أن يكونا متساويين.'), true;
        groupExtra.schedules[from] = { lock: times[0], unlock: times[1], botId: jidDigits(sock.user?.id), lastLock: 0, lastUnlock: 0, by: sender };
        saveGroupExtra();
        return reply(`╭━━━〔 🗓️ 〕━━━╮\n『 جَـدْوَلَـةُ الـقَـفْـل 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«🔒 ⌯ القفل يومياً ↞ ${fmtHM(times[0])}\n🔓 ⌯ الفتح يومياً ↞ ${fmtHM(times[1])}\n🌍 ⌯ التوقيت ↞ عمّان»\n\n📌 يلزم أن يكون البوت مشرفاً.`), true;
    }
    return false;
}

// تشغيل التتبع والمجدول والحماية بالأكواد لكل اتصال (يعمل بمستمعين خاصين دون التأثير على بقية الأحداث)
function setupGroupAutomation(sock) {
    // تتبع آخر نشاط للأعضاء
    sock.ev.on('messages.upsert', (m) => {
        try {
            if (m.type !== 'notify') return;
            for (const mm of m.messages || []) {
                const gid = mm?.key?.remoteJid;
                if (!gid || !gid.endsWith('@g.us') || mm.key.fromMe || !mm.message) continue;
                const keys = [mm.key.participant, mm.key.participantAlt, mm.key.participantPn].map(jidDigits).filter(Boolean);
                if (!keys.length) continue;
                ensureTrack(gid);
                if (!groupExtra.lastSeen[gid]) groupExtra.lastSeen[gid] = {};
                const now = Date.now();
                keys.forEach((k) => { groupExtra.lastSeen[gid][k] = now; });
                groupExtraDirty = true;
            }
        } catch (e) {}
    });

    // بدء التتبع لكل المجموعات عند الاتصال
    sock.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
            try { const all = await sock.groupFetchAllParticipating(); Object.keys(all || {}).forEach(ensureTrack); saveGroupExtra(); } catch (e) {}
        }
    });

    // وقت دخول الأعضاء + طرد الأكواد المحظورة
    sock.ev.on('group-participants.update', async (anu) => {
        try {
            const { id, action } = anu;
            if (action !== 'add') return;
            ensureTrack(id);
            if (!groupExtra.joined[id]) groupExtra.joined[id] = {};
            const blocked = groupExtra.blockedCodes[id] || [];
            for (const p of anu.participants || []) {
                const obj = typeof p === 'string' ? { id: p } : p;
                const now = Date.now();
                memberKeys(obj).forEach((k) => { groupExtra.joined[id][k] = now; });
                groupExtraDirty = true;
                if (!blocked.length) continue;
                const phoneJid = [obj.phoneNumber, obj.id].find((j) => j && String(j).endsWith('@s.whatsapp.net'));
                if (!phoneJid) continue;
                const num = jidDigits(phoneJid);
                if (isDeveloper(phoneJid, sock)) continue;
                if (blocked.some((c) => num.startsWith(c))) {
                    try {
                        await sock.groupParticipantsUpdate(id, [obj.id || phoneJid], 'remove');
                        await sendBotMessage(sock, id, { text: `🚫 تم طرد @${num} تلقائياً لأن كود دولته محظور في هذه المجموعة.`, mentions: [phoneJid] });
                    } catch (e) {}
                }
            }
        } catch (e) {}
    });

    // مجدول القفل المؤقت والقفل المجدول + حفظ دوري
    if (!groupExtraFlusher) {
        groupExtraFlusher = setInterval(() => { if (groupExtraDirty) saveGroupExtra(); }, 30000);
        if (groupExtraFlusher.unref) groupExtraFlusher.unref();
    }
    const timer = setInterval(async () => {
        try {
            const myId = jidDigits(sock.user?.id);
            if (!myId) return;
            const now = Date.now();
            for (const [gid, e] of Object.entries(groupExtra.tempLocks)) {
                if (e.botId !== myId || e.unlockAt > now) continue;
                try {
                    await sock.groupSettingUpdate(gid, 'not_announcement');
                    delete groupExtra.tempLocks[gid]; saveGroupExtra();
                    await sendBotMessage(sock, gid, { text: '🔓 انتهى القفل المؤقت وتم فتح المجموعة تلقائياً.' });
                } catch (err) {
                    e.tries = (e.tries || 0) + 1;
                    if (e.tries >= 3) { delete groupExtra.tempLocks[gid]; }
                    saveGroupExtra();
                }
            }
            const nowMin = ammanMinutesNow();
            for (const [gid, s] of Object.entries(groupExtra.schedules)) {
                if (s.botId !== myId) continue;
                const due = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return ((nowMin - (h * 60 + m) + 1440) % 1440) < 10; };
                if (due(s.lock) && now - (s.lastLock || 0) > 20 * 3600000) {
                    s.lastLock = now; saveGroupExtra();
                    try { await sock.groupSettingUpdate(gid, 'announcement'); await sendBotMessage(sock, gid, { text: `🔒 تم قفل المجموعة تلقائياً حسب الجدولة، وتفتح الساعة ${fmtHM(s.unlock)}.` }); } catch (err) {}
                }
                if (due(s.unlock) && now - (s.lastUnlock || 0) > 20 * 3600000) {
                    s.lastUnlock = now; saveGroupExtra();
                    try { await sock.groupSettingUpdate(gid, 'not_announcement'); await sendBotMessage(sock, gid, { text: '🔓 تم فتح المجموعة تلقائياً حسب الجدولة.' }); } catch (err) {}
                }
            }
        } catch (e) {}
    }, 20000);
    sock.ev.on('connection.update', ({ connection }) => { if (connection === 'close') clearInterval(timer); });
}

// ===== قسم المجموعات المميز: مستويات / تايتن / أعياد ميلاد / بطاقة / مزاد / كبسولة =====
const GROUP_FUN_FILE = './group_fun.json';
let groupFun = { xp: {}, msgs: {}, births: {}, capsules: [] };
try { const d = JSON.parse(fs.readFileSync(GROUP_FUN_FILE, 'utf8')); if (d && typeof d === 'object') groupFun = { ...groupFun, ...d }; } catch (e) {}
let groupFunDirty = false;
let groupFunFlusher = null;
const gfSeen = new Set();
const gfLastXp = new Map();
const gfBoss = {};
const gfBossLast = {};
const gfBossCd = {};
const gfAuctions = {};
const GF_CMDS = new Set(['مستواي', 'توب_المستويات', 'تايتن', 'اهجم', 'توب_المهاجمين', 'ميلادي', 'اقرب_ميلاد', 'بطاقتي', 'مزاد', 'زايد', 'كبسولة']);
const GF_ALIASES = [
    [/^توب[ _]المستويات(?=\s|$)/, 'توب_المستويات'],
    [/^توب[ _]المهاجمين(?=\s|$)/, 'توب_المهاجمين'],
    [/^اقرب[ _]ميلاد(?=\s|$)/, 'اقرب_ميلاد'],
];
function normalizeGroupFunCmd(cmd) {
    for (const [re, to] of GF_ALIASES) { if (re.test(cmd)) { cmd = cmd.replace(re, to); break; } }
    return cmd;
}
function saveGroupFun() { try { fs.writeFileSync(GROUP_FUN_FILE, JSON.stringify(groupFun)); } catch (e) {} groupFunDirty = false; }
const GF_RANKS = [[0, 'أكاديمي 🥋'], [1, 'جينين 🍃'], [3, 'تشونين 🍂'], [5, 'جونين ⚔️'], [8, 'أنبو 🎭'], [12, 'سانين 🐸'], [16, 'كاجي 👑'], [20, 'هوكاجي 🔥']];
function gfLevel(xp) { return Math.floor(Math.sqrt((xp || 0) / 100)); }
function gfXpFor(level) { return level * level * 100; }
function gfRank(level) { let r = GF_RANKS[0][1]; for (const [l, n] of GF_RANKS) if (level >= l) r = n; return r; }
function gfBar(p, len = 10) { const f = Math.max(0, Math.min(len, Math.round(p * len))); return '▰'.repeat(f) + '▱'.repeat(len - f); }
function gfN(n) { return Number(n || 0).toLocaleString('en-US'); }
function gfLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function gfToday() { const [y, m, d] = getJordanDateKey().split('-').map(Number); return { y, m, d, key: getJordanDateKey() }; }
function gfDaysUntil(d, m, today) {
    const base = Date.UTC(today.y, today.m - 1, today.d);
    for (let yy = today.y; yy <= today.y + 1; yy++) {
        const dd = (m === 2 && d === 29 && !gfLeap(yy)) ? 28 : d;
        const t = Date.UTC(yy, m - 1, dd);
        if (t >= base) return Math.round((t - base) / 86400000);
    }
    return 999;
}
function gfGroupRank(groupId, jid) {
    const entries = Object.entries(groupFun.xp[groupId] || {}).sort((a, b) => b[1] - a[1]);
    const idx = entries.findIndex(([k]) => k === jid);
    return { pos: idx === -1 ? entries.length + 1 : idx + 1, total: Math.max(entries.length, 1) };
}

async function gfBuildCard(pp, info) {
    const sharp = (await import('sharp')).default;
    let avatar = null;
    try {
        const r = await axios.get(pp, { responseType: 'arraybuffer', timeout: 10000 });
        avatar = await sharp(Buffer.from(r.data)).resize(200, 200, { fit: 'cover' })
            .composite([{ input: Buffer.from('<svg width="200" height="200"><circle cx="100" cy="100" r="100" fill="#fff"/></svg>'), blend: 'dest-in' }]).png().toBuffer();
    } catch (e) {}
    const font = 'DejaVu Sans, Arial, Helvetica, sans-serif';
    const barW = 680;
    const filled = Math.max(8, Math.round(barW * info.pct));
    const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14142b"/><stop offset="1" stop-color="#3a0ca3"/></linearGradient></defs>
<rect width="800" height="400" rx="28" fill="url(#g)"/>
<rect x="16" y="16" width="768" height="368" rx="22" fill="none" stroke="#f1c40f" stroke-width="3"/>
<circle cx="150" cy="150" r="108" fill="#f1c40f"/>
<text x="300" y="105" font-family="${font}" font-size="30" fill="#f1c40f">LEVEL</text>
<text x="300" y="185" font-family="${font}" font-size="84" font-weight="bold" fill="#ffffff">${info.level}</text>
<text x="520" y="105" font-family="${font}" font-size="30" fill="#f1c40f">RANK</text>
<text x="520" y="185" font-family="${font}" font-size="64" font-weight="bold" fill="#ffffff">#${info.pos}</text>
<rect x="60" y="262" width="${barW}" height="34" rx="17" fill="#ffffff" fill-opacity="0.18"/>
<rect x="60" y="262" width="${filled}" height="34" rx="17" fill="#2ecc71"/>
<text x="400" y="287" font-family="${font}" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${info.xpText}</text>
<text x="60" y="350" font-family="${font}" font-size="26" fill="#f1c40f">PTS</text><text x="125" y="350" font-family="${font}" font-size="26" fill="#ffffff">${info.points}</text>
<text x="290" y="350" font-family="${font}" font-size="26" fill="#f1c40f">MSG</text><text x="358" y="350" font-family="${font}" font-size="26" fill="#ffffff">${info.msgs}</text>
<text x="540" y="350" font-family="${font}" font-size="26" fill="#f1c40f">WARN</text><text x="625" y="350" font-family="${font}" font-size="26" fill="#ffffff">${info.warns}</text>
</svg>`;
    let img = sharp(Buffer.from(svg));
    if (avatar) img = img.composite([{ input: avatar, left: 50, top: 50 }]);
    return await img.png().toBuffer();
}

async function handleGroupFunCommand({ sock, msg, from, sender, cmd, trimmedBody, isSenderAdmin, isSenderDev }) {
    const base = cmd.split(' ')[0];
    if (!GF_CMDS.has(base)) return false;
    const args = cmd.slice(base.length).trim();
    const isAdm = isSenderAdmin || isSenderDev;
    const reply = (text, mentions) => sendBotMessage(sock, from, mentions ? { text, mentions } : { text }).catch(() => {});
    const now = Date.now();

    // ---------- المستويات ----------
    if (base === 'مستواي') {
        const target = getTargetUser(msg) || sender;
        const xp = groupFun.xp[from]?.[target] || 0;
        const lvl = gfLevel(xp);
        const cur = gfXpFor(lvl), next = gfXpFor(lvl + 1);
        const pct = (xp - cur) / (next - cur);
        const { pos, total } = gfGroupRank(from, target);
        return reply(`╭━━━〔 🏅 〕━━━╮\n『 مُـسْـتَـوَى الـعُـضْـو 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${target.split('@')[0]}\n🎖️ ⌯ الرتبة ↞ ${gfRank(lvl)}\n📈 ⌯ المستوى ↞ ${lvl}\n✨ ⌯ الخبرة ↞ ${gfN(xp)} / ${gfN(next)}\n🏆 ⌯ الترتيب ↞ ${pos} من ${total}»\n\n${gfBar(pct)} ${Math.round(pct * 100)}%`, [target]), true;
    }
    if (base === 'توب_المستويات') {
        const entries = Object.entries(groupFun.xp[from] || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (!entries.length) return reply('📭 لا توجد بيانات مستويات بعد، تفاعلوا في المجموعة وستبدأ الخبرة بالتجمع.'), true;
        const medals = ['🥇', '🥈', '🥉'];
        let text = '📊 *أعلى الأعضاء مستوى:*\n\n';
        entries.forEach(([jid, xp], i) => { const l = gfLevel(xp); text += `${medals[i] || '👤'} *${i + 1}* ↞ @${jid.split('@')[0]}\n> 🎖️ ${gfRank(l)} ┃ 📈 مستوى ${l} ┃ ✨ ${gfN(xp)}\n\n`; });
        return reply(text.trim(), entries.map(([j]) => j)), true;
    }

    // ---------- تايتن المجموعة ----------
    if (base === 'تايتن' || base === 'اهجم' || base === 'توب_المهاجمين') {
        let b = gfBoss[from];
        if (b && b.endsAt <= now) {
            gfBossLast[from] = { name: b.name, hits: b.hits, defeated: false };
            delete gfBoss[from];
            await reply(`💨 هرب ${b.emoji} *${b.name}* لأن الوقت انتهى قبل أن يُهزم!`);
            b = null;
        }
        if (base === 'تايتن') {
            if (b) {
                return reply(`${b.emoji} *${b.name}* ما زال حياً!\n\n❤️ ${gfBar(b.hp / b.maxHp)} ${gfN(b.hp)} / ${gfN(b.maxHp)}\n⏳ يهرب بعد ${Math.max(1, Math.ceil((b.endsAt - now) / 60000))} دقيقة\n\n⚔️ هاجموه بـ \`.اهجم\``), true;
            }
            if ((gfBossCd[from] || 0) > now) return reply(`⏳ انتظر ${Math.ceil((gfBossCd[from] - now) / 60000)} دقيقة قبل استدعاء تايتن جديد.`), true;
            let members = 30;
            try { members = (await sock.groupMetadata(from)).participants.length; } catch (e) {}
            const maxHp = Math.max(1500, Math.min(20000, members * 80));
            const types = [['التايتن المدرّع', '🛡️'], ['التايتن الأنثى', '👸'], ['التايتن العملاق', '🗿'], ['تايتن الحرب', '🔨'], ['التايتن الأسطوري', '🐉'], ['التايتن الكولوسال', '🔥']];
            const [name, emoji] = types[Math.floor(Math.random() * types.length)];
            gfBoss[from] = { name, emoji, hp: maxHp, maxHp, hits: {}, lastHit: {}, endsAt: now + 30 * 60000 };
            gfBossCd[from] = now + 10 * 60000;
            return reply(`╭━━━〔 ${emoji} 〕━━━╮\n『 ظَـهَـرَ تَـايْـتَـن! 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👹 ⌯ الوحش ↞ ${name}\n❤️ ⌯ الحياة ↞ ${gfN(maxHp)}\n⏳ ⌯ المهلة ↞ 30 دقيقة»\n\n⚔️ اتحدوا وهاجموه بـ \`.اهجم\`\n💰 المكافآت نقاط بنك لكل من شارك!`), true;
        }
        if (base === 'اهجم') {
            if (!b) return reply('🕊️ لا يوجد تايتن الآن، استدعِه بـ `.تايتن`'), true;
            const wait = 20000 - (now - (b.lastHit[sender] || 0));
            if (wait > 0) return reply(`⏳ سلاحك يحتاج ${Math.ceil(wait / 1000)} ثانية للراحة.`), true;
            b.lastHit[sender] = now;
            const lvl = gfLevel(groupFun.xp[from]?.[sender] || 0);
            let dmg = 40 + Math.floor(Math.random() * 121) + lvl * 3;
            const crit = Math.random() < 0.1;
            if (crit) dmg *= 2;
            dmg = Math.min(dmg, b.hp);
            b.hp -= dmg;
            b.hits[sender] = (b.hits[sender] || 0) + dmg;
            if (b.hp > 0) return reply(`⚔️ @${sender.split('@')[0]} ضرب ${b.emoji} ${b.name} بـ *${dmg}* ضرر${crit ? ' 💥 (ضربة حرجة!)' : ''}\n❤️ ${gfBar(b.hp / b.maxHp)} ${gfN(b.hp)} / ${gfN(b.maxHp)}`, [sender]), true;
            const totalDmg = Object.values(b.hits).reduce((a, c) => a + c, 0) || 1;
            const sorted = Object.entries(b.hits).sort((a, c) => c[1] - a[1]);
            const rewards = {};
            sorted.forEach(([jid, d]) => { rewards[jid] = 20 + Math.round(200 * d / totalDmg) + (jid === sender ? 50 : 0); getBankAccount(jid); userPoints[jid] += rewards[jid]; });
            gfBossLast[from] = { name: b.name, hits: b.hits, defeated: true };
            gfBossCd[from] = now + 10 * 60000;
            delete gfBoss[from];
            let text = `🏆 *سقط ${b.emoji} ${b.name}!*\n\n🗡️ الضربة القاضية ↞ @${sender.split('@')[0]} (+50 إضافية)\n\n*🎖️ أبرز المهاجمين:*\n`;
            sorted.slice(0, 5).forEach(([jid, d], i) => { text += `> ${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} @${jid.split('@')[0]} ↞ ${gfN(d)} ضرر ┃ 💰 +${rewards[jid]}\n`; });
            text += `\n💰 حصل كل ${sorted.length} مشارك على نقاط حسب مساهمته.`;
            return reply(text, sorted.slice(0, 5).map(([j]) => j).concat(sender)), true;
        }
        const src = b ? { name: b.name, hits: b.hits, defeated: null } : gfBossLast[from];
        if (!src || !Object.keys(src.hits).length) return reply('📭 لا توجد هجمات مسجلة بعد. استدعِ تايتن بـ `.تايتن`'), true;
        const sorted = Object.entries(src.hits).sort((a, c) => c[1] - a[1]).slice(0, 10);
        let text = `🗡️ *أقوى المهاجمين على ${src.name}:*${src.defeated === true ? ' (تم هزيمته)' : src.defeated === false ? ' (هرب)' : ''}\n\n`;
        sorted.forEach(([jid, d], i) => { text += `${['🥇', '🥈', '🥉'][i] || '👤'} @${jid.split('@')[0]} ↞ ${gfN(d)} ضرر\n`; });
        return reply(text.trim(), sorted.map(([j]) => j)), true;
    }

    // ---------- أعياد الميلاد ----------
    if (base === 'ميلادي') {
        if (!groupFun.births[from]) groupFun.births[from] = {};
        if (args === 'الغاء') {
            if (!groupFun.births[from][sender]) return reply('📌 لم تسجّل ميلادك في هذه المجموعة.'), true;
            delete groupFun.births[from][sender]; saveGroupFun();
            return reply('✅ تم حذف ميلادك من هذه المجموعة.'), true;
        }
        const m = toLatinDigits(args).trim().match(/^(\d{1,2})[\/\-.\s](\d{1,2})(?:[\/\-.\s](\d{4}))?$/);
        if (!m) {
            const cur = groupFun.births[from][sender];
            return reply(cur ? `🎂 ميلادك المسجّل: ${cur.d}/${cur.m}${cur.y ? '/' + cur.y : ''}\nللحذف: \`.ميلادي الغاء\`` : '🎂 سجّل ميلادك ليهنئك البوت تلقائياً.\nمثال: `.ميلادي 15/3` أو `.ميلادي 15/3/2000` (السنة اختيارية)'), true;
        }
        const d = Number(m[1]), mo = Number(m[2]), y = m[3] ? Number(m[3]) : null;
        const dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
        const thisYear = gfToday().y;
        if (mo < 1 || mo > 12 || d < 1 || d > dim || (y && (y < 1940 || y > thisYear - 5))) return reply('❌ تاريخ غير صحيح.\nمثال: `.ميلادي 15/3` أو `.ميلادي 15/3/2000`'), true;
        groupFun.births[from][sender] = { d, m: mo, y, botId: jidDigits(sock.user?.id), last: '' };
        saveGroupFun();
        return reply(`🎂 تم تسجيل ميلادك يا @${sender.split('@')[0]} بتاريخ ${d}/${mo}${y ? '/' + y : ''}\n🎉 سيهنئك البوت في المجموعة صباح ذلك اليوم.`, [sender]), true;
    }
    if (base === 'اقرب_ميلاد') {
        const list = Object.entries(groupFun.births[from] || {});
        if (!list.length) return reply('📭 لا أحد سجّل ميلاده بعد. سجّل ميلادك بـ `.ميلادي 15/3`'), true;
        const today = gfToday();
        const rows = list.map(([jid, e]) => ({ jid, e, left: gfDaysUntil(e.d, e.m, today) })).sort((a, b) => a.left - b.left).slice(0, 5);
        let text = '🎂 *أقرب أعياد الميلاد:*\n\n';
        rows.forEach((r) => { text += `> 🎉 @${r.jid.split('@')[0]} ↞ ${r.e.d}/${r.e.m} ┃ ${r.left === 0 ? '*اليوم!* 🥳' : r.left === 1 ? 'غداً' : `بعد ${r.left} يوم`}\n`; });
        return reply(text.trim(), rows.map((r) => r.jid)), true;
    }

    // ---------- بطاقة العضو ----------
    if (base === 'بطاقتي') {
        const target = getTargetUser(msg) || sender;
        const xp = groupFun.xp[from]?.[target] || 0;
        const lvl = gfLevel(xp);
        const cur = gfXpFor(lvl), next = gfXpFor(lvl + 1);
        const pct = (xp - cur) / (next - cur);
        const { pos, total } = gfGroupRank(from, target);
        getBankAccount(target);
        const points = userPoints[target] || 0;
        const totalMsgs = groupFun.msgs[from]?.[target] || 0;
        const todayMsgs = userMessagesCount[from]?.[getJordanDateKey()]?.[target] || 0;
        const warns = (userWarnings[target] || []).filter((t) => now - t < 2 * 86400000).length;
        const title = groupTitles[from]?.[target] || 'بدون لقب';
        const caption = `╭━━━〔 🪪 〕━━━╮\n『 بِـطَـاقَـةُ الـعُـضْـو 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${target.split('@')[0]}\n🏷️ ⌯ اللقب ↞ ${title}\n🎖️ ⌯ الرتبة ↞ ${gfRank(lvl)}\n📈 ⌯ المستوى ↞ ${lvl} (${gfN(xp)} / ${gfN(next)} خبرة)\n🏆 ⌯ الترتيب ↞ ${pos} من ${total}\n💰 ⌯ النقاط ↞ ${gfN(points)}\n💬 ⌯ الرسائل ↞ ${gfN(totalMsgs)} (اليوم ${gfN(todayMsgs)})\n⚠️ ⌯ الإنذارات ↞ ${warns}/3»\n\n${gfBar(pct)} ${Math.round(pct * 100)}%`;
        const pp = await getUserProfilePic(sock, target);
        try {
            const buf = await gfBuildCard(pp, { level: lvl, pos, pct, xpText: `${gfN(xp)} / ${gfN(next)} XP`, points: gfN(points), msgs: gfN(totalMsgs), warns });
            await sendBotMessage(sock, from, { image: buf, caption, mentions: [target] });
        } catch (e) {
            try { await sendBotMessage(sock, from, { image: { url: pp }, caption, mentions: [target] }); }
            catch (e2) { await reply(caption, [target]); }
        }
        return true;
    }

    // ---------- مزاد الألقاب ----------
    if (base === 'مزاد' || base === 'زايد') {
        let a = gfAuctions[from];
        if (base === 'مزاد') {
            if (args === 'الغاء') {
                if (!isAdm) return reply('❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!'), true;
                if (!a) return reply('📌 لا يوجد مزاد نشط.'), true;
                if (a.top) { getBankAccount(a.top.jid); userPoints[a.top.jid] += a.top.amount; }
                delete gfAuctions[from];
                return reply('🛑 تم إلغاء المزاد وأُعيدت النقاط لآخر مزايد.'), true;
            }
            if (!args) {
                if (!a) return reply('🔨 لا يوجد مزاد حالياً.' + (isAdm ? '\n📌 لبدء مزاد: `.مزاد <دقائق> <اللقب>`\nمثال: `.مزاد 10 ملك الصمت`' : '')), true;
                return reply(`🔨 *مزاد على لقب «${a.title}»*\n\n💰 أعلى مزايدة ↞ ${a.top ? `${gfN(a.top.amount)} من @${a.top.jid.split('@')[0]}` : `لا توجد (الحد الأدنى ${a.minBid})`}\n⏳ ينتهي بعد ${Math.max(1, Math.ceil((a.endsAt - now) / 60000))} دقيقة\n\n📌 زايد بـ \`.زايد <المبلغ>\``, a.top ? [a.top.jid] : []), true;
            }
            if (!isAdm) return reply('❌ بدء المزاد للمشرفين والمطور فقط، أما المزايدة فللجميع بـ `.زايد <المبلغ>`'), true;
            if (a && a.endsAt > now) return reply('⚠️ يوجد مزاد نشط بالفعل، انتظر انتهاءه أو ألغه بـ `.مزاد الغاء`'), true;
            const mm = trimmedBody.match(/^\.مزاد\s+(\S+)\s+([\s\S]+)$/);
            const mins = mm ? parseInt(toLatinDigits(mm[1]).replace(/[^0-9]/g, ''), 10) : 0;
            const title = mm ? mm[2].trim() : '';
            if (!mins || mins < 1 || mins > 120 || !title || title.length > 30) return reply('📌 مثال: `.مزاد 10 ملك الصمت`\n(المدة من 1 إلى 120 دقيقة، واللقب حتى 30 حرفاً)'), true;
            if (Object.values(groupTitles[from] || {}).includes(title) || Object.values(groupReservedTitles[from] || {}).includes(title)) return reply('❌ هذا اللقب مستخدم أو محجوز بالفعل، اختر لقباً آخر.'), true;
            gfAuctions[from] = { title, endsAt: now + mins * 60000, minBid: 10, top: null, botId: jidDigits(sock.user?.id), by: sender };
            return reply(`╭━━━〔 🔨 〕━━━╮\n『 مَـزَادُ الأَلْـقَـاب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«🏷️ ⌯ اللقب ↞ ${title}\n💰 ⌯ بداية المزاد ↞ 10 نقاط\n⏳ ⌯ المدة ↞ ${mins} دقيقة»\n\n📌 زايدوا بـ \`.زايد <المبلغ>\` (من نقاط البنك)`), true;
        }
        if (!a || a.endsAt <= now) return reply('🔨 لا يوجد مزاد نشط الآن.'), true;
        const amount = parseInt(toLatinDigits(args).replace(/[^0-9]/g, ''), 10);
        if (!amount) return reply('📌 اكتب المبلغ، مثال: `.زايد 50`'), true;
        const minNeeded = a.top ? a.top.amount + 1 : a.minBid;
        if (amount < minNeeded) return reply(`❌ يجب أن تكون مزايدتك ${minNeeded} نقطة أو أكثر.`), true;
        getBankAccount(sender);
        const available = userPoints[sender] + (a.top && a.top.jid === sender ? a.top.amount : 0);
        if (amount > available) return reply(`❌ رصيدك لا يكفي. رصيدك المتاح: ${gfN(available)} نقطة.`), true;
        const prev = a.top;
        if (prev) { getBankAccount(prev.jid); userPoints[prev.jid] += prev.amount; }
        userPoints[sender] -= amount;
        a.top = { jid: sender, amount };
        const mentions = [sender]; if (prev && prev.jid !== sender) mentions.push(prev.jid);
        return reply(`🔨 مزايدة جديدة على «${a.title}»!\n\n💰 @${sender.split('@')[0]} ↞ *${gfN(amount)}* نقطة${prev && prev.jid !== sender ? `\n😤 تجاوز @${prev.jid.split('@')[0]}` : ''}`, mentions), true;
    }

    // ---------- كبسولة الزمن ----------
    if (base === 'كبسولة') {
        const mm = trimmedBody.match(/^\.كبسولة\s+(\S+)\s+([\s\S]+)$/);
        const days = mm ? parseInt(toLatinDigits(mm[1]).replace(/[^0-9]/g, ''), 10) : 0;
        const text = mm ? mm[2].trim() : '';
        if (!days || days < 1 || days > 365 || !text) return reply('📦 اكتب رسالة تصل المجموعة بعد مدة.\nمثال: `.كبسولة 30 أتمنى نكون كلنا بخير`\n(المدة من 1 إلى 365 يوم)'), true;
        if (text.length > 500) return reply('❌ الرسالة طويلة، الحد الأقصى 500 حرف.'), true;
        const mine = groupFun.capsules.filter((c) => c.g === from && c.jid === sender).length;
        if (mine >= 5) return reply('❌ لديك 5 كبسولات منتظرة بالفعل، انتظر حتى تُفتح إحداها.'), true;
        const due = now + days * 86400000;
        groupFun.capsules.push({ g: from, jid: sender, text, at: due, created: now, botId: jidDigits(sock.user?.id) });
        saveGroupFun();
        const dateTxt = new Date(due).toLocaleDateString('ar-EG', { timeZone: 'Asia/Amman', year: 'numeric', month: 'long', day: 'numeric' });
        return reply(`📦 تم حفظ كبسولتك يا @${sender.split('@')[0]}!\n⏳ ستُفتح في المجموعة بتاريخ ${dateTxt}.`, [sender]), true;
    }
    return false;
}

// المهام الدورية: تهنئة الميلاد + فتح الكبسولات + إنهاء المزادات
async function gfTick(sock) {
    const myId = jidDigits(sock.user?.id);
    if (!myId) return;
    const now = Date.now();
    // أعياد الميلاد: بعد الثامنة صباحاً بتوقيت عمّان
    if (ammanMinutesNow() >= 8 * 60) {
        const today = gfToday();
        for (const [gid, members] of Object.entries(groupFun.births)) {
            for (const [jid, e] of Object.entries(members)) {
                if (e.botId !== myId || e.last === today.key) continue;
                const isToday = e.m === today.m && (e.d === today.d || (e.d === 29 && e.m === 2 && !gfLeap(today.y) && today.d === 28));
                if (!isToday) continue;
                e.last = today.key; saveGroupFun();
                const age = e.y ? ` 🎈 وبلغت اليوم ${today.y - e.y} عاماً!` : '';
                try { await sendBotMessage(sock, gid, { text: `🎂🎉 *كل عام وأنت بخير يا @${jid.split('@')[0]}!*${age}\n\nأسرة المجموعة كلها تتمنى لك عمراً مديداً وسنة مليئة بالسعادة 🥳💐`, mentions: [jid] }); } catch (err) {}
            }
        }
    }
    // كبسولات الزمن
    const due = groupFun.capsules.filter((c) => c.botId === myId && c.at <= now);
    for (const c of due) {
        groupFun.capsules = groupFun.capsules.filter((x) => x !== c); saveGroupFun();
        const daysAgo = Math.max(1, Math.round((now - c.created) / 86400000));
        try { await sendBotMessage(sock, c.g, { text: `⏳📦 *انفتحت كبسولة الزمن!*\n\n👤 كتبها @${c.jid.split('@')[0]} قبل ${daysAgo} يوم:\n\n«${c.text}»`, mentions: [c.jid] }); } catch (err) {}
    }
    // المزادات
    for (const [gid, a] of Object.entries(gfAuctions)) {
        if (a.botId !== myId || a.endsAt > now) continue;
        delete gfAuctions[gid];
        if (!a.top) { try { await sendBotMessage(sock, gid, { text: `🔨 انتهى المزاد على لقب «${a.title}» بدون أي مزايدات.` }); } catch (err) {} continue; }
        if (!groupTitles[gid]) groupTitles[gid] = {};
        groupTitles[gid][a.top.jid] = a.title;
        try { await sendBotMessage(sock, gid, { text: `🏆 *انتهى المزاد!*\n\nفاز @${a.top.jid.split('@')[0]} بلقب «${a.title}» مقابل ${gfN(a.top.amount)} نقطة 🎉`, mentions: [a.top.jid] }); } catch (err) {}
    }
}

function setupGroupFun(sock) {
    // خبرة المستويات وعدّاد الرسائل
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;
            for (const mm of m.messages || []) {
                const gid = mm?.key?.remoteJid;
                const user = mm?.key?.participant;
                if (!gid || !gid.endsWith('@g.us') || mm.key.fromMe || !mm.message || !user) continue;
                if (mm.message.protocolMessage || mm.message.reactionMessage) continue;
                const mid = mm.key.id;
                if (mid) { if (gfSeen.has(mid)) continue; gfSeen.add(mid); if (gfSeen.size > 1000) gfSeen.delete(gfSeen.values().next().value); }
                const text = mm.message.conversation || mm.message.extendedTextMessage?.text || mm.message.imageMessage?.caption || mm.message.videoMessage?.caption || '';
                if (text.trim().startsWith('.')) continue;
                if (!groupFun.msgs[gid]) groupFun.msgs[gid] = {};
                groupFun.msgs[gid][user] = (groupFun.msgs[gid][user] || 0) + 1;
                groupFunDirty = true;
                const k = gid + user;
                if (Date.now() - (gfLastXp.get(k) || 0) < 30000) continue;
                gfLastXp.set(k, Date.now());
                if (!groupFun.xp[gid]) groupFun.xp[gid] = {};
                const before = groupFun.xp[gid][user] || 0;
                const after = before + 10 + Math.floor(Math.random() * 11);
                groupFun.xp[gid][user] = after;
                const lb = gfLevel(before), la = gfLevel(after);
                if (la > lb) {
                    const rankUp = gfRank(la) !== gfRank(lb) ? `\n🎊 رتبة جديدة ↞ *${gfRank(la)}*` : '';
                    try { await sendBotMessage(sock, gid, { text: `🎉 *ترقية!* @${user.split('@')[0]} وصل إلى المستوى *${la}*${rankUp}`, mentions: [user] }); } catch (err) {}
                }
            }
        } catch (e) {}
    });
    if (!groupFunFlusher) {
        groupFunFlusher = setInterval(() => { if (groupFunDirty) saveGroupFun(); }, 30000);
        if (groupFunFlusher.unref) groupFunFlusher.unref();
    }
    const timer = setInterval(() => { gfTick(sock).catch(() => {}); }, 20000);
    sock.ev.on('connection.update', ({ connection }) => { if (connection === 'close') clearInterval(timer); });
}

// ===== كشف الرسائل المحذوفة والمعدّلة (لكل مجموعة على حدة) =====
const DETECT_FILE = './group_detect.json';
let detectStore = {};
try { detectStore = JSON.parse(fs.readFileSync(DETECT_FILE, 'utf8')) || {}; } catch (e) { detectStore = {}; }
function setDetect(groupId, key, val) {
detectStore[groupId] = { ...(detectStore[groupId] || {}), [key]: val };
try { fs.writeFileSync(DETECT_FILE, JSON.stringify(detectStore)); } catch (e) {}
}

const msgCache = new Map();          // `${jid}|${id}` -> الرسالة الأصلية
const MSG_CACHE_MAX = 2000;
const DETECT_MEDIA_MAX = 8 * 1024 * 1024;
const deletedLog = {};               // jid -> { n, list }
const editedLog = {};
const bufferedEntries = [];

const numOf = (v) => v == null ? 0 : (typeof v === 'number' ? v : (typeof v.toNumber === 'function' ? v.toNumber() : (Number(v) || 0)));
const unwrapDetect = (m) => m?.ephemeralMessage?.message || m?.viewOnceMessage?.message || m?.viewOnceMessageV2?.message || m?.viewOnceMessageV2Extension?.message || m?.documentWithCaptionMessage?.message || m;
const detectText = (m) => m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption || m?.videoMessage?.caption || m?.documentMessage?.caption || '';
function detectKind(m) {
if (m?.conversation || m?.extendedTextMessage) return 'text';
if (m?.imageMessage) return 'image';
if (m?.videoMessage) return 'video';
if (m?.audioMessage) return 'audio';
if (m?.stickerMessage) return 'sticker';
if (m?.documentMessage) return 'document';
if (m?.contactMessage) return 'contact';
if (m?.locationMessage) return 'location';
return 'other';
}
const KIND_LABEL = { text: '📝 نص', image: '🖼️ صورة', video: '🎬 فيديو', audio: '🎤 صوت', sticker: '🎭 ملصق', document: '📄 ملف', contact: '📇 جهة اتصال', location: '📍 موقع', other: '📦 رسالة' };
const dTag = (jid) => '@' + String(jid || '').split('@')[0].split(':')[0];
const dTime = (ms) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hour12: true });
const dCut = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

function recordDeleted(jid, id, actor) {
const e = msgCache.get(`${jid}|${id}`);
if (!e || e.deleted) return;
e.deleted = true;
const log = deletedLog[jid] || (deletedLog[jid] = { n: 0, list: [] });
log.n += 1;
log.list.push({ num: log.n, entry: e, deleter: actor || e.sender, at: Date.now() });
if (log.list.length > 50) log.list.shift();
}

function recordEdited(jid, id, edited, actor) {
const e = msgCache.get(`${jid}|${id}`);
const newText = detectText(unwrapDetect(edited));
if (e && e.lastEdit === newText) return;
const oldText = e ? e.text : '';
if (e) { e.lastEdit = newText; e.text = newText; }
const log = editedLog[jid] || (editedLog[jid] = { n: 0, list: [] });
log.n += 1;
log.list.push({ num: log.n, sender: (e && e.sender) || actor || '', oldText, newText, known: !!e, at: Date.now() });
if (log.list.length > 50) log.list.shift();
}

function trackDetect(sock, mm) {
const jid = mm?.key?.remoteJid;
if (!jid || !jid.endsWith('@g.us') || !mm.message) return;
const cfg = detectStore[jid];
if (!cfg || (!cfg.del && !cfg.edit)) return;
const m = unwrapDetect(mm.message);
const pm = m?.protocolMessage || m?.editedMessage?.message?.protocolMessage;
if (pm) {
const id = pm.key?.id;
if (!id) return;
const actor = mm.key.participant || mm.participant || '';
if ((pm.type === 0 || pm.type === 'REVOKE') && cfg.del) recordDeleted(jid, id, actor);
else if ((pm.type === 14 || pm.type === 'MESSAGE_EDIT') && cfg.edit && pm.editedMessage) recordEdited(jid, id, pm.editedMessage, actor);
return;
}
if (mm.key.fromMe) return;
const k = `${jid}|${mm.key.id}`;
if (msgCache.has(k)) return;
const kind = detectKind(m);
const entry = { jid, id: mm.key.id, sender: mm.key.participant || '', msg: mm, kind, text: detectText(m), buffer: null };
msgCache.set(k, entry);
if (msgCache.size > MSG_CACHE_MAX) msgCache.delete(msgCache.keys().next().value);
if (cfg.del && ['image', 'video', 'audio', 'sticker', 'document'].includes(kind)) {
const media = m[kind + 'Message'];
if (numOf(media?.fileLength) <= DETECT_MEDIA_MAX) {
downloadMediaMessage({ key: mm.key, message: m }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage })
.then((buf) => { entry.buffer = buf; bufferedEntries.push(entry); while (bufferedEntries.length > 60) bufferedEntries.shift().buffer = null; })
.catch(() => {});
}
}
}

function trackDetectUpdate(u) {
const jid = u?.key?.remoteJid;
if (!jid || !jid.endsWith('@g.us')) return;
const cfg = detectStore[jid];
if (!cfg) return;
const st = u.update?.messageStubType;
if ((st === 1 || st === 'REVOKE') && cfg.del) recordDeleted(jid, u.key.id, u.update?.key?.participant || '');
const em = u.update?.message?.editedMessage?.message;
if (em && cfg.edit) recordEdited(jid, u.key.id, em, '');
}

async function restoreDeleted(sock, from, item) {
const e = item.entry;
const head = `♻️ *الرسالة المحذوفة رقم ${item.num}*\n\n> 👤 المرسل ↞ ${dTag(e.sender)}\n> 🗑️ حذفها ↞ ${item.deleter === e.sender ? 'صاحبها' : dTag(item.deleter)}\n> 📦 النوع ↞ ${KIND_LABEL[e.kind]}\n> 🕒 وقت الحذف ↞ ${dTime(item.at)}`;
const mentions = [...new Set([e.sender, item.deleter].filter(Boolean))];
const m = unwrapDetect(e.msg.message);
if (e.kind === 'text') return sendBotMessage(sock, from, { text: `${head}\n\n${e.text}`, mentions });
if (e.kind === 'contact') return sendBotMessage(sock, from, { text: `${head}\n\n📇 ${m.contactMessage?.displayName || ''}`, mentions });
if (e.kind === 'location') return sendBotMessage(sock, from, { text: `${head}\n\n📍 https://maps.google.com/?q=${m.locationMessage?.degreesLatitude},${m.locationMessage?.degreesLongitude}`, mentions });
if (!['image', 'video', 'audio', 'sticker', 'document'].includes(e.kind)) return sendBotMessage(sock, from, { text: `${head}\n\n⚠️ هذا النوع من الرسائل لا يمكن إرجاعه.`, mentions });
let buf = e.buffer;
if (!buf) {
try { buf = await downloadMediaMessage({ key: e.msg.key, message: m }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }); } catch (err) { buf = null; }
}
if (!buf) return sendBotMessage(sock, from, { text: `${head}\n\n⚠️ تعذّر استرجاع الملف (لم يُحفظ أو انتهت صلاحيته).`, mentions });
const cap = e.text ? `${head}\n\n${e.text}` : head;
if (e.kind === 'image') return sendBotMessage(sock, from, { image: buf, caption: cap, mentions });
if (e.kind === 'video') return sendBotMessage(sock, from, { video: buf, caption: cap, mentions });
if (e.kind === 'document') return sendBotMessage(sock, from, { document: buf, mimetype: m.documentMessage?.mimetype || 'application/octet-stream', fileName: m.documentMessage?.fileName || 'file', caption: cap, mentions });
await sendBotMessage(sock, from, { text: head, mentions });
if (e.kind === 'audio') return sendBotMessage(sock, from, { audio: buf, mimetype: m.audioMessage?.mimetype || 'audio/mp4', ptt: !!m.audioMessage?.ptt });
return sendBotMessage(sock, from, { sticker: buf });
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
let lastPairingAt = 0;

// ===== جعل كل رسائل البوت معاد توجيهها من القناة =====
const CHANNEL_INVITE_CODE = '0029VbAyOwm3mFY0ohjZCB04';
const CHANNEL_FWD_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
let channelFwdInfo = null;
let channelFwdPromise = null;
function getChannelFwdInfo(sock) {
    if (channelFwdInfo) return Promise.resolve(channelFwdInfo);
    if (!channelFwdPromise) {
        channelFwdPromise = (async () => {
            try {
                const meta = await sock.newsletterMetadata('invite', CHANNEL_INVITE_CODE);
                if (meta?.id) channelFwdInfo = { newsletterJid: meta.id, newsletterName: CHANNEL_FWD_NAME };
            } catch (e) {}
            channelFwdPromise = null;
            return channelFwdInfo;
        })();
    }
    return channelFwdPromise;
}
const NO_FWD_KEYS = ['react', 'delete', 'forward', 'edit', 'pin', 'poll', 'disappearingMessagesInMessage'];
function enableChannelForward(sock) {
    const origSend = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options) => {
        try {
            if (content && typeof content === 'object' && typeof jid === 'string' && !jid.endsWith('@newsletter') && jid !== 'status@broadcast' && !NO_FWD_KEYS.some(k => k in content)) {
                const ch = channelFwdInfo || await Promise.race([getChannelFwdInfo(sock), new Promise(r => setTimeout(() => r(null), 2500))]);
                if (ch) {
                    content = {
                        ...content,
                        contextInfo: {
                            ...(content.contextInfo || {}),
                            isForwarded: true,
                            forwardingScore: 1,
                            forwardedNewsletterMessageInfo: { newsletterJid: ch.newsletterJid, newsletterName: ch.newsletterName, serverMessageId: 100 + Math.floor(Math.random() * 900) }
                        }
                    };
                }
            }
        } catch (e) {}
        return origSend(jid, content, options);
    };
    sock.ev.on('connection.update', ({ connection }) => { if (connection === 'open') getChannelFwdInfo(sock); });
}

setForwardContextProvider(async (sock) => {
    const ch = channelFwdInfo || await Promise.race([getChannelFwdInfo(sock), new Promise(r => setTimeout(() => r(null), 2500))]);
    if (!ch) return null;
    return { isForwarded: true, forwardingScore: 1, forwardedNewsletterMessageInfo: { newsletterJid: ch.newsletterJid, newsletterName: ch.newsletterName, serverMessageId: 100 + Math.floor(Math.random() * 900) } };
});

// ===== إصدار واتساب ويب: يُجلب من واتساب مباشرة (الإصدار القديم يسبب فشل الربط بالكود) =====
let cachedWaVersion = null;
let cachedWaVersionAt = 0;
async function getWaVersion() {
    if (cachedWaVersion && (Date.now() - cachedWaVersionAt) < 10 * 60 * 1000) return cachedWaVersion;
    let found = null;
    try {
        const fetchWeb = BaileysNs.fetchLatestWaWebVersion || BaileysNs.default?.fetchLatestWaWebVersion;
        if (fetchWeb) {
            const r = await fetchWeb({});
            if (r && r.version && !r.error) found = r.version;
        }
    } catch (e) {}
    if (!found) {
        try {
            const r = await fetchLatestBaileysVersion();
            if (r && r.version) found = r.version;
        } catch (e) {}
    }
    if (found) {
        cachedWaVersion = found;
        cachedWaVersionAt = Date.now();
        console.log('🔢 إصدار واتساب المستخدم:', found.join('.'));
    }
    return found || cachedWaVersion;
}

async function startBot(sessionDir = 'arem_new_session', subInfo = null) {
const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
const version = await getWaVersion();

const sock = makeWASocket({
auth: state,
...(version ? { version } : {}),
printQRInTerminal: false,
logger: pino({ level: 'silent' }),
browser: ['Ubuntu', 'Chrome', '110.0.5481.100'],
syncFullHistory: false,
shouldSyncHistoryMessage: () => false,
markOnlineOnConnect: true
});

enableChannelForward(sock);
sock.ev.on('creds.update', saveCreds);
sock.isSubBot = !!subInfo;
setupGroupAutomation(sock);
setupGroupFun(sock);
if (subInfo && subInfo.onSock) subInfo.onSock(sock);

sock.ev.on('connection.update', async (u) => {
const { connection, lastDisconnect, qr } = u;

// كود الاقتران: يُطلب لكل اتصال جديد بعد أن يصبح جاهزاً (أول qr)، لأن كل كود يبطل عند انقطاع اتصاله
if (qr && !subInfo && !sock.authState.creds.registered && !sock.pairingCodeRequested) {
    sock.pairingCodeRequested = true;
    setTimeout(async () => {
        try {
            let code = await sock.requestPairingCode('962795106901');
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`\n========================================`);
            console.log(`🔑 كود الاقتران الخاص بك هو: ${code}`);
            console.log(`========================================\n`);
        } catch (e) {
            console.error('خطأ في طلب كود الاقتران:', e?.message || e);
            sock.pairingCodeRequested = false;
        }
    }, 1500);
}

if (connection === 'close') {
    isPairingRequested = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    console.log('🔄 انقطع الاتصال | الرمز:', statusCode, '|', lastDisconnect?.error?.message || '');
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
    if (shouldReconnect) {
        setTimeout(() => { if (!(subInfo && subInfo.stopped)) startBot(sessionDir, subInfo); }, 3000);
    } else if (subInfo && subInfo.onLoggedOut) {
        subInfo.onLoggedOut();
    }
} else if (connection === 'connecting') {
} else if (connection === 'open') {
    console.log('👑 تم الاتصال بالواتساب بنجاح 👑');
}
});

sock.ev.on('group-participants.update', async (anu) => {
try {
const { id, action } = anu;
const participants = (anu.participants || []).map((p) => (typeof p === 'string' ? p : (p?.id || p?.phoneNumber || ''))).filter(Boolean);
const settings = getGroupSetting(id);

if (action === 'add' && settings.welcome) {    
    for (let user of participants) {    
        const userPp = await getUserProfilePic(sock, id);    
        const welcomeMsg = settings.welcomeText ? applyMemberMention(settings.welcomeText, user) : `*🌾┊تـرحـيـب:*

*❋・────━【🗡】━────・❋*

*- مـحـارب جـديـد يـحـط الـرحـال فـي أرض ڤـيـنـلاند، أهـلاً وسـهـلاً ومـرحـبـاً بـك*

*❋・────━【🗡】━────・❋*

*🌙┆الـعـضـو ↜『@${user.split('@')[0]}』*

*❋・────━【🗡】━────・❋*

*※ نــرجــوا مـنـك دخــول رابــط إعـلانـات نـقـابـة إنـجـلانـد 🗡️*

*『https://chat.whatsapp.com/IBy60bdcmcvCP8GPwtM1wq?s=cl&p=a&mlu=4&ilr=4』*

*❋・────━【🗡】━────・❋*

*※ ونــرجــوا مــنــك أيــضــاً دخــول رابـط صـحـيـفـة ڤـيـنـلانـد ❄*

*『https://chat.whatsapp.com/KY5GUeANAvO8px1An1FZeV?s=cl&p=a&mlu=4&ilr=4』*

*❋・────━【🗡】━────・❋*

*🫎┊مـع تـحـيـات ˼‏🗡️˹ ⤺*

*『𝑽. 𝑳. 𝑫 ⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨𝑵𝑫』*`;

        try {
            await sendBotMessage(sock, id, { image: { url: userPp }, caption: welcomeMsg, mentions: [user] });
        } catch (err) {
            await sendBotMessage(sock, id, { text: welcomeMsg, mentions: [user] });
        }
    }
} else if (action === 'remove' && settings.goodbye) {
    for (let user of participants) {
        const userPp = await getUserProfilePic(sock, user);
        const goodbyeMsg = settings.goodbyeText ? applyMemberMention(settings.goodbyeText, user) : `*🍂┊تـوديـع:*

*❋・────━【🗡】━────・❋*

*- مُـحـارب يـغـادر أرض ڤـيـنـلاند، وتـنـطـوي صـفـحـة مـن رحـلـتـه بـيـنـنـا.*

*❋・────━【🗡】━────・❋*

*🌙┆الـعـضـو ↜『@${user.split('@')[0]}』*

*❋・────━【🗡】━────・❋*

*※ نـتـمـنـى لـك الـتـوفـيـق فـي رحـلـتـك الـقـادمـة، وتـبـقـى ذكـريـاتـك جـزءًا مـن تـاريـخ ڤـيـنـلاند.*

*❋・────━【🗡】━────・❋*

*※ سـتـبـقـى أبـواب ڤـيـنـلاند مـفـتـوحـة لـمـن أراد الـعـودة يـومًـا.*

*❋・────━【🗡】━────・❋*

*🫎┊مـع تـحـيـات ˼‏🗡️˹ ⤺*

*『𝑽. 𝑳. 𝑫 ⊰🗡⊱ 𝑬𝑵𝑮𝑳𝑨𝑵𝑫』*`;

        try {
            await sendBotMessage(sock, id, { image: { url: userPp }, caption: goodbyeMsg, mentions: [user] });
        } catch (err) {
            await sendBotMessage(sock, id, { text: goodbyeMsg, mentions: [user] });
        }
    }
}
} catch (e) { console.error('خطأ الترحيب/التوديع:', e?.message || e); }
});

sock.ev.on('messages.update', (updates) => { try { for (const u of updates || []) trackDetectUpdate(u); } catch (e) {} });

const onUpsert = async (m) => {
if (!['notify', 'append'].includes(m.type)) return;
try { collectPackImages(sock, m.messages); } catch (e) {}
try { for (const mm of m.messages || []) trackDetect(sock, mm); } catch (e) {}

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

const rawBody = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || getButtonId(msg.message) || '';
const body = rawBody;    
let trimmedBody = body.trim();    
let lowerBody = trimmedBody.toLowerCase();    

if (sock.isSubBot && isGroup && stoppedSubBotGroups.has(from) && !isSenderDev) return;

const groupSettingsForCheck = getGroupSetting(from);

// الوضع الخاص: يتجاهل الأوامر لغير المطورين، لكن الحماية تبقى شغالة (تُنفَّذ قبل الخروج أدناه)
const privateBlocked = (groupSettingsForCheck.botMode === 'private' && !isSenderDev && !isVipUser(sender)) || await isSubBotPrivateBlocked({ sock, msg, sender, isFromMe });

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
    } else if (settings.antiLink && !isFeatureLinkCommand(trimmedBody) && !isToolsLinkCommand(trimmedBody) && (lowerBody.includes('http://') || lowerBody.includes('https://'))) {    
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
                await sendBotMessage(sock, from, { text: `🚨 @${sender.split('@')[0]} تم طردك لتجاوزك الحد الأقصى من الإنذارات (${violationType})!`, mentions: [sender] });    
                await sock.groupParticipantsUpdate(from, [sender], 'remove');    
                delete userWarnings[sender];    
            } else {    
                let alertMsg = `⚠️ تنبيه ومخالفة (${violationType})!\n👤 العضو: @${sender.split('@')[0]}\n📌 الإنذار الحالي: [${activeWarnings}/3]\n⏳ ينتهي الإنذار تلقائياً بعد مرور 48 ساعة (يومين).`;
                if (shouldLockChat) alertMsg += `\n🔒 تم قفل الشات تلقائياً بسبب المخالفة.`;
                await sendBotMessage(sock, from, { text: alertMsg, mentions: [sender] });    
            }    
            return;    
        } catch (e) { console.error('تعذر تنفيذ الحماية (تأكد أن البوت مشرف في المجموعة):', e?.message || e); }    
    }    
}    

if (privateBlocked) return;

if (trimmedBody === '.انسحب' || lowerBody === 'انسحاب') {    
    if (activeGames[from]) {    
        clearTimeout(activeGames[from].timer);    
        delete activeGames[from];    
        return sendBotMessage(sock, from, { text: `🚪 *تم إلغاء الفعالية بنجاح!*`, mentions: [sender] });    
    } else {    
        return sendBotMessage(sock, from, { text: `📌 لا توجد فعالية قيد التشغيل حالياً لإلغائها.` });    
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
        const charNames = trimmedBody.split(/[\n,|, /-]+/).map(s => s.trim()).filter(s => s.length > 0);
        const reqLetter = game.requiredLetter.replace(/[أإآا]/g, 'ا');
        const validChars = charNames.filter(c => c.replace(/[أإآا]/g, 'ا').startsWith(reqLetter));
        if (validChars.length >= 3) isCorrect = true;
    }

    if (isCorrect) {
        game.isCompleted = true;
        clearTimeout(game.timer);
        getBankAccount(sender);
        
        if (!game.scores) game.scores = {};
        game.scores[sender] = (game.scores[sender] || 0) + 1;
        const currentScore = game.scores[sender];
        const gameTypeToRestart = game.type;
        const existingScores = game.scores;
        delete activeGames[from];

        if (currentScore >= 10) {
            userPoints[sender] += 50;
            const eventWinnerMsg = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

  👑 *𝐄𝐕𝐄𝐍𝐓 𝐖𝐈𝐍𝐍𝐄𝐑*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*«🏆 مُـبَـارَكُ الـفَـوْز! »*

> ╎ 👤 الفائز بالفعالية:
> ╎ @${sender.split('@')[0]}

*╎ 🎯 النقاط المكتسبة: +50*

❐═━━━═╊⊰🍷⊱╉═━━━═❐

\`🍷 أحسنت! تستحق الفوز.\`

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;

            await sendBotMessage(sock, from, { text: eventWinnerMsg, mentions: [sender] });
            return;
        } else {
            userPoints[sender] += 1;
            const roundWinnerMsg = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

      👑 *𝐑𝐎𝐔𝐍ْد 𝐖𝐈𝐍𝐍𝐄𝐑*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*«⚡ إِجَـابَـةٌ صَـحِـيـحَـة!»*

> ╎ 🏆 الفائز بالجولة:
> ╎ 👤 @${sender.split('@')[0]}

> ╎ 🎯 النقاط: ${currentScore} / 10
> ╎ 🥇 الحالة: فوز بالجولة

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*🍷 أحسنت! نقطة جديدة تقترب بك من الفوز.*

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;

            await sendBotMessage(sock, from, { text: roundWinnerMsg, mentions: [sender] });

            setTimeout(() => {
                if (!activeGames[from]) {
                    startNextRound(sock, from, gameTypeToRestart, existingScores);
                }
            }, 1500);
            return;
        }
    } else {
        return;
    }
}

if (!trimmedBody.startsWith('.')) return;    

let cmd = trimmedBody.substring(1).toLowerCase().trim().replace(/[أإآا]/g, 'ا');    
cmd = normalizeGroupExtraCmd(cmd);
cmd = normalizeGroupFunCmd(cmd);
let cmdBase = /^تغيير_(ترحيب|توديع)\n/.test(cmd) ? cmd.split('\n')[0] : cmd.split(' ')[0];    

if (!isValidCmd(cmdBase) && !isValidCmd(cmd)) return;    

// البوت الفرعي: رفض أي أمر خاص بالمطور من غير المطور الأساسي وحساب البوت الرئيسي
if (sock.isSubBot && (DEV_ONLY_COMMANDS.includes(cmdBase) || DEV_ONLY_COMMANDS.includes(cmd)) && !isMainAccount(sender)) return sendBotMessage(sock, from, { text: '❌ هذا الأمر للمطور الرئيسي فقط!' });

if (commandReactionEnabled) {    
    try {    
        await sock.sendMessage(from, { react: { text: commandReactionEmoji, key: msg.key } });    
    } catch (e) {}    
}    

logBotAction(`استخدام أمر (${cmd}) من قبل العضو ${cleanSenderNum}`);    

if (await handleSubBotCommand({ sock, msg, from, sender, cmd, cmdBase, isDev: isSenderDev })) return;

if (!isGroup && cmdBase !== 'devinfo_form') {    
    return sendBotMessage(sock, from, { text: `❌ عذراً، هذا الأمر مخصص للمجموعات فقط ولا يعمل في الشات الخاص!` });    
}    

if (await handleFeatureCommand({ sock, msg, from, sender, cmd, cmdBase, trimmedBody, isSenderAdmin, isSenderDev, getUserProfilePic })) return;
if (await handleToolsCommand({ sock, msg, from, sender, cmd, cmdBase, trimmedBody, isSenderAdmin, isSenderDev, getUserProfilePic })) return;

const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;    

if (await handleGroupExtraCommand({ sock, msg, from, sender, cmd, trimmedBody, isSenderAdmin, isSenderDev })) return;
if (await handleGroupFunCommand({ sock, msg, from, sender, cmd, trimmedBody, isSenderAdmin, isSenderDev })) return;

if (['قفل', 'غلق', 'فتح', 'حذف', 'مسح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'اضف_انذار', 'ازل_انذار', 'حذف_انذار', 'صفر', 'عدد_الانذارات', 'قائمة_الانذارات', 'كتم', 'الغاء_كتم', 'فك_كتم', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_ترحيب', 'تغيير_توديع', 'ترحيب_افتراضي', 'توديع_افتراضي', 'تفعيل_كشف_المحذوف', 'توقيف_كشف_المحذوف', 'قائمة_المحذوف', 'تفعيل_كشف_المعدل', 'توقيف_كشف_المعدل', 'قائمة_المعدل', 'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط', 'اضافة_لقب', 'ازالة_لقب', 'حجز_لقب', 'الغاء_حجز_لقب'].includes(cmdBase) || cmd.startsWith('تغيير_الاسم') || cmd.startsWith('تغيير_الوصف') || cmd === 'تفعيل ادمن' || cmd === 'توقيف ادمن' || cmd === 'تفعيل ترحيب' || cmd === 'توقيف ترحيب' || cmd === 'تفعيل توديع' || cmd === 'توقيف توديع' || cmd === 'رابط_الجروب' || cmd === 'الرابط' || cmd === 'غلق') {    
    if (!isSenderAdmin && !isSenderDev) {    
        return sendBotMessage(sock, from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!' });    
    }    
}    

if (cmdBase === 'قفل' || cmd === 'غلق') {    
    await sock.groupSettingUpdate(from, 'announcement');    
    const text = `╭━━━〔 🔒 〕━━━╮\n『 إِغْـلَاقُ الـمَـجْـمُـوعَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔒 ⌯ الإجراء ↞ إغلاق المجموعة\n🛡️ ⌯ الحالة ↞ تم إغلاق المجموعة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    

if (cmdBase === 'فتح') {    
    await sock.groupSettingUpdate(from, 'not_announcement');    
    const text = `╭━━━〔 🔓 〕━━━╮\n『 فَـتْـحُ الـمَـجْـمُـوعَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔓 ⌯ الإجراء ↞ فتح المجموعة\n✨ ⌯ الحالة ↞ أصبحت المجموعة مفتوحة للجميع»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    

if (cmdBase === 'حذف' || cmdBase === 'مسح') {    
    const q = msg.message.extendedTextMessage?.contextInfo;    
    if (!q) return sendBotMessage(sock, from, { text: '📌 رد على الرسالة المراد حذفها.' });    
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
        return sendBotMessage(sock, from, { text, mentions });    
    } catch (e) {
        return sendBotMessage(sock, from, { text: '❌ تعذر تنفيذ المنشن الجماعي.' });
    }
}    

if (cmdBase === 'رفع' || cmdBase === 'ترقية') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'promote');    
        const text = `╭━━━〔 👑 〕━━━╮\n『 تَـرْقِـيَـةٌ إِدَارِيَّـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🏆 ⌯ الرتبة الجديدة ↞ مشرف\n✨ ⌯ الحالة ↞ تمت الترقية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
        return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });    
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ فشل رفع العضو، تأكد أن البوت مشرف ولديه الصلاحيات.' }); }    
}    

if (cmdBase === 'ازل' || cmdBase === 'تنزيل') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'demote');    
        const text = `╭━━━〔 ♟️ 〕━━━╮\n『 سَـحْـبُ الـصَّـلَاحِـيَـات 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📉 ⌯ الرتبة السابقة ↞ مشرف\n👤 ⌯ الرتبة الحالية ↞ عضو\n✅ ⌯ الحالة ↞ تمت إزالة الإشراف بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
        return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });    
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ فشل تنزيل العضو، تأكد أن البوت مشرف.' }); }    
}    

if (cmdBase === 'طرد') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    try {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        const text = `╭━━━〔 ⚔️ 〕━━━╮\n『 قَـرَارُ الإِبْـعَـاد 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📌 ⌯ الإجراء ↞ الطرد من المجموعة\n⚖️ ⌯ السبب ↞ مخالفة قوانين المجموعة\n✅ ⌯ الحالة ↞ تمت عملية الطرد بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
        return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });    
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ فشل طرد العضو، تأكد أن البوت مشرف.' }); }    
}    

if (cmdBase === 'بوم') {
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطور الأساسي فقط!' });
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
            return sendBotMessage(sock, from, { text: `⚠️ لا توجد أعضاء آخرين لطردهم.` });
        }

        await sendBotMessage(sock, from, { text: `💣 *جاري إخلاء المجموعـة وطرد الجميع دفعة واحدة (${usersToKick.length} عضو)...*` });
        await sock.groupParticipantsUpdate(from, usersToKick, 'remove');
        return sendBotMessage(sock, from, { text: `💥 تمت عملية الإخلاء الكلي بنجاح!` });
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ تعذر تنفيذ أمر الإخلاء.' }); }
}

if (cmdBase === 'اضف_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    const activeWarnings = addWarningToUser(targetUser);

    if (activeWarnings >= 3) {    
        await sock.groupParticipantsUpdate(from, [targetUser], 'remove');    
        delete userWarnings[targetUser];    
        return sendBotMessage(sock, from, { text: `🚨 @${targetUser.split('@')[0]} تم طردك لتجاوزك الحد الأقصى من الإنذارات!`, mentions: [targetUser] });    
    }    

    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 إِنْـذَارٌ إِدَارِيّ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📌 ⌯ السبب ↞ مخالفة قوانين المجموعة\n🔢 ⌯ عدد التحذيرات ↞ [${activeWarnings}/3]\n⚠️ ⌯ الحالة ↞ تم تسجيل التحذير»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });    
}    

if (cmdBase === 'ازل_انذار' || cmdBase === 'حذف_انذار') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    removeOneWarningFromUser(targetUser);
    const text = `╭━━━〔 ✅ 〕━━━╮\n『 إِلْـغَـاءُ الإِنْـذَار 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🧾 ⌯ الإجراء ↞ حذف التحذير\n✨ ⌯ الحالة ↞ تمت إعادة ضبط التحذيرات»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });    
}    

if (cmdBase === 'صفر') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    delete userWarnings[targetUser];    
    return sendBotMessage(sock, from, { text: `✅ تم تصفير إنذارات العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] });    
}    

if (cmdBase === 'عدد_الانذارات') {    
    const targetUser = getTargetUser(msg) || sender;    
    const count = getUserWarningCount(targetUser);
    return sendBotMessage(sock, from, { text: `📊 عدد الإنذارات الفعالة: *${count} / 3*`, mentions: [targetUser] }, { quoted: msg });    
}    

if (cmdBase === 'قائمة_الانذارات') {
    let allUsers = Object.keys(userWarnings);
    let activeWarnedUsers = allUsers.filter(u => getUserWarningCount(u) > 0);
    if (activeWarnedUsers.length === 0) return sendBotMessage(sock, from, { text: '📋 لا يوجد أي عضو لديه إنذارات نشطة حالياً!' });

    let text = `╭━━━〔 ⚠️ 〕━━━╮\n『 قَـائِـمَـةُ الإِنْـذَارَاتِ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;
    let mentions = [];
    activeWarnedUsers.forEach((u) => {
        const count = getUserWarningCount(u);
        text += `«👤 ⌯ العضو ↞ @${u.split('@')[0]}\n🔢 ⌯ عدد التحذيرات ↞ [${count}/3]\n\n`;
        mentions.push(u);
    });
    text += `❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions });
}

if (cmdBase === 'كتم') {    
    const parts = trimmedBody.split(' ');    
    const mins = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(mins) || !targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    if (!mutedUsers[from]) mutedUsers[from] = {};    
    mutedUsers[from][targetUser] = Date.now() + (mins * 60 * 1000);    
    const text = `╭━━━〔 🔇 〕━━━╮\n『 إِسْـكَـاتُ عُـضْـو 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔇 ⌯ الإجراء ↞ تفعيل الكتم\n⏳ ⌯ المدة ↞ [${mins} دقيقة]\n✅ ⌯ الحالة ↞ تم تنفيذ الكتم»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });    
}    

if (cmdBase === 'الغاء_كتم' || cmdBase === 'فك_كتم') {    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    if (mutedUsers[from]) delete mutedUsers[from][targetUser];    
    const text = `╭━━━〔 🔊 〕━━━╮\n『 إِلْـغَـاءُ الـكَـتْـم 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔊 ⌯ الإجراء ↞ إلغاء الكتم\n✅ ⌯ الحالة ↞ أصبح العضو غير مكتوم»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });    
}    

if (cmd === 'تفعيل ادمن') { getGroupSetting(from).adminOnly = true; return sendBotMessage(sock, from, { text: '🟢 تم تفعيل وضع الآدمن.' }); }    
if (cmd === 'توقيف ادمن') { getGroupSetting(from).adminOnly = false; return sendBotMessage(sock, from, { text: '🔴 تم إيقاف وضع الآدمن.' }); }    
if (cmd === 'تفعيل ترحيب') { getGroupSetting(from).welcome = true; persistWelcome(from); return sendBotMessage(sock, from, { text: '🟢 تم تفعيل الترحيب.' }); }    
if (cmd === 'توقيف ترحيب') { getGroupSetting(from).welcome = false; persistWelcome(from); return sendBotMessage(sock, from, { text: '🔴 تم إيقاف الترحيب.' }); }    
if (cmd === 'تفعيل توديع') { getGroupSetting(from).goodbye = true; persistWelcome(from); return sendBotMessage(sock, from, { text: '🟢 تم تفعيل التوديع.' }); }    
if (cmdBase === 'تفعيل_كشف_المحذوف') { setDetect(from, 'del', true); return sendBotMessage(sock, from, { text: '🟢 تم تفعيل كشف الرسائل المحذوفة في هذه المجموعة.\n📌 تُحفظ الرسائل المحذوفة من الآن، وتعرضها بـ `.قائمة_المحذوف`' }); }
if (cmdBase === 'توقيف_كشف_المحذوف') { setDetect(from, 'del', false); return sendBotMessage(sock, from, { text: '🔴 تم إيقاف كشف الرسائل المحذوفة.' }); }
if (cmdBase === 'تفعيل_كشف_المعدل') { setDetect(from, 'edit', true); return sendBotMessage(sock, from, { text: '🟢 تم تفعيل كشف الرسائل المعدلة في هذه المجموعة.\n📌 تُحفظ الرسائل المعدلة من الآن، وتعرضها بـ `.قائمة_المعدل`' }); }
if (cmdBase === 'توقيف_كشف_المعدل') { setDetect(from, 'edit', false); return sendBotMessage(sock, from, { text: '🔴 تم إيقاف كشف الرسائل المعدلة.' }); }

if (cmdBase === 'قائمة_المحذوف' || cmdBase === 'قائمة_المعدل') {
    const isDel = cmdBase === 'قائمة_المحذوف';
    const cfg = detectStore[from] || {};
    if (isDel ? !cfg.del : !cfg.edit) return sendBotMessage(sock, from, { text: isDel ? '⚠️ كشف المحذوف غير مفعّل، فعّله بـ `.تفعيل_كشف_المحذوف`' : '⚠️ كشف المعدل غير مفعّل، فعّله بـ `.تفعيل_كشف_المعدل`' });
    const list = ((isDel ? deletedLog : editedLog)[from] || {}).list || [];
    if (!list.length) return sendBotMessage(sock, from, { text: isDel ? '📭 لا توجد رسائل محذوفة محفوظة حتى الآن.' : '📭 لا توجد رسائل معدلة محفوظة حتى الآن.' });
    const arg = cmd.split(' ').slice(1).join('').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9]/g, '');
    if (!arg) {
        const mentions = new Set();
        const lines = list.map((x) => {
            if (isDel) {
                const e = x.entry;
                if (e.sender) mentions.add(e.sender);
                if (x.deleter) mentions.add(x.deleter);
                return `> ${x.num} ┃ 👤 ${dTag(e.sender)} ┃ 🗑️ ${x.deleter === e.sender ? 'صاحبها' : dTag(x.deleter)} ┃ ${KIND_LABEL[e.kind]} ┃ 🕒 ${dTime(x.at)}` + (e.kind === 'text' ? `\n> ↳ «${dCut(e.text, 30)}»` : '');
            }
            if (x.sender) mentions.add(x.sender);
            return `> ${x.num} ┃ 👤 ${dTag(x.sender)} ┃ 🕒 ${dTime(x.at)}\n> ↳ قبل: «${x.known ? dCut(x.oldText, 25) : 'غير متوفر'}»\n> ↳ بعد: «${dCut(x.newText, 25)}»`;
        });
        const title = isDel ? `🗑️ *قائمة الرسائل المحذوفة (${list.length}):*` : `✏️ *قائمة الرسائل المعدلة (${list.length}):*`;
        const hint = isDel ? '📌 لإرجاع رسالة: `.قائمة_المحذوف <الرقم>`' : '📌 لعرض رسالة كاملة: `.قائمة_المعدل <الرقم>`';
        return sendBotMessage(sock, from, { text: `${title}\n\n${lines.join('\n\n')}\n\n${hint}`, mentions: [...mentions] });
    }
    const item = list.find((x) => x.num === Number(arg));
    if (!item) return sendBotMessage(sock, from, { text: `⚠️ لا توجد رسالة بالرقم ${arg}، راجع القائمة بـ \`.${cmdBase}\`` });
    if (isDel) return restoreDeleted(sock, from, item);
    return sendBotMessage(sock, from, { text: `✏️ *الرسالة المعدلة رقم ${item.num}*\n\n> 👤 صاحبها ↞ ${dTag(item.sender)}\n> 🕒 وقت التعديل ↞ ${dTime(item.at)}\n\n*قبل التعديل:*\n${item.known ? (item.oldText || '—') : 'غير متوفر (عُدّلت قبل التفعيل)'}\n\n*بعد التعديل:*\n${item.newText || '—'}`, mentions: item.sender ? [item.sender] : [] });
}

if (cmd.startsWith('تغيير_ترحيب')) {
    const newText = trimmedBody.replace(/^\.تغيير_ترحيب/i, '').trim();
    if (!newText) return sendBotMessage(sock, from, { text: '📌 اكتب نص الترحيب الجديد بعد الأمر.\nاكتب `@العضو` في المكان الذي تريد أن يظهر فيه منشن العضو الداخل.\nمثال: `.تغيير_ترحيب أهلاً بك @العضو في مجموعتنا`' });
    getGroupSetting(from).welcomeText = newText; persistWelcome(from);
    return sendBotMessage(sock, from, { text: '✅ تم تغيير استمارة الترحيب لهذه المجموعة فقط.' });
}
if (cmd.startsWith('تغيير_توديع')) {
    const newText = trimmedBody.replace(/^\.تغيير_توديع/i, '').trim();
    if (!newText) return sendBotMessage(sock, from, { text: '📌 اكتب نص التوديع الجديد بعد الأمر.\nاكتب `@العضو` في المكان الذي تريد أن يظهر فيه منشن العضو الخارج.\nمثال: `.تغيير_توديع وداعاً @العضو نتمنى لك التوفيق`' });
    getGroupSetting(from).goodbyeText = newText; persistWelcome(from);
    return sendBotMessage(sock, from, { text: '✅ تم تغيير استمارة التوديع لهذه المجموعة فقط.' });
}
if (cmd === 'ترحيب_افتراضي') {
    getGroupSetting(from).welcomeText = ''; persistWelcome(from);
    return sendBotMessage(sock, from, { text: '✅ تم إرجاع استمارة الترحيب الأساسية لهذه المجموعة.' });
}
if (cmd === 'توديع_افتراضي') {
    getGroupSetting(from).goodbyeText = ''; persistWelcome(from);
    return sendBotMessage(sock, from, { text: '✅ تم إرجاع استمارة التوديع الأساسية لهذه المجموعة.' });
}
if (cmd === 'توقيف توديع') { getGroupSetting(from).goodbye = false; persistWelcome(from); return sendBotMessage(sock, from, { text: '🔴 تم إيقاف التوديع.' }); }    

if (cmd.startsWith('تغيير_الاسم')) {    
    const newName = trimmedBody.replace(/^\.تغيير_الاسم/i, '').trim();    
    if (!newName) return sendBotMessage(sock, from, { text: '📌 يرجى كتابة الاسم الجديد.' });    
    try { await sock.groupUpdateSubject(from, newName); return sendBotMessage(sock, from, { text: `✅ تم تغيير اسم المجموعة إلى: *${newName}*` }); } catch (e) { return sendBotMessage(sock, from, { text: '❌ فشل التغيير تأكد أن البوت مشرف.' }); }    
}    
if (cmd.startsWith('تغيير_الوصف')) {    
    const newDesc = trimmedBody.replace(/^\.تغيير_الوصف/i, '').trim();    
    if (!newDesc) return sendBotMessage(sock, from, { text: '📌 يرجى كتابة الوصف الجديد.' });    
    try { await sock.groupUpdateDescription(from, newDesc); return sendBotMessage(sock, from, { text: `✅ تم تغيير وصف المجموعة بنجاح!` }); } catch (e) { return sendBotMessage(sock, from, { text: '❌ فشل التغيير تأكد أن البوت مشرف.' }); }    
}    

if (cmd === 'رابط_الجروب' || cmd === 'الرابط') {    
    try {    
        const code = await sock.groupInviteCode(from);    
        const groupMeta = await sock.groupMetadata(from);
        const text = `╭━━━〔 🔗 〕━━━╮\n『 رَابِـطُ الـمَـجْـمُـوعَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👥 ⌯ المجموعة ↞ ${groupMeta.subject}\n👑 ⌯ الطلب بواسطة ↞ @${sender.split('@')[0]}\n🔗 ⌯ الرابط ↞ https://chat.whatsapp.com/${code}\n✅ ⌯ الحالة ↞ تم جلب الرابط»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
        return sendBotMessage(sock, from, { text, mentions: [sender] });    
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ فشل جلب الرابط تأكد أن البوت مشرف.' }); }    
}    

if (cmdBase === 'حظر_رابط' || cmdBase === 'حظر رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮\n『 تَـفْـعِـيـلُ مَـانِـعِ الروابط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ منع الروابط\n✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_رابط' || cmdBase === 'سماح رابط') {    
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiLink = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 تَـعْـطِـيـلُ مَـانِـعِ الروابط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ الروابط\n⛔ ⌯ الحالة ↞ تم تعطيل الحماية»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    
if (cmdBase === 'حظر_شتم' || cmdBase === 'حظر شتم' || cmdBase === 'حظر_سب') {    
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮\n『 تَـفْـعِـيـلُ مَـانِـعِ الشتم والسب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ منع الشتم والسب\n✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_شتم' || cmdBase === 'سماح شتم' || cmdBase === 'سماح_سب') {    
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiBadWords = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 تَـعْـطِـيـلُ مَـانِـعِ الشتم والسب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ الشتم والسب\n⛔ ⌯ الحالة ↞ تم تعطيل الحماية»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    
if (cmdBase === 'حظر_جهات' || cmdBase === 'حظر جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = true;    
    const text = `╭━━━〔 🛡️ 〕━━━╮\n『 تَـفْـعِـيـلُ مَـانِـعِ جهات الاتصال 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ منع جهات الاتصال\n✅ ⌯ الحالة ↞ تم تفعيل الحماية بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    
if (cmdBase === 'سماح_جهات' || cmdBase === 'سماح جهات') {    
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ متاح للمشرفين والمطور فقط!' });    
    getGroupSetting(from).antiContact = false;    
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 تَـعْـطِـيـلُ مَـانِـعِ جهات الاتصال 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔗 ⌯ الخاصية ↞ جهات الاتصال\n⛔ ⌯ الحالة ↞ تم تعطيل الحماية»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender] });    
}    

if (activeGames[from]) {    
    if (['صراحة', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'زواج'].includes(cmdBase)) {    
        return sendBotMessage(sock, from, { text: `⚠️ توجد فعالية قيد التشغيل حالياً في هذه المجموعة! قم بالإجابة عليها أو اكتب \`.انسحب\` أولاً.` });    
    }    
}    

async function startFirstRound(sock, from, gameType) {
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }

    let gameTitle = '';
    let arabicName = '';

    if (gameType === 'typing') {
        gameTitle = '𝐓𝐘𝐏𝐈𝐍𝐆 𝐆𝐀𝐌𝐄';
        arabicName = 'الكتابة';
    } else if (gameType === 'disassemble') {
        gameTitle = '𝐃𝐈𝐒𝐀𝐒𝐒𝐄𝐌𝐁𝐋𝐄 𝐆𝐀𝐌𝐄';
        arabicName = 'التفكيك';
    } else if (gameType === 'arrange') {
        gameTitle = '𝐀𝐑𝐑𝐀𝐍𝐆𝐄 𝐆𝐀𝐌𝐄';
        arabicName = 'الترتيب';
    } else if (gameType === 'guess') {
        gameTitle = '𝐆𝐔𝐄𝐒𝐒 𝐆𝐀𝐌𝐄';
        arabicName = 'التخمين';
    }

    const startMsg = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

    ✍️ *${gameTitle}*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*«🏁 بَـدْءُ مُـسَـابَـقَـةِ ${arabicName}»*

> ╎ 🎯 الهدف: الوصول إلى 10 نقاط (الفائز يحصل على 50 نقطة)
> ╎ ⏳ مدة الجولة: 15 ثانية
> ╎ 🏆 الفوز: أول لاعب يصل إلى الهدف

❐═━━━═╊⊰🍷⊱╉═━━━═❐

\`⚡ هل أنت الأسرع؟ أثبت مهارتك!\`

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;

    await sendBotMessage(sock, from, { text: startMsg });

    setTimeout(() => {
        startNextRound(sock, from, gameType, {});
    }, 1500);
}

async function startNextRound(sock, from, gameType, existingScores = {}) {
    if (activeGames[from]) {
        clearTimeout(activeGames[from].timer);
        delete activeGames[from];
    }

    const word = animeDatabase[Math.floor(Math.random() * animeDatabase.length)];
    let actionInstruction = '';

    if (gameType === 'typing') {
        actionInstruction = 'اكتب الكلمة بشكل صحيح قبل الجميع!';
    } else if (gameType === 'disassemble') {
        actionInstruction = 'فكك الكلمة بشكل صحيح قبل الجميع!';
    } else if (gameType === 'arrange') {
        actionInstruction = 'رتب الحروف بشكل صحيح قبل الجميع!';
    } else if (gameType === 'guess') {
        actionInstruction = 'خمن الرقم الصحيح قبل الجميع!';
    }

    let displayContent = word;
    if (gameType === 'disassemble') displayContent = disassembleWord(word);
    if (gameType === 'arrange') displayContent = shuffleString(word);
    if (gameType === 'guess') displayContent = Math.floor(Math.random() * 50) + 1;

    const timer = setTimeout(async () => {
        if (activeGames[from] && activeGames[from].type === gameType && !activeGames[from].isCompleted) {
            delete activeGames[from];
            await sendBotMessage(sock, from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الإجابة الصحيحة كانت:* \`${word}\`` });
        }
    }, 15000);

    const challengeMsg = `*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

\`«🌀 جَـوْلَـةٌ جَـدِيـدَة»\`

*╎ 💬 الكلمة المطلوبة:*

    『 *${displayContent}* 』

> ╎ ⏳ الوقت المتاح: 15 ثانية
> ╎ 🏆 الجائزة: نقطة واحدة

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

\`⚡ ${actionInstruction}\`

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;

    const sent = await sendBotMessage(sock, from, { text: challengeMsg });
    activeGames[from] = { 
        type: gameType, 
        answer: gameType === 'guess' ? displayContent.toString() : word, 
        timer: timer, 
        isCompleted: false, 
        msgId: sent.key.id,
        scores: existingScores
    };
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

        return sendBotMessage(sock, from, { text: marriageText, mentions: [groom, bride] });
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ تعذر إتمام عقد الزواج.' }); }
}    

if (cmd === 'صراحة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const participants = meta.participants.map(p => p.id);    
        const randomUser = participants[Math.floor(Math.random() * participants.length)];    
        const q = sarahaQuestions[Math.floor(Math.random() * sarahaQuestions.length)];
        return sendBotMessage(sock, from, { text: `💬 *سُـؤَالُ صَـرَاحَـةٍ مَـوَجَّـهٌ إِلَـى @${randomUser.split('@')[0]}:*\n\n> 🎯 ${q}`, mentions: [randomUser] });    
    } catch (e) { return sendBotMessage(sock, from, { text: `💬 *سُـؤَالُ صَـرَاحَـة:* ${sarahaQuestions[0]}` }); }    
}    

if (cmd === 'خيروك' || cmd === 'لوخيروك') {    
    const q = khayrokQuestions[Math.floor(Math.random() * khayrokQuestions.length)];
    return sendBotMessage(sock, from, { text: `❓ *لَـعْـبَـةُ لَـوْ خَـيَّـرُوكَ:* \n\n> ${q}` });    
}    

if (cmdBase === 'كتابه' || cmdBase === 'كتابة') {
    startFirstRound(sock, from, 'typing');
    return;
}

if (cmdBase === 'تفكيك') {
    startFirstRound(sock, from, 'disassemble');
    return;
}

if (cmd === 'رتب') {
    startFirstRound(sock, from, 'arrange');
    return;
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
            await sendBotMessage(sock, from, { text: `⏰ *انتهى الوقت المحدد للفعالية!*` });
        }
    }, 45000);

    const promptText = `🔠 *فَـعَـالِـيَّـةُ الـحَـرْفِ (الوقت: 45 ثانية):*\n\nالحرف المطلوب: [ *${randomLetter}* ]\n\n📌 *المطلوب:* اكتب 3 أسماء شخصيات أنمي تبدأ بهذا الحرف في رسالة واحدة!`;
    return sendBotMessage(sock, from, { text: promptText }).then(sent => {
        activeGames[from] = { type: 'letter_characters', requiredLetter: randomLetter, timer: timer, isCompleted: false, msgId: sent.key.id };
    });
}    

if (cmd === 'حكمة') {    
    const item = animeQuotesList[Math.floor(Math.random() * animeQuotesList.length)];    
    const quoteFormatted = `📜 *مَوْسُوعَةُ حِكَمِ وَأَقْوَالِ الشَّخْصِيَّاتِ (الأنمي):*\n\n> "${item.quote}"\n\n👤 *الشَّخْصِيَّة:* \`${item.character}\``;
    return sendBotMessage(sock, from, { text: quoteFormatted });    
}    

if (cmd === 'خمن') { 
    startFirstRound(sock, from, 'guess');
    return;
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
            await sendBotMessage(sock, from, { text: `⏰ *انتهى الوقت المحدد!*\n💡 *الجواب الصحيح:* \`${item.a}\`` });
        }
    }, 30000);
    return sendBotMessage(sock, from, { text: `🧩 *لغز وحزورة:*\n\n${item.q}` }).then(sent => {
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
    return sendBotMessage(sock, from, { text: `📖 *آيَاتٌ قُرْآنِيَّةٌ مُبَارَكَةٌ (5 آيات):*\n\n` + selectedAyat.join('\n\n') });    
}    

if (cmd === 'دعاء') {    
    const randomDua = duaList[Math.floor(Math.random() * duaList.length)];
    return sendBotMessage(sock, from, { text: `🤲 *دعاء مبارك:*\n\n${randomDua}` });    
}    
if (cmd === 'ذكر') {    
    return sendBotMessage(sock, from, { text: `📿 *ذكر مبارك:* سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ العَظِيمِ.` });    
}    
if (cmd === 'حديث') {    
    const randomHadith = hadithList[Math.floor(Math.random() * hadithList.length)];
    return sendBotMessage(sock, from, { text: `☪️ *حديث نبوي شريف:*\n\n${randomHadith}` });    
}    

if (cmd === 'اذكار_الصباح' || cmd === 'أذكار_الصباح') {    
    return sendBotMessage(sock, from, { text: `*╎أذكـار 🌙私*\n\n*أذكار الـصـبـاح ⛅*\n\n- اللّهُ لاَ إِلَـهَ إِلاّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ...` });    
}    

if (cmd === 'اذكار_المساء' || cmd === 'أذكار_المساء') {    
    return sendBotMessage(sock, from, { text: `*أذكار الـمـسـاء 🌙*\n\n- اللهم انت ربي لا اله الا انت خلقتني وانا عبدك...` });    
}    

if (cmd === 'أذكار' || cmd === 'اذكار') {    
    return sendBotMessage(sock, from, { text: `🌙 *الأوامر المتاحة للأذكار:\n\n.اذكار_الصباح\n.اذكار_المساء\n.اذكار_الاستيقاظ\n.اذكار_الصلاة\n.اذكار_المسجد` });    
}    

if (cmd === 'نكتة') { return sendBotMessage(sock, from, { text: jokesList[Math.floor(Math.random() * jokesList.length)] }); }    
if (cmd === 'ماذا_لو') { return sendBotMessage(sock, from, { text: whatIfList[Math.floor(Math.random() * whatIfList.length)] }); }    
if (cmd === 'قول') { return sendBotMessage(sock, from, { text: `🗣️ *مقولة اليوم:* \n\n> "${quotesList[Math.floor(Math.random() * quotesList.length)]}"` }); }    

if (cmd === 'غزل') {    
    const targetUser = getTargetUser(msg) || sender;
    return sendBotMessage(sock, from, { text: `🌹 *تَرْتِيلَةُ غَزَلٍ لِـ @${targetUser.split('@')[0]}:*\n\n> "${ghazalsList[Math.floor(Math.random() * ghazalsList.length)]}"`, mentions: [targetUser] });
}

if (cmd === 'ثنائي') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const mems = meta.participants;    
        if (mems.length < 2) return sendBotMessage(sock, from, { text: `❌ الأعضاء لا يكفون لتكوين ثنائي!` });
        const p1 = mems[Math.floor(Math.random() * mems.length)].id;
        let p2 = mems[Math.floor(Math.random() * mems.length)].id;
        while (p1 === p2) { p2 = mems[Math.floor(Math.random() * mems.length)].id; }
        return sendBotMessage(sock, from, { text: `💞 *استمارة نقابة فينلاند الرسمية لأفضل ثنائي متطابق:* \n\n✨ تم إعلان الثنائي الأسطوري بين:\n👤 @${p1.split('@')[0]}\n👤 @${p2.split('@')[0]}\n\nنتمنى لهما حياة سعيدة وموفقة! 🥂❤️`, mentions: [p1, p2] });    
    } catch (e) { return sendBotMessage(sock, from, { text: `💞 تم اختيار الثنائي الأسطوري بنجاح.` }); }    
}

if (cmd === 'ملك_المجموعة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const chosen = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;    
        return sendBotMessage(sock, from, { text: `👑 *إعلان ملك المجموعة:* \n\nبناءً على التفاعل الأسطوري، تم اختيار:\n\n✨ @${chosen.split('@')[0]} ✨\n\nليكون *ملك المجموعة* لهذا اليوم! 🏆🔥`, mentions: [chosen] });    
    } catch (e) { return sendBotMessage(sock, from, { text: `👑 تم اختيار ملك المجموعة.` }); }    
}

if (cmd === 'كيوت_المجموعة') {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const chosen = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;    
        return sendBotMessage(sock, from, { text: `🌸 *إعلان لطافة المجموعة:* \n\nتم اختيار العضو:\n\n🧸 @${chosen.split('@')[0]} 🧸\n\nليكون رسمياً *كيوت المجموعة* لهذا اليوم! ✨🍼`, mentions: [chosen] });    
    } catch (e) { return sendBotMessage(sock, from, { text: `🌸 تم اختيار كيوت المجموعة.` }); }    
}

if (['ملكة_المجموعة', 'محبوب_المجموعة', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'مميز_المجموعة'].includes(cmdBase)) {    
    try {    
        const meta = await sock.groupMetadata(from);    
        const chosen = meta.participants[Math.floor(Math.random() * meta.participants.length)].id;    
        return sendBotMessage(sock, from, { text: `👑 لقب (${cmdBase}) تم منحه بجدارة إلى العضو: @${chosen.split('@')[0]} ✨`, mentions: [chosen] });    
    } catch (e) { return sendBotMessage(sock, from, { text: `👑 تم اختيار الألقاب.` }); }    
}    

if (cmd === 'رسائلي') {    
    const todayKey = getJordanDateKey();    
    const count = userMessagesCount[from]?.[todayKey]?.[sender] || 0;    
    return sendBotMessage(sock, from, { text: `📩 عدد رسائلك المسجلة اليوم يا @${sender.split('@')[0]} هو: *${count} رسالة*`, mentions: [sender] });    
}

if (cmd === 'توب_التفاعل') {    
    const todayKey = getJordanDateKey();
    const groupMsgs = userMessagesCount[from]?.[todayKey] || {};
    try {
        const meta = await sock.groupMetadata(from);
        let totalGroupMessages = 0;
        Object.values(groupMsgs).forEach(val => totalGroupMessages += val);

        let sortedParticipants = meta.participants.sort((a, b) => (groupMsgs[b.id] || 0) - (groupMsgs[a.id] || 0));
        let text = `📊 *إِحْـصَـائِـيَّـاتُ تـوبِ الـتَّـفَـاعُـلِ لِـلْيَوْمِ (${todayKey}):*\n💬 *إجمالي رسائل المجموعة اليوم:* \`${totalGroupMessages}\` رسالة\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n\n`;
        let mentions = [];
        sortedParticipants.forEach((p, idx) => {
            const msgCount = groupMsgs[p.id] || 0;
            let medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
            text += `${medal} *الـمَـرْتَـبَـةُ [${idx + 1}]* ↞ @${p.id.split('@')[0]}\n> 💬 عـدَدُ الـرَّسَـائِـلِ: \`${msgCount}\` رسالة\n\n`;
            mentions.push(p.id);
        });
        text += `*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*`;
        const userPp = await getUserProfilePic(sock, sender);
        try { await sendBotMessage(sock, from, { image: { url: userPp }, caption: text, mentions }); } catch (e) { await sendBotMessage(sock, from, { text, mentions }); }
        return;
    } catch (e) { return sendBotMessage(sock, from, { text: `❌ تعذر جلب توب التفاعل.` }); }
}

if (cmd.startsWith('اضافة_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    const title = trimmedBody.replace(/^\.اضافة_لقب/i, '').replace(/@\d+/g, '').trim();
    if (!targetUser || !title) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });
    if (!groupTitles[from]) groupTitles[from] = {};
    if (!groupReservedTitles[from]) groupReservedTitles[from] = {};
    if (Object.values(groupTitles[from]).includes(title) || Object.values(groupReservedTitles[from]).includes(title)) {
        return sendBotMessage(sock, from, { text: `❌ اللقب ( *${title}* ) مأخوذ أو محجوز مسبقاً!` });
    }
    groupTitles[from][targetUser] = title;
    const text = `╭━━━〔 👑 〕━━━╮\n『 تَـسْـجِـيـلُ لَـقَـبٍ جَـدِيـد 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🏷️ ⌯ اللقب ↞ [ ${title} ]\n✨ ⌯ الحالة ↞ تم تسجيل اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('ازالة_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });
    if (groupTitles[from]) delete groupTitles[from][targetUser];
    const text = `╭━━━〔 ❌ 〕━━━╮\n『 إِزَالَـةُ لَـقَـب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n✨ ⌯ الحالة ↞ تمت إزالة اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('حجز_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    const title = trimmedBody.replace(/^\.حجز_لقب/i, '').replace(/@\d+/g, '').trim();
    if (!targetUser || !title) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });
    if (!groupTitles[from]) groupTitles[from] = {};
    if (!groupReservedTitles[from]) groupReservedTitles[from] = {};
    if (Object.values(groupTitles[from]).includes(title) || Object.values(groupReservedTitles[from]).includes(title)) {
        return sendBotMessage(sock, from, { text: `❌ اللقب ( *${title}* ) مأخوذ أو محجوز مسبقاً!` });
    }
    groupReservedTitles[from][targetUser] = title;
    const text = `╭━━━〔 🔒 〕━━━╮\n『 حَـجْـزُ لَـقَـبٍ خَـاص 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n🔒 ⌯ اللقب ↞ [ ${title} ]\n✨ ⌯ الحالة ↞ تم حجز اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });
}

if (cmd.startsWith('الغاء_حجز_لقب')) {
    if (!isSenderAdmin && !isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمشرفين والمطور فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });
    if (groupReservedTitles[from]) delete groupReservedTitles[from][targetUser];
    const text = `╭━━━〔 🔓 〕━━━╮\n『 إِلْـغَـاءُ حَـجْـزِ لَـقَـب 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${targetUser.split('@')[0]}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n✨ ⌯ الحالة ↞ تم إلغاء حجز اللقب بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });
}

if (cmd === 'قائمة_الالقاب') {
    const titles = groupTitles[from] || {};
    const keys = Object.keys(titles);
    if (keys.length === 0) return sendBotMessage(sock, from, { text: '📋 لا توجد ألقاب مسجلة في هذه المجموعة بعد!' });
    let text = `╭━━━〔 👑 〕━━━╮\n『 قَـائِـمَـةُ الأَلْـقَـابِ الـمُـسَـجَّـلَـةِ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;
    let mentions = [];
    keys.forEach((userJid, idx) => {
        text += `${idx + 1}. @${userJid.split('@')[0]} ↞ *[${titles[userJid]} ]*\n`;
        mentions.push(userJid);
    });
    text += `\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions });
}

if (cmd === 'قائمة_الالقاب_المحجوزة') {
    const resTitles = groupReservedTitles[from] || {};
    const keys = Object.keys(resTitles);
    if (keys.length === 0) return sendBotMessage(sock, from, { text: '🔒 لا توجد ألقاب محجوزة في هذه المجموعة بعد!' });
    let text = `╭━━━〔 🔒 〕━━━╮\n『 قَـائِـمَـةُ الأَلْـقَـابِ الـمَـحْـجُـوﺯَةِ 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;
    let mentions = [];
    keys.forEach((userJid, idx) => {
        text += `${idx + 1}. @${userJid.split('@')[0]} ↞ *[${resTitles[userJid]} ]*\n`;
        mentions.push(userJid);
    });
    text += `\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions });
}

if (cmdBase === 'تفاعل') {    
    const parts = trimmedBody.split(' ');    
    commandReactionEmoji = parts[1] || '⚡';    
    commandReactionEnabled = (parts[2] || '').toLowerCase() === 'تفعيل';    
    const reactText = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*🟢 تَـحْـدِيـثُ الـتَـفـاعـلُ*

> ╎ ⚙️ تم تحديث إعدادات التفاعل بنجاح.
> ╎ ✅ الحالة: تم حفظ التغييرات.

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;
    return sendBotMessage(sock, from, { text: reactText });    
}    
if (cmdBase === 'تفاعل_مطور') {    
    const parts = trimmedBody.split(' ');    
    devReactionEmoji = parts[1] || '👑';    
    devReactionEnabled = (parts[2] || '').toLowerCase() === 'تفعيل';    
    const devReactText = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*👑 تَـحْـدِيـثُ تَـفَـاعُـلِ الـمُـطَـوِّر*

> ╎ 🟢 الحالة: تم التحديث بنجاح.
> ╎ ⚡ التغيير: تم اعتماد التفاعل الجديد.

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;
    return sendBotMessage(sock, from, { text: devReactText });    
}    

if (cmdBase === 'اضافة_مطور') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });    
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    if (!extraDevelopers.includes(cleanNum)) extraDevelopers.push(cleanNum);
    
    const text = `╭━━━〔 ♟️ 〕━━━╮\n『 إِضَـافَـةُ مُـطَـوِّرٍ جَـدِيـد 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ الحساب ↞ @${cleanNum}\n👑 ⌯ المسؤول ↞ المطور الأساسي\n🛡️ ⌯ الصلاحية ↞ مطور\n✅ ⌯ الحالة ↞ تمت إضافة المطور بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser] });    
}    

if (cmdBase === 'حذف_مطور') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });    
    const targetUser = getTargetUser(msg);    
    if (targetUser) {
        const cleanNum = targetUser.replace(/[^0-9]/g, '');
        extraDevelopers = extraDevelopers.filter(d => d !== cleanNum);
    }
    const text = `╭━━━〔 ⚠️ 〕━━━╮\n『 إِزَالَـةُ صَـلَاحِـيَـاتِ مُـطَـوِّر 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ الحساب ↞ @${targetUser ? targetUser.split('@')[0] : 'المستخدم'}\n👑 ⌯ المسؤول ↞ المطور الأساسي\n🔓 ⌯ الإجراء ↞ إزالة صلاحيات المطور\n✅ ⌯ الحالة ↞ تمت إزالة المطور بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: targetUser ? [targetUser] : [] });    
}    

if (cmdBase === 'اضف_نخبة') {
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    if (!vipUsers.includes(cleanNum)) vipUsers.push(cleanNum);

    const text = `╭━━━〔 👑 〕━━━╮\n『 إِضَـافَـةُ عُـضْـوٍ إِلَـى الـنُّـخْـبَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${cleanNum}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n✨ ⌯ الرتبة ↞ نُخبة\n🛡️ ⌯ الصلاحية ↞ عضو نخبة\n✅ ⌯ الحالة ↞ تمت الإضافة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });
}

if (cmdBase === 'ازل_نخبة') {
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });
    const targetUser = getTargetUser(msg);
    if (!targetUser) return sendBotMessage(sock, from, { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n📌 تَـنْـبِـيـه\n\n╎ يرجى عمل منشن للشخص المطلوب.\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐' });
    const cleanNum = targetUser.replace(/[^0-9]/g, '');
    vipUsers = vipUsers.filter(v => v !== cleanNum);

    const text = `╭━━━〔 ♟️ 〕━━━╮\n『 إِزَالَـةُ عُـضْـوٍ مِنَ الـنُّـخْـبَـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو ↞ @${cleanNum}\n👑 ⌯ المسؤول ↞ @${sender.split('@')[0]}\n📉 ⌯ الرتبة السابقة ↞ نُخبة\n🔓 ⌯ الإجراء ↞ سحب رتبة النخبة\n✅ ⌯ الحالة ↞ تمت الإزالة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [targetUser, sender] });
}

if (cmdBase === 'عرض_نخبة') {
    if (vipUsers.length === 0) return sendBotMessage(sock, from, { text: '📋 لا يوجد أعضاء نخبة مسجلين حالياً!' });
    let text = `👑 *قَـائِـمَـةُ أَعْـضَـاءِ الـنُّـخْـبَـةِ:*\n\n`;
    let mentions = [];
    vipUsers.forEach((v, idx) => {
        text += `${idx + 1}. @${v}\n`;
        mentions.push(v + '@s.whatsapp.net');
    });
    return sendBotMessage(sock, from, { text, mentions });
}

if (cmdBase === 'اختبار') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });    
    let isBotActive = !globalBotStopped;
    let statusEmoji = isBotActive ? '🟢' : '🔴';
    let testReport = `🧪 *فَـحْـصُ وَاسْـتِـعْـرَاضُ حَـالَـةِ أَوْامِـرِ الـبُـوتِ:*\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*\n\n`;
    validCommands.forEach((c, idx) => { testReport += `> ${idx + 1}. \`.${c}\` ↞ ${statusEmoji}\n`; });
    testReport += `\n*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐\n📊 *إجمالي الأوامر الفعالة:* \`${validCommands.length}\` أمر\n🟢 حالة النظام: [ممتازة]`;
    try { await sendBotMessage(sock, from, { text: testReport }); } catch (e) { await sendBotMessage(sock, from, { text: testReport }); }
    return;
}    

if (cmdBase === 'سجل_البوت') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });    
    return sendBotMessage(sock, from, { text: `📡 سجل العمليات:\n` + (botLogs.join('\n') || 'لا توجد سجلات بعد.') });    
}    

if (cmdBase === 'ايقاف_البوت' || cmdBase === 'إيقاف_البوت' || cmdBase === 'إيقاف البوت') {
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });
    stoppedSubBotGroups.add(from);
    return sendBotMessage(sock, from, { text: `🟢 تم إيقاف جميع البوتات المنصّبة في هذه المجموعة فقط.` });
}

if (cmdBase === 'تفعيل_البوت' || cmdBase === 'تفعيل البوت') {
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });
    stoppedSubBotGroups.delete(from);
    return sendBotMessage(sock, from, { text: `🟢 تم إعادة تشغيل جميع البوتات المنصّبة في هذه المجموعة.` });
}

if (cmdBase === 'تعطيل_البوتات' || cmd === 'تعطيل بوتات') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });    
    const parts = trimmedBody.split(' ');    
    const action = (parts[1] || '').toLowerCase();    
    if (action === 'تفعيل' || action === 'تشغيل') {    
        getGroupSetting(from).antiOtherBots = true;    
        return sendBotMessage(sock, from, { text: `🛡️ *تم تفعيل تعطيل البوتات الأخرى في هذه المجموعة.*` });    
    } else if (action === 'ايقاف' || action === 'إيقاف' || action === 'تعطيل') {    
        getGroupSetting(from).antiOtherBots = false;    
        return sendBotMessage(sock, from, { text: `🔓 *تم إيقاف ميزة تعطيل البوتات.*` });    
    } else {    
        return sendBotMessage(sock, from, { text: `📌 الاستخدام: \`.تعطيل_البوتات تفعيل\` أو \`.تعطيل_البوتات ايقاف\`` });    
    }    
}    

if (cmdBase === 'خاص' || cmdBase === 'وضع_خاص') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين الأساسيين فقط!' });    
    getGroupSetting(from).botMode = 'private';    
    const privateMsg = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*🔒 تَـمَّ تَـفْـعِـيـلُ الـوَضْـعِ الـخَـاصّ*

> ╎ 🛡️ مستوى الوصول: المطورون والنخبة فقط
> ╎ 🔐 الحالة: الوضع الخاص مفعّل

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

\`«🍷 الخصوصية امتياز، والوصول للنخبة فقط.»\`

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;
    return sendBotMessage(sock, from, { text: privateMsg });    
}    

if (cmdBase === 'عام' || cmdBase === 'وضع_عام') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين الأساسيين فقط!' });    
    getGroupSetting(from).botMode = 'public';    
    const publicMsg = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

*🔓 تَـمَّ تَـفْـعِـيـلُ الـوَضْـعِ الـعَـامّ*

> ╎ 🌐 حالة الوصول: متاح للجميع
> ╎ ✅ الحالة: الوضع العام مفعّل

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

\`🍷 الجميع مرحّب بهم.\`

*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;
    return sendBotMessage(sock, from, { text: publicMsg });    
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
                await sendBotMessage(sock, from, sendOptions, { quoted: msg });    
                return;    
            }    
        } catch (e) { return sendBotMessage(sock, from, { text: `❌ حدث خطأ أثناء كشف الوسائط.` }); }    
    }    
    return sendBotMessage(sock, from, { text: `📌 يرجى الرد على رسالة العرض مرة واحدة بكلمة \`كشف\`` });    
}    

if (cmdBase === 'توب_نقاط' || cmdBase === 'الاغنياء' || cmdBase === 'الأغنياء') {    
    try {
        const meta = await sock.groupMetadata(from);
        let mentions = meta.participants.map(p => p.id);
        let sorted = mentions.sort((a, b) => (userPoints[b] || 0) - (userPoints[a] || 0));

        let topText = `╭━━━〔 🏆 〕━━━╮\n『 قَـائِـمَـةُ أَعْلَى الـنِّـقَـاط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n`;    
        sorted.forEach((u, index) => { 
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
            topText += `${medal} *الـمَـرْتَـب [${index + 1}]* ↞ @${u.split('@')[0]}\n> 💰 *الـرَّصِـيـد:* \`${userPoints[u] || 0}\` نقطة\n\n`; 
        });    
        topText += `❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
        const userPp = await getUserProfilePic(sock, sender);    
        try { await sendBotMessage(sock, from, { image: { url: userPp }, caption: topText, mentions }); } catch (e) { await sendBotMessage(sock, from, { text: topText, mentions }); }    
        return;    
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ تعذر جلب توب النقاط.' }); }
}    

if (cmdBase === 'تحويل') {    
    const parts = trimmedBody.split(' ');    
    const amount = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(amount) || amount <= 0 || !targetUser) return sendBotMessage(sock, from, { text: '📌 الاستخدام: `.تحويل <المبلغ> @منشن`' });    
    getBankAccount(sender); getBankAccount(targetUser);    
    if ((userPoints[sender] || 0) < amount) return sendBotMessage(sock, from, { text: `❌ رصيدك لا يكفي!` });    
    userPoints[sender] -= amount; userPoints[targetUser] += amount;    
    const text = `╭━━━〔 💸 〕━━━╮\n『 تَـحْـوِيـلُ الـنِّـقَـاط 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ المُرسِل ↞ @${sender.split('@')[0]}\n🎯 ⌯ المُستلم ↞ @${targetUser.split('@')[0]}\n💰 ⌯ المبلغ ↞ ${amount} نقطة\n✅ ⌯ الحالة ↞ تمت عملية التحويل بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text, mentions: [sender, targetUser] });    
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
    return sendBotMessage(sock, from, { text, mentions });    
}    

if (cmdBase === 'اعطاء' || cmdBase === 'إعطاء') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين!' });    
    const parts = trimmedBody.split(' ');    
    const amount = parseInt(parts[1]);    
    const targetUser = getTargetUser(msg);    
    if (isNaN(amount) || !targetUser) return sendBotMessage(sock, from, { text: '📌 الاستخدام: `.اعطاء 1000 @منشن`' });    
    getBankAccount(targetUser);    
    userPoints[targetUser] = (userPoints[targetUser] || 0) + amount;    
    return sendBotMessage(sock, from, { text: `✅ تم إضافة ${amount} نقطة بنجاح.`, mentions: [targetUser] }, { quoted: msg });    
}    

if (cmdBase === 'اذاعة' || cmdBase === 'إذاعة') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });    
    const bcText = trimmedBody.replace(/^\.(اذاعة|إذاعة)/i, '').trim();    
    if (!bcText) return sendBotMessage(sock, from, { text: '📌 اكتب نص الإذاعة بعد الأمر.' });    
    
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
│ 🎯 النطاق: إذاعة عامة شاملة
│ ✅ الحالة: تم استلام البث بنجاح
╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;

            await sendBotMessage(sock, gId, { text: broadcastFormatted, mentions: allGroupMentions });
        }    

        const finalReport = `╭━━〔 📡 𝑹𝑬𝑷𝑶𝑹𝑻 〕━━⬣

│ 📊 تَقْرِيرُ الإِذَاعَةِ الشَّامِلَةِ:
│ تم إرسال البث بنجاح تامة!
│ 
│ 🏛️ عدد المجموعات المستهدفة: [${targetGroupsCount}] مجموعة
│ 🕒 وقت الإرسال: ${getJordanTime()}
╰━━〔 🍷 『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』 〕━━⬣`;

        return sendBotMessage(sock, from, { text: finalReport });    
    } catch (e) { return sendBotMessage(sock, from, { text: '❌ فشل إرسال الإذاعة.' }); }    
}    

if (cmdBase === 'اساسي') {
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين فقط!' });
    try {
        const unwrap = (m) => m?.ephemeralMessage?.message || m?.viewOnceMessage?.message || m?.viewOnceMessageV2?.message || m?.documentWithCaptionMessage?.message || m;
        const isVid = (m) => !!(m?.videoMessage || (m?.documentMessage && (m.documentMessage.mimetype || '').startsWith('video/')));
        let vidMsg = unwrap(quotedMsg);
        if (!isVid(vidMsg)) vidMsg = unwrap(msg.message);
        if (!isVid(vidMsg)) {
            return sendBotMessage(sock, from, { text: '📌 رد على فيديو بكلمة `.اساسي` أو أرسل الفيديو وفي وصفه `.اساسي` لتغيير فيديو استمارة .بوت.' });
        }
        const videoBuffer = await downloadMediaMessage({ key: msg.key, message: vidMsg }, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
        if (!videoBuffer || !videoBuffer.length) throw new Error('empty video');
        fs.writeFileSync(BOT_VIDEO_FILE, videoBuffer);
        const okText = `*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*\n\n*❐═━━━═╊⊰🍷⊱╉═━━━═❐*\n\n*🎬 تَـمَّ تَـغْـيِـيـرُ الـفِـيـدْيُـو*\n\n> ╎ ✅ الحالة: تم حفظ الفيديو الجديد بنجاح.\n> ╎ 📌 سيظهر الآن فوق استمارة \`.بوت\`.\n\n*❐═━━━═╊⊰🍷⊱╉═━━━═❐*\n\n*『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』*`;
        return sendBotMessage(sock, from, { text: okText }, { quoted: msg });
    } catch (e) {
        console.error('خطأ تغيير فيديو الاستمارة:', e?.message || e);
        return sendBotMessage(sock, from, { text: '❌ فشل تغيير الفيديو، تأكد أنه فيديو صالح وأعد المحاولة.' });
    }
}

if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {    
    if (!isSenderDev) return sendBotMessage(sock, from, { text: '❌ مخصص للمطورين!' });    
    await sendBotMessage(sock, from, { text: '🔄 جاري إعادة تشغيل النظام...' });    
    process.exit(0);    
}    

if (cmdBase === 'قائمة_الاقسام') {
    try { await sendSectionsList(sock, from, sender); }
    catch (e) { console.error('تعذر إرسال قائمة الأقسام:', e?.message || e); await sendBotMessage(sock, from, { text: '❌ تعذر عرض قائمة الأقسام، أرسل .بوت وحاول مرة أخرى.' }); }
    return;
}

if (cmdBase === 'devinfo_form' && getButtonId(msg.message) === '.devinfo_form') {
    const devInfoText = `*♛ ┃ الـمُـطَـوِّر ┃ ♛*

*❐═━━━═╊⊰👑⊱╉═━━━═❐*

> «┃ ♟️︙بُنِيَ هذا البوت بجهدٍ هادئ واهتمامٍ بالتفاصيل،
> ┃ ✦︙ليكون أداةً نافعة وبسيطة الاستخدام للجميع.
> ┃ 🍷︙ونسعى لتطويره باستمرار بناءً على آرائكم.»

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> «شكراً لكل من يستخدم البوت ويدعمه،
> وأي ملاحظة أو اقتراح يصلنا نقدّره ونأخذه بعين الاعتبار.»

*❐═━━━═╊⊰♟️⊱╉═━━━═❐*

> للتواصل المباشر اضغط على زر «حساب المطور» بالأسفل ✨

　　  *『 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 』*`;
    try {
        await sendDevInfoWithButton(sock, from, devInfoText, DEV_INFO_VIDEO_URL, `https://wa.me/${DEVELOPER_NUMBER}`);
        return;
    } catch (e) {
        console.error('تعذر إرسال معلومات المطور مع الزر:', e?.message || e);
    }
    try {
        return await sendBotMessage(sock, from, { video: { url: DEV_INFO_VIDEO_URL }, gifPlayback: true, mimetype: 'video/mp4', caption: devInfoText });
    } catch (e) {
        return sendBotMessage(sock, from, { text: devInfoText });
    }
}

if (cmdBase === 'بوت') {    
    const time = getJordanTime();    
    const botWelcomeText = `*🍷 أَهْـلاً بِـكَ فِـي عَـالَـمِ 𝐸𝓇𝑒𝓃 𝐵𝑜𝑡 🍷*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> «┃ ⌯🔮︙الـمُـسـتـخـدم ⇠ @${sender.split('@')[0]}
> ┃ ⌯⚙️︙حـالـة الـنـظـام ⇠ 🟢 يـعـمـل بـكـفـاءة
> ┃ ⌯📊︙عـدد الأوامـر ⇠ ${validCommands.length} أمـراً
> ┃ ⌯🕒︙الـتـوقـيـت ⇠ ${time}»

*❐═━━━═╊⊰♟️⊱╉═━━━═❐*

> «┃ ♟️︙لَـيْـسَ الـتَّـمَـيُّـزُ فِـي كَـثْـرَةِ الـكَلَام،
> ┃ ✦︙بَـلْ فِـي أثَـرٍ يَـبْـقَـى وَحُـضُـورٍ لا يُـنْـسَـى.
> ┃ 🍷︙نَـجْـعَـلُ الـتَّـفَـاصِـيـلَ تَـتَـحَـدَّثُ عَـنَّـا.»

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

　　  *『 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉 』*`;

    // الاستمارة والأزرار في رسالة واحدة: [الأقسام] [قناة المطور] [جروب التنصيب]
    const subMedia = getSubBotMedia(sock);
    try {
        await sendFormWithButtons(sock, from, botWelcomeText, subMedia ? subMedia.file : getBotCommandsVideo(), sender, !!subMedia && subMedia.type === 'image');
    } catch (e) {
        console.error('تعذر إرسال استمارة .بوت مع الأزرار:', e);
        try { 
            await sendBotMessage(sock, from, { 
                ...(subMedia && subMedia.type === 'image' ? { image: { url: subMedia.file } } : { video: { url: subMedia ? subMedia.file : getBotCommandsVideo() } }), 
                caption: botWelcomeText,
                mentions: [sender]
            }); 
        } catch (e2) { 
            await sendBotMessage(sock, from, { text: botWelcomeText, mentions: [sender] }); 
        }
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
        if (!(await sendSectionWithButtons(sock, from, text1, userPp, sender, [protectionButton(settings)]))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: text1, mentions: [sender] }); 
    } catch (err) {
        await sendBotMessage(sock, from, { text: text1, mentions: [sender] });
    }
} catch (e) { 
    await sendBotMessage(sock, from, { text: text1 }); 
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
        if (!(await sendSectionWithButtons(sock, from, entAndGamesText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: entAndGamesText, mentions: [sender] }); 
    } catch (err) {
        await sendBotMessage(sock, from, { text: entAndGamesText, mentions: [sender] });
    }
} catch (e) { 
    await sendBotMessage(sock, from, { text: entAndGamesText }); 
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
        if (!(await sendSectionWithButtons(sock, from, bankMenuText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: bankMenuText, mentions: [sender] }); 
    } catch (err) {
        await sendBotMessage(sock, from, { text: bankMenuText, mentions: [sender] });
    }
} catch (e) { 
    await sendBotMessage(sock, from, { text: bankMenuText }); 
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
            if (!(await sendSectionWithButtons(sock, from, islamText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: islamText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: islamText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: islamText }); 
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
            if (!(await sendSectionWithButtons(sock, from, funText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: funText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: funText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: funText }); 
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
> 📊 .توب_التفاعل ↞ توب تفاعلات الجروب
> 🏅 .مستواي ↞ مستواك ورتبتك
> 📈 .توب_المستويات ↞ أعلى الأعضاء مستوى
> 🐉 .تايتن ↞ استدعاء تايتن للمجموعة
> ⚔️ .اهجم ↞ هاجم التايتن
> 🗡️ .توب_المهاجمين ↞ أقوى المهاجمين
> 🎂 .ميلادي 15/3 ↞ تسجيل ميلادك (تهنئة تلقائية)
> 🎉 .اقرب_ميلاد ↞ أقرب أعياد الميلاد
> 🪪 .بطاقتي ↞ بطاقة عضويتك
> 🔨 .مزاد ↞ مزاد الألقاب (.زايد <المبلغ>)
> 📦 .كبسولة <أيام> <النص> ↞ رسالة تصل المجموعة بعد مدة`;
    const userPp = await getUserProfilePic(sock, sender);
    try { 
        try {
            if (!(await sendSectionWithButtons(sock, from, groupExtText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: groupExtText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: groupExtText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: groupExtText }); 
    }
    return;
}

if (cmdBase === '7' || cmd === 'المطور' || cmd === 'مطور') {
    const devMenuText = `♟️ *قِـسْـمُ الـمُـطَـوِّرِ:*

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
> 🎬 .اساسي ↞ تغيير فيديو استمارة .بوت (رد على فيديو أو أرسله مع الأمر)
> 🔄 .ريستارت ↞ إعادة التشغيل.`;
    try { 
        try {
            if (!(await sendSectionWithButtons(sock, from, devMenuText, null, sender))) await sendBotMessage(sock, from, { text: devMenuText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: devMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: devMenuText }); 
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
> 🔴 .تفعيل توديع / توقيف توديع ↞ تفعيل/إيقاف التوديع التلقائي
> ✏️ .تغيير_ترحيب <النص> ↞ تغيير استمارة الترحيب لهذه المجموعة
> ✏️ .تغيير_توديع <النص> ↞ تغيير استمارة التوديع لهذه المجموعة\n> ♻️ .ترحيب_افتراضي ↞ إرجاع الترحيب الأساسي\n> ♻️ .توديع_افتراضي ↞ إرجاع التوديع الأساسي\n> 📜 .قوانين ↞ عرض قوانين المجموعة\n> ✏️ .ضبط_قوانين <النص> ↞ ضبط القوانين\n> 🚨 .منشن_المشرفين ↞ منشن المشرفين فقط\n> 🚫 .حظر_اكواد <الكود> ↞ طرد الأعضاء الجدد بكود دولة معين\n> ✅ .سماح_اكواد <الكود> ↞ إزالة كود من الحظر\n> 📉 .غير_المتفاعلين <أيام> ↞ عرض غير المتفاعلين\n> ⚔️ .طرد_غير_المتفاعلين <أيام> ↞ طرد غير المتفاعلين\n> ⏳ .قفل_مؤقت <دقائق> ↞ قفل ثم فتح تلقائي\n> 🗓️ .جدولة_قفل 23:00 06:00 ↞ قفل وفتح يومي تلقائي`;
    const userPp = await getUserProfilePic(sock, sender);
    try { 
        try {
            if (!(await sendSectionWithButtons(sock, from, adminMenuText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: adminMenuText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: adminMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: adminMenuText }); 
    }
    return;
}

if (cmdBase === '9' || cmd === 'الكاشف') {    
    const detectorMenuText = `🔍 *الكشف:* رد على رسالة (عرض مرة واحدة) بكلمة \`كشف\` لفكها فوراً.

> 🗑️ \`.تفعيل_كشف_المحذوف\` / \`.توقيف_كشف_المحذوف\` ↞ حفظ الرسائل المحذوفة
> 📋 \`.قائمة_المحذوف\` ↞ قائمة المحذوف، و\`.قائمة_المحذوف 2\` ↞ إرجاع الرسالة رقم 2
> ✏️ \`.تفعيل_كشف_المعدل\` / \`.توقيف_كشف_المعدل\` ↞ حفظ الرسائل المعدلة
> 📋 \`.قائمة_المعدل\` ↞ قائمة المعدل، و\`.قائمة_المعدل 2\` ↞ عرض الرسالة رقم 2`;    
    const userPp = await getUserProfilePic(sock, sender);    
    try { 
        try {
            if (!(await sendSectionWithButtons(sock, from, detectorMenuText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: detectorMenuText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: detectorMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: detectorMenuText }); 
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
            if (!(await sendSectionWithButtons(sock, from, titleMenuText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: titleMenuText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: titleMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: titleMenuText }); 
    }
    return;
}

if (cmdBase === '11') {
    const stickerMenuText = `🎨 *قسـم الملصقات:*

> 🎨 \`.ملصق\` ↞ صورة أو فيديو إلى ملصق
> 🥷 \`.سرقة\` ↞ إعادة نشر ملصق باسمك
> 😀 \`.ايموجي\` ↞ إيموجي إلى ملصق
> ✍️ \`.كتابة <نص>\` ↞ ملصق نصي
> 🖼️ \`.لصورة\` ↞ ملصق إلى صورة
> ⭕ \`.دائري\` ↞ ملصق دائري
> 🗂️ \`.باك\` ↞ حزمة ملصقات
> 📦 \`.حزمة <اسم الشخصية>\` ↞ حزمة ملصقات جاهزة للشخصية`;
    const userPp = await getUserProfilePic(sock, sender);
    try { 
        try {
            if (!(await sendSectionWithButtons(sock, from, stickerMenuText, userPp, sender))) await sendBotMessage(sock, from, { image: { url: userPp }, caption: stickerMenuText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: stickerMenuText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: stickerMenuText }); 
    }
    return;
}

if (cmdBase === 'بنك' || cmd === 'حسابي') {    
    const userPp = await getUserProfilePic(sock, sender);    
    const accText = `💳 *كَـشْـفُ الحِـسَـابِ:* \n> رصيدك: *${userPoints[sender]} نقطة*`;    
    try { 
        try {
            await sendBotMessage(sock, from, { image: { url: userPp }, caption: accText, mentions: [sender] }); 
        } catch (err) {
            await sendBotMessage(sock, from, { text: accText, mentions: [sender] });
        }
    } catch (e) { 
        await sendBotMessage(sock, from, { text: accText }); 
    }    
    return;    
}    

if (cmdBase === 'مكافأة' || cmd === 'هدية') {    
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    if (!dailyRewards[sender]) dailyRewards[sender] = 0;
    if ((now - dailyRewards[sender]) < cooldown) {
        return sendBotMessage(sock, from, { text: `⚠️ لقد استلمت مكافأتك اليومية مسبقاً!`, mentions: [sender] });
    }
    dailyRewards[sender] = now;
    getBankAccount(sender);
    userPoints[sender] += 20;

    const rewardText = `╭━━━〔 🎁 〕━━━╮\n『 الـمُـكَـافَـأَةُ الـيَـوْمِـيَّـة 』\n╰━━━〔 ⚜️ 〕━━━╯\n\n«👤 ⌯ العضو @${sender.split('@')[0]}\n💰 ⌯ المكافأة 20 نقطة\n✨ ⌯ الحالة تم استلام المكافأة بنجاح»\n\n❐═━━━═╊⊰🍷⊱╉═━━━═❐\n\n『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』`;
    return sendBotMessage(sock, from, { text: rewardText, mentions: [sender] });
}

};

// معالجة كل الرسائل الواصلة معاً (واتساب قد يرسل عدة رسائل في دفعة واحدة) وبشكل متوازٍ
sock.ev.on('messages.upsert', (m) => {
    if (!m.messages || m.messages.length <= 1) { onUpsert(m).catch(e => console.error('خطأ في معالجة الرسالة:', e?.message || e)); return; }
    for (const one of m.messages) onUpsert({ ...m, messages: [one] }).catch(e => console.error('خطأ في معالجة الرسالة:', e?.message || e));
});

}

startBot();
initSubBots(startBot);
