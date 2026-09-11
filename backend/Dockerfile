# ==============================================================================
# Stage 1: Build JAR con Maven y Eclipse Temurin JDK 21
# ==============================================================================
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Copiar pom.xml y precargar dependencias para aprovechar la caché de capas Docker
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copiar código fuente y compilar
COPY src ./src
RUN mvn clean package -DskipTests -B

# ==============================================================================
# Stage 2: Runtime ligero con JRE 21 Alpine (~150MB)
# ==============================================================================
FROM eclipse-temurin:21-jre-alpine AS runtime

WORKDIR /app

# Crear usuario sin privilegios por seguridad
RUN addgroup -S wamma && adduser -S wamma -G wamma
USER wamma:wamma

# Copiar el artefacto compilado desde el builder
COPY --from=builder --chown=wamma:wamma /app/target/*.jar app.jar

# Render asigna dinámicamente el puerto en la variable $PORT (típicamente 10000)
ENV PORT=8080
EXPOSE ${PORT}

# Optimización de JVM para contenedores con memoria acotada
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dserver.port=${PORT} -jar app.jar"]
