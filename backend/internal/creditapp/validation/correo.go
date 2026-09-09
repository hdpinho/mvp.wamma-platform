package validation

import (
	"context"
	"fmt"
	"strings"
)

// FormatoCorreo valida la forma de una dirección de correo.
//
// Es la mitad pura de la validación. La comprobación de que el dominio existe
// exige una consulta DNS y vive en ResolutorMX, para que este paquete siga sin
// hacer I/O y pueda probarse por completo.
func FormatoCorreo(valor string) error {
	v := strings.TrimSpace(valor)
	if v == "" {
		return ErrVacio
	}
	if strings.ContainsAny(v, " \t\r\n") {
		return fmt.Errorf("%w: el correo no admite espacios", ErrFormato)
	}

	arroba := strings.LastIndex(v, "@")
	if arroba <= 0 || arroba == len(v)-1 {
		return fmt.Errorf("%w: falta la parte local o el dominio", ErrFormato)
	}

	local, dominio := v[:arroba], v[arroba+1:]
	if len(local) > 64 || len(v) > 254 {
		return fmt.Errorf("%w: la dirección excede la longitud admitida", ErrFormato)
	}
	if strings.Contains(local, "..") || strings.HasPrefix(local, ".") || strings.HasSuffix(local, ".") {
		return fmt.Errorf("%w: la parte local tiene puntos mal colocados", ErrFormato)
	}
	return validarDominio(dominio)
}

// validarDominio comprueba la forma del dominio: etiquetas separadas por
// puntos, sin guiones en los extremos y con una extensión final alfabética.
//
// No comprueba aparte el dominio vacío porque no hace falta: Split("", ".")
// devuelve una sola etiqueta vacía y la comprobación de extensión ya la
// rechaza. Una guarda adicional sería código muerto.
func validarDominio(dominio string) error {
	etiquetas := strings.Split(dominio, ".")
	if len(etiquetas) < 2 {
		return fmt.Errorf("%w: el dominio debe incluir una extensión", ErrFormato)
	}

	for _, e := range etiquetas {
		if e == "" || len(e) > 63 {
			return fmt.Errorf("%w: etiqueta de dominio de longitud inválida", ErrFormato)
		}
		if e[0] == '-' || e[len(e)-1] == '-' {
			return fmt.Errorf("%w: una etiqueta no puede empezar ni terminar en guion", ErrFormato)
		}
		for i := 0; i < len(e); i++ {
			c := e[i]
			esAlnum := (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
			if !esAlnum && c != '-' {
				return fmt.Errorf("%w: carácter no admitido en el dominio", ErrFormato)
			}
		}
	}

	ext := etiquetas[len(etiquetas)-1]
	if len(ext) < 2 {
		return fmt.Errorf("%w: la extensión del dominio es demasiado corta", ErrFormato)
	}
	for i := 0; i < len(ext); i++ {
		c := ext[i]
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
			return fmt.Errorf("%w: la extensión del dominio debe ser alfabética", ErrFormato)
		}
	}
	return nil
}

// ResolutorMX comprueba que un dominio tenga registro MX, es decir, que pueda
// recibir correo.
//
// Se declara como interfaz para no atar este paquete a la red: en pruebas se
// inyecta una implementación falsa y en producción una que consulte DNS con
// tiempo límite y caché.
type ResolutorMX interface {
	TieneMX(ctx context.Context, dominio string) (bool, error)
}

// Correo valida forma y capacidad de recepción.
//
// Si no se suministra resolutor, se valida solo la forma. Es deliberado: un
// fallo de DNS no debe impedir que alguien envíe su solicitud, mientras que una
// dirección mal escrita sí debe corregirse en el momento.
func Correo(ctx context.Context, valor string, mx ResolutorMX) error {
	if err := FormatoCorreo(valor); err != nil {
		return err
	}
	if mx == nil {
		return nil
	}

	dominio := valor[strings.LastIndex(valor, "@")+1:]
	ok, err := mx.TieneMX(ctx, dominio)
	if err != nil {
		return fmt.Errorf("no se pudo verificar el dominio %q: %w", dominio, err)
	}
	if !ok {
		return fmt.Errorf("%w: el dominio %q no recibe correo", ErrFormato, dominio)
	}
	return nil
}
