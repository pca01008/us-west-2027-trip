// Local-only prototype capture and interaction smoke checks; never contacts production.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const here=new URL('./',import.meta.url);
await mkdir(new URL('previews/',here),{recursive:true});
const browser=await chromium.launch();
const errors=[];
try {
  for(const variant of (process.argv[2] ? [process.argv[2]] : ['a','b','c'])) {
    const page=await browser.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.route(/^https?:/,route=>route.abort());
    for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      await page.setViewportSize({width,height});
      await page.goto(new URL(`${variant}.html`,here).href);
      await page.locator('.event:visible,.board-event:visible').first().waitFor();
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${variant} ${label} overflow`);
      await page.screenshot({path:fileURLToPath(new URL(`previews/${variant}-${label}.png`,here))});
      await page.screenshot({path:fileURLToPath(new URL(`previews/${variant}-${label}-full.png`,here)),fullPage:true});
      const nav=width<641?page.locator('.mobile-nav'):page.locator('.main-nav');
      await nav.locator('[data-tab=prep]').click();
      const checkbox=page.locator('[data-check="2"]');
      await checkbox.check();
      assert.equal(await page.locator('#prep-count').innerText(),'5 / 12');
      await nav.locator('[data-tab=ledger]').click();
      await page.locator('#expense-filter').selectOption({label:'숙박'});
      await page.getByRole('heading',{name:'숙박 지출이 없어요'}).waitFor();
      await page.getByRole('button',{name:'전체 내역 보기'}).click();
      assert.equal(await page.locator('.expense-row:not(.table-head)').count(),3);
      await page.screenshot({path:fileURLToPath(new URL(`previews/${variant}-${label}-ledger.png`,here)),fullPage:true});
      await nav.locator('[data-tab=schedule]').click();
      await page.locator('[data-day="5"]').click();
      await page.getByRole('heading',{name:'LA 자유 일정',exact:true}).first().waitFor();
      if(width<641)assert.equal(await page.locator('.board').count()?await page.locator('.board').isVisible():false,false);
      console.log(`PASS ${variant} ${label}: render, navigation, checklist, ledger filter, date switch`);
    }
    for(const width of [360,768,1280]){
      await page.setViewportSize({width,height:900});
      await page.goto(new URL(`${variant}.html`,here).href);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${variant} ${width} overflow`);
    }
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  await page.goto(new URL('index.html',here).href);
  await page.screenshot({path:fileURLToPath(new URL('previews/comparison-desktop.png',here)),fullPage:true});
  await page.locator('[data-view=mobile]').click();
  await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
  await page.screenshot({path:fileURLToPath(new URL('previews/comparison-mobile.png',here)),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS no script errors; no horizontal page overflow at 360, 390, 768, 1280, 1440px.');
} finally {await browser.close();}
