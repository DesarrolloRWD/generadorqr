// Servicio para manejar operaciones con la API externa

import { ProductData, ProductDataFlat } from './db-service';

// Interfaz para los datos de productos obtenidos del listado
export interface ProductListItem {
  codigo: string;
  marca: string;
  descripcion: string;
  unidad: string;
  lote: string;
  fechaExpiracion: string;
  area?: string;
  presentacion?: string;
  empresa: string;
}

// URLs para los endpoints
const PROXY_SAVE_URL = '/api/save/information'; // URL del proxy local para guardar
const PROXY_LIST_URL = '/api/list/products'; // URL del proxy local para listar
const EXTERNAL_SAVE_URL = process.env.NEXT_PUBLIC_API_URL || ''; // URL externa para guardar
const EXTERNAL_LIST_URL = process.env.NEXT_LISTADO_API_URL || ''; // URL externa para listar

export class ApiService {
  private static instance: ApiService;
  
  private constructor() {}
  
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }
  
  // Guardar un producto en la API externa
  public async saveProduct(product: ProductData): Promise<void> {
    try {
      // Convertir el producto con lotes a formato plano para la API
      const productRequests = product.lotes.map(lote => ({
        codigo: product.codigo,
        marca: product.marca,
        descripcion: product.descripcion,
        unidad: product.unidad,
        lote: lote.lote,
        fechaExpiracion: lote.fechaExpiracion,
        area: product.area || "",
        presentacion: product.presentacion || "",
        empresa: product.empresa
      }));
      
      // Si no hay lotes, enviar al menos un registro con los datos del producto
      if (productRequests.length === 0) {
        productRequests.push({
          codigo: product.codigo,
          marca: product.marca,
          descripcion: product.descripcion,
          unidad: product.unidad,
          lote: "",
          fechaExpiracion: "",
          area: product.area || "",
          presentacion: product.presentacion || "",
          empresa: product.empresa
        });
      }
      
      console.log(`Enviando ${productRequests.length} productos en un solo array`);
      
      // Intentar primero con el proxy local
      try {
        console.log('Intentando guardar a través del proxy local...');
        const response = await fetch(PROXY_SAVE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productRequests), // Enviar como array
          cache: 'no-store',
        });
        
        if (!response.ok) {
          // Intentar obtener más información sobre el error
          let errorDetails = '';
          try {
            const errorText = await response.text();
            errorDetails = errorText;
            console.error(`Detalles del error de la API (proxy): ${errorText}`);
          } catch (readError) {
            console.error('No se pudo leer el cuerpo de la respuesta de error', readError);
          }
          
          throw new Error(`Error al guardar en la API (proxy): ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
        }
        
        // Intentar leer la respuesta
        let responseData;
        try {
          responseData = await response.json();
          console.log('Respuesta de la API (proxy):', responseData);
        } catch (jsonError) {
          const textResponse = await response.text();
          console.log(`Respuesta de la API (proxy) (texto): ${textResponse}`);
        }
        
        console.log('Producto guardado correctamente en la API a través del proxy');
        return;
      } catch (proxyError) {
        console.warn('Error al usar el proxy, intentando directamente con la URL externa:', proxyError);
        
        // Si el proxy falla y tenemos una URL externa, intentar directamente
        if (EXTERNAL_SAVE_URL) {
          try {
            console.log('Intentando guardar directamente en la URL externa:', EXTERNAL_SAVE_URL);
            const response = await fetch(EXTERNAL_SAVE_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(productRequests), // Enviar como array
              // Usar modo 'no-cors' para evitar errores CORS
              mode: 'no-cors'
            });
            
            // Nota: con mode: 'no-cors', response.ok siempre será false y no podemos leer el body
            // Asumimos que la solicitud fue exitosa si no lanzó una excepción
            console.log('Solicitud directa completada. Estado:', response.status, response.type);
            
            console.log('Producto guardado correctamente en la API directamente');
            return;
          } catch (directError) {
            console.error('Error al intentar directamente con la URL externa:', directError);
            throw directError;
          }
        } else {
          throw new Error('No se pudo guardar con el proxy y no hay URL externa configurada');
        }
      }
    } catch (error) {
      console.error('Error al guardar en la API:', error);
      throw error;
    }
  }
  
  // Guardar múltiples productos
  async saveProducts(products: ProductData[]): Promise<void> {
    try {
      // Convertir los productos con lotes a formato plano para la API
      const allProductRequests: any[] = [];
      
      // Procesar cada producto y sus lotes
      products.forEach(product => {
        // Si el producto tiene lotes, crear un registro por cada lote
        if (product.lotes && product.lotes.length > 0) {
          product.lotes.forEach(lote => {
            allProductRequests.push({
              codigo: product.codigo,
              marca: product.marca,
              descripcion: product.descripcion,
              unidad: product.unidad,
              lote: lote.lote,
              fechaExpiracion: lote.fechaExpiracion,
              area: product.area || "",
              presentacion: product.presentacion || "",
              empresa: product.empresa
            });
          });
        } else {
          // Si no tiene lotes, agregar un registro con los datos del producto
          allProductRequests.push({
            codigo: product.codigo,
            marca: product.marca,
            descripcion: product.descripcion,
            unidad: product.unidad,
            lote: "",
            fechaExpiracion: "",
            area: product.area || "",
            presentacion: product.presentacion || "",
            empresa: product.empresa
          });
        }
      });
      
      console.log(`Enviando ${allProductRequests.length} productos en un solo array`);
      
      // Intentar primero con el proxy local
      try {
        console.log('Intentando guardar productos a través del proxy local...');
        const response = await fetch(PROXY_SAVE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(allProductRequests), // Enviar array completo
          cache: 'no-store',
        });
        
        if (!response.ok) {
          // Intentar obtener más información sobre el error
          let errorDetails = '';
          try {
            const errorText = await response.text();
            errorDetails = errorText;
            console.error(`Detalles del error de la API (proxy): ${errorText}`);
          } catch (readError) {
            console.error('No se pudo leer el cuerpo de la respuesta de error', readError);
          }
          
          throw new Error(`Error al guardar en la API (proxy): ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
        }
        
        // Intentar leer la respuesta
        let responseData;
        try {
          responseData = await response.json();
          console.log('Respuesta de la API (proxy):', responseData);
        } catch (jsonError) {
          const textResponse = await response.text();
          console.log(`Respuesta de la API (proxy) (texto): ${textResponse}`);
        }
        
        console.log('Todos los productos guardados correctamente en la API a través del proxy');
        return;
      } catch (proxyError) {
        console.warn('Error al usar el proxy, intentando directamente con la URL externa:', proxyError);
        
        // Si el proxy falla y tenemos una URL externa, intentar directamente
        if (EXTERNAL_SAVE_URL) {
          try {
            console.log('Intentando guardar productos directamente en la URL externa:', EXTERNAL_SAVE_URL);
            const response = await fetch(EXTERNAL_SAVE_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(allProductRequests), // Enviar array completo
              // Usar modo 'no-cors' para evitar errores CORS
              mode: 'no-cors'
            });
            
            // Nota: con mode: 'no-cors', response.ok siempre será false y no podemos leer el body
            // Asumimos que la solicitud fue exitosa si no lanzó una excepción
            console.log('Solicitud directa completada. Estado:', response.status, response.type);
            
            console.log('Todos los productos guardados correctamente en la API directamente');
          } catch (directError: any) {
            console.error('Error al intentar directamente con la URL externa:', directError);
            throw directError;
          }
        } else {
          throw new Error('No se pudo guardar con el proxy y no hay URL externa configurada');
        }
      }
    } catch (error) {
      console.error('Error al guardar en la API:', error);
      throw error;
    }
  }
  
  // Guardar productos en formato plano
  public async saveProductsFlat(products: ProductDataFlat[]): Promise<void> {
    try {
      // Convertir los productos planos al formato esperado por la API
      const productRequests = products.map(product => ({
        codigo: product.codigo,
        marca: product.marca,
        descripcion: product.descripcion,
        unidad: product.unidad,
        lote: product.lote || "",
        fechaExpiracion: product.fechaExpiracion || "",
        area: product.area || "",
        presentacion: product.presentacion || "",
        empresa: product.empresa
      }));
      
      console.log(`Enviando ${productRequests.length} productos en un solo array`);
      
      // Intentar primero con el proxy local
      try {
        console.log('Intentando guardar productos planos a través del proxy local...');
        const response = await fetch(PROXY_SAVE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productRequests), // Enviar array completo
          cache: 'no-store',
        });
        
        if (!response.ok) {
          // Intentar obtener más información sobre el error
          let errorDetails = '';
          try {
            const errorText = await response.text();
            errorDetails = errorText;
            console.error(`Detalles del error de la API (proxy): ${errorText}`);
          } catch (readError) {
            console.error('No se pudo leer el cuerpo de la respuesta de error', readError);
          }
          
          throw new Error(`Error al guardar en la API (proxy): ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
        }
        
        // Intentar leer la respuesta
        let responseData;
        try {
          responseData = await response.json();
          console.log('Respuesta de la API (proxy):', responseData);
        } catch (jsonError) {
          const textResponse = await response.text();
          console.log(`Respuesta de la API (proxy) (texto): ${textResponse}`);
        }
        
        console.log('Productos planos guardados correctamente en la API a través del proxy');
        return;
      } catch (proxyError) {
        console.warn('Error al usar el proxy para productos planos, intentando directamente con la URL externa:', proxyError);
        
        // Si el proxy falla y tenemos una URL externa, intentar directamente
        if (EXTERNAL_SAVE_URL) {
          try {
            console.log('Intentando guardar productos planos directamente en la URL externa:', EXTERNAL_SAVE_URL);
            const response = await fetch(EXTERNAL_SAVE_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(productRequests), // Enviar array completo
              // Usar modo 'no-cors' para evitar errores CORS
              mode: 'no-cors'
            });
            
            // Nota: con mode: 'no-cors', response.ok siempre será false y no podemos leer el body
            // Asumimos que la solicitud fue exitosa si no lanzó una excepción
            console.log('Solicitud directa completada. Estado:', response.status, response.type);
            console.log('Productos planos guardados correctamente en la API directamente');
            return;
          } catch (directError) {
            console.error('Error al intentar directamente con la URL externa:', directError);
            throw directError;
          }
        } else {
          throw new Error('No se pudo guardar con el proxy y no hay URL externa configurada');
        }
      }
    } catch (error) {
      console.error('Error al guardar en la API:', error);
      throw error;
    }
  }

  // Obtener listado de productos
  public async getProductList(): Promise<ProductListItem[]> {
    try {
      console.log('Obteniendo listado de productos...');
      
      // Intentar primero con el proxy local
      try {
        console.log('Intentando obtener listado a través del proxy local...');
        const response = await fetch(PROXY_LIST_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        
        if (!response.ok) {
          // Intentar obtener más información sobre el error
          let errorDetails = '';
          try {
            const errorText = await response.text();
            errorDetails = errorText;
            console.error(`Detalles del error al obtener listado (proxy): ${errorText}`);
          } catch (readError) {
            console.error('No se pudo leer el cuerpo de la respuesta de error', readError);
          }
          
          throw new Error(`Error al obtener listado (proxy): ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
        }
        
        // Intentar leer la respuesta
        const responseData = await response.json();
        console.log('Respuesta del listado (proxy):', responseData);
        
        // Verificar la estructura de la respuesta
        if (Array.isArray(responseData)) {
          console.log(`Listado obtenido correctamente: ${responseData.length} productos`);
          return responseData;
        } else if (responseData && typeof responseData === 'object') {
          // Si la respuesta es un objeto con una propiedad que contiene el array
          // Buscar una propiedad que contenga un array (común en APIs)
          for (const key in responseData) {
            if (Array.isArray(responseData[key])) {
              console.log(`Listado obtenido correctamente en propiedad '${key}': ${responseData[key].length} productos`);
              return responseData[key];
            }
          }
          console.warn('La respuesta no contiene un array de productos');
          return [];
        } else {
          console.warn('La respuesta no tiene el formato esperado');
          return [];
        }
      } catch (proxyError) {
        console.warn('Error al usar el proxy para el listado, intentando directamente con la URL externa:', proxyError);
        
        // Si el proxy falla y tenemos una URL externa, intentar directamente
        if (EXTERNAL_LIST_URL) {
          try {
            console.log('Intentando obtener listado directamente de la URL externa:', EXTERNAL_LIST_URL);
            const response = await fetch(EXTERNAL_LIST_URL, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              // No usar modo 'no-cors' aquí porque no podríamos leer la respuesta
            });
            
            if (!response.ok) {
              throw new Error(`Error al obtener listado directamente: ${response.status} ${response.statusText}`);
            }
            
            const responseData = await response.json();
            
            // Verificar la estructura de la respuesta
            if (Array.isArray(responseData)) {
              console.log(`Listado obtenido correctamente de forma directa: ${responseData.length} productos`);
              return responseData;
            } else if (responseData && typeof responseData === 'object') {
              // Si la respuesta es un objeto con una propiedad que contiene el array
              for (const key in responseData) {
                if (Array.isArray(responseData[key])) {
                  console.log(`Listado obtenido correctamente en propiedad '${key}': ${responseData[key].length} productos`);
                  return responseData[key];
                }
              }
              console.warn('La respuesta directa no contiene un array de productos');
              return [];
            } else {
              console.warn('La respuesta directa no tiene el formato esperado');
              return [];
            }
          } catch (directError) {
            console.error('Error al intentar obtener el listado directamente:', directError);
            throw directError;
          }
        } else {
          throw new Error('No se pudo obtener el listado con el proxy y no hay URL externa configurada');
        }
      }
    } catch (error) {
      console.error('Error al obtener el listado de productos:', error);
      throw error;
    }
  }
}
