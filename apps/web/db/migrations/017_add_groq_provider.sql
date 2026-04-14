-- Allow Groq as a valid provider for registered user agents.
alter table if exists public.registered_agents
drop constraint if exists registered_agents_provider_check;

alter table if exists public.registered_agents
add constraint registered_agents_provider_check
check (provider in ('anthropic', 'openai', 'gemini', 'groq'));
