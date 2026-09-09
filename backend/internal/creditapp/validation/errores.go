// Package validation reúne las validaciones de documentos, teléfonos, correo,
// fechas y cuentas bancarias venezolanas.
//
// Es deliberadamente independiente del formulario y del dominio: no importa
// nada del resto del backend, no hace I/O y no conoce la solicitud de crédito.
// Así puede reutilizarse desde los módulos 002 (KYC), 006 (riesgo) y 007
// (pagos) sin arrastrar dependencias.
//
// Las validaciones que exigen estado externo —resolución MX, existencia de un
// banco en el catálogo— se declaran como interfaces y se inyectan; nunca se
// resuelven aquí dentro.
package validation

import "errors"

var (
	// ErrVacio indica que el campo obligatorio llegó sin contenido.
	ErrVacio = errors.New("el campo es obligatorio")

	// ErrFormato indica que el valor no cumple la forma esperada.
	ErrFormato = errors.New("el formato no es válido")

	// ErrDigitoVerificador indica que el dígito verificador no concuerda con
	// el resto del identificador.
	ErrDigitoVerificador = errors.New("el dígito verificador no es correcto")

	// ErrFueraDeRango indica que el valor tiene la forma correcta pero cae
	// fuera de los límites admitidos.
	ErrFueraDeRango = errors.New("el valor está fuera del rango admitido")

	// ErrMenorDeEdad indica que el solicitante no alcanza la mayoría de edad.
	ErrMenorDeEdad = errors.New("el solicitante debe ser mayor de edad")

	// ErrInsumoNoDisponible indica que la validación depende de un dato que
	// todavía no ha sido suministrado por el negocio.
	//
	// Se devuelve, por ejemplo, cuando se valida una cuenta bancaria sin
	// catálogo de bancos cargado. Es deliberado: ante un insumo ausente el
	// sistema falla de forma visible en lugar de aceptar el valor. Un catálogo
	// inventado produciría errores silenciosos hasta producción.
	ErrInsumoNoDisponible = errors.New("falta un insumo requerido para validar")
)
