package com.wamma.platform.identity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Administración de usuarios y consulta de roles (plan 001 §10). Solo para {@code usuarios.gestionar}. */
@RestController
@PreAuthorize("hasAuthority('usuarios.gestionar')")
public class UserController {

    private final UserAdminService admin;

    public UserController(UserAdminService admin) {
        this.admin = admin;
    }

    public record CreateUserRequest(
            @NotBlank(message = "Indica el nombre de usuario") @Size(max = 50) String usuario,
            @NotBlank(message = "Indica el nombre") @Size(max = 100) String nombre,
            @NotBlank(message = "Indica el apellido") @Size(max = 100) String apellido,
            @NotBlank(message = "Indica el correo") @Email(message = "El correo no es válido") @Size(max = 150) String correo,
            @NotEmpty(message = "Asigna al menos un rol") Set<Role> roles) {
    }

    public record UpdateUserRequest(
            @Size(min = 1, max = 100) String nombre,
            @Size(min = 1, max = 100) String apellido,
            @Email(message = "El correo no es válido") @Size(max = 150) String correo,
            @Pattern(regexp = "activo|inactivo", message = "El estado debe ser activo o inactivo") String estado,
            Set<Role> roles) {
    }

    public record TemporaryPasswordResponse(String contrasenaTemporal) {
    }

    public record RoleView(String codigo, List<String> permisos) {
    }

    @GetMapping("/v1/usuarios")
    public List<UserAdminService.UserView> list() {
        return admin.list();
    }

    @PostMapping("/v1/usuarios")
    @ResponseStatus(HttpStatus.CREATED)
    public UserAdminService.CreatedUser create(@Valid @RequestBody CreateUserRequest request) {
        return admin.create(request.usuario(), request.nombre(), request.apellido(), request.correo(), request.roles());
    }

    @PatchMapping("/v1/usuarios/{id}")
    public UserAdminService.UserView update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        return admin.update(id, new UserAdminService.Changes(
                request.nombre(), request.apellido(), request.correo(), request.estado(), request.roles()));
    }

    @PostMapping("/v1/usuarios/{id}/restablecer-contrasena")
    public TemporaryPasswordResponse resetPassword(@PathVariable UUID id) {
        return new TemporaryPasswordResponse(admin.resetPassword(id));
    }

    @PostMapping("/v1/usuarios/{id}/restablecer-2fa")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetTotp(@PathVariable UUID id) {
        admin.resetTotp(id);
    }

    /** Roles con sus permisos, de solo lectura: la matriz la fija la migración V0013. */
    @GetMapping("/v1/roles")
    public List<RoleView> roles() {
        return Arrays.stream(Role.values())
                .map(role -> new RoleView(role.name(),
                        role.permissions().stream().map(Permission::code).sorted().toList()))
                .toList();
    }
}
