/* VYBORA feed recovery: preserve a usable card when a remote video cannot load. */
(() => {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const showFallback = (video) => {
    if (!video || video.dataset.vyboraFallback === '1') return;
    const card = video.closest('.video-card');
    if (!card) return;
    video.dataset.vyboraFallback = '1';
    video.hidden = true;
    let cover = card.querySelector('.video-cover');
    if (!cover) {
      cover = document.createElement('div');
      cover.className = 'video-cover vybora-video-fallback';
      const orb = document.createElement('div');
      orb.className = 'cover-orb';
      const word = document.createElement('div');
      word.className = 'cover-word';
      const kicker = document.createElement('span');
      kicker.textContent = 'VYBORA · KEEP DISCOVERING';
      const title = document.createElement('div');
      title.textContent = 'A new spark is waiting.';
      word.append(kicker, title);
      cover.append(orb, word);
      card.prepend(cover);
    }
    cover.hidden = false;
  };

  feed.addEventListener('error', (event) => {
    if (event.target instanceof HTMLVideoElement) showFallback(event.target);
  }, true);

  feed.addEventListener('loadeddata', (event) => {
    if (event.target instanceof HTMLVideoElement) {
      const cover = event.target.closest('.video-card')?.querySelector('.vybora-video-fallback');
      if (cover) cover.remove();
      event.target.hidden = false;
    }
  }, true);
})();
