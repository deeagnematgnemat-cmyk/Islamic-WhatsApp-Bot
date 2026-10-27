// ============ الأزرار التفاعلية تحت استمارة .بوت و .اوامر ============
import * as baileysNs from '@whiskeysockets/baileys';

const B = (baileysNs.default && baileysNs.default.generateWAMessageFromContent) ? baileysNs.default : baileysNs;
const { generateWAMessageFromContent } = B;

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
            row('🎨 11. الملصقات', 'أوامر صنع الملصقات', 11),
            row('📲 12. التنصيب', 'ربط بوت خاص بك', 12)
        ]
    }
];

// يرسل رسالة الأزرار: [الأقسام] [قناة المطور] [جروب التنصيب]
export async function sendMenuButtons(sock, jid) {
    const content = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                    body: { text: '📌 اختر القسم المطلوب من الزر بالأسفل لاستعراض الأوامر.' },
                    footer: { text: '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』' },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({ title: 'الأقسام', sections: SECTIONS })
                            },
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({ display_text: '📢 قناة المطور', url: CHANNEL_URL, merchant_url: CHANNEL_URL })
                            },
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({ display_text: '🌐 جروب التنصيب', url: INSTALL_GROUP_URL, merchant_url: INSTALL_GROUP_URL })
                            }
                        ]
                    }
                }
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

// يقرأ رقم الصف الذي اختاره العضو من القائمة (مثل ".4") ليعالجه البوت كأنه كتب الأمر
export function getButtonId(message) {
    const r = message?.interactiveResponseMessage?.nativeFlowResponseMessage;
    if (!r || !r.paramsJson) return '';
    try { return JSON.parse(r.paramsJson).id || ''; } catch (e) { return ''; }
}
