# ALERTA LITORAL · Informes del Niño

Web instalable (PWA), compatible con iPhone y Android, sin usuarios ni notificaciones push. Reúne, **cuando hay información disponible**, mediciones del INA, un panorama del SMN y publicaciones oficiales de la Municipalidad de Santa Fe.

## Desarrollo local

- Requiere Node.js 20 o superior.
- `npm run dev` → `http://localhost:3000`.
- `npm test` ejecuta pruebas sin consultar Internet.

## Publicación rápida sin GitHub (Windows)

1. Descomprimí el ZIP. Abrí la carpeta `alerta-litoral`.
2. En la barra de dirección del Explorador escribí `cmd` y presioná Enter.
3. Ejecutá `npx.cmd vercel@latest --prod`. Si no estás autenticado, Vercel te pedirá iniciar sesión y aceptar el nuevo proyecto.
4. Elegí el directorio actual (`./`) y el framework **Other**. Se obtiene un enlace `https://...vercel.app`. No compartas el enlace hasta verificar `/api/reporte` y que las secciones tengan datos vigentes.

**Alternativa con GitHub y despliegue continuo:**

## Publicación en Vercel

1. Creá un repositorio **nuevo** en GitHub, por ejemplo `alerta-litoral` (no modificar repositorios de tus otros proyectos).
2. Subí **los archivos de esta carpeta**, incluyendo `index.html`, `api/` y `lib/`, en la raíz del repositorio.
3. En Vercel: **Add New → Project → Import Git Repository**. Elegí el nuevo repositorio.
4. Framework Preset: **Other**. Root Directory: `/`. No hace falta comando de build ni variables de entorno.
5. Deploy. Vercel mostrará un enlace público `https://<nombre>.vercel.app` que podrás compartir por WhatsApp.
6. Abrí `/api/reporte` en tu dominio para comprobar el estado de las fuentes. Para comprobar los datos, abrí también los enlaces oficiales en la aplicación. 

> Este paquete no publica una página automáticamente: hace falta iniciar el despliegue en tu propia cuenta de Vercel y verificar que las fuentes externas respondan desde sus servidores.

## Actualizaciones de ocho horas

La ruta `/api/reporte` consulta las fuentes desde el servidor, nunca directamente desde el navegador. Vercel puede conservar su respuesta **8 horas** (`s-maxage=28800`). Al recibir una nueva visita después de ese plazo, el caché vuelve a actualizarse. Por lo tanto, **no es una ejecución autónoma cada ocho horas** si nadie consulta el sitio. Para un control verdaderamente programado hace falta configurar un proceso externo; no está incluido en esta primera etapa para mantenerla simple.

El horario de **consulta** no es el horario de las **mediciones**. La pantalla identifica el momento de la lectura y marca datos con más de 72 horas como antiguos. Si falla una fuente no inventamos cifras ni suprimimos advertencias. Algunas fuentes publican en formato irregular, por lo que las secciones pueden ser parciales. La app es un agregador informativo, no un sistema oficial de emergencia.

### Fuentes utilizadas

- INA, reporte diario: https://alerta.ina.gob.ar/a5/diario/reporte_diario
- INA, visualizador: https://alerta.ina.gob.ar/
- SMN, reporte ENOS: https://ws2.smn.gob.ar/enos
- Boletín oficial nacional El Niño: https://www.argentina.gob.ar/ina/el-nino-situacion-hidrometeorologica-en-argentina
- Municipalidad de Santa Fe, monitoreo: https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/monitoreo/
- Municipalidad de Santa Fe, plan de contingencia: https://santafeciudad.gov.ar/direccion-de-gestion-de-riesgo/plan-de-contingencia/

### Límites de esta primera etapa

No hay IA que lea y resuma PDFs completos ni pronósticos propios; el extracto automático se limita a los textos públicamente accesibles. El Salado depende de que el catálogo del INA exponga lecturas parsables. Si la fuente no las ofrece, se muestra la ausencia en lugar de extrapolar valores. La conexión automática con el agente personal de ChatGPT **no está disponible**; se ha replicado una **revisión independiente de fuentes públicas**.

La PWA se puede añadir a la pantalla de inicio, incluso sin publicar en las tiendas. No ofrece funcionamiento sin conexión para datos en tiempo real: solo puede permanecer visible la estructura de la interfaz; la información requiere conexión.

## Alcance del prototipo

El código fue validado con pruebas automáticas de datos simulados y sintaxis JavaScript. No se pudo probar una consulta real de producción ni publicar una URL de Vercel desde este entorno. Una vez desplegado, se debe abrir la página y también `/api/reporte` para confirmar que las fuentes oficiales responden desde la nube. La frecuencia de 8 h corresponde a caché de servidor bajo demanda, no a notificaciones ni a una tarea de publicación independiente.
