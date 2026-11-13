# Mejora hídrica — 12/11/2026

Repositorio recuperado: https://github.com/ferallena85-ui/alerta-litoral

Publicación autorizada posteriormente por el usuario: https://litoral-rio.vercel.app . Despliegue directo desde la copia local con Vercel CLI. El usuario también autorizó subir los cambios al repositorio GitHub. Versión publicada: `dpl_CGuqLCJHDxUjSEfW7Ho76u9aEEFa`, estado READY.

Verificación de producción: portada y API responden HTTP 200. Los históricos FICH funcionan. Prefectura agotó el tiempo de espera desde Vercel en las consultas de prueba; el respaldo INA permanece disponible con sus umbrales. No se afirma disponibilidad continua de Prefectura en producción.

## Portada y funciones

Se conserva el encabezado, la introducción original completa, el aviso de independencia y el botón de informes. Se agrega el resumen siempre visible de Paraná–Puerto de Santa Fe, Salado–Santo Tomé y Salado–Recreo (Ruta 70). Emergencias queda contraído y conserva Protección Civil, SMN y COBEM. Luego aparecen última consulta, Situación en Santa Fe y el panel hídrico abierto. Las otras tarjetas comienzan cerradas.

El panel ofrece Estado actual, Evolución con gráficos y tablas accesibles, Pronóstico INA y Fuentes y actualizaciones. Las estaciones adicionales, referencias provinciales, cotas y escalas visuales anteriores siguen disponibles en el detalle. Se mantienen El Niño, novedades, último reporte, navegación, compartir e instalación PWA.

Las nuevas vistas usan el mismo resultado de `/api/reporte`; no hacen solicitudes propias a los organismos. Se conserva un único temporizador de cinco minutos y el bloqueo de solicitudes simultáneas. Sigue vigente el caché HTTP de hasta quince minutos del endpoint. La hora del servidor que efectivamente consultó las fuentes se mantiene separada de las observaciones.

## Fuentes verificadas e integradas

- **Nueva: Prefectura Naval Argentina, tabla pública de alturas**: https://contenidosweb.prefecturanaval.gob.ar/alturas/ . Se verificó HTTP 200 y una fila Santa Fe / Paraná con observación, lectura anterior, sus dos fechas y umbrales. Se interpreta la hora de la tabla en Argentina (UTC−03); la tabla no incluye un offset explícito. No se encontró una API pública documentada que garantice estabilidad. El adaptador HTML valida la fila exacta y rechaza datos ausentes o inválidos. Sustituye la consulta a RíoAlert y el contraste con una portada sin hora, que existían en el código original.
- **FICH-UNL, históricos del Salado**: https://cim.fich.unl.edu.ar/rios/6/historico y https://cim.fich.unl.edu.ar/rios/5/historico . Se verificaron HTTP 200, encabezados de estación, horas reales y series históricas. Se corrigieron enlaces antiguos que respondían 404. Se mantiene también el parte provincial y sus advertencias.
- **INA**: se conservan el mapa, parte diario, consultas existentes de observaciones, informes y pronóstico. Cuando otra fuente aporta una observación más reciente, las lecturas INA quedan en los registros adicionales de la estación.
- **Copernicus Argentina**: se investigó la página https://copernicus.com.ar/rio/santa-fe y sus términos https://copernicus.com.ar/terminos/ . Los datasets con DOI permiten reutilización con atribución, pero sus API y la reutilización sistemática de los tableros requieren un acuerdo escrito. No se integró Copernicus ni se copió su código o presentación.

## Selección y fallas

El selector admite solamente identidades exactas de río y estación. Compara observaciones con sus horas reales, rechaza pronósticos y fechas futuras más allá de cinco minutos de tolerancia, y valida valores y fechas. Los adaptadores de INA rechazan series identificadas que no corresponden al ID esperado y registros sin zona horaria. Los partes con día pero sin hora se muestran como partes; no desplazan una observación con hora del mismo día.

Se conservan las alternativas de las fuentes, la variación respecto de la lectura anterior y el intervalo cuando existe su horario. Nunca se atribuye una variación a 24 horas sin respaldo. Diferencias de al menos 20 cm entre fuentes con hasta una hora de separación quedan marcadas para revisión: es un criterio de control, no un umbral oficial. No se crea un nivel de vigilancia porcentual ni se inventa cota de evacuación del Salado.

Si una fuente falla, se usa la lectura válida más reciente disponible. Hay retención en memoria del proceso y en almacenamiento local del navegador. Los datos mayores de 72 horas y las referencias históricas se señalan explícitamente; una lectura conservada conserva su fecha. El almacenamiento del servidor es efímero y no se agregó una base de datos: un proceso nuevo sin fuentes y un navegador sin datos guardados pueden mostrar solamente las referencias históricas existentes o ausencia de lectura.

## Pronóstico y límites pendientes

Se mantienen el texto del parte diario del INA, su fecha y el enlace oficial. Se incorpora el gráfico oficial de Santa Fe, publicado desde el propio reporte: https://alerta.ina.gob.ar/ina/08-PRONOSTICOS/graficos/santa_fe.png . Allí se consultan las curvas observadas, previstas, fechas e incertidumbre. La fecha del parte no se presenta como emisión confirmada de cada proyección.

No se agregó una extracción numérica de proyecciones semanales ni una resta automática entre nivel observado y previsto: falta verificar una fuente estructurada estable con la emisión y fechas objetivo. No se usan los valores de la imagen como datos fijos ni se transcriben cifras de un gráfico a mano. El gráfico remoto puede actualizarse independientemente del caché del reporte; se consulta directamente al INA y se ofrece el enlace oficial si falla.

La adaptación CSS contempla teléfono y escritorio, pero **queda pendiente la inspección visual en ambos tamaños**: el host de acceso al navegador estuvo indisponible. No se generaron capturas ni se afirmó verificación visual. La PWA y la instalación requieren además una comprobación en dispositivo después de una eventual publicación autorizada.

## Validación

- `node --test tests/*.test.cjs`: 34 pruebas correctas (22 existentes y 12 nuevas), incluida regresión de los umbrales al usar el respaldo INA.
- Sintaxis validada con `node --check` para cliente, adaptadores, servidor local y service worker. Proyecto estático: no tiene etapa de compilación.
- Pruebas DOM: introducción, orden, tres estaciones, desplegables iniciales, pestañas, ausencia de consultas al navegar y conservación de altura/fecha/fuente ante una falla.
- Consulta real de `/api/reporte` mediante `buildReport`: Prefectura y ambos históricos FICH interpretados correctamente, con INA como alternativa y series para gráficos. Algunas consultas INA alternativas y SMN pueden fallar o devolver contenido vacío; se informan en el diagnóstico.
- Comprobación HTTP local: portada, JavaScript, CSS, manifiesto, `/api/reporte` y `/api/novedades` respondieron 200; ambos endpoints devolvieron JSON versión 1. Servidor de prueba cerrado al terminar.

## Archivos

Modificados: `index.html`, `styles.css`, `app.js`, `api/reporte.js`, `lib/reports.cjs`, `sw.js`, `local-server.js` y `package.json`.

Agregados: `hydro.js`, `lib/hydrometry.cjs`, `tests/hydrometry.test.cjs`, `tests/interface.test.cjs`, `package-lock.json`, `.gitignore` y este documento. `linkedom` es una dependencia de desarrollo para las pruebas DOM, sin dependencias nuevas en el cliente publicado.

El servidor local ahora atiende también `/api/novedades`, que antes devolvía 404 en desarrollo.

Para revisar localmente desde esta carpeta: `npm.cmd run dev`, luego abrir http://localhost:3000 . Para pruebas: `npm.cmd test`. La ejecución local necesita salida a Internet para las fuentes públicas.
