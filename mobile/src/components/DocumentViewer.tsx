import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Platform } from 'react-native'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react-native'
import { Colors, Typography, Spacing } from '@/components/ui'

interface DocumentViewerProps {
  url: string
  fileName: string
  mimeType: string
  onClose: () => void
}

// Rendu autonome de pdf.js embarqué en HTML (pas de dépendance à un viewer
// externe type mozilla.github.io, qui bloque le chargement de fichiers distants
// arbitraires). Le fetch + rendu se fait directement dans la WebView.
function buildPdfHtml(pdfUrl: string, loadingText: string, errorText: string): string {
  const escapedUrl = pdfUrl.replace(/'/g, "\\'")
  const escLoading = loadingText.replace(/</g, '&lt;')
  const escError = errorText.replace(/'/g, "\\'")
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #525659; }
    #pages { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0; }
    canvas { max-width: 100%; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
    #status { color: white; text-align: center; padding: 40px 16px; font-family: -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="status">${escLoading}</div>
  <div id="pages"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const url = '${escapedUrl}';
    const status = document.getElementById('status');
    const pagesEl = document.getElementById('pages');

    pdfjsLib.getDocument(url).promise.then(async (pdf) => {
      status.style.display = 'none';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: window.devicePixelRatio > 1 ? 2 : 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = Math.min(viewport.width, window.innerWidth - 16) + 'px';
        pagesEl.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    }).catch((e) => {
      status.textContent = '${escError}';
    });
  </script>
</body>
</html>
`
}

export function DocumentViewer({ url, fileName, mimeType, onClose }: DocumentViewerProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isPdf = mimeType === 'application/pdf'

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.fileName} numberOfLines={1}>{fileName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={22} color={Colors.textPrimary} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {isPdf ? (
          Platform.OS === 'web' ? (
            // react-native-webview n'existe pas sur web ; les navigateurs
            // affichent nativement les PDF dans un iframe.
            React.createElement('iframe', {
              src: url,
              style: { flex: 1, border: 0, width: '100%', height: '100%' },
            })
          ) : (
            <WebView
              source={{ html: buildPdfHtml(url, t('documentViewer.loading'), t('documentViewer.loadError')) }}
              style={s.webview}
              startInLoadingState
              originWhitelist={['*']}
            />
          )
        ) : (
          <View style={s.imageWrap}>
            <Image source={{ uri: url }} style={s.image} resizeMode="contain" />
          </View>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  fileName: { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, marginRight: Spacing.md },
  webview: { flex: 1, backgroundColor: '#525659' },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' },
  image: { width: '100%', height: '100%' },
})
