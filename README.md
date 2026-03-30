# secretary

이 저장소의 실행 대상 앱은 `mobile` 디렉터리에 있는 Expo 기반 모바일 앱입니다.

## 앱 실행 방법

```bash
cd mobile
npm install
```

의존성 설치 후 아래 명령으로 앱을 실행할 수 있습니다.

```bash
npm start
```

Expo 개발 서버가 뜨면 다음 방식으로 실행할 수 있습니다.

- `w`: 웹에서 실행
- `i`: iOS 시뮬레이터에서 실행
- `a`: Android 에뮬레이터에서 실행

직접 실행 명령을 사용할 수도 있습니다.

```bash
npm run web
npm run ios
npm run android
```

참고:

- 네이티브 기능(`expo-notifications`, `expo-sqlite`) 확인이 필요하면 `npm run ios` 또는 `npm run android`로 개발 빌드를 사용하는 편이 더 정확합니다.
- Android 에뮬레이터 또는 iOS 시뮬레이터는 각 플랫폼 개발 환경이 미리 준비되어 있어야 합니다.

## APK 생성 방법

이 프로젝트는 [`mobile/eas.json`](/Users/kim/projects/llm/secretary/mobile/eas.json) 에 Android 빌드 프로필이 정의되어 있습니다.

먼저 `mobile` 디렉터리로 이동합니다.

```bash
cd mobile
```

### 1. 개발용 APK 생성

개발 클라이언트가 포함된 APK가 필요하면 아래 명령을 사용합니다.

```bash
eas build -p android --profile development
```

### 2. 공유/테스트용 APK 생성

내부 테스트나 기기 공유용 APK는 아래 명령을 사용합니다.

```bash
eas build -p android --profile preview
```

### 3. 사전 준비

`eas build`를 처음 사용할 때는 아래 준비가 필요할 수 있습니다.

```bash
npm install -g eas-cli
eas login
```

빌드가 시작되면 Expo/EAS가 원격으로 Android APK를 생성하고, 완료 후 다운로드 링크를 제공합니다.

## 주요 경로

- 앱 코드: [`mobile`](/Users/kim/projects/llm/secretary/mobile)
- Expo 설정: [`mobile/app.json`](/Users/kim/projects/llm/secretary/mobile/app.json)
- EAS 빌드 설정: [`mobile/eas.json`](/Users/kim/projects/llm/secretary/mobile/eas.json)
