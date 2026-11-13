// ============ guessData.js : بيانات ومنطق فعالية «احزر» (شخصيات أنمي + فهم أسئلة صح/غلط) ============

// ---------- الأنميات (الاسم المعروض + الأسماء التي قد يكتبها اللاعبون) ----------
export const GUESS_ANIME = {
    naruto: { ar: 'ناروتو', al: ['ناروتو', 'ناروتو شيبودن', 'naruto', 'naruto shippuden'] },
    onepiece: { ar: 'ون بيس', al: ['ون بيس', 'ونبيس', 'ون بس', 'one piece'] },
    dragonball: { ar: 'دراغون بول', al: ['دراغون بول', 'دراقون بول', 'دراجون بول', 'دراغون بول زد', 'دراغون بول سوبر', 'dragon ball', 'dbz'] },
    aot: { ar: 'هجوم العمالقة', al: ['هجوم العمالقة', 'هجوم التيتان', 'اتاك اون تايتن', 'شينغيكي نو كيوجين', 'attack on titan'] },
    deathnote: { ar: 'ديث نوت', al: ['ديث نوت', 'مذكرة الموت', 'دفتر الموت', 'death note'] },
    demonslayer: { ar: 'قاتل الشياطين', al: ['قاتل الشياطين', 'كيميتسو نو يايبا', 'كيميتسو', 'demon slayer'] },
    jjk: { ar: 'جوجوتسو كايسن', al: ['جوجوتسو كايسن', 'جوجتسو كايسن', 'جوجوتسو', 'جوجتسو', 'jujutsu kaisen', 'jjk'] },
    hxh: { ar: 'هانتر × هانتر', al: ['هانتر × هانتر', 'هانتر هانتر', 'هانتر', 'القناص', 'hunter x hunter', 'hxh'] },
    bleach: { ar: 'بليتش', al: ['بليتش', 'bleach'] },
    mha: { ar: 'ماي هيرو أكاديميا', al: ['ماي هيرو اكاديميا', 'ماي هيرو', 'بطلي الاكاديمية', 'my hero academia', 'boku no hero'] },
    opm: { ar: 'ون بانش مان', al: ['ون بانش مان', 'ون بنش مان', 'one punch man'] },
    tokyoghoul: { ar: 'طوكيو غول', al: ['طوكيو غول', 'طوكيو جول', 'tokyo ghoul'] },
    fma: { ar: 'فول ميتال الكيميائي', al: ['فول ميتال الكيميائي', 'فول ميتال', 'فل ميتال', 'الكيميائي المعدني', 'fullmetal alchemist'] },
    conan: { ar: 'المحقق كونان', al: ['المحقق كونان', 'كونان', 'ديتكتيف كونان', 'detective conan', 'case closed'] },
    pokemon: { ar: 'بوكيمون', al: ['بوكيمون', 'بوكيمان', 'pokemon'] },
    doraemon: { ar: 'دورايمون', al: ['دورايمون', 'دوراهيمون', 'doraemon'] },
    slamdunk: { ar: 'سلام دانك', al: ['سلام دانك', 'slam dunk'] },
    haikyuu: { ar: 'هايكيو', al: ['هايكيو', 'هايكيوو', 'haikyuu'] },
    sao: { ar: 'سورد آرت أونلاين', al: ['سورد ارت اونلاين', 'sword art online', 'sao'] },
    fairytail: { ar: 'فيري تيل', al: ['فيري تيل', 'ذيل الجنية', 'fairy tail'] },
    codegeass: { ar: 'كود جياس', al: ['كود جياس', 'كود غياس', 'code geass'] },
    jojo: { ar: 'مغامرات جوجو الغريبة', al: ['مغامرات جوجو الغريبة', 'جوجو', 'جو جو', 'jojo', 'jojos bizarre adventure'] },
    chainsawman: { ar: 'تشينسو مان', al: ['تشينسو مان', 'تشاينسو مان', 'رجل المنشار', 'chainsaw man'] },
    spyfamily: { ar: 'سباي × فاميلي', al: ['سباي × فاميلي', 'سباي فاميلي', 'سباي', 'spy x family', 'spy family'] },
    rezero: { ar: 'ري:زيرو', al: ['ري زيرو', 'ريزيرو', 're zero', 'rezero'] },
    blackclover: { ar: 'بلاك كلفر', al: ['بلاك كلفر', 'بلاك كلوفر', 'black clover'] },
    bluelock: { ar: 'بلو لوك', al: ['بلو لوك', 'blue lock'] },
    drstone: { ar: 'دكتور ستون', al: ['دكتور ستون', 'dr stone'] },
    frieren: { ar: 'فريرين', al: ['فريرين', 'frieren'] },
    eva: { ar: 'إيفانجيليون', al: ['ايفانجيليون', 'نيون جينيسيس ايفانجيليون', 'evangelion'] },
    bebop: { ar: 'كاوبوي بيبوب', al: ['كاوبوي بيبوب', 'cowboy bebop'] },
    darling: { ar: 'دارلينغ إن ذا فرانكس', al: ['دارلينغ ان ذا فرانكس', 'دارلينج ان ذا فرانكس', 'دارلينغ', 'فرانكس', 'darling in the franxx'] },
    gintama: { ar: 'جينتاما', al: ['جينتاما', 'غينتاما', 'gintama'] },
    kuroko: { ar: 'كوروكو نو باسكت', al: ['كوروكو نو باسكت', 'كوروكو باسكت', 'kuroko no basket'] },
    tsubasa: { ar: 'كابتن ماجد', al: ['كابتن ماجد', 'كابتن تسوباسا', 'captain tsubasa'] },
    vinland: { ar: 'فينلاند ساجا', al: ['فينلاند ساجا', 'فينلاند', 'vinland saga'] },
    sololeveling: { ar: 'سولو ليفلينغ', al: ['سولو ليفلينغ', 'سولو ليفيلنج', 'solo leveling'] },
    mob: { ar: 'موب سايكو 100', al: ['موب سايكو', 'mob psycho'] },
    sailormoon: { ar: 'سيلور مون', al: ['سيلور مون', 'sailor moon'] },
    berserk: { ar: 'بيرسيرك', al: ['بيرسيرك', 'berserk'] },
    tokyorev: { ar: 'طوكيو ريفنجرز', al: ['طوكيو ريفنجرز', 'tokyo revengers'] }
};

// ---------- الشخصيات: الأنمي | الأسماء المقبولة | الجنس m/f | لون الشعر | الصفات ----------
const RAW = `
naruto|ناروتو اوزوماكي,ناروتو,naruto,naruto uzumaki|m|اشقر|بطل,نينجا,قائد
naruto|ساسكي اوتشيها,ساسكي,sasuke,sasuke uchiha|m|اسود|نينجا,سيف,نار
naruto|ساكورا هارونو,ساكورا,sakura,sakura haruno|f|وردي|نينجا
naruto|كاكاشي هاتاكي,كاكاشي,kakashi,kakashi hatake|m|ابيض|نينجا,معلم,قناع
naruto|ايتاتشي اوتشيها,ايتاتشي,itachi,itachi uchiha|m|اسود|نينجا,نار
naruto|مادارا اوتشيها,مادارا,madara,madara uchiha|m|اسود|شرير,نينجا,قائد
naruto|جيرايا,jiraiya|m|ابيض|نينجا,معلم
naruto|ميناتو ناميكازي,ميناتو,minato,minato namikaze|m|اشقر|نينجا,قائد
naruto|هيناتا هيوغا,هيناتا,hinata hyuga|f|ازرق|نينجا
naruto|اوروتشيمارو,orochimaru|m|اسود|شرير,نينجا
naruto|غاارا,جارا,gaara|m|احمر|نينجا,قائد
naruto|باين,ناغاتو,pain,nagato|m|برتقالي|شرير,نينجا
naruto|اوبيتو اوتشيها,اوبيتو,obito,obito uchiha|m|اسود|شرير,نينجا,قناع
naruto|شيكامارو نارا,شيكامارو,shikamaru,shikamaru nara|m|اسود|نينجا,ذكي
naruto|تسونادي,tsunade|f|اشقر|نينجا,قائد,معلم
naruto|روك لي,rock lee|m|اسود|نينجا
naruto|نيجي هيوغا,نيجي,neji,neji hyuga|m|بني|نينجا
onepiece|مونكي دي لوفي,لوفي,luffy,monkey d luffy|m|اسود|بطل,قرصان,قبعة,قائد
onepiece|رورونوا زورو,زورو,zoro,roronoa zoro|m|اخضر|قرصان,سيف
onepiece|سانجي,sanji|m|اشقر|قرصان,طباخ
onepiece|نامي,nami|f|برتقالي|قرصان
onepiece|اوسوب,usopp|m|اسود|قرصان
onepiece|تشوبر,شوبر,chopper,tony tony chopper|m|بني|قرصان,قبعة,غير بشري
onepiece|نيكو روبين,روبين,robin,nico robin|f|اسود|قرصان
onepiece|فرانكي,franky|m|ازرق|قرصان
onepiece|بروك,brook|m|اسود|قرصان,سيف,قبعة
onepiece|جينبي,jinbe|m|ازرق|قرصان,غير بشري
onepiece|بورتغاس دي ايس,ايس,ace,portgas d ace|m|اسود|قرصان,نار,قبعة
onepiece|شانكس,shanks|m|احمر|قرصان,قائد
onepiece|دراكول ميهوك,ميهوك,mihawk|m|اسود|سيف,قبعة
onepiece|ترافالغار لو,trafalgar law|m|اسود|قرصان,سيف,قبعة
onepiece|كايدو,kaido|m|اسود|شرير,قرصان,قائد
onepiece|بيغ مام,big mom|f|وردي|شرير,قرصان,قائد
onepiece|بلاكبيرد,ماركوس تيتش,blackbeard|m|اسود|شرير,قرصان
onepiece|دونكيشوت دوفلامينغو,دوفلامينغو,doflamingo|m|اشقر|شرير,قرصان,نظارات
onepiece|كروكودايل,crocodile|m|اسود|شرير,قرصان
dragonball|غوكو,جوكو,قوكو,goku,son goku|m|اسود|بطل,يطير,غير بشري
dragonball|فيجيتا,فيجيتا,vegeta|m|اسود|يطير,غير بشري
dragonball|غوهان,جوهان,gohan,son gohan|m|اسود|يطير,غير بشري
dragonball|فريزا,frieza|m|اصلع|شرير,يطير,غير بشري,قائد
dragonball|سيل,cell|m|اصلع|شرير,غير بشري
dragonball|ماجن بو,بو,majin buu|m|اصلع|شرير,غير بشري
dragonball|تراكس,trunks|m|بنفسجي|يطير,سيف,غير بشري
dragonball|كريلين,krillin|m|اصلع|يطير
dragonball|بيكولو,piccolo|m|اصلع|يطير,غير بشري,معلم
dragonball|بولما,bulma|f|ازرق|ذكي
aot|ايرين ييغر,ايرين,eren,eren yeager|m|بني|بطل
aot|ميكاسا اكرمان,ميكاسا,mikasa,mikasa ackerman|f|اسود|سيف
aot|ارمين ارلرت,ارمين,armin,armin arlert|m|اشقر|ذكي
aot|ليفاي اكرمان,ليفاي,ليفي,levi,levi ackerman|m|اسود|سيف,قائد
aot|ايروين سميث,ايرفين,erwin,erwin smith|m|اشقر|قائد
deathnote|لايت ياغامي,ياغامي لايت,لايت,كيرا,light,light yagami,kira|m|بني|شرير,ذكي,طالب
deathnote|ايل,إل,ال لولايت,l lawliet|m|اسود|محقق,ذكي
deathnote|ريوك,ryuk|m||غير بشري
deathnote|ميسا اماني,ميسا,misa,misa amane|f|اشقر|
demonslayer|تانجيرو كامادو,تانجيرو,tanjiro,tanjiro kamado|m|بني|بطل,سيف
demonslayer|نيزوكو كامادو,نيزوكو,nezuko,nezuko kamado|f|اسود|غير بشري
demonslayer|زينيتسو اغاتسوما,زينيتسو,zenitsu|m|اشقر|سيف
demonslayer|اينوسكي هاشيبيرا,اينوسكي,اينوسوكي,inosuke|m|اسود|سيف,قناع
demonslayer|شينوبو كوشو,شينوبو,shinobu|f|اسود|سيف
demonslayer|كيوجورو رينغوكو,رينغوكو,rengoku|m|اشقر|سيف,نار
demonslayer|موزان كيبوتسوجي,موزان,muzan|m|اسود|شرير,غير بشري
demonslayer|غيو تومييوكا,غيو,giyu|m|اسود|سيف
demonslayer|اكازا,akaza|m|وردي|شرير,غير بشري
jjk|ساتورو غوجو,غوجو,gojo,satoru gojo|m|ابيض|سحر,معلم,نظارات
jjk|يوجي ايتادوري,ايتادوري,يوجي,itadori,yuji itadori,yuji|m|وردي|بطل,سحر,طالب
jjk|ريومن سوكونا,سوكونا,sukuna,ryomen sukuna|m|وردي|شرير,سحر,غير بشري
jjk|ميغومي فوشيغورو,ميغومي,megumi|m|اسود|سحر,طالب
jjk|نوبارا كوغيساكي,نوبارا,nobara|f|بني|سحر,طالب
jjk|سوغورو جيتو,جيتو,geto,suguru geto|m|اسود|شرير,سحر
jjk|ماكي زينين,ماكي,maki,maki zenin|f|اخضر|سيف,طالب
hxh|كيلوا زولديك,كيلوا,killua,killua zoldyck|m|ابيض|طفل
hxh|غون فريكس,غون,جون,gon,gon freecss|m|اسود|بطل,طفل
hxh|كورابيكا,kurapika|m|اشقر|
hxh|ليوريو,leorio|m|اسود|
hxh|هيسوكا,hisoka|m|احمر|شرير
bleach|ايتشيغو كوروساكي,ايتشيغو,ايتشيجو,ichigo,ichigo kurosaki|m|برتقالي|بطل,سيف,طالب
bleach|روكيا كوتشيكي,روكيا,rukia|f|اسود|سيف
bleach|سوسوكي ايزن,ايزن,aizen|m|بني|شرير,سيف,نظارات
mha|ايزوكو ميدوريا,ديكو,ميدوريا,ايزوكو,deku,izuku midoriya|m|اخضر|بطل,طالب
mha|كاتسوكي باكوغو,باكوغو,باكوجو,bakugo|m|اشقر|طالب
mha|شوتو تودوروكي,تودوروكي,todoroki|m|احمر/ابيض|طالب,نار
mha|اوراراكا اوتشاكو,اوتشاكو,اوراراكا,ochaco|f|بني|طالب
mha|اول مايت,all might|m|اشقر|بطل,معلم
mha|اندفور,اندفر,endeavor|m|احمر|بطل,نار
mha|توموراشيغاراكي,شيغاراكي,shigaraki|m|ازرق|شرير
opm|سايتاما,saitama|m|اصلع|بطل
opm|جينوس,genos|m|اشقر|بطل
opm|تاتسوماكي,tatsumaki|f|اخضر|بطل,يطير
tokyoghoul|كين كانيكي,كانيكي,kaneki|m|ابيض/اسود|غير بشري,قناع
tokyoghoul|توكا كيريشيما,توكا,touka|f|بنفسجي|غير بشري
fma|ادوارد الريك,ادوارد,edward,edward elric|m|اشقر|بطل,كيمياء
fma|الفونس الريك,الفونس,alphonse,alphonse elric|m||غير بشري,كيمياء
fma|روي موستانغ,موستانغ,roy mustang|m|اسود|نار,كيمياء,قائد
conan|كونان ادوغاوا,كونان,شينيتشي كودو,conan,conan edogawa,shinichi kudo|m|اسود|بطل,محقق,طفل,ذكي,نظارات
conan|ران موري,ران,ran mouri|f|بني|
conan|كايتو كيد,كيد,kaito kid,kid the phantom thief|m|اسود|قبعة,ذكي
pokemon|بيكاتشو,pikachu|m||غير بشري
pokemon|اش كيتشوم,اش,ash,ash ketchum|m|اسود|بطل,قبعة,طفل
pokemon|ميستي,misty|f|برتقالي|
doraemon|دورايمون,doraemon|m||غير بشري
doraemon|نوبيتا,nobita|m|اسود|بطل,نظارات,طفل,طالب
doraemon|شيزوكا,shizuka|f|اسود|طفل,طالب
doraemon|جايان,gian|m|اسود|طفل,طالب
doraemon|سونيو,suneo|m|اسود|طفل,طالب
slamdunk|هاناميتشي ساكوراغي,ساكوراغي,sakuragi|m|احمر|رياضي,طالب
slamdunk|كايدي روكاوا,روكاوا,rukawa|m|اسود|رياضي,طالب
slamdunk|تاكينوري اكاغي,اكاغي,akagi|m|اسود|رياضي,طالب,قائد
haikyuu|شويو هيناتا,هيناتا شويو,هيناتا,shoyo hinata|m|برتقالي|رياضي,طالب,بطل
haikyuu|توبيو كاغيياما,كاغيياما,kageyama,tobio kageyama|m|اسود|رياضي,طالب
sao|كيريتو,kirito|m|اسود|بطل,سيف
sao|اسونا,asuna|f|بني|سيف
fairytail|ناتسو دراغنيل,ناتسو,natsu,natsu dragneel|m|وردي|بطل,سحر,نار
fairytail|لوسي هارتفيليا,لوسي,lucy,lucy heartfilia|f|اشقر|سحر
fairytail|ارزا سكارليت,ارزا,erza,erza scarlet|f|احمر|سحر,سيف
fairytail|غراي فولباستر,غراي,gray,gray fullbuster|m|اسود|سحر
fairytail|هابي,happy|m||غير بشري,يطير
codegeass|لولوش لامبروج,لولوش,ليلوش,lelouch,lelouch lamperouge|m|اسود|ذكي,قائد,طالب
codegeass|سي سي,cc|f|اخضر|
jojo|جوتارو كوجو,جوتارو,jotaro,jotaro kujo|m|اسود|بطل,قبعة
jojo|ديو براندو,ديو,dio,dio brando|m|اشقر|شرير,غير بشري
jojo|جيورنو جوفانا,جيورنو,giorno,giorno giovanna|m|اشقر|بطل
chainsawman|دينجي,دنجي,denji|m|اشقر|بطل,غير بشري
chainsawman|ماكيما,makima|f|احمر|شرير,قائد
chainsawman|باور,power|f|اشقر|غير بشري
chainsawman|اكي هاياكاوا,اكي,aki|m|اسود|
spyfamily|انيا فورجر,انيا,anya,anya forger|f|وردي|طفل,طالب
spyfamily|لويد فورجر,لويد,loid,loid forger,twilight|m|اشقر|جاسوس,ذكي
spyfamily|يور فورجر,يور,yor,yor forger|f|اسود|
rezero|سوبارو ناتسوكي,سوبارو,subaru|m|اسود|بطل
rezero|ريم,rem|f|ازرق|
rezero|ايميليا,emilia|f|ابيض|سحر
blackclover|اصتا,اسطا,asta|m|رمادي/اسود|بطل,سيف,سحر
blackclover|يونو,yuno|m|اسود|سحر
bluelock|يويتشي ايساغي,ايساغي,isagi|m|اسود|رياضي
drstone|سينكو ايشيغامي,سينكو,senku|m|اخضر/ابيض|ذكي,بطل
frieren|فريرين,frieren|f|ابيض|سحر,بطل,غير بشري
frieren|فيرن,fern|f|بنفسجي|سحر
frieren|هيمل,himmel|m|ازرق|سيف,بطل
frieren|ستارك,stark|m|احمر|
eva|شينجي ايكاري,شينجي,shinji,shinji ikari|m|اسود|بطل,طالب
eva|ري اياناميي,ري اياناميي,rei ayanami|f|ازرق|
eva|اسكا لانغلي,اسكا,asuka|f|برتقالي/احمر|طالب
bebop|سبايك سبيغل,سبايك,spike,spike spiegel|m|اخضر|بطل
darling|زيرو تو,zero two|f|وردي|غير بشري
darling|هيرو,hiro|m|اسود|
gintama|غينتوكي ساكاتا,غينتوكي,gintoki|m|ابيض|بطل,سيف
kuroko|كوروكو تيتسويا,كوروكو,kuroko|m|ازرق|رياضي,طالب
kuroko|كاغامي تايغا,كاغامي,kagami|m|احمر|رياضي,طالب
tsubasa|تسوباسا اوزورا,تسوباسا,ماجد,tsubasa,tsubasa ozora|m|اسود|رياضي,قائد,بطل,قبعة
vinland|ثورفين,thorfinn|m|اشقر|بطل,سيف
sololeveling|سونغ جين وو,جين وو,sung jinwoo|m|اسود|بطل,سيف
mob|موب,شيجيو كاغيياما,mob,shigeo kageyama|m|اسود|بطل,طالب
sailormoon|سيلور مون,اوساغي,usagi,sailor moon|f|اشقر|بطل,سحر,طالب
berserk|غاتس,جاتس,guts|m|اسود|بطل,سيف
tokyorev|مايكي,ماندجيرو سانو,mikey,manjiro sano|m|اشقر|رياضي,قائد
`;

export const GUESS_CHARS = RAW.trim().split('\n').map((line, id) => {
    const [anime, names, g, hair, tags] = line.split('|');
    const all = names.split(',').map((x) => x.trim()).filter(Boolean);
    return {
        id, anime, g,
        ar: all.filter((x) => /[\u0600-\u06FF]/.test(x)),
        en: all.filter((x) => !/[\u0600-\u06FF]/.test(x)),
        names: all,
        hair: (hair || '').split('/').map((x) => x.trim()).filter(Boolean),
        tags: (tags || '').split(',').map((x) => x.trim()).filter(Boolean)
    };
});

// ---------- كلمات الصفات (ما يكتبه اللاعب → الصفة) ----------
const TAGS = {
    'بطل': ['بطل', 'ابطال', 'رئيسي', 'بطل رئيسي'],
    'شرير': ['شرير', 'اشرار', 'خبيث', 'وغد', 'عدو'],
    'سيف': ['سيف', 'سيوف', 'سياف', 'ساموراي', 'مبارز'],
    'نينجا': ['نينجا', 'شينوبي'],
    'قرصان': ['قرصان', 'قراصنة', 'بحار', 'بحارة'],
    'سحر': ['سحر', 'ساحر', 'ساحرة', 'سحري', 'لعنة', 'لعنات'],
    'طالب': ['طالب', 'طلاب', 'تلميذ', 'مدرسة', 'ثانوية', 'ثانوي'],
    'معلم': ['معلم', 'معلمة', 'استاذ', 'مدرس', 'سنسي', 'سينسي'],
    'قائد': ['قائد', 'قائدة', 'زعيم', 'كابتن', 'قيادة', 'هوكاجي'],
    'نظارات': ['نظارة', 'نظارات', 'نظارته'],
    'قبعة': ['قبعة', 'قبعات', 'طاقية', 'كاب'],
    'يطير': ['يطير', 'طيران', 'تطير', 'يحلق'],
    'طباخ': ['طباخ', 'طباخة', 'طبخ', 'يطبخ', 'شيف'],
    'طفل': ['طفل', 'طفلة', 'صغير', 'صغيرة', 'صغير السن'],
    'مراهق': ['مراهق', 'مراهقة', 'يافع'],
    'بالغ': ['بالغ', 'كبير', 'كبير السن', 'ناضج'],
    'ذكي': ['ذكي', 'ذكية', 'عبقري', 'عبقرية', 'دهاء'],
    'محقق': ['محقق', 'محققة', 'تحري'],
    'جاسوس': ['جاسوس', 'جاسوسة', 'عميل'],
    'كيمياء': ['كيمياء', 'كيميائي', 'كيميائية'],
    'رياضي': ['رياضي', 'رياضة', 'رياضية', 'لاعب', 'لاعبة', 'كرة', 'مباراة'],
    'قناع': ['قناع', 'مقنع', 'يغطي وجهه', 'يخفي وجهه'],
    'نار': ['نار', 'ناري', 'نيران', 'لهب', 'يتحكم بالنار']
};
const NON_HUMAN = ['غير بشري', 'غير بشرية', 'وحش', 'وحوش', 'شيطان', 'شياطين', 'روح', 'حيوان', 'روبوت', 'كائن', 'عفريت', 'مخلوق', 'تنين'];
const HUMAN = ['بشري', 'بشرية', 'انسان', 'ادمي'];
const MALE = ['ولد', 'ذكر', 'رجل', 'صبي', 'فتى', 'شاب', 'غلام'];
const FEMALE = ['بنت', 'انثى', 'امرأة', 'فتاة', 'سيدة', 'بنات'];
const COLORS = {
    'اسود': ['اسود', 'سود', 'سوداء', 'black'],
    'بني': ['بني', 'كستنائي', 'قهوائي', 'brown'],
    'اشقر': ['اشقر', 'شقراء', 'اصفر', 'ذهبي', 'blonde'],
    'احمر': ['احمر', 'حمراء', 'red'],
    'ازرق': ['ازرق', 'زرقاء', 'blue'],
    'اخضر': ['اخضر', 'خضراء', 'green'],
    'ابيض': ['ابيض', 'بيضاء', 'white'],
    'وردي': ['وردي', 'زهري', 'بينك', 'pink'],
    'بنفسجي': ['بنفسجي', 'ارجواني', 'موف', 'purple'],
    'برتقالي': ['برتقالي', 'orange'],
    'رمادي': ['رمادي', 'grey', 'gray'],
    'اصلع': ['اصلع', 'صلع', 'بدون شعر', 'اصلعه']
};
const COLOR_EXTRA = { 'فضي': ['ابيض', 'رمادي'], 'فضية': ['ابيض', 'رمادي'], 'silver': ['ابيض', 'رمادي'] };

// ---------- أدوات التطبيع والمطابقة ----------
export const guessNz = (s) => String(s || '').toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// الكلمة مع احتمال بادئة (و/ف/ب/ل/ك/ال) ولاحقة (ه/ها/ات/ين/ون)
const mkRe = (w) => new RegExp('(^| )(?:و|ف|ب|ل|ك)?(?:ال)?' + guessNz(w) + '(?:ه|ها|ات|ين|ون)?(?= |$)');
const compile = (list) => list.map((w) => ({ w: guessNz(w), re: mkRe(w) }));
const anyOf = (list) => { const c = compile(list); return (s) => c.some((x) => x.re.test(s)); };

const TAG_RE = Object.entries(TAGS).map(([tag, words]) => ({ tag, test: anyOf(words) }));
const isNonHuman = compile(NON_HUMAN);
const isHuman = anyOf(HUMAN);
const isMale = anyOf(MALE);
const isFemale = anyOf(FEMALE);
const COLOR_RE = [
    ...Object.entries(COLORS).map(([col, words]) => ({ cols: [col], test: anyOf(words) })),
    ...Object.entries(COLOR_EXTRA).map(([w, cols]) => ({ cols, test: anyOf([w]) }))
];
const HAIR_WORD = /(^| )(?:و|ف|ب|ل|ك)?(?:ال)?شعر/;
const NEG = /(^| )(ليس|ليست|مو|مش)( |$)/;
const ASK_WORD = /(^| )(?:و|ف)?هل( |$)/;
const ANIME_CTX = new Set(['من', 'في', 'انمي', 'انميه', 'مسلسل', 'عالم', 'قصه', 'ضمن', 'اعمال']);

// فهرس أسماء الشخصيات (اسم مطبّع → معرفات الشخصيات)
const NAME_INDEX = new Map();
for (const c of GUESS_CHARS) {
    for (const n of c.names) {
        const k = guessNz(n);
        if (k.replace(/ /g, '').length < 3) continue;
        if (!NAME_INDEX.has(k)) NAME_INDEX.set(k, new Set());
        NAME_INDEX.get(k).add(c.id);
    }
}
const ANIME_RE = [];
for (const [key, a] of Object.entries(GUESS_ANIME)) for (const al of a.al) ANIME_RE.push({ key, alias: guessNz(al), re: mkRe(al) });
ANIME_RE.sort((x, y) => y.alias.length - x.alias.length);

// هل في الرسالة كلمة «هل»؟ (أي رسالة فيها هل يُرد عليها)
export const guessIsAsk = (text) => ASK_WORD.test(guessNz(text));

// يقيّم رسالة اللاعب على الشخصية المخفية: win | true | false | unknown
export function guessEval(ch, text) {
    let s = guessNz(text);
    const neg = NEG.test(s);
    const results = [];

    // 1) الأنمي (إن كان الاسم مشتركاً مع اسم شخصية يلزم سياق مثل «من» أو «انمي»)
    for (const a of ANIME_RE) {
        const m = s.match(a.re);
        if (!m) continue;
        if (NAME_INDEX.has(a.alias)) {
            const prev = s.slice(0, m.index).trim().split(' ').pop().replace(/^ال/, '');
            if (!ANIME_CTX.has(prev)) continue;
        }
        results.push(ch.anime === a.key);
        s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
        break;
    }

    // 2) اسم شخصية: الصحيح = فوز، وغيره = غلط
    const toks = s.split(' ').filter(Boolean);
    const strip = (t) => { const r = t.replace(/^(وال|بال|لل|ال|و|ب|ل)/, ''); return r.length >= 2 ? r : t; };
    let win = false, wrong = false;
    for (const seq of [toks, toks.map(strip)]) {
        for (let n = 3; n >= 1; n--) {
            for (let i = 0; i + n <= seq.length; i++) {
                const ids = NAME_INDEX.get(seq.slice(i, i + n).join(' '));
                if (!ids) continue;
                if (ids.has(ch.id)) win = true; else wrong = true;
            }
        }
    }
    if (win) return 'win';
    if (wrong) results.push(false);

    // 3) لون الشعر
    const colors = new Set();
    for (const c of COLOR_RE) if (c.test(s)) c.cols.forEach((x) => colors.add(x));
    if (colors.size && (HAIR_WORD.test(s) || colors.has('اشقر') || colors.has('اصلع'))) results.push(ch.hair.some((h) => colors.has(h)));

    // 4) الجنس
    if (isMale(s)) results.push(ch.g === 'm');
    if (isFemale(s)) results.push(ch.g === 'f');

    // 5) بشري / غير بشري
    let nonHuman = false;
    for (const x of isNonHuman) { if (x.re.test(s)) { nonHuman = true; s = s.replace(x.re, ' '); } }
    if (nonHuman) results.push(ch.tags.includes('غير بشري'));
    else if (isHuman(s)) results.push(!ch.tags.includes('غير بشري'));

    // 6) باقي الصفات
    for (const t of TAG_RE) if (t.test(s)) results.push(ch.tags.includes(t.tag));

    if (!results.length) return 'unknown';
    return (results.every(Boolean) !== neg) ? 'true' : 'false';
}
