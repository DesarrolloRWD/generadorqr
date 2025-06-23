"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiService, ProductListItem } from "@/lib/api-service"
import { ArrowLeft, RefreshCw, Search, Download, QrCode } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { QRCodeSVG } from 'qrcode.react'
import Link from "next/link"
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ListadoProductos() {
  const [productos, setProductos] = useState<ProductListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState("")
  const [productosFiltrados, setProductosFiltrados] = useState<ProductListItem[]>([])
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null)
  const [qrFormat, setQrFormat] = useState("spaces") // Formato por defecto: espacios

  // Función para cargar los productos
  const cargarProductos = async () => {
    setLoading(true)
    setError(null)
    try {
      const apiService = ApiService.getInstance()
      const listaProductos = await apiService.getProductList()
      setProductos(listaProductos)
      setProductosFiltrados(listaProductos)
    } catch (err) {
      console.error('Error al cargar el listado de productos:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar los productos')
    } finally {
      setLoading(false)
    }
  }

  // Cargar productos al montar el componente
  useEffect(() => {
    cargarProductos()
  }, [])

  // Filtrar productos cuando cambia el filtro o la lista de productos
  useEffect(() => {
    if (!filtro.trim()) {
      setProductosFiltrados(productos)
      return
    }

    const filtroLower = filtro.toLowerCase()
    const filtrados = productos.filter(producto => 
      producto.codigo?.toLowerCase().includes(filtroLower) ||
      producto.marca?.toLowerCase().includes(filtroLower) ||
      producto.descripcion?.toLowerCase().includes(filtroLower) ||
      producto.lote?.toLowerCase().includes(filtroLower) ||
      producto.area?.toLowerCase().includes(filtroLower)
    )
    setProductosFiltrados(filtrados)
  }, [filtro, productos])

  // Función para formatear la fecha de expiración
  const formatearFecha = (fechaStr: string | null | undefined) => {
    if (!fechaStr) return "N/A"
    
    try {
      const fecha = new Date(fechaStr)
      return format(fecha, 'dd/MM/yyyy', { locale: es })
    } catch (error) {
      console.error('Error al formatear fecha:', error)
      return fechaStr
    }
  }
  
  // Función para abrir el diálogo de QR con el producto seleccionado
  const abrirQR = (producto: ProductListItem) => {
    setSelectedProduct(producto)
    setQrDialogOpen(true)
  }
  
  // Generar datos para QR según el formato seleccionado
  const getQRData = (producto: ProductListItem | null) => {
    if (!producto) return ""
    
    // Crear un objeto con solo los datos que deben ir en el QR
    const qrDataOnly = {
      codigo: producto.codigo,
      marca: producto.marca,
      descripcion: producto.descripcion,
      unidad: producto.unidad,
      lote: producto.lote,
      area: producto.area || "",
      presentacion: producto.presentacion || ""
    }
    
    switch (qrFormat) {
      case 'json':
        return JSON.stringify(qrDataOnly)
      case 'dash':
        return [
          `codigo-${producto.codigo}`,
          `marca-${producto.marca}`,
          `descripcion-${producto.descripcion}`,
          `unidad-${producto.unidad}`,
          `lote-${producto.lote}`,
          producto.area ? `area-${producto.area}` : '',
          producto.presentacion ? `presentacion-${producto.presentacion}` : ''
        ].filter(line => line !== '').join('\n')
      case 'spaces':
      default:
        return [
          `codigo  ${producto.codigo}`,
          `marca  ${producto.marca}`,
          `descripcion  ${producto.descripcion}`,
          `unidad  ${producto.unidad}`,
          `lote  ${producto.lote}`,
          producto.area ? `area  ${producto.area}` : '',
          producto.presentacion ? `presentacion  ${producto.presentacion}` : ''
        ].filter(line => line !== '').join('\n')
    }
  }
  
  // Función para descargar el QR generado
  const downloadQR = () => {
    if (!selectedProduct) return
    
    const canvas = document.createElement("canvas")
    const svg = document.querySelector(`#qr-code-dialog svg`)
    
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
        
        downloadLink.download = `qr-${selectedProduct.codigo}-lote-${selectedProduct.lote}.png`
        downloadLink.href = pngFile
        downloadLink.click()
      }
      
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
    }
  }

  // Función para exportar a Excel (CSV)
  const exportarCSV = () => {
    // Crear cabeceras
    const cabeceras = ['Código', 'Marca', 'Descripción', 'Unidad', 'Lote', 'Fecha Expiración', 'Área', 'Presentación', 'Empresa']
    
    // Crear filas de datos
    const filas = productosFiltrados.map(producto => [
      producto.codigo || '',
      producto.marca || '',
      producto.descripcion || '',
      producto.unidad || '',
      producto.lote || '',
      formatearFecha(producto.fechaExpiracion),
      producto.area || '',
      producto.presentacion || '',
      producto.empresa || ''
    ])
    
    // Combinar cabeceras y filas
    const contenidoCSV = [
      cabeceras.join(','),
      ...filas.map(fila => fila.map(celda => `"${celda.replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    // Crear blob y descargar
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `productos_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Listado de Productos</h1>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={cargarProductos} 
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            variant="outline" 
            onClick={exportarCSV}
            disabled={loading || productosFiltrados.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos Registrados</CardTitle>
          <CardDescription>
            {loading 
              ? 'Cargando productos...' 
              : `Mostrando ${productosFiltrados.length} de ${productos.length} productos`
            }
          </CardDescription>
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, marca, descripción..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800 mb-4">
              <p className="font-medium">Error al cargar los productos</p>
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {productos.length === 0 
                ? 'No hay productos registrados' 
                : 'No se encontraron productos con el filtro aplicado'
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Fecha Exp.</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosFiltrados.map((producto, index) => (
                    <TableRow key={`${producto.codigo}-${producto.lote}-${index}`}>
                      <TableCell className="font-medium">{producto.codigo}</TableCell>
                      <TableCell>{producto.marca}</TableCell>
                      <TableCell>{producto.descripcion}</TableCell>
                      <TableCell>{producto.unidad}</TableCell>
                      <TableCell>{producto.lote}</TableCell>
                      <TableCell>{formatearFecha(producto.fechaExpiracion)}</TableCell>
                      <TableCell>{producto.area}</TableCell>
                      <TableCell>{producto.empresa}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => abrirQR(producto)} 
                          title="Generar QR"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Diálogo para mostrar el QR */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Código QR</DialogTitle>
            <DialogDescription>
              {selectedProduct ? (
                <div className="text-sm">
                  <p><strong>Código:</strong> {selectedProduct.codigo}</p>
                  <p><strong>Descripción:</strong> {selectedProduct.descripcion}</p>
                  <p><strong>Lote:</strong> {selectedProduct.lote}</p>
                </div>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="flex space-x-2 mb-4">
              <Button 
                variant={qrFormat === 'spaces' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQrFormat('spaces')}
              >
                Espacios
              </Button>
              <Button 
                variant={qrFormat === 'dash' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQrFormat('dash')}
              >
                Guiones
              </Button>
              <Button 
                variant={qrFormat === 'json' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQrFormat('json')}
              >
                JSON
              </Button>
            </div>
            
            <div id="qr-code-dialog" className="border p-4 rounded-lg bg-white">
              {selectedProduct && (
                <QRCodeSVG 
                  value={getQRData(selectedProduct)} 
                  size={200} 
                  level="M" 
                  includeMargin={true} 
                />
              )}
            </div>
            
            <Button onClick={downloadQR} className="mt-4">
              <Download className="h-4 w-4 mr-2" />
              Descargar QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
