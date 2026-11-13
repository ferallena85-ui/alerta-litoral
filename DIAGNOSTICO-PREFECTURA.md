# Prefectura — diagnóstico previo a la publicación

Revisión del 12/11/2026, hora argentina. Las cifras de esta nota provienen de consultas reales, no de los ejemplos de pruebas ni de la imagen adjunta.

## Resultado real

El servidor local consultó a las **23:55:20 del 12/11/2026** la fuente oficial https://contenidosweb.prefecturanaval.gob.ar/alturas/index.php . Respondió **HTTP 200 en 319 ms**. El adaptador seleccionó exclusivamente SANTA FE / PARANA.

| Campo | Resultado |
| --- | --- |
| Altura | 5,48 m |
| Observación | 12/11/2026, 22:00 h, Argentina |
| Lectura anterior | 5,47 m, 12/11/2026, 20:00 h |
| Tendencia | Creciendo; la tabla publica ALERTA CRECE |
| Variación calculada y publicada | +1 cm |
| Período calculado y publicado | 2 horas; no 24 horas |
| Alerta | 5,30 m, en la tabla PNA |
| Evacuación | 5,70 m, en la tabla PNA |
| Respaldo INA recibido en la misma consulta | 5,39 m, observación del 12/11/2026 a las 00:00 h de Argentina |
| Fuente INA | https://alerta.ina.gob.ar/a5/getObservaciones?tipo=puntual&series_id=30 |

La lectura PNA se seleccionó por ser posterior a la observación INA. El valor INA permanece disponible como registro adicional. La diferencia de 9 cm corresponde a horarios distintos y no se trata como un error del INA.

En esa misma consulta, FICH devolvió Santo Tomé: 5,41 m, 09:26 h; Recreo (Ruta 70): 2,47 m, 09:25 h, ambos del 12/11/2026. Las tres estaciones siguen funcionando. El INA se mantiene como fuente de informes y pronósticos.

## Diferencias entre entornos

| Entorno | Comprobación |
| --- | --- |
| Codex, ejecución restringida | `fetch` de index.php falla en 121 ms con causa `EACCES`; es un permiso del entorno de ejecución. |
| Equipo Windows con salida autorizada | `/alturas/` responde 200 en 358 ms y `/alturas/index.php` responde 200 en 226 ms. Mismo contenido y fila válida. |
| Servidor local con el código nuevo | HTTP 200 en 319 ms; selección PNA correcta; segunda consulta utiliza caché. |
| Producción existente | El endpoint consultado devolvió el diagnóstico anterior de timeout. El código publicado aborta a los 7 segundos y no conserva la causa de red subyacente. |
| Vista previa Vercel con el código nuevo | `UND_ERR_CONNECT_TIMEOUT`, 10.244 ms, etapa `response_headers`, `httpStatus: null`; el presupuesto de aplicación era 15.000 ms. No se recibió respuesta HTTP. |

La prueba Vercel usa la URL exacta `index.php`. **Cambiar la URL no resolvió el problema de conexión desde Vercel.** No se observó un 403 ni 404, ni un fallo de parsing en esa prueba. El código es un timeout de establecimiento de conexión de Undici. No se comprobó que la causa fuera una política de bloqueo, una restricción del origen o un problema de ruta; no se atribuye una causa no verificada. No hay una solicitud del navegador a Prefectura: se consulta desde el backend.

En la vista previa Vercel el respaldo INA funcionó realmente: devolvió 5,39 m del 12/11/2026 a las 00:00 h, con alerta 5,30 m y evacuación 5,70 m. FICH mantuvo las dos estaciones del Salado.

No se cambiaron regiones, no se configuraron proxies, no se desactivó TLS y no se intentó eludir un bloqueo de acceso.

## Consulta y validación

No se encontró una API pública documentada de PNA para este recurso en la revisión del sitio y búsquedas sobre dominios oficiales. Esto no demuestra que no exista una interfaz no publicada. No se inventaron endpoints ni se integraron retransmisores externos.

Se usa la tabla HTML pública oficial desde el backend. Se identifica la fila por ambos nombres exactos y se prefieren las etiquetas `data-label` de las celdas para resistir cambios de orden. No se usa coincidencia parcial con ciudades como San Javier (Santa Fe), ni con Santo Tomé del río Uruguay.

El lector valida valores, fechas, horas, estación y orden cronológico. Obtiene también estado, variación y período publicados. Calcula la variación y el intervalo entre las dos observaciones; si los metadatos publicados difieren, conserva ambos y muestra una advertencia. Las horas de PNA se interpretan como hora argentina UTC−03; la tabla no publica un offset explícito. Se conserva la fuente PNA de los umbrales cuando fueron extraídos de su tabla.

El diagnóstico registra categoría de error, código, estado HTTP cuando existe, etapa y duración. Un timeout no se convierte en la afirmación de que el sitio oficial está caído.

## Caché y frecuencia

- Caché propio del backend PNA de **15 minutos**, separado del caché HTTP del reporte. Incluye fallas para no reintentar por cada visitante.
- Agrupación de consultas simultáneas en cada proceso mediante una única promesa en curso.
- En Vercel se usa el Runtime Cache regional del proyecto, mediante el paquete oficial `@vercel/functions`; en desarrollo se usa memoria del proceso.
- Se conserva en el caché compartido la última lectura válida por hasta siete días, siempre con su fecha original. Su antigüedad y condición de lectura conservada se muestran al usarla.
- Si la lectura del caché compartido falla, el adaptador no consulta PNA y mantiene el respaldo INA. No se agrega un servicio de datos externo.
- El reloj de la consulta de la aplicación, el último intento a PNA y la fecha de observación son campos diferentes.

La prueba local real mostró `cacheHit: false` en la primera consulta y `true` en la segunda, manteniendo el mismo `sourceCheckedAt`. La prueba Vercel repitió el reporte con una clave HTTP distinta: cambió `checkedAt` del reporte, pero mantuvo el intento PNA de las 23:55:53 y devolvió `cacheHit: true`, sin reintentar la conexión oficial. Así se verificó el caché con tráfico real y también para fallas.

El Runtime Cache es regional y efímero, según su documentación; no ofrece una operación de bloqueo distribuido en la API usada. Se agrupan solicitudes dentro del proceso y se comparte el snapshot entre instancias. Tras una expulsión del caché o un vencimiento simultáneo pueden coincidir primeras consultas de distintos procesos: no se afirma un máximo global estricto de una solicitud por intervalo. No se incorporó un planificador, una base de datos ni un servicio externo para imponer ese límite.

Referencia de la API de caché: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package . No se imprime ni guarda en el diagnóstico ninguna credencial de Vercel.

## Presentación

Se ajustaron solamente el resumen de ríos y las mediciones del panel hídrico: icono de río, tarjetas, altura destacada, separador, tendencia, período, estado y fecha/fuente verificables. Se mantienen Paraná–Puerto de Santa Fe, Salado–Santo Tomé y Salado–Recreo (Ruta 70); no se agrega Coronda. No se trasladaron al código las cifras ilustrativas de la imagen.

El encabezado, introducción, avisos de independencia, emergencias, El Niño, novedades, reporte, navegación y PWA no fueron rediseñados. El control visual del navegador sigue indisponible en esta sesión; no se afirma una inspección mediante capturas en celular o escritorio. Sí se verificaron estructura e interacciones mediante pruebas DOM.

## Validación y autorización posterior

- 42 pruebas automáticas correctas, incluidas validación de períodos, lectura por etiquetas, caché compartido, concurrencia, caché de fallas, diagnóstico y navegación.
- Servidor local y respaldo INA probados con fuentes reales.
- Vista previa Vercel protegida creada únicamente para diagnóstico: https://litoral-7ft9au3u4-fernandoproyects.vercel.app . Despliegue `dpl_HMYX6H1Zs93wu8GZnehmUbUxBgwi`, sin asignar el dominio de producción.
- El diagnóstico se completó inicialmente **sin push ni despliegue en producción**. El 13/11/2026 el usuario autorizó posteriormente subir estos cambios a GitHub y desplegarlos; los resultados de las pruebas de red de esta nota corresponden a la etapa diagnóstica.
- La conexión directa PNA desde Vercel **continúa sin funcionar en la prueba real**. El ajuste mejora lectura, validación, diagnóstico y caché; no se presenta como una solución comprobada al problema de red del alojamiento.

Evidencias locales: `.local-research/pna-diagnostics-before.json`, `pna-local-result.json`, `pna-local-full-report.json`, `pna-preview-first.json` y `pna-preview-second.json`. Las evidencias no forman parte de los archivos publicados.

Archivos de esta revisión: `api/reporte.js`, `lib/hydrometry.cjs`, `lib/prefectura.cjs` (nuevo), `lib/reports.cjs`, `hydro.js`, `index.html`, `styles.css`, `package.json`, `package-lock.json`, `tests/prefectura.test.cjs` (nuevo), `tests/interface.test.cjs` y este informe.
