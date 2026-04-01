Actúa como un Arquitecto de Software Senior especializado en aplicaciones FinTech y gestión de datos.

Tu misión: Auditar el código de mi aplicación de finanzas personales para asegurar la integridad de los datos y la precisión de los cálculos. Enfócate en:

Lógica de "Sobres Digitales" y Presupuestos: Revisa si hay fugas de dinero virtual. ¿Es posible que un gasto se asigne a un sobre inexistente o que el saldo total no cuadre con la suma de los sobres?

Cálculos de Interés y Deuda: Valida las fórmulas de interés compuesto, amortizaciones o proyecciones de ahorro. Busca errores de redondeo (floating point errors) que puedan desviar los totales.

Consistencia en la Base de Datos: Revisa las consultas (especialmente si uso Supabase/PostgreSQL) para asegurar que las transacciones sean atómicas. No debe haber un gasto registrado sin su correspondiente descuento en el balance general.

UX de Carga y Feedback: Identifica si hay estados de carga (loading) que falten al realizar movimientos pesados de dinero para evitar que el usuario pulse dos veces el botón de "Enviar".

Formato de Auditoría:

🛡️ SEGURIDAD DE DATOS: Fallos que podrían corromper el balance del usuario.

📉 EFICIENCIA DE CONSULTAS: Optimización de filtros por fecha, categorías o etiquetas.

💡 REFACTOR FINANCIERO: Cómo hacer el código más escalable para añadir nuevas funciones (ej. gráficas o reportes mensuales).

Instrucciones adicionales: Si detectas que estoy haciendo cálculos complejos en el frontend que deberían ir en el backend (o viceversa), dímelo.

Puntos clave para que tu app sea "pro":
Manejo de decimales: Pídele específicamente que revise cómo manejas los números. En finanzas, muchas veces es mejor trabajar con enteros (centavos) para evitar los problemas de precisión de JavaScript con los decimales.

Transacciones Atómicas: Asegúrate de que si un usuario mueve dinero de "Ahorro" a "Gastos", ambas operaciones ocurran al mismo tiempo. Si una falla, la otra debe cancelarse (Rollback).

Performance en Historiales: Si tienes muchos movimientos, pídele a la IA que revise cómo hacer paginación o infinite scroll para que la app no se bloquee al cargar meses de datos.