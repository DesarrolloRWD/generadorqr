"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { QRCodeSVG } from 'qrcode.react'
import ReactDOMServer from 'react-dom/server'
import JsBarcode from 'jsbarcode'
import { Download, RotateCcw, Printer } from "lucide-react"
// printJS se importará dinámicamente solo en el cliente

interface LoteData {
  lote: string
  fechaExpiracion: string
}

interface ProductData {
  codigo: string
  marca: string
  descripcion: string
  unidad: string
  lotes: LoteData[]
  empresa: string
}

interface LabelConfig {
  showCodigo: boolean
  showMarca: boolean
  showDescripcion: boolean
  showUnidad: boolean
  showLote: boolean
  showEmpresa: boolean
  showFechaExpiracion: boolean
}

// Lista de empresas disponibles con mapeo a logos
const empresasDisponibles = [
  "Bioscientia",
  "RBC",
  "Consumos",
  "Hemolife"
];

// Mapeo de empresas a logos
const empresaLogoMap: Record<string, string> = {
  "Bioscientia": "/logos/L1.jpg",
  "RBC": "/logos/L2.jpg",
  "Consumos": "/logos/L3.jpg",
  "Hemolife": "/logos/L4.jpg"
};

export default function QRBarcodeGenerator() {
  const [productData, setProductData] = useState<ProductData>({
    codigo: "",
    marca: "",
    descripcion: "",
    unidad: "",
    lotes: [{ lote: "", fechaExpiracion: "" }],
    empresa: "Bioscientia"
  })
  
  // Estado para manejar múltiples lotes seleccionados
  const [selectedLotes, setSelectedLotes] = useState<number[]>([])
  
  // Configuración de la etiqueta (qué campos mostrar) con persistencia
  const [labelConfig, setLabelConfig] = useState<LabelConfig>(() => {
    // Intentar cargar la configuración guardada en localStorage
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('labelConfig')
      if (savedConfig) {
        try {
          return JSON.parse(savedConfig)
        } catch (e) {
          console.error('Error al cargar la configuración guardada:', e)
        }
      }
    }
    // Configuración predeterminada si no hay nada guardado
    return {
      showCodigo: true,
      showMarca: true,
      showDescripcion: true,
      showUnidad: true,
      showLote: true,
      showEmpresa: false,
      showFechaExpiracion: true
    }
  })

  const [activeTab, setActiveTab] = useState("qr")
  const [qrFormat, setQrFormat] = useState("spaces") // Formato por defecto: espacios
  const barcodeRef = useRef<SVGSVGElement>(null)

  const handleInputChange = (field: keyof ProductData, value: string) => {
    setProductData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Función para actualizar la configuración de la etiqueta y guardarla en localStorage
  const updateLabelConfig = (field: keyof LabelConfig, value: boolean) => {
    const newConfig = {
      ...labelConfig,
      [field]: value
    }
    setLabelConfig(newConfig)
    
    // Guardar en localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('labelConfig', JSON.stringify(newConfig))
      } catch (e) {
        console.error('Error al guardar la configuración:', e)
      }
    }
  }

  const resetForm = () => {
    setProductData({
      codigo: "",
      marca: "",
      descripcion: "",
      unidad: "",
      lotes: [{ lote: "", fechaExpiracion: "" }],
      empresa: "Bioscientia"
    })
  }

  // Estado para el lote actualmente seleccionado (para compatibilidad)
  const [currentLoteIndex, setCurrentLoteIndex] = useState(0)
  
  // Función para manejar la selección de lotes
  const toggleLoteSelection = (index: number) => {
    setSelectedLotes(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  }
  
  // Generar datos para QR según el formato seleccionado y el lote actual
  const getQRData = (loteIndex = currentLoteIndex) => {
    // Verificar que el índice del lote es válido
    if (loteIndex < 0 || loteIndex >= productData.lotes.length) {
      loteIndex = 0
    }
    
    const currentLote = productData.lotes[loteIndex]
    
    // Crear un objeto con solo los datos que deben ir en el QR
    const qrDataOnly = {
      codigo: productData.codigo,
      marca: productData.marca,
      descripcion: productData.descripcion,
      unidad: productData.unidad,
      lote: currentLote.lote
    }
    
    switch (qrFormat) {
      case 'json':
        return JSON.stringify(qrDataOnly)
      case 'dash':
        return [
          `codigo-${productData.codigo}`,
          `marca-${productData.marca}`,
          `descripcion-${productData.descripcion}`,
          `unidad-${productData.unidad}`,
          `lote-${currentLote.lote}`
        ].join('\n')
      case 'spaces':
      default:
        return [
          `codigo  ${productData.codigo}`,
          `marca  ${productData.marca}`,
          `descripcion  ${productData.descripcion}`,
          `unidad  ${productData.unidad}`,
          `lote  ${currentLote.lote}`
        ].join('\n')
    }
  }

  // Generar código de barras
  useEffect(() => {
    if (productData.codigo && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, productData.codigo, {
          format: "CODE128",
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 10,
        })
      } catch (error) {
        console.error("Error generating barcode:", error)
      }
    }
  }, [productData.codigo])

  const downloadQR = (loteIndex = currentLoteIndex) => {
    const canvas = document.createElement("canvas")
    const svg = document.querySelector(`#qr-code-${loteIndex} svg`)
    
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg)
      const img = new Image()
      
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0)
        
        const pngFile = canvas.toDataURL("image/png")
        const downloadLink = document.createElement("a")
        
        const loteActual = productData.lotes[loteIndex]?.lote || ''
        downloadLink.download = `qr-${productData.codigo}-lote-${loteActual}.png`
        downloadLink.href = pngFile
        downloadLink.click()
      }
      
      img.src = "data:image/svg+xml;base64," + btoa(svgData)
    }
  }
  
  // Función para imprimir en impresora Zebra usando PrintJS para impresión directa
  const printToZebra = async (loteIndex = currentLoteIndex, printAll = false, useSelectedLotes = false) => {
    try {
      // Verificar que estamos en el navegador
      if (typeof window === 'undefined') {
        console.error('Esta función solo puede ejecutarse en el navegador');
        return;
      }
      
      // Importar printJS dinámicamente solo en el cliente
      const printJSModule = await import('print-js');
      const printJS = printJSModule.default;
      
      // Si printAll es true, imprimiremos todas las etiquetas por separado
      if (printAll) {
        // Imprimir cada lote con un pequeño retraso entre ellos
        productData.lotes.forEach((_, index) => {
          setTimeout(() => printToZebra(index, false), index * 1000)
        })
        return
      }
      
      // Determinar qué lotes imprimir
      let lotesAImprimir: number[] = [];
      
      if (useSelectedLotes && selectedLotes.length > 0) {
        // Usar los lotes seleccionados
        lotesAImprimir = selectedLotes;
      } else if (printAll) {
        // Imprimir todos los lotes en una sola etiqueta
        lotesAImprimir = productData.lotes.map((_, index) => index);
      } else {
        // Verificar que el índice del lote es válido
        if (loteIndex < 0 || loteIndex >= productData.lotes.length) {
          loteIndex = 0;
        }
        lotesAImprimir = [loteIndex];
      }
      
      // Fecha actual formateada
      const fechaActual = new Date();
      const fechaFormateada = fechaActual.toLocaleDateString('es-ES');
      
      // Crear los contenidos QR para todos los lotes seleccionados
      const qrCodesHTML = lotesAImprimir.map(loteIndex => {
        const qrDiv = document.createElement('div');
        qrDiv.innerHTML = ReactDOMServer.renderToString(
          <QRCodeSVG value={getQRData(loteIndex)} size={180} level="M" includeMargin={true} />
        );
        return qrDiv.innerHTML;
      });
      
      // Crear el contenido HTML de la etiqueta
      const labelHTML = `
        <div class="container" id="zebra-label">
          <div class="header">
            <img src="${empresaLogoMap[productData.empresa]}" class="empresa-logo" alt="Logo" />
          </div>
          
          <div class="info-section">
            <table class="info-table">
              <tr>
                <td><span class="info-label">Cód:</span></td>
                <td><span class="info-value">${productData.codigo}</span></td>
                <td><span class="info-label">Marca:</span></td>
                <td><span class="info-value">${productData.marca}</span></td>
              </tr>
              <tr>
                <td><span class="info-label">Desc:</span></td>
                <td><span class="info-value">${productData.descripcion}</span></td>
                <td><span class="info-label">Unid:</span></td>
                <td><span class="info-value">${productData.unidad}</span></td>
              </tr>
              <tr>
                <td><span class="info-label">Fecha:</span></td>
                <td colspan="3"><span class="info-value">${fechaFormateada}</span></td>
              </tr>
            </table>
          </div>
          
          <div class="qr-grid-${lotesAImprimir.length}">
            ${lotesAImprimir.map((idx, i) => {
              const lote = productData.lotes[idx];
              return `
                <div class="qr-item">
                  <div class="qr-header">Lote: ${lote.lote || ''}</div>
                  <div class="qr-code">${qrCodesHTML[i]}</div>
                  ${lote.fechaExpiracion ? `<div class="qr-footer">Exp: ${lote.fechaExpiracion}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      
      // Crear un div temporal para contener la etiqueta
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.innerHTML = labelHTML;
      // No añadimos el div al body aquí, lo haremos justo antes de imprimir
      
      // Crear una hoja de estilos para la impresión
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `
        @page {
          size: 10cm 10cm;
          margin: 0;
        }
        .container {
          width: 10cm;
          height: auto;
          max-height: 10cm;
          padding: 0.15cm;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
          background-color: white;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .header {
          text-align: center;
          margin-bottom: 0.3cm;
          padding: 0.2cm 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .empresa-logo {
          max-width: 180px;
          max-height: 60px;
        }
        .info-section {
          margin-bottom: 0.2cm;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
        }
        .info-table td {
          padding: 0.05cm 0.1cm;
        }
        .info-label {
          font-weight: bold;
          color: #333;
          white-space: nowrap;
        }
        .info-value {
          font-weight: bold;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding-right: 0.2cm;
        }
        /* Estilos base para todos los QR */
        .qr-item {
          border: 1px solid #ddd;
          border-radius: 0.1cm;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background-color: white;
        }
        .qr-header {
          width: 100%;
          padding: 0.02cm;
          text-align: center;
          font-weight: bold;
          font-size: 7pt;
          border-bottom: 1px solid #eee;
          background-color: #f8f8f8;
        }
        .qr-code {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.05cm;
          background-color: white;
          flex-grow: 1;
        }
        .qr-footer {
          width: 100%;
          padding: 0.02cm;
          text-align: center;
          font-weight: bold;
          font-size: 7pt;
          border-top: 1px solid #eee;
          background-color: #f8f8f8;
        }
        
        /* Estilos específicos para 1 QR */
        .qr-grid-1 {
          display: flex;
          justify-content: center;
          padding: 0.1cm;
          margin-top: 0.1cm;
        }
        .qr-grid-1 .qr-item {
          width: 80%;
          height: 6cm;
          position: relative;
        }
        .qr-grid-1 .qr-code svg {
          width: 5cm;
          height: 5cm;
        }
        .qr-grid-1 .qr-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          margin-top: 0.5cm;
        }
        
        /* Estilos específicos para 2 QR */
        .qr-grid-2 {
          display: flex;
          justify-content: space-around;
          padding: 0.1cm;
          margin-top: 0.1cm;
        }
        .qr-grid-2 .qr-item {
          width: 48%;
          height: 5cm;
        }
        .qr-grid-2 .qr-code svg {
          width: 4cm;
          height: 4cm;
        }
        
        /* Estilos específicos para 3 QR */
        .qr-grid-3 {
          display: flex;
          justify-content: space-between;
          padding: 0.1cm;
          margin-top: 0.1cm;
        }
        .qr-grid-3 .qr-item {
          width: 32%;
          height: 4.5cm;
        }
        .qr-grid-3 .qr-code svg {
          width: 3cm;
          height: 3cm;
        }
        
        /* Estilos para 4 o más QR */
        .qr-grid-4, .qr-grid-5, .qr-grid-6, .qr-grid-7, .qr-grid-8, .qr-grid-9, .qr-grid-10, .qr-grid-11, .qr-grid-12 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.2cm;
          padding: 0.1cm;
          margin-top: 0.1cm;
        }
        .qr-grid-4 .qr-item, .qr-grid-5 .qr-item, .qr-grid-6 .qr-item, .qr-grid-7 .qr-item, .qr-grid-8 .qr-item, .qr-grid-9 .qr-item, .qr-grid-10 .qr-item, .qr-grid-11 .qr-item, .qr-grid-12 .qr-item {
          height: 3.5cm;
        }
        .qr-grid-4 .qr-code svg, .qr-grid-5 .qr-code svg, .qr-grid-6 .qr-code svg, .qr-grid-7 .qr-code svg, .qr-grid-8 .qr-code svg, .qr-grid-9 .qr-code svg, .qr-grid-10 .qr-code svg, .qr-grid-11 .qr-code svg, .qr-grid-12 .qr-code svg {
          width: 2.5cm;
          height: 2.5cm;
        }
        /* Footer eliminado */
      `;
      document.head.appendChild(styleSheet);
      
      // Crear un título para la impresión
      const lotesTexto = lotesAImprimir.length === 1 
        ? `Lote ${productData.lotes[lotesAImprimir[0]].lote}` 
        : `${lotesAImprimir.length} Lotes Seleccionados`;
      
      // Usar PrintJS para imprimir directamente
      // Primero, asegurarse de que el elemento esté en el DOM
      document.body.appendChild(tempDiv);
      
      // Obtener el HTML completo del elemento con sus estilos aplicados
      const elementToPrint = document.getElementById('zebra-label');
      
      if (!elementToPrint) {
        console.error('No se encontró el elemento a imprimir');
        alert('Error al preparar la impresión. No se encontró el elemento.');
        return;
      }
      
      // Usar PrintJS con el contenido HTML directamente
      printJS({
        printable: tempDiv.innerHTML,
        type: 'raw-html',
        documentTitle: `Etiqueta - ${lotesTexto}`,
        style: styleSheet.textContent,
        css: styleSheet.textContent,
        scanStyles: false,
        targetStyles: ['*'],
        maxWidth: 110, // 11cm en mm
        showModal: false,
        onPrintDialogClose: () => {
          // Limpiar después de imprimir
          document.body.removeChild(tempDiv);
          document.head.removeChild(styleSheet);
        },
        onError: (error) => {
          console.error('Error en la impresión:', error);
          alert('Error al imprimir. Por favor, intenta de nuevo.');
          document.body.removeChild(tempDiv);
          document.head.removeChild(styleSheet);
        }
      });
      
    } catch (error) {
      console.error("Error al preparar la impresión:", error);
      alert("Error al preparar la impresión. Por favor, intenta de nuevo.");
    }
  }

  const downloadBarcode = () => {
    if (barcodeRef.current) {
      const svgData = new XMLSerializer().serializeToString(barcodeRef.current)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx?.drawImage(img, 0, 0)

        const link = document.createElement("a")
        link.download = `Barcode-${productData.codigo || "codigo"}.png`
        link.href = canvas.toDataURL()
        link.click()
      }

      img.src = "data:image/svg+xml;base64," + btoa(svgData)
    } else {
      console.error("La referencia al código de barras no está disponible")
      alert("No se pudo descargar el código de barras. Por favor, genera primero el código.")
    }
  }

  const isFormValid =
    productData.codigo && productData.marca && productData.descripcion && productData.unidad && 
    productData.lotes.length > 0 && productData.lotes[currentLoteIndex]?.lote

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Generador de QR y Códigos de Barras</h1>
          <p className="text-gray-500 font-bold">Genera códigos QR y de barras con información completa del producto</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Formulario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="font-bold">Información del Producto</span>
                <Button variant="outline" size="sm" onClick={resetForm} className="ml-auto">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  <span className="font-bold">Limpiar</span>
                </Button>
              </CardTitle>
              <CardDescription className="font-bold">Completa todos los campos para generar los códigos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="empresa" className="font-bold">Seleccionar Logo</Label>
                  <select
                    id="empresa"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-bold ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={productData.empresa}
                    onChange={(e) => handleInputChange("empresa", e.target.value)}
                  >
                    {empresasDisponibles.map((empresa) => (
                      <option key={empresa} value={empresa}>{empresa}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="codigo" className="font-bold">Código</Label>
                  <Input
                    id="codigo"
                    placeholder="Código o ID del paciente"
                    value={productData.codigo}
                    onChange={(e) => handleInputChange("codigo", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="marca" className="font-bold">Marca</Label>
                  <Input
                    id="marca"
                    placeholder="Marca del producto"
                    value={productData.marca}
                    onChange={(e) => handleInputChange("marca", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="descripcion" className="font-bold">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    placeholder="Descripción del producto"
                    value={productData.descripcion}
                    onChange={(e) => handleInputChange("descripcion", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unidad" className="font-bold">Unidad</Label>
                  <Input
                    id="unidad"
                    placeholder="Unidad de medida"
                    value={productData.unidad}
                    onChange={(e) => handleInputChange("unidad", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-bold text-sm mb-1">Lotes</Label>
                  <div className="border rounded-md p-3 bg-gray-50">
                    {productData.lotes.map((lote, index) => (
                      <div key={index} className={`flex flex-col gap-2 p-2 mb-2 border rounded ${index === currentLoteIndex ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{`Lote ${index + 1}`}</span>
                          <div className="flex gap-2">
                            <div className="flex gap-1">
                              <button 
                                type="button" 
                                className={`px-2 py-1 text-xs rounded ${index === currentLoteIndex ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => setCurrentLoteIndex(index)}
                              >
                                {index === currentLoteIndex ? 'Actual' : 'Actual'}
                              </button>
                              <button 
                                type="button" 
                                className={`px-2 py-1 text-xs rounded ${selectedLotes.includes(index) ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => toggleLoteSelection(index)}
                              >
                                {selectedLotes.includes(index) ? '✓' : '+'}
                              </button>
                            </div>
                            <button 
                              type="button" 
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                              onClick={() => {
                                const newLotes = [...productData.lotes]
                                newLotes.splice(index, 1)
                                if (newLotes.length === 0) {
                                  newLotes.push({ lote: '', fechaExpiracion: '' })
                                }
                                setProductData({...productData, lotes: newLotes})
                                if (currentLoteIndex >= newLotes.length) {
                                  setCurrentLoteIndex(newLotes.length - 1)
                                }
                              }}
                              disabled={productData.lotes.length <= 1}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor={`lote-${index}`} className="text-xs font-bold">Número de Lote</Label>
                          <Input
                            id={`lote-${index}`}
                            value={lote.lote}
                            onChange={(e) => {
                              const newLotes = [...productData.lotes]
                              newLotes[index] = {...newLotes[index], lote: e.target.value}
                              setProductData({...productData, lotes: newLotes})
                            }}
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor={`fechaExp-${index}`} className="text-xs font-bold">Fecha de Expiración</Label>
                          <Input
                            type="date"
                            id={`fechaExp-${index}`}
                            value={lote.fechaExpiracion}
                            onChange={(e) => {
                              const newLotes = [...productData.lotes]
                              newLotes[index] = {...newLotes[index], fechaExpiracion: e.target.value}
                              setProductData({...productData, lotes: newLotes})
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      className="w-full mt-2 py-2 bg-green-500 text-white rounded flex items-center justify-center gap-2"
                      onClick={() => {
                        setProductData({
                          ...productData,
                          lotes: [...productData.lotes, { lote: '', fechaExpiracion: '' }]
                        })
                      }}
                    >
                      <span>+ Agregar nuevo lote</span>
                    </button>
                  </div>
                </div>

              </div>


            </CardContent>
          </Card>

          {/* Generador de Códigos */}
          <Card>
            <CardHeader>
              <CardTitle className="font-bold">Códigos Generados</CardTitle>
              <CardDescription className="font-bold">Selecciona el tipo de código que deseas generar</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr" className="font-bold">Código QR</TabsTrigger>
                  <TabsTrigger value="barcode" className="font-bold">Código de Barras</TabsTrigger>
                </TabsList>

                <TabsContent value="qr" className="space-y-4">
                  <div className="text-center">
                    {isFormValid ? (
                      <div className="space-y-4">
                        <div className="mb-4">
                          <Label htmlFor="qr-format" className="block text-sm font-bold text-left mb-1">Formato de datos</Label>
                          <select 
                            id="qr-format"
                            value={qrFormat}
                            onChange={(e) => setQrFormat(e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="spaces">Texto con espacios</option>
                            <option value="dash">Texto con guiones</option>
                            <option value="json">JSON (formato completo)</option>
                          </select>
                        </div>
                        <div className="mb-4">
                          <h3 className="text-lg font-bold mb-3">Códigos QR para cada lote:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {productData.lotes.map((lote, index) => (
                              <div key={index} className="flex flex-col items-center border p-4 rounded-lg">
                                <div className="text-center mb-2">
                                  <span className="font-bold">Lote: {lote.lote}</span>
                                  {lote.fechaExpiracion && (
                                    <div className="text-sm text-gray-500 font-bold">Exp: {lote.fechaExpiracion}</div>
                                  )}
                                </div>
                                <div id={`qr-code-${index}`} className="flex justify-center p-4 bg-white rounded-lg border">
                                  <QRCodeSVG value={getQRData(index)} size={180} level="M" includeMargin={true} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => printToZebra(0, false, true)}
                              disabled={selectedLotes.length === 0}
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              Imprimir Lotes Seleccionados ({selectedLotes.length})
                            </Button>
                            <Button onClick={() => printToZebra(currentLoteIndex)} variant="secondary">
                              <Printer className="h-4 w-4 mr-2" />
                              Imprimir Lote Actual
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 font-bold p-2 bg-gray-50 rounded">
                          <strong>Datos incluidos:</strong>
                          <pre className="mt-1 text-left overflow-auto">{qrFormat === 'json' ? 
                            JSON.stringify(JSON.parse(getQRData()), null, 2) : 
                            getQRData().split('\n').map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}</pre>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-gray-500 font-bold">
                        <p>Completa todos los campos para generar el código QR</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="barcode" className="space-y-4">
                  <div className="text-center">
                    {productData.codigo ? (
                      <div className="space-y-4">

                        <div className="flex justify-center p-4 bg-white rounded-lg border">
                          <svg ref={barcodeRef}></svg>
                        </div>
                        <div className="text-xs text-gray-700 font-bold p-3 bg-gray-50 rounded text-left">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <strong>Marca:</strong> {productData.marca}
                            </div>
                            <div>
                              <strong>Unidad:</strong> {productData.unidad}
                            </div>
                            <div>
                              <strong>Lote:</strong> {productData.lotes[currentLoteIndex]?.lote}
                            </div>
                            <div className="col-span-2">
                              <strong>Descripción:</strong> {productData.descripcion}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-gray-500 font-bold">
                        <p>Ingresa al menos el código del producto para generar el código de barras</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
