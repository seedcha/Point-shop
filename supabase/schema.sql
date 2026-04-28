-- Supabase schema bootstrap file for the Point Shop project.
-- Fill this file with your table, index, constraint, policy, and seed SQL.
--
-- Suggested order:
-- 1. extensions
-- 2. enums / domains
-- 3. tables
-- 4. indexes
-- 5. triggers / functions
-- 6. row level security policies
-- 7. seed data

begin;

-- 학생 테이블
create table students(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_num1 int not null, -- 학생 비밀번호1
    parent_num2 int not null, -- 학생 비밀번호2
    name varchar(50) not null, -- 학생 이름
    points int default 0 -- 학생이 보유한 포인트
    created_at timestamp with time zone default now() -- 생성 시간
    updated_at timestamp with time zone default now() -- 업데이트 시간
);

-- 포인트 내역
create table point_transactions(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    amount int not null, -- 포인트 변화량 (증가: 양수, 감소: 음수)
    reason varchar(255) not null, -- 포인트 변화 이유
    adjusted_by varchar(50) not null, -- 포인트 조정자 (예: 교사 이름)
    created_at timestamp with time zone default now() -- 생성 시간
);

-- 상품 테이블
create table products(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(200) not null, -- 상품 이름
    description text, -- 상품 설명
    category varchar(50), -- 상품 카테고리
    price_dp int not null, -- 상품 가격 (포인트 단위)
    stock int not null, -- 상품 재고
    is_active boolean default true, -- 상품 활성 여부
    emoji varchar(10), -- 상품 이모지
    image_url varchar(255), -- 상품 이미지 URL
    created_at timestamp with time zone default now(), -- 생성 시간
    updated_at timestamp with time zone default now() -- 업데이트 시간
);

create table purchases(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    product_id uuid not null references products(id) on delete cascade, -- 상품 ID
    product_name varchar(200) not null,
    quantity int not null, -- 구매 수량
    dp_spent int not null, -- 총 사용 포인트
    created_at timestamp with time zone default now() -- 생성 시간
);

create table attendance_logs(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid not null references students(id) on delete cascade, -- 학생 ID
    date date not null, -- 출석 날짜
    status varchar(20) not null, -- 출석 상태 (예: '출석', '지각', '결석')
    points_earned int default 0, -- 출석으로 얻은 포인트
    created_at timestamp with time zone default now() -- 생성 시간
);

create table announcements(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(200) not null, -- 공지 제목
    content text not null, -- 공지 내용
    created_at timestamp with time zone default now() -- 생성 시간
);

-- 시간표 테이블
-- (강의명, 요일, 시작 시간) unique 제약 조건 추가 필요
create table timetable(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_name varchar(200) not null, -- 수업 이름
    day_of_week enum('월', '화', '수', '목', '금', '토', '일') not null, -- 요일 (예: '월요일', '화요일')
    start_time time not null, -- 수업 시작 시간
    end_time time not null, -- 수업 종료 시간
    student_counts int default 0, -- 수업에 참여하는 학생 수
    created_at timestamp with time zone default now() -- 생성 시간
    updated_at timestamp with time zone default now() -- 업데이트 시간
    is_active boolean default true, -- 시간표 활성 여부

    distinct on (class_name, day_of_week, start_time) -- 강의명, 요일, 시작 시간 조합이 유일하도록 제약 조건 추가
);

-- 관리자용 PIN 설정
create table admin_settings(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key varchar(100) not null unique, -- 설정 키(예: 'admin_pin', 'store_pin')
    value text not null, -- 설정 값(PIN은 bcrypt 해시로 저장)
    description varchar(255), -- 설정 설명
    created_at timestamp with time zone default now(), -- 생성 시간
    updated_at timestamp with time zone default now() -- 업데이트 시간
);
commit;
