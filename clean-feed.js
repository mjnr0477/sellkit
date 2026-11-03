(() => {
 'use strict';
 const feed=document.getElementById('feed');
 if(!feed)return;
 const active=new WeakSet();
 const mediaObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   const card=entry.target;
   const visible=entry.isIntersecting&&entry.intersectionRatio>=0.6;
   const video=card.querySelector('video');
   const frame=card.querySelector('iframe');
   if(visible){
    if(video){
     if(video.dataset.src&&!video.src){video.src=video.dataset.src;video.removeAttribute('data-src');video.load();}
     video.muted=true;video.playsInline=true;video.play().catch(()=>{});
    }
    if(frame&&frame.dataset.src&&!frame.src){frame.src=frame.dataset.src;frame.removeAttribute('data-src');}
    active.add(card);
   }else{
    if(video){video.pause();if(video.readyState>1)video.currentTime=0;}
    if(frame&&frame.src){try{frame.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}),new URL(frame.src).origin)}catch{}}
    active.delete(card);
   }
  }
 },{root:feed,threshold:[0,0.6,0.85]});
 const observe=()=>feed.querySelectorAll('.video-card').forEach(card=>{if(!card.dataset.cleanObserved){card.dataset.cleanObserved='1';mediaObserver.observe(card)}});
 new MutationObserver(observe).observe(feed,{childList:true,subtree:true});
 observe();
 feed.addEventListener('scroll',observe,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)feed.querySelectorAll('video').forEach(v=>v.pause());else{const card=feed.querySelector('.video-card');if(card&&active.has(card))card.querySelector('video')?.play().catch(()=>{})}});
})();
