package com.wamma.platform.identity;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** La matriz aprobada (plan 001 §9, D-24), expresada como hechos que no deben cambiar sin decisión. */
class RoleTest {

    @Test
    void matrixHasTheApprovedSize() {
        int assignments = Arrays.stream(Role.values()).mapToInt(role -> role.permissions().size()).sum();
        assertThat(Role.values()).hasSize(6);
        assertThat(Permission.values()).hasSize(13);
        assertThat(assignments).isEqualTo(25);
    }

    @Test
    void everyPermissionBelongsToSomeRole() {
        Set<Permission> used = EnumSet.noneOf(Permission.class);
        Arrays.stream(Role.values()).forEach(role -> used.addAll(role.permissions()));
        assertThat(used).containsExactlyInAnyOrder(Permission.values());
    }

    @Test
    void administratorDoesNotOperateByDefault() {
        assertThat(Role.ADMINISTRADOR.permissions()).doesNotContain(
                Permission.INVENTORY_MANAGE, Permission.CRM_OPERATE, Permission.CREDIT_REVIEW);
    }

    @Test
    void auditorOnlyReads() {
        assertThat(Role.AUDITOR.permissions()).containsExactlyInAnyOrder(
                Permission.AUDIT_VIEW, Permission.INVENTORY_VIEW, Permission.CRM_VIEW_ALL, Permission.CREDIT_VIEW);
    }
}
