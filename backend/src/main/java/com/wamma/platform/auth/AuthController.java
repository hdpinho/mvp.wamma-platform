package com.wamma.platform.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * Ingreso y cuenta propia (plan 001 §10). Los nombres del contrato van en español: los
 * consume el frontend tal cual.
 */
@RestController
@RequestMapping("/v1/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    public record LoginRequest(@NotBlank(message = "Indica tu usuario") @Size(max = 50) String usuario,
                               @NotBlank(message = "Indica tu contraseña") @Size(max = 200) String contrasena) {
    }

    public record LoginResponse(String tokenTemporal, AuthService.NextStep siguiente, Instant expiraEn) {
    }

    public record NewPasswordRequest(@NotBlank(message = "Indica la nueva contraseña") @Size(max = 200) String nueva) {
    }

    public record NextStepResponse(AuthService.NextStep siguiente) {
    }

    public record TotpSetupResponse(String secreto, String uriOtpauth) {
    }

    public record CodeRequest(@Size(max = 20) String codigo, @Size(max = 20) String codigoRecuperacion) {
    }

    public record SessionResponse(String token, Instant expiraEn, AuthService.Profile usuario,
                                  List<String> codigosRecuperacion, AuthService.NextStep siguiente) {
    }

    public record OwnPasswordRequest(@NotBlank(message = "Indica tu contraseña actual") @Size(max = 200) String actual,
                                     @NotBlank(message = "Indica la nueva contraseña") @Size(max = 200) String nueva) {
    }

    @PostMapping("/ingreso")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        AuthService.PasswordStep step = auth.login(request.usuario(), request.contrasena());
        return new LoginResponse(step.temporaryToken(), step.next(), step.expiresAt());
    }

    @PostMapping("/contrasena-inicial")
    public NextStepResponse initialPassword(@AuthenticationPrincipal AuthenticatedUser user,
                                            @Valid @RequestBody NewPasswordRequest request) {
        return new NextStepResponse(auth.changeInitialPassword(user, request.nueva()));
    }

    @PostMapping("/2fa/activacion")
    public TotpSetupResponse startActivation(@AuthenticationPrincipal AuthenticatedUser user) {
        AuthService.TotpSetup setup = auth.startTotpActivation(user);
        return new TotpSetupResponse(setup.secret(), setup.otpauthUri());
    }

    @PostMapping("/2fa/confirmacion")
    public SessionResponse confirmActivation(@AuthenticationPrincipal AuthenticatedUser user,
                                             @RequestBody CodeRequest request) {
        return toResponse(auth.confirmTotpActivation(user, request.codigo()));
    }

    @PostMapping("/2fa")
    public SessionResponse secondFactor(@AuthenticationPrincipal AuthenticatedUser user,
                                        @RequestBody CodeRequest request) {
        AuthService.SecondFactorOutcome outcome =
                auth.verifySecondFactor(user, request.codigo(), request.codigoRecuperacion());
        if (outcome.login() == null) {
            return new SessionResponse(null, null, null, List.of(), outcome.next());
        }
        return toResponse(outcome.login());
    }

    @PostMapping("/salida")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal AuthenticatedUser user) {
        auth.logout(user);
    }

    @GetMapping("/yo")
    public AuthService.Profile me(@AuthenticationPrincipal AuthenticatedUser user) {
        return auth.profile(user.userId());
    }

    @PutMapping("/contrasena")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AuthenticatedUser user,
                               @Valid @RequestBody OwnPasswordRequest request) {
        auth.changeOwnPassword(user, request.actual(), request.nueva());
    }

    private static SessionResponse toResponse(AuthService.CompletedLogin login) {
        return new SessionResponse(login.token(), login.expiresAt(), login.usuario(), login.recoveryCodes(), null);
    }
}
