// Archivo de proxy para evitar problemas de CORS
// Este archivo actúa como intermediario entre el frontend y la API externa

export async function POST(request: Request) {
  try {
    console.log('Proxy: Iniciando procesamiento de solicitud');
    
    // Obtener los datos de la solicitud
    const data = await request.json();
    
    // URL de la API externa
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Verificar que la URL de la API externa esté definida
    if (!apiUrl) {
      console.error('La variable de entorno NEXT_PUBLIC_API_URL no está definida');
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta: URL de API no definida' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    console.log(`Proxy: URL de API configurada: ${apiUrl}`);
    
    // Verificar estructura de los datos recibidos
    if (!data) {
      console.error('Proxy: Datos recibidos vacíos o inválidos');
      return new Response(
        JSON.stringify({ error: 'Datos de solicitud inválidos o vacíos' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    // Verificar y transformar los datos si es necesario
    let datosTransformados;
    
    // Determinar si los datos son un array o un objeto individual
    if (Array.isArray(data)) {
      console.log(`Proxy: Procesando array de ${data.length} elementos`);
      
      // IMPORTANTE: El backend espera un array de objetos
      console.log('Proxy: Procesando todos los elementos del array');
      
      if (data.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No se proporcionaron datos válidos' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
      
      // Procesar todos los elementos del array
      datosTransformados = data.map(item => procesarItem(item));
      console.log('Proxy: Datos transformados (array completo):', 
                  JSON.stringify(datosTransformados.slice(0, 2)) + 
                  (datosTransformados.length > 2 ? ` ... y ${datosTransformados.length - 2} más` : ''));
    } else if (typeof data === 'object' && data !== null) {
      // Es un objeto individual (formato correcto para el backend)
      console.log('Proxy: Procesando objeto individual');
      datosTransformados = procesarItem(data);
      console.log('Proxy: Datos transformados (objeto individual):', JSON.stringify(datosTransformados));
    } else {
      console.error('Proxy: Los datos recibidos no son válidos. Tipo:', typeof data);
      return new Response(
        JSON.stringify({ error: 'Formato de datos inválido' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    // Función para procesar un ítem individual
    function procesarItem(item: any) {
      const nuevoItem = { ...item };
      
      // Convertir fechaExpiracion a número si es string
      if (nuevoItem.fechaExpiracion) {
        // Si es string con formato de fecha MM/DD/YY o DD/MM/YY
        if (typeof nuevoItem.fechaExpiracion === 'string' && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(nuevoItem.fechaExpiracion)) {
          try {
            // Extraer las partes de la fecha
            const partes = nuevoItem.fechaExpiracion.split('/');
            let mes, dia, anio;
            
            // Formato americano MM/DD/YY
            if (parseInt(partes[0]) <= 12) {
              mes = parseInt(partes[0]);
              dia = parseInt(partes[1]);
              anio = parseInt(partes[2]);
            } 
            // Formato europeo DD/MM/YY
            else {
              dia = parseInt(partes[0]);
              mes = parseInt(partes[1]);
              anio = parseInt(partes[2]);
            }
            
            // Ajustar el año si es de 2 dígitos
            if (anio < 100) {
              anio = anio < 50 ? 2000 + anio : 1900 + anio;
            }
            
            // Calcular días desde 1/1/1900 (formato Excel)
            const fecha1900 = new Date(1900, 0, 1);
            const fechaActual = new Date(anio, mes - 1, dia);
            const diasDesde1900 = Math.floor((fechaActual.getTime() - fecha1900.getTime()) / (1000 * 60 * 60 * 24)) + 2; // +2 por ajuste de Excel
            
            nuevoItem.fechaExpiracion = diasDesde1900.toString();
            console.log(`Proxy: Convertida fecha ${item.fechaExpiracion} a ${nuevoItem.fechaExpiracion}`);
          } catch (error) {
            console.error(`Proxy: Error al convertir fecha ${nuevoItem.fechaExpiracion}:`, error);
            // Mantener el valor original si hay error
          }
        } 
        // Si es string pero parece un número
        else if (typeof nuevoItem.fechaExpiracion === 'string' && !isNaN(Number(nuevoItem.fechaExpiracion))) {
          // Asegurar que sea string pero con formato numérico
          nuevoItem.fechaExpiracion = nuevoItem.fechaExpiracion.trim();
          console.log(`Proxy: Fecha ya en formato numérico: ${nuevoItem.fechaExpiracion}`);
        }
        // Si no es un número ni tiene formato de fecha, dejarlo vacío
        else if (typeof nuevoItem.fechaExpiracion === 'string' && isNaN(Number(nuevoItem.fechaExpiracion))) {
          console.warn(`Proxy: Fecha con formato no reconocido: ${nuevoItem.fechaExpiracion}, se establecerá como vacía`);
          nuevoItem.fechaExpiracion = "";
        }
      }
      
      // Verificar campos obligatorios
      if (!nuevoItem.codigo || nuevoItem.codigo === "") {
        console.warn(`Proxy: Elemento sin código válido:`, JSON.stringify(nuevoItem));
      }
      
      return nuevoItem;
    }
    
    console.log(`Proxy: Enviando solicitud a ${apiUrl} con datos:`, 
              Array.isArray(datosTransformados) 
                ? `Array con ${datosTransformados.length} elementos` 
                : JSON.stringify(datosTransformados));
    
    // Reenviar la solicitud a la API externa con timeout extendido
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout
    
    try {
      // Enviar el objeto individual o array
      console.log(`Proxy: Intentando conectar con la API externa: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosTransformados), // Puede ser un array o un objeto individual
        signal: controller.signal
      });
      
      // Limpiar el timeout ya que la solicitud se completó
      clearTimeout(timeoutId);
      
      console.log(`Proxy: Respuesta recibida con estado ${response.status} ${response.statusText}`);
      
      // Si la respuesta no es exitosa, registrar el error y devolverlo
      if (!response.ok) {
        let errorText = '';
        try {
          // Intentar leer el cuerpo de la respuesta de error
          const errorBody = await response.text();
          console.error(`Proxy: Error en la respuesta de la API externa: ${errorBody}`);
          errorText = errorBody;
        } catch (readError) {
          console.error('Proxy: No se pudo leer el cuerpo de la respuesta de error', readError);
        }
        
        // Devolver un código 200 en lugar de error para que el cliente no falle
        // pero incluir información del error en el cuerpo
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Error en la API externa: ${response.status} ${response.statusText}`,
            details: errorText,
            timestamp: new Date().toISOString(),
            message: "Los datos se guardaron localmente pero hubo un problema al sincronizar con la API externa"
          }),
          { 
            status: 200, // Devolver 200 para que el cliente no falle
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
      
      // Procesar la respuesta exitosa
      try {
        // Intentar procesar la respuesta como JSON
        const responseData = await response.json();
        console.log('Proxy: Respuesta procesada correctamente como JSON');
        
        // Devolver la respuesta JSON
        return new Response(
          JSON.stringify(responseData),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (jsonError) {
        // Si no es JSON, intentar leer como texto
        console.error('Proxy: Error al procesar la respuesta como JSON', jsonError);
        const textResponse = await response.text();
        console.log(`Proxy: Respuesta en texto: ${textResponse.substring(0, 200)}...`);
        
        // Devolver la respuesta como texto
        return new Response(
          JSON.stringify({ result: textResponse }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
    } catch (fetchError: any) {
      // Limpiar el timeout
      clearTimeout(timeoutId);
      
      console.error('Proxy: Error al realizar la solicitud a la API externa:', fetchError);
      
      // Determinar si fue un error de timeout
      const esTimeout = fetchError.name === 'AbortError';
      
      // Devolver un código 200 en lugar de error para que el cliente no falle
      // pero incluir información del error en el cuerpo
      return new Response(
        JSON.stringify({ 
          success: false,
          error: esTimeout ? 'Timeout al conectar con la API externa' : 'Error al conectar con la API externa',
          message: fetchError?.message || 'Error desconocido',
          timestamp: new Date().toISOString(),
          localSaved: true,
          details: "Los datos se guardaron localmente pero hubo un problema al sincronizar con la API externa"
        }),
        {
          status: 200, // Devolver 200 para que el cliente no falle
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  } catch (error: any) {
    // Registrar el error detallado
    console.error('Error en el proxy de la API:', error);
    console.error('Stack trace:', error?.stack || 'No stack trace disponible');
    
    // Devolver un código 200 en lugar de error para que el cliente no falle
    // pero incluir información del error en el cuerpo
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Error interno del servidor proxy',
        message: error?.message || 'Error desconocido',
        localSaved: true,
        details: "Los datos se guardaron localmente pero hubo un problema al sincronizar con la API externa",
        stack: process.env.NODE_ENV === 'development' ? (error?.stack || 'No stack trace disponible') : undefined
      }),
      {
        status: 200, // Devolver 200 para que el cliente no falle
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
