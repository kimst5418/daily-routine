# Development Build 알림 검증

## 1. 목적
- Expo Go 대신 development build에서 실제 Android 시스템 알림 동작을 확인한다.
- 확인 대상
  - 알림 권한 요청
  - 로컬 알림 예약
  - 반복 리마인드 재예약
  - 수동 해제 시 종료

## 2. 현재 준비 상태
- `expo-dev-client` 사용
- `expo-notifications` config plugin 적용
- Android 기본 알림 채널 `default` 생성
- `eas.json`에 development profile 추가

## 3. 실행 방법

### 3-1. 의존성 설치
```bash
cd /Users/kim/projects/llm/secretary/mobile
npm install
```

### 3-2. 로컬 Android development build
```bash
cd /Users/kim/projects/llm/secretary/mobile
npx expo run:android
```

### 3-3. EAS development build
```bash
cd /Users/kim/projects/llm/secretary/mobile
eas build --platform android --profile development
```

### 3-4. JS 번들러 실행
```bash
cd /Users/kim/projects/llm/secretary/mobile
npm run start:dev
```

## 4. 검증 시나리오

### 시나리오 A. 권한 요청
1. 앱 실행
2. `알림 권한 다시 확인` 버튼 탭
3. Android 권한 팝업 노출 확인
4. 허용 후 상단 상태 문구가 허용 상태로 바뀌는지 확인

### 시나리오 B. 최초 알림 예약
1. 알림 규칙 생성
  - 지연 시간: `0시간 1분`
  - 반복 간격: `1분`
2. 기준 테스크를 `DONE`
3. 1분 뒤 실제 시스템 알림이 표시되는지 확인

### 시나리오 C. 반복 리마인드
1. 시나리오 B 직후 앱을 계속 실행
2. 첫 알림 이후 1분 뒤 다음 알림이 다시 오는지 확인
3. 알림 탭의 예약 시각도 다음 분으로 갱신되는지 확인

### 시나리오 D. 종료 조건
1. 수동 해제 버튼 탭
2. 이후 같은 이벤트의 추가 알림이 멈추는지 확인

## 5. 주의 사항
- 현재 반복 재스케줄 엔진은 앱 실행 중 30초 주기로 due 이벤트를 처리한다.
- 앱 종료 상태 반복 보장은 아직 별도 검증 대상이다.
- development build 검증 후 필요한 경우 백그라운드 대응 정책을 추가로 결정한다.
