import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/wasm',{recursive:true});
await copyFile('node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm','public/wasm/libredwg-web.wasm');
for (const name of ['draco_wasm_wrapper.js','draco_decoder.wasm','draco_decoder.js']){await mkdir('public/draco',{recursive:true});await copyFile('node_modules/three/examples/jsm/libs/draco/gltf/'+name,'public/draco/'+name);}
