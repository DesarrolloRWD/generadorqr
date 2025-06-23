// Archivo de proxy para obtener el listado de productos
// Este archivo actúa como intermediario entre el frontend y la API externa

export async function GET(request: Request) {
  try {
    console.log('Proxy Listado: Iniciando procesamiento de solicitud');
    
    // URL de la API externa para el listado
    const apiUrl = process.env.NEXT_LISTADO_API_URL;
    
    // Verificar que la URL de la API externa esté definida
    if (!apiUrl) {
      console.error('La variable de entorno NEXT_LISTADO_API_URL no está definida');
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta: URL de API de listado no definida' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    console.log(`Proxy Listado: URL de API configurada: ${apiUrl}`);
    
    // Reenviar la solicitud a la API externa con timeout extendido
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout
    
    try {
      // Realizar la solicitud GET a la API externa
      console.log(`Proxy Listado: Intentando conectar con la API externa: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      // Limpiar el timeout ya que la solicitud se completó
      clearTimeout(timeoutId);
      
      console.log(`Proxy Listado: Respuesta recibida con estado ${response.status} ${response.statusText}`);
      
      // Si la respuesta no es exitosa, registrar el error y devolverlo
      if (!response.ok) {
        let errorText = '';
        try {
          // Intentar leer el cuerpo de la respuesta de error
          const errorBody = await response.text();
          console.error(`Proxy Listado: Error en la respuesta de la API externa: ${errorBody}`);
          errorText = errorBody;
        } catch (readError) {
          console.error('Proxy Listado: No se pudo leer el cuerpo de la respuesta de error', readError);
        }
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Error en la API externa de listado: ${response.status} ${response.statusText}`,
            details: errorText,
            timestamp: new Date().toISOString()
          }),
          { 
            status: 500,
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
        console.log('Proxy Listado: Respuesta procesada correctamente como JSON');
        
        // Verificar la estructura de los datos
        if (Array.isArray(responseData)) {
          console.log(`Proxy Listado: Se recibieron ${responseData.length} productos`);
        } else {
          console.log('Proxy Listado: La respuesta no es un array, se enviará tal como se recibió');
        }
        
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
        console.error('Proxy Listado: Error al procesar la respuesta como JSON', jsonError);
        const textResponse = await response.text();
        console.log(`Proxy Listado: Respuesta en texto: ${textResponse.substring(0, 200)}...`);
        
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
      
      console.error('Proxy Listado: Error al realizar la solicitud a la API externa:', fetchError);
      
      // Determinar si fue un error de timeout
      const esTimeout = fetchError.name === 'AbortError';
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: esTimeout ? 'Timeout al conectar con la API externa de listado' : 'Error al conectar con la API externa de listado',
          message: fetchError?.message || 'Error desconocido',
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  } catch (error: any) {
    // Registrar el error detallado
    console.error('Error en el proxy de listado de la API:', error);
    console.error('Stack trace:', error?.stack || 'No stack trace disponible');
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Error interno del servidor proxy de listado',
        message: error?.message || 'Error desconocido',
        stack: process.env.NODE_ENV === 'development' ? (error?.stack || 'No stack trace disponible') : undefined
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
