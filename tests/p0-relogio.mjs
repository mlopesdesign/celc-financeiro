const RealDate=Date;
const fixo=new RealDate(2026,10,10,22,30,0).getTime();
globalThis.Date=new Proxy(RealDate,{
  construct:(alvo,args,novo)=>Reflect.construct(alvo,args.length?args:[fixo],novo),
  apply:()=>new RealDate(fixo).toString(),
  get:(alvo,chave,receptor)=>chave==='now'?()=>fixo:Reflect.get(alvo,chave,receptor)
});
