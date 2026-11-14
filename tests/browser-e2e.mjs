// Real browser regression for the free user journey. Runs in GitHub Actions.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true});
const errors=[];
async function visitAndAudit(viewport){
  const ctx=await browser.newContext({viewport,acceptDownloads:true});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.title(),'SaleFix');
    await page.locator('.lf-hero-start').click();
    await page.waitForURL('**/#/analyze');
    await page.locator('#analyze-form').waitFor({state:'visible'});
    assert.equal(await page.locator('#analyze-form input').count(),2);
    assert.equal(await page.locator('#analyze-form textarea').count(),1);
    assert.equal(await page.locator('#product-files').count(),1);
    assert.equal(await page.locator('input[name="audience"]').count(),0);
    assert.equal(await page.locator('input[name="productName"]').count(),0);
    await page.locator('#product-description').fill('A printable creator toolkit featuring launch schedules and repeatable workflow checklists for real product launches.');
    assert.match(await page.locator('#product-description-count').textContent(),/\d+\/500/);
    await page.locator('#product-files').setInputFiles({
      name:'CreatorLaunchKit.txt',mimeType:'text/plain',
      buffer:Buffer.from('Creator Launch Toolkit: a collection of usable checklists, daily exercises, a simple 30-day marketing planner, example launch emails, and product sales page examples.\n'.repeat(18))
    });
    assert.match(await page.locator('#selected-product-files').textContent(),/CreatorLaunchKit\.txt/);
    await page.locator('#analyze-form button[type="submit"]').click();
    await page.waitForURL('**/#/results',{timeout:18000});
    await page.locator('#rv-report').waitFor({state:'visible'});
    assert.match(await page.locator('body').textContent(),/Product audit — key findings/);
    assert.match(await page.locator('body').textContent(),/CreatorLaunchKit/);
    assert.match(await page.locator('.rv-snapshot').textContent(),/Actionable/);
    assert.match(await page.locator('.rv-coverage').textContent(),/From your uploaded product files/);
    assert.equal(await page.locator('#unlock-button').count(),1);
    const issues=await page.locator('[data-rv-reviewed]').count();
    assert.ok(issues>=1,'At least one grounded recommendation for uploaded source');
    assert.equal(await page.locator('[data-rv-reviewed-count]').textContent(),'0 of '+issues);
    await page.locator('[data-rv-jump="rv-findings"]').click();
    await page.locator('[data-rv-reviewed="0"]').check();
    assert.equal(await page.locator('[data-rv-reviewed-count]').textContent(),'1 of '+issues);
    const reviewOverflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(reviewOverflow.scroll<=reviewOverflow.client+2,'Results horizontal overflow '+JSON.stringify(reviewOverflow));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#rv-report').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-rv-reviewed="0"]').isChecked(),true);
    await page.locator('[data-rv-copy-fix="0"]').click();
    assert.match(await page.locator('#rv-fix-feedback-0').textContent(),/Copied!|Could not copy/);
    const downloadReady=page.waitForEvent('download');
    await page.locator('[data-rv-download]').first().click();
    const downloaded=await downloadReady;
    assert.match(downloaded.suggestedFilename(),/^SaleFix-.*-audit\.txt$/);
    const reportText=await readFile(await downloaded.path(),'utf8');
    assert.match(reportText,/SALEFIX — FREE PRODUCT AUDIT/);
    assert.match(reportText,/ACTIONABLE FINDINGS/);
    assert.match(reportText,/CreatorLaunchKit/);
    assert.match(reportText,/CONTENT|FILE LIMITATIONS|IMPORTANT LIMITATIONS/);
    await page.locator('#unlock-button').click();
    await page.waitForURL('**/#/checkout');
    assert.match(await page.locator('body').textContent(),/29\.00/);
    await page.waitForFunction(()=>document.querySelector('#checkout-button')?.textContent.includes('not yet available'),null,{timeout:12000});
    assert.equal(await page.locator('#checkout-button').isDisabled(),true);
    assert.equal(await page.locator('#product-purchase-link').count(),1);
    // No horizontal content clipping on narrow phones.
    const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(dimensions.scroll<=dimensions.client+2,'Horizontal overflow: '+JSON.stringify(dimensions));
    await page.goto(base+'/#/privacy');
    assert.match(await page.locator('h1').first().textContent(),/Privacy Policy/);
    assert.match(await page.locator('body').textContent(),/hello\.skyorigin@gmail\.com/);
    assert.deepEqual(errors,[],'Browser must not throw uncaught exceptions');
    return {viewport,ok:true};
  }finally{await ctx.close()}
}
try{
  for(const viewport of [{width:1366,height:900},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]){
    const result=await visitAndAudit(viewport);
    console.log('Browser E2E PASSED',result);
  }
}finally{await browser.close()}
