# Jeju Wave Radio — WebGL embed

브라우저용 제주 해양·날씨 데이터 악기입니다. WebGL이 여섯 개의 날씨 영상을 교차 전환하고, Web Audio가 Pure Data 패치의 핵심 여섯 레이어를 재해석합니다.

## Local preview

브라우저 보안 정책 때문에 파일을 직접 열지 말고 HTTP 서버로 실행합니다.

```bash
cd ..
python3 -m http.server 8080
```

Then open [http://localhost:8080/web/](http://localhost:8080/web/). `assets/video/`를 함께 제공해야 하므로 `web/` 폴더 안에서 서버를 시작하면 안 됩니다. 처음에는 무음이며, 방문자가 `Start audio`를 눌러야 소리가 시작됩니다.

## Host and embed

배포할 때 `web/`와 저장소 루트의 `assets/video/`를 함께 올리고, 두 폴더의 상대 위치를 유지해야 합니다. 웹 앱은 영상 파일을 `../assets/video/`에서 불러옵니다.

```html
<iframe
  src="/jeju-wave-radio/web/"
  title="Jeju Wave Radio"
  width="100%"
  height="640"
  loading="lazy"
  allow="autoplay">
</iframe>
```

`embed-example.html`은 같은 서버에서 iframe 동작을 확인할 수 있는 최소 예시입니다.

## Live data and privacy

브라우저가 공개 Open-Meteo 날씨·해양·대기질 API를 직접 요청합니다. API 키, 로그인, 쿠키, 마이크 접근, 사용자 데이터 수집은 없습니다. 요청이 실패하면 앱은 `sunny_day` 데모 값으로 계속 동작하며 화면에 폴백 상태를 표시합니다.

## Manual verification

1. 기본 화면에서 소리가 나지 않는지 확인합니다.
2. `Start audio`를 눌러 사운드가 시작되는지 확인합니다.
3. 상태 선택기에서 여섯 날씨 상태를 모두 골라 영상 전환을 확인합니다.
4. `Refresh live data`를 눌러 지표가 바뀌거나 폴백 안내가 표시되는지 확인합니다.
5. 모바일 폭에서도 버튼과 선택기가 모두 보이는지 확인합니다.
