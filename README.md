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

이 프로젝트의 APK 생성 목표는 `EAS 원격 빌드`가 아니라 `로컬 Android 빌드`입니다.

### 사전 준비

로컬 APK를 만들려면 아래 환경이 준비되어 있어야 합니다.

- Android Studio / Android SDK
- JDK
- `mobile/node_modules` 설치 완료

먼저 Android 프로젝트 디렉터리로 이동합니다.

```bash
cd mobile/android
```

### 1. Debug APK 생성
```bash
./gradlew assembleDebug
```
- 생성 위치: [`mobile/android/app/build/outputs/apk/debug/app-debug.apk`](/Users/kim/projects/llm/secretary/mobile/android/app/build/outputs/apk/debug/app-debug.apk)
- APK 최상단으로 이동:
```bash
mv /Users/kim/projects/llm/secretary/mobile/android/app/build/outputs/apk/debug/app-debug.apk /Users/kim/projects/llm/secretary/
```

### 2. Release APK 생성
```bash
./gradlew assembleRelease
```
- 생성 위치: [`mobile/android/app/build/outputs/apk/release/app-release.apk`](/Users/kim/projects/llm/secretary/mobile/android/app/build/outputs/apk/release/app-release.apk)
- APK 최상단으로 이동:
```bash
mv /Users/kim/projects/llm/secretary/mobile/android/app/build/outputs/apk/release/app-release.apk /Users/kim/projects/llm/secretary/
```

참고:

- 추후 실제 출시를 진행할 때는 `EAS` 사용도 고려할 수 있습니다.

## 주요 경로

- 앱 코드: [`mobile`](/Users/kim/projects/llm/secretary/mobile)
- Expo 설정: [`mobile/app.json`](/Users/kim/projects/llm/secretary/mobile/app.json)
- Android 빌드 설정: [`mobile/android/app/build.gradle`](/Users/kim/projects/llm/secretary/mobile/android/app/build.gradle)
