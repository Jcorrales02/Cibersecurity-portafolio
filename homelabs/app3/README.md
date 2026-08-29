# Triage Range

**Consola interactiva de práctica de triage SOC** — filtrado de logs estilo Wazuh Discover, investigación con contexto real y clasificación de incidentes, pensada para entrenar el criterio de un analista SOC Tier 1.

> ⚠️ **Uso restringido — Proyecto en desarrollo**
> Este repositorio es parte de mi portafolio personal y **todavía no está publicado ni disponible para uso público**. El código, los casos, los datos de ejemplo y cualquier contenido de este repositorio **no están autorizados para su uso, copia, redistribución ni despliegue por parte de terceros** hasta que el autor lo publique oficialmente como versión estable. Si estás revisando este repo como parte de un proceso de selección o entrevista, sos bienvenido/a a explorarlo y ejecutarlo localmente para evaluación — cualquier otro uso requiere autorización previa.

---

## ¿Qué es Triage Range?

Triage Range simula el día a día de un analista SOC Tier 1: te llega una alerta con contexto mínimo, tenés que filtrar entre un montón de logs (mezcla de actividad real y ruido a propósito), cruzar lo que vas encontrando con el contexto de la empresa, y llegar a una conclusión respaldada por evidencia — no por corazonada.

No es una lista de preguntas de trivia sobre ciberseguridad. Es un entorno de práctica donde la única forma de responder bien es investigar de verdad, como en el trabajo real.

## Cómo funciona

1. **Elegís un caso** por dificultad (Fácil / Medio / Difícil), cada uno con su propio escenario, volumen de logs y objetivo.
2. **Filtrás los logs** con sintaxis de búsqueda tipo DQL (`campo:"valor"`, `AND`/`OR`/`AND NOT`, rangos `>=`/`<=`), igual que en Wazuh Discover — con un panel de campos dinámico para armar la consulta sin tener que memorizar todo de una.
3. **Verificás contexto** en el panel de Contexto SOC: buscás cualquier IP, hostname, usuario, correo o hash y el sistema te dice si es un activo interno, un usuario del directorio, una herramienta/SaaS autorizado, o infraestructura de amenaza conocida — igual que haría un analista real antes de escalar o descartar una alerta. También hay *click to pivot*: clic directo sobre cualquier valor dentro de un log para consultarlo al toque, sin copiar y pegar.
4. **Respondés con evidencia**: cada caso trae 10 preguntas verificables contra los logs y el contexto investigado, con pistas progresivas si te trabás.
5. **Cerrás el caso**: en dificultad Fácil, reconstruyendo la cadena de ataque completa (Kill Chain, fase por fase). En Medio y Difícil, con un veredicto final — **¿Falso Positivo o Verdadero Positivo?** — porque en un SOC real, descartar bien lo que no es un ataque pesa tanto como detectar lo que sí lo es.

## Funcionalidades principales

- **Motor de filtrado DQL** con soporte de operadores lógicos, comodines, rangos numéricos y agrupación con paréntesis.
- **Panel de campos dinámico**, que se arma según los campos presentes en cada caso.
- **Panel de Contexto SOC**: buscador manual + historial de consultas por caso + *click to pivot*, contra un "universo" propio de la empresa (activos, usuarios/directorio, herramientas internas y SaaS autorizados) y de amenazas (14 perfiles de atacante con IPs/dominios de C2, además de infraestructura señuelo que no apunta a nada, para entrenar a no asumir que "toda IP externa rara es maliciosa").
- **Glosario integrado**: íconos de referencia rápida sobre EventCodes de Windows Security, Event IDs de Sysmon, tipos de LogonType y puertos comunes — sin salir de la app a buscarlo.
- **Kill Chain interactiva** (dificultad Fácil): reconstrucción de la cadena de ataque fase por fase, con pistas y validación.
- **Clasificación Falso Positivo / Verdadero Positivo** (dificultad Medio/Difícil): casos donde lo que parece un ataque tiene una explicación legítima verificable — y viceversa.
- **Sistema de dificultad progresivo** (Fácil / Medio / Difícil), con variedad deliberada de vectores de ataque (no solo PowerShell), alcance (single-host y multi-host) y tipos de explicación en los casos de Falso Positivo, para que no se vuelvan predecibles.
- **Motor generador de casos** propio (vía IA + validador automatizado en Node) que mantiene coherencia entre el universo de la empresa, el universo de atacantes, y las reglas de formato real de Wazuh (Windows Security, Sysmon, Linux/SSH) — de forma que cada caso nuevo se valida antes de subirse a producción.

## Stack técnico

HTML, CSS y JavaScript vanilla — sin frameworks ni backend. Los casos, el universo de la empresa y el de amenazas viven en archivos JSON estáticos, organizados por dificultad, cargados dinámicamente por la app.

## Estado del proyecto

🚧 En desarrollo activo. Actualmente en construcción: la tanda completa de casos de dificultad Medio y Difícil (con clasificación Falso Positivo/Verdadero Positivo), y pulido de la experiencia visual e interactiva.

## Sobre este proyecto

Construido como pieza de portafolio personal, en el marco de mi formación hacia una posición de SOC Analyst Tier 1 y mi preparación para la certificación Microsoft SC-200 (Security Operations Analyst).

---

**José Corrales** — [jcorrales02.github.io/Jcorrales-Web](https://jcorrales02.github.io/Jcorrales-Web/) · [LinkedIn](https://www.linkedin.com/in/josecorralesg) · [GitHub](https://github.com/jcorrales02)

*Todos los derechos reservados hasta la publicación oficial de este proyecto.*
