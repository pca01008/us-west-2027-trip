/** Synchronous identities keep comparisons local, including embedded offline photos. */
function createPhotoResources({SUPABASE_URL,MEDIA_BUCKET,baseUrl}){
  // SHA-256 over decoded bytes matches the immutable filenames used by photo-service.
  function digestDataUrl(value){
    const match=/^data:image\/(?:webp|jpeg|png);base64,([\s\S]*)$/i.exec(value);
    if(!match)return '';
    let binary;try{binary=atob(match[1].replace(/\s/g,''));}catch(_){return '';}
    const length=binary.length,bytes=new Uint8Array(Math.ceil((length+9)/64)*64);
    for(let i=0;i<length;i++)bytes[i]=binary.charCodeAt(i);
    bytes[length]=128;
    const view=new DataView(bytes.buffer);view.setUint32(bytes.length-8,Math.floor(length/0x20000000));view.setUint32(bytes.length-4,length*8);
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const rotate=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);
    for(let offset=0;offset<bytes.length;offset+=64){
      for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
      for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(rotate(x,7)^rotate(x,18)^(x>>>3))+w[i-16]+(rotate(y,17)^rotate(y,19)^(y>>>10))+w[i-7];}
      let [a,b,c,d,e,f,g,j]=h;
      for(let i=0;i<64;i++){
        const t1=j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]+w[i];
        const t2=(rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c));
        j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
      }
      [a,b,c,d,e,f,g,j].forEach((value,i)=>{h[i]=(h[i]+value)>>>0;});
    }
    return 'sha256:'+h.map(value=>value.toString(16).padStart(8,'0')).join('');
  }
  function resource(value){
    value=String(value||'').trim();if(!value)return '';
    if(/^data:/i.test(value))return digestDataUrl(value)||value;
    try{
      const base=new URL(baseUrl),url=new URL(value,base),storage=new URL(SUPABASE_URL);
      const prefix='/storage/v1/object/public/'+MEDIA_BUCKET+'/';
      let path='';
      if(url.origin===storage.origin&&url.pathname.startsWith(prefix))path=decodeURIComponent(url.pathname.slice(prefix.length));
      else if(!/^[a-z]+:|^\//i.test(value)&&/^[a-z0-9-]+\/(?:photos|thumbs)\//.test(value))path=value.split(/[?#]/)[0];
      if(path){const hash=/\/(?:photos|thumbs)\/([a-f0-9]{64})\.(?:webp|jpg|jpeg|png)$/i.exec(path);return hash?'sha256:'+hash[1].toLowerCase():'storage:'+MEDIA_BUCKET+'/'+path;}
      const assets=new URL('assets/',base);
      if(url.origin===assets.origin&&url.pathname.startsWith(assets.pathname))return 'asset:assets/'+decodeURIComponent(url.pathname.slice(assets.pathname.length));
      return url.href;
    }catch(_){return value;}
  }
  function imageResource(img,slot,path=''){
    const raw=slot==='full'?(img?.getAttribute('data-full-url')||img?.getAttribute('src')):img?.getAttribute('src');
    const identity=resource(raw),source=img?.getAttribute('data-'+slot+'-source')||'';
    // Export links are valid only while the embedded bytes match their recorded digest.
    const stable=identity.startsWith('sha256:')&&img?.getAttribute('data-'+slot+'-digest')===identity&&/^(?:asset:assets\/|storage:)/.test(source)?source:identity;
    const stored=resource(path);
    if(!identity)return stored;
    return stored&&stored!==identity&&stored!==stable?JSON.stringify([stable,stored]):stable;
  }
  function embedResource(img,slot,original,embedded){
    const identity=imageResource(img,slot)||resource(original),digest=digestDataUrl(embedded);
    if(/^(?:asset:assets\/|storage:)/.test(identity)&&digest){img.setAttribute('data-'+slot+'-source',identity);img.setAttribute('data-'+slot+'-digest',digest);}
    else{img.removeAttribute('data-'+slot+'-source');img.removeAttribute('data-'+slot+'-digest');}
  }
  return Object.freeze({resource,imageResource,embedResource});
}
