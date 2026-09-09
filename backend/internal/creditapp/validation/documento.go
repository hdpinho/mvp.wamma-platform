package validation

import (
	"fmt"
	"strings"
)

// TipoDocumento distingue las formas de identificación admitidas.
type TipoDocumento string

const (
	// CedulaVenezolana corresponde al nacional (prefijo V).
	CedulaVenezolana TipoDocumento = "V"
	// CedulaExtranjera corresponde al residente extranjero (prefijo E).
	CedulaExtranjera TipoDocumento = "E"
	// Pasaporte corresponde al documento de viaje de un no residente.
	Pasaporte TipoDocumento = "P"
)

// letrasRIF son los prefijos válidos de un RIF y su peso en el cálculo del
// dígito verificador.
//
//	V — persona natural venezolana
//	E — persona natural extranjera
//	J — persona jurídica
//	P — pasaporte
//	G — ente gubernamental
var letrasRIF = map[byte]int{'V': 1, 'E': 2, 'J': 3, 'P': 4, 'G': 5}

// pesosRIF son los multiplicadores del algoritmo módulo 11. El primero aplica
// a la letra; los ocho restantes, a cada dígito del cuerpo.
var pesosRIF = [9]int{4, 3, 2, 7, 6, 5, 4, 3, 2}

// Cedula valida una cédula de identidad venezolana.
//
// Se admite el prefijo V o E seguido de 6 a 9 dígitos. Se toleran el guion,
// los puntos de millar y los espacios porque son la forma en que la gente
// escribe su cédula; se normalizan antes de validar.
func Cedula(valor string) error {
	limpio := normalizarDocumento(valor)
	if limpio == "" {
		return ErrVacio
	}

	prefijo := limpio[0]
	if prefijo != 'V' && prefijo != 'E' {
		return fmt.Errorf("%w: el prefijo debe ser V o E", ErrFormato)
	}

	digitos := limpio[1:]
	if len(digitos) < 6 || len(digitos) > 9 {
		return fmt.Errorf("%w: la cédula debe tener entre 6 y 9 dígitos", ErrFormato)
	}
	if !soloDigitos(digitos) {
		return fmt.Errorf("%w: la cédula solo admite dígitos tras el prefijo", ErrFormato)
	}
	return nil
}

// RIF valida un Registro de Información Fiscal comprobando su dígito
// verificador por el algoritmo módulo 11.
//
// La comprobación es aritmética, no una expresión regular: un RIF con la forma
// correcta pero dígito verificador inconsistente se rechaza. Esa es justamente
// la clase de error que una expresión regular deja pasar.
func RIF(valor string) error {
	letra, cuerpo, dv, err := descomponerRIF(valor)
	if err != nil {
		return err
	}

	esperado, err := DigitoVerificadorRIF(letra, cuerpo)
	if err != nil {
		return err
	}
	if dv != esperado {
		return fmt.Errorf("%w: se esperaba %d y se recibió %d", ErrDigitoVerificador, esperado, dv)
	}
	return nil
}

// DigitoVerificadorRIF calcula el dígito verificador de un RIF a partir de su
// letra y de los ocho dígitos del cuerpo.
//
// El algoritmo suma el peso de la letra y el de cada dígito, toma el resto
// entre 11 y lo resta de 11. Si el resultado no cabe en una cifra, el dígito
// verificador es 0.
func DigitoVerificadorRIF(letra byte, cuerpo string) (int, error) {
	peso, ok := letrasRIF[letra]
	if !ok {
		return 0, fmt.Errorf("%w: la letra %q no es válida para un RIF", ErrFormato, letra)
	}
	if len(cuerpo) != 8 || !soloDigitos(cuerpo) {
		return 0, fmt.Errorf("%w: el cuerpo del RIF debe tener 8 dígitos", ErrFormato)
	}

	suma := peso * pesosRIF[0]
	for i := 0; i < 8; i++ {
		suma += int(cuerpo[i]-'0') * pesosRIF[i+1]
	}

	dv := 11 - (suma % 11)
	if dv > 9 {
		// Tanto 10 como 11 se representan como 0.
		dv = 0
	}
	return dv, nil
}

// DerivarRIF construye el RIF de una persona natural a partir de su cédula.
//
// El cuerpo se rellena con ceros a la izquierda hasta ocho dígitos y el dígito
// verificador se calcula. Evita que el solicitante transcriba a mano un dato
// que el sistema puede deducir, que era una fuente de error frecuente en el
// formato en papel. El resultado sigue siendo editable por el usuario.
func DerivarRIF(cedula string) (string, error) {
	if err := Cedula(cedula); err != nil {
		return "", err
	}

	limpio := normalizarDocumento(cedula)
	letra := limpio[0]
	cuerpo := rellenarCeros(limpio[1:], 8)

	dv, err := DigitoVerificadorRIF(letra, cuerpo)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%c-%s-%d", letra, cuerpo, dv), nil
}

// descomponerRIF separa un RIF en letra, cuerpo y dígito verificador.
func descomponerRIF(valor string) (letra byte, cuerpo string, dv int, err error) {
	limpio := normalizarDocumento(valor)
	if limpio == "" {
		return 0, "", 0, ErrVacio
	}
	if len(limpio) != 10 {
		return 0, "", 0, fmt.Errorf("%w: el RIF debe tener una letra, 8 dígitos y el verificador", ErrFormato)
	}

	letra = limpio[0]
	cuerpo = limpio[1:9]
	ultimo := limpio[9]
	if ultimo < '0' || ultimo > '9' {
		return 0, "", 0, fmt.Errorf("%w: el dígito verificador debe ser numérico", ErrFormato)
	}
	return letra, cuerpo, int(ultimo - '0'), nil
}

// normalizarDocumento deja el valor en mayúsculas y sin separadores.
func normalizarDocumento(valor string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(valor) {
		switch r {
		case '-', '.', ' ', '\t':
			// Separadores de escritura habitual: se descartan.
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

// rellenarCeros antepone ceros hasta alcanzar el ancho pedido. Si el valor ya
// es igual o más largo, se devuelve intacto.
func rellenarCeros(s string, ancho int) string {
	if len(s) >= ancho {
		return s
	}
	return strings.Repeat("0", ancho-len(s)) + s
}

// soloDigitos indica si la cadena está formada exclusivamente por dígitos.
// Una cadena vacía no cumple.
func soloDigitos(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}
