// ==========================================
// أمر .بوت الأسطوري التفاعلي
// ==========================================
if (cmdBase === 'بوت') {    
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });    
        
    const botWelcomeText = `
🍷 *أَهْـلاً بِـكَ فِي عَالَمِ 𝐸𝓇𝑒𝓃 𝐵𝑜𝓉* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}
> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> ┃ ⌯👨🏻‍💻︙الــمـطـور → 𝐸𝓇𝑒𝓃 (962796163926)
> ┃ 
> ┃ ♟️ *"الهيبةُ ليستْ بصَخبِ الـحُضور،*
> ┃ *بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى."*
> ┃ ✦ لا نَسْعَى خَلْفَ الأَضْوَاءِ.. بَلْ نَدَعُ النَّتَائِجَ هِيَ مَنْ تَتَكَلَّمُ.
> ┃ 
> ┃ ⌯🚀︙الـتـوقـيـت → ${time}

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

⚙️ *لِـعَـرْضِ كَـافَّـةِ أَقْـسَـامِ الأَوَامِـرِ وَالإِدَارَةِ:*
اضغط على الأزرار التفاعلية أدناه 👇

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
`.trim();

    // قائمة أقسام البوت المنسدلة
    const sections = [
        {
            title: "قائمة أقسام البوت الأسطورية",
            rows: [
                { title: "🛡️ 1. الحماية", rowId: ".1", description: "أوامر حماية الجروبات والروابط" },
                { title: "🎮 2. الترفيه والألعاب", rowId: ".2", description: "الألعاب والفعاليات والتحديات" },
                { title: "💳 3. البنك والنقاط", rowId: ".3", description: "رصيدك، البنك، المتجر، المكافأة" },
                { title: "⚽ 4. الرياضة", rowId: ".4", description: "المباريات ونتائج كرة القدم" },
                { title: "🤖 5. الذكاء الاصطناعي", rowId: ".5", description: "الأسئلة والذكاء الاصطناعي" },
                { title: "🧠 6. الأسئلة الثقافية", rowId: ".6", description: "الأسئلة والاختبارات المنوعة" },
                { title: "🕌 7. الإسلامي", rowId: ".7", description: "القرآن، الأذكار، الأحاديث" },
                { title: "😂 8. الضحك والترفيه", rowId: ".8", description: "النكت والمقالب والضحك" },
                { title: "👥 9. المجموعات", rowId: ".9", description: "الزواج، الطلاق، ألقاب الأعضاء" },
                { title: "♟️ 10. المطور", rowId: ".10", description: "تحكم المطور الخاص" },
                { title: "⚡ 11. الإدارة", rowId: ".11", description: "أوامر المشرفين والتحكم بالجروب" },
                { title: "🔍 12. الكشف", rowId: ".12", description: "كشف رسائل العرض لمرة واحدة" },
                { title: "📥 13. قسم الطلبات", rowId: ".13", description: "صنع الملصقات وتحميل الوسائط" }
            ]
        }
    ];

    try {
        let interactiveMsg = generateWAMessageFromContent(from, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({
                            text: botWelcomeText
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: "『 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 』"
                        }),
                        header: proto.Message.InteractiveMessage.Header.create({
                            title: "الاقسام تحت",
                            hasMediaMessage: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [
                                // 1. زر قائمة الأقسام
                                {
                                    name: "single_select",
                                    buttonParamsJson: JSON.stringify({
                                        title: "≡ ⌈ الاقسام ⌋",
                                        sections: sections
                                    })
                                },
                                // 2. زر قناة / جروب المطور
                                {
                                    name: "cta_url",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "📢 ⦅كروب المطور⦆",
                                        url: "https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d",
                                        merchant_url: "https://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d"
                                    })
                                }
                            ]
                        })
                    })
                }
            }
        }, { quoted: msg });

        await sock.relayMessage(from, interactiveMsg.message, { messageId: interactiveMsg.key.id });
    } catch (e) {
        // في حال حدوث خطأ يتم إرسال الاستمارة كنص مع رابط الكروب
        await sock.sendMessage(from, { 
            text: botWelcomeText + "\n\n🔗 *كروب المطور:*\nhttps://whatsapp.com/channel/0029Vb8jc2PFHWq9IwKDk50d", 
            mentions: [sender] 
        });
    }
    return;
}
