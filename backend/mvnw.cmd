@echo off
setlocal

SET MAVEN_PROJECTBASEDIR=%~dp0
SET WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar"
SET WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

IF NOT EXIST %WRAPPER_JAR% (
    echo Downloading Maven Wrapper...
    powershell -Command "Invoke-WebRequest -Uri 'https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar' -OutFile %WRAPPER_JAR%"
)

java -Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR% -cp %WRAPPER_JAR% %WRAPPER_LAUNCHER% %*
endlocal
