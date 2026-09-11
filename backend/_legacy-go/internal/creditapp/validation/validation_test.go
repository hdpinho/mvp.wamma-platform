package validation

import (
	"context"
	"errors"
	"testing"
	"time"
)

// ── Teléfonos ──────────────────────────────────────────────────────

func TestTelefonoMovil(t *testing.T) {
	casos := []struct {
		nombre string
		valor  string
		quiere error
	}{
		{"internacional con +", "+584121234567", nil},
		{"internacional sin +", "584121234567", nil},
		{"nacional con 0", "04121234567", nil},
		{"sin prefijo", "4121234567", nil},
		{"con guiones", "0412-123-4567", nil},
		{"con paréntesis y espacios", "(0412) 123 4567", nil},
		{"operadora 12", "4121234567", nil},
		{"operadora 14", "4141234567", nil},
		{"operadora 16", "4161234567", nil},
		{"operadora 24", "4241234567", nil},
		{"operadora 26", "4261234567", nil},

		{"vacío", "", ErrVacio},
		{"solo letras", "abc", ErrVacio},
		{"muy corto", "412123456", ErrFormato},
		{"muy largo", "41212345678", ErrFormato},
		{"no empieza por 4", "2121234567", ErrFormato},
		{"operadora inexistente", "4991234567", ErrFormato},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if err := TelefonoMovil(c.valor); !errors.Is(err, c.quiere) {
				t.Fatalf("TelefonoMovil(%q) = %v; se esperaba %v", c.valor, err, c.quiere)
			}
		})
	}
}

func TestTelefonoFijo(t *testing.T) {
	casos := []struct {
		nombre string
		valor  string
		quiere error
	}{
		{"Caracas internacional", "+582121234567", nil},
		{"Caracas nacional", "02121234567", nil},
		{"sin prefijo", "2121234567", nil},

		{"vacío", "", ErrVacio},
		{"muy corto", "212123456", ErrFormato},
		{"es un celular", "4121234567", ErrFormato},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if err := TelefonoFijo(c.valor); !errors.Is(err, c.quiere) {
				t.Fatalf("TelefonoFijo(%q) = %v; se esperaba %v", c.valor, err, c.quiere)
			}
		})
	}
}

// TestMismoTelefono cubre la regla de referencias con teléfonos distintos.
func TestMismoTelefono(t *testing.T) {
	casos := []struct {
		nombre string
		a, b   string
		quiere bool
	}{
		{"mismas grafías", "04121234567", "04121234567", true},
		{"grafías distintas del mismo número", "+584121234567", "0412-123-4567", true},
		{"números distintos", "04121234567", "04141234567", false},
		{"uno vacío", "", "04121234567", false},
		{"ambos vacíos", "", "", false},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if got := MismoTelefono(c.a, c.b); got != c.quiere {
				t.Fatalf("MismoTelefono(%q, %q) = %v; se esperaba %v", c.a, c.b, got, c.quiere)
			}
		})
	}
}

// ── Correo ─────────────────────────────────────────────────────────

func TestFormatoCorreo(t *testing.T) {
	casos := []struct {
		nombre string
		valor  string
		quiere error
	}{
		{"simple", "cliente@wamma.com.ve", nil},
		{"con punto en la parte local", "juan.perez@gmail.com", nil},
		{"con etiqueta", "juan+wamma@gmail.com", nil},
		{"con guion en el dominio", "a@mi-banco.com", nil},
		{"con espacios alrededor", "  a@b.com  ", nil},

		{"vacío", "", ErrVacio},
		{"solo espacios", "   ", ErrVacio},
		{"con espacio interno", "a b@c.com", ErrFormato},
		{"sin arroba", "clientewamma.com", ErrFormato},
		{"sin parte local", "@wamma.com", ErrFormato},
		{"sin dominio", "cliente@", ErrFormato},
		{"dominio sin extensión", "cliente@wamma", ErrFormato},
		{"extensión de una letra", "cliente@wamma.c", ErrFormato},
		{"extensión numérica", "cliente@wamma.12", ErrFormato},
		{"etiqueta vacía", "cliente@wamma..com", ErrFormato},
		{"dominio con guion inicial", "cliente@-wamma.com", ErrFormato},
		{"dominio con guion final", "cliente@wamma-.com", ErrFormato},
		{"carácter no admitido", "cliente@wam!ma.com", ErrFormato},
		{"puntos seguidos en la parte local", "a..b@c.com", ErrFormato},
		{"punto inicial en la parte local", ".ab@c.com", ErrFormato},
		{"punto final en la parte local", "ab.@c.com", ErrFormato},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if err := FormatoCorreo(c.valor); !errors.Is(err, c.quiere) {
				t.Fatalf("FormatoCorreo(%q) = %v; se esperaba %v", c.valor, err, c.quiere)
			}
		})
	}
}

func TestFormatoCorreo_Longitudes(t *testing.T) {
	local := make([]byte, 65)
	for i := range local {
		local[i] = 'a'
	}
	if err := FormatoCorreo(string(local) + "@b.com"); !errors.Is(err, ErrFormato) {
		t.Fatal("una parte local de más de 64 caracteres debe rechazarse")
	}

	etiqueta := make([]byte, 64)
	for i := range etiqueta {
		etiqueta[i] = 'a'
	}
	if err := FormatoCorreo("a@" + string(etiqueta) + ".com"); !errors.Is(err, ErrFormato) {
		t.Fatal("una etiqueta de dominio de más de 63 caracteres debe rechazarse")
	}
}

type mxFalso struct {
	tiene bool
	err   error
}

func (m mxFalso) TieneMX(context.Context, string) (bool, error) { return m.tiene, m.err }

func TestCorreo(t *testing.T) {
	ctx := context.Background()

	t.Run("sin resolutor solo valida la forma", func(t *testing.T) {
		if err := Correo(ctx, "cliente@wamma.com.ve", nil); err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
	})

	t.Run("forma inválida no consulta DNS", func(t *testing.T) {
		if err := Correo(ctx, "sin-arroba", mxFalso{tiene: true}); !errors.Is(err, ErrFormato) {
			t.Fatalf("se esperaba ErrFormato; got %v", err)
		}
	})

	t.Run("dominio con MX", func(t *testing.T) {
		if err := Correo(ctx, "cliente@wamma.com.ve", mxFalso{tiene: true}); err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
	})

	t.Run("dominio sin MX", func(t *testing.T) {
		if err := Correo(ctx, "cliente@wamma.com.ve", mxFalso{tiene: false}); !errors.Is(err, ErrFormato) {
			t.Fatal("un dominio sin MX debe rechazarse")
		}
	})

	t.Run("fallo del resolutor se propaga", func(t *testing.T) {
		falla := errors.New("dns caído")
		if err := Correo(ctx, "cliente@wamma.com.ve", mxFalso{err: falla}); !errors.Is(err, falla) {
			t.Fatalf("el error del resolutor debe propagarse; got %v", err)
		}
	})
}

// ── Fechas ─────────────────────────────────────────────────────────

func fecha(a, m, d int) time.Time {
	return time.Date(a, time.Month(m), d, 0, 0, 0, 0, time.UTC)
}

func TestEdad(t *testing.T) {
	casos := []struct {
		nombre     string
		nacimiento time.Time
		referencia time.Time
		quiere     int
	}{
		{"cumpleaños ya pasado", fecha(1990, 1, 15), fecha(2026, 6, 1), 36},
		{"cumpleaños aún no llega", fecha(1990, 12, 15), fecha(2026, 6, 1), 35},
		{"justo el día del cumpleaños", fecha(1990, 6, 1), fecha(2026, 6, 1), 36},
		{"recién nacido", fecha(2026, 6, 1), fecha(2026, 6, 1), 0},

		// Regresión: nacido en año bisiesto, referencia en año no bisiesto.
		// Comparando por día del año, el 25 de agosto cae en el ordinal 238 en
		// 2008 y en el 237 en 2026, y el cálculo restaba un año de más.
		{"bisiesto a no bisiesto, cumpleaños del día", fecha(2008, 8, 25), fecha(2026, 8, 25), 18},
		{"bisiesto a no bisiesto, día anterior", fecha(2008, 8, 26), fecha(2026, 8, 25), 17},
		{"nacido el 29 de febrero, antes del 1 de marzo", fecha(2008, 2, 29), fecha(2026, 2, 28), 17},
		{"nacido el 29 de febrero, el 1 de marzo", fecha(2008, 2, 29), fecha(2026, 3, 1), 18},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if got := Edad(c.nacimiento, c.referencia); got != c.quiere {
				t.Fatalf("Edad = %d; se esperaba %d", got, c.quiere)
			}
		})
	}
}

func TestFechaNacimiento(t *testing.T) {
	hoy := fecha(2026, 8, 25)

	t.Run("mayor de edad sin regla de máximo", func(t *testing.T) {
		if err := FechaNacimiento(fecha(1990, 1, 1), hoy, 24, ReglasEdad{}); err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
	})

	t.Run("fecha vacía", func(t *testing.T) {
		if err := FechaNacimiento(time.Time{}, hoy, 12, ReglasEdad{}); !errors.Is(err, ErrVacio) {
			t.Fatalf("se esperaba ErrVacio; got %v", err)
		}
	})

	t.Run("fecha futura", func(t *testing.T) {
		if err := FechaNacimiento(fecha(2030, 1, 1), hoy, 12, ReglasEdad{}); !errors.Is(err, ErrFormato) {
			t.Fatalf("se esperaba ErrFormato; got %v", err)
		}
	})

	t.Run("menor de edad", func(t *testing.T) {
		if err := FechaNacimiento(fecha(2015, 1, 1), hoy, 12, ReglasEdad{}); !errors.Is(err, ErrMenorDeEdad) {
			t.Fatalf("se esperaba ErrMenorDeEdad; got %v", err)
		}
	})

	t.Run("justo 18 años", func(t *testing.T) {
		if err := FechaNacimiento(fecha(2008, 8, 25), hoy, 12, ReglasEdad{}); err != nil {
			t.Fatalf("con 18 recién cumplidos debe aceptarse: %v", err)
		}
	})

	t.Run("un día antes de los 18", func(t *testing.T) {
		if err := FechaNacimiento(fecha(2008, 8, 26), hoy, 12, ReglasEdad{}); !errors.Is(err, ErrMenorDeEdad) {
			t.Fatal("un día antes de cumplir 18 debe rechazarse")
		}
	})

	max := 70
	reglas := ReglasEdad{EdadMaximaAlVencimiento: &max}

	t.Run("dentro de la edad máxima", func(t *testing.T) {
		if err := FechaNacimiento(fecha(1970, 1, 1), hoy, 12, reglas); err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
	})

	t.Run("excede la edad máxima al vencimiento", func(t *testing.T) {
		if err := FechaNacimiento(fecha(1950, 1, 1), hoy, 36, reglas); !errors.Is(err, ErrFueraDeRango) {
			t.Fatal("debe rechazarse por edad al vencimiento")
		}
	})

	t.Run("plazo negativo", func(t *testing.T) {
		if err := FechaNacimiento(fecha(1990, 1, 1), hoy, -1, reglas); !errors.Is(err, ErrFueraDeRango) {
			t.Fatalf("se esperaba ErrFueraDeRango; got %v", err)
		}
	})
}

// ── Cuenta bancaria ────────────────────────────────────────────────

type bancosFalso struct {
	existe bool
	err    error
}

func (b bancosFalso) Existe(string) (bool, error) { return b.existe, b.err }

type dvFalso struct {
	ok  bool
	err error
}

func (d dvFalso) Verificar(string) (bool, error) { return d.ok, d.err }

func TestCuentaBancariaEstructura(t *testing.T) {
	casos := []struct {
		nombre string
		valor  string
		quiere error
	}{
		{"veinte dígitos", "01020304050607080910", nil},
		{"con guiones", "0102-0304-0506-0708-0910", nil},
		{"con espacios", "0102 0304 0506 0708 0910", nil},

		{"vacía", "", ErrVacio},
		{"solo letras", "abcd", ErrVacio},
		{"diecinueve dígitos", "0102030405060708091", ErrFormato},
		{"veintiún dígitos", "010203040506070809101", ErrFormato},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if err := CuentaBancariaEstructura(c.valor); !errors.Is(err, c.quiere) {
				t.Fatalf("CuentaBancariaEstructura(%q) = %v; se esperaba %v", c.valor, err, c.quiere)
			}
		})
	}
}

func TestCodigoBancoDe(t *testing.T) {
	codigo, err := CodigoBancoDe("0102-0304-0506-0708-0910")
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if codigo != "0102" {
		t.Fatalf("CodigoBancoDe = %q; se esperaba \"0102\"", codigo)
	}

	if _, err := CodigoBancoDe("123"); !errors.Is(err, ErrFormato) {
		t.Fatal("una cuenta mal formada no debe devolver código de banco")
	}
}

// TestCuentaBancaria_InsumosAusentes fija la regla de diseño: sin catálogo ni
// algoritmo, la validación falla de forma visible en vez de dar por buena la
// cuenta.
func TestCuentaBancaria_InsumosAusentes(t *testing.T) {
	valida := "01020304050607080910"

	t.Run("sin catálogo de bancos", func(t *testing.T) {
		if err := CuentaBancaria(valida, nil, dvFalso{ok: true}); !errors.Is(err, ErrInsumoNoDisponible) {
			t.Fatalf("se esperaba ErrInsumoNoDisponible; got %v", err)
		}
	})

	t.Run("sin verificador", func(t *testing.T) {
		err := CuentaBancaria(valida, bancosFalso{existe: true}, nil)
		if !errors.Is(err, ErrInsumoNoDisponible) {
			t.Fatalf("se esperaba ErrInsumoNoDisponible; got %v", err)
		}
	})
}

func TestCuentaBancaria(t *testing.T) {
	valida := "01020304050607080910"

	t.Run("todo correcto", func(t *testing.T) {
		if err := CuentaBancaria(valida, bancosFalso{existe: true}, dvFalso{ok: true}); err != nil {
			t.Fatalf("error inesperado: %v", err)
		}
	})

	t.Run("estructura inválida", func(t *testing.T) {
		if err := CuentaBancaria("123", bancosFalso{existe: true}, dvFalso{ok: true}); !errors.Is(err, ErrFormato) {
			t.Fatalf("se esperaba ErrFormato; got %v", err)
		}
	})

	t.Run("banco inexistente", func(t *testing.T) {
		if err := CuentaBancaria(valida, bancosFalso{existe: false}, dvFalso{ok: true}); !errors.Is(err, ErrFormato) {
			t.Fatal("un banco inexistente debe rechazarse")
		}
	})

	t.Run("fallo al consultar el catálogo", func(t *testing.T) {
		falla := errors.New("catálogo caído")
		if err := CuentaBancaria(valida, bancosFalso{err: falla}, dvFalso{ok: true}); !errors.Is(err, falla) {
			t.Fatalf("el error del catálogo debe propagarse; got %v", err)
		}
	})

	t.Run("dígito verificador incorrecto", func(t *testing.T) {
		if err := CuentaBancaria(valida, bancosFalso{existe: true}, dvFalso{ok: false}); !errors.Is(err, ErrDigitoVerificador) {
			t.Fatalf("se esperaba ErrDigitoVerificador; got %v", err)
		}
	})

	t.Run("fallo del verificador", func(t *testing.T) {
		falla := errors.New("verificador caído")
		if err := CuentaBancaria(valida, bancosFalso{existe: true}, dvFalso{err: falla}); !errors.Is(err, falla) {
			t.Fatalf("el error del verificador debe propagarse; got %v", err)
		}
	})
}
