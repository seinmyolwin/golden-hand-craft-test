import { chromium } from 'playwright';

async function test() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  console.log('Browser launched!');
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  const title = await page.title();
  console.log('Page title:', title);
  await browser.close();
  console.log('Done!');
}

test().catch((err) => {
  console.error('Browser launch error:', err);
  process.exit(1);
});
