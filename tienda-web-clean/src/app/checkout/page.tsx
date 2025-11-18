"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useCart } from "@/contexts/CartContext";
import { useSession } from "next-auth/react";
// Métodos de pago disponibles
const paymentMethods = [
  { id: "credit_card", name: "Tarjeta de Crédito" },
  { id: "debit_card", name: "Tarjeta de Débito" },
  { id: "mercadopago", name: "MercadoPago" },
  { id: "transbank", name: "Transbank" },
  { id: "bank_transfer", name: "Transferencia Bancaria" },
];

// Métodos de envío disponibles
const shippingMethods = [
  { id: "standard", name: "Envío Estándar", price: 10.00, days: "3-5 días hábiles" },
  { id: "express", name: "Envío Express", price: 20.00, days: "1-2 días hábiles" },
  { id: "pickup", name: "Retirar en Tienda", price: 0, days: "Disponible el mismo día" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { cartItems } = useCart();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedShippingMethod, setSelectedShippingMethod] = useState("standard");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("credit_card");
  
  // Redirigir si el carrito está vacío
  useEffect(() => {
    if (status !== "loading" && cartItems.length === 0) {
      router.push("/carrito");
    }
  }, [cartItems.length, router, status]);
  // Totales dinámicos según carrito y selección
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = shippingMethods.find(method => method.id === selectedShippingMethod)?.price || 0;
  const total = subtotal + shippingCost;
  
  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "Chile",
  });
  // Autofill: nombre/email desde profile; teléfono siempre desde defaultAddress
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const profileRaw = localStorage.getItem('profile');
      if (profileRaw) {
        const { nombre, apellidos, email } = JSON.parse(profileRaw);
        setShippingInfo(prev => ({
          ...prev,
            fullName: `${nombre || ''} ${apellidos || ''}`.trim() || prev.fullName,
          email: email || prev.email,
        }));
      }
    } catch {}
    try {
      const addrRaw = localStorage.getItem('defaultAddress');
      if (addrRaw) {
        const addr = JSON.parse(addrRaw);
        const addrLine = `${addr.calle || ''} ${addr.numero || ''}${addr.interior ? ' Int.' + addr.interior : ''}`.trim();
        setShippingInfo(prev => ({
          ...prev,
          address: addrLine || prev.address,
          city: addr.ciudad || prev.city,
          state: addr.estado || prev.state,
          zipCode: addr.codigoPostal || prev.zipCode,
          phone: addr.telefono || prev.phone, // forzar teléfono de dirección predeterminada
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const firstName =
      (session.user as any).firstName ||
      (session.user?.name ? session.user.name.split(" ")[0] : "");
    const lastName =
      (session.user as any).lastName ||
      (session.user?.name ? session.user.name.split(" ").slice(1).join(" ") : "");
    const displayName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || session.user.name || "";
    const displayEmail = session.user.email || "";

    setShippingInfo((prev) => ({
      ...prev,
      fullName: prev.fullName || displayName,
      email: prev.email || displayEmail,
    }));
  }, [session?.user]);
  

  const handleShippingInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleShippingMethodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedShippingMethod(e.target.value);
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedPaymentMethod(e.target.value);
  };

  const handleContinue = () => {
    if (step === 1) {
      // Validar información de envío
      const { fullName, email, phone, address, city, state, zipCode } = shippingInfo;
      const newErrors: Record<string, string> = {};
      
      if (!fullName.trim()) newErrors.fullName = "El nombre es requerido";
      if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email inválido";
      if (!phone.trim()) newErrors.phone = "El teléfono es requerido";
      if (!address.trim()) newErrors.address = "La dirección es requerida";
      if (!city.trim()) newErrors.city = "La ciudad es requerida";
      if (!state.trim()) newErrors.state = "La región/provincia es requerida";
      if (!zipCode.trim()) newErrors.zipCode = "El código postal es requerido";
      
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        alert("Por favor complete todos los campos requeridos correctamente.");
        return;
      }
      
      setErrors({});
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 2) {
      // Procesar pago (aquí iría la integración real)
      setLoading(true);
      
      // Simulación de procesamiento
      setTimeout(() => {
        setLoading(false);
        // Redirigir a confirmación
        router.push("/checkout/confirmacion");
      }, 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header mejorado */}
      <div className="mb-8">
        <Link href="/carrito" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al carrito
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Finalizar Compra</h1>
        <p className="mt-1 text-sm text-gray-500">
          {cartItems.length} {cartItems.length === 1 ? 'producto' : 'productos'} en tu carrito
        </p>
      </div>
      
      {/* Steps mejorados */}
      <div className="mb-10">
        <div className="flex items-center justify-center max-w-md mx-auto">
          <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'} relative`}>
            <div className={`rounded-full h-10 w-10 flex items-center justify-center border-2 font-semibold ${step >= 1 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className="ml-3 font-medium hidden sm:block">Envío</div>
          </div>
          <div className={`flex-1 h-1 mx-4 rounded ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`}></div>
          <div className={`flex items-center relative ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>
            <div className={`rounded-full h-10 w-10 flex items-center justify-center border-2 font-semibold ${step >= 2 ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"}`}>
              2
            </div>
            <div className="ml-3 font-medium hidden sm:block">Pago</div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {step === 1 ? (
              /* Paso 1: Información de envío */
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-6">Información de Envío</h2>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Input
                      label="Nombre completo"
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      value={shippingInfo.fullName}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                  
                  <div>
                    <Input
                      label="Correo electrónico"
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={shippingInfo.email}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                  
                  <div>
                    <Input
                      label="Teléfono"
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      value={shippingInfo.phone}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <Input
                      label="Dirección"
                      id="address"
                      name="address"
                      type="text"
                      required
                      value={shippingInfo.address}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                  
                  <div>
                    <Input
                      label="Ciudad"
                      id="city"
                      name="city"
                      type="text"
                      required
                      value={shippingInfo.city}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                  
                  <div>
                    <Input
                      label="Región/Provincia"
                      id="state"
                      name="state"
                      type="text"
                      required
                      value={shippingInfo.state}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                  
                  <div>
                    <Input
                      label="Código Postal"
                      id="zipCode"
                      name="zipCode"
                      type="text"
                      required
                      value={shippingInfo.zipCode}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                  
                  <div>
                    <Input
                      label="País"
                      id="country"
                      name="country"
                      type="text"
                      disabled
                      value={shippingInfo.country}
                      onChange={handleShippingInfoChange}
                    />
                  </div>
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Método de Envío</h3>
                  
                  <div className="space-y-3">
                    {shippingMethods.map((method) => (
                      <label 
                        key={method.id}
                        htmlFor={method.id} 
                        className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedShippingMethod === method.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                      >
                        <div className="flex items-center">
                          <input
                            id={method.id}
                            name="shippingMethod"
                            type="radio"
                            value={method.id}
                            checked={selectedShippingMethod === method.id}
                            onChange={handleShippingMethodChange}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="ml-3">
                            <div className="flex items-center">
                              {method.id === 'express' && (
                                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              )}
                              {method.id === 'pickup' && (
                                <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              )}
                              {method.id === 'standard' && (
                                <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                              )}
                              <span className="text-gray-900 font-medium">{method.name}</span>
                            </div>
                            <div className="text-gray-500 text-sm mt-1">{method.days}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          {method.price === 0 ? (
                            <span className="text-green-600 font-semibold">Gratis</span>
                          ) : (
                            <span className="text-gray-900 font-semibold">${method.price.toFixed(2)}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Paso 2: Información de pago */
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-6">Información de Pago</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-4">Método de Pago</h3>
                    
                    <div className="space-y-4">
                      {paymentMethods.map((method) => (
                        <div key={method.id} className="flex items-center">
                          <input
                            id={method.id}
                            name="paymentMethod"
                            type="radio"
                            value={method.id}
                            checked={selectedPaymentMethod === method.id}
                            onChange={handlePaymentMethodChange}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <label htmlFor={method.id} className="ml-3">
                            <span className="text-gray-900 font-medium">{method.name}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Campos específicos para tarjeta de crédito/débito */}
                  {(selectedPaymentMethod === "credit_card" || selectedPaymentMethod === "debit_card") && (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Input
                          label="Número de tarjeta"
                          id="cardNumber"
                          name="cardNumber"
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          required
                        />
                      </div>
                      
                      <div className="sm:col-span-2">
                        <Input
                          label="Nombre en la tarjeta"
                          id="cardName"
                          name="cardName"
                          type="text"
                          required
                        />
                      </div>
                      
                      <div>
                        <Input
                          label="Fecha de expiración (MM/AA)"
                          id="cardExpiry"
                          name="cardExpiry"
                          type="text"
                          placeholder="MM/AA"
                          required
                        />
                      </div>
                      
                      <div>
                        <Input
                          label="Código de seguridad (CVV)"
                          id="cardCvv"
                          name="cardCvv"
                          type="text"
                          placeholder="123"
                          required
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Campos específicos para transferencia */}
                  {selectedPaymentMethod === "bank_transfer" && (
                    <div className="bg-blue-50 p-4 rounded-md">
                      <p className="text-sm text-gray-700">
                        Después de completar el pedido, recibirás un correo electrónico con los datos bancarios para realizar la transferencia.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Botones de acción */}
            <div className="bg-gray-50 p-6 flex justify-between">
              {step === 1 ? (
                <Link href="/carrito">
                  <Button variant="outline">
                    Volver al Carrito
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" onClick={() => setStep(1)}>
                  Volver
                </Button>
              )}
              
              <Button onClick={handleContinue} disabled={loading}>
                {loading ? "Procesando..." : step === 1 ? "Continuar al Pago" : "Completar Compra"}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Resumen mejorado */}
        <div>
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-4 border-b border-gray-200">
              Resumen del Pedido
            </h2>
            
            {/* Items del carrito */}
            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">${item.price.toFixed(2)} c/u</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            
            {/* Totales */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <p className="text-gray-600">Subtotal</p>
                <p className="font-medium text-gray-900">${subtotal.toFixed(2)}</p>
              </div>
              
              <div className="flex justify-between text-sm">
                <p className="text-gray-600">Envío</p>
                <p className="font-medium text-gray-900">
                  {shippingCost === 0 ? (
                    <span className="text-green-600">Gratis</span>
                  ) : (
                    `$${shippingCost.toFixed(2)}`
                  )}
                </p>
              </div>
              
              <div className="pt-3 border-t border-gray-200 flex justify-between">
                <p className="text-lg font-semibold text-gray-900">Total</p>
                <p className="text-2xl font-bold text-blue-600">${total.toFixed(2)}</p>
              </div>
            </div>

            {/* Seguridad */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center text-xs text-gray-500">
                <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Compra segura y cifrada
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
