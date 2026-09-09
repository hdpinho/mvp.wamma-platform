package validation

import (
	"errors"
	"testing"
)

func TestCedula(t *testing.T) {
	casos := []struct {
		nombre string
		valor  string
		quiere error
	}{
		{"venezolana simple", "V12345678", nil},
		{"venezolana con guion", "V-12345678", nil},
		{"venezolana con puntos", "V-12.345.678", nil},
		{"venezolana en minúscula", "v12345678", nil},
		{"extranjera", "E1234567", nil},
		{"mínimo de 6 dígitos", "V123456", nil},
		{"máximo de 9 dígitos", "V123456789", nil},
		{"con espacios", " V 12345678 ", nil},

		{"vacía", "", ErrVacio},
		{"solo separadores", "-.-", ErrVacio},
		{"prefijo inválido", "J12345678", ErrFormato},
		{"sin prefijo", "12345678", ErrFormato},
		{"muy corta", "V12345", ErrFormato},
		{"muy larga", "V1234567890", ErrFormato},
		{"con letras en el cuerpo", "V1234A678", ErrFormato},
		{"solo el prefijo", "V", ErrFormato},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			err := Cedula(c.valor)
			if !errors.Is(err, c.quiere) {
				t.Fatalf("Cedula(%q) = %v; se esperaba %v", c.valor, err, c.quiere)
			}
		})
	}
}

// TestDigitoVerificadorRIF_CasoReal ancla el algoritmo a un RIF verificable.
//
// J-40242154-0 es el RIF de Corporación Token Pago POS, C.A., la empresa
// titular de WAMMA. Si este caso falla, el algoritmo está mal: no es un valor
// inventado para que la prueba pase.
func TestDigitoVerificadorRIF_CasoReal(t *testing.T) {
	dv, err := DigitoVerificadorRIF('J', "40242154")
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if dv != 0 {
		t.Fatalf("dígito verificador de J-40242154 = %d; se esperaba 0", dv)
	}

	if err := RIF("J-40242154-0"); err != nil {
		t.Fatalf("el RIF de Token Pago POS debería ser válido: %v", err)
	}
}

func TestDigitoVerificadorRIF_TodasLasLetras(t *testing.T) {
	// El peso de la letra cambia el resultado: se cubre cada prefijo válido.
	casos := []struct {
		letra  byte
		cuerpo string
		quiere int
	}{
		{'V', "12345678", 1},
		{'E', "12345678", 8},
		{'J', "12345678", 4},
		{'P', "12345678", 0},
		{'G', "12345678", 7},
	}

	for _, c := range casos {
		t.Run(string(c.letra), func(t *testing.T) {
			dv, err := DigitoVerificadorRIF(c.letra, c.cuerpo)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if dv != c.quiere {
				t.Fatalf("DigitoVerificadorRIF(%c, %s) = %d; se esperaba %d",
					c.letra, c.cuerpo, dv, c.quiere)
			}
		})
	}
}

func TestDigitoVerificadorRIF_Invalidos(t *testing.T) {
	casos := []struct {
		nombre string
		letra  byte
		cuerpo string
		quiere error
	}{
		{"letra no admitida", 'X', "12345678", ErrFormato},
		{"letra minúscula", 'v', "12345678", ErrFormato},
		{"cuerpo corto", 'V', "1234567", ErrFormato},
		{"cuerpo largo", 'V', "123456789", ErrFormato},
		{"cuerpo con letras", 'V', "1234A678", ErrFormato},
		{"cuerpo vacío", 'V', "", ErrFormato},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			_, err := DigitoVerificadorRIF(c.letra, c.cuerpo)
			if !errors.Is(err, c.quiere) {
				t.Fatalf("error = %v; se esperaba %v", err, c.quiere)
			}
		})
	}
}

func TestRIF(t *testing.T) {
	casos := []struct {
		nombre string
		valor  string
		quiere error
	}{
		{"válido con guiones", "J-40242154-0", nil},
		{"válido sin guiones", "J402421540", nil},
		{"válido en minúscula", "j-40242154-0", nil},
		{"persona natural", "V-12345678-1", nil},

		{"vacío", "", ErrVacio},
		{"dígito verificador incorrecto", "J-40242154-5", ErrDigitoVerificador},
		{"demasiado corto", "J-4024215-0", ErrFormato},
		{"demasiado largo", "J-402421543-0", ErrFormato},
		{"verificador no numérico", "J-40242154-X", ErrFormato},
		{"letra inválida", "X-40242154-0", ErrFormato},
		{"cuerpo con letras", "J-4024215A-0", ErrFormato},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			err := RIF(c.valor)
			if !errors.Is(err, c.quiere) {
				t.Fatalf("RIF(%q) = %v; se esperaba %v", c.valor, err, c.quiere)
			}
		})
	}
}

func TestDerivarRIF(t *testing.T) {
	casos := []struct {
		nombre string
		cedula string
		quiere string
	}{
		{"ocho dígitos", "V-12345678", "V-12345678-1"},
		{"rellena con ceros", "V-1234567", "V-01234567-0"},
		{"seis dígitos", "V-123456", "V-00123456-7"},
		{"extranjera", "E-12345678", "E-12345678-8"},
		{"con puntos", "V-12.345.678", "V-12345678-1"},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			rif, err := DerivarRIF(c.cedula)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if rif != c.quiere {
				t.Fatalf("DerivarRIF(%q) = %q; se esperaba %q", c.cedula, rif, c.quiere)
			}
			// El RIF derivado debe validarse a sí mismo.
			if err := RIF(rif); err != nil {
				t.Fatalf("el RIF derivado %q no se valida: %v", rif, err)
			}
		})
	}
}

func TestDerivarRIF_CedulaInvalida(t *testing.T) {
	casos := []string{"", "J12345678", "V123", "V1234567890"}

	for _, c := range casos {
		t.Run(c, func(t *testing.T) {
			if _, err := DerivarRIF(c); err == nil {
				t.Fatalf("DerivarRIF(%q) debería fallar", c)
			}
		})
	}
}

// TestDerivarRIF_NueveDigitos cubre la rama en que la cédula excede los ocho
// dígitos del cuerpo del RIF y por tanto no se rellena.
func TestDerivarRIF_NueveDigitos(t *testing.T) {
	if _, err := DerivarRIF("V-123456789"); !errors.Is(err, ErrFormato) {
		t.Fatalf("una cédula de 9 dígitos no cabe en el cuerpo del RIF; error = %v", err)
	}
}

func TestRellenarCeros(t *testing.T) {
	casos := []struct {
		valor  string
		ancho  int
		quiere string
	}{
		{"123", 8, "00000123"},
		{"12345678", 8, "12345678"},
		{"123456789", 8, "123456789"},
		{"", 3, "000"},
	}

	for _, c := range casos {
		if got := rellenarCeros(c.valor, c.ancho); got != c.quiere {
			t.Fatalf("rellenarCeros(%q, %d) = %q; se esperaba %q", c.valor, c.ancho, got, c.quiere)
		}
	}
}

func TestSoloDigitos(t *testing.T) {
	if soloDigitos("") {
		t.Fatal("la cadena vacía no debe considerarse solo dígitos")
	}
	if !soloDigitos("0123456789") {
		t.Fatal("los dígitos deben aceptarse")
	}
	if soloDigitos("12a34") {
		t.Fatal("las letras no deben aceptarse")
	}
}
