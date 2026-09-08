/* Shared, deterministic endpoint-label layout for the canvas and image exports. */
(function(root){
  const overlaps=(a,b,gap=4)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
  function layout(labels,obstacles){
    const cells=new Map(),size=128;
    const keys=b=>{const result=[];for(let x=Math.floor((b.x-4)/size);x<=Math.floor((b.x+b.w+4)/size);x++)for(let y=Math.floor((b.y-4)/size);y<=Math.floor((b.y+b.h+4)/size);y++)result.push(x+','+y);return result};
    const insert=b=>keys(b).forEach(k=>{if(!cells.has(k))cells.set(k,[]);cells.get(k).push(b)});
    const free=b=>!keys(b).some(k=>(cells.get(k)||[]).some(o=>overlaps(b,o)));
    obstacles.forEach(insert);
    let farRight=Math.max(0,...obstacles.map(o=>o.x+o.w));
    return labels.map(label=>{
      const {point:p,normal:n,w,h}=label,t={x:-n.y,y:n.x};let box;
      // Try nearby positions on both sides of the outgoing segment, then stagger
      // outward. The entire text rectangle, not just its anchor, must be clear.
      for(let ring=0;ring<64&&!box;ring++){
        const candidates=[];
        for(let depth=0;depth<=ring;depth++){
          const offset=ring-depth;
          for(const sign of offset?[1,-1]:[1]){
            const along=12+depth*24+(Math.abs(n.x)*w+Math.abs(n.y)*h)/2;
            const across=offset*sign*24;
            const candidate={x:p.x+n.x*along+t.x*across-w/2,y:p.y+n.y*along+t.y*across-h/2,w,h};
            candidates.push({box:candidate,score:depth*24+Math.abs(across)*1.1});
          }
        }
        candidates.sort((a,b)=>a.score-b.score);
        box=candidates.find(c=>free(c.box))?.box;
      }
      if(!box)box={x:farRight+20,y:p.y-h/2,w,h};
      farRight=Math.max(farRight,box.x+box.w);insert(box);
      const target={x:Math.max(box.x,Math.min(p.x,box.x+w)),y:Math.max(box.y,Math.min(p.y,box.y+h))};
      return {...label,...box,target};
    });
  }
  const api={layout,overlaps};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.EndpointLabels=api;
})(typeof globalThis==='undefined'?this:globalThis);
