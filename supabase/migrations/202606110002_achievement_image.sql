begin;

alter table public.achievements
    add column if not exists image_url text;

commit;
