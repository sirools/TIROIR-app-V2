import ErrorPage from '../components/layout/ErrorPage'
import { useCopy } from '../locales'

export default function Custom500() {
  const { t: { errors: t } } = useCopy()
  return <ErrorPage title={t.serverTitle} text={t.serverText} />
}
