# 밖에서도 접속하기

이 앱은 정적 PWA라 서버 프로그램 없이 배포할 수 있습니다. 개인정보성 보고 내용을 다루므로 포트포워딩보다 정적 배포를 권장합니다.

## 가장 쉬운 방법: Cloudflare Pages

1. GitHub에 이 프로젝트를 올립니다.
2. Cloudflare Pages에서 `Create a project`를 선택합니다.
3. GitHub 저장소를 연결합니다.
4. 빌드 설정을 이렇게 입력합니다.

```text
Build command: 비워둠
Build output directory: mobile_app
```

배포가 끝나면 `https://프로젝트명.pages.dev` 주소로 밖에서도 접속할 수 있습니다.

## Netlify

1. Netlify에서 `Add new site`를 선택합니다.
2. GitHub 저장소를 연결합니다.
3. 이 저장소의 `netlify.toml` 설정이 자동으로 `mobile_app` 폴더를 배포합니다.

## GitHub Pages

이 저장소를 GitHub에 올리면 `.github/workflows/deploy-mobile-app.yml` 워크플로가 `mobile_app` 폴더를 GitHub Pages로 배포합니다.

처음 한 번만 GitHub 저장소 설정에서 `Settings > Pages > Source`를 `GitHub Actions`로 선택하세요.

## 중요한 점

- 앱 데이터는 서버가 아니라 각 기기의 브라우저 저장소에 저장됩니다.
- PC와 아이폰 데이터는 자동 동기화되지 않습니다.
- 기기를 바꾸거나 브라우저 데이터를 지우기 전에는 앱 우상단 내보내기 버튼으로 JSON 백업을 저장하세요.
- 배포 주소를 아는 사람은 앱 화면에 접속할 수 있습니다. 실제 보고 데이터는 접속한 기기 안에 저장되지만, 주소 공유는 신중히 하세요.
