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
      if(variant==='a') {
        const snapshot=await page.evaluate(()=>JSON.stringify(window.DEMO_TRIP));
        assert.equal(await page.locator('.event-details').count(),0,'A warnings are never collapsed');
        assert.ok(await page.locator('.event-warnings li').count()>0);
        await page.locator('.prep-jump').scrollIntoViewIfNeeded();
        await page.locator('.prep-jump').click();
        await page.getByRole('heading',{name:'출발 전 준비',exact:true}).waitFor();
        assert.equal(await page.evaluate(()=>window.scrollY),0,'Prep jump starts at the page top');
        assert.equal(await page.locator('h1').evaluate(el=>el===document.activeElement),true,'Prep heading receives focus');
        await page.locator(width<641?'.mobile-nav [data-tab=schedule]':'.side-rail [data-tab=schedule]').click();
        await page.getByLabel('설정',{exact:true}).click();
        assert.equal(await page.getByRole('button',{name:'편집 시작',exact:true}).isDisabled(),true);
        await page.screenshot({path:fileURLToPath(new URL(`previews/a-${label}-settings.png`,here))});
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.daylight-tools').getAttribute('open'),null);
        await page.getByRole('button',{name:'시간표',exact:true}).focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-range][aria-pressed=true]').getAttribute('data-range'),width<641?'1':'all');
        await page.locator('[data-range=all]').click();
        assert.equal(await page.locator('.dt-day').count(),11);
        await page.screenshot({path:fileURLToPath(new URL(`previews/a-${label}-timetable.png`,here))});
        // Other time zones stay in the separate row, never on the destination axis.
        await page.locator('.dt-day[data-open-day="0"]').click();
        assert.match(await page.locator('.dt-loose').innerText(),/KST/);
        assert.doesNotMatch(await page.locator('.dt-column').innerText(),/KST/);
        await page.locator('[data-day="4"]').click();
        await page.locator('[data-event="4:1"]').click();
        assert.equal(await page.locator('#daylight-detail').isVisible(),true);
        assert.match(await page.locator('#daylight-detail-body').innerText(),/터미널|게이트/);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#daylight-detail').isVisible(),false);
        assert.equal(await page.locator('[data-event="4:1"]').evaluate(el=>el===document.activeElement),true);
        await page.locator('[data-range=all]').click();
        await page.locator('[data-range="1"]').click();
        assert.equal(await page.locator('[data-day="4"]').getAttribute('aria-pressed'),'true');
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
        await page.screenshot({path:fileURLToPath(new URL(`previews/a-${label}-timetable-day.png`,here))});
        await page.locator('[data-view=list]').click();
        assert.equal(await page.locator('[data-day="4"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.evaluate(()=>JSON.stringify(window.DEMO_TRIP)),snapshot,'Preview navigation never changes trip data');
        if(label==='desktop') {
          const segments=await page.evaluate(()=>{
            const events=trip.days[0].events;
            events.push({time:'23:00~01:30',zone:'PST',title:'자정 연결 검증',warnings:[],photos:[],detail:''});
            try {
              return daylightDays().slice(0,2).map(d=>d.timed.filter(e=>e.title==='자정 연결 검증').map(e=>({start:e.start,end:e.end,continuation:!!e.continuation,key:e.key})));
            } finally { events.pop(); }
          });
          assert.equal(segments[0][0].start,1380);
          assert.equal(segments[0][0].end,1440);
          assert.equal(segments[1][0].start,0);
          assert.equal(segments[1][0].end,90);
          assert.equal(segments[1][0].continuation,true);
          assert.equal(segments[0][0].key,segments[1][0].key,'Continuation opens the original event');
          assert.equal(await page.evaluate(()=>JSON.stringify(window.DEMO_TRIP)),snapshot);
        }
      }
      const nav=width<641?page.locator('.mobile-nav'):page.locator('.main-nav');
      await nav.locator('[data-tab=prep]').click();
      const checkbox=page.locator('[data-check="2"]');
      await checkbox.check();
      assert.equal(await page.locator('#prep-count').innerText(),'5 / 12');
      if(variant==='a'&&width<641){
        await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
        assert.ok(await page.evaluate(()=>window.scrollY)>100);
        await nav.locator('[data-tab=prep]').click();
        assert.equal(await page.evaluate(()=>window.scrollY),0,'Mobile prep navigation also resets scrolling');
        assert.equal(await checkbox.isChecked(),true,'Scroll reset preserves checklist state');
      }
      await nav.locator('[data-tab=ledger]').click();
      await page.locator('#expense-filter').selectOption({label:'숙박'});
      await page.getByRole('heading',{name:'숙박 지출이 없어요'}).waitFor();
      await page.getByRole('button',{name:'전체 내역 보기'}).click();
      assert.equal(await page.locator('.expense-row:not(.table-head)').count(),3);
      if(variant==='a'){
        assert.deepEqual(await page.locator('.category-label').allTextContents(),['교통','식비','식비']);
        for(const category of await page.locator('.category-label').all())assert.equal(await category.isVisible(),true);
        await page.locator('#expense-filter').selectOption({label:'교통'});
        assert.deepEqual(await page.locator('.category-label').allTextContents(),['교통']);
        await page.locator('#expense-filter').selectOption('all');
      }
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
      if(variant==='a') {
        await page.locator('[data-view=timetable]').click();
        await page.locator('[data-range=all]').click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`A timetable ${width} overflow`);
        await page.getByLabel('설정',{exact:true}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`A settings ${width} overflow`);
        await page.getByRole('button',{name:'닫기',exact:true}).click();
        await page.locator(width<641?'.mobile-nav [data-tab=ledger]':'.side-rail [data-tab=ledger]').click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`A ledger ${width} overflow`);
        for(const category of await page.locator('.category-label').all())assert.equal(await category.isVisible(),true);
      }
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
