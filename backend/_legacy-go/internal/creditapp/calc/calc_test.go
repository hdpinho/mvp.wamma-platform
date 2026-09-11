package calc

import (
	"errors"
	"math/big"
	"testing"
)

// ── Dinero ─────────────────────────────────────────────────────────

func TestDineroConstructores(t *testing.T) {
	if got := De(1, 50, USD).Centimos(); got != 150 {
		t.Fatalf("De(1,50) = %d céntimos; se esperaba 150", got)
	}
	if got := DeCentimos(150, USD).Centimos(); got != 150 {
		t.Fatalf("DeCentimos(150) = %d; se esperaba 150", got)
	}
	if !Cero(USD).EsCero() {
		t.Fatal("Cero debe ser cero")
	}
	if Cero(USD).Moneda() != USD {
		t.Fatal("Cero debe conservar la moneda")
	}
	if !DeCentimos(-1, USD).EsNegativo() {
		t.Fatal("-1 céntimo debe ser negativo")
	}
	if DeCentimos(0, USD).EsNegativo() {
		t.Fatal("cero no es negativo")
	}
}

func TestDineroString(t *testing.T) {
	casos := []struct {
		valor  Dinero
		quiere string
	}{
		{De(1, 50, USD), "1.50 USD"},
		{De(0, 5, USD), "0.05 USD"},
		{DeCentimos(0, VES), "0.00 VES"},
		{DeCentimos(-150, USD), "-1.50 USD"},
		{DeCentimos(123456, USD), "1234.56 USD"},
	}
	for _, c := range casos {
		if got := c.valor.String(); got != c.quiere {
			t.Fatalf("String() = %q; se esperaba %q", got, c.quiere)
		}
	}
}

func TestDineroSumarRestar(t *testing.T) {
	a, b := De(10, 0, USD), De(2, 50, USD)

	suma, err := a.Sumar(b)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if suma.Centimos() != 1250 {
		t.Fatalf("suma = %d; se esperaba 1250", suma.Centimos())
	}

	resta, err := a.Restar(b)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if resta.Centimos() != 750 {
		t.Fatalf("resta = %d; se esperaba 750", resta.Centimos())
	}
}

// TestDineroMonedaDistinta comprueba que el tipo impide sumar peras con
// manzanas: mezclar divisas sin convertir es el error silencioso clásico de un
// sistema multi-moneda.
func TestDineroMonedaDistinta(t *testing.T) {
	usd, ves := De(1, 0, USD), De(1, 0, VES)

	if _, err := usd.Sumar(ves); !errors.Is(err, ErrMonedaDistinta) {
		t.Fatalf("Sumar con monedas distintas debe fallar; got %v", err)
	}
	if _, err := usd.Restar(ves); !errors.Is(err, ErrMonedaDistinta) {
		t.Fatalf("Restar con monedas distintas debe fallar; got %v", err)
	}
	if _, err := SumarTodos(USD, usd, ves); !errors.Is(err, ErrMonedaDistinta) {
		t.Fatalf("SumarTodos con monedas distintas debe fallar; got %v", err)
	}
}

func TestSumarTodos(t *testing.T) {
	vacio, err := SumarTodos(USD)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if !vacio.EsCero() || vacio.Moneda() != USD {
		t.Fatal("la suma vacía debe ser cero en la moneda indicada")
	}

	total, err := SumarTodos(USD, De(1, 0, USD), De(2, 50, USD), De(0, 25, USD))
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if total.Centimos() != 375 {
		t.Fatalf("total = %d; se esperaba 375", total.Centimos())
	}
}

// TestDesdeRat_Redondeo fija la regla de redondeo a la mitad hacia arriba en
// valor absoluto, incluidos los negativos.
func TestDesdeRat_Redondeo(t *testing.T) {
	casos := []struct {
		nombre string
		num    int64
		den    int64
		quiere int64
	}{
		{"exacto", 150, 100, 150},
		{"por debajo de la mitad", 1004, 1000, 100},
		{"justo la mitad", 1005, 1000, 101},
		{"por encima de la mitad", 1006, 1000, 101},
		{"negativo por debajo", -1004, 1000, -100},
		{"negativo justo la mitad", -1005, 1000, -101},
		{"negativo por encima", -1006, 1000, -101},
		{"cero", 0, 1000, 0},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			r := new(big.Rat).SetFrac(big.NewInt(c.num), big.NewInt(c.den))
			if got := desdeRat(r, USD).Centimos(); got != c.quiere {
				t.Fatalf("desdeRat(%d/%d) = %d céntimos; se esperaba %d",
					c.num, c.den, got, c.quiere)
			}
		})
	}
}

// ── Tasa ───────────────────────────────────────────────────────────

func TestTasa(t *testing.T) {
	t.Run("cuatro por ciento", func(t *testing.T) {
		tasa, err := TasaDePorcentaje(4, 1)
		if err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
		if tasa.Rat().Cmp(big.NewRat(4, 100)) != 0 {
			t.Fatalf("la tasa debe ser 4/100; got %v", tasa.Rat())
		}
		if tasa.EsCero() {
			t.Fatal("4 %% no es cero")
		}
	})

	t.Run("tasa cero", func(t *testing.T) {
		tasa, err := TasaDePorcentaje(0, 1)
		if err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
		if !tasa.EsCero() {
			t.Fatal("0 %% debe ser cero")
		}
	})

	t.Run("tasa sin construir", func(t *testing.T) {
		var tasa Tasa
		if !tasa.EsCero() {
			t.Fatal("la tasa nula debe considerarse cero")
		}
		if tasa.Rat().Sign() != 0 {
			t.Fatal("la tasa nula debe devolver un racional cero")
		}
	})

	t.Run("denominador cero", func(t *testing.T) {
		if _, err := TasaDePorcentaje(4, 0); !errors.Is(err, ErrTasaInvalida) {
			t.Fatalf("se esperaba ErrTasaInvalida; got %v", err)
		}
	})

	t.Run("tasa negativa", func(t *testing.T) {
		if _, err := TasaDePorcentaje(-4, 1); !errors.Is(err, ErrTasaInvalida) {
			t.Fatalf("se esperaba ErrTasaInvalida; got %v", err)
		}
	})
}

// ── Cuota ──────────────────────────────────────────────────────────

// TestCuota_ParidadConLaMaqueta comprueba que el motor en Go reproduce el
// resultado que usa la maqueta React con los mismos parámetros: 8.000 USD a 12
// meses al 4 % mensual.
//
// El valor correcto es 852,42. La maqueta traía 853,02 escrito a mano, que no
// se corresponde con la fórmula declarada en su propio comentario; se corrigió
// junto con su tabla de amortización. Si este caso deja de cuadrar, web y
// backend han divergido.
func TestCuota_ParidadConLaMaqueta(t *testing.T) {
	tasa, err := TasaDePorcentaje(4, 1)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}

	cuota, err := Cuota(De(8000, 0, USD), 12, tasa)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if cuota.Centimos() != 85242 {
		t.Fatalf("cuota = %s; se esperaba 852.42 USD", cuota)
	}
}

func TestCuota_TasaCero(t *testing.T) {
	cuota, err := Cuota(De(1200, 0, USD), 12, Tasa{})
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if cuota.Centimos() != 10000 {
		t.Fatalf("con tasa cero la cuota debe ser el reparto; got %s", cuota)
	}
}

func TestCuota_Invalidos(t *testing.T) {
	tasa, _ := TasaDePorcentaje(4, 1)

	casos := []struct {
		nombre string
		monto  Dinero
		plazo  int
		quiere error
	}{
		{"monto negativo", DeCentimos(-1, USD), 12, ErrMontoNegativo},
		{"plazo cero", De(1000, 0, USD), 0, ErrPlazoInvalido},
		{"plazo negativo", De(1000, 0, USD), -1, ErrPlazoInvalido},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if _, err := Cuota(c.monto, c.plazo, tasa); !errors.Is(err, c.quiere) {
				t.Fatalf("error = %v; se esperaba %v", err, c.quiere)
			}
		})
	}
}

func TestCuota_MontoCero(t *testing.T) {
	tasa, _ := TasaDePorcentaje(4, 1)
	cuota, err := Cuota(Cero(USD), 12, tasa)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if !cuota.EsCero() {
		t.Fatalf("financiar cero debe dar cuota cero; got %s", cuota)
	}
}

func TestCuota_UnSoloPeriodo(t *testing.T) {
	tasa, _ := TasaDePorcentaje(4, 1)
	cuota, err := Cuota(De(1000, 0, USD), 1, tasa)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	// A un solo período la cuota es el capital más su interés.
	if cuota.Centimos() != 104000 {
		t.Fatalf("cuota = %s; se esperaba 1040.00 USD", cuota)
	}
}

// ── Amortización ───────────────────────────────────────────────────

// TestAmortizacion_SaldoFinalCero es la propiedad que más importa: la tabla
// debe liquidar el crédito exactamente, sin céntimos vivos.
func TestAmortizacion_SaldoFinalCero(t *testing.T) {
	tasa, _ := TasaDePorcentaje(4, 1)

	// Se barre un rango de montos y plazos para provocar residuos de redondeo.
	for _, monto := range []int64{100000, 800000, 123457, 999999, 1} {
		for _, plazo := range []int{1, 6, 12, 18, 24, 36} {
			filas, err := Amortizacion(DeCentimos(monto, USD), plazo, tasa)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if len(filas) != plazo {
				t.Fatalf("se esperaban %d filas y hay %d", plazo, len(filas))
			}
			if final := filas[len(filas)-1].Saldo; !final.EsCero() {
				t.Fatalf("monto=%d plazo=%d: saldo final %s, debería ser cero",
					monto, plazo, final)
			}
		}
	}
}

// TestAmortizacion_CapitalSumaElMonto comprueba que la suma de las cuotas de
// capital reconstruye exactamente el monto financiado.
func TestAmortizacion_CapitalSumaElMonto(t *testing.T) {
	tasa, _ := TasaDePorcentaje(4, 1)
	monto := De(8000, 0, USD)

	filas, err := Amortizacion(monto, 12, tasa)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}

	var suma int64
	for _, f := range filas {
		suma += f.Capital.Centimos()
	}
	if suma != monto.Centimos() {
		t.Fatalf("la suma de capital es %d y el monto %d", suma, monto.Centimos())
	}
}

func TestAmortizacion_NumeracionYTasaCero(t *testing.T) {
	filas, err := Amortizacion(De(1200, 0, USD), 12, Tasa{})
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	for i, f := range filas {
		if f.Numero != i+1 {
			t.Fatalf("fila %d numerada como %d", i, f.Numero)
		}
		if !f.Interes.EsCero() {
			t.Fatalf("con tasa cero no debe haber interés; fila %d tiene %s", f.Numero, f.Interes)
		}
	}
}

func TestAmortizacion_Invalida(t *testing.T) {
	tasa, _ := TasaDePorcentaje(4, 1)
	if _, err := Amortizacion(De(1000, 0, USD), 0, tasa); !errors.Is(err, ErrPlazoInvalido) {
		t.Fatalf("se esperaba ErrPlazoInvalido; got %v", err)
	}
}

func TestPotenciaRat(t *testing.T) {
	base := big.NewRat(3, 2)

	casos := []struct {
		exp    int64
		quiere *big.Rat
	}{
		{0, big.NewRat(1, 1)},
		{1, big.NewRat(3, 2)},
		{2, big.NewRat(9, 4)},
		{3, big.NewRat(27, 8)},
		{4, big.NewRat(81, 16)},
	}

	for _, c := range casos {
		if got := potenciaRat(base, c.exp); got.Cmp(c.quiere) != 0 {
			t.Fatalf("potenciaRat(3/2, %d) = %v; se esperaba %v", c.exp, got, c.quiere)
		}
	}
}

// ── Balance ────────────────────────────────────────────────────────

func TestCalcularBalance(t *testing.T) {
	bal, err := CalcularBalance(USD,
		Ingresos{SueldoMensual: De(800, 0, USD), OtrosIngresos: De(200, 0, USD)},
		Egresos{
			AlquilerHipoteca:      De(300, 0, USD),
			AlimentacionServicios: De(250, 0, USD),
			PagosDeudas:           De(150, 0, USD),
		})
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}

	if bal.TotalIngresos.Centimos() != 100000 {
		t.Fatalf("total ingresos = %s; se esperaba 1000.00", bal.TotalIngresos)
	}
	if bal.TotalEgresos.Centimos() != 70000 {
		t.Fatalf("total egresos = %s; se esperaba 700.00", bal.TotalEgresos)
	}
	if bal.CapacidadPago.Centimos() != 30000 {
		t.Fatalf("capacidad = %s; se esperaba 300.00", bal.CapacidadPago)
	}
}

// TestCalcularBalance_EgresosNoRestan comprueba la regla vigente: la capacidad
// es el 30 % del ingreso aunque los egresos lo superen. Antes, esta misma
// entrada daba una capacidad negativa.
func TestCalcularBalance_EgresosNoRestan(t *testing.T) {
	bal, err := CalcularBalance(USD,
		Ingresos{SueldoMensual: De(300, 0, USD), OtrosIngresos: Cero(USD)},
		Egresos{
			AlquilerHipoteca:      De(400, 0, USD),
			AlimentacionServicios: De(100, 0, USD),
			PagosDeudas:           Cero(USD),
		})
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if bal.CapacidadPago.Centimos() != 9000 {
		t.Fatalf("capacidad = %s; se esperaba 90.00: el 30 %% de 300, sin restar egresos", bal.CapacidadPago)
	}
}

func TestCalcularBalance_MonedaDistinta(t *testing.T) {
	t.Run("en ingresos", func(t *testing.T) {
		_, err := CalcularBalance(USD,
			Ingresos{SueldoMensual: De(1, 0, VES), OtrosIngresos: Cero(USD)},
			Egresos{AlquilerHipoteca: Cero(USD), AlimentacionServicios: Cero(USD), PagosDeudas: Cero(USD)})
		if !errors.Is(err, ErrMonedaDistinta) {
			t.Fatalf("se esperaba ErrMonedaDistinta; got %v", err)
		}
	})

	t.Run("en egresos", func(t *testing.T) {
		_, err := CalcularBalance(USD,
			Ingresos{SueldoMensual: Cero(USD), OtrosIngresos: Cero(USD)},
			Egresos{AlquilerHipoteca: De(1, 0, VES), AlimentacionServicios: Cero(USD), PagosDeudas: Cero(USD)})
		if !errors.Is(err, ErrMonedaDistinta) {
			t.Fatalf("se esperaba ErrMonedaDistinta; got %v", err)
		}
	})

	t.Run("todo en la misma divisa", func(t *testing.T) {
		// Con todo en VES, el cálculo no debe fallar.
		_, err := CalcularBalance(VES,
			Ingresos{SueldoMensual: Cero(VES), OtrosIngresos: Cero(VES)},
			Egresos{AlquilerHipoteca: Cero(VES), AlimentacionServicios: Cero(VES), PagosDeudas: Cero(VES)})
		if err != nil {
			t.Fatalf("con todo en VES no debe fallar; got %v", err)
		}
	})
}

func TestRatioCuotaIngreso(t *testing.T) {
	t.Run("mitad del ingreso", func(t *testing.T) {
		ratio, err := RatioCuotaIngreso(De(500, 0, USD), De(1000, 0, USD))
		if err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
		if ratio.Cmp(big.NewRat(1, 2)) != 0 {
			t.Fatalf("ratio = %v; se esperaba 1/2", ratio)
		}
	})

	t.Run("sin ingresos", func(t *testing.T) {
		if _, err := RatioCuotaIngreso(De(500, 0, USD), Cero(USD)); !errors.Is(err, ErrSinIngresos) {
			t.Fatalf("se esperaba ErrSinIngresos; got %v", err)
		}
	})

	t.Run("monedas distintas", func(t *testing.T) {
		if _, err := RatioCuotaIngreso(De(500, 0, USD), De(1000, 0, VES)); !errors.Is(err, ErrMonedaDistinta) {
			t.Fatalf("se esperaba ErrMonedaDistinta; got %v", err)
		}
	})
}

func TestCuotaExcedeCapacidad(t *testing.T) {
	t.Run("la excede", func(t *testing.T) {
		excede, err := CuotaExcedeCapacidad(De(400, 0, USD), De(300, 0, USD))
		if err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
		if !excede {
			t.Fatal("400 debe exceder a 300")
		}
	})

	t.Run("justo igual no la excede", func(t *testing.T) {
		excede, err := CuotaExcedeCapacidad(De(300, 0, USD), De(300, 0, USD))
		if err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
		if excede {
			t.Fatal("una cuota igual a la capacidad no la excede")
		}
	})

	t.Run("monedas distintas", func(t *testing.T) {
		if _, err := CuotaExcedeCapacidad(De(1, 0, USD), De(1, 0, VES)); !errors.Is(err, ErrMonedaDistinta) {
			t.Fatalf("se esperaba ErrMonedaDistinta; got %v", err)
		}
	})
}
