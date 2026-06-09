begin;

create extension if not exists pgcrypto;

create table if not exists public.point_reason_presets (
    id uuid primary key default gen_random_uuid(),

    department_id uuid not null
        references public.departments(id) on delete cascade,

    label text not null,

    default_points integer
        check (default_points is null or default_points >= 0),

    is_active boolean not null default true,

    created_by uuid
        references public.admin_profiles(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint point_reason_presets_label_check
        check (char_length(trim(label)) > 0),

    constraint point_reason_presets_department_label_key
        unique (department_id, label)
);

create index if not exists idx_point_reason_presets_department_active
    on public.point_reason_presets (
        department_id,
        is_active,
        created_at
    );

insert into public.point_reason_presets (
    department_id,
    label,
    default_points
)
select
    department.id,
    reason.label,
    reason.default_points
from public.departments as department
cross join (
    values
        ('등원', null::integer),
        ('수업 참여도 우수', null::integer),
        ('기타', null::integer)
) as reason(label, default_points)
on conflict (department_id, label) do nothing;

commit;
