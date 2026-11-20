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
- **Nhạc nền và câu thoại riêng của theme Chạy Show:** chỉ khi chạy `vite` dev, game phát `music/nhac-nen.mp3` và đọc `music/memes.json` nếu người chơi tự đặt trên máy mình. Thư mục `music/` không có trong repo (`.gitignore`); bản build không phát, không đọc và không chứa chúng. Repo và bản build không chứa bản nhạc nào; riêng video demo có ghép nhạc nền (mục Video demo bên dưới).

## Video demo
`demo.mp4` (4 phút 13 giây), đính kèm [Release v1.0.0](https://github.com/ToyzZone/K5-L3A-DAY12-NguyenMinhThong-2A202603637-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0).
- **Hình:** quay tự động, không quay tay. [Playwright](https://playwright.dev) (`playwright-core` 1.65.1, Apache-2.0) lái Microsoft Edge chơi game từ bản clone sạch của tag `phase-4`; đoạn theme ở cuối chạy trên `main` (v1.2.0). Các lệnh kiểm chứng (build, test, headless, soak, bench) chạy thật trong bản clone đó, đầu ra phát trực tiếp lên một trang dạng terminal để quay. Khung hình ghi qua Chrome DevTools Protocol và dựng bằng [FFmpeg](https://ffmpeg.org). Thẻ mở đầu, thẻ kết quả và dòng phụ đề là trang HTML dựng bằng chính trình duyệt đó. Đoạn nào tua nhanh đều ghi "tua nhanh ×N" trên màn hình. Mã driver nằm ngoài repo.
- **Nhạc nền:** bài "Thiên Lý Ơi" của Jack - J97, lấy từ file `music/nhac-nen.mp3` tác giả tự đặt trên máy, ghép thêm sau khi quay và lặp lại suốt video. Bài hát thuộc bản quyền của tác giả bài hát; repo này không có giấy phép dùng. Video không thu âm thanh của game.

## Đề bài
Luật chơi, Test Contract và các ticket thuộc lab "AI SDLC: Đảo Đèn Lồng" của khóa học (bản chép ở `docs/lab/`).

## Công cụ AI
Claude Code (model Claude Opus 5.5, Anthropic) đã viết mã, test, tài liệu và harness theo yêu cầu của tác giả. Video demo do Claude Code (model Claude Fable 5.2) lái trình duyệt, quay và dựng; chữ trên các thẻ và phụ đề trong video do nó viết. Toàn bộ quá trình được ghi ở [docs/notes/ai-log.md](docs/notes/ai-log.md). Không có hình, âm thanh hay nhạc nào do AI tạo sinh.
