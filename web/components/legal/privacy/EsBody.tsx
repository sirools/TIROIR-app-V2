import { LegalSection } from '../../layout/LegalPage'
import { PRIVACY_EMAIL as CONTACT_EMAIL } from '../contacts'

// Politique de confidentialité — traduction espagnole (la version française fait foi).
export default function EsBody() {
  return (
    <>
      <LegalSection title="1. Acerca de TiROiR">
        <p>TiROiR es una aplicación móvil de gestión de inventario personal. Le permite fotografiar sus objetos, crear fichas enriquecidas por la IA y encontrarlos fácilmente.</p>
        <p>Esta política describe cómo recopilamos, utilizamos y protegemos sus datos personales de conformidad con el Reglamento General de Protección de Datos (RGPD) y la legislación francesa aplicable.</p>
      </LegalSection>

      <LegalSection title="2. Datos recopilados">
        <p>Solo recopilamos los datos necesarios para el correcto funcionamiento del servicio:</p>
        <ul>
          <li>Dirección de correo electrónico y contraseña (autenticación)</li>
          <li>Fotos e imágenes que usted sube</li>
          <li>Información sobre sus objetos (título, descripción, estado, ubicación, atributos)</li>
          <li>Datos de navegación anonimizados (uso de las funcionalidades)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Uso de los datos">
        <p>Sus datos se utilizan exclusivamente para:</p>
        <ul>
          <li>Proporcionar y mejorar las funcionalidades de la aplicación</li>
          <li>Generar descripciones de objetos mediante nuestra IA (tratamiento únicamente a petición)</li>
          <li>Permitirle compartir selecciones de objetos mediante enlaces públicos</li>
          <li>Enviarle comunicaciones esenciales (seguridad, modificaciones de las CGU)</li>
        </ul>
        <p><strong>Nunca vendemos sus datos a terceros.</strong></p>
      </LegalSection>

      <LegalSection title="4. Almacenamiento y seguridad">
        <p>Sus datos se almacenan en servidores seguros operados por Supabase (Unión Europea). Las imágenes se cifran en reposo y en tránsito. Los accesos están protegidos por políticas de seguridad a nivel de fila (Row Level Security).</p>
        <p>Los enlaces públicos para compartir solo muestran la información que usted ha elegido compartir expresamente.</p>
      </LegalSection>

      <LegalSection title="5. Conservación de los datos">
        <p>Sus datos se conservan mientras su cuenta esté activa. Puede solicitar la eliminación completa de su cuenta y de todos sus datos contactándonos por correo electrónico.</p>
        <p>Los enlaces para compartir caducados se eliminan automáticamente después de 90 días.</p>
      </LegalSection>

      <LegalSection title="6. Sus derechos (RGPD)">
        <p>De conformidad con el RGPD, usted dispone de los siguientes derechos:</p>
        <ul>
          <li>Derecho de acceso a sus datos</li>
          <li>Derecho de rectificación</li>
          <li>Derecho de supresión («derecho al olvido»)</li>
          <li>Derecho a la portabilidad de los datos</li>
          <li>Derecho de oposición al tratamiento</li>
        </ul>
        <p>Para ejercer estos derechos, contáctenos en <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection title="7. Cookies y rastreadores">
        <p>La aplicación móvil no utiliza cookies. La versión web utiliza únicamente cookies técnicas estrictamente necesarias para el funcionamiento de la autenticación. No se instala ninguna cookie publicitaria ni de seguimiento de terceros.</p>
      </LegalSection>

      <LegalSection title="8. Servicios de terceros">
        <p>Utilizamos los siguientes servicios:</p>
        <ul>
          <li>Supabase — base de datos y autenticación (UE)</li>
          <li>Anthropic Claude — análisis de imágenes y estimación de valor (tratamiento únicamente a petición)</li>
          <li>Expo / React Native — framework móvil de código abierto</li>
        </ul>
        <p>Cada servicio está vinculado por un contrato de encargo del tratamiento conforme al RGPD.</p>
      </LegalSection>

      <LegalSection title="9. Menores">
        <p>TiROiR no está destinado a personas menores de 13 años. No recopilamos a sabiendas datos personales de niños.</p>
      </LegalSection>

      <LegalSection title="10. Modificaciones">
        <p>Cualquier modificación sustancial de esta política le será notificada por correo electrónico y en la aplicación al menos 30 días antes de su entrada en vigor.</p>
      </LegalSection>

      <LegalSection title="Contacto">
        <p>Para cualquier pregunta relativa a esta política o a sus datos personales:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}
