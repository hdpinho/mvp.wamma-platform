package calc

import (
	"errors"
	"math/big"
	"testing"
)

// La capacidad de pago es el 30 % del ingreso mensual total (decisión del
// Product Owner, septiembre 2026). Los egresos se totalizan, pero no restan.

func sinEgresos(m Moneda) Egresos {
	return Egresos{AlquilerHipoteca: Cero(m), AlimentacionServicios: Cero(m), PagosDeudas: Cero(m)}
}

func TestPorcentajeCapacidadVigente(t *testing.T) {
	if got := PorcentajeCapacidadVigente(); got.Cmp(big.NewRat(3, 10)) != 0 {
		t.Fatalf("porcentaje vigente = %v; se esperaba 3/10", got)
	}
	// Cada llamada devuelve un valor nuevo: alterar uno no altera el siguiente.
	PorcentajeCapacidadVigente().SetInt64(1)
	if got := PorcentajeCapacidadVigente(); got.Cmp(big.NewRat(3, 10)) != 0 {
		t.Fatalf("el porcentaje vigente se alteró desde fuera: %v", got)
	}
}

func TestCalcularBalanceCon_OtroPorcentaje(t *testing.T) {
	bal, err := CalcularBalanceCon(USD,
		Ingresos{SueldoMensual: De(1000, 0, USD), OtrosIngresos: Cero(USD)},
		sinEgresos(USD),
		big.NewRat(1, 4))
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if bal.CapacidadPago.Centimos() != 25000 {
		t.Fatalf("capacidad = %s; se esperaba 250.00 (25 %% de 1000)", bal.CapacidadPago)
	}
}

// Los extremos del rango son válidos: 0 % y 100 %.
func TestCalcularBalanceCon_Limites(t *testing.T) {
	casos := []struct {
		nombre     string
		porcentaje *big.Rat
		quiere     int64
	}{
		{"cero por ciento", big.NewRat(0, 1), 0},
		{"cien por ciento", big.NewRat(1, 1), 50000},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			bal, err := CalcularBalanceCon(USD,
				Ingresos{SueldoMensual: De(500, 0, USD), OtrosIngresos: Cero(USD)},
				sinEgresos(USD),
				c.porcentaje)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if bal.CapacidadPago.Centimos() != c.quiere {
				t.Fatalf("capacidad = %s; se esperaban %d céntimos", bal.CapacidadPago, c.quiere)
			}
		})
	}
}

func TestCalcularBalanceCon_PorcentajeInvalido(t *testing.T) {
	casos := []struct {
		nombre     string
		porcentaje *big.Rat
	}{
		{"nulo", nil},
		{"negativo", big.NewRat(-1, 10)},
		{"mayor que uno", big.NewRat(11, 10)},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			_, err := CalcularBalanceCon(USD,
				Ingresos{SueldoMensual: De(500, 0, USD), OtrosIngresos: Cero(USD)},
				sinEgresos(USD),
				c.porcentaje)
			if !errors.Is(err, ErrPorcentajeInvalido) {
				t.Fatalf("se esperaba ErrPorcentajeInvalido; got %v", err)
			}
		})
	}
}

// El 30 % de un importe en céntimos puede dejar fracción de céntimo: se
// redondea una sola vez, al final. Los casos evitan el empate a medio céntimo
// para no depender de la regla de desempate.
func TestCalcularBalance_RedondeoDeCapacidad(t *testing.T) {
	casos := []struct {
		nombre  string
		ingreso Dinero
		quiere  int64
	}{
		{"hacia abajo: 1000.01 × 30 % = 300.003", De(1000, 1, USD), 30000},
		{"hacia arriba: 333.33 × 30 % = 99.999", De(333, 33, USD), 10000},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			bal, err := CalcularBalance(USD,
				Ingresos{SueldoMensual: c.ingreso, OtrosIngresos: Cero(USD)},
				sinEgresos(USD))
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if bal.CapacidadPago.Centimos() != c.quiere {
				t.Fatalf("capacidad = %s; se esperaban %d céntimos", bal.CapacidadPago, c.quiere)
			}
		})
	}
}
