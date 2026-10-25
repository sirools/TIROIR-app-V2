// Textos del sitio en español (España). Misma estructura que fr.ts.
// A revisar por un hablante nativo.
import type { Copy } from './fr'
import share from './share/es'
import account from './account/es'
import about from './about/es'
import legal from './legal/es'

const es: Copy = {
  share,
  account,
  about,
  legal,
  layout: {
    pricing: 'Precios',
    download: 'Descargar la app',
    myProfile: 'Mi perfil',
    myAccount: 'Mi cuenta',
    myShares: 'Mis enlaces compartidos',
    signOut: 'Cerrar sesión',
    signUp: 'Crear una cuenta',
    signIn: 'Iniciar sesión',
    newHere: '¿Aún no tienes cuenta?',
    openMenu: 'Abrir el menú',
    closeMenu: 'Cerrar el menú',
    footerTagline: 'Fotografía tus cosas, Tiroir redacta la ficha. Tu inventario, por fin al día.',
    product: 'Producto',
    project: 'El proyecto',
    about: 'Quiénes somos',
    bookSlot: 'Reservar una cita',
    bookSubject: 'Hablar de Tiroir',
    legal: 'Legal',
    terms: 'Condiciones',
    privacy: 'Privacidad',
    madeIn: 'Hecho en Francia',
    contact: 'Contacto',
    language: 'Idioma',
  },

  // Achats dans l'app (page Tarifs) : Premium et crédits passent par les stores.
  inApp: {
    subscribe: 'Suscríbete en la app',
    buyCredits: 'Compra créditos en la app',
    subscriptionNote: 'La suscripción se gestiona desde la app.',
    creditsNote: 'Los créditos se compran desde la app.',
  },

  home: {
    meta: {
      title: 'Tiroir — una foto y tus cosas quedan ordenadas',
      description: 'Fotografía un objeto: Tiroir redacta su ficha, lo ordena y estima su valor. Para creativos, profesionales y cualquiera que quiera saber lo que tiene.',
    },
    hero: {
      badge: 'Disponible en iOS y Android',
      variants: [
        {
          title: 'Una foto, y todo lo que tienes queda ordenado.',
          sub: 'Tiroir redacta por ti la ficha de cada objeto, con categoría, estado y valor incluidos.',
        },
        {
          title: 'Sabe por fin lo que tienes, y lo que vale.',
          sub: 'Tiroir redacta por ti la ficha de cada objeto, con categoría, estado y valor incluidos.',
        },
        {
          title: 'Tu inventario se hace solo.',
          sub: 'Haz una foto y Tiroir se encarga del resto. Sin conocimientos técnicos.',
        },
      ],
      free: 'Gratis para empezar',
      demoLabel: 'Demostración: la foto de un reloj se convierte en una ficha completa, con su valor estimado.',
      steps: ['Foto', 'Ficha', 'Valor'],
      object: {
        ready: 'Ficha lista',
        name: 'Reloj vintage',
        meta: 'Años 70 · acero',
        rows: [
          ['Categoría', 'Relojería'],
          ['Colección', 'Vitrina'],
          ['Estado', 'Muy bueno'],
        ],
        valueLabel: 'Valor estimado',
      },
    },
    how: {
      eyebrow: 'Cómo funciona',
      title: 'Tres gestos, nada que configurar.',
      steps: [
        { title: 'Haz la foto', text: 'Un objeto, una foto. O cien de golpe, en modo ráfaga.' },
        { title: 'La ficha se escribe sola', text: 'Nombre, categoría, material, estado: todo relleno. Corrige si hace falta.' },
        { title: 'Todo ordenado', text: 'Colecciones, búsqueda, estado: lo encuentras todo, cuando quieras.' },
      ],
      fiche: { name: 'Chaqueta vaquera', rows: [['Categoría', 'Ropa'], ['Material', 'Denim'], ['Estado', 'Bueno']] },
      collections: ['Armario', 'Para vender', 'Estudio'],
      search: 'chaqueta azul',
    },
    pros: {
      eyebrow: 'Para creativos y profesionales',
      title: 'Menos papeleo, más oficio.',
      sub: 'Tu material, tu stock, tus colecciones: documentados en unas fotos, mientras trabajas.',
      personas: [
        { who: 'Estilista', text: 'Cada prenda fotografiada y ordenada por sesión. Sabes qué ha salido y qué ha vuelto.', chip: 'Prestada · vuelve el viernes' },
        { who: 'Jefe de producción', text: 'El material inventariado antes del rodaje y revisado a la vuelta. Todo el equipo, en tu bolsillo.', chip: '42 piezas · 3 prestadas' },
        { who: 'Anticuario', text: 'Un puesto entero en una sola sesión gracias al modo ráfaga, con un precio de salida para cada pieza.', chip: 'Ráfaga · 60 objetos' },
        { who: 'Músico', text: 'Instrumentos y accesorios documentados, facturas adjuntas: listos para el seguro o la reventa.', chip: 'Valor ≈ {price}' },
      ],
    },
    everyone: {
      eyebrow: 'Y para todos los demás',
      title: 'No hace falta ser profesional. Ni experto en tecnología.',
      sub: 'Si sabes hacer una foto, sabes usar Tiroir.',
      points: [
        { title: 'Sin conocimientos previos', text: 'Ni hojas de cálculo ni formularios en blanco. Tú haces la foto, Tiroir lo rellena.' },
        { title: 'Tus datos son tuyos', text: 'Sin publicidad, nada se revende ni se usa para entrenar modelos. Si borras tu cuenta, se borra todo, al instante.' },
        { title: 'Compartir solo para ver', text: 'Un enlace a una colección: la otra persona la ve sin cuenta ni app. Desactivas el enlace cuando quieras.' },
      ],
      usesTitle: 'También sirve para…',
      uses: ['Preparar un expediente para el seguro', 'Mudarte sin perder nada', 'Poner precio a un mercadillo', 'Ordenar el armario'],
      why: 'Por qué funciona: una inteligencia artificial de reconocimiento de imágenes describe cada foto. El resultado es solo una propuesta: todos los campos se pueden editar y tus correcciones siempre mandan.',
    },
    value: {
      eyebrow: 'El valor de tus cosas',
      title: 'Sabe lo que vale, y síguelo.',
      sub: 'Una estimación basada en anuncios comparables, no una cifra sacada de la manga.',
      items: [
        { title: 'Estimar', text: 'Una horquilla de precios y los anuncios en los que se basa.' },
        { title: 'Seguir', text: 'El valor de cada objeto y de cada colección, actualizado cuando quieras.' },
        { title: 'Revender', text: 'Márcalo como «Vendido» con el precio real: el objeto se queda en tu historial.' },
      ],
      note: 'No es una tasación: para una pieza rara, es un orden de magnitud.',
      demo: { comparable: 'Anuncio similar', sold: 'Vendido', trend: 'Valor de la colección' },
    },
    pricing: {
      eyebrow: 'Precios',
      title: 'Gratis para empezar.',
      sub: 'Cambia de plan cuando lo necesites.',
      perMonth: '/mes',
      perSeat: 'por usuario/mes',
      plans: {
        free: 'Objetos y colecciones ilimitados, {n} análisis al mes.',
        premium: 'Para seguir el valor de tu colección.',
        pro: 'Para quienes viven de sus objetos.',
        business: 'Para gestionar un stock en equipo.',
      },
      note: 'IVA incluido.',
      details: 'Ver todos los planes',
    },
    faq: {
      title: 'Preguntas frecuentes',
      items: [
      { q: '¿Hace falta saber de tecnología?', a: 'No. Haces una foto y Tiroir rellena la ficha. Todo se corrige con un toque.' },
      { q: '¿Y si la ficha se equivoca?', a: 'Todos los campos se pueden editar y tus correcciones siempre mandan. La marca exacta o el precio de compra solo los sabes tú.' },
      { q: '¿Mis fotos son privadas?', a: 'Sí. Nada es público mientras no compartas un enlace, y puedes desactivarlo en cualquier momento.' },
      { q: '¿Es fiable la estimación?', a: 'Se basa en anuncios comparables: un precio de salida fiable para un objeto corriente, un orden de magnitud para una pieza rara.' },
      ],
    },
    final: {
      title: 'Tu primer objeto, ordenado con una foto.',
      sub: 'Gratis, sin tarjeta.',
    },
  },

  pricing: {
    meta: {
      title: 'Precios — Tiroir',
      description: 'Tiroir es gratis, con {free} acciones de IA al mes. Créditos de IA desde {pack}, Premium a {premium} al mes, Pro a {pro} al mes, Business a {business} por usuario.',
    },
    badge: 'Precios',
    title: 'Ordénalo todo. Sabe lo que vale.',
    sub: 'Tiroir es gratis para todos. Paga solo cuando quieras ir más allá.',
    perMonth: '/mes',
    perYear: 'o {price} al año',
    perSeat: 'por usuario/mes',
    soon: 'Próximamente',
    free: {
      tagline: 'Para catalogar todo lo que tienes.',
      features: [
        'Objetos y colecciones ilimitados',
        '{n} acciones de IA al mes (identificación, estimación)',
        'Compartir colecciones solo para ver',
        'Créditos de IA extra, cuando quieras',
      ],
      start: 'Empieza gratis',
    },
    premium: {
      tagline: 'Para seguir el valor de tu colección.',
      features: [
        'Estimación automática con cuota mensual',
        'Curva de evolución del valor y botón Actualizar',
        'Fuentes resumidas en una línea',
        'Sugerencias de objetos de tus allegados',
        'Enlaces compartidos protegidos con contraseña',
      ],
      cta: 'Pasar a Premium',
    },
    pro: {
      tagline: 'Para quienes viven de sus objetos.',
      features: [
        'IA incluida, sin recargas',
        'Estimación por lotes',
        'Detalle de fuentes y comparación de mercado',
        'Exportación para el seguro',
      ],
      cta: 'Pasar a Pro',
    },
    business: {
      tagline: 'Para gestionar un stock en equipo.',
      features: [
        'Todo Pro, para cada miembro',
        'Roles y varias cuentas',
        'Facturación mensual, transferencia o domiciliación',
      ],
      cta: 'Contáctanos',
    },
    note: 'IVA incluido. Business se paga con factura.',
    credits: {
      title: 'Créditos de IA',
      sub: '¿Necesitas más? Recarga cuando quieras, sin suscripción.',
      unit: '{n} créditos',
      popular: 'El más elegido',
      note: 'Los créditos no caducan.',
      cta: 'Comprar créditos',
    },
    faqTitle: 'Preguntas frecuentes',
    faq: [
      { q: '¿Qué es una acción de IA?', a: 'Una identificación o una estimación de un objeto.' },
      { q: '¿Qué pasa cuando se agota mi cuota?', a: 'Tiroir sigue funcionando; solo las acciones de IA necesitan créditos.' },
      { q: '¿Influyen los socios en las estimaciones?', a: 'No. Nuestros socios nunca influyen en las estimaciones: las ofertas comerciales están separadas de la estimación de valor.' },
      { q: '¿Puedo cancelar?', a: 'Cuando quieras, desde el App Store, el Play Store o tu cuenta.' },
    ],
    final: {
      title: 'Empieza gratis.',
      sub: 'Objetos y colecciones ilimitados, {n} acciones de IA al mes. Sin tarjeta.',
    },
  },

  errors: {
    notFoundTitle: 'Página no encontrada',
    notFoundText: 'La página que buscas no existe o se ha movido.',
    serverTitle: 'Error del servidor',
    serverText: 'Algo ha fallado por nuestra parte. Vuelve a intentarlo en un momento.',
    back: 'Volver al inicio',
  },
}

export default es
