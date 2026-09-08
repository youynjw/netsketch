const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('app.js','utf8');
const context=vm.createContext({types:{switch:[],server:[]}});
vm.runInContext(source.slice(source.indexOf('function assetDefaults('),source.indexOf('function assetFields(')),context);
vm.runInContext(source.slice(source.indexOf('function validate('),source.indexOf("$('#fileInput').onchange")),context);
function project(){return {version:1,name:'测试拓扑',cables:[{id:'cat6',name:'六类网线',color:'#5683e8'}],nodes:[{id:'a',name:'交换机',type:'switch',brand:'',model:'',x:0,y:0,ports:[{id:'ap',name:'GE1',kind:'RJ45'}]},{id:'b',name:'服务器',type:'server',brand:'',model:'',x:300,y:0,ports:[{id:'bp',name:'ETH1',kind:'RJ45'}]}],edges:[{id:'e',from:'a',fromPort:'ap',to:'b',toPort:'bp',cable:'cat6'}]}}
test('有效项目可 JSON 往返且保留端口连接',()=>assert.equal(context.validate(JSON.parse(JSON.stringify(project()))).edges[0].fromPort,'ap'));
test('旧项目自动补齐资产字段并保持原端口',()=>{const p=context.validate(project());for(const value of Object.keys(context.assetDefaults()))assert.equal(p.nodes[0][value],'');assert.equal(p.nodes[0].ports[0].name,'GE1')});
test('设备资产信息经保存打开完整保留',()=>{const p=project();Object.assign(p.nodes[0],{purpose:'核心交换',managementIp:'192.168.10.1',serialNumber:'SN-001',managementProtocol:'HTTPS / SSH',managementPort:'443 / 22',physicalLocation:'机房 A01 / U12',owner:'信息部',supplier:'设备供应商',rackDate:'2026-09-08',warranty:'三年原厂保修\n含上门服务',warrantyUntil:'2029-09-08',notes:'生产设备\n维护前通知'});const expected=JSON.stringify(p.nodes[0]);assert.equal(JSON.stringify(context.validate(JSON.parse(JSON.stringify(p))).nodes[0]),expected.replace(/}$/,',"expanded":false}'))});
test('拒绝非法资产字段，允许多行长备注',()=>{const p=project();p.nodes[0].notes='维护记录\n'.repeat(100);assert.doesNotThrow(()=>context.validate(p));p.nodes[0].managementIp={value:'192.168.1.1'};assert.throws(()=>context.validate(p),/文本格式无效/)});
test('拒绝重复占用端口',()=>{const p=project();p.edges.push({...p.edges[0],id:'e2'});assert.throws(()=>context.validate(p),/重复占用/)});
test('拒绝不存在的端口',()=>{const p=project();p.edges[0].toPort='missing';assert.throws(()=>context.validate(p),/端口缺失/)});
test('拒绝重复设备标识',()=>{const p=project();p.nodes[1].id='a';assert.throws(()=>context.validate(p),/重复/)});
test('拒绝重复端口名称',()=>{const p=project();p.nodes[0].ports.push({id:'ap2',name:'GE1',kind:'RJ45'});assert.throws(()=>context.validate(p),/端口数据无效/)});
test('拒绝非法线材颜色和非有限坐标',()=>{const p=project();p.cables[0].color='red';assert.throws(()=>context.validate(p),/颜色无效/);p.cables[0].color='#000000';p.nodes[0].x=Infinity;assert.throws(()=>context.validate(p),/设备数据无效/)});
