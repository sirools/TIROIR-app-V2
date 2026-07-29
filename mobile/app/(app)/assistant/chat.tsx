import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Send, Package } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { isPaidPlan } from '@/lib/plan'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

interface ReferencedObject {
  id: string
  title: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  objects?: ReferencedObject[]
}

let idCounter = 0
function nextId() {
  idCounter += 1
  return `m${idCounter}`
}

export default function AssistantScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { prompt } = useLocalSearchParams<{ prompt?: string }>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [missingLocationTitles, setMissingLocationTitles] = useState<string[] | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const autoSentRef = useRef(false)

  // Accès direct par deep-link sans passer par l'écran d'accueil (qui
  // affiche déjà l'upsell) : on redirige les comptes non premium.
  useEffect(() => {
    if (profile && !isPaidPlan(profile.plan)) {
      router.replace('/assistant')
    }
  }, [profile])

  useEffect(() => {
    loadGreeting()
  }, [])

  // Question d'exemple passée depuis l'écran d'accueil de l'Assistant :
  // envoyée automatiquement une fois le message d'accueil affiché.
  useEffect(() => {
    if (prompt && !autoSentRef.current && messages.length > 0) {
      autoSentRef.current = true
      sendText(prompt)
    }
  }, [prompt, messages.length])

  async function loadGreeting() {
    const { data } = await supabase
      .from('objects')
      .select('title')
      .or('location_note.is.null,location_note.eq.')
      .order('created_at', { ascending: false })
      .limit(50)

    const titles = (data ?? []).map(o => o.title)
    setMissingLocationTitles(titles)

    const greeting = titles.length > 0
      ? t('assistant.greetingMissing', { count: titles.length })
      : t('assistant.greetingDefault')

    setMessages([{ id: nextId(), role: 'assistant', content: greeting }])
  }

  function showMissingLocationList() {
    if (!missingLocationTitles || missingLocationTitles.length === 0) return
    const list = missingLocationTitles.slice(0, 15).map(title => `• ${title}`).join('\n')
    const more = missingLocationTitles.length > 15 ? t('assistant.andMore', { count: missingLocationTitles.length - 15 }) : ''
    appendMessage('assistant', `${list}${more}`)
  }

  function appendMessage(role: ChatMessage['role'], content: string, objects?: ReferencedObject[]) {
    setMessages(prev => [...prev, { id: nextId(), role, content, objects }])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
  }

  async function sendText(text: string) {
    if (!text.trim() || sending) return
    appendMessage('user', text)
    setSending(true)

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const { data, error } = await supabase.functions.invoke('assistant-chat', {
        body: { message: text, history },
      })
      if (error) throw error
      appendMessage('assistant', data.reply as string, data.objects as ReferencedObject[] | undefined)
    } catch {
      appendMessage('assistant', t('assistant.errorReply'))
    } finally {
      setSending(false)
    }
  }

  function sendMessage() {
    const text = input.trim()
    if (!text) return
    setInput('')
    sendText(text)
  }

  const showMissingChip = missingLocationTitles !== null && missingLocationTitles.length > 0 && messages.length === 1

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/assistant')} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>{t('assistant.title')}</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeText}>BETA</Text>
          </View>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(m => (
            <View
              key={m.id}
              style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}
            >
              <View style={{ maxWidth: '82%' }}>
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
                    {m.content}
                  </Text>
                </View>
                {m.objects && m.objects.length > 0 && (
                  <View style={styles.objectChips}>
                    {m.objects.map(o => (
                      <TouchableOpacity
                        key={o.id}
                        style={styles.objectChip}
                        onPress={() => router.push({ pathname: '/objects/[id]', params: { id: o.id } })}
                        activeOpacity={0.8}
                      >
                        <Package size={12} color={Colors.accent} strokeWidth={2} />
                        <Text style={styles.objectChipText} numberOfLines={1}>{o.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}

          {showMissingChip && (
            <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
              <TouchableOpacity style={styles.chip} onPress={showMissingLocationList} activeOpacity={0.8}>
                <Text style={styles.chipText}>{t('assistant.seeList')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {sending && (
            <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleLoading]}>
                <ActivityIndicator size="small" color="white" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.inputPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={sending || !input.trim()}
            activeOpacity={0.85}
          >
            <Send size={16} color="white" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  betaBadge: {
    backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#D4BBFF',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
  },
  betaBadgeText: { fontSize: 10, fontWeight: Typography.bold, color: '#7c3aed', letterSpacing: 0.4 },

  scroll: { padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 },

  bubbleRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },

  bubble: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  bubbleUser: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  bubbleAssistant: { backgroundColor: Colors.accent },
  bubbleLoading: { maxWidth: '82%', paddingVertical: 12, paddingHorizontal: 16 },
  bubbleText: { fontSize: Typography.base, lineHeight: 20 },
  bubbleTextUser: { color: Colors.textPrimary },
  bubbleTextAssistant: { color: 'white' },

  chip: {
    backgroundColor: Colors.accentLight, borderWidth: 1, borderColor: Colors.accent,
    borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  chipText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.accent },

  objectChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  objectChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    maxWidth: 200,
  },
  objectChipText: { fontSize: Typography.xs, color: Colors.accent, fontWeight: Typography.medium },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1, fontSize: Typography.base, color: Colors.textPrimary,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
})
