package validation

import (
	"fmt"
	"strings"
)

// LargoCuentaBancaria es el número de dígitos de una cuenta venezolana.
const LargoCuentaBancaria = 20

// CatalogoBancos resuelve si un código de banco de cuatro dígitos existe.
//
// Se declara como interfaz porque la lista oficial de bancos es un insumo
// pendiente (D13). Mientras no se siembre, cualquier implementación debe
// rechazar: es preferible un formulario que no avanza a un catálogo inventado
// que acepte cuentas de bancos inexistentes.
type CatalogoBancos interface {
	Existe(codigo string) (bool, error)
}

// VerificadorCuenta comprueba el dígito verificador de una cuenta.
//
// El algoritmo exacto no está documentado en el encargo ni en el repositorio,
// así que no se implementa aquí: forma parte de D13. La interfaz deja el hueco
// declarado para que su llegada no obligue a tocar el resto.
type VerificadorCuenta interface {
	Verificar(numero string) (bool, error)
}

// CuentaBancariaEstructura valida únicamente la forma: veinte dígitos.
//
// Es la parte pura y siempre disponible de la validación.
func CuentaBancariaEstructura(numero string) error {
	limpio := soloDigitosDe(numero)
	if limpio == "" {
		return ErrVacio
	}
	if len(limpio) != LargoCuentaBancaria {
		return fmt.Errorf("%w: la cuenta debe tener %d dígitos y tiene %d",
			ErrFormato, LargoCuentaBancaria, len(limpio))
	}
	return nil
}

// CodigoBancoDe extrae los cuatro dígitos iniciales, que identifican al banco.
func CodigoBancoDe(numero string) (string, error) {
	if err := CuentaBancariaEstructura(numero); err != nil {
		return "", err
	}
	return soloDigitosDe(numero)[:4], nil
}

// CuentaBancaria valida forma, existencia del banco y dígito verificador.
//
// Si falta el catálogo o el verificador, devuelve ErrInsumoNoDisponible en vez
// de dar la cuenta por buena. La ausencia de un insumo se manifiesta como un
// fallo visible, no como una validación que silenciosamente deja de comprobar.
func CuentaBancaria(numero string, bancos CatalogoBancos, dv VerificadorCuenta) error {
	if err := CuentaBancariaEstructura(numero); err != nil {
		return err
	}

	if bancos == nil {
		return fmt.Errorf("%w: no hay catálogo de bancos cargado", ErrInsumoNoDisponible)
	}

	// La estructura ya se validó arriba, así que el código de banco se extrae
	// directamente. Volver a llamar a CodigoBancoDe repetiría esa validación y
	// dejaría una rama de error que no puede darse.
	codigo := soloDigitosDe(numero)[:4]

	existe, err := bancos.Existe(codigo)
	if err != nil {
		return fmt.Errorf("no se pudo consultar el catálogo de bancos: %w", err)
	}
	if !existe {
		return fmt.Errorf("%w: el código de banco %q no existe", ErrFormato, codigo)
	}

	if dv == nil {
		return fmt.Errorf("%w: no hay algoritmo de dígito verificador de cuenta", ErrInsumoNoDisponible)
	}
	ok, err := dv.Verificar(soloDigitosDe(numero))
	if err != nil {
		return fmt.Errorf("no se pudo verificar la cuenta: %w", err)
	}
	if !ok {
		return ErrDigitoVerificador
	}
	return nil
}

// soloDigitosDe descarta cualquier carácter que no sea un dígito.
func soloDigitosDe(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
