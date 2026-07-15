# Contributing

Terima kasih tertarik berkontribusi ke **vercel-spring**! 🙌

---

## 📖 Bahasa Indonesia

### Cara Berkontribusi

1. **Fork** repository ini
2. **Clone** fork kamu:
   ```bash
   git clone https://github.com/username-anda/vercel-spring.git
   cd vercel-spring
   npm install
   ```
3. **Buat branch** untuk perubahanmu:
   ```bash
   git checkout -b feat/nama-fitur
   ```
4. **Lakukan perubahan** dan pastikan tidak ada error:
   ```bash
   npm run build
   ```
5. **Commit** dengan pesan yang jelas:
   ```bash
   git commit -m "feat: menambahkan fitur X"
   ```
6. **Push** ke fork kamu:
   ```bash
   git push origin feat/nama-fitur
   ```
7. **Buat Pull Request** ke branch `master`

### Panduan

- Gunakan **TypeScript** — kode sumber ada di `src/`
- Jangan lupa update `dist/` dengan `npm run build`
- Tes perubahan kamu dengan project contoh di `example/`
- Kalau nambah fitur, tambahin juga dokumentasinya di README
- Ikuti konvensi commit: `feat:`, `fix:`, `docs:`, `chore:`, dll

### Area yang Butuh Bantuan

- ✅ Support Gradle (.gradle.kts, version catalog)
- ✅ Testing — unit test & integration test
- ✅ Dokumentasi — tutorial, FAQ, troubleshooting
- ✅ Template GitHub Actions untuk CI/CD
- ✅ Dukungan Java versi terbaru

---

## 📖 English

### How to Contribute

1. **Fork** this repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/vercel-spring.git
   cd vercel-spring
   npm install
   ```
3. **Create a branch** for your changes:
   ```bash
   git checkout -b feat/your-feature
   ```
4. **Make your changes** and ensure no errors:
   ```bash
   npm run build
   ```
5. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add feature X"
   ```
6. **Push** to your fork:
   ```bash
   git push origin feat/your-feature
   ```
7. **Open a Pull Request** against `master`

### Guidelines

- Write code in **TypeScript** — source files are in `src/`
- Run `npm run build` to update `dist/`
- Test your changes using the example project in `example/`
- If adding a feature, include documentation in README
- Follow commit conventions: `feat:`, `fix:`, `docs:`, `chore:`, etc.

### Help Wanted

- ✅ Gradle support (.gradle.kts, version catalog)
- ✅ Unit tests & integration tests
- ✅ Documentation — tutorials, FAQ, troubleshooting
- ✅ GitHub Actions CI/CD templates
- ✅ Latest Java version support

---

## 📝 Commit Convention

| Prefix | Usage |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `chore:` | Maintenance, refactor, deps |
| `test:` | Adding or updating tests |

## 💬 Questions?

Buka [issue](https://github.com/awand795/vercel-spring/issues) atau join diskusi di repository.
