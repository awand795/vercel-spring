package com.example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello from Spring Boot on Vercel!";
    }

    @GetMapping("/info")
    public InfoResponse info() {
        return new InfoResponse(
            "vercel-spring",
            "0.1.0",
            Runtime.getRuntime().availableProcessors(),
            Runtime.getRuntime().freeMemory()
        );
    }

    record InfoResponse(
        String runtime,
        String version,
        int availableProcessors,
        long freeMemory
    ) {}
}
