document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. CONFIGURACIÓN
    // ==========================================
    // Versión 1: datos fijos. En la versión 2 vendrán del acceso del usuario.
    const DATOS_USUARIO = { nombre: 'DIEGO', dni: '00000000' };

    const CLAVE_REGISTROS = 'control_extras_registros';
    const CLAVE_CONFIG = 'control_extras_config';
    const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
    const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

    const $ = (id) => document.getElementById(id);

    const inputBasico = $('inputBasico');
    const selectAsignacion = $('selectAsignacion');
    const grupoMontoAsignacion = $('grupoMontoAsignacion');
    const inputMontoAsignacion = $('inputMontoAsignacion');
    const inputMultiplicadorFeriado = $('inputMultiplicadorFeriado');
    const txtValorHora = $('txtValorHora');
    const selectMes = $('selectMes');
    const selectTipoDia = $('selectTipoDia');
    const selectEstadoDia = $('selectEstadoDia');
    const bloqueHorariosYExtra = $('bloqueHorariosYExtra');
    const avisoExtra = $('avisoExtra');
    const formRegistro = $('formRegistro');
    const tablaCuerpo = $('tablaCuerpo');

    // ==========================================
    // 1. DATOS GUARDADOS (LOCALSTORAGE)
    // ==========================================
    let registros = [];
    try {
        registros = JSON.parse(localStorage.getItem(CLAVE_REGISTROS)) || [];
    } catch (e) {
        registros = [];
    }

    function guardarConfig() {
        const config = {
            basico: inputBasico.value,
            asignacion: selectAsignacion.value,
            montoAsignacion: inputMontoAsignacion.value,
            multiplicador: inputMultiplicadorFeriado.value
        };
        localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config));
    }

    function aplicarConfig(config) {
        if (!config) return;
        inputBasico.value = config.basico ?? inputBasico.value;
        selectAsignacion.value = config.asignacion ?? 'no';
        inputMontoAsignacion.value = config.montoAsignacion ?? inputMontoAsignacion.value;
        inputMultiplicadorFeriado.value = config.multiplicador ?? inputMultiplicadorFeriado.value;
        grupoMontoAsignacion.style.display = selectAsignacion.value === 'si' ? 'block' : 'none';
    }

    try {
        aplicarConfig(JSON.parse(localStorage.getItem(CLAVE_CONFIG)));
    } catch (e) { /* config dañada: se usan los valores por defecto */ }

    // ==========================================
    // 2. FORMULARIO: HORAS Y ESTADOS
    // ==========================================
    // Autoformato 24h: solo números y los dos puntos solos
    ['inputNormInicio', 'inputNormFin', 'inputExtraInicio', 'inputExtraFin'].forEach((id) => {
        $(id).addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 2) v = v.substring(0, 2) + ':' + v.substring(2, 4);
            e.target.value = v;
        });
    });

    selectEstadoDia.addEventListener('change', () => {
        bloqueHorariosYExtra.style.display = selectEstadoDia.value === 'descanso' ? 'none' : 'block';
    });

    // En feriado las horas extras son opcionales
    selectTipoDia.addEventListener('change', () => {
        avisoExtra.textContent = selectTipoDia.value === 'Feriado' ? '(opcional)' : '(obligatorio)';
    });

    // ==========================================
    // 3. CÁLCULOS
    // ==========================================
    function calcularValorHora() {
        const basico = parseFloat(inputBasico.value) || 0;
        const asignacion = selectAsignacion.value === 'si' ? (parseFloat(inputMontoAsignacion.value) || 0) : 0;
        const valorHora = (basico + asignacion) / 240;
        txtValorHora.textContent = `Valor de tu hora: S/ ${valorHora.toFixed(2)}`;
        return valorHora;
    }

    function calcularDiferenciaHoras(inicio, fin) {
        const [hI, mI] = inicio.split(':').map(Number);
        const [hF, mF] = fin.split(':').map(Number);
        const minInicio = hI * 60 + mI;
        let minFin = hF * 60 + mF;
        if (minFin <= minInicio) minFin += 24 * 60; // cruza medianoche
        return parseFloat(((minFin - minInicio) / 60).toFixed(2));
    }

    // El pago se calcula al mostrar, así un cambio de sueldo se refleja en todos los días
    function pagoDe(reg, valorHora) {
        const mult = parseFloat(inputMultiplicadorFeriado.value) || 2;
        return (reg.h25 || 0) * valorHora * 1.25
            + (reg.h35 || 0) * valorHora * 1.35
            + (reg.hFeriado || 0) * valorHora * mult;
    }

    // ==========================================
    // 4. GUARDAR UN DÍA
    // ==========================================
    formRegistro.addEventListener('submit', (e) => {
        e.preventDefault();

        const fecha = $('inputFecha').value;
        const esFeriado = selectTipoDia.value === 'Feriado';
        const esDescanso = selectEstadoDia.value === 'descanso';
        const zona = $('inputZona').value.trim();
        const normInicio = $('inputNormInicio').value;
        const normFin = $('inputNormFin').value;
        const extraInicio = $('inputExtraInicio').value;
        const extraFin = $('inputExtraFin').value;
        const observacion = $('inputObs').value.trim();

        if (!fecha) {
            alert('Por favor selecciona una fecha.');
            return;
        }

        let hExtras = 0, h25 = 0, h35 = 0, hFeriado = 0;
        let horarioExtra = '';

        if (!esDescanso) {
            if (!REGEX_HORA.test(normInicio) || !REGEX_HORA.test(normFin)) {
                alert('El turno normal debe tener horas válidas en formato 24 h (ej. 07:00).');
                return;
            }

            const hayExtra = extraInicio !== '' || extraFin !== '';

            if (hayExtra) {
                if (!REGEX_HORA.test(extraInicio) || !REGEX_HORA.test(extraFin)) {
                    alert('Completa inicio y fin de las horas extras con formato 24 h (ej. 15:00).');
                    return;
                }
                hExtras = calcularDiferenciaHoras(extraInicio, extraFin);
                if (hExtras > 6) hExtras -= 1; // descuento de refrigerio

                if (esFeriado) {
                    hFeriado = hExtras;
                } else {
                    h25 = Math.min(hExtras, 2);
                    h35 = Math.max(hExtras - 2, 0);
                }
                horarioExtra = `${extraInicio} – ${extraFin}`;
            } else if (!esFeriado) {
                alert('Ingresa el horario de las horas extras. Solo en feriado son opcionales.');
                return;
            }
        }

        // Un solo registro por fecha
        registros = registros.filter((r) => r.fecha !== fecha);

        let obsFinal = observacion;
        if (esDescanso && !obsFinal) obsFinal = 'Día de descanso';
        if (!esDescanso && esFeriado && !obsFinal) obsFinal = 'Feriado';

        registros.push({
            id: Date.now(),
            fecha,
            zona: esDescanso ? 'DESCANSO' : (zona || '-'),
            horarioNormal: esDescanso ? '-' : `${normInicio} – ${normFin}`,
            horarioExtra: esDescanso ? 'DÍA DE DESCANSO' : horarioExtra,
            totalHoras: hExtras,
            h25, h35, hFeriado,
            esDescanso,
            esFeriado,
            observacion: obsFinal
        });

        guardarYActualizar();
        formRegistro.reset();
        bloqueHorariosYExtra.style.display = 'block';
        avisoExtra.textContent = '(obligatorio)';
    });

    // ==========================================
    // 5. TABLA Y RESUMEN
    // ==========================================
    function guardarYActualizar() {
        localStorage.setItem(CLAVE_REGISTROS, JSON.stringify(registros));
        recalcularTodo();
    }

    function recalcularTodo() {
        calcularValorHora();
        renderizarTabla();
        actualizarResumen();
    }

    function celda(texto, colspan) {
        const td = document.createElement('td');
        td.textContent = texto;
        if (colspan) td.colSpan = colspan;
        return td;
    }

    function renderizarTabla() {
        tablaCuerpo.innerHTML = '';
        const [anio, mes] = selectMes.value.split('-').map(Number);
        const totalDias = new Date(anio, mes, 0).getDate();
        const valorHora = calcularValorHora();

        for (let dia = 1; dia <= totalDias; dia++) {
            const dd = String(dia).padStart(2, '0');
            const mm = String(mes).padStart(2, '0');
            const fechaIso = `${anio}-${mm}-${dd}`;
            const reg = registros.find((r) => r.fecha === fechaIso);
            const tr = document.createElement('tr');

            tr.appendChild(celda(`${dd}/${mm}/${anio}`));

            if (!reg) {
                for (let i = 0; i < 6; i++) tr.appendChild(celda(''));
            } else {
                if (reg.esDescanso) {
                    const td = celda('DÍA DE DESCANSO', 4);
                    td.style.fontWeight = 'bold';
                    tr.appendChild(td);
                } else {
                    tr.appendChild(celda(reg.zona || ''));
                    tr.appendChild(celda(reg.horarioNormal || ''));
                    tr.appendChild(celda(reg.horarioExtra || ''));
                    tr.appendChild(celda(reg.totalHoras > 0 ? `${reg.totalHoras} h (S/ ${pagoDe(reg, valorHora).toFixed(2)})` : ''));
                }
                tr.appendChild(celda(reg.observacion || ''));

                const tdBtn = document.createElement('td');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-quitar';
                btn.textContent = 'X';
                btn.dataset.fecha = reg.fecha;
                tdBtn.appendChild(btn);
                tr.appendChild(tdBtn);
            }
            tablaCuerpo.appendChild(tr);
        }
    }

    // Un solo listener para todos los botones de eliminar
    tablaCuerpo.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-quitar');
        if (!btn) return;
        registros = registros.filter((r) => r.fecha !== btn.dataset.fecha);
        guardarYActualizar();
    });

    function actualizarResumen() {
        const valorHora = calcularValorHora();
        let soles = 0, horas = 0, t25 = 0, t35 = 0, tFer = 0;

        // Solo los registros del mes elegido
        registros
            .filter((r) => !r.esDescanso && r.fecha.startsWith(selectMes.value))
            .forEach((r) => {
                soles += pagoDe(r, valorHora);
                horas += r.totalHoras || 0;
                t25 += r.h25 || 0;
                t35 += r.h35 || 0;
                tFer += r.hFeriado || 0;
            });

        $('lblTotalSoles').textContent = `S/ ${soles.toFixed(2)}`;
        $('lblTotalHoras').textContent = `${horas.toFixed(1)} h extras este mes · estimado`;
        $('lblHoras25').textContent = `${t25.toFixed(1)} h`;
        $('lblHoras35').textContent = `${t35.toFixed(1)} h`;
        $('lblHorasFeriado').textContent = `${tFer.toFixed(1)} h`;
    }

    // Eventos de configuración
    selectAsignacion.addEventListener('change', () => {
        grupoMontoAsignacion.style.display = selectAsignacion.value === 'si' ? 'block' : 'none';
        guardarConfig();
        recalcularTodo();
    });
    [inputBasico, inputMontoAsignacion, inputMultiplicadorFeriado].forEach((el) => {
        el.addEventListener('input', () => {
            guardarConfig();
            recalcularTodo();
        });
    });
    selectMes.addEventListener('change', recalcularTodo);

    // ==========================================
    // 6. EXPORTAR (EXCEL Y PDF COMPARTEN LA MISMA TABLA)
    // ==========================================
    function esc(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function tablaReporte() {
        const [anio, mes] = selectMes.value.split('-').map(Number);
        const totalDias = new Date(anio, mes, 0).getDate();
        const td = 'style="text-align:center;"';
        let sumaHoras = 0;
        let filas = '';

        for (let dia = 1; dia <= totalDias; dia++) {
            const dd = String(dia).padStart(2, '0');
            const fechaIso = `${anio}-${String(mes).padStart(2, '0')}-${dd}`;
            const fechaTxt = `${dd}-${MESES_CORTOS[mes - 1]}-${String(anio).slice(-2)}`;
            const reg = registros.find((r) => r.fecha === fechaIso);

            if (reg && reg.esDescanso) {
                filas += `<tr><td ${td}>${fechaTxt}</td><td colspan="4" ${td}><b>DÍA DE DESCANSO</b></td><td>${esc(reg.observacion) || '-'}</td></tr>`;
            } else if (reg) {
                sumaHoras += reg.totalHoras || 0;
                filas += `<tr><td ${td}>${fechaTxt}</td><td ${td}>${esc(reg.zona) || '-'}</td><td ${td}>${esc(reg.horarioNormal) || '-'}</td><td ${td}>${esc(reg.horarioExtra) || '-'}</td><td ${td}>${reg.totalHoras > 0 ? reg.totalHoras + ' h' : '-'}</td><td>${esc(reg.observacion) || '-'}</td></tr>`;
            } else {
                filas += `<tr><td ${td}>${fechaTxt}</td><td></td><td></td><td></td><td></td><td></td></tr>`;
            }
        }

        return `
            <table border="1" style="border-collapse:collapse; width:100%;">
                <tr style="background-color:#ff0037; color:white; text-align:center;">
                    <th colspan="6">REGISTRO Y CONTROL DE HORAS EXTRAS - DEL 01 AL ${totalDias} DE ${MESES[mes - 1]} DEL ${anio}</th>
                </tr>
                <tr style="font-weight:bold;">
                    <td colspan="4">APELLIDOS Y NOMBRES: ${esc(DATOS_USUARIO.nombre)}</td>
                    <td colspan="2">DNI: ${esc(DATOS_USUARIO.dni)}</td>
                </tr>
                <tr style="background-color:#f1f3f5; font-weight:bold; text-align:center;">
                    <th>FECHA</th><th>ZONA -BASE</th><th>HORARIO NORMAL</th><th>HORARIO EXTRA EN ZONA</th><th>TOTAL DE HORAS EXTRAS</th><th>OBSERVACIÓN</th>
                </tr>
                ${filas}
                <tr style="font-weight:bold; background-color:#f8fafc;">
                    <td ${td}>TOTAL</td><td></td><td></td><td></td><td ${td}>${sumaHoras > 0 ? sumaHoras + ' h' : ''}</td><td></td>
                </tr>
                <tr style="height:50px;"><td colspan="6" style="border:none;"></td></tr>
                <tr>
                    <td colspan="3" ${td}><b>Vº Bº COORDINADOR</b></td>
                    <td colspan="3" ${td}><b>PROCURADOR</b></td>
                </tr>
            </table>`;
    }

    $('btnExportarExcel').addEventListener('click', () => {
        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"></head>
            <body>${tablaReporte()}</body></html>`;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        descargar(blob, `Control_Horas_Extras_${selectMes.value}.xls`);
    });

    $('btnExportarPdf').addEventListener('click', () => {
        const ventana = window.open('', '_blank');
        if (!ventana) {
            alert('Tu navegador bloqueó la ventana. Permite ventanas emergentes para este sitio e inténtalo de nuevo.');
            return;
        }
        ventana.document.write(`
            <html><head><title>Control de Horas Extras</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 15px; color: #000; }
                table { font-size: 10px; }
                th, td { padding: 4px; }
            </style></head>
            <body>${tablaReporte()}</body></html>`);
        ventana.document.close();
        ventana.focus();
        setTimeout(() => ventana.print(), 500);
    });

    function descargar(blob, nombre) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // 7. COPIA DE SEGURIDAD
    // ==========================================
    $('btnDescargarCopia').addEventListener('click', () => {
        const copia = {
            registros,
            config: JSON.parse(localStorage.getItem(CLAVE_CONFIG)) || {}
        };
        const blob = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' });
        const hoy = new Date().toISOString().slice(0, 10);
        descargar(blob, `copia_horas_extras_${hoy}.json`);
    });

    $('btnCargarCopia').addEventListener('click', () => {
        const selector = document.createElement('input');
        selector.type = 'file';
        selector.accept = '.json,application/json';

        selector.addEventListener('change', () => {
            const archivo = selector.files[0];
            if (!archivo) return;

            const lector = new FileReader();
            lector.onload = () => {
                try {
                    const datos = JSON.parse(lector.result);
                    if (!Array.isArray(datos.registros)) throw new Error('formato');
                    if (!confirm('Esto reemplazará los datos actuales de este dispositivo. ¿Continuar?')) return;

                    registros = datos.registros;
                    if (datos.config) {
                        localStorage.setItem(CLAVE_CONFIG, JSON.stringify(datos.config));
                        aplicarConfig(datos.config);
                    }
                    guardarYActualizar();
                    alert('Copia cargada correctamente.');
                } catch (err) {
                    alert('El archivo no es una copia válida.');
                }
            };
            lector.readAsText(archivo);
        });

        selector.click();
    });

    // ==========================================
    // 8. INICIO
    // ==========================================
    recalcularTodo();
});