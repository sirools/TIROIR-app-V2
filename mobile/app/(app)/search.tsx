import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { GlobalMenu, BurgerIcon } from '@/components/GlobalMenu'
import { SearchResult, TiroirObject } from '@/types/database'

const PAGE_SIZE = 10
const RECENTS_KEY = 'search_recent_queries'
const MAX_RECENTS = 6

// ── Suggestion groupée ────────────────────────────────────────────────────────

interface Suggestion {
  label: string
  matchType: 'Lieu' | 'Statut' | 'Caractéristique' | 'Mot-clé'
  objectId: string
}

function deriveSuggestions(results: SearchResult[], query: string): Suggestion[] {
  const q = query.toLowerCase()
  const seen = new Set<string>()
  const suggestions: Suggestion[] = []

  for (const r of results) {
    const checks: { value: string | null | undefined; type: Suggestion['matchType'] }[] = [
      { value: r.location_note, type: 'Lieu' },
      { value: r.status, type: 'Statut' },
      { value: r.title, type: 'Mot-clé' },
      { value: r.description, type: 'Mot-clé' },
    ]
    for (const { value, type } of checks) {
      if (!value) continue
      if (value.toLowerCase().includes(q)) {
        const key = `${type}:${value}`
        if (!seen.has(key)) {
          seen.add(key)
          suggestions.push({ label: value, matchType: type, objectId: r.id })
        }
      }
    }
    // attributes
    if (r.attributes && typeof r.attributes === 'object') {
      for (const val of Object.values(r.attributes as Record<string, string>)) {
        if (typeof val === 'string' && val.toLowerCase().includes(q)) {
          const key = `Caractéristique:${val}`
          if (!seen.has(key)) {
            seen.add(key)
            suggestions.push({ label: val, matchType: 'Caractéristique', objectId: r.id })
          }
        }
      }
    }
  }
  return suggestions.slice(0, 8)
}

const MATCH_COLORS: Record<Suggestion['matchType'], { bg: string; text: string }> = {
  Lieu:            { bg: '#FFF0EC', text: '#C0682A' },
  'Mot-clé':       { bg: '#EFF6FF', text: '#3B82F6' },
  Caractéristique: { bg: '#FFF7ED', text: '#EA580C' },
  Statut:          { bg: '#F0FDF4', text: '#16A34A' },
}

// matchType reste un identifiant interne (FR) ; on le traduit à l'affichage.
const MATCH_LABEL_KEY: Record<Suggestion['matchType'], string> = {
  Lieu:            'search.matchLocation',
  'Mot-clé':       'search.matchKeyword',
  Caractéristique: 'search.matchAttribute',
  Statut:          'search.matchStatus',
}

// ── Écran ─────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const inputRef = useRef<TextInput>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recents, setRecents] = useState<TiroirObject[]>([])
  const [recentsOffset, setRecentsOffset] = useState(0)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loadingRecents, setLoadingRecents] = useState(false)
  const [searching, setSearching] = useState(false)
  const [recentQueries, setRecentQueries] = useState<string[]>([])
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadRecents(0, true)
    AsyncStorage.getItem(RECENTS_KEY).then(raw => {
      if (raw) setRecentQueries(JSON.parse(raw))
    })
  }, [])

  async function loadRecents(offset: number, replace: boolean) {
    setLoadingRecents(true)
    const [pageRes, countRes] = await Promise.all([
      supabase.from('objects').select('*').order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
      replace ? supabase.from('objects').select('id', { count: 'exact', head: true }) : Promise.resolve(null),
    ])
    setLoadingRecents(false)
    if (pageRes.error || !pageRes.data) return
    if (replace) {
      setRecents(pageRes.data)
      if (countRes && 'count' in countRes) setTotalCount(countRes.count ?? 0)
    } else {
      setRecents(prev => [...prev, ...pageRes.data])
    }
    setRecentsOffset(offset + pageRes.data.length)
    loadCovers(pageRes.data.map((o: TiroirObject) => o.id))
  }

  async function loadCovers(ids: string[]) {
    if (ids.length === 0) return
    const newIds = ids.filter(id => !(id in coverUrls))
    if (newIds.length === 0) return
    const { data } = await supabase
      .from('object_images')
      .select('object_id, storage_path')
      .in('object_id', newIds)
      .eq('is_cover', true)
    if (!data || data.length === 0) return
    const urlMap: Record<string, string> = {}
    await Promise.all(data.map(async row => {
      const { data: signed } = await supabase.storage.from('object-images').createSignedUrl(row.storage_path, 3600)
      if (signed?.signedUrl) urlMap[row.object_id] = signed.signedUrl
    }))
    setCoverUrls(prev => ({ ...prev, ...urlMap }))
  }

  async function doSearch(text: string) {
    if (!text.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    const { data, error } = await supabase.rpc('search_objects', { p_query: text.trim(), p_limit: 30, p_offset: 0 })
    setSearching(false)
    if (!error) {
      const rows = (data as SearchResult[]) ?? []
      setResults(rows)
      loadCovers(rows.map(r => r.id))
    }
  }

  function onChangeText(text: string) {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(text), 350)
  }

  async function saveRecentQuery(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    const updated = [trimmed, ...recentQueries.filter(r => r !== trimmed)].slice(0, MAX_RECENTS)
    setRecentQueries(updated)
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  }

  function onSubmit() {
    saveRecentQuery(query)
    doSearch(query)
  }

  function clearQuery() {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  function selectSuggestion(s: Suggestion) {
    saveRecentQuery(s.label)
    router.push(`/(app)/objects/${s.objectId}`)
  }

  function selectRecentQuery(q: string) {
    setQuery(q)
    doSearch(q)
  }

  const isSearchMode = query.trim().length > 0
  const suggestions = isSearchMode ? deriveSuggestions(results, query) : []
  const hasMore = totalCount !== null && recentsOffset < totalCount

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderRecentItem({ item }: { item: TiroirObject }) {
    const url = coverUrls[item.id]
    return (
      <TouchableOpacity onPress={() => router.push(`/(app)/objects/${item.id}`)} activeOpacity={0.8} style={styles.row}>
        <View style={styles.thumb}>
          {url
            ? <Image source={{ uri: url }} style={styles.thumbImg} />
            : <View style={styles.thumbPlaceholder} />
          }
        </View>
        <View style={styles.info}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          {item.location_note ? <Text style={styles.rowSub} numberOfLines={1}>{item.location_note}</Text> : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    )
  }

  function renderFooter() {
    if (isSearchMode) return null
    if (loadingRecents && recents.length > 0) return <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.lg }} />
    if (!hasMore) return null
    return (
      <TouchableOpacity style={styles.loadMore} onPress={() => loadRecents(recentsOffset, false)} activeOpacity={0.75}>
        <Text style={styles.loadMoreText}>{t('search.loadMore', { count: totalCount! - recentsOffset })}</Text>
      </TouchableOpacity>
    )
  }

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <Screen edges={['top']}>

      {/* Header — style home */}
      <View style={styles.header}>
        <Text style={styles.heroTitle}>{t('search.title')}</Text>
        <BurgerIcon onPress={() => setMenuOpen(true)} />
      </View>

      <GlobalMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Barre de recherche */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={onChangeText}
            placeholder={t('search.placeholder')}
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={onSubmit}
          />
          {searching && <ActivityIndicator size="small" color={Colors.accent} style={{ marginRight: 8 }} />}
          {!searching && query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} hitSlop={8}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mode recherche : suggestions groupées */}
      {isSearchMode ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.suggestionsContent} keyboardShouldPersistTaps="handled">
          {searching && suggestions.length === 0 && (
            <View style={styles.loader}><ActivityIndicator color={Colors.accent} /></View>
          )}
          {!searching && suggestions.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('search.noResults')}</Text>
              <Text style={styles.emptySubtitle}>{t('search.noResultsFor', { query })}</Text>
            </View>
          )}
          {suggestions.map((s, i) => {
            const c = MATCH_COLORS[s.matchType]
            return (
              <TouchableOpacity key={i} style={styles.suggestionRow} onPress={() => selectSuggestion(s)} activeOpacity={0.7}>
                <Text style={styles.suggestionType}>📍 {t(MATCH_LABEL_KEY[s.matchType])} :</Text>
                <View style={[styles.suggestionChip, { backgroundColor: c.bg }]}>
                  <Text style={[styles.suggestionChipText, { color: c.text }]}>{s.label}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      ) : (
        /* Mode défaut : recherches récentes + objets récents */
        <FlatList
          data={recents}
          keyExtractor={item => item.id}
          renderItem={renderRecentItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {recentQueries.length > 0 && (
                <View style={styles.recentSection}>
                  <Text style={styles.sectionLabel}>{t('search.recentSearches')}</Text>
                  <View style={styles.recentChips}>
                    {recentQueries.map((q, i) => (
                      <TouchableOpacity key={i} style={styles.recentChip} onPress={() => selectRecentQuery(q)} activeOpacity={0.7}>
                        <Text style={styles.recentChipText}>{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>{t('search.recentAdds')}</Text>
                {totalCount !== null && (
                  <Text style={styles.sectionCount}>{t('common.objects', { count: totalCount })}</Text>
                )}
              </View>
            </>
          }
          ListEmptyComponent={
            loadingRecents ? <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} /> : null
          }
          ListFooterComponent={renderFooter}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Screen>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },

  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    padding: 0,
  },
  clearIcon: { fontSize: 14, color: Colors.textTertiary, paddingHorizontal: 4 },

  // Suggestions
  suggestionsContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: 2 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionType: { fontSize: Typography.sm, color: Colors.textTertiary, minWidth: 130 },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  suggestionChipText: { fontSize: Typography.sm, fontWeight: Typography.medium },

  loader: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyWrap: { paddingTop: Spacing.xl * 2, alignItems: 'center', gap: Spacing.sm },
  emptyTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptySubtitle: { fontSize: Typography.sm, color: Colors.textTertiary, textAlign: 'center' },

  // Récents
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },

  recentSection: { marginBottom: Spacing.lg, gap: Spacing.sm },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  recentChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  recentChipText: { fontSize: Typography.sm, color: Colors.textPrimary },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  sectionCount: { fontSize: Typography.xs, color: Colors.textTertiary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceWarm,
    flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, backgroundColor: Colors.surfaceWarm },
  info: { flex: 1, gap: 2 },
  rowTitle: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  rowSub: { fontSize: Typography.sm, color: Colors.textTertiary },
  chevron: { fontSize: 20, color: Colors.textTertiary },

  separator: { height: 1, backgroundColor: Colors.borderLight },
  loadMore: {
    marginTop: Spacing.md,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  loadMoreText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textSecondary },
})
