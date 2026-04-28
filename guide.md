# 프로젝트 사용 가이드

터미널을 열어 아래 명령어를 입력합니다.
```
npx supabase login
```
연결되는 웹 브라우저에 출력된 verification code를 터미널에 입력하세요.

[supabase_dashboard](images/supabase_dashboard.png)
supabase dashboard에서 '프로젝트 ref' 를 확인합니다.

```
npx supabase link --project-ref YOUR_PROJECT_REF
```

```
New-Item -ItemType Directory -Force supabase\migrations
npx supabase migration new initial
```
생성된 파일명 확인 후 복사하여 사용합니다.
```
Copy-Item supabase\schema.sql supabase\migrations\파일명
npx supabase db push
```