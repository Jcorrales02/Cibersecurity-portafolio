# TryHackMe — Linux Fundamentals (Part 1)
# TryHackMe — Linux Fundamentals (Part 1)

**Autor:** José Corrales  
**Repositorio sugerido:** roadmap-ciberseguridad / portafolio-ciberseguridad  
**Fecha de la práctica:** 24/09/2025

---

## Objetivo
Documentar la primera sala *Linux Fundamentals* de TryHackMe: historia rápida, navegación por el sistema de ficheros, comandos básicos, uso de `find` y `grep`, y resumen de operadores útiles del shell.

---

## Plataforma / Contexto
**Plataforma:** TryHackMe (máquina virtual provista por la sala)  
**Contexto:** Prácticas guiadas con comandos básicos y resolución de preguntas de la room.

---

## Preguntas y respuestas (práctica)

- **¿En qué año se publicó la primera versión del kernel de Linux?**  
  **Respuesta:** **1991**. Linus Torvalds anunció el kernel en agosto de 1991 y lo liberó públicamente en septiembre de 1991.

- **En la máquina Linux de la sala:**
  - **¿Cuántas carpetas hay?** → `4`
  - **¿Qué directorio contiene un archivo?** → `folder4`
  - **¿Cuál es el contenido de este archivo?** → `Hello World`
  - **Ruta tras `cd` al archivo (nuevo directorio de trabajo):** `/home/tryhackme/folder4`

---

## Comandos practicados (ejemplos y explicación)

Aquí están los comandos que usaste y su propósito. Pégalos en la VM cuando quieras repetir la práctica.


# mostrar el usuario actual
whoami

# mostrar directorio actual
pwd

# listar archivos y ver permisos
ls -la

# cambiar directorio
cd /home/tryhackme/folder4

# ver contenido de un archivo
cat nombre_del_archivo.txt

# crear/añadir contenido a un archivo
echo "Hello World" > archivo.txt

# añadir contenido sin sobrescribir
echo "linea extra" >> archivo.txt
