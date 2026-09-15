(function(root){
  'use strict';
  const TYPES=['服务器','交换机','路由器','防火墙','VPN 网关','运营商光猫 / Modem','无线控制器 / AC','上网行为管理','存储 / NAS','监控录像机','KVM 切换器','显示器','配线架','光纤配线架 / ODF','光纤收发器','UPS','PDU','光纤设备','理线架','盲板','其他'];
  const COLORS=['#5865dc','#169e91','#de9a32','#b56ecb','#5e82b6','#8793a5'];
  function id(){return globalThis.crypto?.randomUUID?.()||`r${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;}
  function empty(){return {format:'netsketch-racks',version:1,name:'机房落位记录',rooms:[],racks:[],devices:[],pdus:[]};}
  function integer(n,min,max){return Number.isInteger(n)&&n>=min&&n<=max;}
  function sameFace(a,b){return a==='both'||b==='both'||a===b;}
  function sameSlot(a='full',b='full'){return a==='full'||b==='full'||a===b;}
  function placementError(project,device){
    const rack=project.racks.find(r=>r.id===device.rackId);
    if(!rack)return '请选择有效机柜';
    if(!integer(device.u,1,rack.units)||!integer(device.height,1,rack.units)||device.u+device.height-1>rack.units)return '设备超出机柜 U 位范围';
    if(!['front','rear','both'].includes(device.face))return '请选择设备占用面';
    if(!['full','left','right'].includes(device.slot||'full'))return '请选择设备宽度位置';
    const conflict=project.devices.find(d=>d.id!==device.id&&d.rackId===device.rackId&&sameFace(d.face,device.face)&&sameSlot(d.slot,device.slot)&&d.u<device.u+device.height&&device.u<d.u+d.height);
    return conflict?`U 位已被「${conflict.name}」占用`:'';
  }
  function outletUse(project,pduId,outlet,exceptDevice){
    for(const d of project.devices){if(d.id===exceptDevice)continue;for(const p of d.power||[])if(p.pduId===pduId&&p.outlet===outlet)return {device:d,power:p};}
    for(const d of project.pdus){if(d.id!==exceptDevice&&d.input?.pduId===pduId&&d.input.outlet===outlet)return {kind:'pdu',device:{...d,color:d.color||'#8793a5'},power:d.input};}
    return null;
  }
  function powerError(project,device){
    const seen=new Set(),labels=new Set();
    for(const p of device.power||[]){
      if(!p.label?.trim())return '请填写电源接口名称';
      const label=p.label.trim().toLowerCase();
      if(labels.has(label))return `电源接口「${p.label}」已连接，请使用不同接口名称`;
      labels.add(label);
      const pdu=project.pdus.find(x=>x.id===p.pduId);
      if(!pdu||pdu.rackId!==device.rackId)return '电源连接必须选择本机柜的 PDU';
      if(!integer(p.outlet,1,pdu.count))return '请选择有效插座号';
      const key=`${p.pduId}:${p.outlet}`;
      if(seen.has(key)||outletUse(project,p.pduId,p.outlet,device.id))return `插座「${pdu.name} / ${p.outlet}」已被占用`;
      seen.add(key);
      if(pdu.disabled.includes(p.outlet))return `插座「${pdu.name} / ${p.outlet}」已停用`;
    }
    return '';
  }
  function defaultPower(project,device,pduId,outlet){
    const pdu=project.pdus.find(p=>p.id===pduId);if(!pdu||pdu.rackId!==device.rackId)throw Error('请选择同一机柜内的 PDU');
    if(outlet===undefined){outlet=Array.from({length:pdu.count},(_,i)=>i+1).find(n=>!pdu.disabled.includes(n)&&!outletUse(project,pdu.id,n));if(outlet===undefined)throw Error('此 PDU 没有空闲可用插座');}
    let number=1;while(device.power.some(p=>p.label.trim().toLowerCase()==='psu'+number))number++;
    const power={label:'PSU'+number,pduId,outlet,notes:''};const error=powerError(project,{...device,power:[...device.power,power]});if(error)throw Error(error);return power;
  }
  function pduInputError(project,pdu,input){
    if(!input||input.label!=='INPUT'||typeof input.pduId!=='string')return 'PDU 输入配置无效';
    const parent=project.pdus.find(p=>p.id===input.pduId);
    if(!parent)return '请选择有效的上级 PDU';
    const seen=new Set([pdu.id]);let current=parent;
    while(current){if(seen.has(current.id))return 'PDU 不能连接自己或形成循环连接';seen.add(current.id);current=project.pdus.find(p=>p.id===current.input?.pduId);}
    if(!integer(input.outlet,1,parent.count))return '请选择有效插座号';
    if(parent.disabled.includes(input.outlet))return '此插座已停用';
    if(outletUse(project,parent.id,input.outlet,pdu.id))return '此插座已被占用';
    return '';
  }
  function defaultPduInput(project,pdu,pduId,outlet){
    const parent=project.pdus.find(p=>p.id===pduId);if(!parent)throw Error('请选择有效的上级 PDU');
    if(outlet===undefined)outlet=Array.from({length:parent.count},(_,i)=>i+1).find(n=>!parent.disabled.includes(n)&&!outletUse(project,pduId,n,pdu.id));
    if(outlet===undefined)throw Error('此 PDU 没有空闲可用插座');
    const input={label:'INPUT',pduId,outlet,notes:''},error=pduInputError(project,pdu,input);if(error)throw Error(error);return input;
  }
  function usedUnits(project,rackId){const used=new Set();for(const d of project.devices.filter(d=>d.rackId===rackId))for(let u=d.u;u<d.u+d.height;u++)used.add(u);return used.size;}
  function validate(raw){
    if(!raw||raw.format!=='netsketch-racks'||raw.version!==1)throw Error('请选择机柜管理项目文件（.racks.json），拓扑项目请在拓扑页面打开');
    const p=JSON.parse(JSON.stringify(raw));
    if(typeof p.name!=='string'||p.name.length>200)throw Error('项目名称无效');
    for(const key of ['rooms','racks','devices','pdus'])if(!Array.isArray(p[key])||p[key].length>10000)throw Error('项目数据格式或数量无效');
    const ids=new Set();
    function common(x){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>200)throw Error('记录名称或编号无效');ids.add(x.id);}
    function strings(x,keys){for(const k of keys){if(x[k]===undefined)x[k]='';if(typeof x[k]!=='string'||x[k].length>10000)throw Error('属性文本格式无效');}}
    for(const r of p.rooms)common(r);
    for(const r of p.racks){common(r);strings(r,['location','notes','length']);if(!p.rooms.some(x=>x.id===r.roomId)||!integer(r.units,1,60))throw Error('机柜所属机房或高度无效');}
    for(const x of p.pdus){common(x);strings(x,['feed','model','rated','notes']);if(!p.racks.some(r=>r.id===x.rackId)||!integer(x.count,1,64)||!['left','right'].includes(x.side)||!['C13','C19','国标五孔','混合 / 其他'].includes(x.socketType))throw Error('PDU 配置无效');if(!Array.isArray(x.disabled)||x.disabled.some(n=>!integer(n,1,x.count))||new Set(x.disabled).size!==x.disabled.length)throw Error('停用插座配置无效');}
    for(const x of p.pdus){if(x.color!==undefined&&!/^#[\da-f]{6}$/i.test(x.color))throw Error('PDU 颜色无效');if(x.input!=null){const err=pduInputError(p,x,x.input);if(err)throw Error(x.name+'：'+err);strings(x.input,['notes']);}}
    for(const d of p.devices){common(d);if(d.slot===undefined)d.slot='full';strings(d,['type','brand','model','serial','ip','owner','notes']);if(!/^#[\da-f]{6}$/i.test(d.color))throw Error('设备颜色无效');if(!Array.isArray(d.power)||d.power.length>32)throw Error('电源接口配置无效');for(const power of d.power){if(!power||typeof power.label!=='string'||typeof power.pduId!=='string')throw Error('电源接口配置无效');strings(power,['notes']);}const err=placementError(p,d)||powerError(p,d);if(err)throw Error(`${d.name}：${err}`);}
    return p;
  }
  function demo(){
    const p=empty();p.name='三楼机房 · 落位记录';p.rooms=[{id:'room-demo',name:'三楼机房'}];
    p.racks=[1,2,3].map(n=>({id:`rack-${n}`,roomId:'room-demo',name:`3F 机柜 ${String(n).padStart(2,'0')}`,units:42,location:n===1?'服务器区':n===2?'网络区':'预留区',notes:''}));
    for(const rack of p.racks)for(const [i,side] of ['left','right'].entries())p.pdus.push({id:`${rack.id}-${i}`,rackId:rack.id,name:`PDU ${i?'B':'A'}`,feed:`${i?'B':'A'} 路 UPS`,model:'',rated:'16 A',side,count:12,socketType:'C13',disabled:[],notes:''});
    const data=[['rack-1','超融合接入交换机 A',41,1,'交换机'],['rack-1','超融合接入交换机 B',39,1,'交换机'],['rack-1','Dell R730 · 01',25,2,'服务器'],['rack-1','Dell R730 · 02',20,2,'服务器'],['rack-1','超融合服务器 01',12,2,'服务器'],['rack-1','超融合服务器 02',9,2,'服务器'],['rack-1','超融合服务器 03',6,2,'服务器'],['rack-2','光纤配线架',42,1,'配线架'],['rack-2','防火墙',40,2,'防火墙'],['rack-2','核心交换机',38,2,'交换机'],['rack-2','接入交换机 01',36,1,'交换机'],['rack-2','接入交换机 02',34,1,'交换机'],['rack-2','管理交换机',32,1,'交换机'],['rack-2','监控交换机',30,1,'交换机'],['rack-2','NVR 02',20,2,'监控录像机'],['rack-2','NVR 01',17,2,'监控录像机'],['rack-2','NVR 03',15,2,'监控录像机']];
    const next={};
    p.devices=data.map(([rackId,name,u,height,type],i)=>{const color=type==='交换机'?COLORS[1]:type==='防火墙'?COLORS[2]:type==='监控录像机'?COLORS[3]:COLORS[0];const outlet=(next[rackId]||0)+1;next[rackId]=outlet;return {id:`device-${i}`,rackId,name,u,height,type,face:'both',slot:'full',brand:'',model:name.includes('Dell')?'PowerEdge R730':'',serial:'',ip:'',owner:'IT',notes:'',color,power:type==='配线架'?[]:[{label:'PSU1',pduId:`${rackId}-0`,outlet,notes:''},...(type==='服务器'?[{label:'PSU2',pduId:`${rackId}-1`,outlet,notes:''}]:[])]};});
    return validate(p);
  }
  function csv(project){
    const rows=[['机房','机柜','位置','设备名称','起始 U（顶部）','高度 U','占用面','宽度位置','类型','品牌','型号','序列号','管理 IP','归属','电源接口','PDU','供电来源','插座号','插座类型','电源备注','设备备注']];
    for(const d of project.devices){const r=project.racks.find(x=>x.id===d.rackId);const room=project.rooms.find(x=>x.id===r.roomId);for(const power of d.power.length?d.power:[null]){const p=project.pdus.find(x=>x.id===power?.pduId);rows.push([room.name,r.name,r.location,d.name,d.u+d.height-1,d.height,{both:'前后贯通',front:'仅前侧',rear:'仅后侧'}[d.face],{full:'全宽',left:'左半宽',right:'右半宽'}[d.slot||'full'],d.type,d.brand,d.model,d.serial,d.ip,d.owner,power?.label,p?.name,p?.feed,power?.outlet,p?.socketType,power?.notes,d.notes]);}}
    for(const d of project.pdus.filter(d=>d.input)){const r=project.racks.find(r=>r.id===d.rackId),room=project.rooms.find(x=>x.id===r.roomId),up=project.pdus.find(x=>x.id===d.input.pduId),ur=project.racks.find(x=>x.id===up.rackId);rows.push([room.name,r.name,r.location,d.name,'','','','','PDU','',d.model,'','','','INPUT',ur.name+' / '+up.name,up.feed,d.input.outlet,up.socketType,d.input.notes,d.notes]);}
    const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
  }
  const api={TYPES,COLORS,id,empty,placementError,powerError,outletUse,defaultPower,pduInputError,defaultPduInput,usedUnits,validate,demo,csv};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RackModel=api;
})(globalThis);
