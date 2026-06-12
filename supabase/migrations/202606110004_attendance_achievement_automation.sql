begin;

alter table public.point_transactions
    add column if not exists attendance_status text,
    add column if not exists attendance_date date;

alter table public.point_transactions
    add constraint point_transactions_attendance_status_check
        check (
            attendance_status is null
            or attendance_status in ('on_time', 'late')
        ),
    add constraint point_transactions_attendance_metadata_check
        check (
            (
                transaction_type = 'attendance'
                and attendance_status is not null
                and attendance_date is not null
                and amount > 0
                and department_id is not null
            )
            or (
                transaction_type <> 'attendance'
                and attendance_status is null
                and attendance_date is null
            )
        );

create unique index if not exists point_transactions_student_attendance_date_key
    on public.point_transactions (department_id, student_id, attendance_date)
    where transaction_type = 'attendance';

create table if not exists public.student_attendance_stats (
    student_id uuid primary key,
    department_id uuid not null,
    total_attendance_count integer not null default 0
        check (total_attendance_count >= 0),
    on_time_attendance_count integer not null default 0
        check (on_time_attendance_count >= 0),
    late_attendance_count integer not null default 0
        check (late_attendance_count >= 0),
    current_on_time_streak integer not null default 0
        check (current_on_time_streak >= 0),
    longest_on_time_streak integer not null default 0
        check (longest_on_time_streak >= 0),
    last_attendance_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint student_attendance_stats_student_department_fkey
        foreign key (student_id, department_id)
        references public.students(id, department_id)
        on delete cascade,
    constraint student_attendance_stats_count_check
        check (
            total_attendance_count
            = on_time_attendance_count + late_attendance_count
        )
);

create table if not exists public.department_daily_first_attendance (
    department_id uuid not null
        references public.departments(id) on delete cascade,
    attendance_date date not null,
    student_id uuid not null,
    point_transaction_id uuid not null unique
        references public.point_transactions(id) on delete cascade,
    recorded_at timestamptz not null default now(),
    primary key (department_id, attendance_date),
    constraint department_daily_first_attendance_student_department_fkey
        foreign key (student_id, department_id)
        references public.students(id, department_id)
        on delete cascade
);

create index if not exists idx_point_transactions_attendance_lookup
    on public.point_transactions (
        department_id,
        student_id,
        attendance_date desc,
        attendance_status
    )
    where transaction_type = 'attendance';

create index if not exists idx_student_attendance_stats_department
    on public.student_attendance_stats (
        department_id,
        current_on_time_streak desc,
        total_attendance_count desc
    );

create or replace function public.seed_default_achievements(
    target_department_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.achievements (
        department_id,
        code,
        name,
        category,
        rarity,
        description,
        condition_type,
        condition_value,
        condition_unit,
        condition_config,
        is_automatic,
        sort_order
    )
    values
        (target_department_id, 'attendance_first_4', '발걸음 가벼운 여행자', 'attendance', 'common', '등원 포인트를 누적 4회 지급받으면 획득합니다.', 'total_attendance', 4, '회', '{"attendance_statuses":["on_time","late"]}'::jsonb, true, 10),
        (target_department_id, 'attendance_on_time_10', '성실한 예비 모험가', 'attendance', 'common', '지각 없이 10회 연속 정시 출석하면 획득합니다.', 'on_time_streak', 10, '회', '{}'::jsonb, true, 20),
        (target_department_id, 'attendance_daily_first', '아침을 여는 소환사', 'attendance', 'common', '가맹점에서 그날 처음으로 등원 포인트를 지급받으면 획득합니다.', 'daily_first', 1, '회', '{}'::jsonb, true, 30),
        (target_department_id, 'attendance_on_time_15', '신속의 스카우트', 'attendance', 'rare', '15회 연속 정시 출석하면 획득합니다.', 'on_time_streak', 15, '회', '{}'::jsonb, true, 40),
        (target_department_id, 'attendance_early_5', '바람을 가르는 자', 'attendance', 'rare', '수업 시작 20분 전 조기 등원을 5회 달성하면 강사가 지급합니다.', 'manual', 5, '회', '{}'::jsonb, false, 50),
        (target_department_id, 'attendance_on_time_4', '시간 연금술사의 제자', 'attendance', 'rare', '4회 연속 지각 없이 정시 출석하면 획득합니다.', 'on_time_streak', 4, '회', '{}'::jsonb, true, 60),
        (target_department_id, 'attendance_on_time_11', '시공의 순례자', 'attendance', 'heroic', '11회 연속 지각 없이 정시 출석하면 획득합니다.', 'on_time_streak', 11, '회', '{}'::jsonb, true, 70),
        (target_department_id, 'attendance_tracker_30', '백발백중의 추적자', 'attendance', 'heroic', '항상 정시에 도착한 학생에게 강사가 지급합니다.', 'manual', 30, '회', '{}'::jsonb, false, 80),
        (target_department_id, 'attendance_on_time_22', '시간의 지배자', 'attendance', 'legendary', '22회 연속 지각 없이 정시 출석하면 획득합니다.', 'on_time_streak', 22, '회', '{}'::jsonb, true, 90),
        (target_department_id, 'attendance_on_time_36', '불멸의 개근 기사', 'attendance', 'legendary', '36회 연속 지각 없이 정시 출석하면 획득합니다.', 'on_time_streak', 36, '회', '{}'::jsonb, true, 100),
        (target_department_id, 'attendance_on_time_72', '시공간의 초월자', 'attendance', 'mythic', '72회 연속 지각 없이 정시 출석하면 획득합니다.', 'on_time_streak', 72, '회', '{}'::jsonb, true, 110),
        (target_department_id, 'attendance_on_time_108', '학원의 살아있는 역사', 'attendance', 'mythic', '108회 연속 지각 없이 정시 출석하면 획득합니다.', 'on_time_streak', 108, '회', '{}'::jsonb, true, 120),

        (target_department_id, 'inquiry_first_core_question', '호기심 많은 탐험가', 'inquiry', 'common', '수업 중 핵심을 찌르는 질문을 처음으로 던졌을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 210),
        (target_department_id, 'inquiry_find_code_error', '흔적 추적자', 'inquiry', 'common', '교안의 코드 오류나 오타를 찾아냈을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 220),
        (target_department_id, 'inquiry_precise_question', '돋보기를 든 학도', 'inquiry', 'common', '이해되지 않는 부분을 정확히 짚어 질문했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 230),
        (target_department_id, 'inquiry_extended_concept', '비밀의 목격자', 'inquiry', 'common', '수업과 관련된 확장 개념을 질문했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 240),
        (target_department_id, 'inquiry_better_solution', '보물 상자 감정사', 'inquiry', 'rare', '더 효율적인 대안 코드를 제시했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 250),
        (target_department_id, 'inquiry_edge_case', '허점 찌르는 자', 'inquiry', 'rare', '숨겨진 예외 상황을 질문으로 간파했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 260),
        (target_department_id, 'inquiry_three_core_questions', '심연의 관찰자', 'inquiry', 'heroic', '한 수업에서 핵심 질문을 3개 이상 던졌을 때 강사가 지급합니다.', 'manual', 3, '회', '{}'::jsonb, false, 270),
        (target_department_id, 'inquiry_essential_question', '진실을 꿰뚫는 눈', 'inquiry', 'legendary', '수업의 본질을 꿰뚫는 질문을 했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 280),

        (target_department_id, 'competition_first_certificate_attempt', '시련의 도전자', 'competition', 'common', '자격증 시험에 처음으로 접수하거나 도전했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 310),
        (target_department_id, 'competition_first_contest', '투기장의 신인', 'competition', 'common', '교내 또는 학원 코딩 대회에 출전했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 320),
        (target_department_id, 'competition_retry_pass', '강철의 의지', 'competition', 'rare', '불합격한 시험에 재도전하여 합격했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 330),
        (target_department_id, 'competition_intermediate_test', '난관 돌파자', 'competition', 'rare', '중급 과정 레벨 테스트를 우수한 성적으로 통과했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 340),
        (target_department_id, 'competition_it_certificate', '드래곤 슬레이어', 'competition', 'heroic', '외부 공인 IT 또는 코딩 자격증에 최종 합격했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 350),
        (target_department_id, 'competition_preliminary_pass', '전장을 지배하는 자', 'competition', 'heroic', '대외 대회 예선을 통과했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 360),
        (target_department_id, 'competition_final_award', '전설의 용사', 'competition', 'legendary', '공인 알고리즘 대회 또는 외부 대회 본선에서 수상했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 370),
        (target_department_id, 'competition_grand_prize', '대륙의 지배자', 'competition', 'mythic', '권위 있는 외부 대회에서 대상 또는 금상 이상을 수상했을 때 강사가 지급합니다.', 'manual', 1, '회', '{}'::jsonb, false, 380)
    on conflict (department_id, code) do update
    set
        name = excluded.name,
        category = excluded.category,
        rarity = excluded.rarity,
        description = excluded.description,
        condition_type = excluded.condition_type,
        condition_value = excluded.condition_value,
        condition_unit = excluded.condition_unit,
        condition_config = excluded.condition_config,
        is_automatic = excluded.is_automatic,
        sort_order = excluded.sort_order,
        updated_at = now();
$$;

create or replace function public.seed_default_achievements_for_new_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.seed_default_achievements(new.id);
    return new;
end;
$$;

drop trigger if exists seed_default_achievements_after_department_insert
    on public.departments;

create trigger seed_default_achievements_after_department_insert
after insert on public.departments
for each row
execute function public.seed_default_achievements_for_new_department();

revoke all on function public.seed_default_achievements(uuid) from public;
revoke all on function public.seed_default_achievements_for_new_department() from public;

select public.seed_default_achievements(id)
from public.departments;

create or replace function public.process_attendance_point_achievement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    attendance_stats public.student_attendance_stats%rowtype;
    is_daily_first boolean := false;
    inserted_daily_first_count integer := 0;
begin
    if new.transaction_type <> 'attendance' then
        return new;
    end if;

    insert into public.department_daily_first_attendance (
        department_id,
        attendance_date,
        student_id,
        point_transaction_id,
        recorded_at
    )
    values (
        new.department_id,
        new.attendance_date,
        new.student_id,
        new.id,
        new.created_at
    )
    on conflict (department_id, attendance_date) do nothing;

    get diagnostics inserted_daily_first_count = row_count;
    is_daily_first := inserted_daily_first_count = 1;

    insert into public.student_attendance_stats (
        student_id,
        department_id,
        total_attendance_count,
        on_time_attendance_count,
        late_attendance_count,
        current_on_time_streak,
        longest_on_time_streak,
        last_attendance_date
    )
    values (
        new.student_id,
        new.department_id,
        1,
        case when new.attendance_status = 'on_time' then 1 else 0 end,
        case when new.attendance_status = 'late' then 1 else 0 end,
        case when new.attendance_status = 'on_time' then 1 else 0 end,
        case when new.attendance_status = 'on_time' then 1 else 0 end,
        new.attendance_date
    )
    on conflict (student_id) do update
    set
        total_attendance_count
            = public.student_attendance_stats.total_attendance_count + 1,
        on_time_attendance_count
            = public.student_attendance_stats.on_time_attendance_count
              + case when excluded.on_time_attendance_count = 1 then 1 else 0 end,
        late_attendance_count
            = public.student_attendance_stats.late_attendance_count
              + case when excluded.late_attendance_count = 1 then 1 else 0 end,
        current_on_time_streak
            = case
                when excluded.on_time_attendance_count = 1
                then public.student_attendance_stats.current_on_time_streak + 1
                else 0
              end,
        longest_on_time_streak
            = greatest(
                public.student_attendance_stats.longest_on_time_streak,
                case
                    when excluded.on_time_attendance_count = 1
                    then public.student_attendance_stats.current_on_time_streak + 1
                    else public.student_attendance_stats.longest_on_time_streak
                end
              ),
        last_attendance_date = excluded.last_attendance_date,
        updated_at = now()
    returning * into attendance_stats;

    insert into public.achievement_events (
        department_id,
        student_id,
        event_type,
        event_value,
        event_data,
        occurred_at,
        recorded_by
    )
    values (
        new.department_id,
        new.student_id,
        'attendance_point',
        1,
        jsonb_build_object(
            'attendance_status', new.attendance_status,
            'attendance_date', new.attendance_date,
            'point_transaction_id', new.id,
            'is_daily_first', is_daily_first
        ),
        new.created_at,
        new.adjusted_by
    );

    insert into public.achievement_progress (
        department_id,
        student_id,
        achievement_id,
        current_value,
        streak_value,
        progress_data,
        last_evaluated_at
    )
    select
        achievement.department_id,
        new.student_id,
        achievement.id,
        case achievement.condition_type
            when 'total_attendance'
                then attendance_stats.total_attendance_count
            when 'on_time_streak'
                then attendance_stats.current_on_time_streak
            when 'daily_first'
                then case when is_daily_first then 1 else 0 end
            else 0
        end,
        attendance_stats.current_on_time_streak,
        jsonb_build_object(
            'total_attendance_count', attendance_stats.total_attendance_count,
            'on_time_attendance_count', attendance_stats.on_time_attendance_count,
            'late_attendance_count', attendance_stats.late_attendance_count,
            'longest_on_time_streak', attendance_stats.longest_on_time_streak,
            'last_attendance_date', attendance_stats.last_attendance_date
        ),
        now()
    from public.achievements as achievement
    where achievement.department_id = new.department_id
      and achievement.category = 'attendance'
      and achievement.is_automatic = true
      and achievement.is_active = true
    on conflict (student_id, achievement_id) do update
    set
        current_value = excluded.current_value,
        streak_value = excluded.streak_value,
        progress_data = excluded.progress_data,
        last_evaluated_at = excluded.last_evaluated_at,
        updated_at = now();

    insert into public.student_achievements (
        department_id,
        student_id,
        achievement_id,
        awarded_by,
        award_source,
        award_note
    )
    select
        achievement.department_id,
        new.student_id,
        achievement.id,
        new.adjusted_by,
        'automatic',
        '등원 포인트 지급에 따른 자동 칭호 지급'
    from public.achievements as achievement
    where achievement.department_id = new.department_id
      and achievement.category = 'attendance'
      and achievement.is_automatic = true
      and achievement.is_active = true
      and (
          (
              achievement.condition_type = 'total_attendance'
              and attendance_stats.total_attendance_count
                  >= achievement.condition_value
          )
          or (
              achievement.condition_type = 'on_time_streak'
              and attendance_stats.current_on_time_streak
                  >= achievement.condition_value
          )
          or (
              achievement.condition_type = 'daily_first'
              and is_daily_first
          )
      )
    on conflict (student_id, achievement_id) do nothing;

    return new;
end;
$$;

drop trigger if exists process_attendance_point_achievement_after_insert
    on public.point_transactions;

create trigger process_attendance_point_achievement_after_insert
after insert on public.point_transactions
for each row
when (new.transaction_type = 'attendance')
execute function public.process_attendance_point_achievement();

revoke all on function public.process_attendance_point_achievement() from public;

create or replace function public.adjust_student_points(
    target_student_id uuid,
    point_amount integer,
    point_reason text,
    selected_attendance_status text default null,
    selected_attendance_date date default null
)
returns public.point_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
    admin_profile public.admin_profiles%rowtype;
    student_record public.students%rowtype;
    transaction_record public.point_transactions%rowtype;
    resolved_reason text := trim(point_reason);
    resolved_transaction_type text := 'etc';
    resolved_attendance_date date;
    next_balance integer;
begin
    select *
    into admin_profile
    from public.admin_profiles
    where auth_user_id = auth.uid()
      and is_active = true;

    if not found
       or admin_profile.role not in ('master', 'manager', 'staff') then
        raise exception '포인트를 조정할 권한이 없습니다.';
    end if;

    if point_amount is null or point_amount = 0 then
        raise exception '포인트는 0이 아닌 정수여야 합니다.';
    end if;

    if resolved_reason is null or resolved_reason = '' then
        raise exception '포인트 지급 사유가 필요합니다.';
    end if;

    select *
    into student_record
    from public.students
    where id = target_student_id
      and is_active = true
    for update;

    if not found then
        raise exception '학생 정보를 찾을 수 없습니다.';
    end if;

    if admin_profile.role <> 'master'
       and admin_profile.department_id is distinct from student_record.department_id then
        raise exception '다른 가맹점 학생의 포인트를 조정할 수 없습니다.';
    end if;

    next_balance := student_record.points + point_amount;

    if next_balance < 0 then
        raise exception '포인트 회수 후 잔액은 0보다 작을 수 없습니다.';
    end if;

    if resolved_reason = '등원' and point_amount > 0 then
        if selected_attendance_status is null
           or selected_attendance_status not in ('on_time', 'late') then
            raise exception '등원 포인트는 정시 또는 지각 상태가 필요합니다.';
        end if;

        resolved_transaction_type := 'attendance';
        resolved_attendance_date := coalesce(
            selected_attendance_date,
            (now() at time zone 'Asia/Seoul')::date
        );
    elsif selected_attendance_status is not null
          or selected_attendance_date is not null then
        raise exception '출석 상태는 등원 포인트를 지급할 때만 저장할 수 있습니다.';
    end if;

    update public.students
    set
        points = next_balance,
        updated_at = now()
    where id = student_record.id;

    insert into public.point_transactions (
        department_id,
        student_id,
        amount,
        balance_after,
        transaction_type,
        reason,
        attendance_status,
        attendance_date,
        adjusted_by
    )
    values (
        student_record.department_id,
        student_record.id,
        point_amount,
        next_balance,
        resolved_transaction_type,
        resolved_reason,
        case
            when resolved_transaction_type = 'attendance'
            then selected_attendance_status
            else null
        end,
        resolved_attendance_date,
        admin_profile.id
    )
    returning * into transaction_record;

    return transaction_record;
end;
$$;

revoke all on function public.adjust_student_points(
    uuid,
    integer,
    text,
    text,
    date
) from public;

grant execute on function public.adjust_student_points(
    uuid,
    integer,
    text,
    text,
    date
) to authenticated;

commit;
