package com.wamma.platform.money;

/**
 * Monedas de la plataforma. Los precios van en euros y su equivalencia en bolívares a la tasa
 * BCV del euro (Constitución v3.0.0, Principio V). El dólar queda para datos internos, como
 * la moneda en que se pagó la adquisición de un vehículo.
 */
public enum CurrencyCode {
    EUR,
    USD,
    VES
}
