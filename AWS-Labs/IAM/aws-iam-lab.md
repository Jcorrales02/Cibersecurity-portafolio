# Introduction to AWS Identity and Access Management (IAM)

## Temas tratados
En este caso, se demostrará lo siguiente:

- Análisis de usuarios y grupos de IAM creados previamente.  
- Inspección de políticas de IAM aplicadas a los grupos creados previamente.  
- Seguimiento de una situación real y adición de usuarios a los grupos con capacidades específicas habilitadas.  
- Ubicación y utilización de la URL de inicio de sesión de IAM.  
- Experimentación con los efectos de las políticas en el acceso a los servicios.

---

## AWS Identity and Access Management (IAM)

Se puede utilizar **AWS Identity and Access Management (IAM)** para realizar lo siguiente:

- **Administrar usuarios de IAM y su acceso:** crear usuarios, asignar credenciales (claves de acceso, contraseñas, MFA) y definir permisos.  
- **Administrar roles de IAM y sus permisos:** los roles permiten otorgar permisos temporales a entidades sin necesidad de credenciales permanentes.  
- **Administrar usuarios federados:** habilitar el acceso de usuarios de tu empresa a AWS sin crear cuentas IAM individuales.

---

## 🧩 Tarea 1: Analizar los usuarios y los grupos

En esta tarea, analizará los usuarios y grupos creados previamente en IAM.

1. En la parte superior de la **Consola de administración de AWS**, en la barra de búsqueda, busque y seleccione **IAM**.  
2. En el panel izquierdo, haga clic en **Usuarios**.  

   Ya se crearon los siguientes usuarios de IAM:
   - `user-1`
   - `user-2`
   - `user-3`

3. Haga clic en **user-1**.

📸 *Captura de pantalla:* /img/aws-iam-usuarios.png

- En la pestaña **Permissions**, observe que `user-1` no tiene permisos.  
- En **Grupos**, confirme que `user-1` no pertenece a ningún grupo.  
- En **Credenciales de seguridad**, verifique que posee una contraseña de consola.

---

### Analizar los grupos existentes

1. En el panel izquierdo, haga clic en **Grupos de usuarios**.  
   Los siguientes grupos ya fueron creados:
   - `EC2-Admin`
   - `EC2-Support`
   - `S3-Support`

2. Haga clic en **EC2-Support** → pestaña **Permisos**.  
   Este grupo tiene la política **AmazonEC2ReadOnlyAccess**, la cual permite listar y describir recursos de EC2, ELB, CloudWatch y Auto Scaling (solo lectura).

📸 *Captura:* `/img/aws-iam-permisos.png`

---

### Revisar los otros grupos

- **S3-Support:** tiene la política `AmazonS3ReadOnlyAccess` (solo lectura en S3).  
- **EC2-Admin:** contiene una **política insertada personalizada** con permisos para describir, iniciar y detener instancias EC2.

---

## 💼 Situación empresarial

La empresa usa Amazon EC2 y Amazon S3. Desea otorgar permisos según las funciones laborales:

| Usuario | Grupo asignado  | Permisos |
|----------|-----------------|-----------|
| user-1 | S3-Support | Acceso de solo lectura a S3 |
| user-2 | EC2-Support | Acceso de solo lectura a EC2 |
| user-3 | EC2-Admin | Visualizar, iniciar y detener instancias EC2 |

---

## 🧠 Tarea 2: Agregar usuarios a los grupos

### Agregar `user-1` al grupo `S3-Support`

1. En el panel izquierdo, seleccione **Grupos de usuarios**.  
2. Haga clic en **S3-Support** → pestaña **Usuarios** → **Añadir usuarios**.  
3. Seleccione `user-1` → **Añadir usuarios**.  
4. Confirme que `user-1` aparece listado en el grupo.

---

### Agregar `user-2` al grupo `EC2-Support`

Repita los mismos pasos anteriores seleccionando el grupo `EC2-Support` y el usuario `user-2`.

---

### Agregar `user-3` al grupo `EC2-Admin`

Repita los mismos pasos anteriores seleccionando el grupo `EC2-Admin` y el usuario `user-3`.

📋 *Verificación:* Cada grupo debe mostrar `1 usuario` en la columna “Usuarios”.

---

## 🔐 Tarea 3: Iniciar sesión y probar usuarios

1. En el panel izquierdo, seleccione **Panel**.  
   Copie la **URL de inicio de sesión para usuarios IAM**, que se ve similar a:  
   `https://123456789012.signin.aws.amazon.com/console`

2. Pegue esa URL en una **ventana privada/incógnito** según su navegador.

---

### Iniciar sesión como `user-1` (soporte S3)

- Usuario: `user-1`  
- Contraseña: `AdministratorPassword`  
- Buscar servicio: **S3**  
- Acceder al bucket `s3bucket`.  
  - ✅ Puede listar objetos.  
- Buscar servicio: **EC2**  
  - ❌ Recibe error “Access Denied”.

📸 *Captura:* `/img/aws-iam-usuario1-prueba.png`

---

### Iniciar sesión como `user-2` (soporte EC2)

- Usuario: `user-2`  
- Contraseña: `AdministratorPassword`  
- Buscar servicio: **EC2**  
  - ✅ Puede ver instancias.  
  - ❌ No puede detener ni modificar instancias (`You are not authorized to perform this operation`).  
- Buscar servicio: **S3**  
  - ❌ Error `Access Denied`.

📸 *Captura:* `/img/aws-iam-usuario2-prueba.png`

---

### Iniciar sesión como `user-3` (administrador EC2)

- Usuario: `user-3`  
- Contraseña: `AdministratorPassword`  
- Buscar servicio: **EC2**  
  - ✅ Puede ver, iniciar y detener instancias EC2.  
  - Confirmar que la instancia entra en estado **stopping** correctamente.

📸 *Captura:* `img/aws-iam-usuario3-prueba.png`

---

## ✅ Conclusión

¡Felicitaciones! 🎉  
He aprendido a realizar correctamente lo siguiente:

- Analizar usuarios y grupos de IAM creados previamente.  
- Inspeccionar políticas de IAM aplicadas a los grupos existentes.  
- Asignar usuarios a grupos basados en funciones reales.  
- Encontrar y utilizar la URL de inicio de sesión de IAM.  
- Comprobar cómo las políticas afectan los permisos y accesos a los servicios AWS.

---

