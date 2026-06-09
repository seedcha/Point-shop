begin;

create extension if not exists pgcrypto;

create table if not exists public.home_announcements (
    id uuid primary key default gen_random_uuid(),

    department_id uuid not null
        references public.departments(id) on delete cascade,

    type text not null
        check (type in ('contest', 'vacation', 'award')),

    title text not null,
    start_date date not null,
    end_date date not null,
    details text,

    is_active boolean not null default true,

    created_by uuid
        references public.admin_profiles(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint home_announcements_date_check
        check (end_date >= start_date)
);

create table if not exists public.announcement_award_students (
    id uuid primary key default gen_random_uuid(),

    announcement_id uuid not null
        references public.home_announcements(id) on delete cascade,

    student_name text not null,
    award_name text not null,
    sort_order integer not null default 0
        check (sort_order >= 0),

    created_at timestamptz not null default now()
);

create index if not exists idx_home_announcements_department
    on public.home_announcements (
        department_id,
        is_active,
        start_date,
        end_date
    );

create index if not exists idx_award_students_announcement
    on public.announcement_award_students (
        announcement_id,
        sort_order
    );

commit;