import { chromium } from 'playwright';

async function explore() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  const content = await page.content();
  console.log('Page URL:', page.url());
  const buttons = await page.locator('button').allInnerTexts();
  console.log('Buttons:', buttons);
  
  const inputs = await page.locator('input').count();
  console.log('Inputs count:', inputs);
  
  const bodyText = await page.locator('body').innerText();
  console.log('Body Text snippet:', bodyText.slice(0, 500));
  
  await browser.close();
}

explore().catch(console.error);
