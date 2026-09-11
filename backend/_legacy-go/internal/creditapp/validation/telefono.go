package validation

import (
	"fmt"
	"strings"
)

// operadorasMoviles son los códigos de operadora móvil admitidos en Venezuela.
//
// Estos cinco códigos vienen dados por el negocio. Si aparece una operadora
// nueva, se añade aquí y no en el formulario.
var operadorasMoviles = map[string]bool{
	"12": true, // Digitel
	"14": true, // Movistar
	"16": true, // Movilnet
	"24": true, // Movistar
	"26": true, // Movilnet
}

// TelefonoMovil valida un número celular venezolano.
//
// Forma esperada: +58 4 <operadora de 2 dígitos> <7 dígitos>. Se aceptan las
// grafías corrientes —con o sin prefijo internacional, con 0 inicial, con
// guiones, espacios o paréntesis— y se normalizan antes de validar.
func TelefonoMovil(valor string) error {
	nacional, err := normalizarTelefono(valor)
	if err != nil {
		return err
	}

	if len(nacional) != 10 {
		return fmt.Errorf("%w: un celular tiene 10 dígitos nacionales", ErrFormato)
	}
	if nacional[0] != '4' {
		return fmt.Errorf("%w: un celular empieza por 4", ErrFormato)
	}
	if !operadorasMoviles[nacional[1:3]] {
		return fmt.Errorf("%w: %q no es un código de operadora válido", ErrFormato, nacional[1:3])
	}
	return nil
}

// TelefonoFijo valida un número fijo venezolano.
//
// Forma esperada: +58 2 <código de área de 2 dígitos> <7 dígitos>.
//
// No se comprueba que el código de área exista: la lista oficial de códigos es
// un insumo pendiente (D14). Validar la forma y no la pertenencia es preferible
// a inventar un listado que rechazaría números legítimos.
func TelefonoFijo(valor string) error {
	nacional, err := normalizarTelefono(valor)
	if err != nil {
		return err
	}

	if len(nacional) != 10 {
		return fmt.Errorf("%w: un teléfono fijo tiene 10 dígitos nacionales", ErrFormato)
	}
	if nacional[0] != '2' {
		return fmt.Errorf("%w: un teléfono fijo empieza por 2", ErrFormato)
	}
	return nil
}

// MismoTelefono indica si dos números corresponden al mismo abonado, con
// independencia de cómo estén escritos.
//
// Se usa para exigir que las referencias tengan teléfonos distintos entre sí y
// distintos del solicitante: sin normalizar, "0412-1234567" y "+584121234567"
// pasarían por números diferentes.
func MismoTelefono(a, b string) bool {
	na, errA := normalizarTelefono(a)
	nb, errB := normalizarTelefono(b)
	if errA != nil || errB != nil {
		return false
	}
	return na == nb
}

// normalizarTelefono reduce el número a sus 10 dígitos nacionales.
//
// Acepta el prefijo internacional 58, con o sin +, y el 0 inicial de la
// marcación nacional.
func normalizarTelefono(valor string) (string, error) {
	var b strings.Builder
	for _, r := range valor {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digitos := b.String()
	if digitos == "" {
		return "", ErrVacio
	}

	// +58 4121234567 → 4121234567
	if strings.HasPrefix(digitos, "58") && len(digitos) == 12 {
		digitos = digitos[2:]
	}
	// 04121234567 → 4121234567
	if strings.HasPrefix(digitos, "0") && len(digitos) == 11 {
		digitos = digitos[1:]
	}
	return digitos, nil
}
