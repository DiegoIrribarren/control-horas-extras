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
    // 8. EXPORTAR A EXCEL (XML OFICIAL CON CABECERAS Y FIRMAS) Y PDF
    // ==========================================
    if (btnExportarExcel) {
        btnExportarExcel.addEventListener('click', () => {
            const mesValue = selectMes ? selectMes.value : '2026-11';
            const [anio, mes] = mesValue.split('-').map(Number);
            const totalDiasMes = new Date(anio, mes, 0).getDate();
            
            // Nombres de meses en español para el título oficial
            const mesesNombres = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
            const nombreMesStr = mesesNombres[mes - 1];

            let contenidoTabla = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="UTF-8">
                    <!--[if gte mso 9]>
                    <xml>
                        <x:ExcelWorkbook>
                            <x:ExcelWorksheets>
                                <x:ExcelWorksheet>
                                    <x:Name>Control de Horas Extras</x:Name>
                                    <x:WorksheetOptions>
                                        <x:DisplayGridlines/>
                                    </x:WorksheetOptions>
                                </x:ExcelWorksheet>
                            </x:ExcelWorksheets>
                        </x:ExcelWorkbook>
                    </xml>
                    <![endif]-->
                </head>
                <body>
                    <table border="1">
                        <!-- TÍTULO PRINCIPAL ROJO -->
                        <tr style="background-color: #ff0037; color: white; font-weight: bold; text-align: center; height: 30px;">
                            <th colspan="6" style="font-size: 14px;">REGISTRO Y CONTROL DE HORAS EXTRAS - DEL 01 AL ${totalDiasMes} DE ${nombreMesStr} DEL ${anio}</th>
                        </tr>
                        <!-- DATOS PERSONALES -->
                        <tr style="font-weight: bold; height: 24px;">
                            <td colspan="4" style="background-color: #ffffff; text-align: left; padding-left: 8px;">APELLIDOS Y NOMBRES: DIEGO VASQUEZ IRIBARREN</td>
                            <td colspan="2" style="background-color: #ffffff; text-align: left; padding-left: 8px;">DNI: 45866530</td>
                        </tr>
                        <!-- CABECERAS DE TABLA -->
                        <tr style="background-color: #f1f3f5; font-weight: bold; text-align: center; height: 26px;">
                            <th>FECHA</th>
                            <th>ZONA -BASE</th>
                            <th>HORARIO NORMAL</th>
                            <th>HORARIO EXTRA EN ZONA</th>
                            <th>TOTAL DE HORAS EXTRAS</th>
                            <th>OBSERVACIÓN</th>
                        </tr>
            `;

            let sumaTotalHoras = 0;

            for (let dia = 1; dia <= totalDiasMes; dia++) {
                const diaStr = String(dia).padStart(2, '0');
                const mesStr = String(mes).padStart(2, '0');
                const fechaIso = `${anio}-${mesStr}-${diaStr}`;
                const fechaFormateada = `${diaStr}-${mes.toString().toLowerCase()}-${anio.toString().slice(-2)}`; // Ej: 01-sep-26 (ajustable)

                // Formato de fecha limpio tipo dd-mmm-yy
                const mesesCortos = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
                const fechaTexto = `${diaStr}-${mesesCortos[mes - 1]}-${anio.toString().slice(-2)}`;

                const reg = registros.find(r => r.fecha === fechaIso);

                if (reg) {
                    if (reg.esDescanso) {
                        contenidoTabla += `
                            <tr>
                                <td style="text-align: center;">${fechaTexto}</td>
                                <td colspan="4" style="text-align: center; font-weight: bold; color: #64748b;">DÍA DE DESCANSO</td>
                                <td>${reg.observacion || '-'}</td>
                            </tr>
                        `;
                    } else {
                        sumaTotalHoras += reg.totalHoras || 0;
                        contenidoTabla += `
                            <tr>
                                <td style="text-align: center;">${fechaTexto}</td>
                                <td style="text-align: center;">${reg.zona || '-'}</td>
                                <td style="text-align: center;">${reg.horarioNormal || '-'}</td>
                                <td style="text-align: center;">${reg.horarioExtra || '-'}</td>
                                <td style="text-align: center;">${reg.totalHoras > 0 ? reg.totalHoras + ' h' : '-'}</td>
                                <td>${reg.observacion || '-'}</td>
                            </tr>
                        `;
                    }
                } else {
                    contenidoTabla += `
                        <tr>
                            <td style="text-align: center;">${fechaTexto}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    `;
                }
            }

            // FILA TOTAL
            contenidoTabla += `
                <tr style="font-weight: bold; background-color: #f8fafc;">
                    <td style="text-align: center;">TOTAL</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style="text-align: center;">${sumaTotalHoras > 0 ? sumaTotalHoras + ' h' : ''}</td>
                    <td></td>
                </tr>
                <!-- ESPACIOS PARA FIRMAS -->
                <tr style="height: 40px;"><td colspan="6"></td></tr>
                <tr>
                    <td colspan="3" style="text-align: center; border-top: 1px solid #000; font-weight: bold;">Vº Bº COORDINADOR</td>
                    <td colspan="3" style="text-align: center; border-top: 1px solid #000; font-weight: bold;">PROCURADOR</td>
                </tr>
                </table>
                </body>
                </html>
            `;

            const blob = new Blob([contenidoTabla], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Control_Horas_Extras_${mesValue}.xls`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    if (btnExportarPdf) {
        btnExportarPdf.addEventListener('click', () => {
            const mesValue = selectMes ? selectMes.value : '2026-11';
            const [anio, mes] = mesValue.split('-').map(Number);
            const totalDiasMes = new Date(anio, mes, 0).getDate();
            const mesesNombres = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
            const nombreMesStr = mesesNombres[mes - 1];
            const mesesCortos = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

            let ventanaPdf = window.open('', '_blank');
            let htmlPdf = `
                <html>
                <head>
                    <title>Control de Horas Extras</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 15px; color: #000; }
                        table { width: 100%; border-collapse: collapse; font-size: 10px; }
                        th, td { border: 1px solid #000; padding: 4px; text-align: center; }
                        .titulo { background-color: #ff0037; color: white; font-weight: bold; font-size: 12px; padding: 8px; text-align: center; }
                        .datos { font-weight: bold; text-align: left; padding: 6px; background: #fff; }
                        .cabecera-tabla { background-color: #f1f3f5; font-weight: bold; }
                        .firma-container { margin-top: 50px; width: 100%; display: flex; justify-content: space-around; }
                        .firma-linea { width: 35%; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-weight: bold; font-size: 11px; }
                    </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <td colspan="6" class="titulo">REGISTRO Y CONTROL DE HORAS EXTRAS - DEL 01 AL ${totalDiasMes} DE ${nombreMesStr} DEL ${anio}</td>
                        </tr>
                        <tr>
                            <td colspan="4" class="datos">APELLIDOS Y NOMBRES: DIEGO VASQUEZ IRIBARREN</td>
                            <td colspan="2" class="datos">DNI: 45866530</td>
                        </tr>
                        <tr class="cabecera-tabla">
                            <th>FECHA</th>
                            <th>ZONA -BASE</th>
                            <th>HORARIO NORMAL</th>
                            <th>HORARIO EXTRA EN ZONA</th>
                            <th>TOTAL DE HORAS EXTRAS</th>
                            <th>OBSERVACIÓN</th>
                        </tr>
            `;

            let sumaTotalHoras = 0;

            for (let dia = 1; dia <= totalDiasMes; dia++) {
                const diaStr = String(dia).padStart(2, '0');
                const mesStr = String(mes).padStart(2, '0');
                const fechaIso = `${anio}-${mesStr}-${diaStr}`;
                const fechaTexto = `${diaStr}-${mesesCortos[mes - 1]}-${anio.toString().slice(-2)}`;

                const reg = registrations = registros.find(r => r.fecha === fechaIso);

                if (reg) {
                    if (reg.esDescanso) {
                        htmlPdf += `
                            <tr>
                                <td>${fechaTexto}</td>
                                <td colspan="4" style="font-weight: bold; color: #555;">DÍA DE DESCANSO</td>
                                <td>${reg.observacion || '-'}</td>
                            </tr>
                        `;
                    } else {
                        sumaTotalHoras += reg.totalHoras || 0;
                        htmlPdf += `
                            <tr>
                                <td>${fechaTexto}</td>
                                <td>${reg.zona || '-'}</td>
                                <td>${reg.horarioNormal || '-'}</td>
                                <td>${reg.horarioExtra || '-'}</td>
                                <td>${reg.totalHoras > 0 ? reg.totalHoras + ' h' : '-'}</td>
                                <td>${reg.observacion || '-'}</td>
                            </tr>
                        `;
                    }
                } else {
                    htmlPdf += `
                        <tr>
                            <td>${fechaTexto}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    `;
                }
            }

            htmlPdf += `
                        <tr style="font-weight: bold; background-color: #f8fafc;">
                            <td>TOTAL</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>${sumaTotalHoras > 0 ? sumaTotalHoras + ' h' : ''}</td>
                            <td></td>
                        </tr>
                    </table>

                    <br><br><br><br>
                    <table style="border: none; width: 100%;">
                        <tr style="border: none;">
                            <td style="border: none; width: 40%; border-top: 1px solid #000; font-weight: bold; padding-top: 8px;">Vº Bº COORDINADOR</td>
                            <td style="border: none; width: 20%;"></td>
                            <td style="border: none; width: 40%; border-top: 1px solid #000; font-weight: bold; padding-top: 8px;">PROCURADOR</td>
                        </tr>
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