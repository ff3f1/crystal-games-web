const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path');
(async()=>{
 const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 if(!chrome)throw Error('Chrome not installed');
 fs.mkdirSync('dist/screens',{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:540,height:960},deviceScaleFactor:2});
 await page.goto('file://'+path.resolve('ghost-reel.html'));
 await page.waitForTimeout(400);
 await page.screenshot({path:'dist/screens/01-home.png',animations:'disabled'});
 await page.evaluate(()=>{
   document.body.dataset.page='studio';document.getElementById('studioTitle').textContent='Повторить фото';
   document.getElementById('camTag').textContent='ДЕМО';document.getElementById('hint').textContent='Совмести позу с призраком';
   const make=(color,shift,up)=>{const c=document.createElement('canvas');c.width=360;c.height=640;const x=c.getContext('2d');x.fillStyle='#1b3649';x.fillRect(0,0,360,640);x.fillStyle=color;x.beginPath();x.arc(164+shift,225-up,57,0,7);x.fill();x.beginPath();x.roundRect(80+shift,286-up,174,320,70);x.fill();x.strokeStyle=color;x.lineWidth=30;x.lineCap='round';x.beginPath();x.moveTo(93+shift,338-up);x.lineTo(38,265);x.moveTo(230+shift,338-up);x.lineTo(306,265);x.stroke();return c.toDataURL();};
   const cam=document.getElementById('camera');cam.poster=make('#819cae',-12,0);cam.style.display='block';
   const ghost=document.getElementById('ghostImg');ghost.src=make('#bdfb86',17,29);ghost.style.display='block';
   document.getElementById('ghostLayer').style.opacity='.46';
   document.getElementById('refMeta').textContent='Демонстрационный образец';
   document.getElementById('message').textContent='Экран приложения с демонстрационным кадром.';
 });
 await page.waitForTimeout(300);
 await page.screenshot({path:'dist/screens/02-studio-demo.png',animations:'disabled'});
 await page.evaluate(()=>{
   document.getElementById('studioTitle').textContent='Результат';
   document.getElementById('photoResult').src=document.getElementById('ghostImg').src;
   document.getElementById('photoResult').style.display='block';
   document.getElementById('downloadPhoto').style.display='block';
   document.getElementById('message').textContent='Демонстрация результата: сохранение фото и коллажа.';
   window.scrollTo(0,420);
 });
 await page.waitForTimeout(300);
 await page.screenshot({path:'dist/screens/03-result-demo.png',animations:'disabled'});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
