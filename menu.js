// ============ الأزرار التفاعلية مع استمارة .بوت (رسالة واحدة) ============
import * as baileysNs from '@whiskeysockets/baileys';

const B = (baileysNs.default && baileysNs.default.generateWAMessageFromContent) ? baileysNs.default : baileysNs;
const { generateWAMessageFromContent, prepareWAMessageMedia } = B;

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d';
const INSTALL_GROUP_URL = 'https://chat.whatsapp.com/DjgGvEAiIEiCXwztk4F82L?s=cl&p=a&mlu=4&ilr=4';

const row = (title, description, n) => ({ header: '', title, description, id: `.${n}` });

const SECTIONS = [
    {
        title: 'الأقسام الأساسية',
        rows: [
            row('🛡️ 1. الحماية', 'أوامر الحماية والإنذارات', 1),
            row('🎉 2. الترفيه والألعاب', 'أوامر الألعاب والفعاليات', 2),
            row('💳 3. البنك والنقاط', 'الحساب والتحويل والمكافآت', 3),
            row('🕌 4. القسم الإسلامي', 'القرآن والأدعية والأذكار', 4),
            row('😂 5. الضحك', 'النكت والتساؤلات والمقولات', 5),
            row('👥 6. المجموعات', 'أوامر وتفاعلات المجموعة', 6)
        ]
    },
    {
        title: 'أقسام إضافية',
        rows: [
            row('♟️ 7. المطور', 'أوامر المطور والنظام', 7),
            row('⚡ 8. الإدارة', 'أوامر إدارة المجموعة', 8),
            row('🔍 9. الكشف', 'أوامر كشف الوسائط', 9),
            row('👑 10. الألقاب', 'أوامر الألقاب', 10),
            row('🎨 11. الملصقات', 'ملصقات وتعديل الصور', 11),
            row('📲 12. التنصيب', 'ربط بوت خاص بك', 12),
            row('📥 13. التنزيل', 'تنزيل من الروابط', 13),
            row('🤖 14. الذكاء الاصطناعي', 'أسئلة وصور وترجمة', 14),
            row('🖼️ 15. الصور', 'جلب وتعديل الصور', 15),
            row('🔧 16. الفرعي', 'التحكم ببوتك المنصّب', 16)
        ]
    }
];

const BUTTONS = () => [
    { name: 'single_select', buttonParamsJson: JSON.stringify({ title: 'الأقسام', sections: SECTIONS }) },
    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '📢 قناة المطور', url: CHANNEL_URL, merchant_url: CHANNEL_URL }) },
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '👑 المطور', id: '.معلومات_المطور' }) }
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
export async function sendFormWithButtons(sock, jid, text, videoUrl, mentionJid) {
    let header = { hasMediaAttachment: false };
    if (videoUrl) {
        try {
            const media = await prepareWAMessageMedia({ video: { url: videoUrl } }, { upload: sock.waUploadToServer });
            if (media && media.videoMessage) header = { hasMediaAttachment: true, videoMessage: media.videoMessage };
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

// يقرأ رقم الصف الذي اختاره العضو من القائمة (مثل ".4") ليعالجه البوت كأنه كتب الأمر
export function getButtonId(message) {
    const r = message?.interactiveResponseMessage?.nativeFlowResponseMessage;
    if (!r || !r.paramsJson) return '';
    try { return JSON.parse(r.paramsJson).id || ''; } catch (e) { return ''; }
}

// ===== زر تحت كل قسم: [قائمة الأقسام] =====
const SECTION_NAV_BUTTONS = () => [
    { name: 'single_select', buttonParamsJson: JSON.stringify({ title: '📋 قائمة الأقسام', sections: SECTIONS }) }
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
            title: '🛡️ الحماية',
            sections: [
                item('🔗', 'حماية الروابط', 'حظر_رابط', 'سماح_رابط', settings.antiLink),
                item('🤬', 'حماية الشتم', 'حظر_شتم', 'سماح_شتم', settings.antiBadWords),
                item('📇', 'حماية الجهات', 'حظر_جهات', 'سماح_جهات', settings.antiContact)
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
            ? [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: card.button || '🔗 فتح الصورة', url: card.url, merchant_url: card.url }) }]
            : [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: card.button || '🖼️ صورة', id: '.' }) }];
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

// يعرض قائمة الأقسام كاملة (زر الأقسام)
export async function sendSectionsList(sock, jid, mentionJid) {
    await relayInteractive(sock, jid, {
        header: { hasMediaAttachment: false },
        body: { text: '📋 *قائمة الأقسام*\n\nاضغط على زر «الأقسام» ثم اختر القسم الذي تريده.' },
        ...(mentionJid ? { contextInfo: { mentionedJid: [mentionJid] } } : {}),
        nativeFlowMessage: {
            buttons: [
                { name: 'single_select', buttonParamsJson: JSON.stringify({ title: 'الأقسام', sections: SECTIONS }) }
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
            buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: buttonText, url, merchant_url: url }) }]
        }
    });
}
