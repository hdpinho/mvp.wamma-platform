package com.wamma.crm;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Límites del módulo CRM (plan 010 §2, E1).
 * <p>
 * La separación entre la capa comercial y el expediente de crédito (spec 010 §8.3) es un
 * límite de dependencias, no una convención: si alguien escribe el {@code import}, esta prueba
 * falla. Lo mismo para el núcleo puro, que tiene que poder probarse sin Spring ni base.
 */
@AnalyzeClasses(packages = "com.wamma", importOptions = ImportOption.DoNotIncludeTests.class)
class CrmArchitectureTest {

    @ArchTest
    static final ArchRule domainIsPure = classes()
            .that().resideInAPackage("com.wamma.crm.domain..")
            .should().onlyDependOnClassesThat().resideInAnyPackage("java..", "com.wamma.crm.domain..")
            .because("el núcleo del CRM se prueba sin Spring ni base de datos (plan 010 §2)");

    @ArchTest
    static final ArchRule crmNeverReachesTheCreditFile = noClasses()
            .that().resideInAPackage("com.wamma.crm..")
            .should().dependOnClassesThat().resideInAPackage("com.wamma.creditapp..")
            .because("la capa comercial no ve el expediente de crédito, solo su estado (spec 010 §8.3)");

    @ArchTest
    static final ArchRule inventoryDoesNotKnowTheCrm = noClasses()
            .that().resideInAPackage("com.wamma.inventory..")
            .should().dependOnClassesThat().resideInAPackage("com.wamma.crm..")
            .because("el CRM usa el inventario, no al revés (plan 010 §2)");

    @ArchTest
    static final ArchRule platformDoesNotKnowTheCrm = noClasses()
            .that().resideInAPackage("com.wamma.platform..")
            .should().dependOnClassesThat().resideInAPackage("com.wamma.crm..")
            .because("la plataforma es transversal y no depende de ningún módulo de negocio");
}
