// Servicio para manejar operaciones con la base de datos local y la API externa
import { ApiService } from './api-service';

// Tipos de datos
export interface LoteData {
  lote: string;
  fechaExpiracion: string;
}

export interface ProductData {
  codigo: string;
  marca: string;
  descripcion: string;
  unidad: string;
  lotes: LoteData[];
  empresa: string;
  area: string;
  presentacion: string;
}

export interface ProductDataFlat {
  codigo: string;
  marca: string;
  descripcion: string;
  unidad: string;
  lote?: string;
  fechaExpiracion?: string;
  empresa: string;
  area: string;
  presentacion: string;
}

// Función para convertir datos planos a la estructura de productos con lotes
export function flatToNestedProduct(flatProduct: ProductDataFlat): ProductData {
  return {
    codigo: flatProduct.codigo,
    marca: flatProduct.marca,
    descripcion: flatProduct.descripcion,
    unidad: flatProduct.unidad,
    empresa: flatProduct.empresa,
    area: flatProduct.area || "",
    presentacion: flatProduct.presentacion || "",
    lotes: flatProduct.lote && flatProduct.fechaExpiracion ? [
      {
        lote: flatProduct.lote,
        fechaExpiracion: flatProduct.fechaExpiracion
      }
    ] : []
  };
}

// Función para agrupar productos planos por código
export function groupProductsByCode(flatProducts: ProductDataFlat[]): ProductData[] {
  const productMap = new Map<string, ProductData>();
  
  flatProducts.forEach(flatProduct => {
    const code = flatProduct.codigo;
    
    if (productMap.has(code)) {
      // Si el producto ya existe, agregamos el lote
      const product = productMap.get(code)!;
      
      // Solo agregamos el lote si tiene un valor y fecha de expiración
      if (flatProduct.lote && flatProduct.fechaExpiracion) {
        product.lotes.push({
          lote: flatProduct.lote,
          fechaExpiracion: flatProduct.fechaExpiracion
        });
      }
    } else {
      // Si es un nuevo producto, lo creamos
      productMap.set(code, {
        codigo: flatProduct.codigo,
        marca: flatProduct.marca,
        descripcion: flatProduct.descripcion,
        unidad: flatProduct.unidad,
        empresa: flatProduct.empresa,
        area: flatProduct.area,
        presentacion: flatProduct.presentacion,
        lotes: (flatProduct.lote && flatProduct.fechaExpiracion) ? [{
          lote: flatProduct.lote,
          fechaExpiracion: flatProduct.fechaExpiracion
        }] : []
      });
    }
  });
  
  return Array.from(productMap.values());
}

// Clase para manejar la conexión con la base de datos
export class DatabaseService {
  private static instance: DatabaseService;
  private db: IDBDatabase | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  
  private constructor() {}
  
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
  
  // Inicializar la base de datos
  public async init(): Promise<void> {
    if (this.db) return Promise.resolve();
    
    if (this.isInitializing) {
      return this.initPromise || Promise.resolve();
    }
    
    this.isInitializing = true;
    
    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        // Verificar si estamos en el navegador
        if (typeof window === 'undefined' || !window.indexedDB) {
          throw new Error('IndexedDB no está disponible en este entorno');
        }
        
        const request = window.indexedDB.open('ProductosDB', 1);
        
        request.onerror = (event) => {
          console.error('Error al abrir la base de datos:', event);
          reject(new Error('No se pudo abrir la base de datos'));
        };
        
        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          this.isInitializing = false;
          resolve();
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Crear almacén de productos
          if (!db.objectStoreNames.contains('productos')) {
            const productStore = db.createObjectStore('productos', { keyPath: 'codigo' });
            productStore.createIndex('codigo', 'codigo', { unique: true });
            productStore.createIndex('marca', 'marca', { unique: false });
            productStore.createIndex('descripcion', 'descripcion', { unique: false });
          }
          
          // Crear almacén de lotes
          if (!db.objectStoreNames.contains('lotes')) {
            const lotesStore = db.createObjectStore('lotes', { keyPath: 'id', autoIncrement: true });
            lotesStore.createIndex('codigoProducto', 'codigoProducto', { unique: false });
            lotesStore.createIndex('lote', 'lote', { unique: false });
          }
        };
      } catch (error) {
        this.isInitializing = false;
        reject(error);
      }
    });
    
    return this.initPromise;
  }
  
  // Guardar un producto con sus lotes (en IndexedDB y en la API)
  public async saveProduct(product: ProductData): Promise<void> {
    try {
      // Guardar en IndexedDB
      await this.saveProductToIndexedDB(product);
      
      // Guardar en la API
      try {
        const apiService = ApiService.getInstance();
        await apiService.saveProduct(product);
      } catch (apiError) {
        console.warn('No se pudo guardar en la API. Se guardó solo localmente:', apiError);
        // No propagamos el error de la API para que la aplicación siga funcionando
      }
    } catch (error) {
      console.error('Error al guardar el producto:', error);
      throw error;
    }
  }
  
  // Guardar un producto solo en IndexedDB
  private async saveProductToIndexedDB(product: ProductData): Promise<void> {
    await this.init();
    
    if (!this.db) {
      throw new Error('La base de datos no está inicializada');
    }
    
    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['productos', 'lotes'], 'readwrite');
        
        transaction.onerror = (event) => {
          reject(new Error('Error en la transacción'));
        };
        
        // Guardar el producto
        const productStore = transaction.objectStore('productos');
        const productData = {
          codigo: product.codigo,
          marca: product.marca,
          descripcion: product.descripcion,
          unidad: product.unidad,
          empresa: product.empresa,
          area: product.area,
          presentacion: product.presentacion
        };
        
        const productRequest = productStore.put(productData);
        
        productRequest.onsuccess = () => {
          // Guardar los lotes
          const lotesStore = transaction.objectStore('lotes');
          
          // Primero eliminamos los lotes existentes para este producto
          const deleteIndex = lotesStore.index('codigoProducto');
          const deleteRequest = deleteIndex.openKeyCursor(IDBKeyRange.only(product.codigo));
          
          deleteRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            
            if (cursor) {
              lotesStore.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              // Una vez eliminados los lotes antiguos, agregamos los nuevos
              const promises: Promise<void>[] = [];
              
              product.lotes.forEach(lote => {
                if (lote.lote) { // Solo guardar lotes con valor
                  const loteData = {
                    codigoProducto: product.codigo,
                    lote: lote.lote,
                    fechaExpiracion: lote.fechaExpiracion
                  };
                  
                  promises.push(
                    new Promise<void>((resolveLote, rejectLote) => {
                      const loteRequest = lotesStore.add(loteData);
                      
                      loteRequest.onsuccess = () => resolveLote();
                      loteRequest.onerror = () => rejectLote(new Error('Error al guardar lote'));
                    })
                  );
                }
              });
              
              Promise.all(promises)
                .then(() => resolve())
                .catch(error => reject(error));
            }
          };
        };
        
        productRequest.onerror = () => {
          reject(new Error('Error al guardar el producto'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Guardar múltiples productos (en IndexedDB y en la API)
  public async saveProducts(products: ProductData[]): Promise<void> {
    try {
      // Guardar cada producto en IndexedDB
      for (const product of products) {
        await this.saveProductToIndexedDB(product);
      }
      
      // Guardar todos en la API
      try {
        const apiService = ApiService.getInstance();
        await apiService.saveProducts(products);
      } catch (apiError) {
        console.warn('No se pudo guardar en la API. Se guardó solo localmente:', apiError);
        // No propagamos el error de la API para que la aplicación siga funcionando
      }
    } catch (error) {
      console.error('Error al guardar los productos:', error);
      throw error;
    }
  }
  
  // Obtener todos los productos con sus lotes
  public async getAllProducts(): Promise<ProductData[]> {
    await this.init();
    
    if (!this.db) {
      throw new Error('La base de datos no está inicializada');
    }
    
    return new Promise<ProductData[]>((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['productos', 'lotes'], 'readonly');
        const productStore = transaction.objectStore('productos');
        const lotesStore = transaction.objectStore('lotes');
        
        const products: ProductData[] = [];
        const productRequest = productStore.openCursor();
        
        productRequest.onsuccess = async (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            const product = cursor.value;
            
            // Obtener los lotes para este producto
            const lotes: LoteData[] = await new Promise((resolveLotes, rejectLotes) => {
              const lotesIndex = lotesStore.index('codigoProducto');
              const lotesRequest = lotesIndex.getAll(product.codigo);
              
              lotesRequest.onsuccess = () => {
                const lotesData = lotesRequest.result.map((lote: any) => ({
                  lote: lote.lote,
                  fechaExpiracion: lote.fechaExpiracion
                }));
                
                resolveLotes(lotesData);
              };
              
              lotesRequest.onerror = () => rejectLotes(new Error('Error al obtener lotes'));
            });
            
            products.push({
              ...product,
              lotes: lotes
            });
            
            cursor.continue();
          } else {
            resolve(products);
          }
        };
        
        productRequest.onerror = () => {
          reject(new Error('Error al obtener productos'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Buscar un producto por código
  public async getProductByCode(code: string): Promise<ProductData | null> {
    await this.init();
    
    if (!this.db) {
      throw new Error('La base de datos no está inicializada');
    }
    
    return new Promise<ProductData | null>((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['productos', 'lotes'], 'readonly');
        const productStore = transaction.objectStore('productos');
        const lotesStore = transaction.objectStore('lotes');
        
        const productRequest = productStore.get(code);
        
        productRequest.onsuccess = async () => {
          const product = productRequest.result;
          
          if (!product) {
            resolve(null);
            return;
          }
          
          // Obtener los lotes para este producto
          const lotes: LoteData[] = await new Promise((resolveLotes, rejectLotes) => {
            const lotesIndex = lotesStore.index('codigoProducto');
            const lotesRequest = lotesIndex.getAll(code);
            
            lotesRequest.onsuccess = () => {
              const lotesData = lotesRequest.result.map((lote: any) => ({
                lote: lote.lote,
                fechaExpiracion: lote.fechaExpiracion
              }));
              
              resolveLotes(lotesData);
            };
            
            lotesRequest.onerror = () => rejectLotes(new Error('Error al obtener lotes'));
          });
          
          resolve({
            ...product,
            lotes: lotes
          });
        };
        
        productRequest.onerror = () => {
          reject(new Error('Error al obtener el producto'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Eliminar un producto por código
  public async deleteProduct(code: string): Promise<void> {
    await this.init();
    
    if (!this.db) {
      throw new Error('La base de datos no está inicializada');
    }
    
    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['productos', 'lotes'], 'readwrite');
        const productStore = transaction.objectStore('productos');
        const lotesStore = transaction.objectStore('lotes');
        
        // Primero eliminamos los lotes
        const lotesIndex = lotesStore.index('codigoProducto');
        const lotesRequest = lotesIndex.openKeyCursor(IDBKeyRange.only(code));
        
        lotesRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            lotesStore.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            // Una vez eliminados los lotes, eliminamos el producto
            const productRequest = productStore.delete(code);
            
            productRequest.onsuccess = () => resolve();
            productRequest.onerror = () => reject(new Error('Error al eliminar el producto'));
          }
        };
        
        lotesRequest.onerror = () => {
          reject(new Error('Error al eliminar los lotes'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }
}
