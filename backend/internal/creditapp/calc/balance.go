package calc

import "math/big"

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

// CalcularBalance suma ingresos y egresos y obtiene la capacidad de pago.
//
//	total_ingresos = sueldo + otros_ingresos
//	total_egresos  = alquiler + alimentación y servicios + deudas
//	capacidad_pago = total_ingresos − total_egresos
//
// Una capacidad negativa es un resultado válido: se calcula, se guarda y la
// decide el analista. La pantalla pública nunca rechaza por este motivo.
func CalcularBalance(m Moneda, ing Ingresos, egr Egresos) (Balance, error) {
	totalIngresos, err := SumarTodos(m, ing.SueldoMensual, ing.OtrosIngresos)
	if err != nil {
		return Balance{}, err
	}

	totalEgresos, err := SumarTodos(m, egr.AlquilerHipoteca, egr.AlimentacionServicios, egr.PagosDeudas)
	if err != nil {
		return Balance{}, err
	}

	// Ambos totales se construyeron con la divisa m, así que la resta no puede
	// fallar por discrepancia de moneda.
	return Balance{
		TotalIngresos: totalIngresos,
		TotalEgresos:  totalEgresos,
		CapacidadPago: totalIngresos.restarIgualMoneda(totalEgresos),
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
