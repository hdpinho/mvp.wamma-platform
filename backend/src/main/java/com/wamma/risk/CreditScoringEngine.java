package com.wamma.risk;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class CreditScoringEngine {

    public record EngineResult(
            int scoreInterno,
            int scoreBuro,
            String riesgoNivel,
            BigDecimal cuotaMaximaPermitida,
            BigDecimal porcentajeCapacidadUsada,
            boolean alertaCapacidad,
            List<RiskDtos.ScoringFactorDto> factores
    ) {
    }

    public EngineResult evaluate(
            BigDecimal montoSolicitado,
            BigDecimal cuotaInicial,
            BigDecimal cuotaEstimada,
            BigDecimal capacidadPagoMensual,
            Map<String, Object> personalData,
            Map<String, Object> contactData,
            Map<String, Object> employmentData,
            Map<String, Object> financialData,
            List<Map<String, Object>> references,
            Map<String, Object> bankingData
    ) {
        List<RiskDtos.ScoringFactorDto> factores = new ArrayList<>();

        // 1. Capacidad de Pago y Regla del 30% (Máximo 350 pts)
        BigDecimal capacidad = capacidadPagoMensual != null && capacidadPagoMensual.compareTo(BigDecimal.ZERO) > 0
                ? capacidadPagoMensual : BigDecimal.ONE;
        BigDecimal cuota = cuotaEstimada != null && cuotaEstimada.compareTo(BigDecimal.ZERO) > 0
                ? cuotaEstimada : BigDecimal.ZERO;

        BigDecimal ratioCapacidad = cuota.divide(capacidad, 4, RoundingMode.HALF_UP);
        BigDecimal porcentajeUso = ratioCapacidad.multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP);
        BigDecimal cuotaMaxima = capacidad.multiply(new BigDecimal("0.30")).setScale(2, RoundingMode.HALF_UP);

        int ptsCapacidad;
        String estadoCapacidad;
        String descCapacidad;
        boolean alertaCapacidad = false;

        if (ratioCapacidad.compareTo(new BigDecimal("0.20")) <= 0) {
            ptsCapacidad = 350;
            estadoCapacidad = "optimo";
            descCapacidad = "Cuota compromete solo el " + porcentajeUso + "% del ingreso (inferior al 20%). Capacidad de pago holgada.";
        } else if (ratioCapacidad.compareTo(new BigDecimal("0.30")) <= 0) {
            ptsCapacidad = 280;
            estadoCapacidad = "aceptable";
            descCapacidad = "Cuota representa el " + porcentajeUso + "% del ingreso, cumpliendo la política de riesgo (máximo 30%).";
        } else if (ratioCapacidad.compareTo(new BigDecimal("0.38")) <= 0) {
            ptsCapacidad = 120;
            estadoCapacidad = "atencion";
            alertaCapacidad = true;
            descCapacidad = "Alerta: Cuota representa el " + porcentajeUso + "%, superando el umbral prudencial del 30%.";
        } else {
            ptsCapacidad = 0;
            estadoCapacidad = "critico";
            alertaCapacidad = true;
            descCapacidad = "Riesgo Crítico: Cuota representa el " + porcentajeUso + "% de la capacidad neta. Exceso de endeudamiento.";
        }
        factores.add(new RiskDtos.ScoringFactorDto("Capacidad de Pago (Regla 30%)", ptsCapacidad, 350, descCapacidad, estadoCapacidad));

        // 2. Porcentaje de Cuota Inicial (Máximo 200 pts)
        BigDecimal inicial = cuotaInicial != null ? cuotaInicial : BigDecimal.ZERO;
        BigDecimal solicitado = montoSolicitado != null ? montoSolicitado : BigDecimal.ZERO;
        BigDecimal valorTotal = inicial.add(solicitado);

        BigDecimal ratioInicial = valorTotal.compareTo(BigDecimal.ZERO) > 0
                ? inicial.divide(valorTotal, 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal porcentajeInicial = ratioInicial.multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP);

        int ptsInicial;
        String estadoInicial;
        String descInicial;
        if (ratioInicial.compareTo(new BigDecimal("0.40")) >= 0) {
            ptsInicial = 200;
            estadoInicial = "optimo";
            descInicial = "Inicial destacada del " + porcentajeInicial + "% (≥40%), disminuyendo el saldo deudor financiado.";
        } else if (ratioInicial.compareTo(new BigDecimal("0.30")) >= 0) {
            ptsInicial = 150;
            estadoInicial = "aceptable";
            descInicial = "Inicial sólida del " + porcentajeInicial + "%.";
        } else if (ratioInicial.compareTo(new BigDecimal("0.20")) >= 0) {
            ptsInicial = 100;
            estadoInicial = "aceptable";
            descInicial = "Inicial del " + porcentajeInicial + "%, cumpliendo el piso mínimo del 20%.";
        } else {
            ptsInicial = 0;
            estadoInicial = "critico";
            descInicial = "Inicial del " + porcentajeInicial + "% por debajo del mínimo exigido (20%).";
        }
        factores.add(new RiskDtos.ScoringFactorDto("Cuota Inicial Aportada", ptsInicial, 200, descInicial, estadoInicial));

        // 3. Estabilidad y Antigüedad Laboral (Máximo 200 pts)
        int antiguedadAnios = 0;
        if (employmentData != null && employmentData.get("antiguedadAnios") != null) {
            try {
                antiguedadAnios = Integer.parseInt(String.valueOf(employmentData.get("antiguedadAnios")));
            } catch (Exception ignored) {
            }
        }
        String ocupacion = employmentData != null ? String.valueOf(employmentData.getOrDefault("tipoOcupacion", "EMPLEADO_PRIVADO")) : "OTRO";

        int ptsLaboral;
        String estadoLaboral;
        String descLaboral;
        if (antiguedadAnios >= 5) {
            ptsLaboral = 200;
            estadoLaboral = "optimo";
            descLaboral = "Alta estabilidad: " + antiguedadAnios + " años de antigüedad (" + ocupacion + ").";
        } else if (antiguedadAnios >= 2) {
            ptsLaboral = 150;
            estadoLaboral = "aceptable";
            descLaboral = "Estabilidad media: " + antiguedadAnios + " años de trayectoria laboral.";
        } else if (antiguedadAnios >= 1) {
            ptsLaboral = 100;
            estadoLaboral = "atencion";
            descLaboral = "Antigüedad reciente: " + antiguedadAnios + " año en el empleo actual.";
        } else {
            ptsLaboral = 50;
            estadoLaboral = "atencion";
            descLaboral = "Menos de 1 año de permanencia o actividad laboral informal.";
        }
        factores.add(new RiskDtos.ScoringFactorDto("Estabilidad y Antigüedad Laboral", ptsLaboral, 200, descLaboral, estadoLaboral));

        // 4. Solvencia Bancaria y Referencias (Máximo 150 pts)
        String banco = bankingData != null ? String.valueOf(bankingData.getOrDefault("banco", "")).trim() : "";
        String tipoCuenta = bankingData != null ? String.valueOf(bankingData.getOrDefault("tipoCuenta", "")).trim() : "";
        int cantReferencias = references != null ? references.size() : 0;

        int ptsBancario;
        String estadoBancario;
        String descBancario;
        if (!banco.isBlank() && "CORRIENTE".equalsIgnoreCase(tipoCuenta) && cantReferencias >= 2) {
            ptsBancario = 150;
            estadoBancario = "optimo";
            descBancario = "Cuenta corriente bancaria activa en " + banco + " y " + cantReferencias + " referencias consignadas.";
        } else if (!banco.isBlank() && cantReferencias >= 1) {
            ptsBancario = 100;
            estadoBancario = "aceptable";
            descBancario = "Cuenta bancaria formal y referencias verificables.";
        } else {
            ptsBancario = 40;
            estadoBancario = "atencion";
            descBancario = "Información bancaria o referencias mínimas incompletas.";
        }
        factores.add(new RiskDtos.ScoringFactorDto("Solvencia Bancaria y Referencias", ptsBancario, 150, descBancario, estadoBancario));

        // 5. Perfil Demográfico y Vivienda (Máximo 100 pts)
        String tipoVivienda = contactData != null ? String.valueOf(contactData.getOrDefault("tipoVivienda", "PROPIA")).toUpperCase() : "PROPIA";
        int cargas = 0;
        if (personalData != null && personalData.get("cargasFamiliares") != null) {
            try {
                cargas = Integer.parseInt(String.valueOf(personalData.get("cargasFamiliares")));
            } catch (Exception ignored) {
            }
        }

        int ptsDemografico;
        String estadoDemografico;
        String descDemografico;
        if ("PROPIA".contains(tipoVivienda) && cargas <= 2) {
            ptsDemografico = 100;
            estadoDemografico = "optimo";
            descDemografico = "Vivienda propia, " + cargas + " cargas familiares (patrón de gasto controlado).";
        } else if (cargas <= 3) {
            ptsDemografico = 70;
            estadoDemografico = "aceptable";
            descDemografico = "Vivienda " + tipoVivienda.toLowerCase() + ", " + cargas + " cargas familiares.";
        } else {
            ptsDemografico = 40;
            estadoDemografico = "atencion";
            descDemografico = "Cargas familiares elevadas (" + cargas + ") que comprometen el ingreso disponible.";
        }
        factores.add(new RiskDtos.ScoringFactorDto("Perfil Demográfico y Vivienda", ptsDemografico, 100, descDemografico, estadoDemografico));

        // Cálculo Total y Nivel de Riesgo
        int totalScore = ptsCapacidad + ptsInicial + ptsLaboral + ptsBancario + ptsDemografico;
        totalScore = Math.clamp(totalScore, 0, 1000);

        String nivelRiesgo;
        if (totalScore >= 750) {
            nivelRiesgo = "bajo";
        } else if (totalScore >= 600) {
            nivelRiesgo = "medio";
        } else if (totalScore >= 450) {
            nivelRiesgo = "alto";
        } else {
            nivelRiesgo = "no_asegurable";
        }

        // Score Buró Access Datametrics (Escala 100–800)
        int scoreBuro = 100 + (totalScore * 700 / 1000);
        scoreBuro = Math.clamp(scoreBuro, 100, 800);

        return new EngineResult(
                totalScore,
                scoreBuro,
                nivelRiesgo,
                cuotaMaxima,
                porcentajeUso,
                alertaCapacidad,
                factores
        );
    }
}
