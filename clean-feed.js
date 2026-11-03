(() => {
 'use strict';
 const feed=document.getElementById('feed');
 if(!feed||typeof IntersectionObserver==='undefined')return;
 const active=new Set();
 const mediaObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   const card=entry.target;
   const visible=entry.isIntersecting&&entry.intersectionRatio>=0.6;
   const video=card.querySelector('video');
   const frame=card.querySelector('iframe');
   if(visible){
    if(video){
     if(video.dataset.src&&!video.src){video.src=video.dataset.src;video.removeAttribute('data-src');video.load();}
     video.muted=true;video.playsInline=true;
     const attempt=video.play();if(attempt?.catch)attempt.catch(()=>{});
    }
    if(frame&&frame.dataset.src&&!frame.src){frame.src=frame.dataset.src;frame.removeAttribute('data-src');}
    active.add(card);
   }else{
    if(video){video.pause();if(video.readyState>1){try{video.currentTime=0}catch{}}}
    if(frame&&frame.src){try{const url=new URL(frame.src);if(/youtube-nocookie\.com$/.test(url.hostname))frame.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}),url.origin)}catch{}}
    active.delete(card);
   }
  }
 },{root:feed,threshold:[0,0.6,0.85]});
 const observe=()=>feed.querySelectorAll('.video-card').forEach(card=>{
  if(!card.dataset.cleanObserved){card.dataset.cleanObserved='1';mediaObserver.observe(card)}
 });
 new MutationObserver(observe).observe(feed,{childList:true,subtree:true});
 observe();
 feed.addEventListener('scroll',observe,{passive:true});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)feed.querySelectorAll('video').forEach(video=>video.pause());
  else active.forEach(card=>{const video=card.querySelector('video');if(video){const attempt=video.play();if(attempt?.catch)attempt.catch(()=>{})}});
 });
})();
