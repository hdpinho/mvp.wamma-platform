package com.wamma.crm;

import com.wamma.crm.domain.CedulaNormalizer;
import com.wamma.crm.domain.PhoneNormalizer;
import com.wamma.platform.crypto.BlindIndex;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

/**
 * Resolución y deduplicación de identidad (spec 010 §8.5, plan §5):
 * 1. por cédula si existe;
 * 2. por cualquier teléfono de la persona;
 * 3. si no, crea una persona nueva.
 */
@Service
public class IdentityResolver {

    private final PersonRepository persons;
    private final BlindIndex blindIndex;

    public IdentityResolver(PersonRepository persons, BlindIndex blindIndex) {
        this.persons = persons;
        this.blindIndex = blindIndex;
    }

    public record ResolutionResult(PersonRecord person, String criterion, boolean isNew) {
    }

    public ResolutionResult resolve(String fullName, String rawPhone, String rawCedula, String rawEmail,
                                    String channel, UUID advisorId) {
        String normalizedPhone = PhoneNormalizer.mobileE164(rawPhone);
        String normalizedCedula = (rawCedula != null && !rawCedula.isBlank())
                ? CedulaNormalizer.canonical(rawCedula)
                : null;
        String normalizedEmail = (rawEmail != null && !rawEmail.isBlank())
                ? rawEmail.trim().toLowerCase()
                : null;

        // 1. Por cédula si se proporcionó
        if (normalizedCedula != null) {
            String cedulaIdx = blindIndex.of(normalizedCedula, PersonRepository.CONTEXT_CEDULA);
            Optional<PersonRecord> existing = persons.findByBlindIndexCedula(cedulaIdx);
            if (existing.isPresent()) {
                PersonRecord p = existing.get();
                boolean hasPhone = p.phones().stream().anyMatch(ph -> ph.phone().equals(normalizedPhone));
                if (!hasPhone) {
                    persons.insertPhone(p.id(), normalizedPhone, p.phones().isEmpty());
                    p = persons.findById(p.id()).orElse(p);
                }
                return new ResolutionResult(p, "cedula", false);
            }
        }

        // 2. Por teléfono
        String phoneIdx = blindIndex.of(normalizedPhone, PersonRepository.CONTEXT_PHONE);
        Optional<PersonRecord> byPhone = persons.findByBlindIndexPhone(phoneIdx);
        if (byPhone.isPresent()) {
            PersonRecord p = byPhone.get();
            if (normalizedCedula != null && p.cedula() == null) {
                persons.updateCedula(p.id(), normalizedCedula);
                p = persons.findById(p.id()).orElse(p);
            }
            return new ResolutionResult(p, "telefono", false);
        }

        // 3. Crear nueva persona
        UUID newPersonId = persons.insertPerson(
                fullName != null && !fullName.isBlank() ? fullName.trim() : "Prospecto",
                normalizedCedula,
                normalizedEmail,
                channel != null ? channel : "catalogo_web",
                advisorId,
                "nueva"
        );

        if (newPersonId == null && normalizedCedula != null) {
            // Condición de carrera por inserción simultánea con la misma cédula
            String cedulaIdx = blindIndex.of(normalizedCedula, PersonRepository.CONTEXT_CEDULA);
            PersonRecord p = persons.findByBlindIndexCedula(cedulaIdx).orElseThrow();
            return new ResolutionResult(p, "cedula", false);
        }

        persons.insertPhone(newPersonId, normalizedPhone, true);
        PersonRecord created = persons.findById(newPersonId).orElseThrow();
        return new ResolutionResult(created, "nueva", true);
    }
}
