package com.wamma.crm;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Contrato de la API del CRM con el frontend: un solo DTO por concepto, con nombres en español, que la web
 * refleja tal cual en {@code frontend-web/src/api/crm.ts}. Ningún endpoint devuelve un registro del repositorio:
 * así un campo interno (como la huella del enlace) no sale por accidente, y cambiar una tabla no cambia el contrato.
 * Las pruebas de contrato fijan las claves de cada uno.
 */
public final class CrmDtos {

    private CrmDtos() {
    }

    public record OpportunityDto(
            UUID id,
            UUID personaId,
            String personaNombre,
            UUID vehiculoId,
            String vehiculoCodigo,
            String vehiculoMarca,
            String vehiculoModelo,
            String vehiculoVersion,
            int vehiculoAnio,
            String vehiculoFotoUrl,
            String modalidadPago,
            BigDecimal valorEstimado,
            String moneda,
            BigDecimal tasaBcv,
            LocalDate fechaTasa,
            String etapa,
            String motivoPerdida,
            String detallePerdida,
            UUID asesorId,
            String asesorNombre,
            String proximaAccion,
            LocalDate proximaAccionFecha,
            UUID solicitudCreditoId,
            String solicitudCreditoNumero,
            String solicitudCreditoEstado,
            boolean tieneEnlaceFinanciamiento,
            Instant enlaceEmitidoEn,
            Instant enlaceVenceEn,
            Instant enlaceUsadoEn,
            Instant cerradoEn,
            int version,
            Instant creadoEn,
            Instant actualizadoEn,
            Instant ultimaActividadEn,
            Instant entroEtapaEn
    ) {
    }

    public record AppointmentDto(
            UUID id,
            UUID personaId,
            String personaNombre,
            UUID oportunidadId,
            UUID vehiculoId,
            String vehiculoCodigo,
            String vehiculoTitulo,
            LocalDate diaPreferencia,
            String franjaHoraria,
            String estado,
            String notas,
            Instant reservaVenceEn,
            Instant creadoEn
    ) {
    }

    public record InteractionDto(
            UUID id,
            UUID personaId,
            UUID oportunidadId,
            String canal,
            String direccion,
            String nota,
            UUID autorId,
            Instant ocurridoEn,
            Instant registradoEn,
            UUID corrigeInteraccionId
    ) {
    }

    public record StageEventDto(
            UUID id,
            UUID oportunidadId,
            String etapaAnterior,
            String etapaNueva,
            String nota,
            UUID actorId,
            Instant ts
    ) {
    }

    public record MergeDto(
            UUID id,
            String nombreApellido,
            List<String> telefonos,
            String correo,
            Instant fechaCreacion,
            Instant fusionadaEn,
            List<UUID> oportunidadIds,
            List<UUID> citaIds,
            List<UUID> interaccionIds
    ) {
    }

    public record PersonSummaryDto(
            UUID id,
            String nombreApellido,
            String cedula,
            String telefonoPrincipal,
            List<String> telefonos,
            String correo,
            String canalOrigen,
            String estado,
            String criterioResolucion,
            Instant creadoEn,
            Instant ultimaActividadEn
    ) {
    }

    public record PersonDetailDto(
            UUID id,
            String nombreApellido,
            String cedula,
            String correo,
            String canalOrigen,
            UUID asesorId,
            String estado,
            String criterioResolucion,
            List<String> telefonos,
            List<OpportunityDto> oportunidades,
            List<AppointmentDto> citas,
            List<InteractionDto> interacciones,
            List<StageEventDto> historial,
            List<MergeDto> fusiones,
            /** Si el registro fue absorbido por otro, el de la persona vigente; nulo en cualquier otro caso. */
            UUID fusionadaCon,
            Instant creadoEn,
            Instant actualizadoEn
    ) {
    }

    /** Un asesor al que se puede asignar una oportunidad. */
    public record AdvisorDto(UUID id, String nombre) {
    }
}
