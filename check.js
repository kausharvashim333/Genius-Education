const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('error', e => {
      console.log(`ERROR_LINE_INFO: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
    });
  });

  page.on('console', msg => {
    if(msg.text().includes('ERROR_LINE_INFO')) {
      console.log(msg.text());
    }
  });

  await page.goto('http://localhost:3000/student-portal.html', { waitUntil: 'networkidle0' });
  await browser.close();
})();
