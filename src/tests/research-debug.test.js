import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../components/ResearchDebugPanel.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const module={exports:{}};
vm.runInNewContext(compiled,{exports:module.exports,require});
const {ResearchDebugPanel}=module.exports;

test('development panel is read-only and displays only safe summary fields',()=>{
 const queue={summary:()=>({pending:2,failed:1,last:{status:'failed',http_status:503,error_category:'database',round:2,attempts:3,total_attempts:6,answers:'SHOULD_NOT_RENDER',secret:'SHOULD_NOT_RENDER'}}),subscribe(){return ()=>{};}};
 const html=renderToStaticMarkup(React.createElement(ResearchDebugPanel,{queue}));
 for(const value of ['Research Upload · DEV ONLY','pending: 2','failed: 1','503','database','2/3','3/3','6/9'])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/SHOULD_NOT_RENDER|<button|<input|<form/);
});

test('production artifacts contain no debug panel markup or module; main loads it only under DEV',()=>{
 const main=fs.readFileSync(new URL('../main.tsx',import.meta.url),'utf8');
 assert.match(main,/if\(import\.meta\.env\.DEV\)\{\s*void import\('\.\/components\/ResearchDebugPanel'\)/);
 const assets=new URL('../../dist/assets/',import.meta.url);
 for(const name of fs.readdirSync(assets)){
  assert.ok(!name.includes('ResearchDebugPanel'));
  if(name.endsWith('.js'))assert.doesNotMatch(fs.readFileSync(new URL(name,assets),'utf8'),/data-research-debug|Research Upload · DEV ONLY|上传队列开发面板/);
 }
});

test('development panel updates through subscriptions and unsubscribes on unmount',async()=>{
 const dom=new JSDOM('<div id="debug"></div>');const previous=globalThis.window,previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT;
 globalThis.window=dom.window;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const listeners=new Set();let state={pending:1,failed:0,last:{status:'pending',round:1,attempts:1,total_attempts:1}};
 const queue={summary:()=>state,subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);}};
 const root=createRoot(dom.window.document.getElementById('debug'));
 try{
  await React.act(async()=>root.render(React.createElement(ResearchDebugPanel,{queue})));
  assert.match(dom.window.document.body.textContent,/pending: 1/);
  await React.act(async()=>{state={pending:0,failed:1,last:{status:'failed',http_status:503,error_category:'database',round:3,attempts:3,total_attempts:9}};for(const fn of listeners)fn();});
  const text=dom.window.document.body.textContent;for(const value of ['pending: 0','failed: 1','503','database','9/9'])assert.ok(text.includes(value),value);
 }finally{await React.act(async()=>root.unmount());assert.equal(listeners.size,0);globalThis.window=previous;globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;dom.window.close();}
});
