begin;

alter table public.point_reason_presets
    add column if not exists sort_order integer not null default 0
        check (sort_order >= 0);

with ranked_reasons as (
    select
        id,
        row_number() over (
            partition by department_id
            order by created_at asc, id asc
        ) - 1 as sort_order
    from public.point_reason_presets
)
update public.point_reason_presets as reason
set sort_order = ranked_reasons.sort_order
from ranked_reasons
where reason.id = ranked_reasons.id;

create index if not exists idx_point_reason_presets_department_sort
    on public.point_reason_presets (
        department_id,
        is_active,
        sort_order
    );

commit;
