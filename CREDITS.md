# Credits

## Mã và thư viện
| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| three.js 0.187 | https://threejs.org | MIT |
| Vite 8 | https://vite.dev | MIT |
| TypeScript 7 | https://www.typescriptlang.org | Apache-2.0 |

## Hình và âm thanh
- **Hình 3D:** toàn bộ dựng bằng hình khối có sẵn của three.js trong `src/web/`; texture của các theme vẽ bằng code (CanvasTexture, shader). Repo không có file mô hình hay texture nào (ảnh trong `docs/img/` chỉ là ảnh chụp màn hình).
- **Âm thanh:** tổng hợp lúc chạy bằng Web Audio API (oscillator) trong `src/web/audio.ts`. Repo không có file âm thanh nào.
- **Phông chữ (theme trong game và trang xem trước `preview.html`):** Cormorant Garamond, Bitter, Mali và Be Vietnam Pro, tải từ Google Fonts lúc chạy, giấy phép SIL Open Font License 1.1.
- **Nhạc nền và câu thoại riêng của theme Chạy Show:** chỉ khi chạy `vite` dev, game phát `music/nhac-nen.mp3` và đọc `music/memes.json` nếu người chơi tự đặt trên máy mình. Thư mục `music/` không có trong repo (`.gitignore`); bản build không phát, không đọc và không chứa chúng. Repo không phân phối nhạc nào.

## Đề bài
Luật chơi, Test Contract và các ticket thuộc lab "AI SDLC: Đảo Đèn Lồng" của khóa học (bản chép ở `docs/lab/`).

## Công cụ AI
Claude Code (model Claude Opus 5.5, Anthropic) đã viết mã, test, tài liệu và harness theo yêu cầu của tác giả. Toàn bộ quá trình được ghi ở [docs/notes/ai-log.md](docs/notes/ai-log.md). Không có hình, âm thanh hay nhạc nào do AI tạo sinh.
