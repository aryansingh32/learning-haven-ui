-- Interactive concepts content for build stages (CodeCrafters-style Concepts tab)
alter table public.build_stages
  add column if not exists concepts_content text;

comment on column public.build_stages.concepts_content is 'Markdown for in-app Concepts tab; docs_url remains optional external link';
