-- Seed an initial, deduplicated catalog of official Blender open movies.
-- Attribution stays visible in the creator field; each entry links to the original publisher.
-- These are external embeds/streams, not copies hosted by VYBORA.
insert into public.vybora_external_videos
  (title, creator, source_name, source_url, embed_url, description, mature_content, active)
select v.title, v.creator, v.source_name, v.source_url, v.embed_url, v.description, false, true
from (values
  ('WING IT!', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=u9lj-c29dxI', 'https://www.youtube-nocookie.com/embed/u9lj-c29dxI', 'Official Blender open movie. Original publisher: Blender Studio. Check the publisher page for current license and attribution details.'),
  ('Coffee Run', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=PVGeM40dABA', 'https://www.youtube-nocookie.com/embed/PVGeM40dABA', 'Official Blender open movie. Original publisher: Blender Studio. Check the publisher page for current license and attribution details.'),
  ('Spring', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=WhWc3b3KhnY', 'https://www.youtube-nocookie.com/embed/WhWc3b3KhnY', 'Official Blender open movie. Original publisher: Blender Studio. Check the publisher page for current license and attribution details.'),
  ('CHARGE', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=UXqq0ZvbOnk', 'https://www.youtube-nocookie.com/embed/UXqq0ZvbOnk', 'Official Blender open movie. Original publisher: Blender Studio. Check the publisher page for current license and attribution details.'),
  ('Tears of Steel', 'Blender', 'YouTube', 'https://www.youtube.com/watch?v=R6MlUcmOul8', 'https://www.youtube-nocookie.com/embed/R6MlUcmOul8', 'Official Blender open movie released under Creative Commons Attribution. Creator: Blender Foundation.'),
  ('HERO', 'Blender', 'YouTube', 'https://www.youtube.com/watch?v=pKmSdY56VtY', 'https://www.youtube-nocookie.com/embed/pKmSdY56VtY', 'Official Blender open-content animation showcase. Creator: Blender and the Hero team; check original page for applicable license terms.'),
  ('Caminandes 2: Gran Dillama', 'Blender', 'YouTube', 'https://www.youtube.com/watch?v=Z4C82eyhwgU', 'https://www.youtube-nocookie.com/embed/Z4C82eyhwgU', 'Official Blender open movie; Creative Commons Attribution-ShareAlike 3.0 is shown in the film. Creator: Blender Foundation.'),
  ('Sprite Fright', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=_cMxraX_5RE', 'https://www.youtube-nocookie.com/embed/_cMxraX_5RE', 'Official Blender Studio open movie. Original publisher: Blender Studio. Check the publisher page for current license and attribution details.'),
  ('Agent 327: Operation Barbershop', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=mN0zP0pADL4', 'https://www.youtube-nocookie.com/embed/mN0zP0pADL4', 'Official Blender open-movie teaser. Original publisher: Blender Studio; check current license and attribution terms.'),
  ('Caminandes 3: Llamigos', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=SkVqJ1SGeL0', 'https://www.youtube-nocookie.com/embed/SkVqJ1SGeL0', 'Official Blender open movie. Original publisher: Blender Studio; check current license and attribution terms.'),
  ('Sintel', 'Blender Open Movies', 'Blender Video', 'https://studio.blender.org/projects/sintel/', 'https://video.blender.org/static/webseed/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4', 'Blender open movie streamed from the original Blender video host. Creator attribution: Blender Foundation.'),
  ('Elephants Dream', 'Blender Open Movies', 'Blender Video', 'https://studio.blender.org/projects/elephants-dream/', 'https://video.blender.org/static/webseed/cccc3e60-0291-4ecc-aa56-39b2e2c7d0d5-720.mp4', 'Blender open movie streamed from the original Blender video host. Creator attribution: Blender Foundation.'),
  ('Glass Half', 'Blender Open Movies', 'Blender Video', 'https://studio.blender.org/films/', 'https://video.blender.org/static/webseed/64222c8a-c4c7-4b3b-9850-7fb2078edcf6-720.mp4', 'Blender open movie streamed from the original Blender video host. Creator attribution: Blender Foundation.'),
  ('Cosmos Laundromat: First Cycle', 'Blender Studio', 'YouTube', 'https://www.youtube.com/watch?v=wgcfwWw7Mj4', 'https://www.youtube-nocookie.com/embed/wgcfwWw7Mj4', 'Official Blender open movie pilot. The story includes a sheep described by the publisher as suicidal; consider age and context before viewing. Original publisher: Blender Studio.')
) as v(title, creator, source_name, source_url, embed_url, description)
where not exists (
  select 1 from public.vybora_external_videos existing
  where existing.source_url = v.source_url
);
