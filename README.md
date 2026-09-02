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
- 전체 플레이어가 펀치한 수와 최고 콤보 기록이 표시됩니다.

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
