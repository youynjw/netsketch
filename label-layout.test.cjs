const {test}=require('node:test');
const assert=require('node:assert/strict');
const {layout,overlaps}=require('./label-layout.js');
function verify(labels,nodes){const result=layout(labels,nodes);assert.equal(result.length,labels.length);for(let i=0;i<result.length;i++){assert.ok(!nodes.some(n=>overlaps(result[i],n)),`label ${i} overlaps device`);for(let j=0;j<i;j++)assert.ok(!overlaps(result[i],result[j]),`labels ${i},${j} overlap`)}assert.deepEqual(layout(labels,nodes),result,'layout is stable');return result}
const label=(x,y,nx,ny,w=100)=>({point:{x,y},normal:{x:nx,y:ny},w,h:22,name:'TenGigabitEthernet1/0/48'});
test('上下端口使用相同的 12 像素短间距，避开端口数量徽标',()=>{const result=verify([label(80,84,0,1,42),label(80,190,0,-1,42)],[{x:-5,y:-5,w:170,h:94},{x:65,y:75,w:34,h:16},{x:-5,y:185,w:170,h:94},{x:65,y:265,w:34,h:16}]);assert.equal(result[0].y-84,12);assert.equal(190-result[1].y-result[1].h,12)});
test('短线路两端的长端口标识不重叠',()=>verify([label(160,42,1,0),label(190,42,-1,0)],[{x:-5,y:-5,w:170,h:102},{x:185,y:-5,w:170,h:102}]));
test('交换机同一侧 48 个密集标签不重叠',()=>verify(Array.from({length:48},(_,i)=>label(160,12+i,1,0,180)),[{x:-5,y:-5,w:170,h:102}]));
test('多方向标签避开设备、徽标及展开详情',()=>verify([label(80,151,0,1),label(80,170,0,-1),label(160,75,1,0),label(190,75,-1,0)],[{x:-5,y:-5,w:170,h:169},{x:-5,y:165,w:170,h:102},{x:185,y:-5,w:170,h:102}]));
test('移动设备后重新布局仍保持可读',()=>{const nodes=[{x:-5,y:-5,w:170,h:102},{x:300,y:80,w:170,h:102}],labels=[label(160,42,1,0),label(305,120,-1,0)];verify(labels,nodes);nodes[1].x=175;labels[1].point.x=180;verify(labels,nodes)});
