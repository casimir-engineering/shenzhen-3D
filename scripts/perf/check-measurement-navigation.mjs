import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const software = process.argv.includes('--software');
const browser = await chromium.launch({headless:software,args:['--use-gl=angle',software?'--use-angle=swiftshader':'--use-angle=metal',...(software?['--enable-unsafe-swiftshader']:[])]});
const page = await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:1});
const checks=[], errors=[];
const check = (condition,name) => {expect(condition,name).toBe(true);checks.push(name);};
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const state = () => page.evaluate(()=>window.measurementNavigation.snapshot());
const close = (a,b,tolerance=1e-6) => a.length===b.length&&a.every((value,index)=>Math.abs(value-b[index])<tolerance);
try {
  await page.goto(`${process.env.PERF_BASE_URL||'http://127.0.0.1:1420'}/tests/perf/measurement-navigation.html`);
  await page.waitForFunction(()=>!!window.measurementNavigation);
  // The first request can discover a newly added dev-harness dependency. Reload
  // after prebundling settles so Vite's optimization reload cannot interrupt a drag.
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.measurementNavigation);
  await page.bringToFront();
  const renderer = await page.evaluate(()=>{const gl=window.measurementNavigation.viewer.renderer.getContext();const debug=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);});
  if(!software) check(/Apple.*Metal|ANGLE.*Apple/i.test(renderer)&&!/SwiftShader/i.test(renderer),'Actual Apple hardware renderer');
  for(const is2D of [false,true]) for(const orthographic of [false,true]) {
    const initial=await page.evaluate(({is2D,orthographic})=>window.measurementNavigation.reset(is2D,orthographic),{is2D,orthographic});
    const mode=`${is2D?'2D':'3D'} ${orthographic?'orthographic':'perspective'}`;
    const drag=async(button,dx=60,dy=35)=>{await page.mouse.move(500,350);await page.mouse.down({button});await page.mouse.move(500+dx,350+dy,{steps:5});await page.mouse.up({button});return state();};
    const left=await drag('left');
    check(is2D ? close(left.quaternion,initial.quaternion)&&!close(left.target,initial.target) : !close(left.quaternion,initial.quaternion)&&close(left.target,initial.target),`${mode}: left drag still ${is2D?'pans':'orbits'}`);
    await page.evaluate(initial=>window.measurementNavigation.restore(initial),initial);
    const middle=await drag('middle');
    check(close(middle.quaternion,initial.quaternion)&&Math.abs(middle.distance-initial.distance)<1e-6&&middle.zoom===initial.zoom,`${mode}: middle drag preserves orientation, distance and zoom`);
    const cameraTranslation=middle.position.map((value,index)=>value-initial.position[index]);
    const targetTranslation=middle.target.map((value,index)=>value-initial.target[index]);
    check(Math.hypot(...cameraTranslation)>1e-6&&close(cameraTranslation,targetTranslation),`${mode}: middle drag translates camera and target together`);
    await page.evaluate(initial=>window.measurementNavigation.restore(initial),initial);
    // Wheel deltas describe scrolling, opposite a grabbed surface's drag direction.
    await page.mouse.wheel(-60,-35);
    await page.waitForTimeout(40);
    const swiped=await state();
    const wheel=await page.evaluate(()=>window.measurementNavigation.wheelSample());
    check(wheel.deltaMode===0&&wheel.deltaX<0&&wheel.deltaY<0,`${mode}: actual trackpad event carries negative pixel scroll deltas`);
    await page.evaluate(initial=>window.measurementNavigation.restore(initial),initial);
    // CDP wheel scaling varies by host display. Compare the actual DOM pixel
    // deltas with an equally sized surface drag, rather than assumed input units.
    const matchingMiddle=await drag('middle',-wheel.deltaX,-wheel.deltaY);
    check(close(matchingMiddle.position,swiped.position)&&close(matchingMiddle.target,swiped.target)&&close(matchingMiddle.quaternion,swiped.quaternion)&&matchingMiddle.zoom===swiped.zoom,`${mode}: middle drag matches oppositely signed trackpad scrolling`);
    check(middle.picks===0&&left.picks===0&&swiped.picks===0&&matchingMiddle.picks===0,`${mode}: navigation does not select geometry`);
  }
  await page.evaluate(()=>window.measurementNavigation.reset());
  await page.mouse.move(500,350);
  const before=await state();
  await page.mouse.wheel(14.5,22.5);
  await page.waitForTimeout(40);
  const panned=await state();
  check(!close(before.target,panned.target)&&Math.abs(before.distance-panned.distance)<1e-6&&before.zoom===panned.zoom,'Smooth two-finger swipe pans without zoom');
  check(close(before.quaternion,panned.quaternion),'Two-finger pan preserves orientation');
  await page.locator('canvas').dispatchEvent('wheel',{deltaY:-2,deltaX:0,deltaMode:0,ctrlKey:true});
  const pinched=await state();
  check(pinched.distance<panned.distance,'Ctrl+wheel pinch zooms');
  await page.waitForTimeout(200);
  await page.mouse.wheel(0,100);
  await page.waitForTimeout(40);
  const wheeled=await state();
  check(wheeled.distance>pinched.distance,'Discrete mouse wheel remains zoom');
  const sensitivity=[];
  for(const orthographic of [false,true]) for(const pinch of [false,true]) {
    const initial=await page.evaluate(orthographic=>window.measurementNavigation.reset(false,orthographic),orthographic);
    const configuredSpeed=await page.evaluate(()=>window.measurementNavigation.viewer.controls.zoomSpeed);
    const response=async speed=>{
      await page.evaluate(({initial,speed})=>{const fixture=window.measurementNavigation;fixture.restore(initial);fixture.viewer.controls.zoomSpeed=speed;},{initial,speed});
      await page.mouse.move(500,350);
      if(pinch) await page.locator('canvas').dispatchEvent('wheel',{deltaY:-2,deltaX:0,deltaMode:0,ctrlKey:true,clientX:500,clientY:350});
      else {await page.waitForTimeout(200);await page.mouse.wheel(0,100);}
      await page.waitForTimeout(40);
      const after=await state();
      return Math.abs(Math.log(orthographic?after.zoom/initial.zoom:after.distance/initial.distance));
    };
    const previous=await response(1.1),current=await response(configuredSpeed);
    check(current>previous+1e-8&&current<previous*1.5,`${orthographic?'Orthographic':'Perspective'} ${pinch?'pinch':'wheel'} zoom is modestly more sensitive for identical input`);
    sensitivity.push({projection:orthographic?'orthographic':'perspective',input:pinch?'pinch':'wheel',previous,current,ratio:current/previous});
  }
  await page.evaluate(()=>window.measurementNavigation.reset());
  await page.mouse.move(500,350);await page.mouse.down();await page.mouse.move(550,350,{steps:3});await page.mouse.move(500,350,{steps:3});await page.mouse.up();
  check((await state()).picks===0,'Drag returning to its starting position does not create a selection');
  await page.mouse.click(500,350);
  check((await state()).picks===1,'Ordinary surface click still selects');
  const overlay=await page.evaluate(async()=>{
    const v=window.measurementNavigation.viewer;
    v.setOverlay({points:[[0,0,0],[4,-3,2]],path:[[0,0,0],[4,-3,2]],text:'5.385 mm',axisTexts:['ΔX 4 mm','ΔY −3 mm','ΔZ 2 mm']});
    await new Promise(r=>requestAnimationFrame(r));
    return [...v.overlay.children].filter(o=>o.name.startsWith('measurement-axis')).map(o=>({name:o.name,vertices:[...o.geometry.attributes.position.array],color:o.material.color.getHexString(),dashed:o.material.isLineDashedMaterial,depthTest:o.material.depthTest}));
  });
  check(overlay.length===3&&overlay.every(line=>line.dashed&&!line.depthTest),'Three independent dashed components remain readable over geometry');
  check(overlay.map(line=>line.color).join(',')==='ff7373,45db8d,63aaff','Dark-scene axis lines use legible saturated red/green/blue');
  expect(overlay.map(line=>line.vertices)).toEqual([[0,0,0,4,0,0],[4,0,0,4,-3,0],[4,-3,0,4,-3,2]]);
  checks.push('Exact connector receives signed XYZ orthogonal route');
  for(const [axis,text] of [['x','ΔX 4 mm'],['y','ΔY −3 mm'],['z','ΔZ 2 mm']]) await expect(page.locator(`.dimension-axis-label[data-axis=${axis}]`)).toHaveText(text);
  await expect(page.locator('.dimension-axis-label:not([hidden])')).toHaveCount(3);
  const placements=await page.evaluate(()=>{const v=window.measurementNavigation.viewer;return v.axisLabels.map((label,index)=>{const p=v.axisMidpoints[index].clone().project(v.camera),anchor=v.labelLayout[index+1];return Math.abs(anchor.anchorX-(p.x*.5+.5)*1000)<.01&&Math.abs(anchor.anchorY-(-p.y*.5+.5)*700)<.01;});});
  check(placements.every(Boolean),'Each axis label retains its projected segment midpoint anchor');
  const readable=await page.evaluate(()=>{const labels=[...document.querySelectorAll('.dimension-label:not([hidden])')].map(label=>label.getBoundingClientRect());return labels.every((a,i)=>a.left>=0&&a.top>=0&&a.right<=1000&&a.bottom<=700&&labels.slice(0,i).every(b=>a.right+7.9<=b.left||b.right+7.9<=a.left||a.bottom+7.9<=b.top||b.bottom+7.9<=a.top));});
  check(readable,'Crowded midpoint labels remain separated by eight pixels and clamped to viewport');
  const dash=await page.evaluate(async()=>{const v=window.measurementNavigation.viewer,first=v.axisLines[0].material.dashSize;v.zoom(2);await new Promise(r=>requestAnimationFrame(r));const pixel=v.worldPerPixel(),material=v.axisLines[0].material,valid=Math.abs(material.dashSize/pixel-7)<1e-6&&Math.abs(material.gapSize/pixel-4)<1e-6&&material.dashSize<first;v.zoom(.5);await new Promise(r=>requestAnimationFrame(r));return valid;});
  check(dash,'Dash and gap track seven and four pixels when zoom changes');
  const exported=await page.evaluate(async()=>{const blob=await window.measurementNavigation.viewer.screenshot();return {type:blob.type,size:blob.size};});
  check(exported.type==='image/png'&&exported.size>1000,'PNG includes the measured viewport and component labels');
  await fs.mkdir('artifacts/perf',{recursive:true});
  await page.screenshot({path:'artifacts/perf/measurement-navigation.png'});
  const light=await page.evaluate(async()=>{document.documentElement.dataset.theme='light';const v=window.measurementNavigation.viewer;v.applyOptions({...v.options,theme:'light'});await new Promise(r=>requestAnimationFrame(r));return {lines:v.axisLines.map(line=>line.material.color.getHexString()),labels:v.axisLabels.map(label=>getComputedStyle(label).color)};});
  check(light.lines.join(',')==='a94e4e,247a50,396caa'&&light.labels.join(',')==='rgb(169, 78, 78),rgb(36, 122, 80),rgb(57, 108, 170)','Light theme preserves matched axis line and label colors');
  await page.screenshot({path:'artifacts/perf/measurement-navigation-light.png'});
  await page.evaluate(()=>window.measurementNavigation.viewer.setOverlay({points:[[0,0,0],[0,0,2]],text:'2mm',axisTexts:['ΔX 0','ΔY 0','ΔZ 2']}));
  await expect(page.locator('.dimension-axis-label:not([hidden])')).toHaveCount(1);
  check(await page.evaluate(()=>window.measurementNavigation.viewer.axisLines.length)===1,'Zero-length X and Y components are omitted');
  await page.evaluate(()=>window.measurementNavigation.viewer.setOverlay({points:[[0,0,0],[4,-3,2]],path:[[0,0,0],[2,1,3],[4,-3,2]],axisTexts:['X','Y','Z']}));
  check(await page.evaluate(()=>window.measurementNavigation.viewer.axisLines.length)===0,'Geodesic paths do not acquire orthogonal components');
  await page.evaluate(()=>window.measurementNavigation.viewer.setOverlay({points:[[0,0,0],[4,-3,2]],showAxes:false}));
  check(await page.evaluate(()=>window.measurementNavigation.viewer.axisLines.length)===0,'App can explicitly suppress clearance or other component guides');
  expect(errors).toEqual([]);
  const report={date:new Date().toISOString(),renderer,checks,zoomSensitivity:sensitivity,errors};
  await fs.writeFile('artifacts/perf/measurement-navigation.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
