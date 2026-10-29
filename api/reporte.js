
 // AL SALADO: agregar una sola vez al final de lib/reports.cjs
const collectOriginalSalado = module.exports.collect;

module.exports.collect = async function (opciones = {}) {
  const reporte = await collectOriginalSalado(opciones);
  const obtener = opciones.fetcher || get;
  const ahora = opciones.now || new Date();

  const estaciones = [
    ['Santo Tomé', 'https://fich.unl.edu.ar/cim/rios/historico/6'],
    ['Recreo · Ruta 70', 'https://fich.unl.edu.ar/cim/rios/historico/5']
  ];

  const resultados = await Promise.all(estaciones.map(async ([nombre, url]) => {
    try {
      const html = await obtener(url);
      const limite = (strip(html).match(/Nivel de alerta\s*:\s*(\d+[,.]\d+)\s*m/i) || [])[1];
      const alerta = num(limite);
      const registros = [];

      for (const c of rows(html)) {
        const fecha = String(c[0] || '').match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
        const hora = String(c[1] || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!fecha || !hora) continue;

        const altura = num(c[2]);
        const anterior = num(c[5]);
        if (altura === null) continue;

        const instante = day(
          `${fecha[3]}-${fecha[2]}-${fecha[1]}T${hora[1].padStart(2, '0')}:${hora[2]}:00-03:00`
        );
        if (!instante) continue;

        const variacion = Number(String(c[3] || '').replace(',', '.'));
        const tendencia = Number.isFinite(variacion)
          ? (variacion > 0 ? 'crece' : variacion < 0 ? 'baja' : 'estable')
          : (anterior === null ? null : altura > anterior ? 'crece' : altura < anterior ? 'baja' : 'estable');

        registros.push({
          river: 'Salado',
          station: nombre,
          value: altura,
          previous: anterior,
          trend: tendencia,
          observedAt: instante,
          source: url,
          alertThreshold: alerta,
          evacuationThreshold: null,
          alertType: 'técnica'
        });
      }

      registros.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      return { nombre, url, valor: registros[0] || null, error: null };

    } catch (error) {
      return {
        nombre, url, valor: null,
        error: String(error.message || error).slice(0, 100)
      };
    }
  }));

  reporte.stations ||= [];
  reporte.sources ||= [];
  reporte.fetched ||= {};
  reporte.sourceChecks ||= [];

  let huboDatos = false;

  for (const r of resultados) {
    reporte.sourceChecks.push({
      name: `FICH ${r.nombre}`,
      ok: !!r.valor,
      detail: r.error || (r.valor ? 'Lectura recuperada' : 'No hay filas interpretables')
    });

    reporte.sources.push({
      name: `FICH-UNL · Río Salado · ${r.nombre}`,
      url: r.url
    });

    if (!r.valor) continue;
    huboDatos = true;

    const actual = reporte.stations.find(
      x => x.river === 'Salado' && x.station === r.nombre
    );

    const actualFecha = new Date(
      actual?.observedAt || actual?.reportedOn || 0
    ).getTime();
    const nuevaFecha = new Date(r.valor.observedAt).getTime();

    if (actual && actualFecha >= nuevaFecha) continue;

    const edad = dateAgeHours(r.valor.observedAt, ahora);
    const agregado = {
      ...r.valor,
      ageHours: edad,
      stale: edad === null || edad > 72
    };

    if (actual) {
      reporte.stations.splice(
        reporte.stations.indexOf(actual), 1, agregado
      );
    } else {
      reporte.stations.push(agregado);
    }
  }

  reporte.fetched.fichSalado = huboDatos;
  reporte.saladoStationsFound = reporte.stations.filter(
    x => x.river === 'Salado'
  ).length;

  if (reporte.stations.length) {
    reporte.status = 'partial_or_available';
  }

  reporte.reportId = createHash('sha256')
    .update(JSON.stringify(reporte.stations))
    .digest('hex')
    .slice(0, 12);

  return reporte;
};
