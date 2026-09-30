package com.wamma.crm;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Límite de captación pública de citas en memoria (plan 010 C4):
 * - hasta 5 citas por IP cada 24 horas;
 * - hasta 2 citas por teléfono cada 24 horas.
 */
@Component
public class CaptureRateLimiter {

    private static final int MAX_PER_IP = 5;
    private static final int MAX_PER_PHONE = 2;
    private static final Duration WINDOW = Duration.ofHours(24);

    private final Map<String, SlidingWindow> ipWindows = new ConcurrentHashMap<>();
    private final Map<String, SlidingWindow> phoneWindows = new ConcurrentHashMap<>();

    public boolean tryAcquire(String ip, String normalizedPhone, Instant now) {
        cleanOldEntries(now);

        SlidingWindow ipWindow = ipWindows.computeIfAbsent(ip, k -> new SlidingWindow());
        SlidingWindow phoneWindow = phoneWindows.computeIfAbsent(normalizedPhone, k -> new SlidingWindow());

        synchronized (this) {
            if (ipWindow.count(now) >= MAX_PER_IP || phoneWindow.count(now) >= MAX_PER_PHONE) {
                return false;
            }
            ipWindow.record(now);
            phoneWindow.record(now);
            return true;
        }
    }

    private void cleanOldEntries(Instant now) {
        ipWindows.entrySet().removeIf(e -> e.getValue().isExpired(now));
        phoneWindows.entrySet().removeIf(e -> e.getValue().isExpired(now));
    }

    public void reset() {
        ipWindows.clear();
        phoneWindows.clear();
    }

    private static class SlidingWindow {
        private final java.util.List<Instant> timestamps = new java.util.concurrent.CopyOnWriteArrayList<>();

        void record(Instant now) {
            timestamps.add(now);
        }

        int count(Instant now) {
            Instant threshold = now.minus(WINDOW);
            timestamps.removeIf(t -> t.isBefore(threshold));
            return timestamps.size();
        }

        boolean isExpired(Instant now) {
            Instant threshold = now.minus(WINDOW);
            timestamps.removeIf(t -> t.isBefore(threshold));
            return timestamps.isEmpty();
        }
    }
}
