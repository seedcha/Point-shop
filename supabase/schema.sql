-- Supabase schema bootstrap file for the Point Shop project.

begin;

-- extensions
create extension if not exists pgcrypto;

-- department 테이블
create table departments (
    id uuid primary key default gen_random_uuid(), -- 가맹점 ID
    name varchar(50) not null unique, -- 가맹점 이름
    is_active boolean not null default true, -- 가맹점 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 관리자 테이블
create table admin_profiles (
    id uuid primary key default gen_random_uuid(), -- 관리자 ID
    login_id varchar(50) not null unique, -- 로그인 시 사용하는 ID
    manager_name varchar(50) not null, -- 관리자 이름
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    role varchar(20) not null default 'staff'
        check (role in ('master', 'manager','staff')), -- 관리자 역할 (마스터 또는 매니저)
    department_id uuid references departments(id) on delete restrict, -- 관리자 가맹점 (master는 null)
    is_active boolean not null default true, -- 관리자 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 시간표
create table timetable (
    id uuid primary key default gen_random_uuid(), -- 시간표 ID
    department_id uuid not null references departments(id) on delete restrict,
    class_name varchar(200) not null, -- 수업 이름
    day_of_week varchar(10) not null
        check (day_of_week in ('월', '화', '수', '목', '금', '토', '일')), -- 요일
    start_time time not null, -- 수업 시작 시간
    end_time time not null, -- 수업 종료 시간
    is_active boolean not null default true, -- 시간표 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now(), -- 업데이트 시간
    unique (department_id, class_name, day_of_week, start_time), -- 강의명, 요일, 시작 시간 조합 중복 방지
    check (start_time < end_time) -- 종료 시간이 시작 시간보다 늦어야 함
);

-- 실제 수업일
create table class_sessions (
    id uuid primary key default gen_random_uuid(),
    timetable_id uuid not null references timetable(id) on delete cascade,
    department_id uuid not null references departments(id) on delete cascade,
    session_date date not null,
    scheduled_start_at timestamptz not null,
    scheduled_end_at timestamptz not null,
    status text not null default 'scheduled'
        check (status in ('scheduled', 'completed', 'cancelled')),
    note text,
    created_by uuid references admin_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint class_sessions_time_check
        check (scheduled_end_at > scheduled_start_at),
    constraint class_sessions_timetable_date_key
        unique (timetable_id, session_date)
);

-- 학생 테이블
create table students (
    id uuid primary key default gen_random_uuid(), -- 학생 ID
    department_id uuid not null references departments(id) on delete restrict, -- 학생 가맹점
    teacher_id uuid references admin_profiles(id) on delete set null, -- 담당 강사
    parent_phone varchar(20) not null, -- 학부모 전화번호
    name varchar(50) not null, -- 학생 이름
    grade varchar(20) not null
        check (grade in (
            '3세', '4세', '5세', '6세', '7세',
            '초1', '초2', '초3', '초4', '초5', '초6',
            '중1', '중2', '중3',
            '고1', '고2', '고3',
            '성인'
        )), -- 학생 학년
    points int not null default 0, -- 학생이 보유한 포인트
    is_active boolean not null default true, -- 학생 활성 여부
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now(), -- 업데이트 시간
    constraint students_id_department_key unique (id, department_id)
);

-- 학생과 수업 간의 다대다 관계 테이블
create table student_classes (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade,
    class_id uuid not null references timetable(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (student_id, class_id)
);

-- 상품 테이블
create table products (
    id uuid primary key default gen_random_uuid(), -- 상품 ID
    department_id uuid not null references departments(id) on delete cascade, -- 상품 가맹점
    name varchar(200) not null, -- 상품 이름
    description text, -- 상품 설명
    category varchar(50), -- 상품 카테고리
    price_dp int not null check (price_dp >= 0), -- 상품 가격 (포인트 단위)
    stock int not null default 0 check (stock >= 0), -- 상품 재고
    is_active boolean not null default true, -- 상품 활성 여부
    emoji varchar(10), -- 상품 이모지
    image_url text, -- 상품 이미지 URL
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 구매 내역
create table purchases (
    id uuid primary key default gen_random_uuid(), -- 구매 ID
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    product_id uuid not null references products(id) on delete restrict, -- 상품 ID
    product_name varchar(200) not null, -- 구매 당시 상품 이름
    quantity int not null check (quantity > 0), -- 구매 수량
    dp_spent int not null check (dp_spent >= 0), -- 총 사용 포인트
    status varchar(20) not null default 'completed'
        check (status in ('completed', 'cancelled', 'refunded')), -- 구매 상태
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간(구매 취소 등)
);

-- 구매 요청 테이블
create table purchase_requests (
    id uuid primary key default gen_random_uuid(), -- 구매 요청 ID
    department_id uuid not null references departments(id) on delete cascade, -- 요청 가맹점
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    product_id uuid not null references products(id) on delete restrict, -- 상품 ID
    quantity int not null check (quantity > 0), -- 구매 수량
    status varchar(20) not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')), -- 요청 상태
    handled_by uuid references admin_profiles(id) on delete set null, -- 승인/거절 처리자
    handled_at timestamptz, -- 승인/거절 처리 시간
    reject_reason text, -- 거절 사유
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now() -- 업데이트 시간
);

-- 포인트 이력
create table point_transactions (
    id uuid primary key default gen_random_uuid(), -- 포인트 이력 ID
    department_id uuid references departments(id) on delete restrict, -- 거래 가맹점
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    purchase_id uuid references purchases(id) on delete set null, -- 연결된 구매 ID
    amount int not null, -- 포인트 변화량 (증가: 양수, 감소: 음수)
    balance_after int not null check (balance_after >= 0), -- 거래 후 학생 보유 포인트
    transaction_type varchar(30) not null
        check (transaction_type in ('attendance', 'purchase', 'refund', 'etc')), -- 포인트 변동 유형
    reason varchar(255) not null, -- 포인트 변화 이유
    attendance_status text
        check (attendance_status is null or attendance_status in ('on_time', 'late')),
    attendance_date date,
    adjusted_by uuid references admin_profiles(id), -- 포인트 조정자
    created_at timestamptz not null default now(), -- 생성 시간
    constraint point_transactions_attendance_metadata_check
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
        )
);

-- Point reason presets
create table point_reason_presets (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null references departments(id) on delete cascade,
    label text not null,
    default_points integer check (default_points is null or default_points >= 0),
    sort_order integer not null default 0 check (sort_order >= 0),
    is_active boolean not null default true,
    created_by uuid references admin_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint point_reason_presets_label_check
        check (char_length(trim(label)) > 0),
    constraint point_reason_presets_department_label_key
        unique (department_id, label)
);

alter table point_reason_presets enable row level security;

create policy point_reason_presets_select_scope
on point_reason_presets
for select
to authenticated
using (
    exists (
        select 1
        from admin_profiles
        where admin_profiles.auth_user_id = auth.uid()
          and admin_profiles.is_active = true
          and (
              admin_profiles.role = 'master'
              or admin_profiles.department_id = point_reason_presets.department_id
          )
    )
);

create policy point_reason_presets_insert_scope
on point_reason_presets
for insert
to authenticated
with check (
    exists (
        select 1
        from admin_profiles
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
on point_reason_presets
for update
to authenticated
using (
    exists (
        select 1
        from admin_profiles
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
        from admin_profiles
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
on point_reason_presets
for delete
to authenticated
using (
    label not in ('등원', '수업 참여도 우수', '포인트 조정', '기타')
    and exists (
        select 1
        from admin_profiles
        where admin_profiles.auth_user_id = auth.uid()
          and admin_profiles.is_active = true
          and admin_profiles.role in ('master', 'manager')
          and (
              admin_profiles.role = 'master'
              or admin_profiles.department_id = point_reason_presets.department_id
          )
    )
);

-- 출석 로그
create table attendance_logs (
    id uuid primary key default gen_random_uuid(), -- 출석 로그 ID
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    class_id uuid not null references timetable(id) on delete cascade, -- 수업 ID
    session_id uuid references class_sessions(id) on delete set null, -- 실제 수업일 ID
    date date not null, -- 출석 날짜
    status varchar(20) not null check (status in ('출석', '지각', '결석')), -- 출석 상태
    checked_in_at timestamptz, -- 실제 등원 시각
    recorded_by uuid references admin_profiles(id) on delete set null, -- 출석 기록자
    note text, -- 출석 관련 비고
    dp_earned int not null default 0, -- 출석으로 얻은 포인트
    created_at timestamptz not null default now(), -- 생성 시간
    updated_at timestamptz not null default now(), -- 수정 시간
    unique (student_id, class_id, date) -- 중복 출석 방지
);

-- 칭호 정의
create table achievements (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null references departments(id) on delete cascade,
    code text not null,
    name text not null,
    category text not null
        check (category in ('attendance', 'inquiry', 'competition', 'general')),
    rarity text not null
        check (rarity in ('common', 'rare', 'heroic', 'legendary', 'mythic')),
    description text not null,
    image_url text,
    condition_type text not null,
    condition_value integer check (condition_value is null or condition_value >= 0),
    condition_unit text,
    condition_config jsonb not null default '{}'::jsonb,
    is_automatic boolean not null default false,
    is_active boolean not null default true,
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint achievements_code_check check (char_length(trim(code)) > 0),
    constraint achievements_name_check check (char_length(trim(name)) > 0),
    constraint achievements_department_code_key unique (department_id, code),
    constraint achievements_id_department_key unique (id, department_id)
);

-- 학생별 보유 칭호
create table student_achievements (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null,
    student_id uuid not null,
    achievement_id uuid not null,
    awarded_by uuid references admin_profiles(id) on delete set null,
    award_source text not null default 'automatic'
        check (award_source in ('automatic', 'manual', 'imported')),
    award_note text,
    awarded_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint student_achievements_student_achievement_key
        unique (student_id, achievement_id),
    constraint student_achievements_student_department_fkey
        foreign key (student_id, department_id)
        references students(id, department_id) on delete cascade,
    constraint student_achievements_achievement_department_fkey
        foreign key (achievement_id, department_id)
        references achievements(id, department_id) on delete cascade
);

-- 학생별 칭호 달성 진행도
create table achievement_progress (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null,
    student_id uuid not null,
    achievement_id uuid not null,
    current_value integer not null default 0 check (current_value >= 0),
    streak_value integer not null default 0 check (streak_value >= 0),
    period_started_at timestamptz,
    period_ended_at timestamptz,
    progress_data jsonb not null default '{}'::jsonb,
    last_evaluated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint achievement_progress_student_achievement_key
        unique (student_id, achievement_id),
    constraint achievement_progress_period_check
        check (
            period_ended_at is null
            or period_started_at is null
            or period_ended_at >= period_started_at
        ),
    constraint achievement_progress_student_department_fkey
        foreign key (student_id, department_id)
        references students(id, department_id) on delete cascade,
    constraint achievement_progress_achievement_department_fkey
        foreign key (achievement_id, department_id)
        references achievements(id, department_id) on delete cascade
);

-- 출석·질문·시험·수상 등 칭호 판정 이벤트
create table achievement_events (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null references departments(id) on delete cascade,
    student_id uuid not null,
    achievement_id uuid,
    event_type text not null,
    event_value integer not null default 1,
    event_data jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    recorded_by uuid references admin_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint achievement_events_type_check
        check (char_length(trim(event_type)) > 0),
    constraint achievement_events_student_department_fkey
        foreign key (student_id, department_id)
        references students(id, department_id) on delete cascade,
    constraint achievement_events_achievement_department_fkey
        foreign key (achievement_id, department_id)
        references achievements(id, department_id) on delete restrict
);

-- 학생별 등원 통계
create table student_attendance_stats (
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
        references students(id, department_id) on delete cascade,
    constraint student_attendance_stats_count_check
        check (
            total_attendance_count
            = on_time_attendance_count + late_attendance_count
        )
);

-- 가맹점별 당일 최초 등원
create table department_daily_first_attendance (
    department_id uuid not null references departments(id) on delete cascade,
    attendance_date date not null,
    student_id uuid not null,
    point_transaction_id uuid not null unique
        references point_transactions(id) on delete cascade,
    recorded_at timestamptz not null default now(),
    primary key (department_id, attendance_date),
    constraint department_daily_first_attendance_student_department_fkey
        foreign key (student_id, department_id)
        references students(id, department_id) on delete cascade
);

alter table students
    add column selected_achievement_id uuid;

alter table students
    add constraint students_selected_achievement_department_fkey
        foreign key (selected_achievement_id, department_id)
        references achievements(id, department_id) on delete restrict;

create or replace function seed_default_achievements(
    target_department_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
    insert into achievements (
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

create or replace function seed_default_achievements_for_new_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform seed_default_achievements(new.id);
    return new;
end;
$$;

create trigger seed_default_achievements_after_department_insert
after insert on departments
for each row
execute function seed_default_achievements_for_new_department();

revoke all on function seed_default_achievements(uuid) from public;
revoke all on function seed_default_achievements_for_new_department() from public;

create or replace function process_attendance_point_achievement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    attendance_stats student_attendance_stats%rowtype;
    is_daily_first boolean := false;
    inserted_daily_first_count integer := 0;
begin
    if new.transaction_type <> 'attendance' then
        return new;
    end if;

    insert into department_daily_first_attendance (
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

    insert into student_attendance_stats (
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
        total_attendance_count = student_attendance_stats.total_attendance_count + 1,
        on_time_attendance_count = student_attendance_stats.on_time_attendance_count
            + case when excluded.on_time_attendance_count = 1 then 1 else 0 end,
        late_attendance_count = student_attendance_stats.late_attendance_count
            + case when excluded.late_attendance_count = 1 then 1 else 0 end,
        current_on_time_streak = case
            when excluded.on_time_attendance_count = 1
            then student_attendance_stats.current_on_time_streak + 1
            else 0
        end,
        longest_on_time_streak = greatest(
            student_attendance_stats.longest_on_time_streak,
            case
                when excluded.on_time_attendance_count = 1
                then student_attendance_stats.current_on_time_streak + 1
                else student_attendance_stats.longest_on_time_streak
            end
        ),
        last_attendance_date = excluded.last_attendance_date,
        updated_at = now()
    returning * into attendance_stats;

    insert into achievement_events (
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

    insert into achievement_progress (
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
            when 'total_attendance' then attendance_stats.total_attendance_count
            when 'on_time_streak' then attendance_stats.current_on_time_streak
            when 'daily_first' then case when is_daily_first then 1 else 0 end
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
    from achievements as achievement
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

    insert into student_achievements (
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
    from achievements as achievement
    where achievement.department_id = new.department_id
      and achievement.category = 'attendance'
      and achievement.is_automatic = true
      and achievement.is_active = true
      and (
          (
              achievement.condition_type = 'total_attendance'
              and attendance_stats.total_attendance_count >= achievement.condition_value
          )
          or (
              achievement.condition_type = 'on_time_streak'
              and attendance_stats.current_on_time_streak >= achievement.condition_value
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

create trigger process_attendance_point_achievement_after_insert
after insert on point_transactions
for each row
when (new.transaction_type = 'attendance')
execute function process_attendance_point_achievement();

revoke all on function process_attendance_point_achievement() from public;

create or replace function adjust_student_points(
    target_student_id uuid,
    point_amount integer,
    point_reason text,
    selected_attendance_status text default null,
    selected_attendance_date date default null
)
returns point_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
    admin_profile admin_profiles%rowtype;
    student_record students%rowtype;
    transaction_record point_transactions%rowtype;
    resolved_reason text := trim(point_reason);
    resolved_transaction_type text := 'etc';
    resolved_attendance_date date;
    next_balance integer;
begin
    select *
    into admin_profile
    from admin_profiles
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
    from students
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

    update students
    set
        points = next_balance,
        updated_at = now()
    where id = student_record.id;

    insert into point_transactions (
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

revoke all on function adjust_student_points(
    uuid,
    integer,
    text,
    text,
    date
) from public;

grant execute on function adjust_student_points(
    uuid,
    integer,
    text,
    text,
    date
) to authenticated;

-- 공지사항
create table announcements (
    id uuid primary key default gen_random_uuid(), -- 공지 ID
    title varchar(200) not null, -- 공지 제목
    content text not null, -- 공지 내용
    created_at timestamptz not null default now() -- 생성 시간
);

-- 홈 공지
create table home_announcements (
    id uuid primary key default gen_random_uuid(),
    department_id uuid not null references departments(id) on delete cascade,
    type text not null check (type in ('contest', 'vacation', 'award')),
    title text not null,
    start_date date not null,
    end_date date not null,
    details text,
    is_active boolean not null default true,
    created_by uuid references admin_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint home_announcements_date_check check (end_date >= start_date)
);

-- 수상 공지 학생 목록
create table announcement_award_students (
    id uuid primary key default gen_random_uuid(),
    announcement_id uuid not null references home_announcements(id) on delete cascade,
    student_name text not null,
    award_name text not null,
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default now()
);

-- indexes for performance optimization
-- 관리자가 로그인했을 때 자기 가맹점 기준 조회
create index idx_admin_profiles_department_id
on admin_profiles(department_id);

-- 가맹점별 시간표 조회
create index idx_timetable_department_id
on timetable(department_id);

create index idx_class_sessions_department_date
on class_sessions(department_id, session_date, status);

-- 수업 클릭 시 해당 학생 목록 조회
create index idx_student_classes_class_id
on student_classes(class_id);

-- 학생 상세에서 학생이 듣는 수업 조회
create index idx_student_classes_student_id
on student_classes(student_id);

-- 가맹점별 상품 필터링
create index idx_products_department_id
on products(department_id);

-- 학생별 포인트 이력 조회
create index idx_point_transactions_student_id
on point_transactions(student_id);

create unique index point_transactions_student_attendance_date_key
on point_transactions(department_id, student_id, attendance_date)
where transaction_type = 'attendance';

create index idx_point_transactions_attendance_lookup
on point_transactions(
    department_id,
    student_id,
    attendance_date desc,
    attendance_status
)
where transaction_type = 'attendance';

create index idx_students_department_id
on students(department_id);

create index idx_students_teacher_id
on students(teacher_id);

create index idx_attendance_logs_student_date
on attendance_logs(student_id, date desc);

create index idx_attendance_logs_session
on attendance_logs(session_id);

create index idx_attendance_logs_checked_in
on attendance_logs(student_id, checked_in_at);

create index idx_achievements_department_active_sort
on achievements(department_id, is_active, category, sort_order);

create index idx_student_achievements_student_awarded
on student_achievements(student_id, awarded_at desc);

create index idx_student_achievements_department_student
on student_achievements(department_id, student_id, awarded_at desc);

create index idx_achievement_progress_student
on achievement_progress(student_id, achievement_id);

create index idx_achievement_progress_department_student
on achievement_progress(department_id, student_id, achievement_id);

create index idx_achievement_events_student_occurred
on achievement_events(student_id, occurred_at desc);

create index idx_achievement_events_department_type
on achievement_events(department_id, event_type, occurred_at desc);

create index idx_student_attendance_stats_department
on student_attendance_stats(
    department_id,
    current_on_time_streak desc,
    total_attendance_count desc
);

create index idx_point_transactions_department_id
on point_transactions(department_id);

create index idx_point_transactions_department_type
on point_transactions(department_id, transaction_type);

create index idx_point_transactions_adjusted_by
on point_transactions(adjusted_by);

create index idx_point_reason_presets_department_active
on point_reason_presets(department_id, is_active, created_at);

create index idx_point_reason_presets_department_sort
on point_reason_presets(department_id, is_active, sort_order);

create index idx_purchase_requests_department_status
on purchase_requests(department_id, status, created_at desc);

create index idx_purchase_requests_student
on purchase_requests(student_id);

create index idx_purchase_requests_product
on purchase_requests(product_id);

create index idx_home_announcements_department
on home_announcements(department_id, is_active, start_date, end_date);

create index idx_award_students_announcement
on announcement_award_students(announcement_id, sort_order);

-- Initial data seeding
insert into departments (name) values
('대치'), ('판교')
on conflict (name) do nothing;

insert into point_reason_presets (
    department_id,
    label,
    default_points,
    sort_order
)
select
    department.id,
    reason.label,
    reason.default_points,
    reason.sort_order
from departments as department
cross join (
    values
        ('등원', null::integer, 0),
        ('수업 참여도 우수', null::integer, 1),
        ('포인트 조정', null::integer, 2),
        ('기타', null::integer, 3)
) as reason(label, default_points, sort_order)
on conflict (department_id, label) do nothing;

select seed_default_achievements(id)
from departments;

insert into admin_profiles (manager_name, login_id, auth_user_id, role, department_id) values
('Kyle', 'kyle0108', 'd5ad371c-0b63-46b1-90db-fbd774d37123', 'master', null)
on conflict (auth_user_id) do nothing;

commit;
