document.addEventListener('DOMContentLoaded', () => {
    console.log("Módulo de Horas Extras y Lógica avanzado iniciado correctamente 🚀");

    // ==========================================
    // 1. SELECTORES DE ELEMENTOS DEL DOM
    // ==========================================
    const inputBasico = document.getElementById('inputBasico');
    const selectAsignacion = document.getElementById('selectAsignacion');
    const grupoMontoAsignacion = document.getElementById('grupoMontoAsignacion');
    const inputMontoAsignacion = document.getElementById('inputMontoAsignacion');
    const inputMultiplicadorFeriado = document.getElementById('inputMultiplicadorFeriado');
    const txtValorHora = document.getElementById('txtValorHora');
    const selectMes = document.getElementById('selectMes');

    const formRegistro = document.getElementById('formRegistro');
    const tablaCuerpo = document.getElementById('tablaCuerpo');

    const lblTotalSoles = document.getElementById('lblTotalSoles');
    const lblTotalHoras = document.getElementById('lblTotalHoras');
    const lblHoras25 = document.getElementById('lblHoras25');
    const lblHoras35 = document.getElementById('lblHoras35');
    const lblHorasFeriado = document.getElementById('lblHorasFeriado');

    const btnExportarExcel = document.getElementById('btnExportarExcel');
    const btnExportarPdf = document.getElementById('btnExportarPdf');

    // Elementos para el manejo de Descanso
    const selectEstadoDia = document.getElementById('selectEstadoDia');
    const bloqueHorariosYExtra = document.getElementById('bloqueHorariosYExtra');

    // ==========================================
    // 2. RECUPERAR DATOS GUARDADOS (LOCALSTORAGE)
    // ==========================================
    let registros = JSON.parse(localStorage.getItem('control_extras_registros')) || [];

    // ==========================================
    // 3. AUTOCOMPLETAR HORA (FORMATO 24H TEXTO)
    // ==========================================
    const inputsHora = [
        document.getElementById('inputNormInicio'),
        document.getElementById('inputNormFin'),
        document.getElementById('inputExtraInicio'),
        document.getElementById('inputExtraFin')
    ];

    inputsHora.forEach(input => {
        if (!input) return;
        input.addEventListener('input', (e) => {
            let valor = e.target.value.replace(/\D/g, ''); // Solo números
            if (valor.length > 2) {
                valor = valor.substring(0, 2) + ':' + valor.substring(2, 4);
            }
            e.target.value = valor;
        });
    });

    // ==========================================
    // 3.1 CONTROL VISUAL DE ESTADO (DESCANSO VS TURNO)
    // ==========================================
    if (selectEstadoDia && bloqueHorariosYExtra) {
        selectEstadoDia.addEventListener('change', (e) => {
            if (e.target.value === 'descanso') {
                bloqueHorariosYExtra.style.display = 'none';
            } else {
                bloqueHorariosYExtra.style.display = 'block';
            }
        });
    }

    // ==========================================
    // 4. LÓGICA DE ASIGNACIÓN FAMILIAR Y VALOR HORA
    // ==========================================
    selectAsignacion.addEventListener('change', (e) => {
        if (e.target.value === 'si') {
            grupoMontoAsignacion.style.display = 'block';
        } else {
            grupoMontoAsignacion.style.display = 'none';
            inputMontoAsignacion.value = 0;
        }
        recalcularTodo();
    });

    function calcularValorHora() {
        const basico = parseFloat(inputBasico.value) || 0;
        const asignacion = selectAsignacion.value === 'si' ? (parseFloat(inputMontoAsignacion.value) || 0) : 0;
        
        // Fórmula oficial: (Sueldo Básico + Asignación Familiar) ÷ 240
        const valorHora = (basico + asignacion) / 240;
        txtValorHora.textContent = `Valor de tu hora: S/ ${valorHora.toFixed(2)}`;
        
        return valorHora;
    }

    inputBasico.addEventListener('input', recalcularTodo);
    inputMontoAsignacion.addEventListener('input', recalcularTodo);
    inputMultiplicadorFeriado.addEventListener('input', recalcularTodo);
    if (selectMes) {
        selectMes.addEventListener('change', recalcularTodo);
    }

    // ==========================================
    // 5. PROCESAR Y GUARDAR UN NUEVO TURNO
    // ==========================================
    formRegistro.addEventListener('submit', (e) => {
        e.preventDefault();

        const fecha = document.getElementById('inputFecha').value;
        const tipoDia = document.getElementById('selectTipoDia').value;
        const zona = document.getElementById('inputZona').value;
        const normInicio = document.getElementById('inputNormInicio').value;
        const normFin = document.getElementById('inputNormFin').value;
        const extraInicio = document.getElementById('inputExtraInicio').value;
        const extraFin = document.getElementById('inputExtraFin').value;
        
        const esDescanso = selectEstadoDia ? selectEstadoDia.value === 'descanso' : false;
        const observacion = document.getElementById('inputObs').value;

        if (!fecha) {
            alert('Por favor selecciona una fecha.');
            return;
        }

        // VALIDACIÓN: Si NO es día de descanso, las horas extras son obligatorias
        if (!esDescanso && (!extraInicio || !extraFin)) {
            alert('Por favor ingresa el horario de inicio y fin del turno extra para poder guardarlo.');
            return;
        }

        let hExtras = 0;
        let pagoTotal = 0;
        let h25 = 0;
        let h35 = 0;
        let hFeriado = 0;
        let horarioExtraStr = '';

        if (!esDescanso && extraInicio && extraFin) {
            hExtras = calcularDiferenciaHoras(extraInicio, extraFin);

            if (hExtras > 6) {
                hExtras -= 1; // Descuento de refrigerio
            }

            const valorHora = calcularValorHora();

            if (tipoDia === 'Feriado') {
                hFeriado = hExtras;
                const mult = parseFloat(inputMultiplicadorFeriado.value) || 2;
                pagoTotal = hFeriado * valorHora * mult;
            } else {
                if (hExtras <= 2) {
                    h25 = hExtras;
                    pagoTotal = h25 * (valorHora * 1.25);
                } else {
                    h25 = 2;
                    h35 = hExtras - 2;
                    pagoTotal = (2 * (valorHora * 1.25)) + (h35 * (valorHora * 1.35));
                }
            }
            horarioExtraStr = `${extraInicio} – ${extraFin}`;
        }

        // Reemplazar o actualizar si ya existe un registro en la misma fecha
        registros = registros.filter(r => r.fecha !== fecha);

        const nuevoRegistro = {
            id: Date.now(),
            fecha,
            zona: esDescanso ? 'DESCANSO' : (zona || '-'),
            horarioNormal: esDescanso ? '-' : `${normInicio} – ${normFin}`,
            horarioExtra: esDescanso ? 'DÍA DE DESCANSO' : horarioExtraStr,
            totalHoras: hExtras,
            h25,
            h35,
            hFeriado,
            pagoTotal,
            esDescanso,
            observacion: esDescanso ? (observacion || 'Día de descanso') : (observacion || (hExtras > 0 ? '-' : ''))
        };

        registros.push(nuevoRegistro);
        guardarYActualizar();
        formRegistro.reset();
        
        // Restaurar valores por defecto y re-mostrar los bloques si se ocultaron
        document.getElementById('inputNormInicio').value = "07:00";
        document.getElementById('inputNormFin').value = "15:00";
        if (bloqueHorariosYExtra) bloqueHorariosYExtra.style.display = 'block';
    });

    // ==========================================
    // 6. FUNCIONES AUXILIARES DE CÁLCULO (24H)
    // ==========================================
    function calcularDiferenciaHoras(inicio, fin) {
        const [hInicio, mInicio] = inicio.split(':').map(Number);
        const [hFin, mFin] = fin.split(':').map(Number);

        let minutosInicio = hInicio * 60 + mInicio;
        let minutosFin = hFin * 60 + mFin;

        if (minutosFin <= minutosInicio) {
            minutosFin += 24 * 60;
        }

        const diffMinutos = minutosFin - minutosInicio;
        return parseFloat((diffMinutos / 60).toFixed(2));
    }

    // ==========================================
    // 7. RENDERIZAR TABLA CON TODOS LOS DÍAS DEL MES
    // ==========================================
    function guardarYActualizar() {
        localStorage.setItem('control_extras_registros', JSON.stringify(registros));
        recalcularTodo();
    }

    function recalcularTodo() {
        calcularValorHora();
        renderizarTablaCompletaMes();
        actualizarResumen();
    }

    function renderizarTablaCompletaMes() {
        tablaCuerpo.innerHTML = '';

        const mesValue = selectMes ? selectMes.value : '2026-11';
        const [anio, mes] = mesValue.split('-').map(Number);

        const totalDiasMes = new Date(anio, mes, 0).getDate();

        for (let dia = 1; dia <= totalDiasMes; dia++) {
            const diaStr = String(dia).padStart(2, '0');
            const mesStr = String(mes).padStart(2, '0');
            const fechaIso = `${anio}-${mesStr}-${diaStr}`;
            const fechaFormateada = `${diaStr}/${mesStr}/${anio}`;

            const reg = registros.find(r => r.fecha === fechaIso);
            const tr = document.createElement('tr');

            if (reg) {
                if (reg.esDescanso) {
                    tr.innerHTML = `
                        <td>${fechaFormateada}</td>
                        <td colspan="4" style="font-weight: bold; color: var(--text-muted); background-color: #f8fafc;">DÍA DE DESCANSO</td>
                        <td>${reg.observacion}</td>
                        <td><button class="btn-quitar" type="button" data-fecha="${reg.fecha}">X</button></td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td>${fechaFormateada}</td>
                        <td>${reg.zona || ''}</td>
                        <td>${reg.horarioNormal || ''}</td>
                        <td>${reg.horarioExtra || ''}</td>
                        <td>${reg.totalHoras > 0 ? `${reg.totalHoras} h (S/ ${reg.pagoTotal.toFixed(2)})` : ''}</td>
                        <td>${reg.observacion || ''}</td>
                        <td><button class="btn-quitar" type="button" data-fecha="${reg.fecha}">X</button></td>
                    `;
                }
            } else {
                tr.innerHTML = `
                    <td>${fechaFormateada}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                `;
            }
            tablaCuerpo.appendChild(tr);
        }

        document.querySelectorAll('.btn-quitar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fechaEliminar = e.target.getAttribute('data-fecha');
                registros = registros.filter(r => r.fecha !== fechaEliminar);
                guardarYActualizar();
            });
        });
    }

    function actualizarResumen() {
        let sumaSoles = 0;
        let sumaHoras = 0;
        let total25 = 0;
        let total35 = 0;
        let totalFeriado = 0;

        registros.forEach(reg => {
            if (!reg.esDescanso) {
                sumaSoles += reg.pagoTotal;
                sumaHoras += reg.totalHoras;
                total25 += reg.h25;
                total35 += reg.h35;
                totalFeriado += reg.hFeriado;
            }
        });

        lblTotalSoles.textContent = `S/ ${sumaSoles.toFixed(2)}`;
        lblTotalHoras.textContent = `${sumaHoras.toFixed(1)} h extras este mes · estimado`;
        lblHoras25.textContent = `${total25.toFixed(1)} h`;
        lblHoras35.textContent = `${total35.toFixed(1)} h`;
        lblHorasFeriado.textContent = `${totalFeriado.toFixed(1)} h`;
    }

    // ==========================================
    // 8. EXPORTAR A EXCEL Y PDF
    // ==========================================
    if (btnExportarExcel) {
        btnExportarExcel.addEventListener('click', () => {
            if (registros.length === 0) {
                alert('No hay registros activos para exportar.');
                return;
            }

            let contenidoTabla = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta charset="UTF-8"></head>
                <body>
                    <table border="1">
                        <tr style="background-color: #ff0037; color: white; font-weight: bold; text-align: center;">
                            <th colspan="7">REGISTRO Y CONTROL DE HORAS EXTRAS</th>
                        </tr>
                        <tr style="background-color: #f1f3f5; font-weight: bold; text-align: center;">
                            <th>FECHA</th>
                            <th>ZONA-BASE</th>
                            <th>HORARIO NORMAL</th>
                            <th>HORARIO EXTRA EN ZONA</th>
                            <th>TOTAL DE H.E.</th>
                            <th>OBSERVACIÓN</th>
                            <th>PAGO ESTIMADO (S/)</th>
                        </tr>
            `;

            registros.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(reg => {
                const partesFecha = reg.fecha.split('-');
                const fechaFormateada = partesFecha.length === 3 ? `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}` : reg.fecha;

                contenidoTabla += `
                    <tr>
                        <td style="text-align: center;">${fechaFormateada}</td>
                        <td>${reg.zona}</td>
                        <td style="text-align: center;">${reg.horarioNormal}</td>
                        <td style="text-align: center;">${reg.horarioExtra}</td>
                        <td style="text-align: center;">${reg.esDescanso ? '-' : reg.totalHoras + ' h'}</td>
                        <td>${reg.observacion}</td>
                        <td style="text-align: right;">${reg.esDescanso ? 'S/ 0.00' : 'S/ ' + reg.pagoTotal.toFixed(2)}</td>
                    </tr>
                `;
            });

            contenidoTabla += `</table></body></html>`;

            const blob = new Blob([contenidoTabla], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Control_Horas_Extras.xls';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    if (btnExportarPdf) {
        btnExportarPdf.addEventListener('click', () => {
            if (registros.length === 0) {
                alert('No hay registros activos para exportar.');
                return;
            }

            let ventanaPdf = window.open('', '_blank');
            let htmlPdf = `
                <html>
                <head>
                    <title>Reporte de Horas Extras</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                        h2 { text-align: center; color: #ff0037; margin-bottom: 5px; }
                        p { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
                        th { background-color: #ff0037; color: white; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                    </style>
                </head>
                <body>
                    <h2>CONTROL DE HORAS EXTRAS - ASESORES</h2>
                    <p>Reporte oficial generado por el sistema</p>
                    <table>
                        <thead>
                            <tr>
                                <th>FECHA</th>
                                <th>ZONA-BASE</th>
                                <th>HORARIO NORMAL</th>
                                <th>HORARIO EXTRA EN ZONA</th>
                                <th>TOTAL H.E.</th>
                                <th>OBSERVACIÓN</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            registros.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(reg => {
                const partesFecha = reg.fecha.split('-');
                const fechaFormateada = partesFecha.length === 3 ? `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}` : reg.fecha;

                htmlPdf += `
                    <tr>
                        <td>${fechaFormateada}</td>
                        <td>${reg.zona}</td>
                        <td>${reg.horarioNormal}</td>
                        <td>${reg.horarioExtra}</td>
                        <td>${reg.esDescanso ? 'DESCANSO' : reg.totalHoras + ' h'}</td>
                        <td>${reg.observacion}</td>
                    </tr>
                `;
            });

            htmlPdf += `
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            ventanaPdf.document.write(htmlPdf);
            ventanaPdf.document.close();
            ventanaPdf.focus();
            
            setTimeout(() => {
                ventanaPdf.print();
            }, 500);
        });
    }

    // Inicializar al cargar la página
    recalcularTodo();
});