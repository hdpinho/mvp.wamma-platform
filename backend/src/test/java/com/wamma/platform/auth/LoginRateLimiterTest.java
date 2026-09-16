package com.wamma.platform.auth;

import com.wamma.platform.config.SecurityProperties;
import com.wamma.platform.web.ApiException;
import com.wamma.support.MutableClock;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginRateLimiterTest {

    @Test
    void blocksAnIpAfterTheLimitUntilTheWindowPasses() {
        MutableClock clock = new MutableClock(Instant.parse("2026-09-15T12:00:00Z"));
        SecurityProperties properties = new SecurityProperties("", "", Duration.ofMinutes(30), Duration.ofHours(12),
                Duration.ofMinutes(5), 12, 5, Duration.ofMinutes(15), 3, Duration.ofMinutes(10));
        LoginRateLimiter limiter = new LoginRateLimiter(properties, clock);

        limiter.check("1.2.3.4");
        limiter.check("1.2.3.4");
        limiter.check("1.2.3.4");
        assertThatThrownBy(() -> limiter.check("1.2.3.4"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));

        limiter.check("5.6.7.8");

        clock.advance(Duration.ofMinutes(11));
        limiter.check("1.2.3.4");
    }
}
