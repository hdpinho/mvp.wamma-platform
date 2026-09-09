// Package calc contiene el motor de cálculo financiero de la solicitud:
// importes, totales del balance y cuota por sistema francés.
//
// Reglas que gobiernan este paquete:
//
//   - Prohibido el punto flotante binario (Constitución, Principio V). Los
//     importes son enteros de unidad menor y el cálculo intermedio usa
//     aritmética racional exacta con math/big.
//   - Sin dependencias externas: math/big basta y evita atar el núcleo
//     financiero a una librería de terceros.
//   - Sin I/O. Todo es puro y por tanto verificable en su totalidad.
package calc

import (
	"errors"
	"fmt"
	"math/big"
)

// Moneda identifica la divisa de un importe.
//
// La unidad de cuenta del proyecto es USD con equivalencia a tasa BCV
// (Constitución, Principio V). El tipo admite otras divisas para que un cambio
// de política no obligue a rehacer el motor.
type Moneda string

const (
	// USD es la unidad de cuenta del proyecto.
	USD Moneda = "USD"
	// VES es el bolívar, en el que se expresa la equivalencia a tasa BCV.
	VES Moneda = "VES"
)

// Decimales por unidad de cuenta. Los importes se guardan en unidades menores
// (céntimos), de modo que 1,00 USD son 100.
const Decimales = 2

var factorUnidad = big.NewInt(100)

var (
	// ErrMonedaDistinta indica que se intentó operar con importes de divisas
	// diferentes sin convertir.
	ErrMonedaDistinta = errors.New("no se pueden operar importes de monedas distintas")

	// ErrMontoNegativo indica que se recibió un importe negativo donde no se
	// admite.
	ErrMontoNegativo = errors.New("el monto no puede ser negativo")

	// ErrPlazoInvalido indica un plazo fuera de rango.
	ErrPlazoInvalido = errors.New("el plazo debe ser de al menos un período")

	// ErrTasaInvalida indica una tasa negativa.
	ErrTasaInvalida = errors.New("la tasa no puede ser negativa")

	// ErrSinIngresos indica que no se puede calcular un ratio sobre ingresos
	// nulos.
	ErrSinIngresos = errors.New("no se puede calcular el ratio sin ingresos")
)

// Dinero es un importe exacto en una divisa.
//
// El valor se guarda en unidades menores para que sumas y restas sean exactas
// y no dependan de la representación binaria de un decimal.
type Dinero struct {
	centimos int64
	moneda   Moneda
}

// De construye un importe a partir de unidades y céntimos.
func De(unidades int64, centimos int64, m Moneda) Dinero {
	return Dinero{centimos: unidades*100 + centimos, moneda: m}
}

// DeCentimos construye un importe a partir de su valor en unidades menores.
func DeCentimos(c int64, m Moneda) Dinero {
	return Dinero{centimos: c, moneda: m}
}

// Cero devuelve el importe nulo de una divisa.
func Cero(m Moneda) Dinero { return Dinero{moneda: m} }

// Centimos devuelve el importe en unidades menores.
func (d Dinero) Centimos() int64 { return d.centimos }

// Moneda devuelve la divisa del importe.
func (d Dinero) Moneda() Moneda { return d.moneda }

// EsCero indica si el importe es nulo.
func (d Dinero) EsCero() bool { return d.centimos == 0 }

// EsNegativo indica si el importe es menor que cero.
//
// Un balance con capacidad de pago negativa es un dato legítimo que el analista
// debe ver, así que el tipo admite negativos en lugar de impedirlos.
func (d Dinero) EsNegativo() bool { return d.centimos < 0 }

// String representa el importe con dos decimales y su divisa.
func (d Dinero) String() string {
	signo := ""
	c := d.centimos
	if c < 0 {
		signo = "-"
		c = -c
	}
	return fmt.Sprintf("%s%d.%02d %s", signo, c/100, c%100, d.moneda)
}

// Sumar devuelve la suma de dos importes de la misma divisa.
func (d Dinero) Sumar(o Dinero) (Dinero, error) {
	if d.moneda != o.moneda {
		return Dinero{}, fmt.Errorf("%w: %s y %s", ErrMonedaDistinta, d.moneda, o.moneda)
	}
	return Dinero{centimos: d.centimos + o.centimos, moneda: d.moneda}, nil
}

// Restar devuelve la diferencia entre dos importes de la misma divisa.
func (d Dinero) Restar(o Dinero) (Dinero, error) {
	if d.moneda != o.moneda {
		return Dinero{}, fmt.Errorf("%w: %s y %s", ErrMonedaDistinta, d.moneda, o.moneda)
	}
	return Dinero{centimos: d.centimos - o.centimos, moneda: d.moneda}, nil
}

// sumarIgualMoneda y restarIgualMoneda operan sin comprobar la divisa.
//
// Se usan solo donde el invariante ya está garantizado porque todos los
// importes proceden de la misma divisa de origen. Comprobar allí dejaría ramas
// de error que ninguna entrada puede alcanzar, es decir, código muerto.
func (d Dinero) sumarIgualMoneda(o Dinero) Dinero {
	return Dinero{centimos: d.centimos + o.centimos, moneda: d.moneda}
}

func (d Dinero) restarIgualMoneda(o Dinero) Dinero {
	return Dinero{centimos: d.centimos - o.centimos, moneda: d.moneda}
}

// Rat convierte el importe a racional exacto, en unidades enteras.
func (d Dinero) Rat() *big.Rat {
	return new(big.Rat).SetFrac(big.NewInt(d.centimos), factorUnidad)
}

// desdeRat convierte un racional en importe, redondeando a la unidad menor.
//
// Se redondea a la mitad hacia arriba en valor absoluto, que es la convención
// de facturación corriente y evita que el redondeo favorezca sistemáticamente a
// una de las partes.
func desdeRat(r *big.Rat, m Moneda) Dinero {
	escalado := new(big.Rat).Mul(r, new(big.Rat).SetInt(factorUnidad))

	num := escalado.Num()
	den := escalado.Denom()

	cociente, resto := new(big.Int).QuoRem(num, den, new(big.Int))

	// 2*|resto| >= |den| implica que la fracción llega o pasa de la mitad.
	dobleResto := new(big.Int).Abs(new(big.Int).Lsh(resto, 1))
	if dobleResto.Cmp(new(big.Int).Abs(den)) >= 0 {
		if escalado.Sign() < 0 {
			cociente.Sub(cociente, big.NewInt(1))
		} else {
			cociente.Add(cociente, big.NewInt(1))
		}
	}
	return Dinero{centimos: cociente.Int64(), moneda: m}
}

// SumarTodos suma una lista de importes de la misma divisa.
//
// Con la lista vacía devuelve cero en la divisa indicada, que es lo que
// corresponde a un balance sin conceptos cargados.
func SumarTodos(m Moneda, importes ...Dinero) (Dinero, error) {
	total := Cero(m)
	for _, i := range importes {
		var err error
		if total, err = total.Sumar(i); err != nil {
			return Dinero{}, err
		}
	}
	return total, nil
}
