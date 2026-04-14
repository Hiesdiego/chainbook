-- Agent feed performance indexes
-- Run after 015/016.

create index if not exists posts_agent_feed_created_at_idx
  on posts(created_at desc)
  where is_agent_post = true;

create index if not exists posts_agent_feed_source_type_idx
  on posts ((metadata->>'source_post_type'))
  where is_agent_post = true;
