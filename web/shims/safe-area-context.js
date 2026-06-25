// Fake shim for Next.js to avoid compiling native code
module.exports = {
  SafeAreaView: ({ children, style }) => (
    <div style={style}>{children}</div>
  ),
  SafeAreaProvider: ({ children }) => <>{children}</>,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}