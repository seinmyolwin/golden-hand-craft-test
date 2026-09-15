import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  // Check login screen
  console.log('Title:', await page.title());
  const bodyText = await page.innerText('body');
  console.log('Has Owner button:', bodyText.includes('ဆိုင်ရှင် (Owner)'));

  // Click Owner button
  const ownerBtn = page.locator('button', { hasText: 'ဆိုင်ရှင် (Owner)' });
  if (await ownerBtn.isVisible()) {
    console.log('Clicking Owner button...');
    await ownerBtn.click();
    await page.waitForTimeout(1000);
  }

  // Fill PIN setup
  console.log('Filling PIN inputs...');
  const inputs = await page.locator('input[type="password"], input[type="text"]').all();
  console.log('Found inputs count:', inputs.length);
  if (inputs.length >= 2) {
    await inputs[0].fill('1234');
    await inputs[1].fill('1234');
    console.log('Filled PINs. Submitting...');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log('After PIN setup, page snippet:');
  const loggedInText = await page.innerText('body');
  console.log(loggedInText.slice(0, 600));

  // Check buttons
  const navButtons = await page.locator('nav button, header button').allInnerTexts();
  console.log('Nav & Header buttons:', navButtons.slice(0, 15));

  await browser.close();
}

main().catch(console.error);
