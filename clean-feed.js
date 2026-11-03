(() => {
 'use strict';
 const feed=document.getElementById('feed');
 if(!feed||typeof IntersectionObserver==='undefined')return;
 const active=new Set();
 const startVideo=video=>{
  if(!video)return;
  if(video.dataset.src&&!video.src){video.src=video.dataset.src;video.removeAttribute('data-src');video.load();}
  video.muted=true;video.playsInline=true;
  const attempt=video.play();if(attempt?.catch)attempt.catch(()=>{});
 };
 const startFrame=frame=>{
  if(frame&&frame.dataset.src&&!frame.src){frame.src=frame.dataset.src;frame.removeAttribute('data-src');}
 };
 const stopFrame=frame=>{
  if(frame&&frame.src){frame.dataset.src=frame.src;frame.removeAttribute('src');}
 };
 const mediaObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   const card=entry.target;
   const visible=entry.isIntersecting&&entry.intersectionRatio>=0.6;
   const video=card.querySelector('video');
   const frame=card.querySelector('iframe');
   if(visible){
    startVideo(video);startFrame(frame);active.add(card);
   }else{
    if(video){video.pause();if(video.readyState>1){try{video.currentTime=0}catch{}}}
    stopFrame(frame);active.delete(card);
   }
  }
 },{root:feed,threshold:[0,0.6,0.85]});
 const observe=()=>{
  active.forEach(card=>{if(!card.isConnected)active.delete(card)});
  feed.querySelectorAll('.video-card').forEach(card=>{
   if(!card.dataset.cleanObserved){card.dataset.cleanObserved='1';mediaObserver.observe(card)}
  });
 };
 new MutationObserver(observe).observe(feed,{childList:true,subtree:true});
 observe();
 feed.addEventListener('scroll',observe,{passive:true});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
   feed.querySelectorAll('video').forEach(video=>video.pause());
   feed.querySelectorAll('iframe').forEach(stopFrame);
  }else active.forEach(card=>{startVideo(card.querySelector('video'));startFrame(card.querySelector('iframe'))});
 });
})();
