FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

RUN addgroup -S gateway && adduser -S gateway -G gateway
USER gateway

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "-Xmx512m", "-XX:+UseG1GC", "app.jar"]
