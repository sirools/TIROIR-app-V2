import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { Colors, Typography, Spacing, Radius } from '@/components/ui/tokens'

const LAST_UPDATED = '25 juin 2026'
const CONTACT_EMAIL = 'privacy@tiroir.app'
const APP_NAME = 'TiROiR'

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : null} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confidentialité</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Politique de confidentialité</Text>
        <Text style={styles.meta}>Dernière mise à jour : {LAST_UPDATED}</Text>

        <Section title="1. À propos">
          <P>
            {APP_NAME} est une application mobile de gestion d'inventaire personnel. Elle vous permet de photographier vos objets, de créer des fiches enrichies par l'IA, et de les retrouver facilement.
          </P>
          <P>
            Cette politique décrit comment nous collectons, utilisons et protégeons vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à la législation française applicable.
          </P>
        </Section>

        <Section title="2. Données collectées">
          <P>Nous collectons uniquement les données nécessaires au bon fonctionnement du service :</P>
          <Bullet>Adresse e-mail et mot de passe (authentification)</Bullet>
          <Bullet>Photos et images que vous téléversez</Bullet>
          <Bullet>Informations sur vos objets (titre, description, statut, emplacement, attributs)</Bullet>
          <Bullet>Données de navigation anonymisées (usage des fonctionnalités)</Bullet>
        </Section>

        <Section title="3. Utilisation des données">
          <P>Vos données sont utilisées exclusivement pour :</P>
          <Bullet>Fournir et améliorer les fonctionnalités de l'application</Bullet>
          <Bullet>Générer des descriptions d'objets via notre IA (traitement local à votre requête)</Bullet>
          <Bullet>Vous permettre de partager des sélections d'objets via des liens publics</Bullet>
          <Bullet>Vous envoyer des communications essentielles (sécurité, modifications des CGU)</Bullet>
          <P>Nous ne vendons jamais vos données à des tiers.</P>
        </Section>

        <Section title="4. Stockage et sécurité">
          <P>
            Vos données sont stockées sur des serveurs sécurisés opérés par Supabase (Union Européenne). Les images sont chiffrées au repos et en transit. Les accès sont protégés par des politiques de sécurité au niveau des lignes (Row Level Security).
          </P>
          <P>
            Les liens de partage publics n'exposent que les informations que vous avez explicitement choisies de partager.
          </P>
        </Section>

        <Section title="5. Conservation des données">
          <P>
            Vos données sont conservées aussi longtemps que votre compte est actif. Vous pouvez demander la suppression complète de votre compte et de toutes vos données en nous contactant par e-mail.
          </P>
          <P>
            Les liens de partage expirés sont automatiquement supprimés après 90 jours.
          </P>
        </Section>

        <Section title="6. Vos droits (RGPD)">
          <P>Conformément au RGPD, vous disposez des droits suivants :</P>
          <Bullet>Droit d'accès à vos données</Bullet>
          <Bullet>Droit de rectification</Bullet>
          <Bullet>Droit à l'effacement ("droit à l'oubli")</Bullet>
          <Bullet>Droit à la portabilité des données</Bullet>
          <Bullet>Droit d'opposition au traitement</Bullet>
          <P>
            Pour exercer ces droits, contactez-nous à{' '}
            <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
              {CONTACT_EMAIL}
            </Text>
            .
          </P>
        </Section>

        <Section title="7. Cookies et traceurs">
          <P>
            L'application mobile n'utilise pas de cookies. La version web utilise uniquement des cookies techniques strictement nécessaires au fonctionnement de l'authentification. Aucun cookie publicitaire ou de tracking tiers n'est déposé.
          </P>
        </Section>

        <Section title="8. Services tiers">
          <P>Nous utilisons les services suivants :</P>
          <Bullet>Supabase — base de données et authentification (UE)</Bullet>
          <Bullet>Anthropic Claude — analyse d'images et estimation de valeur (traitement à la demande uniquement)</Bullet>
          <Bullet>Expo / React Native — framework mobile open source</Bullet>
          <P>
            Chaque service est lié par un contrat de traitement des données conforme au RGPD.
          </P>
        </Section>

        <Section title="9. Mineurs">
          <P>
            {APP_NAME} n'est pas destiné aux personnes de moins de 13 ans. Nous ne collectons pas sciemment de données personnelles concernant des enfants.
          </P>
        </Section>

        <Section title="10. Modifications">
          <P>
            Toute modification substantielle de cette politique vous sera notifiée par e-mail et dans l'application au moins 30 jours avant son entrée en vigueur.
          </P>
        </Section>

        <Section title="Contact">
          <P>
            Pour toute question relative à cette politique ou à vos données personnelles, contactez-nous :{'\n'}
            <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
              {CONTACT_EMAIL}
            </Text>
          </P>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 {APP_NAME} — Tous droits réservés</Text>
        </View>
      </ScrollView>
    </View>
  )
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.root}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={sectionStyles.p}>{children}</Text>
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={sectionStyles.bulletRow}>
      <Text style={sectionStyles.bulletDot}>•</Text>
      <Text style={sectionStyles.bulletText}>{children}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  title: {
    fontSize: Typography.xxl, fontWeight: Typography.bold,
    color: Colors.textPrimary, lineHeight: 34,
  },
  meta: { fontSize: Typography.sm, color: Colors.textTertiary, marginTop: -Spacing.sm },
  link: { color: Colors.accent, textDecorationLine: 'underline' },
  footer: { alignItems: 'center', paddingTop: Spacing.xl },
  footerText: { fontSize: Typography.xs, color: Colors.textTertiary },
})

const sectionStyles = StyleSheet.create({
  root: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: {
    fontSize: Typography.base, fontWeight: Typography.bold,
    color: Colors.textPrimary, marginBottom: 4,
  },
  body: { gap: 8 },
  p: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bulletDot: { fontSize: Typography.sm, color: Colors.textTertiary, marginTop: 1 },
  bulletText: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
})
