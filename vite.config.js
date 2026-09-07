import { defineConfig } from 'vite';

/**
 * data-report (데이터 수집-시각화-분석 수행평가) - 개발/빌드 설정
 *
 * 이 설정 파일은 앱 폴더 안에 있고, 웹서버의 문서 루트도 이 폴더다.
 *   npm start  →  http://localhost:8087/ 에서 이 폴더의 index.html 이 메인 페이지로 열린다.
 *
 * 포트를 8087 로 쓰는 이유: 형제 앱들이 이미 8080~8086 을 쓰고 있다(8086은 algorithm-flowchart).
 * 두 앱을 동시에 띄워도 겹치지 않게 앱마다 포트를 다르게 준다.
 *
 * 설치·빌드 결과물(node_modules/, dist/)도 모두 이 폴더 안에 생긴다.
 * 프로젝트 루트(C:\project_AI)에는 아무것도 설치하지 않는다.
 */
export default defineConfig({
  root: '.',
  base: './',

  server: {
    port: 8087,
    strictPort: true,
    open: false
  },

  preview: {
    port: 8087,
    strictPort: true
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // 엑셀을 읽는 SheetJS + 그래프를 그리는 Chart.js 가 커서 기본 경고선(500kB)을 넘는다.
    // 교실에서는 한 번만 받아 두면 되므로 문제가 아니다. 경고선만 올려 둔다.
    chunkSizeWarningLimit: 800
  }
});
