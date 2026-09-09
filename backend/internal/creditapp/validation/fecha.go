package validation

import (
	"fmt"
	"time"
)

// MayoriaDeEdad en Venezuela.
const MayoriaDeEdad = 18

// ReglasEdad son los límites de edad aplicables a un solicitante.
//
// EdadMaximaAlVencimiento queda como puntero y sin valor por defecto a
// propósito: es una decisión de política de riesgo pendiente (P10). Un cero
// significaría "ninguna edad admitida" y un número inventado dejaría pasar o
// rechazaría solicitudes por un criterio que nadie aprobó. Mientras sea nil,
// la regla sencillamente no se aplica y así se declara.
type ReglasEdad struct {
	EdadMaximaAlVencimiento *int
}

// Edad calcula los años cumplidos en la fecha de referencia.
//
// La comparación es por mes y día, no por día del año: entre un año bisiesto y
// uno que no lo es, el mismo día del calendario cae en ordinales distintos y el
// cálculo se equivocaría en un año justo en el límite de la mayoría de edad.
func Edad(nacimiento, referencia time.Time) int {
	años := referencia.Year() - nacimiento.Year()

	mesRef, diaRef := referencia.Month(), referencia.Day()
	mesNac, diaNac := nacimiento.Month(), nacimiento.Day()
	if mesRef < mesNac || (mesRef == mesNac && diaRef < diaNac) {
		// Aún no ha llegado el cumpleaños en el año de referencia.
		años--
	}
	return años
}

// FechaNacimiento valida que el solicitante sea mayor de edad y, si la regla
// está definida, que no exceda la edad máxima al vencimiento del crédito.
//
// plazoMeses es el plazo solicitado; sirve para proyectar la edad que tendrá el
// solicitante cuando termine de pagar.
func FechaNacimiento(nacimiento time.Time, hoy time.Time, plazoMeses int, reglas ReglasEdad) error {
	if nacimiento.IsZero() {
		return ErrVacio
	}
	if nacimiento.After(hoy) {
		return fmt.Errorf("%w: la fecha de nacimiento está en el futuro", ErrFormato)
	}

	if Edad(nacimiento, hoy) < MayoriaDeEdad {
		return ErrMenorDeEdad
	}

	if reglas.EdadMaximaAlVencimiento == nil {
		// Regla no definida por el negocio: no se inventa un límite.
		return nil
	}
	if plazoMeses < 0 {
		return fmt.Errorf("%w: el plazo no puede ser negativo", ErrFueraDeRango)
	}

	vencimiento := hoy.AddDate(0, plazoMeses, 0)
	if edad := Edad(nacimiento, vencimiento); edad > *reglas.EdadMaximaAlVencimiento {
		return fmt.Errorf("%w: al vencimiento tendría %d años y el máximo es %d",
			ErrFueraDeRango, edad, *reglas.EdadMaximaAlVencimiento)
	}
	return nil
}
