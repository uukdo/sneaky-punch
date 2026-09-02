# Sneaky Punch (몰래 샌드백)

키보드를 두드릴 때마다 사실은 샌드백을 한 대씩 치는 스트레스 해소 게임.

 https://uukdo.github.io/sneaky-punch/

## 실행 방법

`index.html`을 브라우저로 바로 열거나 로컬 서버로 띄우세요

```bash
npx serve .
# 또는
python3 -m http.server 8080
```

## 조작

- **아무 키 / 클릭** — 샌드백을 한 대씩 패기
- 게이지가 가득 차면 샌드백에서 스팀이 터지듯 뿜어져 나오고 화면이 흔들리는 연출이 나와요
- 배경은 게이지가 높아질수록 점점 뜨거운 색으로 물들어요
- 상단 **🌍 GLOBAL STATS** 버튼 — 지금까지 모든 플레이어가 친 **총 펀치 수**와 **역대 최고 콤보** 두 숫자만 보여주는 단순한 공유 통계 (개인별 순위 아님)
- 상단 **⏱ CHALLENGE** 버튼 — **60초 동안 최대한 많이 패는 도전 모드**. 끝나면 닉네임 입력해서 Top 10 리더보드에 등록 가능
- 통산 펀치 수 / 최고 콤보는 브라우저 `localStorage`에도 저장되어 다음에 열어도 유지됩니다 (이건 내 기기에만 남는 개인 기록)

- 리더보드 생성: Challenge 모드 플레이하면 닉네임으로 플레이 순위 확인 가능

## Supabase 스키마 (현재 배포된 것 기준)

`js/leaderboard.js` 상단의 `SUPABASE_URL` / `SUPABASE_ANON_KEY`가 이미 채워져 있으면 아래 두 기능이 동작합니다. 처음부터 새로 세팅하거나 스키마를 다시 맞출 때 참고하세요.

### GLOBAL STATS (전체 누적, 이름 없음)

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

### CHALLENGE (닉네임별 1줄, 개인 최고기록만 유지)

닉네임마다 딱 한 줄만 남고, 새 점수가 기존 기록보다 높을 때만 갱신됩니다 (오락실 하이스코어 방식). 등록은 반드시 `submit_challenge_score` 함수를 통해서만 가능하고, 테이블에 직접 insert하는 경로는 막혀 있습니다.

```sql
create table public.challenge_scores (
  id bigint generated always as identity primary key,
  name text not null unique,
  punches int not null,
  created_at timestamptz not null default now()
);

alter table public.challenge_scores enable row level security;

create policy "Anyone can read challenge scores"
on public.challenge_scores for select
using (true);

create or replace function public.submit_challenge_score(p_name text, p_punches int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(p_name) < 1 or char_length(p_name) > 20 then
    raise exception 'invalid name length';
  end if;
  if p_punches < 0 or p_punches > 10000 then
    raise exception 'invalid punches value';
  end if;

  insert into public.challenge_scores (name, punches)
  values (p_name, p_punches)
  on conflict (name) do update
  set punches = greatest(public.challenge_scores.punches, excluded.punches);
end;
$$;

grant execute on function public.submit_challenge_score(text, int) to anon;
```

> `punches`의 상한(10000)이나 닉네임 길이 제한은 필요하면 이 함수 안 숫자만 바꿔서 조정하면 됩니다.

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
