begin;

alter table public.point_reason_presets enable row level security;

create policy point_reason_presets_select_scope
on public.point_reason_presets
for select
to authenticated
using (
    exists (
        select 1
        from public.admin_profiles
        where admin_profiles.auth_user_id = auth.uid()
          and admin_profiles.is_active = true
          and (
              admin_profiles.role = 'master'
              or admin_profiles.department_id = point_reason_presets.department_id
          )
    )
);

create policy point_reason_presets_insert_scope
on public.point_reason_presets
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_profiles
        where admin_profiles.auth_user_id = auth.uid()
          and admin_profiles.is_active = true
          and admin_profiles.role in ('master', 'manager')
          and (
              admin_profiles.role = 'master'
              or admin_profiles.department_id = point_reason_presets.department_id
          )
    )
);

create policy point_reason_presets_update_scope
on public.point_reason_presets
for update
to authenticated
using (
    exists (
        select 1
        from public.admin_profiles
        where admin_profiles.auth_user_id = auth.uid()
          and admin_profiles.is_active = true
          and admin_profiles.role in ('master', 'manager')
          and (
              admin_profiles.role = 'master'
              or admin_profiles.department_id = point_reason_presets.department_id
          )
    )
)
with check (
    exists (
        select 1
        from public.admin_profiles
        where admin_profiles.auth_user_id = auth.uid()
          and admin_profiles.is_active = true
          and admin_profiles.role in ('master', 'manager')
          and (
              admin_profiles.role = 'master'
              or admin_profiles.department_id = point_reason_presets.department_id
          )
    )
);

create policy point_reason_presets_delete_scope
on public.point_reason_presets
for delete
to authenticated
using (
    label not in ('등원', '수업 참여도 우수', '포인트 조정', '기타')
    and exists (
        select 1
        from public.admin_profiles
        where admin_profiles.auth_user_id = auth.uid()
          and admin_profiles.is_active = true
          and admin_profiles.role in ('master', 'manager')
          and (
              admin_profiles.role = 'master'
              or admin_profiles.department_id = point_reason_presets.department_id
          )
    )
);

commit;
