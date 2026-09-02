# Sneaky Punch (몰래 샌드백)

키보드를 두드릴 때마다 사실은 샌드백을 한 대씩 치는 스트레스 해소 게임.

 https://uukdo.github.io/sneaky-punch/

## 실행 방법

`index.html`을 브라우저로 바로 열거나, 로컬 서버로 띄우세

```bash
npx serve .
# 또는
python3 -m http.server 8080
```

## 조작

- **아무 키 / 클릭** — 샌드백을 한 대씩 패기
- 게이지가 가득 차면 샌드백에서 스팀이 터지듯 뿜어져 나오고 화면이 흔들리는 연출이 나와요
- 배경은 게이지가 높아질수록 점점 뜨거운 색으로 물들어요
- 상단 **🌍 STATS** 버튼 — 지금까지 모든 플레이어가 친 **총 펀치 수**와 **역대 최고 콤보** 두 숫자만 보여주는 단순한 공유 통계 (개인별 순위 아님)
- 통산 펀치 수 / 최고 콤보는 브라우저 `localStorage`에도 저장되어 다음에 열어도 유지됩니다 (이건 내 기기에만 남는 개인 기록)

## 전체 통계 설정 (선택 사항)

`🌍 STATS`는 [Supabase](https://supabase.com) 무료 프로젝트를 연결해야 동작합니다. 연결 전에는 "아직 설정되지 않았어요" 안내만 뜨고, 게임 자체는 정상 동작합니다.

1. https://supabase.com 에서 무료 계정 생성 → 새 프로젝트 생성 (신용카드 필요 없음)
2. 프로젝트의 **SQL Editor**에서 아래 스키마 실행 — 딱 한 줄짜리 통계 테이블 + 안전하게 더하는 함수:

   ```sql
   create table public.global_stats (
     id int primary key default 1,
     total_punches bigint not null default 0,
     best_combo int not null default 0
   );
   insert into public.global_stats (id) values (1);

   alter table public.global_stats enable row level security;

   create policy "Anyone can read global stats"
   on public.global_stats for select
   using (true);

   create or replace function public.add_punch_stats(add_punches int, new_combo int)
   returns void
   language sql
   security definer
   set search_path = public
   as $$
     update public.global_stats
     set total_punches = total_punches + greatest(add_punches, 0),
         best_combo = greatest(best_combo, new_combo)
     where id = 1;
   $$;

   grant execute on function public.add_punch_stats(int, int) to anon;
   ```

3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사
   (⚠️ `service_role` 키는 절대 여기 쓰지 마세요 — 서버 전용 비밀키입니다)
4. [js/leaderboard.js](js/leaderboard.js) 맨 위 두 줄을 채우기:

   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...";
   ```

5. 저장 후 새로고침하면 `STATS`가 실제 공유 숫자로 동작

동작 방식: 펀치는 5초마다(또는 탭을 벗어날 때) 모아서 한 번에 서버로 보내고, 서버는 `add_punch_stats` 함수로 총합에 더하고 최고 콤보만 갱신합니다 — 여러 사람이 동시에 눌러도 안전합니다. 개인별 이름/순위는 저장하지 않습니다.

## 파일 구성

```
real-lab/
├── index.html          마크업
├── css/
│   └── style.css       스타일
├── js/
│   ├── script.js        게임 로직 (캔버스 렌더링, 펜듈럼 물리, 이펙트, 통계 UI)
│   └── leaderboard.js    Supabase REST API 연동 (fetch 기반, 별도 라이브러리 없음)
└── assets/
    └── favicon.png      파비콘
```
