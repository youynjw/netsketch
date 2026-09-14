(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function svg(project,roomId,face='front'){
    const racks=project.racks.filter(r=>r.roomId===roomId),room=project.rooms.find(r=>r.id===roomId);
    if(!racks.length)throw Error('当前机房没有机柜可导出');
    const unit=24,cardWidth=296,gap=24,columns=Math.min(4,racks.length),padding=24;
    const uses=new Map();for(const d of project.devices)for(const p of d.power)uses.set(`${p.pduId}:${p.outlet}`,{d,p});
    function railHeight(r,side){return project.pdus.filter(p=>p.rackId===r.id&&p.side===side).reduce((n,p)=>n+28+p.count*22+8,0);}
    const heights=racks.map(r=>Math.max(r.units*unit,railHeight(r,'left'),railHeight(r,'right'))+82);
    const rowHeights=[];for(let i=0;i<heights.length;i+=columns)rowHeights.push(Math.max(...heights.slice(i,i+columns)));
    const width=padding*2+columns*cardWidth+(columns-1)*gap,height=110+rowHeights.reduce((s,n)=>s+n+gap,0);
    let parts=[],defs=[],rowY=86;
    const rect=(x,y,w,h,fill,stroke='#e1e6ef',radius=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
    const text=(x,y,value,size=11,color='#34475c',attrs='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${attrs}>${esc(value)}</text>`;
    parts.push(rect(0,0,width,height,'#f5f7fb','#f5f7fb'),text(24,33,project.name,21,'#26364c','font-weight="700"'),text(24,58,`${room?.name||''} · ${face==='rear'?'背面视图（左右镜像）':'正面视图'} · U 位由下向上编号 · 插座跟随设备颜色`,11,'#7b899e'));
    racks.forEach((r,index)=>{
      const col=index%columns,row=Math.floor(index/columns);if(col===0&&row>0)rowY+=rowHeights[row-1]+gap;
      const x=padding+col*(cardWidth+gap),y=rowY,h=heights[index],top=y+48,left=x+49,innerWidth=198;
      const nameClip='rack-name-'+index,metaClip='rack-meta-'+index;
      defs.push(`<clipPath id="${nameClip}">${rect(x+12,y+5,152,29,'white','none')}</clipPath><clipPath id="${metaClip}">${rect(x+172,y+5,112,29,'white','none')}</clipPath>`);
      parts.push(rect(x,y,cardWidth,h,'white','#dbe2ed',10),text(x+12,y+25,r.name,13,'#26364c',`font-weight="600" clip-path="url(#${nameClip})"`),text(x+cardWidth-12,y+25,`${r.location||'未填写位置'} · ${r.units}U`,10,'#8793a5',`text-anchor="end" clip-path="url(#${metaClip})"`));
      parts.push(rect(left,top,innerWidth,r.units*unit,'#f8fafc'));
      for(let u=r.units;u>=1;u--){const uy=top+(r.units-u)*unit;parts.push(rect(left,uy,innerWidth,unit,u%2?'#f1f4f9':'#f8fafc','#e5eaf2'),text(left+10,uy+15,u,9,'#95a0b1','text-anchor="middle"'),text(left+innerWidth-10,uy+15,u,9,'#95a0b1','text-anchor="middle"'));}
      for(const d of project.devices.filter(d=>d.rackId===r.id&&(d.face===face||d.face==='both'))){
        let slot=d.slot||'full';if(face==='rear')slot=slot==='left'?'right':slot==='right'?'left':slot;
        const fullWidth=innerWidth-44,halfWidth=(fullWidth-4)/2,dw=slot==='full'?fullWidth:halfWidth,dx=left+22+(slot==='right'?halfWidth+4:0),dy=top+(r.units-d.u-d.height+1)*unit+1,dh=d.height*unit-2,clip=`device-${index}-${defs.length}`;
        defs.push(`<clipPath id="${clip}">${rect(dx+5,dy+1,dw-10,dh-2,'white','none')}</clipPath>`);
        parts.push(rect(dx,dy,dw,dh,'white',d.color,3),`<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="3" fill="${d.color}" opacity="0.12"/>`,`<rect x="${dx}" y="${dy}" width="3" height="${dh}" fill="${d.color}"/>`,`<g clip-path="url(#${clip})">`,text(dx+7,dy+(d.height>1?dh/2-1:14),d.name,slot==='full'?10:9,'#34475c','font-weight="600"'));
        if(d.height>1)parts.push(text(dx+7,dy+dh/2+13,`${d.model||d.type} · ${d.height}U`,8,'#8793a5'));parts.push('</g>');
      }
      for(const side of ['left','right']){const px=side==='left'?x+10:x+cardWidth-34;let py=top;
        for(const p of project.pdus.filter(p=>p.rackId===r.id&&p.side===side)){
          const clip=`pdu-${index}-${defs.length}`;defs.push(`<clipPath id="${clip}">${rect(px,py,24,20,'white','none')}</clipPath>`);
          parts.push(rect(px-2,py,28,28+p.count*22,'#f5f7fb','#e1e6ef',4),text(px+12,py+14,p.name.replace(/^PDU\s*/i,''),8,'#75839a',`text-anchor="middle" clip-path="url(#${clip})"`));
          for(let n=1;n<=p.count;n++){const use=uses.get(`${p.id}:${n}`),oy=py+23+(n-1)*22,disabled=p.disabled.includes(n);parts.push(`<g><title>${esc(p.name)} / ${n}：${esc(use?`${use.d.name} / ${use.p.label}`:disabled?'停用':'空闲')}</title>`,rect(px+2,oy,20,18,use?use.d.color:disabled?'#e3e7ed':'white',use?use.d.color:'#dce2ed',3),text(px+12,oy+12,n,8,use?'white':'#8995a8','text-anchor="middle"'));if(disabled)parts.push(`<path d="M${px+4} ${oy+15}l16 -12" stroke="#a6b1c0"/>`);parts.push('</g>');}py+=36+p.count*22;
        }
      }
      parts.push(text(x+15,y+h-14,`${project.devices.filter(d=>d.rackId===r.id).length} 台设备`,10,'#8793a5'));
    });
    return {width,height,content:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI, Microsoft YaHei, sans-serif"><defs>${defs.join('')}</defs>${parts.join('')}</svg>`};
  }
  const api={svg};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RackExport=api;
})(globalThis);
