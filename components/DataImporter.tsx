"use client"

import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, Database, AlertCircle, Check, Download } from "lucide-react"

interface ProductData {
  codigo: string
  marca: string
  descripcion: string
  unidad: string
  lote?: string
  fechaExpiracion?: string
  empresa: string
  area: string
  presentacion: string
}

interface ImporterProps {
  onDataImported: (data: ProductData[]) => Promise<void>
}

export function DataImporter({ onDataImported }: ImporterProps) {
  const [activeTab, setActiveTab] = useState("manual")
  const [excelData, setExcelData] = useState<ProductData[]>([])
  const [previewData, setPreviewData] = useState<ProductData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Función para descargar la plantilla de Excel
  const downloadTemplate = () => {
    try {
      // Crear un libro de trabajo nuevo
      const wb = XLSX.utils.book_new();
      
      // Datos de ejemplo para la plantilla con varios casos de uso
      const exampleData = [
        {
          area: "COAGULACION",
          codigo: "6689E+09",
          descripcion: "COAGUCHECK TP CONTROLS",
          marca: "ROCHE",
          lote: "77E+07",
          fechaExpiracion: "2025-08-31",
          unidad: "CAJA",
          presentacion: "CAJA CON 2 FRASCOS, 24 PRUEBAS C/U",
          empresa: "Bioscientia"
        },
        {
          area: "FUNCIONAMIENTO",
          codigo: "668E+09",
          descripcion: "COAGUCHECK TP CONTROLS",
          marca: "ROCHE",
          lote: "81E+07",
          fechaExpiracion: "2025-08-31",
          unidad: "CAJA",
          presentacion: "Caja con 4 frascos con 2 niveles",
          empresa: "RBC"
        },
        {
          area: "TOMA DE MUESTRA/SANGRADO",
          codigo: "499-4V",
          descripcion: "STA Cleaner solution",
          marca: "STAGO",
          lote: "271596",
          fechaExpiracion: "2026-06-30",
          unidad: "PZ",
          presentacion: "Botella de 2500mL",
          empresa: "Consumos"
        },
        {
          area: "INMUNOHEMATOLOGIA",
          codigo: "485-C1",
          descripcion: "STA CaCl2 0.025M",
          marca: "STAGO",
          lote: "272336",
          fechaExpiracion: "2026-11-30",
          unidad: "PZ",
          presentacion: "Frasco 15mL",
          empresa: "Hemolife"
        },
        {
          area: "HEMATOLOGIA",
          codigo: "485-9v",
          descripcion: "STA OWREN-KOLLER SOL. BUFFER PARA DET PT",
          marca: "STAGO",
          lote: "278992",
          fechaExpiracion: "2026-09-30",
          unidad: "KIT",
          presentacion: "Frasco 15mL",
          empresa: "Bioscientia"
        }
      ];
      
      // Crear una hoja de trabajo con los datos de ejemplo
      const ws = XLSX.utils.json_to_sheet(exampleData);
      
      // Ajustar el ancho de las columnas para mejor visualización
      const wscols = [
        {wch: 10}, // codigo
        {wch: 15}, // marca
        {wch: 40}, // descripcion
        {wch: 10}, // unidad
        {wch: 12}, // lote
        {wch: 15}, // fechaExpiracion
        {wch: 15}  // empresa
      ];
      ws['!cols'] = wscols;
      
      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, "Productos");
      
      // Agregar una hoja con instrucciones
      const instructionsData = [
        {"Instrucciones": "Esta plantilla contiene ejemplos de productos para importar al sistema."},
        {"Instrucciones": "Campos obligatorios: código y descripción."},
        {"Instrucciones": "El sistema detectará automáticamente las columnas aunque tengan nombres diferentes."},
        {"Instrucciones": "Empresas disponibles: Bioscientia, RBC, Consumos, Hemolife."},
        {"Instrucciones": "Formato de fecha recomendado: YYYY-MM-DD (ej: 2025-12-31)."},
      ];
      
      const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
      XLSX.utils.book_append_sheet(wb, wsInstructions, "Instrucciones");
      
      // Generar el archivo y descargarlo
      XLSX.writeFile(wb, "plantilla_productos.xlsx");
      
      setSuccess("Plantilla descargada correctamente");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error al generar la plantilla:", error);
      setError("Error al generar la plantilla de Excel");
    }
  }
  
  // Estado para el formulario manual
  const [manualEntry, setManualEntry] = useState<ProductData>({
    codigo: "",
    marca: "",
    descripcion: "",
    unidad: "",
    lote: "",
    fechaExpiracion: "",
    empresa: "Bioscientia",
    area: "",
    presentacion: ""
  })

  // Manejar cambios en el formulario manual
  const handleManualChange = (field: keyof ProductData, value: string) => {
    setManualEntry(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Manejar la carga de archivo Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(null)
    const file = e.target.files?.[0]
    
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Opciones mejoradas para la conversión de Excel a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: "",       // Usar valor por defecto vacío para celdas vacías
          raw: false,        // Convertir todo a string para evitar problemas con números
          blankrows: false,  // Ignorar filas completamente vacías
          header: "A"        // Usar letras de columnas como encabezados si no hay encabezados
        })
        
        // Detectar si estamos usando encabezados de letras (A, B, C...) o nombres de columnas
        const usingLetterHeaders = jsonData.length > 0 && 
          typeof jsonData[0] === 'object' && 
          jsonData[0] !== null && 
          Object.keys(jsonData[0]).some(key => /^[A-Z]+$/.test(key));
        
        console.log("Usando encabezados de letras:", usingLetterHeaders);
        
        // Si estamos usando encabezados de letras, intentamos detectar la estructura de la tabla
        let processedData = jsonData;
        if (usingLetterHeaders) {
          // Intentar detectar encabezados reales en la primera fila
          const headerRow = jsonData[0];
          const columnMap: Record<string, string> = {};
          
          // Mapear letras de columnas a nombres de columnas basados en la primera fila
          if (headerRow) {
            Object.entries(headerRow).forEach(([letter, value]) => {
              if (value && typeof value === 'string') {
                // Normalizar el nombre de la columna
                const normalizedName = value.toString().toLowerCase()
                  .replace(/\s+/g, '_')
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, ""); // Eliminar acentos
                
                columnMap[letter] = normalizedName;
              }
            });
            
            console.log("Mapa de columnas detectado:", columnMap);
            
            // Transformar los datos usando los nombres de columnas detectados
            processedData = jsonData.slice(1).map((row: any) => {
              const newRow: Record<string, any> = {};
              
              Object.entries(row).forEach(([letter, value]) => {
                const columnName = columnMap[letter] || letter;
                newRow[columnName] = value;
              });
              
              return newRow;
            });
          }
        } else {
          processedData = jsonData;
        }
        
        // Mostrar las columnas disponibles para depurar
        if (processedData.length > 0 && typeof processedData[0] === 'object' && processedData[0] !== null) {
          console.log("Columnas detectadas en el Excel:", Object.keys(processedData[0] as object))
        }
        
        // Mostrar todas las filas para depuración
        console.log("Datos procesados del Excel:", processedData)
        
        // Filtrar filas vacías o que no tengan datos suficientes
        const filteredData = processedData.filter((row: any) => {
          // Si la fila está completamente vacía, la ignoramos
          if (Object.keys(row).length === 0) return false;
          
          // Si todos los valores son vacíos, la ignoramos
          const allEmpty = Object.values(row).every(val => val === "");
          if (allEmpty) return false;
          
          return true;
        });
        
        // Variables para mantener los últimos valores válidos (para manejar celdas combinadas)
        let lastValidValues: Record<string, string> = {
          codigo: "",
          marca: "",
          descripcion: "",
          unidad: "",
          empresa: "Bioscientia",
          area: "",
          presentacion: ""
        };
        
        // Mapa para mantener la relación entre descripciones y códigos
        // Esto ayuda a mantener consistencia cuando hay celdas combinadas
        const descripcionToCodigoMap: Record<string, string> = {};
        
        // Primera pasada: recopilar todas las asociaciones válidas de código-descripción
        filteredData.forEach((row: any) => {
          const codigo = findValueByPossibleKeys(row, ['codigo', 'code', 'sku', 'id', 'clave', 'cód', 'cod', 'código', 'CODIGO', 'CÓDIGO']);
          const descripcion = findValueByPossibleKeys(row, ['descripcion', 'description', 'desc', 'nombre', 'name', 'producto', 'product', 'descripción', 'DESCRIPCION', 'DESCRIPCIÓN']);
          
          // Solo guardar asociaciones donde ambos valores son válidos y el código no parece una fecha
          if (codigo && descripcion && typeof codigo === 'string' && typeof descripcion === 'string') {
            if (!codigo.includes('/') && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(codigo)) {
              descripcionToCodigoMap[descripcion.trim()] = codigo.trim();
              console.log(`Asociación encontrada: "${descripcion}" -> "${codigo}"`);
            }
          }
        });
        
        console.log("Mapa de descripciones a códigos:", descripcionToCodigoMap);
        
        // Mapear las columnas del Excel a los campos requeridos
        const transformedData = filteredData.map((row: any, index) => {
          // Imprimir la fila actual para depuración
          console.log(`Procesando fila ${index + 1}:`, row);
          
          // Buscar el código y descripción en cualquier columna
          let codigo = findValueByPossibleKeys(row, ['codigo', 'code', 'sku', 'id', 'clave', 'cód', 'cod', 'código', 'CODIGO', 'CÓDIGO'])
          let descripcion = findValueByPossibleKeys(row, ['descripcion', 'description', 'desc', 'nombre', 'name', 'producto', 'product', 'descripción', 'DESCRIPCION', 'DESCRIPCIÓN'])
          
          // Validar que el código no sea una fecha (esto ocurre cuando hay celdas combinadas)
          if (codigo && typeof codigo === 'string') {
            // Verificar si el código parece una fecha (contiene barras o tiene formato de fecha)
            if (codigo.includes('/') || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(codigo)) {
              console.warn(`Advertencia: El código "${codigo}" parece ser una fecha. Se usará el código anterior si existe.`);
              codigo = ""; // Lo dejamos vacío para usar el código anterior
            }
          }
          
          // Si el código está vacío, intentar usar el último código válido
          if (!codigo && lastValidValues.codigo) {
            codigo = lastValidValues.codigo;
            console.log(`Usando código anterior para fila ${index + 1}: ${codigo}`);
          } else if (!codigo) {
            codigo = `SIN-CODIGO-${index + 1}`;
          }
          
          // Si la descripción está vacía, usar la última descripción válida (para celdas combinadas)
          if (!descripcion && lastValidValues.descripcion) {
            descripcion = lastValidValues.descripcion;
          } else if (!descripcion) {
            descripcion = `Producto sin descripción ${index + 1}`;
          } else {
            // Si encontramos una descripción válida, la guardamos para filas futuras
            lastValidValues.descripcion = descripcion;
          }
          
          // Buscar el código asociado a esta descripción en nuestro mapa
          const descripcionNormalizada = descripcion.trim();
          
          // Primero intentamos una coincidencia exacta
          if (descripcionToCodigoMap[descripcionNormalizada] && (!codigo || codigo === "" || codigo.includes('/'))) {
            codigo = descripcionToCodigoMap[descripcionNormalizada];
            console.log(`Usando código asociado a la descripción exacta "${descripcion}": ${codigo}`);
          } 
          // Si no hay coincidencia exacta, buscamos una descripción similar
          else if (!codigo || codigo === "" || codigo.includes('/')) {
            // Normalizar la descripción para comparación (quitar espacios extra, convertir a minúsculas)
            const normalizedDesc = descripcionNormalizada.toLowerCase()
              .replace(/\s+/g, ' ')
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, ""); // Eliminar acentos
            
            // Buscar una descripción similar en el mapa
            const similarKey = Object.keys(descripcionToCodigoMap).find(key => {
              const normalizedKey = key.toLowerCase()
                .replace(/\s+/g, ' ')
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
              
              // Verificar si las primeras palabras coinciden (suficiente para identificar el producto)
              const keyWords = normalizedKey.split(' ').filter(w => w.length > 2).slice(0, 3);
              const descWords = normalizedDesc.split(' ').filter(w => w.length > 2).slice(0, 3);
              
              // Si al menos 2 palabras importantes coinciden, consideramos que son el mismo producto
              let matchCount = 0;
              keyWords.forEach(kw => {
                if (descWords.some(dw => dw.includes(kw) || kw.includes(dw))) {
                  matchCount++;
                }
              });
              
              return matchCount >= 2;
            });
            
            if (similarKey) {
              codigo = descripcionToCodigoMap[similarKey];
              console.log(`Usando código asociado a descripción similar: "${similarKey}" -> "${codigo}" para "${descripcion}"`);
            }
          }
          
          // Buscar otros campos con valores por defecto si no se encuentran
          let marca = findValueByPossibleKeys(row, ['marca', 'brand', 'fabricante', 'manufacturer', 'MARCA'])
          let unidad = findValueByPossibleKeys(row, ['unidad', 'unit', 'medida', 'measure', 'um', 'UNIDAD'])
          let lote = findValueByPossibleKeys(row, ['lote', 'lot', 'batch', 'no. lote', 'numero de lote', 'LOTE'])
          let fechaExpiracion = findValueByPossibleKeys(row, ['fechaExpiracion', 'expiracion', 'expiry', 'caducidad', 'vencimiento', 'fecha exp', 'exp date', 'caducidad', 'fecha caducidad', 'fecha vencimiento', 'f', 'f caducidad', 'CADUCIDAD', 'F'])
          // Convertir la fecha al formato numérico si es necesario
          fechaExpiracion = convertirFormatoFecha(fechaExpiracion)
          let empresa = findValueByPossibleKeys(row, ['empresa', 'company', 'proveedor', 'supplier']) || lastValidValues.empresa || "Bioscientia"
          let area = findValueByPossibleKeys(row, ['area', 'área', 'sector', 'departamento', 'depto', 'seccion', 'sección', 'a', 'a area', 'AREA', 'ÁREA'])
          let presentacion = findValueByPossibleKeys(row, ['presentacion', 'presentación', 'formato', 'envase', 'empaque', 'package', 'presentation', 'h', 'h presentacion', 'PRESENTACION', 'PRESENTACIÓN'])
          
          // Manejar celdas combinadas: usar valores anteriores si están vacíos
          if (!marca && lastValidValues.marca) marca = lastValidValues.marca;
          if (!unidad && lastValidValues.unidad) unidad = lastValidValues.unidad;
          if (!area && lastValidValues.area) area = lastValidValues.area;
          if (!presentacion && lastValidValues.presentacion) presentacion = lastValidValues.presentacion;
          
          // Asegurar que marca nunca quede vacía
          if (!marca) {
            // Intentar extraer la marca de la descripción
            const palabras = descripcion.split(' ');
            if (palabras.length > 0) {
              // Si la primera palabra parece ser una marca (en mayúsculas o con pocos caracteres)
              if (palabras[0] === palabras[0].toUpperCase() || palabras[0].length < 6) {
                marca = palabras[0];
              } else {
                // Si no podemos extraer una marca, usamos un valor por defecto
                marca = "GENÉRICO";
              }
            } else {
              marca = "GENÉRICO";
            }
          }
          
          // Asegurar que unidad nunca quede vacía
          if (!unidad) unidad = "PZ";
          
          // Verificar si el código es válido (no es una fecha ni está vacío)
          const isValidCode = codigo && !codigo.includes('/') && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(codigo);
          
          // Si tenemos un código válido para esta fila, lo guardamos
          if (isValidCode) {
            lastValidValues.codigo = codigo;
          } 
          // Si no tenemos un código válido pero sí tenemos uno anterior y la descripción es similar
          else if (lastValidValues.codigo && descripcion) {
            // Verificar si la descripción actual es similar a alguna descripción ya asociada a un código
            const similarDescriptionFound = Object.keys(descripcionToCodigoMap).some(desc => {
              // Comparar las primeras palabras de las descripciones
              const words1 = desc.split(' ').filter(w => w.length > 2).slice(0, 3);
              const words2 = descripcion.split(' ').filter(w => w.length > 2).slice(0, 3);
              
              // Si hay al menos 2 palabras similares, consideramos que son descripciones similares
              return words1.some(w1 => words2.some(w2 => w1.includes(w2) || w2.includes(w1)));
            });
            
            if (similarDescriptionFound) {
              codigo = lastValidValues.codigo;
              console.log(`Usando código anterior para descripción similar: ${codigo}`);
            }
          }
          
          // Guardar los valores válidos para la siguiente fila
          if (marca) lastValidValues.marca = marca;
          if (unidad) lastValidValues.unidad = unidad;
          if (empresa) lastValidValues.empresa = empresa;
          if (area) lastValidValues.area = area;
          if (presentacion) lastValidValues.presentacion = presentacion;
          
          // Mostrar los valores procesados para depuración
          console.log(`Fila ${index + 1} procesada - Código: "${codigo}", Marca: "${marca}", Descripción: "${descripcion}", Área: "${area}"`);
          
          return {
            codigo: codigo.toString(),
            marca: marca.toString(),
            descripcion: descripcion.toString(),
            unidad: unidad.toString(),
            lote: lote.toString(),
            fechaExpiracion: fechaExpiracion, // Ya convertido al formato numérico
            empresa: empresa.toString(),
            area: area.toString(),
            presentacion: presentacion.toString()
          }
        })
        
        // Mostrar el JSON final que se genera para la inserción
        console.log("JSON FINAL PARA INSERCIÓN:", JSON.stringify(transformedData, null, 2))
        
        setExcelData(transformedData)
        setPreviewData(transformedData.slice(0, 10)) // Mostrar solo las primeras 10 filas en la vista previa
      } catch (error: any) {
        console.error("Error al procesar el archivo Excel:", error)
        setError(`Error al procesar el archivo: ${error.message || "Formato no válido"}`)
        setExcelData([])
        setPreviewData([])
      }
    }
    
    reader.onerror = () => {
      setError("Error al leer el archivo")
    }
    
    reader.readAsBinaryString(file)
  }
  
  // Función para convertir fechas al formato numérico esperado por el backend
  const convertirFormatoFecha = (fecha: string): string => {
    if (!fecha) return "";
    
    // Si ya es un número, devolverlo como está (ya está en formato numérico)
    if (/^\d+$/.test(fecha)) return fecha;
    
    // Detectar si es un formato de fecha como MM/DD/YY o DD/MM/YY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(fecha)) {
      try {
        // Extraer las partes de la fecha
        const partes = fecha.split('/');
        let mes, dia, anio;
        
        // Formato americano MM/DD/YY
        if (partes[0] <= "12") {
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
        
        // Convertir a formato numérico (similar a Excel)
        // Excel usa días desde 1/1/1900, pero simplificaremos usando un valor base
        // Para este caso, usaremos el formato que espera el backend
        // Por ejemplo, para 9/30/26 (30 de septiembre de 2026) -> 45900
        
        // Calcular días desde 1/1/1900 (formato Excel)
        const fecha1900 = new Date(1900, 0, 1);
        const fechaActual = new Date(anio, mes - 1, dia);
        const diasDesde1900 = Math.floor((fechaActual.getTime() - fecha1900.getTime()) / (1000 * 60 * 60 * 24)) + 2; // +2 por ajuste de Excel
        
        return diasDesde1900.toString();
      } catch (error) {
        console.error("Error al convertir fecha:", error);
        return fecha; // Devolver la fecha original si hay error
      }
    }
    
    // Si no es un formato reconocible, devolver la fecha original
    return fecha;
  };
  
  // Función auxiliar para buscar valores por posibles claves
  const findValueByPossibleKeys = (obj: any, possibleKeys: string[]): string => {
    // Si el objeto es nulo o indefinido, devolver cadena vacía
    if (!obj) return "";
    
    // Convertir todas las claves del objeto a minúsculas para comparación insensible a mayúsculas/minúsculas
    const lowerCaseObj: Record<string, any> = {}
    try {
      Object.keys(obj).forEach(key => {
        // Asegurarse de que el valor no sea nulo o indefinido
        const value = obj[key] === null || obj[key] === undefined ? "" : obj[key];
        // Convertir valores numéricos a string
        lowerCaseObj[key.toLowerCase().trim()] = value.toString ? value.toString() : String(value);
      })
    } catch (error) {
      console.error("Error al procesar las claves del objeto:", error);
      console.log("Objeto problemático:", obj);
      return "";
    }
    
    // Buscar coincidencias exactas primero
    for (const key of possibleKeys) {
      const lowerKey = key.toLowerCase().trim()
      if (lowerKey in lowerCaseObj && lowerCaseObj[lowerKey] !== "") {
        return lowerCaseObj[lowerKey]
      }
    }
    
    // Si no hay coincidencias exactas, buscar coincidencias parciales
    for (const key of possibleKeys) {
      const lowerKey = key.toLowerCase().trim()
      for (const objKey of Object.keys(lowerCaseObj)) {
        if (objKey.includes(lowerKey) && lowerCaseObj[objKey] !== "") {
          return lowerCaseObj[objKey]
        }
      }
    }
    
    // Si no hay coincidencias parciales, buscar por palabras clave en las claves
    for (const objKey of Object.keys(lowerCaseObj)) {
      for (const key of possibleKeys) {
        const lowerKey = key.toLowerCase().trim()
        const keyWords = lowerKey.split(/\s+/)
        // Si alguna palabra clave está en la clave del objeto
        if (keyWords.some(word => objKey.includes(word)) && lowerCaseObj[objKey] !== "") {
          return lowerCaseObj[objKey]
        }
      }
    }
    
    // Buscar cualquier valor en las columnas que puedan contener el tipo de dato que buscamos
    // Por ejemplo, si buscamos marca, podemos intentar usar la descripción o el código
    if (possibleKeys.some(k => k.toLowerCase().includes('marca'))) {
      // Si estamos buscando la marca y no la encontramos, intentamos extraerla de la descripción
      const descripcion = findValueByPossibleKeys(obj, ['descripcion', 'description', 'desc', 'nombre', 'name']);
      if (descripcion) {
        const palabras = descripcion.split(' ');
        // Si la primera palabra parece ser una marca (en mayúsculas o con pocos caracteres)
        if (palabras.length > 0 && (palabras[0] === palabras[0].toUpperCase() || palabras[0].length < 6)) {
          return palabras[0];
        }
      }
    }
    
    // Si no se encuentra ninguna coincidencia, devolver cadena vacía
    return ""
  }

  // Manejar la inserción manual
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Validar datos mínimos
      if (!manualEntry.codigo || !manualEntry.descripcion) {
        throw new Error("El código y la descripción son obligatorios")
      }
      
      await onDataImported([manualEntry])
      setSuccess("Producto agregado correctamente")
      
      // Limpiar el formulario
      setManualEntry({
        codigo: "",
        marca: "",
        descripcion: "",
        unidad: "",
        lote: "",
        fechaExpiracion: "",
        empresa: "Bioscientia",
        area: "",
        presentacion: ""
      })
    } catch (error: any) {
      console.error("Error al insertar datos:", error)
      setError(`Error al insertar datos: ${error.message || "Ocurrió un error desconocido"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Manejar la importación desde Excel
  const handleExcelImport = async () => {
    if (excelData.length === 0) {
      setError("No hay datos para importar")
      return
    }
    
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      await onDataImported(excelData)
      setSuccess(`Se importaron ${excelData.length} productos correctamente`)
      setExcelData([])
      setPreviewData([])
      
      // Limpiar el input de archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error: any) {
      console.error("Error al importar datos:", error)
      setError(`Error al importar datos: ${error.message || "Ocurrió un error desconocido"}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <span>Importador de Datos</span>
        </CardTitle>
        <CardDescription>Agrega productos a la base de datos manualmente o desde un archivo Excel</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="font-bold">Entrada Manual</TabsTrigger>
            <TabsTrigger value="excel" className="font-bold">Importar Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="area" className="font-bold">Área</Label>
                  <Input
                    id="area"
                    placeholder="Área o departamento"
                    value={manualEntry.area}
                    onChange={(e) => handleManualChange("area", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo" className="font-bold">Código *</Label>
                  <Input
                    id="codigo"
                    placeholder="Código del producto"
                    value={manualEntry.codigo}
                    onChange={(e) => handleManualChange("codigo", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="descripcion" className="font-bold">Descripción *</Label>
                  <Input
                    id="descripcion"
                    placeholder="Descripción del producto"
                    value={manualEntry.descripcion}
                    onChange={(e) => handleManualChange("descripcion", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marca" className="font-bold">Marca</Label>
                  <Input
                    id="marca"
                    placeholder="Marca del producto"
                    value={manualEntry.marca}
                    onChange={(e) => handleManualChange("marca", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lote" className="font-bold">Lote</Label>
                  <Input
                    id="lote"
                    placeholder="Número de lote"
                    value={manualEntry.lote}
                    onChange={(e) => handleManualChange("lote", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaExpiracion" className="font-bold">Caducidad</Label>
                  <Input
                    id="fechaExpiracion"
                    type="date"
                    value={manualEntry.fechaExpiracion}
                    onChange={(e) => handleManualChange("fechaExpiracion", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unidad" className="font-bold">Unidad</Label>
                  <Input
                    id="unidad"
                    placeholder="Unidad de medida"
                    value={manualEntry.unidad}
                    onChange={(e) => handleManualChange("unidad", e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="presentacion" className="font-bold">Presentación</Label>
                  <Input
                    id="presentacion"
                    placeholder="Formato de presentación del producto"
                    value={manualEntry.presentacion}
                    onChange={(e) => handleManualChange("presentacion", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="empresa" className="font-bold">Empresa</Label>
                  <select
                    id="empresa"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={manualEntry.empresa}
                    onChange={(e) => handleManualChange("empresa", e.target.value)}
                  >
                    <option value="Bioscientia">Bioscientia</option>
                    <option value="RBC">RBC</option>
                    <option value="Consumos">Consumos</option>
                    <option value="Hemolife">Hemolife</option>
                  </select>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Guardar Producto"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="excel" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span>Descargar Plantilla</span>
                </Button>
              </div>
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="text-lg font-medium mb-2 text-blue-800">Formato del archivo Excel</h3>
                <p className="text-sm text-blue-700 mb-2">El sistema detectará automáticamente las columnas en tu archivo Excel, incluso si tienen nombres diferentes. Los datos que se buscarán son:</p>
                <ul className="list-disc pl-5 text-sm text-blue-700 mb-2">
                  <li><strong>Área</strong> - Área o departamento - Se buscará en columnas como: area, área, sector, departamento, depto, etc.</li>
                  <li><strong>Código</strong> - Identificador del producto (obligatorio) - Se buscará en columnas como: codigo, code, sku, id, clave, etc.</li>
                  <li><strong>Descripción</strong> - Descripción del producto (obligatorio) - Se buscará en columnas como: descripcion, description, desc, nombre, name, etc.</li>
                  <li><strong>Marca</strong> - Marca del producto - Se buscará en columnas como: marca, brand, fabricante, etc.</li>
                  <li><strong>Lote</strong> - Número de lote - Se buscará en columnas como: lote, lot, batch, etc.</li>
                  <li><strong>Caducidad</strong> - Se buscará en columnas como: fechaExpiracion, expiracion, caducidad, vencimiento, etc.</li>
                  <li><strong>Unidad</strong> - Unidad de medida - Se buscará en columnas como: unidad, unit, medida, um, etc.</li>
                  <li><strong>Presentación</strong> - Formato de presentación - Se buscará en columnas como: presentacion, presentación, formato, envase, empaque, etc.</li>
                  <li><strong>Empresa</strong> - Se buscará en columnas como: empresa, company, proveedor, etc.</li>
                </ul>
                <div className="bg-green-50 p-2 rounded border border-green-200 mt-2">
                  <p className="text-sm text-green-700 font-medium">¡Nuevo! El sistema ahora detecta automáticamente las columnas de tu Excel, sin importar cómo estén nombradas.</p>
                </div>
                <p className="text-sm text-blue-700 mt-2">Puedes descargar una plantilla con el formato recomendado usando el botón "Descargar Plantilla".</p>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file"
                />
                <Label htmlFor="excel-file" className="cursor-pointer flex flex-col items-center">
                  <FileSpreadsheet className="h-12 w-12 text-gray-400 mb-2" />
                  <span className="text-lg font-medium mb-1">Selecciona un archivo Excel</span>
                  <span className="text-sm text-gray-500">o arrastra y suelta aquí</span>
                </Label>
              </div>
              
              {previewData.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Vista previa ({previewData.length} de {excelData.length} registros)</h3>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead>Lote</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.codigo}</TableCell>
                            <TableCell>{item.descripcion}</TableCell>
                            <TableCell>{item.marca}</TableCell>
                            <TableCell>{item.unidad}</TableCell>
                            <TableCell>{item.lote}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <Button 
                    onClick={handleExcelImport} 
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      "Importando..."
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar {excelData.length} Productos
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mt-4 bg-green-50 text-green-800 border-green-200">
            <Check className="h-4 w-4" />
            <AlertTitle>Éxito</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
