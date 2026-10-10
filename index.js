import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';

process.on('uncaughtException', (err) => console.log('خطأ:', err));
process.on('unhandledRejection', (err) => console.log('خطأ معالجة:', err));

const DEVELOPER_NUMBER = '962796163926'; 
const DEVELOPER_NAME = '𝐄𝐫𝐞𝐧';
let extraDevelopers = []; 
let botLogs = []; 

function logBotAction(action) {
    const time = new Date().toLocaleTimeString('ar-EG');
    botLogs.unshift(`> 🔹 *[${time}]* ↞${action}`);
    if (botLogs.length > 20) botLogs.pop();
}

let userPoints = {}, userWarnings = {};
let bankAccounts = {}; 
let activeGames = {}; 
let dailyRewards = {}; 
let mutedUsers = {}; 

let groupSettings = {}; 

let commandReactionEnabled = true;
let commandReactionEmoji = '⚡';

let devReactionEnabled = true;
let devReactionEmoji = '👑';

const badWords = [
    'منيك', 'شرموط', 'قحبه', 'قحبة', 'كس', 'عرض', 'عرص', 'منيوك', 'منيوكة', 
    'عرصه', 'متناك', 'شرموطه', 'قحاب', 'عاهر', 'عاهره', 'ديوث', 'خول', 'قحط', 
    'منيكة', 'عرصات', 'ابن القحبة', 'ابن الكلب'
];

const gamesData = {
    disassemble: [
        { word: 'ناروتو', answer: 'ن ا ر و ت و' },
        { word: 'ايرين ييغر', answer: 'ا ي ر n  y ي غ ر' },
        { word: 'لوفي', answer: 'ل و ف ي' },
        { word: 'ساكاتا غينتوكي', answer: 'س ا ك ا ت ا  غ ي ن ت و ك ي' },
        { word: 'ليجاشي', answer: 'ل ي ج ا ش ي' },
        { word: 'كانيشي', answer: 'ك ا ن ي ش ي' },
        { word: 'تنجيرو', answer: 'ت ن ج ي ر و' }
    ],
    typing: [
        'ناروتو أوزوماكي',
        'ايرين ييغر',
        'مونكي لوفي',
        'رورونوا زورو',
        'سكاتا غينتوكي',
        'هجوم العمالقة',
        'ون بيس الأسطوري'
    ],
    riddles: [
        { question: 'من هو الشخصية التي تمتلك قوة العمالقة المؤسس وتتعهد بتحرير شعبها؟', answer: 'ايرين' },
        { question: 'ما هو اسم الفيلق الذي يخرج خارج الأسوار استكشافاً في انمي هجوم العمالقة؟', answer: 'فيلق الاستطلاع' },
        { question: 'من هو السياف المعرّف بأنه أقوى جزار في البشرية بانمي اتاك اون تايتن؟', answer: 'ليفاي' },
        { question: 'ما اسم السيف الذي يستخدمه زورو في ون بيس وعادة يضعه بفمه؟', answer: 'واتودو' }
    ],
    wouldYouRather: [
        { question: 'لو خيروك: تنضم لفيلق الاستطلاع 🐎 أو تنضم لفيلق الشرطة العسكرية 🛡️؟' },
        { question: 'لو خيروك: تعيش في عالم هجوم العمالقة ⚔️ أو عالم ون بيس 🏴‍☠️؟' },
        { question: 'لو خيروك: تمتلك قوة العملاق المهاجم 🔥 أو عملاق الفك 🦷؟' }
    ],
    quotes: [
        '“الناس لا يستطيعون رؤية ما هو أبعد من مصالحهم الشخصية.” - إيرين ييغر',
        '“إن لم تقاتل، فلن تفوز بشيء أبداً!” - إيرين ييغر',
        '“الوحيدون الذين يمكنهم فعل شيء هم من يتخلون عن إنسانيتهم.” - آرمين آرليرت',
        '“الموت ليس نهاية المطاف، بل النسيان هو الموت الحقيقي.”'
    ]
};

const validCommands = [
    'كشف', 'الكاشف',
    'تفاعل', 'تفاعل_مطور', 'اعطاء', 'إعطاء', 'اذاعة', 'إذاعة', 'ريستارت', 'اعادة_تشغيل', 'حذف', 'مسح', 'كتم', 'الغاء_كتم', 'فك_كتم',
    'خاص', 'عام', 'وضع_خاص', 'وضع_عام', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تفعيل', 'توقيف',
    'قفل', 'غلق', 'فتح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد',
    'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط',
    'حظر_رابط', 'سماح_رابط', 'حظر_سب', 'سماح_سب', 'حظر_جهات', 'حظر_جهات_الاتصال', 'سماح_جهات', 'سماح_جهات_الاتصال',
    'صفر', 'بوت', 'الاوامر', 'اوامر', 'منيو', 'اقسام',
    '1', '2', '3', '4', '5', '6',
    'الترفيه', 'العاب', 'فعاليات', 'bank', 'البنك', 'النقاط',
    'متجر', 'المتجر', 'شراء', 'بنك', 'حسابي', 'مكافأة', 'هدية',
    'حجرة', 'حجر', 'توقع', 'تحويل', 'توب_نقاط', 'الاغنياء', 'الأغنياء',
    'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'لوخيروك', 'حكمة',
    'المطور', 'مطور', 'انسحب',
    'اضافة_مطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار',
    'اضف_انذار', 'ازل_انذار', 'عدد_الانذارات',
    'حظر رابط', 'سماح رابط', 'حظر سب', 'سماح سب', 'حظر جهات', 'سماح جهات'
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

function startNextSameGame(from, sock, gameType) {
    if (activeGames[from] && activeGames[from].timer) {
        clearTimeout(activeGames[from].timer);
    }

    let timeoutSeconds = 30; 
    if (gameType === 'riddle') timeoutSeconds = 120; 

    const timer = setTimeout(async () => {
        if (activeGames[from]) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت!* لم يقم أحد بالإجابة في الوقت المحدد.` });
        }
    }, timeoutSeconds * 1000);

    if (gameType === 'disassemble') {
        const item = gamesData.disassemble[Math.floor(Math.random() * gamesData.disassemble.length)];
        sock.sendMessage(from, { text: `🧩 *تفكيك أنمي (معاك 30 ثانية):*\n\nفكك اسم الشخصية التالية بسرعة (ضع مسافات):\n\n👉 *${item.word}*` }).then(sent => {
            activeGames[from] = { type: 'disassemble', answer: item.answer, timer: timer, msgId: sent.key.id };
        });
    } else if (gameType === 'typing') {
        const textToType = gamesData.typing[Math.floor(Math.random() * gamesData.typing.length)];
        sock.sendMessage(from, { text: `✍️ *سرعة كتابة (معاك 30 ثانية):*\n\nاكتب الكلمة التالية بدقة:\n\n👉 *${textToType}*` }).then(sent => {
            activeGames[from] = { type: 'typing', answer: textToType, timer: timer, msgId: sent.key.id };
        });
    } else if (gameType === 'riddle') {
        const riddle = gamesData.riddles[Math.floor(Math.random() * gamesData.riddles.length)];
        sock.sendMessage(from, { text: `💡 *حزورة أنمي (معاك دقيقتين):*\n\n${riddle.question}\n\nاكتب إجابتك مباشرة في الشات!` }).then(sent => {
            activeGames[from] = { type: 'riddle', answer: riddle.answer, timer: timer, msgId: sent.key.id };
        });
    }
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
            botMode: 'public' 
        };
    }
    return groupSettings[groupId];
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
        }, 4000);
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
                    const welcomeMsg = `👋 *أهلاً بك يا أسطورة في الجروب!* @${user.split('@')[0]}\n✨ نورتنا، نتمنى لك وقتاً ممتعاً معنا في عالم الأنمي والفعاليات.`;
                    await sock.sendMessage(id, { image: { url: userPp }, caption: welcomeMsg, mentions: [user] });
                }
            } else if (action === 'remove' && settings.goodbye) {
                for (let user of participants) {
                    const goodbyeMsg = `👋 *غادرنا العضو:* @${user.split('@')[0]}\n🖤 نتمنى له التوفيق في رحلته القادمة.`;
                    await sock.sendMessage(id, { text: goodbyeMsg, mentions: [user] });
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

        if (isSenderExtraDev && devReactionEnabled) {
            try {
                await sock.sendMessage(from, { react: { text: devReactionEmoji, key: msg.key } });
            } catch (e) {}
        }

        // --- نظام الحماية المتكامل (إنذار مع كل مخالفة وإغلاق الشات تلقائياً) ---
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

        // --- معالجة الفعاليات حصراً بالريبلاي والتحقق من الإجابة ---
        if (activeGames[from]) {
            const game = activeGames[from];
            if (trimmedBody === '.انسحب' || lowerBody === 'انسحاب') {
                clearTimeout(game.timer);
                delete activeGames[from];
                return sock.sendMessage(from, { text: `🚪 *تم إلغاء الفعالية بنجاح!*`, mentions: [sender] });
            }
            
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
                        delete activeGames[from];
                        await sock.sendMessage(from, { text: `🎉 *إجابة صحيحة يا أسطورة!* @${sender.split('@')[0]}\n💰 *كسبت 10 نقاط!*`, mentions: [sender] });
                        setTimeout(() => startNextSameGame(from, sock, type), 1000);
                        return;
                    } else {
                        await sock.sendMessage(from, { text: `❌ إجابة خاطئة @${sender.split('@')[0]} أنت فاشل`, mentions: [sender] }, { quoted: msg });
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

        if (isGroup && mutedUsers[from] && mutedUsers[from][sender]) {
            if (mutedUsers[from][sender] > Date.now()) {
                try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                return;
            } else {
                delete mutedUsers[from][sender];
            }
        }

        const groupSettingsForCheck = getGroupSetting(from);
        if (groupSettingsForCheck.botMode === 'private' && !isSenderDev) {
            return;
        }

        if (cmdBase === 'حظر_رابط' || cmd === 'حظر رابط') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).antiLink = true;
            return sock.sendMessage(from, { text: '🟢 تم تفعيل حماية الروابط وإعطاء إنذار وإغلاق الشات تلقائياً عند المخالفة.' });
        }

        if (cmdBase === 'سماح_رابط' || cmd === 'سماح رابط') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).antiLink = false;
            return sock.sendMessage(from, { text: '🔴 تم إيقاف حماية الروابط في هذه المجموعة.' });
        }

        if (cmdBase === 'حظر_سب' || cmd === 'حظر سب') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).antiBadWords = true;
            return sock.sendMessage(from, { text: '🟢 تم تفعيل حماية الشتائم وإعطاء إنذار وإغلاق الشات تلقائياً عند المخالفة.' });
        }

        if (cmdBase === 'سماح_سب' || cmd === 'سماح سب') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).antiBadWords = false;
            return sock.sendMessage(from, { text: '🔴 تم إيقاف حماية الشتائم في هذه المجموعة.' });
        }

        if (cmdBase === 'حظر_جهات' || cmd === 'حظر جهات') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).antiContact = true;
            return sock.sendMessage(from, { text: '🟢 تم تفعيل حماية جهات الاتصال وإعطاء إنذار وإغلاق الشات تلقائياً عند المخالفة.' });
        }

        if (cmdBase === 'سماح_جهات' || cmd === 'سماح جهات') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).antiContact = false;
            return sock.sendMessage(from, { text: '🔴 تم إيقاف حماية جهات الاتصال في هذه المجموعة.' });
        }

        if (cmd === 'تفعيل ادمن') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).adminOnly = true;
            return sock.sendMessage(from, { text: '🟢 تم تفعيل وضع الآدمن في الأوامر.' });
        }

        if (cmd === 'توقيف ادمن') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).adminOnly = false;
            return sock.sendMessage(from, { text: '🔴 تم إيقاف وضع الآدمن في الأوامر.' });
        }

        if (cmd === 'تفعيل ترحيب') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).welcome = true;
            return sock.sendMessage(from, { text: '🟢 تم تفعيل رسائل الترحيب.' });
        }

        if (cmd === 'توقيف ترحيب') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).welcome = false;
            return sock.sendMessage(from, { text: '🔴 تم إيقاف رسائل الترحيب.' });
        }

        if (cmd === 'تفعيل توديع') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).goodbye = true;
            return sock.sendMessage(from, { text: '🟢 تم تفعيل رسائل التوديع.' });
        }

        if (cmd === 'توقيف توديع') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            getGroupSetting(from).goodbye = false;
            return sock.sendMessage(from, { text: '🔴 تم إيقاف رسائل التوديع.' });
        }

        if (cmd.startsWith('تغيير_الاسم')) {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            const newName = trimmedBody.replace(/^\.تغيير_الاسم/i, '').trim();
            if (!newName) return sock.sendMessage(from, { text: '📌 يرجى كتابة الاسم الجديد.' });
            try {
                await sock.groupUpdateSubject(from, newName);
                return sock.sendMessage(from, { text: `✅ تم تغيير اسم المجموعة بنجاح إلى: *${newName}*` });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل تغيير اسم المجموعة تأكد من أن البوت مشرف.' });
            }
        }

        if (cmd.startsWith('تغيير_الوصف')) {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            const newDesc = trimmedBody.replace(/^\.تغيير_الوصف/i, '').trim();
            if (!newDesc) return sock.sendMessage(from, { text: '📌 يرجى كتابة الوصف الجديد.' });
            try {
                await sock.groupUpdateDescription(from, newDesc);
                return sock.sendMessage(from, { text: `✅ تم تغيير وصف المجموعة بنجاح!` });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل تغيير وصف المجموعة تأكد من أن البوت مشرف.' });
            }
        }

        if (cmd === 'رابط_الجروب' || cmd === 'الرابط') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            try {
                const code = await sock.groupInviteCode(from);
                return sock.sendMessage(from, { text: `🔗 *رابط دعوة المجموعة:* \nhttps://chat.whatsapp.com/${code}` });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل جلب رابط المجموعة تأكد من أن البوت مشرف.' });
            }
        }

        if (cmd.startsWith('شراء')) {
            getBankAccount(sender);
            let cost = 30;
            if (userPoints[sender] < cost) {
                return sock.sendMessage(from, { text: `❌ رصيدك الحالي (${userPoints[sender]} نقطة) لا يكفي لإتمام عملية الشراء!` });
            }
            userPoints[sender] -= cost;
            return sock.sendMessage(from, { text: `✅ *تمت عملية الشراء بنجاح!* @${sender.split('@')[0]}\n🎁 تم خصم التكلفة من رصيدك البنكي.`, mentions: [sender] });
        }

        if (cmdBase === 'تفاعل') {
            const parts = trimmedBody.split(' ');
            if (parts.length < 3) {
                return sock.sendMessage(from, { text: `📌 *طريقة الاستخدام الصحيحة:*\n\`.تفاعل ⚡ تفعيل\` أو \`.تفاعل ⚡ ايقاف\`` });
            }
            const emoji = parts[1];
            const stateArg = parts[2].toLowerCase();

            commandReactionEmoji = emoji;
            if (stateArg === 'تفعيل' || stateArg === 'تشغيل') {
                commandReactionEnabled = true;
                return sock.sendMessage(from, { text: `🟢 تم تفعيل تفاعل أوامر الأعضاء بالإيموجي: ${emoji}` });
            } else if (stateArg === 'ايقاف' || stateArg === 'وقف') {
                commandReactionEnabled = false;
                return sock.sendMessage(from, { text: `🔴 تم إيقاف تفاعل أوامر الأعضاء.` });
            }
        }

        if (cmdBase === 'تفاعل_مطور') {
            const parts = trimmedBody.split(' ');
            if (parts.length < 3) {
                return sock.sendMessage(from, { text: `📌 *طريقة الاستخدام الصحيحة:*\n\`.تفاعل_مطور 👑 تفعيل\` أو \`.تفاعل_مطور 👑 ايقاف\`` });
            }
            const emoji = parts[1];
            const stateArg = parts[2].toLowerCase();

            devReactionEmoji = emoji;
            if (stateArg === 'تفعيل' || stateArg === 'تشغيل') {
                devReactionEnabled = true;
                return sock.sendMessage(from, { text: `🟢 تم تفعيل التفاعل التلقائي لرسائل المطور بالإيموجي: ${emoji}` });
            } else if (stateArg === 'ايقاف' || stateArg === 'وقف') {
                devReactionEnabled = false;
                return sock.sendMessage(from, { text: `🔴 تم إيقاف التفاعل التلقائي لرسائل المطور.` });
            }
        }

        if (cmdBase === 'اضافة_مطور') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين فقط!' });
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            const targetUser = mentioned && mentioned[0] ? mentioned[0] : null;
            
            if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص المراد إضافته كمطور. مثال: `.اضافة_مطور @منشن`' });
            
            const targetNum = targetUser.replace(/[^0-9]/g, '');
            if (extraDevelopers.includes(targetNum)) {
                return sock.sendMessage(from, { text: `⚠️ العضو @${targetUser.split('@')[0]} مضاف مسبقاً في قائمة المطورين!`, mentions: [targetUser] });
            }
            extraDevelopers.push(targetNum);
            return sock.sendMessage(from, { text: `✅ تمت إضافته كـ مطور بنجاح: @${targetUser.split('@')[0]} وأصبح يعامل معاملة المطورين بالكامل!`, mentions: [targetUser] });
        }

        if (cmdBase === 'حذف_مطور') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين فقط!' });
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            const targetUser = mentioned && mentioned[0] ? mentioned[0] : null;

            if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للمطور المراد إزالته. مثال: `.حذف_مطور @منشن`' });

            const targetNum = targetUser.replace(/[^0-9]/g, '');
            const index = extraDevelopers.indexOf(targetNum);
            if (index > -1) {
                extraDevelopers.splice(index, 1);
                return sock.sendMessage(from, { text: `❌ تم إزالة العضو @${targetUser.split('@')[0]} من قائمة المطورين بنجاح.`, mentions: [targetUser] });
            } else {
                return sock.sendMessage(from, { text: `⚠️ هذا العضو ليس موجوداً في قائمة المطورين الإضافيين.` });
            }
        }

        if (cmdBase === 'اختبار') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين فقط!' });
            
            let report = `🧪 *تَقْرِيرُ فَحْصِ وَاخْتِبَارِ قَائِمَةِ الأَوَامِرِ:*\n\n`;
            validCommands.forEach((c) => {
                report += `> • الأمر \`${c}\` : مفعل 🟢\n`;
            });

            return sock.sendMessage(from, { text: report });
        }

        if (cmdBase === 'سجل_البوت') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين فقط!' });
            
            let logText = `📡 *سِـجِـلُّ عَـمَـلِـيَّـاتِ الـبُـوتِ الأَخِـيـرَةِ:*\n\n`;
            if (botLogs.length === 0) {
                logText += `> 📌 لا توجد عمليات مسجلة حتى الآن.`;
            } else {
                logText += botLogs.join('\n');
            }

            const userPp = await getUserProfilePic(sock, sender);
            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: logText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: logText });
            }
            return;
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

        if (cmdBase === 'تفكيك') { startNextSameGame(from, sock, 'disassemble'); return; }
        if (cmdBase === 'كتابه' || cmdBase === 'كتابة') { startNextSameGame(from, sock, 'typing'); return; }
        if (cmdBase === 'حزورة' || cmdBase === 'لغز') { startNextSameGame(from, sock, 'riddle'); return; }
        if (cmdBase === 'خيروك' || cmdBase === 'لوخيروك') {
            const item = gamesData.wouldYouRather[Math.floor(Math.random() * gamesData.wouldYouRather.length)];
            return sock.sendMessage(from, { text: `❓ *لعبة لو خيروك:*\n\n${item.question}` });
        }
        if (cmdBase === 'حكمة') {
            const quote = gamesData.quotes[Math.floor(Math.random() * gamesData.quotes.length)];
            return sock.sendMessage(from, { text: `📜 *حكمة / مقولة أسطورية:*\n\n${quote}` });
        }

        if (cmdBase === 'توب_نقاط' || cmdBase === 'الاغنياء' || cmdBase === 'الأغنياء') {
            const sortedUsers = Object.keys(userPoints).sort((a, b) => (userPoints[b] || 0) - (userPoints[a] || 0)).slice(0, 5);
            let topText = `🏆 *قَـائِـمَـةُ أَثْـرَى أَعْـضَـاءِ الـبَـنْكِ (${DEVELOPER_NAME} 𝐁𝐨𝐭):*\n\n`;
            if (sortedUsers.length === 0) {
                topText += `> لا توجد أرصدة مسجلة حتى الآن!`;
            } else {
                sortedUsers.forEach((u, index) => {
                    topText += `${index + 1}. @${u.split('@')[0]} ↞ *${userPoints[u]} نقطة*\n`;
                });
            }
            return sock.sendMessage(from, { text: topText, mentions: sortedUsers });
        }

        if (cmdBase === 'تحويل') {
            const parts = trimmedBody.split(' ');
            const amount = parseInt(parts[1]);
            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

            if (isNaN(amount) || amount <= 0 || !targetUser) {
                return sock.sendMessage(from, { text: '📌 *طريقة الاستخدام الصحيحة:*\n\n`.تحويل <المبلغ> @منشن`' });
            }
            getBankAccount(sender);
            getBankAccount(targetUser);

            if ((userPoints[sender] || 0) < amount) {
                return sock.sendMessage(from, { text: `❌ عذراً، رصيدك الحالي (${userPoints[sender] || 0}) لا يكفي لإتمام عملية التحويل!` });
            }

            userPoints[sender] -= amount;
            userPoints[targetUser] += amount;

            return sock.sendMessage(from, { text: `✅ تم تحويل مبلغ *${amount} نقطة* بنجاح إلى العضو @${targetUser.split('@')[0]}!`, mentions: [targetUser] });
        }

        if (cmdBase === 'قائمة_المطورين') {
            let listText = `📋 *قَـائِـمَـةُ الـمُـطَـوِّرِيـنَ:* \n\n`;
            listText += `1. المطور الأساسي: \`${DEVELOPER_NUMBER}\`\n`;
            if (extraDevelopers.length === 0) {
                listText += `> لا يوجد مطورين إضافيين حالياً.`;
            } else {
                extraDevelopers.forEach((dev, idx) => {
                    listText += `${idx + 2}. \`${dev}\`\n`;
                });
            }
            return sock.sendMessage(from, { text: listText });
        }

        if (cmdBase === 'خاص' || cmdBase === 'وضع_خاص') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط للمشرفين والمطور!' });
            getGroupSetting(from).botMode = 'private';
            return sock.sendMessage(from, { text: '🔒 *تم تفعيل الوضع الخاص لهذه المجموعة فقط (المطور والمشرفون)*\n> ملاحظة: أوامر الحماية تظل تعمل وتراقب الجميع بشكل طبيعي.' });
        }

        if (cmdBase === 'عام' || cmdBase === 'وضع_عام') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط للمشرفين والمطور!' });
            getGroupSetting(from).botMode = 'public';
            return sock.sendMessage(from, { text: '🔓 *تم تفعيل الوضع العام لهذه المجموعة (البوت متاح للجميع)*' });
        }

        if (cmdBase === 'اعطاء' || cmdBase === 'إعطاء') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين فقط!' });
            const parts = trimmedBody.split(' ');
            const amount = parseInt(parts[1]);
            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

            if (isNaN(amount) || !targetUser) {
                return sock.sendMessage(from, { text: '📌 *الاستخدام:* `.اعطاء 1000 @منشن`' });
            }
            getBankAccount(targetUser);
            userPoints[targetUser] = (userPoints[targetUser] || 0) + amount;
            return sock.sendMessage(from, { text: `✅ تم إضافة ${amount} نقطة لحساب @${targetUser.split('@')[0]} بنجاح!`, mentions: [targetUser] });
        }

        if (cmdBase === 'اذاعة' || cmdBase === 'إذاعة') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين فقط!' });
            const bcText = trimmedBody.replace(/^\.(اذاعة|إذاعة)/i, '').trim();
            if (!bcText) return sock.sendMessage(from, { text: '📌 اكتب النص المراد إذاعته.' });

            try {
                const groups = Object.keys(await sock.groupFetchAllParticipating());
                for (let gId of groups) {
                    await sock.sendMessage(gId, { text: `📢 *إِذَاعَةٌ عَامَّةٌ مِنْ المـُطَوِّرِ ${DEVELOPER_NAME}:* \n\n${bcText}` });
                }
                return sock.sendMessage(from, { text: `✅ تم إرسال الإذاعة إلى ${groups.length} مجموعة.` });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ حدث خطأ أثناء الإذاعة.' });
            }
        }

        if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطورين فقط!' });
            await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' });
            process.exit(0);
        }

        if (cmdBase === 'حذف' || cmdBase === 'مسح') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط لمشرفي المجموعة!' });
            const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
            if (!quotedMsgInfo) return sock.sendMessage(from, { text: '📌 قم بالرد على الرسالة المراد حذفها باستخدام الأمر `.حذف`' });
            try {
                const key = {
                    remoteJid: from,
                    id: quotedMsgInfo.stanzaId,
                    participant: quotedMsgInfo.participant
                };
                await sock.sendMessage(from, { delete: key });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل حذف الرسالة.' });
            }
            return;
        }

        if (cmdBase === 'كتم') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط لمشرفي الجروب والمطور!' });

            const parts = trimmedBody.split(' ');
            const minutes = parseInt(parts[1]);
            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

            if (isNaN(minutes) || !targetUser) {
                return sock.sendMessage(from, { text: '📌 *طريقة الاستخدام الصحيحة:*\n\n`.كتم <عدد الدقائق> @منشن`\nمثال: `.كتم 2 @عضو`' });
            }

            if (!mutedUsers[from]) mutedUsers[from] = {};
            const muteDurationMs = minutes * 60 * 1000;
            mutedUsers[from][targetUser] = Date.now() + muteDurationMs;

            return sock.sendMessage(from, { 
                text: `🔇 *تم كتم العضو @${targetUser.split('@')[0]} بنجاح لمدة ${minutes} دقيقة في هذه المجموعة!*`, 
                mentions: [targetUser] 
            });
        }

        if (cmdBase === 'الغاء_كتم' || cmdBase === 'فك_كتم') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط لمشرفي الجروب والمطور!' });

            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetUser) {
                return sock.sendMessage(from, { text: '📌 *طريقة الاستخدام الصحيحة:*\n\n`.الغاء_كتم @عضو`' });
            }

            if (mutedUsers[from] && mutedUsers[from][targetUser]) {
                delete mutedUsers[from][targetUser];
            }

            return sock.sendMessage(from, { 
                text: `🔊 *تم إلغاء الكتم عن العضو @${targetUser.split('@')[0]} بنجاح!*`, 
                mentions: [targetUser] 
            });
        }

        if (cmdBase === 'قفل' || cmdBase === 'غلق') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط للمشرفين!' });
            try {
                await sock.groupSettingUpdate(from, 'announcement');
                return sock.sendMessage(from, { text: '🔒 تم قفل المجموعة!' });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل القفل.' });
            }
        }

        if (cmdBase === 'فتح') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط للمشرفين!' });
            try {
                await sock.groupSettingUpdate(from, 'not_announcement');
                return sock.sendMessage(from, { text: '🔓 تم فتح المجموعة!' });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل الفتح.' });
            }
        }

        if (cmdBase === 'الكل' || cmdBase === 'منشن') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط للمشرفين والمطور!' });

            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants;
                let mentions = [];
                let text = `📢 *نداء إداري لجميع الأعضاء:*\n\n`;

                for (let mem of participants) {
                    text += `@${mem.id.split('@')[0]} \n`;
                    mentions.push(mem.id);
                }

                return sock.sendMessage(from, { text: text, mentions: mentions });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ حدث خطأ أثناء تنفيذ المنشن الجماعي.' });
            }
        }

        if (cmdBase === 'رفع' || cmdBase === 'ترقية') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط لآدمنز الجروب والمطور!' });

            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للمستخدم، مثال: *.رفع @عضو*' });

            try {
                await sock.groupParticipantsUpdate(from, [targetUser], 'promote');
                return sock.sendMessage(from, { text: `👑 تم رفع @${targetUser.split('@')[0]} مشرفاً بنجاح!`, mentions: [targetUser] });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل رفع العضو.' });
            }
        }

        if (cmdBase === 'ازل' || cmdBase === 'تنزيل') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط لآدمنز الجروب والمطور!' });

            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للمشرف، مثال: *.ازل @عضو*' });

            try {
                await sock.groupParticipantsUpdate(from, [targetUser], 'demote');
                return sock.sendMessage(from, { text: `📉 تم تنزيل @${targetUser.split('@')[0]} من الإشراف.`, mentions: [targetUser] });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشل تنزيل العضو.' });
            }
        }

        if (cmdBase === 'طرد') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ هذا الأمر متاح فقط لآدمنز الجروب والمطور!' });

            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للعضو، مثال: *.طرد @عضو*' });

            try {
                await sock.groupParticipantsUpdate(from, [targetUser], 'remove');
                return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]} بنجاح!`, mentions: [targetUser] });
            } catch (e) {
                return sock.sendMessage(from, { text: '❌ فشلت عملية الطرد.' });
            }
        }

        if (cmdBase === 'اضف_انذار') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للعضو لإضافة إنذار له.' });
            if (!userWarnings[targetUser]) userWarnings[targetUser] = 0;
            userWarnings[targetUser]++;
            if (userWarnings[targetUser] >= 3) {
                await sock.sendMessage(from, { text: `🚨 تم طرد العضو @${targetUser.split('@')[0]} لتجاوزه 3 إنذارات إدارية!`, mentions: [targetUser] });
                await sock.groupParticipantsUpdate(from, [targetUser], 'remove');
                userWarnings[targetUser] = 0;
            } else {
                await sock.sendMessage(from, { text: `⚠️ تم إضافة إنذار للعضو @${targetUser.split('@')[0]} (الإنذارات الحالية: ${userWarnings[targetUser]}/3)`, mentions: [targetUser] });
            }
            return;
        }

        if (cmdBase === 'ازل_انذار' || cmdBase === 'صفر') {
            if (!isSenderAdmin && !isSenderDev) return sock.sendMessage(from, { text: '❌ متاح للمشرفين والمطور فقط!' });
            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للعضو لإزالة إنذار عنه.' });
            userWarnings[targetUser] = 0;
            return sock.sendMessage(from, { text: `✅ تم تصفير إنذارات العضو @${targetUser.split('@')[0]} بنجاح.`, mentions: [targetUser] });
        }

        if (cmdBase === 'عدد_الانذارات') {
            const targetUser = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender;
            const warns = userWarnings[targetUser] || 0;
            return sock.sendMessage(from, { text: `📊 عدد إنذارات العضو @${targetUser.split('@')[0]} هو: *${warns} / 3*`, mentions: [targetUser] });
        }

        if (cmdBase === 'بوت') {
            const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            const botWelcomeText = `🍷 *أَهْـلاً بِـكَ فِي عَالَمِ ${DEVELOPER_NAME} 𝐁𝐨𝐭* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}
> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> ┃ ⌯👨🏻‍💻︙الــمـطـور → ${DEVELOPER_NAME} (${DEVELOPER_NUMBER})
> ┃ 
> ┃ ♟️ *"الهيبةُ ليستْ بصَخبِ الـحُضور،*
> ┃ *بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى."*
> ┃ ✦ لا نَسْعَى خَلْفَ الأَضْوَاءِ.. بَلْ نَدَعُ النَّتَائِجَ هِيَ مَنْ تَتَكَلَّمُ.
> ┃ 
> ┃ ⌯🚀︙الـتـوقـيـت → ${time}

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

⚙️ *لِـعَـرْضِ كَـافَّـةِ أَقْـسَـامِ الأَوَامِـرِ وَالإِدَارَةِ:*
اكتب الأمر: 👇

📌 *.الاوامر*  أو  *.اقسام*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*`;

            const botPp = await getBotProfilePic(sock);

            try {
                await sock.sendMessage(from, { 
                    image: { url: botPp }, 
                    caption: botWelcomeText, 
                    mentions: [sender] 
                });
            } catch (e) {
                await sock.sendMessage(from, { text: botWelcomeText, mentions: [sender] });
            }
            return;
        }

        if (cmdBase === 'الاوامر' || cmd === 'اوامر' || cmd === 'منيو' || cmd === 'اقسام') {
            const menuText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ:*
> 🛡️ \`.1\` ↞ الحماية والأمن
> 🎉 \`.2\` ↞ الترفيه والألعاب والفعاليات
> 💳 \`.3\` ↞ البنك والنقاط ومتجر
> ♟️ \`.4\` ↞ المطور
> ⚡ \`.5\` ↞ الإدارة
> 🔍 \`.6\` ↞ الكاشف

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

💡 *اكتب رقم القسم أو الكلمة المفتاحية للوصول السريع!*`;

            const devPp = await getDeveloperProfilePic(sock);

            try {
                await sock.sendMessage(from, { 
                    image: { url: devPp }, 
                    caption: menuText,
                    mentions: [sender]
                });
            } catch (e) {
                await sock.sendMessage(from, { text: menuText });
            }
            return;
        }

        if (cmdBase === '1') {
            const settings = getGroupSetting(from);
            const userPp = await getUserProfilePic(sock, sender);
            
            const text1 = `🛡️ *الحماية (لهذه المجموعة):*

🔗 *1. حماية الروابط:* [${settings.antiLink ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_رابط\` | إيقاف: \`.سماح_رابط\`

🤬 *2. حماية الشتائم وقذف المحصنات:* [${settings.antiBadWords ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_سب\` | إيقاف: \`.سماح_سب\`

📇 *3. حماية جهات الاتصال:* [${settings.antiContact ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_جهات\` | إيقاف: \`.سماح_جهات\`

⚙️ *لتصفير إنذارات أي عضو:* \`.صفر @العضو\``;

            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: text1, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: text1 });
            }
            return;
        }

        if (cmdBase === '2' || cmd === 'الترفيه' || cmd === 'العاب' || cmd === 'فعاليات') {
            const entAndGamesText = `🎮🎲 *قسم الترفيه والألعاب والفعاليات:*

> ❓ \`.خيروك\` ↞ أسئلة لو خيروك بين عوالم الأنمي
> 📜 \`.حكمة\` ↞ مقولة وحكمة أسطورية للأنمي
> 🧩 \`.تفكيك\` ↞ تفكيك اسم الأنمي (+10 نقاط) [⏳ الوقت: 30 ثانية]
> ✍️ \`.كتابه\` أو \`.كتابة\` ↞ سرعة كتابة الكلمة (+10 نقاط) [⏳ الوقت: 30 ثانية]
> 💡 \`.حزورة\` أو \`.لغز\` ↞ ألغاز وحزازير الأنمي (+10 نقاط) [⏳ الوقت: دقيقتين]
> ✊ \`.حجرة\` <حجر/ورقة/مقص> ↞ لعبة تحدي البوت [⚡ بلا وقت]
> 🔢 \`.توقع\` <رقم من 1 لـ 5> ↞ اختبر حظك واربح نقاط [⚡ بلا وقت]
> 🚪 \`.انسحب\` ↞ الانسحاب وإلغاء الفعالية الجارية في أي وقت.`;
            
            const userPp = await getUserProfilePic(sock, sender);
            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: entAndGamesText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: entAndGamesText });
            }
            return;
        }

        if (cmdBase === '3' || cmd === 'bank' || cmd === 'البنك' || cmd === 'النقاط') {
            const bankMenuText = `💳 *قسم البنك والنقاط ومتجر:*

> 💳 \`.بنك\` أو \`.حسابي\` ↞ كشف الحساب البنكي والمعرف الخاص
> 💸 \`.تحويل\` <المبلغ> @منشن ↞ تحويل نقاط لعضو آخر
> 🏆 \`.توب_نقاط\` ↞ قائمة أثرى 5 أعضاء
> 🎁 \`.مكافأة\` ↞ استلم هديتك اليومية (نقاط مجانية)
> 🛒 \`.متجر\` ↞ ✨ المتجر الأسطوري (شراء زخرفة، فيديوهات وملصقات بالنقاط)`;

            const userPp = await getUserProfilePic(sock, sender);
            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: bankMenuText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: bankMenuText });
            }
            return;
        }

        if (cmdBase === '4' || cmd === 'المطور' || cmd === 'مطور') {
            const devMenuText = `♟️ *قِـسْـمُ الـمُـطَـوِّرِ:*
> 👤 *اسم المطور:* ${DEVELOPER_NAME}
> 📱 *رقم المطور:* \`${DEVELOPER_NUMBER}\`

> 👑 \`.اضافة_مطور @منشن\` ↞ إضافة مطور جديد
> ❌ \`.حذف_مطور @منشن\` ↞ إزالة مطور
> 📋 \`.قائمة_المطورين\` ↞ عرض قائمة المطورين
> 📡 \`.سجل_البوت\` ↞ عرض آخر عمليات البوت
> 🧪 \`.اختبار\` ↞ اختبار وظائف البوت وفحص الاستجابة
> ❤️ \`.تفاعل\` ↞ التحكم بالتفاعل التلقائي لأوامر الأعضاء
> ❤️ \`.تفاعل_مطور\` ↞ التحكم بالتفاعل التلقائي لرسائل المطور
> 🔒 \`.خاص\` أو \`.وضع_خاص\` ↞ جعل البوت خاصاً للمطور والمشرفين
> 🔓 \`.عام\` أو \`.وضع_عام\` ↞ جعل البوت عاماً للجميع
> 💸 \`.اعطاء <المبلغ> @منشن\` ↞ إضافة نقاط لأي عضو
> 📢 \`.إذاعة <النص>\` ↞ إرسال رسالة لجميع المجموعات
> 🔄 \`.ريستارت\` ↞ إعادة تشغيل البوت.`;

            const userPp = await getUserProfilePic(sock, sender);
            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: devMenuText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: devMenuText });
            }
            return;
        }

        if (cmdBase === '5') {
            const adminMenuText = `⚡ *قِـسْـمُ الإِدَارَةِ وَالتَّحَكُّمِ:*

> 🔒 \`.قفل\` أو \`.غلق\` ↞ قفل الجروب (المشرفين فقط)
> 🔓 \`.فتح\` ↞ فتح الجروب للأعضاء
> 🗑️ \`.حذف\` ↞ حذف رسالة محددة (بالرد عليها)
> 📢 \`.الكل\` أو \`.منشن\` ↞ منشن جماعي لكل الأعضاء
> 👑 \`.رفع @عضو\` ↞ ترقية عضو إلى مشرف
> 📉 \`.تنزيل @عضو\` ↞ إزالة الإشراف عن عضو
> 🚨 \`.طرد @عضو\` ↞ طرد العضو من المجموعة
> ⚠️ \`.اضف_انذار @عضو\` ↞ إضافة إنذار إداري للعضو
> 📉 \`.ازل_انذار @عضو\` ↞ إزالة إنذار عن العضو
> 📊 \`.عدد_الانذارات @عضو\` ↞ عرض عدد الإنذارات الحالية
> 🔇 \`.كتم <دقائق> @عضو\` ↞ كتم العضو مؤقتاً
> 🔊 \`.الغاء_كتم @عضو\` ↞ فك الكتم عن العضو
> 📌 \`.تفعيل ادمن\` / \`.توقيف ادمن\` ↞ وضع الآدمن
> 👋 \`.تفعيل ترحيب\` / \`.توقيف ترحيب\` ↞ الترحيب بالجدد
> 📤 \`.تفعيل توديع\` / \`.توقيف توديع\` ↞ رسائل الخروج
> 🏷️ \`.تغيير_الاسم <الاسم>\` ↞ تغيير عنوان الجروب
> 📝 \`.تغيير_الوصف <الوصف>\` ↞ تغيير وصف الجروب
> 🔗 \`.الرابط\` ↞ إحضار رابط دعوة المجموعة
> 🔄 \`.صفر @عضو\` ↞ تصفير إنذارات العضو`;

            const userPp = await getUserProfilePic(sock, sender);
            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: adminMenuText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: adminMenuText });
            }
            return;
        }

        if (cmdBase === '6' || cmd === 'الكاشف') {
            const detectorMenuText = `🔍 *قِـسْـمُ الكاشف:*

هذا القسم مخصص لفك وكشف رسائل العرض لمرة واحدة (ViewOnce) بسهولة تامة.

📌 **كيفية الاستخدام:**
قم بالرد على أي رسالة مرسلة بنظام *(عرض مرة واحدة)* سواء كانت:
📸 *صورة*
🎥 *فيديو*
🎙️ *رسالة صوتية (فويس)*

ثم اكتب في الرد كلمة: 👇
> \`.كشف\`

✨ لكي يقوم البوت باستخراجها وإرسالها لك مباشرة في الشات بدون أن تختفي!`;

            const userPp = await getUserProfilePic(sock, sender);
            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: detectorMenuText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: detectorMenuText });
            }
            return;
        }

        if (cmdBase === 'متجر' || cmd === 'المتجر') {
            const storeText = `🛒 *مَـتْـجَرُ العَالَمِ الأُسْطُورِيِّ ${DEVELOPER_NAME} 𝐁𝐨𝐭* 🛒
*استخدم رصيدك ونقاطك المكتسبة من الفعاليات لشراء ما تحب!*

*❐═━━━═╊⊰ 🍷 ⊱╉═━━━═❐*

✍️ [ *1* ] **زخرفة نصوص فخمة (عربي / إنجليزي)**
> 💰 *السعر:* 20 نقطة
> 📌 *للطليب:* اكتب \`.شراء زخرفة <النص>\`

🎬 [ *2* ] **مقطع فيديو إيدت للأنمي**
> 💰 *السعر:* 50 نقطة
> 📌 *للطليب:* اكتب \`.شراء فيديو <اسم الشخصية>\`

🏷️ [ *3* ] **حزمة ملصقات (باك أنمي)**
> 💰 *السعر:* 40 نقطة
> 📌 *للطليب:* اكتب \`.شراء ملصقات <اسم الشخصية>\`

👑 [ *4* ] **لقب فخم خاص بملفك البنكي**
> 💰 *السعر:* 100 نقطة
> 📌 *للطليب:* اكتب \`.شراء لقب <اسم اللقب>\``;

            const userPp = await getUserProfilePic(sock, sender);
            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: storeText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: storeText });
            }
            return;
        }

        if (cmdBase === 'بنك' || cmd === 'حسابي') {
            const bankAcc = getBankAccount(sender);
            const userPp = await getUserProfilePic(sock, sender);
            const accText = `💳 *كَـشْـفُ الحِـسَـابِ البَـنْـكِـيِّ:*
> 👤 *صاحب الحساب:* @${sender.split('@')[0]}
> 🆔 *رقم الحساب:* \`${bankAcc.bankId}\`
> 📅 *تاريخ الإنشاء:* ${bankAcc.createdAt}
> 💰 *الرصيد الحالي:* *${userPoints[sender]} نقطة*`;

            try {
                await sock.sendMessage(from, { image: { url: userPp }, caption: accText, mentions: [sender] });
            } catch (e) {
                await sock.sendMessage(from, { text: accText, mentions: [sender] });
            }
            return;
        }

        if (cmdBase === 'مكافأة' || cmd === 'هدية') {
            const today = new Date().toLocaleDateString('ar-EG');
            if (!dailyRewards[sender]) dailyRewards[sender] = {};

            if (dailyRewards[sender] === today) {
                return sock.sendMessage(from, { text: `⚠️ لقد استلمت مكافأتك اليومية مسبقاً يا @${sender.split('@')[0]}! عُد غداً لاستلام مكافأة جديدة.`, mentions: [sender] });
            }

            dailyRewards[sender] = today;
            getBankAccount(sender);
            userPoints[sender] += 50;

            return sock.sendMessage(from, { text: `🎁 *تم تسليم المكافأة اليومية بنجاح!* @${sender.split('@')[0]}\n💰 تمت إضافة *50 نقطة* إلى رصيدك البنكي (رصيدك الحالي: ${userPoints[sender]})`, mentions: [sender] });
        }
    });
}

startBot();
