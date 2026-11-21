const assert = require('node:assert/strict');

/** Checks the deployed catalog and raster images in headless Chrome, e.g. two visible product cards. */
async function main() {
  const { chromium } = require('/var/lib/jenkins/outlierfit-test-tools/node_modules/playwright');
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  if (!/^https:\/\/(staging\.)?outlierfit\.shop$/.test(baseURL || '')) throw new Error('Unexpected smoke target');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(baseURL + '/products', { waitUntil: 'networkidle' });
    const cards = page.locator('[data-testid^="product-card-"]');
    await cards.first().waitFor();
    assert.ok(await cards.count() >= 2, 'Expected imported catalog products');
    for (const image of await cards.locator('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.decode());
      assert.ok(await image.evaluate(img => img.naturalWidth > 0), 'Catalog image must load');
    }
    await cards.first().click();
    await page.locator('h1').waitFor();
    assert.match(await page.locator('body').innerText(), /Generic/);
    console.log('PASS: catalog, product detail, and private-bucket images');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
