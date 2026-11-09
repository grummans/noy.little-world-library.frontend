# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Chạy local

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + build production vào dist/
npm run preview    # xem thử bản build
```

## Docker

Image production là Nginx phục vụ thư mục `dist/` đã build (multi-stage, không chứa
`node_modules` hay mã nguồn).

```bash
docker build -t little-world-library .
docker run --rm -p 8080:80 little-world-library
```

Mở http://localhost:8080.

Ghi chú:

- Health check của container: `GET /healthz` trả `200 ok`.
- Mọi route SPA (`/library`, `/books/:slug`, `/read/:slug`, …) đều fallback về
  `index.html`, nên refresh trực tiếp ở các route này không bị 404.
- `nginx.conf` giữ MIME `application/epub+zip` cho file `.epub` và bật cache dài hạn
  cho asset có hash trong `/assets/`.
- Không có backend/database trong image.
- Ảnh gọi API bằng URL tương đối `/api`: dev do Vite proxy sang `:8080`, production do Nginx Proxy
  Manager route `/api` về container Go (giữ same-origin cho cookie session).
- CI/CD: `.github/workflows/release.yml` build + scan (gitleaks, CodeQL, hadolint, Trivy) rồi push
  `ghcr.io/<repo>:{dev,main,semver,sha-*}`; PR chỉ validate, không push. Tag `v*.*.*` tạo GitHub Release.
