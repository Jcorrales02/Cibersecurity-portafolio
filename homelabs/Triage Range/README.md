# Triage Range

**Consola web interactiva de práctica de triage SOC** — filtrado de logs, reconstrucción de la cadena de ataque y análisis de contexto, con una experiencia inspirada en el buscador de Wazuh.

🔗 **Demo en vivo:** próximamente

---

## ¿Qué es esto?

Triage Range es una herramienta que construí para practicar y demostrar habilidades de análisis SOC Tier 1: leer logs, filtrarlos con un buscador tipo Wazuh Discover, reconstruir cómo ocurrió un ataque paso a paso, y distinguir entre verdaderos y falsos positivos usando contexto.

Cada caso simula una alerta real dentro de una empresa ficticia, con:

- **Logs realistas** generados a partir de un "universo" propio de empresa y de atacantes, respetando el formato y los campos reales que produce Wazuh según el tipo de log (Linux, Windows, Sysmon).
- **Buscador de filtrado** con sintaxis tipo `campo:valor`, similar al Discover de Wazuh.
- **Kill Chain interactiva** (en casos fáciles): asociar cada fase del ataque con su log correspondiente para reconstruir la secuencia completa de hechos.
- **Panel de Contexto SOC**: un buscador de pivoteo (manual o por clic) que permite consultar cualquier IP, host, usuario o hash y saber si es interno, externo, conocido como amenaza, o sin registro — con resultados tipo threat intel.
- **Casos de Falso Positivo / Verdadero Positivo**, para practicar juicio analítico y no solo mecánica de filtrado.
- **Tres niveles de dificultad** (fácil, medio, difícil), cada uno con preguntas de verificación sobre lo que el analista debería identificar.

## Stack

- **HTML, CSS y JavaScript** puro — sin frameworks de frontend.
- **Netlify** para hosting y despliegue continuo desde este repositorio.
- **Netlify Functions** para la validación de respuestas del lado del servidor, de forma que las respuestas correctas nunca se exponen en el navegador.

## Estado del proyecto

Este repositorio contiene una vista parcial del código como muestra de portafolio. El proyecto completo y actualizado —incluyendo el generador de casos, los universos de datos ficticios, y las funciones de validación— se mantiene en un repositorio privado mientras sigo iterando sobre él.

## Sobre mí

Estudiante de ciberseguridad construyendo hacia una posición de SOC Tier 1 Analyst. Este proyecto forma parte de mi portafolio junto con mi preparación para la certificación SC-200 (Microsoft Security Operations Analyst) y mi home lab con Wazuh.

🔗 Portafolio completo: [jcorrales02.github.io/Jcorrales-Web](https://jcorrales02.github.io/Jcorrales-Web/)
