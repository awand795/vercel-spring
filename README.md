<div align="center">
  <h1>⚡ vercel-spring</h1>
  <p><strong>Spring Boot Runtime for Vercel — deploy Spring Boot apps with GraalVM Native Image</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/vercel-spring">
      <img src="https://img.shields.io/npm/v/vercel-spring" alt="npm version">
    </a>
    <a href="https://www.npmjs.com/package/vercel-spring">
      <img src="https://img.shields.io/npm/dm/vercel-spring" alt="npm downloads">
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/npm/l/vercel-spring" alt="MIT License">
    </a>
    <a href="https://github.com/awand795/vercel-spring">
      <img src="https://img.shields.io/github/stars/awand795/vercel-spring?style=social" alt="GitHub stars">
    </a>
  </p>
  <br>
</div>

---

**vercel-spring** adalah Vercel Community Runtime untuk Spring Boot. Dengan GraalVM Native Image, aplikasi Spring Boot kamu bisa jalan di Vercel sebagai serverless function — cold start di bawah 500ms.

---

## 📦 Installation

```bash
npm i -g vercel
```

Tidak perlu install `vercel-spring` secara lokal. Cukup referensikan di `vercel.json`.

## 🚀 Quick Start

### 1. Struktur project

```
my-spring-app/
├── api/
│   └── index.java          # Marker entrypoint
├── src/
│   └── main/
│       ├── java/
│       └── resources/
├── pom.xml
├── vercel.json
└── .vercelignore
```

### 2. `api/index.java` (marker file)

```java
// Marker file for Vercel Spring Boot runtime
```

### 3. `vercel.json`

```json
{
  "functions": {
    "api/index.java": {
      "runtime": "vercel-spring@0.1.5",
      "memory": 3008,
      "maxDuration": 30
    }
  },
  "routes": [
    { "src": "/(.*)", "dest": "/api/index.java" }
  ]
}
```

### 4. `pom.xml` — tambahkan native profile

```xml
<profile>
    <id>native</id>
    <build>
        <plugins>
            <plugin>
                <groupId>org.graalvm.buildtools</groupId>
                <artifactId>native-maven-plugin</artifactId>
                <executions>
                    <execution>
                        <id>build-native</id>
                        <goals><goal>compile</goal></goals>
                        <phase>package</phase>
                    </execution>
                </executions>
                <configuration>
                    <imageName>${project.artifactId}</imageName>
                    <buildArgs>
                        <buildArg>--enable-url-protocols=http</buildArg>
                        <buildArg>--no-fallback</buildArg>
                    </buildArgs>
                </configuration>
            </plugin>
        </plugins>
    </build>
</profile>
```

### 5. Deploy

```bash
vercel --prod
```

Done. 🎉

## 🔧 How It Works

```
                          Vercel Platform
                               │
                     ┌─────────▼─────────┐
                     │   HTTP Request     │
                     └─────────┬─────────┘
                               │
                     ┌─────────▼─────────┐
                     │  launcher.mjs      │  (Node.js Lambda handler)
                     │  (keep-alive)      │
                     └─────────┬─────────┘
                               │ spawn / proxy
                     ┌─────────▼─────────┐
                     │ spring-app.bin     │  (GraalVM native image)
                     │ Spring Boot App    │
                     └───────────────────┘
```

| Tahap | Proses |
|---|---|
| **Build** | Deteksi project → install GraalVM → build native image (`mvn -Pnative native:compile` / `gradle nativeCompile`) |
| **Runtime** | Node.js launcher spawn native binary, proxy HTTP request, 5 menit keep-alive untuk reuse |

## ✨ Features

- ✅ **Zero configuration** — auto-detect Java version & build system (Maven/Gradle)
- ✅ **Multi-Java** — mendukung Java 17, 21, 22, 23, 24, 25
- ✅ **Cold start cepat** — ~100-500ms (vs 5-15s di JVM biasa)
- ✅ **Auto-download toolchain** — GraalVM, Maven, Gradle di-download otomatis
- ✅ **H2 friendly** — auto-exclude konfigurasi yang bikin warning di native-image

## 📁 Contoh Project

Lihat [example/](./example) untuk project Spring Boot lengkap yang siap deploy.

## ⚠️ Limitations

| Item | Detail |
|---|---|
| Cold start | ~100-500ms (native image) |
| Package size | ~50-70MB (masih di bawah limit Vercel 250MB) |
| Timeout | Atur via `maxDuration` di `vercel.json` (maks 900s) |
| State | Setiap Lambda instance bersifat ephemeral |

## 🛠 Development

```bash
git clone https://github.com/awand795/vercel-spring.git
cd vercel-spring
npm install
npm run build
```

## 🤝 Contributing

Lihat [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan kontribusi (tersedia dalam Bahasa Indonesia dan English).

## 📄 License

MIT

---

<div align="center">Made with ❤️ for the Spring Boot & Vercel community</div>
