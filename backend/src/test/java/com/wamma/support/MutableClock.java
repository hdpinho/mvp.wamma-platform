package com.wamma.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Reloj que las pruebas adelantan a voluntad: bloqueos, vencimientos y pasos TOTP sin esperar.
 * {@link #withZone} devuelve una vista con otra zona que comparte el mismo instante, para
 * que "hoy en Venezuela" se calcule igual que en producción.
 */
public class MutableClock extends Clock {

    private final AtomicReference<Instant> now;
    private final ZoneId zone;

    public MutableClock(Instant start) {
        this(new AtomicReference<>(start), ZoneOffset.UTC);
    }

    private MutableClock(AtomicReference<Instant> now, ZoneId zone) {
        this.now = now;
        this.zone = zone;
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return new MutableClock(now, zone);
    }

    @Override
    public Instant instant() {
        return now.get();
    }

    public void advance(Duration duration) {
        now.updateAndGet(current -> current.plus(duration));
    }
}
