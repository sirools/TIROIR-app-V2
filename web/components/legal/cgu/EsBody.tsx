import Link from 'next/link'
import { LegalSection } from '../../layout/LegalPage'
import { BUSINESS_EMAIL, BUSINESS_MAILTO, BUSINESS_SUBJECT, CONTACT_EMAIL, SUPPORT_EMAIL } from '../contacts'

// Conditions Générales d'Utilisation — traduction espagnole (la version
// française fait foi).
export default function EsBody() {
  return (
    <>
      <LegalSection title="1. Objeto">
        <p>
          Las presentes Condiciones Generales de Uso (las «CGU») regulan el acceso y el uso de la
          aplicación móvil y del sitio web TiROiR (en adelante, «el Servicio»), editados por TiROiR
          (en adelante, «nosotros», «nuestro»).
        </p>
        <p>
          Al crear una cuenta o utilizar el Servicio, usted acepta sin reservas las presentes CGU. Si
          no acepta estas condiciones, no debe utilizar el Servicio.
        </p>
      </LegalSection>

      <LegalSection title="2. Descripción del servicio">
        <p>
          TiROiR es una aplicación de gestión de inventario personal. Permite al usuario fotografiar
          sus objetos, generar automáticamente fichas descriptivas mediante inteligencia artificial,
          organizar sus objetos en colecciones, estimar su valor de mercado, adjuntar documentos
          (facturas, manuales de instrucciones, seguros) y compartir selecciones de objetos mediante
          enlaces públicos.
        </p>
      </LegalSection>

      <LegalSection title="3. Creación de cuenta">
        <p>
          El uso del Servicio requiere la creación de una cuenta, asociada a una dirección de correo
          electrónico válida y a una contraseña. Usted es responsable de la confidencialidad de sus
          credenciales y de toda actividad realizada desde su cuenta.
        </p>
        <p>
          El Servicio está destinado a personas de al menos 13 años. Al crear una cuenta, usted
          declara cumplir este requisito de edad.
        </p>
      </LegalSection>

      <LegalSection title="4. Suscripción Premium">
        <p>
          TiROiR ofrece una versión gratuita con cuotas de uso limitadas (número de objetos, de
          análisis de IA y de fotos por objeto), así como una suscripción Premium de pago que elimina
          estos límites.
        </p>
        <p>
          Las suscripciones se facturan a través del App Store de Apple según las tarifas mostradas en
          el momento de la compra. Se renuevan automáticamente salvo cancelación, que se realiza
          directamente desde los ajustes de su cuenta de Apple. No es posible ningún reembolso fuera
          de las políticas estándar de Apple.
        </p>
        <p>
          Los periodos de prueba gratuita, cuando se ofrecen, se convierten automáticamente en una
          suscripción de pago a su término, salvo cancelación previa.
        </p>
      </LegalSection>

      <LegalSection title="5. Planes Pro y Business">
        <p>
          Los planes Pro y Business están destinados a profesionales. Su contenido y sus precios se
          presentan en la página de Precios.
        </p>
        <p>
          Cualquier gestión relativa a estos planes (solicitud de información, presupuesto, suscripción,
          facturación) se realiza por correo electrónico a <a href={BUSINESS_MAILTO}>{BUSINESS_EMAIL}</a>,
          con el asunto «{BUSINESS_SUBJECT}».
        </p>
      </LegalSection>

      <LegalSection title="6. Contenido del usuario">
        <p>
          Usted conserva la totalidad de los derechos de propiedad intelectual sobre las fotos,
          descripciones y documentos que sube al Servicio («Contenido del Usuario»).
        </p>
        <p>
          Al subir Contenido del Usuario, usted nos concede una licencia limitada y no exclusiva,
          necesaria para el almacenamiento, la visualización y el tratamiento de dicho contenido en el
          marco del funcionamiento del Servicio (en particular, el análisis mediante inteligencia
          artificial y la generación de enlaces para compartir que usted configure expresamente).
        </p>
        <p>
          Usted es el único responsable del Contenido del Usuario que sube. Se compromete a no
          publicar contenido ilícito, que vulnere derechos de terceros o que sea contrario al orden
          público.
        </p>
      </LegalSection>

      <LegalSection title="7. Enlaces para compartir">
        <p>
          El Servicio le permite generar enlaces públicos que dan acceso de solo lectura a una
          selección de objetos de su elección. Usted es el único responsable de la información que
          decida hacer accesible mediante estos enlaces, así como de las personas con quienes los
          comparta.
        </p>
      </LegalSection>

      <LegalSection title="8. Inteligencia artificial">
        <p>
          Las descripciones, categorizaciones y estimaciones de valor generadas por la inteligencia
          artificial se proporcionan únicamente a título orientativo. En ningún caso constituyen una
          peritación profesional, en particular en materia de seguros, fiscalidad o tasación de
          antigüedades. No garantizamos la exactitud de esta información generada automáticamente.
        </p>
      </LegalSection>

      <LegalSection title="9. Disponibilidad del servicio">
        <p>
          Nos esforzamos por garantizar una disponibilidad continua del Servicio, sin garantizar la
          ausencia de interrupciones, en particular por operaciones de mantenimiento. No podremos ser
          considerados responsables de las interrupciones temporales del Servicio.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitación de responsabilidad">
        <p>
          El Servicio se proporciona «tal cual». En la medida en que lo permita la ley aplicable,
          declinamos toda responsabilidad por los daños indirectos derivados del uso o de la
          imposibilidad de usar el Servicio, incluida la pérdida de datos.
        </p>
        <p>
          Le recomendamos conservar una copia de seguridad de sus documentos importantes (facturas,
          justificantes de seguro) fuera del Servicio.
        </p>
      </LegalSection>

      <LegalSection title="11. Resolución">
        <p>
          Puede eliminar su cuenta en cualquier momento desde la aplicación o contactándonos en{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. La eliminación de la cuenta conlleva
          el borrado de sus datos de conformidad con nuestra{' '}
          <Link href="/privacy" legacyBehavior passHref><a>política de privacidad</a></Link>.
        </p>
        <p>
          Nos reservamos el derecho de suspender o cancelar cualquier cuenta en caso de incumplimiento
          de las presentes CGU.
        </p>
      </LegalSection>

      <LegalSection title="12. Modificaciones de las CGU">
        <p>
          Podemos modificar las presentes CGU en cualquier momento. Cualquier modificación sustancial
          le será notificada por correo electrónico o en la aplicación al menos 30 días antes de su
          entrada en vigor. El uso continuado del Servicio después de esa fecha implica la aceptación
          de las nuevas CGU.
        </p>
      </LegalSection>

      <LegalSection title="13. Legislación aplicable y jurisdicción">
        <p>
          Las presentes CGU se rigen por el derecho francés. Cualquier litigio relativo a su
          interpretación o ejecución será competencia exclusiva de los tribunales franceses, sin
          perjuicio de las disposiciones imperativas aplicables a los consumidores.
        </p>
      </LegalSection>

      <LegalSection title="Contacto">
        <p>Para cualquier pregunta relativa a las presentes CGU:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p>Para los planes Pro y Business: <a href={BUSINESS_MAILTO}>{BUSINESS_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}
