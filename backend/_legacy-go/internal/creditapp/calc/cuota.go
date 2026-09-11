package calc

import (
	"fmt"
	"math/big"
)

// Tasa es un tipo de interés por período, expresado como racional exacto.
//
// Se representa como racional y no como decimal para que (1+i)^n sea exacto:
// con decimal, cada potencia arrastra un truncamiento que se acumula a lo largo
// del plazo y descuadra la última cuota.
type Tasa struct{ valor *big.Rat }

// TasaDePorcentaje construye una tasa a partir de un porcentaje por período.
// Por ejemplo, 4 significa 4 % por período.
func TasaDePorcentaje(numerador, denominador int64) (Tasa, error) {
	if denominador == 0 {
		return Tasa{}, fmt.Errorf("%w: el denominador no puede ser cero", ErrTasaInvalida)
	}
	r := new(big.Rat).SetFrac(big.NewInt(numerador), big.NewInt(denominador*100))
	if r.Sign() < 0 {
		return Tasa{}, ErrTasaInvalida
	}
	return Tasa{valor: r}, nil
}

// EsCero indica si la tasa es nula, es decir, financiamiento sin interés.
func (t Tasa) EsCero() bool { return t.valor == nil || t.valor.Sign() == 0 }

// Rat devuelve la tasa como racional.
func (t Tasa) Rat() *big.Rat {
	if t.valor == nil {
		return new(big.Rat)
	}
	return new(big.Rat).Set(t.valor)
}

// Cuota calcula la cuota fija por el sistema francés.
//
//	cuota = M · i · (1+i)^n / ((1+i)^n − 1)
//
// Todo el cálculo se hace en aritmética racional exacta y solo se redondea al
// convertir el resultado a importe. Con tasa cero la fórmula se indetermina y
// la cuota es el simple reparto del capital entre los períodos.
func Cuota(montoFinanciado Dinero, plazoPeriodos int, tasa Tasa) (Dinero, error) {
	if montoFinanciado.EsNegativo() {
		return Dinero{}, ErrMontoNegativo
	}
	if plazoPeriodos < 1 {
		return Dinero{}, ErrPlazoInvalido
	}

	m := montoFinanciado.Rat()
	n := int64(plazoPeriodos)

	if tasa.EsCero() {
		reparto := new(big.Rat).Quo(m, new(big.Rat).SetInt64(n))
		return desdeRat(reparto, montoFinanciado.Moneda()), nil
	}

	i := tasa.Rat()
	unoMasI := new(big.Rat).Add(new(big.Rat).SetInt64(1), i)
	factor := potenciaRat(unoMasI, n) // (1+i)^n, exacto

	numerador := new(big.Rat).Mul(m, i)
	numerador.Mul(numerador, factor)

	denominador := new(big.Rat).Sub(factor, new(big.Rat).SetInt64(1))

	cuota := new(big.Rat).Quo(numerador, denominador)
	return desdeRat(cuota, montoFinanciado.Moneda()), nil
}

// FilaAmortizacion es un período de la tabla de amortización.
type FilaAmortizacion struct {
	Numero  int
	Capital Dinero
	Interes Dinero
	Cuota   Dinero
	Saldo   Dinero
}

// Amortizacion genera la tabla completa de un crédito.
//
// La última cuota absorbe el residuo de redondeo acumulado, de modo que el
// saldo final sea exactamente cero. Sin ese ajuste el crédito quedaría con unos
// céntimos vivos o saldados de más, que en un ledger de partida doble se
// convierte en un descuadre.
func Amortizacion(montoFinanciado Dinero, plazoPeriodos int, tasa Tasa) ([]FilaAmortizacion, error) {
	cuota, err := Cuota(montoFinanciado, plazoPeriodos, tasa)
	if err != nil {
		return nil, err
	}

	moneda := montoFinanciado.Moneda()
	i := tasa.Rat()
	saldo := montoFinanciado
	filas := make([]FilaAmortizacion, 0, plazoPeriodos)

	for periodo := 1; periodo <= plazoPeriodos; periodo++ {
		interes := desdeRat(new(big.Rat).Mul(saldo.Rat(), i), moneda)

		// Todos los importes de este bucle nacen de montoFinanciado, así que
		// comparten divisa por construcción.
		capital := cuota.restarIgualMoneda(interes)
		cuotaPeriodo := cuota

		if periodo == plazoPeriodos {
			// El último período liquida el saldo restante, sea cual sea el
			// residuo de redondeo acumulado.
			capital = saldo
			cuotaPeriodo = capital.sumarIgualMoneda(interes)
		}

		saldo = saldo.restarIgualMoneda(capital)

		filas = append(filas, FilaAmortizacion{
			Numero:  periodo,
			Capital: capital,
			Interes: interes,
			Cuota:   cuotaPeriodo,
			Saldo:   saldo,
		})
	}
	return filas, nil
}

// potenciaRat eleva un racional a una potencia entera no negativa mediante
// exponenciación binaria, sin pérdida de precisión.
func potenciaRat(base *big.Rat, exp int64) *big.Rat {
	resultado := new(big.Rat).SetInt64(1)
	b := new(big.Rat).Set(base)

	for exp > 0 {
		if exp&1 == 1 {
			resultado.Mul(resultado, b)
		}
		b.Mul(b, b)
		exp >>= 1
	}
	return resultado
}
