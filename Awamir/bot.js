import { generateWAMessageFromContent, prepareWAMessageMedia } from '@whiskeysockets/baileys';

let handler = async (m, { conn, usedPrefix }) => {
    const imageUrl = 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg'; 
    let mediaMessage;
    
    try {
        mediaMessage = await prepareWAMessageMedia(
            { image: { url: imageUrl } }, 
            { upload: conn.waUploadToServer }
        );
    } catch (e) {
        mediaMessage = null;
    }

    const captionText = `🍷 *أَهْـلاً بِـكَ فِي عَالَمِ 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> 🔮︙الـمُـسـتـخـدم → @${m.sender.split('@')[0]}
> 🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> 👨🏻‍💻︙الــمـطـور → 𝐸𝓇𝑒𝓃 (962796163926)
> 📊︙عدد الأوامر → 11 قسمًا رسميًا
> 
> ♟️ *"الهيبةُ ليستْ بصَخبِ الـحُضور،*
> *"بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى."*
> ✦ لا نَسْعَى خَلْفَ الأَضْوَاءِ.. بَلْ نَدَعُ النَّتَائِجَ هِيَ مَنْ تَتَكَلَّمُ.

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

⚙️ *اضغط على القائمة التفاعلية أدناه لاختيار القسم الفعّال:*`;

    const interactiveMessage = {
        body: { text: captionText },
        footer: { text: "『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』" },
        header: {
            title: "قَـائِـمَـةُ الأَقْـسَـامِ الرَّسْمِيَّة",
            hasMediaAttachment: !!mediaMessage,
            ...(mediaMessage ? { imageMessage: mediaMessage.imageMessage } : {})
        },
        nativeFlowMessage: {
            buttons: [
                {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                        title: "📜 اختر قسمًا من القائمة",
                        sections: [
                            {
                                title: "الأقسام الرئيسية للبوت",
                                rows: [
                                    { title: "🛡️ 1. الحماية", description: "أوامر الحظر، منع الروابط، وتصفير الإنذارات", id: `${usedPrefix}1` },
                                    { title: "🎉 2. الترفيه والألعاب", description: "ألعاب التفكيك، الترتيب، التخمين والزواج", id: `${usedPrefix}2` },
                                    { title: "💳 3. البنك والنقاط", description: "كشف الحساب، التحويل، والمكافآت اليومية", id: `${usedPrefix}3` },
                                    { title: "🕌 4. القسم الإسلامي", description: "قرآن، أدعية، أذكار وأحاديث نبوية", id: `${usedPrefix}4` },
                                    { title: "😂 5. قسم الضحك", description: "نكت، تساؤلات خيالية ومقولات", id: `${usedPrefix}5` },
                                    { title: "👥 6. قسم المجموعات", description: "ألقاب الجروب، التفاعلات والتوب", id: `${usedPrefix}6` },
                                    { title: "♟️ 7. قسم المطور", description: "أوامر التحكم بالمطور والنظام", id: `${usedPrefix}7` },
                                    { title: "⚡ 8. الإدارة", description: "قفل وفتح الجروب، الطرد والترقية", id: `${usedPrefix}8` },
                                    { title: "🔎 9. قسم الكشف", description: "كشف وسائط العرض لمرة واحدة", id: `${usedPrefix}9` },
                                    { title: "👑 10. قسم الألقاب", description: "إضافة وحجز الألقاب للأعضاء", id: `${usedPrefix}10` },
                                    { title: "🎨 11. قسم الملصقات", description: "صنع ملصقات نصية، متحركة وحزم", id: `${usedPrefix}11` }
                                ]
                            }
                        ]
                    })
                },
                {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                        display_text: "📢 قناة المطور",
                        url: "https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d",
                        merchant_url: "https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d"
                    })
                }
            ]
        }
    };

    const msg = generateWAMessageFromContent(
        m.chat,
        {
            viewOnceMessage: {
                message: {
                    interactiveMessage: interactiveMessage
                }
            }
        },
        { userJid: conn.user.jid, quoted: m }
    );

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
};

handler.help = ['بوت'];
handler.tags = ['main'];
handler.command = /^بوت$/i;

export default handler;
