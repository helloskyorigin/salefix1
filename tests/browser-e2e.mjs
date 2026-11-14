// Real browser regression for the free user journey. Runs in GitHub Actions.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true});
const errors=[];
async function visitAndAudit(viewport){
  const ctx=await browser.newContext({viewport});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.title(),'SaleFix');
    await page.locator('.lf-hero-start').click();
    await page.waitForURL('**/#/analyze');
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
    assert.match(await page.locator('body').textContent(),/Product audit — key findings/);
    assert.match(await page.locator('body').textContent(),/CreatorLaunchKit/);
    assert.equal(await page.locator('#unlock-button').count(),1);
    await page.locator('#unlock-button').click();
    await page.waitForURL('**/#/checkout');
    assert.match(await page.locator('body').textContent(),/49\.00/);
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
  for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
    const result=await visitAndAudit(viewport);
    console.log('Browser E2E PASSED',result);
  }
}finally{await browser.close()}
