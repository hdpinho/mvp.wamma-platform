package com.wamma.crm;

import com.wamma.inventory.VehicleRepository;
import com.wamma.platform.identity.Role;
import com.wamma.platform.identity.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Siembra de datos de demostración para el CRM comercial (Ola E1).
 * Solo se activa cuando {@code wamma.demo.cargar-inventario} es true (desarrollo local).
 */
@Component
@Order(20) // Se ejecuta después de DemoInventorySeeder (@Order(10))
@ConditionalOnProperty(name = "wamma.demo.cargar-inventario", havingValue = "true")
public class DemoCrmSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoCrmSeeder.class);

    private final UserRepository users;
    private final PersonRepository persons;
    private final OpportunityRepository opportunities;
    private final AppointmentRepository appointments;
    private final VehicleRepository vehicles;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public DemoCrmSeeder(UserRepository users, PersonRepository persons, OpportunityRepository opportunities,
                         AppointmentRepository appointments, VehicleRepository vehicles,
                         TransactionTemplate transaction, Clock clock) {
        this.users = users;
        this.persons = persons;
        this.opportunities = opportunities;
        this.appointments = appointments;
        this.vehicles = vehicles;
        this.transaction = transaction;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) {
        transaction.executeWithoutResult(status -> {
            // Asignar todos los roles al admin.local para permitir pruebas completas
            users.findByUsername("admin.local").ifPresent(admin -> {
                Set<String> allRoles = Arrays.stream(Role.values())
                        .map(Enum::name)
                        .collect(Collectors.toSet());
                users.replaceRoles(admin.id(), allRoles, admin.id(), clock.instant());
                log.info("Roles completos de desarrollo asignados a admin.local");
            });

            if (opportunities.listAll().size() > 0) {
                return;
            }

            var allVehicles = vehicles.findAll();
            if (allVehicles.isEmpty()) {
                return;
            }

            UUID adminId = users.findByUsername("admin.local").map(u -> u.id()).orElse(null);
            Instant now = clock.instant();
            LocalDate today = LocalDate.ofInstant(now, clock.getZone());

            // 1. Prospecto 1: María Rodríguez con cita agendada
            UUID p1Id = persons.insertPerson("María Rodríguez", "V-18765432", "maria.rodriguez@ejemplo.invalid",
                    "catalogo_web", adminId, "nueva");
            if (p1Id != null) {
                persons.insertPhone(p1Id, "+584141234567", true);
                var v1 = allVehicles.getFirst();
                UUID o1Id = opportunities.insert(p1Id, v1.id(), "financiamiento",
                        BigDecimal.valueOf(12500), "EUR", BigDecimal.valueOf(45.5), today, adminId);
                appointments.insert(p1Id, o1Id, v1.id(), null, today.plusDays(2), "tarde",
                        now.plusSeconds(86400), "Interesada en prueba de manejo y financiamiento");
            }

            // 2. Prospecto 2: Carlos Mendoza en visita realizada
            if (allVehicles.size() > 1) {
                UUID p2Id = persons.insertPerson("Carlos Mendoza", "V-15432198", "carlos.mendoza@ejemplo.invalid",
                        "whatsapp", adminId, "nueva");
                if (p2Id != null) {
                    persons.insertPhone(p2Id, "+584249876543", true);
                    var v2 = allVehicles.get(1);
                    UUID o2Id = opportunities.insert(p2Id, v2.id(), "contado",
                        BigDecimal.valueOf(9800), "EUR", BigDecimal.valueOf(45.5), today, adminId);
                    opportunities.updateStage(o2Id, "visito", null, null, null, 0);
                    opportunities.updateNextAction(o2Id, "Llamar para coordinar revisión de documentos", today.plusDays(1));
                }
            }

            // 3. Prospecto 3: Alejandro Gómez en negociación
            if (allVehicles.size() > 2) {
                UUID p3Id = persons.insertPerson("Alejandro Gómez", "V-20112233", "alejandro.g@ejemplo.invalid",
                        "visita_sede", adminId, "nueva");
                if (p3Id != null) {
                    persons.insertPhone(p3Id, "+584125554433", true);
                    var v3 = allVehicles.get(2);
                    UUID o3Id = opportunities.insert(p3Id, v3.id(), "financiamiento",
                        BigDecimal.valueOf(14200), "EUR", BigDecimal.valueOf(45.5), today, adminId);
                    opportunities.updateStage(o3Id, "negociacion", null, null, null, 0);
                }
            }

            log.info("Siembra de datos de demostración del CRM completada.");
        });
    }
}
