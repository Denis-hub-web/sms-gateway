package com.smsgateway.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("SMS Gateway API")
                .description("""
                    Production-ready Android SMS Gateway REST API.
                    
                    Allows remote systems (Schools, Hospitals, SACCOs, etc.) to send SMS
                    through Android devices registered as gateways.
                    
                    ## Authentication
                    - **User JWT**: Use `/api/auth/login` to get an access token
                    - **Gateway Token**: Returned on gateway registration
                    - **API Key**: Pass in `X-API-Key` header for tenant identification
                    """)
                .version("1.0.0")
                .contact(new Contact()
                    .name("SMS Gateway Team")
                    .email("admin@smsgateway.com"))
                .license(new License().name("MIT")))
            .servers(List.of(
                new Server().url("http://localhost:8080").description("Development"),
                new Server().url("https://api.smsgateway.com").description("Production")
            ))
            .addSecurityItem(new SecurityRequirement().addList("Bearer Auth"))
            .components(new Components()
                .addSecuritySchemes("Bearer Auth", new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("Enter JWT token from /api/auth/login")));
    }
}
