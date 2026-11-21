-- These legacy external-video social tables are no longer used by the VYBORA client.
-- Keep their rows and owner/service-role access intact, but remove public Data API/GraphQL access.
revoke all privileges on table
  public.vybora_external_video_bookmarks,
  public.vybora_external_video_comments,
  public.vybora_external_video_reactions,
  public.vybora_external_video_stats,
  public.vybora_external_videos
from public, anon, authenticated;
