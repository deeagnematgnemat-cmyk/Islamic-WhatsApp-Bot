// ============ الأزرار التفاعلية مع استمارة .بوت (رسالة واحدة) ============
import * as baileysNs from '@whiskeysockets/baileys';

const B = (baileysNs.default && baileysNs.default.generateWAMessageFromContent) ? baileysNs.default : baileysNs;
const { generateWAMessageFromContent, prepareWAMessageMedia } = B;

// ===== تصميم موحّد لأسماء الأقسام والأزرار: 𓆩 𝑹𝑶𝒀𝑨𝑳 𓆪 ┊ الـمـطـوّر =====
const ROYAL_PREFIX = '𓆩 𝑹𝑶𝒀𝑨𝑳 𓆪 ┊ ';
const NON_JOIN = new Set('اأإآدذرزوؤةىء');
const isArLetter = (ch) => !!ch && /[\u0621-\u064A]/.test(ch);
function tatweel(str) {
    const chars = [...str];
    let out = '';
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        out += ch;
        if (!isArLetter(ch) || NON_JOIN.has(ch)) continue;
        let j = i + 1;
        while (j < chars.length && /[\u064B-\u065F\u0670]/.test(chars[j])) { out += chars[j]; i = j; j++; }
        const next = chars[j];
        if (!isArLetter(next)) continue;
        if (ch === 'ل' && 'اأإآ'.includes(next)) continue; // لا
        out += 'ـ';
    }
    return out;
}
export function royal(label) {
    const t = String(label || '').trim();
    if (!t || t.startsWith('𓆩')) return t;
    return ROYAL_PREFIX + tatweel(t.replace(/^[^\u0600-\u06FFA-Za-z0-9]+/, ''));
}

const CHANNEL_URL = 'https://whatsapp.com/channel/0029VbAyOwm3mFY0ohjZCB04';
const INSTALL_GROUP_URL = 'https://chat.whatsapp.com/DjgGvEAiIEiCXwztk4F82L?s=cl&p=a&mlu=4&ilr=4';

const row = (title, description, n) => ({ header: '', title, description, id: `.${n}` });

const SECTIONS = [
    {
        title: 'الأقسام الأساسية',
        rows: [
            row(royal('الحماية'), 'أوامر الحماية والإنذارات', 1),
            row(royal('الترفيه والألعاب'), 'أوامر الألعاب والفعاليات', 2),
            row(royal('البنك والنقاط'), 'الحساب والتحويل والمكافآت', 3),
            row(royal('القسم الإسلامي'), 'القرآن والأدعية والأذكار', 4),
            row(royal('الضحك'), 'النكت والتساؤلات والمقولات', 5),
            row(royal('المجموعات'), 'أوامر وتفاعلات المجموعة', 6)
        ]
    },
    {
        title: 'أقسام إضافية',
        rows: [
            row(royal('المطوّر'), 'أوامر المطور والنظام', 7),
            row(royal('الإدارة'), 'أوامر إدارة المجموعة', 8),
            row(royal('الكشف'), 'أوامر كشف الوسائط', 9),
            row(royal('الألقاب'), 'أوامر الألقاب', 10),
            row(royal('الملصقات'), 'ملصقات وتعديل الصور', 11),
            row(royal('التنصيب'), 'ربط بوت خاص بك', 12),
            row(royal('التنزيل'), 'يوتيوب وتيك توك وإنستا والمزيد', 13),
            row(royal('الذكاء الاصطناعي'), 'أسئلة وصور وترجمة', 14),
            row(royal('الصور'), 'جلب وتعديل الصور', 15),
            row(royal('الفرعي'), 'التحكم ببوتك المنصّب', 16)
        ]
    },
    {
        title: 'الأدوات',
        rows: [
            row(royal('الأدوات'), 'مواقيت الصلاة وحاسبة وعملات وطقس وزخرفة', 17)
        ]
    }
];

const BUTTONS = () => [
    { name: 'single_select', buttonParamsJson: JSON.stringify({ title: royal('الأقسام'), sections: SECTIONS }) },
    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: royal('قناة المطوّر'), url: CHANNEL_URL, merchant_url: CHANNEL_URL }) },
    { name: 'single_select', buttonParamsJson: JSON.stringify({ title: royal('المطوّر'), sections: [{ title: 'المطور', rows: [{ header: '', title: royal('المطوّر'), description: 'استمارة تعريفية بالمطور', id: '.devinfo_form' }] }] }) }
];

// مزوّد سياق إعادة التوجيه من القناة (يضبطه index.js) حتى تظهر رسائل الأزرار أيضاً «مُعاد توجيهها»
let forwardCtxProvider = null;
export function setForwardContextProvider(fn) { forwardCtxProvider = fn; }

async function relayInteractive(sock, jid, interactiveMessage, { noForward = false } = {}) {
    try {
        const fwd = (forwardCtxProvider && !noForward) ? await forwardCtxProvider(sock) : null;
        if (fwd) interactiveMessage = { ...interactiveMessage, contextInfo: { ...(interactiveMessage.contextInfo || {}), ...fwd } };
    } catch (e) {}
    const content = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage
            }
        }
    };
    const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
    const nodes = [{
        tag: 'biz', attrs: {},
        content: [{
            tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
        }]
    }];
    if (!jid.endsWith('@g.us')) nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: nodes });
}

// يرسل الاستمارة نفسها (فيديو + نص) ومعها الأزرار في رسالة واحدة
export async function sendFormWithButtons(sock, jid, text, videoUrl, mentionJid, isImage = false) {
    let header = { hasMediaAttachment: false };
    if (videoUrl) {
        try {
            const media = await prepareWAMessageMedia(isImage ? { image: { url: videoUrl } } : { video: { url: videoUrl } }, { upload: sock.waUploadToServer });
            if (isImage && media && media.imageMessage) header = { hasMediaAttachment: true, imageMessage: media.imageMessage };
            else if (!isImage && media && media.videoMessage) header = { hasMediaAttachment: true, videoMessage: media.videoMessage };
        } catch (e) {
            console.error('تعذر رفع فيديو الاستمارة، سيُرسل النص مع الأزرار:', e?.message || e);
        }
    }
    await relayInteractive(sock, jid, {
        header,
        body: { text },
        ...(mentionJid ? { contextInfo: { mentionedJid: [mentionJid] } } : {}),
        nativeFlowMessage: { buttons: BUTTONS() }
    }, { noForward: true });
}

// استمارة معلومات المطور: فيديو يعمل تلقائياً بشكل متكرر (مثل GIF) + زر «حساب المطور» يفتح الخاص مباشرة
export async function sendDevInfoWithButton(sock, jid, text, videoUrl, devUrl) {
    let header = { hasMediaAttachment: false };
    try {
        const media = await prepareWAMessageMedia({ video: { url: videoUrl }, mimetype: 'video/mp4', gifPlayback: true }, { upload: sock.waUploadToServer });
        if (media && media.videoMessage) header = { hasMediaAttachment: true, videoMessage: { ...media.videoMessage, gifPlayback: true } };
    } catch (e) {
        console.error('تعذر رفع فيديو معلومات المطور:', e?.message || e);
    }
    await relayInteractive(sock, jid, {
        header,
        body: { text },
        nativeFlowMessage: { buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: royal('حساب المطوّر'), url: devUrl, merchant_url: devUrl }) }] }
    }, { noForward: true });
}

// يقرأ رقم الصف الذي اختاره العضو من القائمة (مثل ".4") ليعالجه البوت كأنه كتب الأمر
export function getButtonId(message) {
    // فكّ الأغلفة (رسائل مؤقتة / عرض لمرة واحدة) ليُقرأ الرد داخلها
    let m = message;
    for (let i = 0; i < 4 && m; i++) {
        const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message;
        if (!inner) break;
        m = inner;
    }
    const ir = m?.interactiveResponseMessage;
    const r = ir?.nativeFlowResponseMessage;
    if (r && r.paramsJson) {
        try {
            const p = JSON.parse(r.paramsJson);
            const id = p.id || p.selectedId || p.selected_id || p.row_id;
            if (id) return String(id);
        } catch (e) { /* ننتقل للصيغ الأخرى */ }
    }
    return m?.buttonsResponseMessage?.selectedButtonId || m?.templateButtonReplyMessage?.selectedId || '';
}

// ===== زر تحت كل قسم: [قائمة الأقسام] =====
const SECTION_NAV_BUTTONS = () => [
    { name: 'single_select', buttonParamsJson: JSON.stringify({ title: royal('قائمة الأقسام'), sections: SECTIONS }) }
];

// ترجع true إذا أُرسل القسم مع الزرّين، وfalse إذا فشل (ليُرسل القسم بالطريقة القديمة)
export async function sendSectionWithButtons(sock, jid, text, imageUrl, mentionJid, extraButtons = []) {
    try {
        let header = { hasMediaAttachment: false };
        if (imageUrl) {
            try {
                const media = await prepareWAMessageMedia({ image: { url: imageUrl } }, { upload: sock.waUploadToServer });
                if (media && media.imageMessage) header = { hasMediaAttachment: true, imageMessage: media.imageMessage };
            } catch (e) {}
        }
        await relayInteractive(sock, jid, {
            header,
            body: { text },
            ...(mentionJid ? { contextInfo: { mentionedJid: [mentionJid] } } : {}),
            nativeFlowMessage: { buttons: [...SECTION_NAV_BUTTONS(), ...extraButtons] }
        });
        return true;
    } catch (e) {
        console.error('تعذر إرسال القسم مع الأزرار:', e?.message || e);
        return false;
    }
}

// ===== بطاقة بصورة وعنوان مع زر «قائمة الأقسام» ثم أزرار إضافية تحته مباشرة =====
// image: Buffer أو رابط | title/subtitle: عنوان تحت الصورة | extraButtons: أزرار native_flow تُوضع بعد «قائمة الأقسام»
// ترجع true عند النجاح، وfalse عند الفشل (ليرسل المستدعي نسخة نصية بديلة)
export async function sendCardWithButtons(sock, jid, { title = '', subtitle = '', image = null, text = '', footer = '', mentionJid = null, extraButtons = [] } = {}) {
    try {
        let header = { ...(title ? { title } : {}), ...(subtitle ? { subtitle } : {}), hasMediaAttachment: false };
        if (image) {
            try {
                const media = await prepareWAMessageMedia({ image: Buffer.isBuffer(image) ? image : { url: image } }, { upload: sock.waUploadToServer });
                if (media && media.imageMessage) header = { ...header, hasMediaAttachment: true, imageMessage: media.imageMessage };
            } catch (e) { console.error('تعذر رفع صورة البطاقة:', e?.message || e); }
        }
        await relayInteractive(sock, jid, {
            header,
            body: { text },
            ...(footer ? { footer: { text: footer } } : {}),
            ...(mentionJid ? { contextInfo: { mentionedJid: [mentionJid] } } : {}),
            nativeFlowMessage: { buttons: [...SECTION_NAV_BUTTONS(), ...extraButtons] }
        });
        return true;
    } catch (e) {
        console.error('تعذر إرسال البطاقة مع الأزرار:', e?.message || e);
        return false;
    }
}

// زر قائمة منسدلة (single_select) جاهز للاستخدام في extraButtons
export const selectButton = (title, sections) => ({ name: 'single_select', buttonParamsJson: JSON.stringify({ title: royal(title), sections }) });

// زر «الحماية» تحت قائمة الأقسام: لكل حماية صفّان (تفعيل / تعطيل) وضغطه ينفّذ الأمر مباشرة
export function protectionButton(settings = {}) {
    const dot = (v) => (v ? '🟢' : '🔴');
    const state = (v) => (v ? '🟢 مفعلة حالياً' : '🔴 معطلة حالياً');
    const item = (icon, label, on, off, cur) => ({
        title: `${dot(cur)} ${label}`,
        rows: [
            { header: '', title: `✅ تفعيل ${label}`, description: `${state(cur)} • .${on}`, id: `.${on}` },
            { header: '', title: `⛔ تعطيل ${label}`, description: `${state(cur)} • .${off}`, id: `.${off}` }
        ]
    });
    return {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
            title: royal('الحماية'),
            sections: [
                item('🔗', 'حماية الروابط', 'حظر_رابط', 'سماح_رابط', settings.antiLink),
                item('🤬', 'حماية الشتم', 'حظر_شتم', 'سماح_شتم', settings.antiBadWords),
                item('📇', 'حماية الجهات', 'حظر_جهات', 'سماح_جهات', settings.antiContact),
                item('🎉', 'إشعار الترقية', 'تفعيل_اشعار_المستوى', 'توقيف_اشعار_المستوى', settings.levelNotice)
            ]
        })
    };
}

// معرض صور أفقي (Carousel): كل صورة في بطاقة مستقلة بجانب بعضها، يمرّر العضو يميناً ويساراً
// cards: [{ image: Buffer, body, footer, url, button }]
export async function sendImageCarousel(sock, jid, cards, { text = '', footer = '' } = {}) {
    const built = [];
    for (const card of cards.slice(0, 10)) {
        const media = await prepareWAMessageMedia({ image: card.image }, { upload: sock.waUploadToServer });
        if (!media || !media.imageMessage) continue;
        const buttons = card.url
            ? [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: royal(card.button || '🔗 فتح الصورة'), url: card.url, merchant_url: card.url }) }]
            : [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: royal(card.button || '🖼️ صورة'), id: '.' }) }];
        built.push({
            header: { hasMediaAttachment: true, imageMessage: media.imageMessage },
            body: { text: card.body || ' ' },
            footer: { text: card.footer || ' ' },
            nativeFlowMessage: { buttons }
        });
    }
    if (built.length < 2) throw new Error('CAROUSEL_TOO_FEW_CARDS');
    await relayInteractive(sock, jid, {
        header: { hasMediaAttachment: false },
        body: { text: text || ' ' },
        footer: { text: footer || ' ' },
        carouselMessage: { cards: built, messageVersion: 1 }
    }, { noForward: true });
}

// رسالة (صورة اختيارية + نص) ومعها زر تفاعلي واحد تحتها؛ id الزر يُرسَل كأنه أمر كتبه العضو
export async function sendImageWithQuickReply(sock, jid, image, caption, buttonText, buttonId, mentions = []) {
    try {
        let header = { hasMediaAttachment: false };
        if (image) {
            const media = await prepareWAMessageMedia({ image: Buffer.isBuffer(image) ? image : { url: image } }, { upload: sock.waUploadToServer });
            if (media && media.imageMessage) header = { hasMediaAttachment: true, imageMessage: media.imageMessage };
        }
        await relayInteractive(sock, jid, {
            header,
            body: { text: caption || ' ' },
            ...(mentions && mentions.length ? { contextInfo: { mentionedJid: mentions } } : {}),
            nativeFlowMessage: { buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: buttonText, id: buttonId }) }] }
        }, { noForward: true });
        return true;
    } catch (e) {
        console.error('تعذر إرسال الرسالة مع الزر:', e?.message || e);
        return false;
    }
}

// رسالة نصية مع زر قائمة منسدلة (single_select): rows = [{ header, title, description, id }]
export async function sendSelectList(sock, jid, text, buttonTitle, rows) {
    try {
        await relayInteractive(sock, jid, {
            header: { hasMediaAttachment: false },
            body: { text: text || ' ' },
            nativeFlowMessage: {
                buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: buttonTitle, sections: [{ title: buttonTitle, rows }] }) }]
            }
        }, { noForward: true });
        return true;
    } catch (e) {
        console.error('تعذر إرسال القائمة:', e?.message || e);
        return false;
    }
}

// يعرض قائمة الأقسام كاملة (زر الأقسام)
export async function sendSectionsList(sock, jid, mentionJid) {
    await relayInteractive(sock, jid, {
        header: { hasMediaAttachment: false },
        body: { text: '📋 *قائمة الأقسام*\n\nاضغط على زر «الأقسام» ثم اختر القسم الذي تريده.' },
        ...(mentionJid ? { contextInfo: { mentionedJid: [mentionJid] } } : {}),
        nativeFlowMessage: {
            buttons: [
                { name: 'single_select', buttonParamsJson: JSON.stringify({ title: royal('الأقسام'), sections: SECTIONS }) }
            ]
        }
    });
}

// بطاقة حزمة ملصقات: صورة + نص + زر «عرض مجموعة الملصقات» (رابط)
export async function sendPackCard(sock, jid, { image, text, url, buttonText = 'عرض مجموعة الملصقات', mentionJid }) {
    let header = { hasMediaAttachment: false };
    if (image) {
        const media = await prepareWAMessageMedia({ image: typeof image === 'string' ? { url: image } : image }, { upload: sock.waUploadToServer });
        if (media && media.imageMessage) header = { hasMediaAttachment: true, imageMessage: media.imageMessage };
    }
    await relayInteractive(sock, jid, {
        header,
        body: { text },
        ...(mentionJid ? { contextInfo: { mentionedJid: [mentionJid] } } : {}),
        nativeFlowMessage: {
            buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: royal(buttonText), url, merchant_url: url }) }]
        }
    });
}

// ============ كاروسيل فيديوهات أفقي (كل فيديو في بطاقة) ============
export async function sendVideoCarousel(sock, jid, cards, { text = '', footer = '' } = {}) {
    const built = [];
    for (const card of cards.slice(0, 10)) {
        try {
            const media = await prepareWAMessageMedia({ video: card.video }, { upload: sock.waUploadToServer });
            if (!media || !media.videoMessage) continue;
            const buttons = card.url
                ? [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: royal(card.button || '🔗 فتح في تيك توك'), url: card.url, merchant_url: card.url }) }]
                : [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: royal(card.button || '🎬 إيديت'), id: '.' }) }];
            built.push({
                header: { hasMediaAttachment: true, videoMessage: media.videoMessage },
                body: { text: card.body || ' ' },
                footer: { text: card.footer || ' ' },
                nativeFlowMessage: { buttons }
            });
        } catch (e) { console.error('فشل رفع فيديو للبطاقة:', e?.message || e); }
    }
    if (built.length < 2) throw new Error('CAROUSEL_TOO_FEW_CARDS');
    await relayInteractive(sock, jid, {
        header: { hasMediaAttachment: false },
        body: { text: text || ' ' },
        footer: { text: footer || ' ' },
        carouselMessage: { cards: built, messageVersion: 1 }
    }, { noForward: true });
}
