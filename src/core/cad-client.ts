import type {CadResult,ExactPair,FeatureProperties,Pick} from './types';
class CadClient {
 private worker?:Worker; private serial=0;private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 private call<T>(action:string,payload:unknown,transfer:Transferable[]=[]):Promise<T>{
  if(!this.worker){this.worker=new Worker(new URL('../workers/cad.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(p){this.pending.delete(data.id);data.error?p.reject(new Error(data.error)):p.resolve(data.result)}};this.worker.onerror=(e)=>this.cancel(e.message||'CAD engine failed');}
  return new Promise((resolve,reject)=>{const id=++this.serial;this.pending.set(id,{resolve,reject});this.worker!.postMessage({id,action,payload},transfer)})
 }
 open(format:string,buffer:ArrayBuffer,quality='balanced'){return this.call<CadResult>('open',{format,buffer,quality},[buffer])}
 properties(modelId:number,pick:Pick){return this.call<FeatureProperties>('properties',{modelId,pick})}
 pair(modelId:number,a:Pick,b:Pick){return this.call<ExactPair>('pair',{modelId,a,b})}
 release(modelId:number){return this.call('release',{modelId})}
 cancel(reason='Import canceled'){this.worker?.terminate();this.worker=undefined;for(const p of this.pending.values())p.reject(new Error(reason));this.pending.clear()}
}
export const cad=new CadClient();
