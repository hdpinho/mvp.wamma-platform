package com.wamma.platform.auth;

import com.wamma.platform.identity.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Convierte el {@code Authorization: Bearer} en la identidad de la petición (plan 001 §4.2).
 * <p>
 * Una sesión completa recibe sus permisos como authorities, más {@link #COMPLETE}. Una
 * parcial recibe solo {@link #PARTIAL}: sirve para terminar el ingreso y para nada más.
 * Un token inválido no autentica, y la regla de autorización responde 401.
 */
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    public static final String PARTIAL = "SESION_PARCIAL";
    public static final String COMPLETE = "SESION_COMPLETA";

    private final SessionService sessions;
    private final UserRepository users;

    public SessionAuthenticationFilter(SessionService sessions, UserRepository users) {
        this.sessions = sessions;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            sessions.authenticate(header.substring(7).trim()).ifPresent(active -> {
                List<GrantedAuthority> authorities = new ArrayList<>();
                if (active.level() == SessionService.Level.COMPLETA) {
                    authorities.add(new SimpleGrantedAuthority(COMPLETE));
                    users.permissionsOf(active.userId())
                            .forEach(permission -> authorities.add(new SimpleGrantedAuthority(permission)));
                } else {
                    authorities.add(new SimpleGrantedAuthority(PARTIAL));
                }
                AuthenticatedUser principal = new AuthenticatedUser(
                        active.userId(), active.sessionId(), active.username(), active.level());
                SecurityContextHolder.getContext().setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(principal, null, authorities));
            });
        }
        chain.doFilter(request, response);
    }
}
