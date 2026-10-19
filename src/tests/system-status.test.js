import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import * as i18n from '../i18n/index.js';
import * as statusModule from '../scoring/status.js';
const source=fs.readFileSync(new URL('../components/SystemStatus.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const module={exports:{}};
vm.runInNewContext(compiled,{exports:module.exports,require:name=>({'react':React,'../i18n/index.js':i18n,'../scoring/status.js':statusModule}[name])});
const totals={ACT:1,RESET:2,SOCIAL:3,LUCKY:4,THINK:5,SAVE:6};

test('English status and TOP 3 display each mechanism name once with its canonical ID',()=>{
 i18n.setLocale('en');
 try{
  const dom=new JSDOM(renderToStaticMarkup(React.createElement(module.exports.SystemStatus,{totals,insufficient:false})));
  for(const [i,a] of statusModule.systemStatus(totals).attributes.entries()){
   const label=dom.window.document.querySelectorAll('.attribute-row > span')[i];
   assert.equal(label.textContent,`${a.key} · ${a.english}`);assert.equal(label.querySelector('small'),null);
  }
  for(const a of statusModule.systemStatus(totals).top)assert.ok(dom.window.document.querySelector('.top-attributes').textContent.includes(`${a.key} · ${a.english}`));
  dom.window.close();
 }finally{i18n.setLocale('zh');}
});

test('Chinese status preserves the Chinese label and original English subtitle',()=>{
 i18n.setLocale('zh');
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(module.exports.SystemStatus,{totals,insufficient:false})));
 for(const [i,a] of statusModule.systemStatus(totals).attributes.entries()){
  const label=dom.window.document.querySelectorAll('.attribute-row > span')[i];
  assert.equal(label.textContent,`${a.key} ${a.label}${a.english}`);assert.equal(label.querySelector('small').textContent,a.english);
 }
 dom.window.close();
});
