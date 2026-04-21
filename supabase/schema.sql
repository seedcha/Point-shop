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
    id serial primary key,
    parent_num1 int not null, -- 학생 비밀번호1
    parent_num2 int not null, -- 학생 비밀번호2
    name varchar(50) not null, -- 학생 이름
    points int default 0 -- 학생이 보유한 포인트
    created_at timestamp with time zone default now() -- 생성 시간
    updated_at timestamp with time zone default now() -- 업데이트 시간
);

-- 포인트 내역
create table point_transactions(
    id serial primary key,
    student_id int not null references students(id) on delete cascade, -- 학생 ID
    amount int not null, -- 포인트 변화량 (증가: 양수, 감소: 음수)
    reason varchar(255) not null, -- 포인트 변화 이유
    adjusted_by varchar(50) not null, -- 포인트 조정자 (예: 교사 이름)
    created_at timestamp with time zone default now() -- 생성 시간
);

-- 상품 테이블
create table products(
    id serial primary key,
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
commit;
