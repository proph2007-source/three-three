# 지역원 관리 모바일 앱

아이폰 Safari에서 열어 사용할 수 있는 정적 PWA입니다.

## 기능

- 지역장, 구역장, 구역원 편성 및 보고 예정일 관리
- Signal 전달/공지/요청/보고 내용 저장
- 보고 입력, 상태별 조회, 내용 검색
- 구역별 보고 통계와 3일 이내 보고 알림
- 전체 데이터 JSON 내보내기
- 보고 예정일 캘린더 파일(`.ics`) 내보내기
- Supabase 로그인 기반 아이폰/노트북 데이터 동기화

## 실행

파일만 열어도 동작하지만, 홈 화면 추가와 오프라인 캐시를 확인하려면 로컬 서버로 실행하는 것이 좋습니다.

```powershell
cd mobile_app
python -m http.server 8080
```

브라우저에서 `http://localhost:8080`을 열면 됩니다.

## 아이폰에서 사용

1. 같은 네트워크에서 PC의 로컬 주소로 접속합니다.
2. Safari 공유 버튼을 누릅니다.
3. `홈 화면에 추가`를 선택합니다.

데이터는 현재 브라우저에 저장됩니다. 기기를 바꾸기 전에는 JSON 내보내기를 사용해 백업하세요.

## 공유 데이터베이스 설정

1. Supabase 프로젝트를 만듭니다.
2. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. `supabase-config.example.js`를 참고해 `supabase-config.js`에 Project URL과 anon public key를 입력합니다.
4. 앱을 다시 배포합니다.
5. 아이폰과 노트북에서 같은 이메일 계정으로 로그인합니다.

설정 전에는 기존처럼 각 기기 브라우저 안에만 저장됩니다.

## 밖에서 접속

Cloudflare Pages, Netlify, GitHub Pages에 배포할 수 있습니다. 자세한 절차는 [DEPLOY.md](./DEPLOY.md)를 보세요.
