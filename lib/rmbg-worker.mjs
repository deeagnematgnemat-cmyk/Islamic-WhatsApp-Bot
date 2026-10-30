// عملية مستقلة لإزالة الخلفية: إن انهارت أو نفدت الذاكرة لا يتأثر البوت ويُعرف السبب
// الاستخدام: node rmbg-worker.mjs <input.png> <output.png> <small|medium>
import fs from 'fs';
const [, , inFile, outFile, model = 'small'] = process.argv;
try {
    const mod = await import('@imgly/background-removal-node');
    const removeBackground = mod.removeBackground || mod.default?.removeBackground || mod.default;
    const png = fs.readFileSync(inFile);
    const blob = await removeBackground(new Blob([png], { type: 'image/png' }), { model, output: { format: 'image/png' } });
    fs.writeFileSync(outFile, Buffer.from(await blob.arrayBuffer()));
    process.exit(0);
} catch (e) {
    console.error(String(e?.stack || e?.message || e).slice(0, 1500));
    process.exit(2);
}
