# vercel-spring

Spring Boot runtime for [Vercel](https://vercel.com). Deploy Spring Boot applications as serverless functions using GraalVM Native Image.

## How it works

This is a **Vercel Community Runtime** that:

1. **Build phase**: Detects your Spring Boot project, installs GraalVM, builds a native image using `mvn -Pnative native:compile` or `gradle nativeCompile`
2. **Runtime phase**: A Node.js launcher receives HTTP requests, spawns the native binary as a subprocess, and proxies requests to it with keep-alive optimization

## Prerequisites

- Spring Boot 3.x project with GraalVM native build support
- **Java version**: 17, 21, 22, 23, 24, or 25 (auto-detected from pom.xml/build.gradle)
- Vercel account and CLI (`npm i -g vercel`)

## Usage

### 1. Project Structure

```
my-spring-app/
├── api/
│   └── index.java          # Marker entrypoint
├── src/
│   └── main/
│       └── java/
│           └── ...
├── pom.xml                  # Maven build file
├── vercel.json              # Vercel config
└── .vercelignore
```

### 2. Configure pom.xml

Add the native profile to your `pom.xml`:

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

### 3. Configure vercel.json

```json
{
  "functions": {
    "api/index.java": {
      "runtime": "vercel-spring@0.1.3",
      "memory": 3008,
      "maxDuration": 30
    }
  },
  "routes": [
    { "src": "/(.*)", "dest": "/api/index.java" }
  ]
}
```

### 4. Create marker file

`api/index.java`:
```java
// Marker file for Vercel Spring Boot runtime
```

### 5. Deploy

```bash
vercel --prod
```

## Example

See the [example/](./example) directory for a complete working project.

## Architecture

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

## Development

```bash
git clone https://github.com/your-org/vercel-spring
cd vercel-spring
npm install
npm run build
```

## Limitations

- Cold start: ~100-500ms with native image (vs 5-15s with JVM)
- Package size: native binary ~50-70MB (fits within Vercel's 250MB limit)
- Request timeout: configure via `maxDuration` in vercel.json
- Stateless: each Lambda instance is ephemeral

## License

MIT
