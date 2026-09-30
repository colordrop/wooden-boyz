const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    console.log('Navigating to tester.html...');
    await page.goto('http://localhost:8000/ar/tester.html', { waitUntil: 'networkidle2' });

    console.log('Switching to Nela...');
    await page.evaluate(() => {
        switchCurrentModel('nela');
    });

    // Wait for Nela to load
    await new Promise(r => setTimeout(r, 3000));

    console.log('Inspecting scene objects from inside page...');
    const result = await page.evaluate(() => {
        const v = document.getElementById('viewer');
        const sym = Object.getOwnPropertySymbols(v).find(x => x.description === 'scene');
        const scene = sym ? v[sym] : null;
        if (!scene) return { error: 'No scene symbol' };
        
        const nodes = [];
        scene.traverse(o => {
            nodes.push({ name: o.name, type: o.type, visible: o.visible, parent: o.parent ? o.parent.name : null });
        });
        
        return {
            nodesCount: nodes.length,
            nodes: nodes.filter(n => n.name.includes('zawias') || n.name.includes('anim') || n.name.includes('piaskownica') || n.name === 'root' || n.name.includes('nela')),
            availableAnimations: v.availableAnimations,
            animationName: v.animationName
        };
    });

    console.log('Result:', JSON.stringify(result, null, 2));

    console.log('\nNow selecting Zamykane włazy piaskownicy...');
    await page.evaluate(() => {
        // Find select for Wyposażenie pod wieżą
        clientToggleSelect('Wyposażenie pod wieżą', 'piaskownica');
    });

    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
