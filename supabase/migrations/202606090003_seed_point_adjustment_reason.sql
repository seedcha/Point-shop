begin;

insert into public.point_reason_presets (
    department_id,
    label,
    default_points
)
select
    department.id,
    '포인트 조정',
    null::integer
from public.departments as department
on conflict (department_id, label) do nothing;

commit;
