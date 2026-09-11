package calc

import (
	"errors"
	"math/big"
)

// Ingresos son las entradas mensuales declaradas por el solicitante.
type Ingresos struct {
	SueldoMensual Dinero
	OtrosIngresos Dinero
}

// Egresos son las salidas mensuales declaradas por el solicitante.
type Egresos struct {
	AlquilerHipoteca      Dinero
	AlimentacionServicios Dinero
	PagosDeudas           Dinero
}

// Balance es el resultado del cálculo mensual.
//
// TotalIngresos, TotalEgresos y CapacidadPago son campos calculados: en la
// interfaz se muestran de solo lectura y en la API no se aceptan como entrada.
// En el formato en papel eran casillas a rellenar a mano, que es de donde
// venían las inconsistencias.
type Balance struct {
	TotalIngresos Dinero
	TotalEgresos  Dinero
	CapacidadPago Dinero
}

// ErrPorcentajeInvalido indica un porcentaje de capacidad fuera de [0, 1].
var ErrPorcentajeInvalido = errors.New("el porcentaje de capacidad debe estar entre 0 y 1")

// PorcentajeCapacidadVigente es la proporción del ingreso mensual total que se
// considera capacidad de pago: 30 %, por decisión del Product Owner (septiembre
// 2026). Antes la capacidad era ingresos − egresos.
//
// Devuelve un racional nuevo en cada llamada para que ningún llamador pueda
// alterar el valor compartido. En producción el porcentaje se lee de
// parametros_financieros y se pasa a CalcularBalanceCon (plan §7).
func PorcentajeCapacidadVigente() *big.Rat { return big.NewRat(3, 10) }

// CalcularBalance calcula el balance con el porcentaje de capacidad vigente.
func CalcularBalance(m Moneda, ing Ingresos, egr Egresos) (Balance, error) {
	return CalcularBalanceCon(m, ing, egr, PorcentajeCapacidadVigente())
}

// CalcularBalanceCon suma ingresos y egresos y obtiene la capacidad de pago
// con el porcentaje indicado.
//
//	total_ingresos = sueldo + otros_ingresos
//	total_egresos  = alquiler + alimentación y servicios + deudas
//	capacidad_pago = total_ingresos × porcentaje_capacidad
//
// Los egresos se siguen totalizando porque el analista los necesita, pero no
// reducen la capacidad. La capacidad se redondea a céntimos una sola vez, al
// final, igual que el resto del paquete.
func CalcularBalanceCon(m Moneda, ing Ingresos, egr Egresos, porcentajeCapacidad *big.Rat) (Balance, error) {
	if porcentajeCapacidad == nil || porcentajeCapacidad.Sign() < 0 || porcentajeCapacidad.Cmp(big.NewRat(1, 1)) > 0 {
		return Balance{}, ErrPorcentajeInvalido
	}

	totalIngresos, err := SumarTodos(m, ing.SueldoMensual, ing.OtrosIngresos)
	if err != nil {
		return Balance{}, err
	}

	totalEgresos, err := SumarTodos(m, egr.AlquilerHipoteca, egr.AlimentacionServicios, egr.PagosDeudas)
	if err != nil {
		return Balance{}, err
	}

	capacidad := desdeRat(new(big.Rat).Mul(totalIngresos.Rat(), porcentajeCapacidad), m)

	return Balance{
		TotalIngresos: totalIngresos,
		TotalEgresos:  totalEgresos,
		CapacidadPago: capacidad,
	}, nil
}

// RatioCuotaIngreso es la proporción de la cuota sobre los ingresos totales.
//
// Es insumo del analista y NO se expone al solicitante (spec §8.2): mostrarlo
// equivaldría a darle una señal de probabilidad de aprobación, que es
// justamente lo que la pantalla pública no debe hacer.
//
// Se devuelve como racional exacto en lugar de un porcentaje redondeado para
// que el umbral lo aplique quien decida la política, sin arrastrar el redondeo.
func RatioCuotaIngreso(cuota Dinero, totalIngresos Dinero) (*big.Rat, error) {
	if cuota.Moneda() != totalIngresos.Moneda() {
		return nil, ErrMonedaDistinta
	}
	if totalIngresos.EsCero() {
		return nil, ErrSinIngresos
	}
	return new(big.Rat).Quo(cuota.Rat(), totalIngresos.Rat()), nil
}

// CuotaExcedeCapacidad indica si la cuota estimada supera la capacidad de pago.
//
// Alimenta una advertencia informativa: el asistente la muestra y permite
// continuar de todos modos (RF-SC.17).
func CuotaExcedeCapacidad(cuota Dinero, capacidad Dinero) (bool, error) {
	if cuota.Moneda() != capacidad.Moneda() {
		return false, ErrMonedaDistinta
	}
	return cuota.Centimos() > capacidad.Centimos(), nil
}
