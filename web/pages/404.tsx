import ErrorPage from '../components/layout/ErrorPage'
import { useCopy } from '../locales'

export default function NotFound() {
  const { t: { errors: t } } = useCopy()
  return <ErrorPage title={t.notFoundTitle} text={t.notFoundText} />
}
