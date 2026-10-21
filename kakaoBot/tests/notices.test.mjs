import test from 'node:test';
import assert from 'node:assert/strict';
import {filterNotices,noticeScope} from '../src/notices.mjs';
import {isLongNotice} from '../src/notice-kind.mjs';
import {normalizePost} from '../src/engine.mjs';
test('calendar-month rule handles exact boundaries, year rollover and short months',()=>{
 for(const [s,e,result] of [['2026-10-21','2026-11-20',false],['2026-10-21','2026-11-21',true],['2026-01-31','2026-02-28',true],['2028-01-31','2028-02-28',false],['2028-01-31','2028-02-29',true],['2026-12-21','2027-01-21',true]]) assert.equal(isLongNotice(s,e),result);
});
test('default bot search excludes routine notices while explicit scopes and non-notices work',async()=>{
 const short={id:'s',category:'NOTICE',noticeKind:'SHORT',noticeStartDate:'2026-10-21',noticeEndDate:'2026-10-31'};
 const long={...short,id:'long',noticeEndDate:'2026-11-21'};
 const manual={...short,id:'manual',noticeKind:'ROUTINE'};
 const food={id:'food',category:'FOOD'};const posts=[short,long,manual,food];
 assert.equal(noticeScope('공고 알려줘'),'short');assert.equal(noticeScope('일상공고'),'routine');assert.equal(noticeScope('전체 공고'),'all');
 assert.deepEqual((await filterNotices(posts,'short')).map(p=>p.id),['s','food']);
 assert.deepEqual((await filterNotices(posts,'routine')).map(p=>p.id),['long','manual','food']);
 assert.deepEqual(await filterNotices(posts,'all'),posts);
});
test('bot publication enforces long routine notices and preserves explicit short-period routine choice',()=>{
 const base={title:'공고',body:'내용',category:'NOTICE',scheduleType:'WEEKLY',noticeStartDate:'2026-10-21',noticeEndDate:'2026-11-21',noticeKind:'SHORT'};
 assert.equal(normalizePost(base).post.noticeKind,'ROUTINE');
 assert.equal(normalizePost({...base,noticeEndDate:'2026-10-31'}).post.noticeKind,'SHORT');
 assert.equal(normalizePost({...base,noticeEndDate:'2026-10-31',noticeKind:'ROUTINE'}).post.noticeKind,'ROUTINE');
});
