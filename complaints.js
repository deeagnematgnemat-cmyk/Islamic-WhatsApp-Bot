// ============ complaints.js : قسم الشكاوي (18) ============
const DEV_NUMBER = '962796163926';
const BOT_CHANNEL = 'https://whatsapp.com/channel/0029VbAyOwm3mFY0ohjZCB04';

export const COMPLAINTS_COMMANDS = { 'شكاوي': ['الشكاوي'], 'تواصل': [], 'قناة_البوت': [] };

export const COMPLAINTS_SECTION = `📞 *قِـسْـمُ الـشَّـكَـاوِي:*

> 📱 .تواصل ↞ رقم المطور للتواصل وحل أي مشكلة
> 📢 .قناة_البوت ↞ رابط قناة البوت

💡 إذا واجهتك مشكلة، تواصل مع المطور وأخبره باسم الأمر الذي لا يعمل.`;

export function buildComplaintsHandlers({ sendSection }) {
    return {
        'شكاوي': (c) => sendSection(c, COMPLAINTS_SECTION),
        'تواصل': (c) => c.reply(`📞 *التواصل مع المطور:*\n\n> 📱 الرقم: +${DEV_NUMBER}\n> 🔗 واتساب: https://wa.me/${DEV_NUMBER}`),
        'قناة_البوت': (c) => c.reply(`📢 *قناة البوت:*\n\n${BOT_CHANNEL}`)
    };
}
