package com.smsgateway.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/school").setViewName("forward:/school/index.html");
        registry.addViewController("/school/").setViewName("forward:/school/index.html");
        registry.addViewController("/school-portal").setViewName("forward:/school-portal/login.html");
        registry.addViewController("/school-portal/").setViewName("forward:/school-portal/login.html");
    }
}
